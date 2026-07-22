"""
API dự báo dòng tiền (FastAPI). App React gọi POST /forecast.
Hai đường nạp dữ liệu:
  - Truyền thẳng `weekly` (test được, không cần DB)
  - Truyền `company_id` → đọc bảng transactions của Supabase (Giai đoạn 2/3)

Chạy local:  uv run --with fastapi --with uvicorn --with xgboost --with scikit-learn --with numpy --with pandas --with httpx uvicorn app:app --reload --port 8000
"""
from __future__ import annotations
import os
from datetime import date, timedelta
from functools import lru_cache
import jwt  # PyJWT
from jwt import PyJWKClient
from jwt.exceptions import PyJWKClientError
from fastapi import FastAPI, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from forecast import forecast_cashflow

# Supabase đang chuyển từ JWT Secret cũ (HS256) sang JWT Signing Keys mới (RS256/ES256).
# Service hỗ trợ CẢ HAI: HS256 verify bằng secret; bất đối xứng verify qua JWKS.
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET")   # Legacy JWT Secret (nếu token HS256)
SUPABASE_URL = os.getenv("SUPABASE_URL")                  # dùng cho JWKS + đọc transactions


@lru_cache(maxsize=1)
def _jwks_client():
    if not SUPABASE_URL:
        return None
    return PyJWKClient(f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json")


app = FastAPI(title="Luxora Cashflow Forecast", version="0.1.0")

# App React (luxora) gọi từ trình duyệt → cho phép origin của app
ALLOW = [o.strip() for o in os.getenv("ALLOW_ORIGINS", "http://localhost:5173,http://localhost:5174,https://app.luxorasystem.com").split(",") if o.strip()]
app.add_middleware(CORSMiddleware, allow_origins=ALLOW, allow_methods=["*"], allow_headers=["*"])


class WeeklyPoint(BaseModel):
    weekStart: str
    inflow: float = 0.0
    outflow: float = 0.0


class ForecastReq(BaseModel):
    weekly: list[WeeklyPoint] | None = None
    company_id: str | None = None
    horizon: int = 13
    opening_balance: float = 0.0


def _monday(iso: str) -> str:
    y, m, d = (int(x) for x in iso[:10].split("-"))
    dt = date(y, m, d)
    return (dt - timedelta(days=dt.weekday())).isoformat()


def _bucket_weekly(txns: list[dict], to_millions=True) -> list[dict]:
    """Gom giao dịch (amount VND) thành chuỗi tuần, điền tuần trống."""
    scale = 1e6 if to_millions else 1
    agg: dict[str, dict] = {}
    for tx in txns:
        w = _monday(tx["txn_date"])
        g = agg.setdefault(w, {"weekStart": w, "inflow": 0.0, "outflow": 0.0})
        g["inflow"] += (float(tx.get("amount_in") or 0)) / scale
        g["outflow"] += (float(tx.get("amount_out") or 0)) / scale
    if not agg:
        return []
    ks = sorted(agg)
    out, cur = [], date.fromisoformat(ks[0])
    last = date.fromisoformat(ks[-1])
    while cur <= last:
        w = cur.isoformat()
        out.append(agg.get(w, {"weekStart": w, "inflow": 0.0, "outflow": 0.0}))
        cur += timedelta(days=7)
    return out


def _load_from_supabase(company_id: str) -> list[dict]:
    url, key = os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_KEY")
    if not url or not key:
        raise HTTPException(501, "Service chưa cấu hình SUPABASE_URL / SUPABASE_SERVICE_KEY")
    import httpx
    r = httpx.get(
        f"{url}/rest/v1/transactions",
        params={"company_id": f"eq.{company_id}", "select": "txn_date,amount_in,amount_out", "order": "txn_date.asc"},
        headers={"apikey": key, "Authorization": f"Bearer {key}"}, timeout=30,
    )
    if r.status_code != 200:
        raise HTTPException(502, f"Supabase lỗi: {r.status_code} {r.text[:180]}")
    return _bucket_weekly(r.json())


def require_user(authorization: str | None = Header(default=None)) -> str:
    """Verify Supabase JWT (HS256 legacy HOẶC RS256/ES256 qua JWKS) → user_id (sub)."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Thiếu Bearer token")
    token = authorization.split(" ", 1)[1].strip()
    try:
        alg = jwt.get_unverified_header(token).get("alg", "")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Token không hợp lệ")
    try:
        if alg == "HS256":
            if not SUPABASE_JWT_SECRET:
                raise HTTPException(500, "Token HS256 nhưng service chưa cấu hình SUPABASE_JWT_SECRET")
            payload = jwt.decode(token, SUPABASE_JWT_SECRET, algorithms=["HS256"], audience="authenticated")
        elif alg in ("RS256", "ES256", "EdDSA"):
            client = _jwks_client()
            if client is None:
                raise HTTPException(500, "Token bất đối xứng nhưng chưa cấu hình SUPABASE_URL (cần cho JWKS)")
            try:
                key = client.get_signing_key_from_jwt(token).key
            except PyJWKClientError as e:
                raise HTTPException(502, f"Không lấy được khoá JWKS: {e}")
            payload = jwt.decode(token, key, algorithms=[alg], audience="authenticated")
        else:
            raise HTTPException(401, f"Thuật toán token không hỗ trợ: {alg or '—'}")
    except HTTPException:
        raise
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token hết hạn")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Token không hợp lệ")
    uid = payload.get("sub")
    if not uid:
        raise HTTPException(401, "Token thiếu sub")
    return uid


def _is_member(company_id: str, user_id: str) -> bool:
    """Đối chiếu company_members: user_id có thuộc company_id không (service-role, lọc rõ theo user đã verify)."""
    url, key = os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_KEY")
    if not url or not key:
        raise HTTPException(501, "Service chưa cấu hình SUPABASE_URL / SUPABASE_SERVICE_KEY")
    import httpx
    r = httpx.get(
        f"{url}/rest/v1/company_members",
        params={"company_id": f"eq.{company_id}", "user_id": f"eq.{user_id}", "select": "company_id"},
        headers={"apikey": key, "Authorization": f"Bearer {key}"}, timeout=20,
    )
    if r.status_code != 200:
        raise HTTPException(502, f"Supabase lỗi: {r.status_code} {r.text[:180]}")
    return len(r.json()) > 0


@app.get("/health")
def health():
    return {"ok": True, "service": "luxora-cashflow-forecast", "version": app.version,
            "auth_hs256": bool(SUPABASE_JWT_SECRET), "auth_jwks": bool(SUPABASE_URL)}


@app.post("/forecast")
def forecast(req: ForecastReq, user_id: str = Depends(require_user)):
    # Đã xác thực JWT. Nếu theo company_id → phải là thành viên công ty.
    if req.company_id:
        if not _is_member(req.company_id, user_id):
            raise HTTPException(403, "Bạn không thuộc công ty này")
        weekly = _load_from_supabase(req.company_id)
    elif req.weekly is not None:
        weekly = [w.model_dump() for w in req.weekly]
    else:
        raise HTTPException(400, "Cần 'weekly' hoặc 'company_id'")
    if not weekly:
        raise HTTPException(404, "Không có dữ liệu giao dịch để dự báo")
    return forecast_cashflow(weekly, horizon=max(1, min(req.horizon, 26)), opening_balance=req.opening_balance)
