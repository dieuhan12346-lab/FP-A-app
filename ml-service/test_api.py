"""Test API + auth:
uv run --with fastapi --with httpx --with pyjwt --with xgboost --with scikit-learn --with numpy --with pandas python test_api.py"""
import os, time
# Đặt secret TRƯỚC khi import app (app đọc env lúc import)
SECRET = "test-secret-abc123"
os.environ["SUPABASE_JWT_SECRET"] = SECRET

import numpy as np, pandas as pd, jwt
from fastapi.testclient import TestClient
from app import app

c = TestClient(app)

def token(sub="user-123", aud="authenticated", exp_delta=3600):
    return jwt.encode({"sub": sub, "aud": aud, "exp": int(time.time()) + exp_delta}, SECRET, algorithm="HS256")

def auth(tok):
    return {"Authorization": f"Bearer {tok}"}

# ---- dữ liệu tuần tổng hợp ----
rng = np.random.default_rng(3)
idx = pd.date_range("2024-01-01", periods=104, freq="W-MON")
t = np.arange(104)
inflow = 300 + 1.3 * t + 55 * np.sin(2 * np.pi * (idx.month - 1) / 12) + rng.normal(0, 22, 104)
outflow = 260 + 1.0 * t + rng.normal(0, 18, 104)
weekly = [{"weekStart": d.date().isoformat(), "inflow": float(max(0, inflow[i])), "outflow": float(max(0, outflow[i]))} for i, d in enumerate(idx)]
body = {"weekly": weekly, "horizon": 13, "opening_balance": 500}

# ---- health ----
assert c.get("/health").json()["auth_hs256"] is True
print("✓ /health (auth HS256 bật)")

# ---- KHÔNG token → 401 ----
assert c.post("/forecast", json=body).status_code == 401
print("✓ không token → 401")

# ---- token sai chữ ký → 401 ----
bad = jwt.encode({"sub": "x", "aud": "authenticated", "exp": int(time.time()) + 3600}, "sai-secret", algorithm="HS256")
assert c.post("/forecast", json=body, headers=auth(bad)).status_code == 401
print("✓ token sai chữ ký → 401")

# ---- token hết hạn → 401 ----
assert c.post("/forecast", json=body, headers=auth(token(exp_delta=-10))).status_code == 401
print("✓ token hết hạn → 401")

# ---- token sai audience → 401 ----
assert c.post("/forecast", json=body, headers=auth(token(aud="anon"))).status_code == 401
print("✓ token sai audience → 401")

# ---- token hợp lệ + weekly → 200 ----
r = c.post("/forecast", json=body, headers=auth(token()))
assert r.status_code == 200, r.text
j = r.json()
assert j["model_in"] == "xgboost" and len(j["balance"]) == 13
print("✓ token hợp lệ + weekly → 200 | MAPE in/out:", round(j["mape_in"], 1), "/", round(j["mape_out"], 1))

# ---- token hợp lệ + company_id, chưa cấu hình Supabase → 501 (auth đã qua) ----
assert c.post("/forecast", json={"company_id": "abc"}, headers=auth(token())).status_code == 501
print("✓ token hợp lệ + company_id (chưa cấu hình Supabase) → 501")

# ---- token hợp lệ nhưng thiếu cả weekly & company_id → 400 ----
assert c.post("/forecast", json={"horizon": 13}, headers=auth(token())).status_code == 400
print("✓ token hợp lệ, thiếu dữ liệu → 400")

# ---- RS256 (khoá bất đối xứng) verify qua JWKS ----
from cryptography.hazmat.primitives.asymmetric import rsa
_priv = rsa.generate_private_key(public_exponent=65537, key_size=2048)
_rs_token = jwt.encode({"sub": "u-rs", "aud": "authenticated", "exp": int(time.time()) + 3600}, _priv, algorithm="RS256")
class _FakeKey:
    def __init__(self, k): self.key = k
class _FakeJWKS:
    def get_signing_key_from_jwt(self, tok): return _FakeKey(_priv.public_key())
import app as appmod
appmod._jwks_client = lambda: _FakeJWKS()   # thay JWKS client bằng khoá công khai test
r_rs = c.post("/forecast", json=body, headers=auth(_rs_token))
assert r_rs.status_code == 200, r_rs.text
print("✓ token RS256 verify qua JWKS → 200")

# RS256 sai chữ ký → 401
_priv2 = rsa.generate_private_key(public_exponent=65537, key_size=2048)
_bad_rs = jwt.encode({"sub": "x", "aud": "authenticated", "exp": int(time.time()) + 3600}, _priv2, algorithm="RS256")
assert c.post("/forecast", json=body, headers=auth(_bad_rs)).status_code == 401
print("✓ token RS256 sai chữ ký → 401")

print("\nOK — auth kép (HS256 + JWKS) + API chạy đúng.")
