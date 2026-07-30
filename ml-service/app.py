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

# Gửi email nhắc nợ qua Resend. Chưa cấu hình RESEND_API_KEY → endpoint /send-reminder trả 501.
# REMINDER_FROM mặc định dùng domain sandbox của Resend (chỉ gửi tới email chủ tài khoản);
# đặt "Luxora <no-reply@luxorasystem.com>" sau khi verify domain để gửi tới khách thật.
RESEND_API_KEY = os.getenv("RESEND_API_KEY")
REMINDER_FROM = os.getenv("REMINDER_FROM", "Luxora <onboarding@resend.dev>")


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


class SendReminderReq(BaseModel):
    company_id: str
    to: str                       # email người nhận
    subject: str
    body: str                     # nội dung thuần văn bản (đã soạn ở app)
    receivable_id: str | None = None
    customer: str | None = None
    invoice_codes: str | None = None
    tier: str | None = None       # gentle | firm | urgent
    footer: str | None = None     # dòng chân thư (đã bản địa hoá ở app); có mặc định nếu trống
    reply_to: str | None = None   # Reply-To: nơi nhận phản hồi của khách (mô hình C: email người gửi/công ty)


class EmailDomainReq(BaseModel):
    company_id: str
    domain: str
    from_name: str | None = None


class CompanyRef(BaseModel):
    company_id: str


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


# ---------- Gửi email nhắc nợ (Resend) ----------

def _html_escape(s: str) -> str:
    return (s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))


def _reminder_html(body: str, footer: str | None) -> str:
    """Bọc nội dung thuần văn bản thành HTML đơn giản (giữ xuống dòng) + chân thư."""
    safe = _html_escape(body).replace("\n", "<br>")
    foot = _html_escape(footer or "Email tự động từ hệ thống quản lý công nợ. Nếu đã thanh toán, vui lòng bỏ qua thư này.")
    return (
        '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1a1f2e;line-height:1.6;max-width:640px">'
        f'<div>{safe}</div>'
        f'<hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0">'
        f'<div style="font-size:12px;color:#8a93aa">{foot}</div>'
        '</div>'
    )


def _resend_api(method: str, path: str, payload: dict | None = None) -> dict:
    if not RESEND_API_KEY:
        raise HTTPException(501, "Service chưa cấu hình RESEND_API_KEY")
    import httpx
    try:
        r = httpx.request(method, f"https://api.resend.com{path}",
                          headers={"Authorization": f"Bearer {RESEND_API_KEY}", "Content-Type": "application/json"},
                          json=payload, timeout=30)
    except httpx.HTTPError as e:
        raise HTTPException(502, f"Không gọi được Resend: {e}")
    if r.status_code not in (200, 201):
        raise HTTPException(502, f"Resend lỗi {r.status_code}: {r.text[:200]}")
    return r.json() if r.text else {}


def _company_email_config(company_id: str) -> dict:
    url, key = os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_KEY")
    if not url or not key:
        return {}
    import httpx
    try:
        r = httpx.get(f"{url}/rest/v1/companies",
                      params={"id": f"eq.{company_id}", "select": "name,email_domain,email_domain_id,email_domain_status,email_from_name"},
                      headers={"apikey": key, "Authorization": f"Bearer {key}"}, timeout=20)
        rows = r.json() if r.status_code == 200 else []
        return rows[0] if rows else {}
    except Exception:
        return {}


def _patch_company(company_id: str, fields: dict) -> None:
    url, key = os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_KEY")
    if not url or not key:
        return
    import httpx
    try:
        httpx.patch(f"{url}/rest/v1/companies", params={"id": f"eq.{company_id}"}, json=fields,
                    headers={"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json", "Prefer": "return=minimal"},
                    timeout=20)
    except Exception:
        pass


def _reminder_addr() -> str:
    """Địa chỉ email trong REMINDER_FROM (vd no-reply@luxorasystem.com)."""
    import re
    m = re.search(r"<([^>]+)>", REMINDER_FROM)
    return (m.group(1) if m else REMINDER_FROM).strip()


def _from_hdr(name: str | None, addr: str) -> str:
    """Ghép header From an toàn: bọc tên hiển thị trong dấu nháy (tránh vỡ header khi tên có dấu phẩy)."""
    n = (name or "").replace('"', "").strip()
    return f'"{n}" <{addr}>' if n else addr


def _from_for(company_id: str) -> str:
    """Người gửi theo từng công ty:
       - Có domain riêng đã verify (option B) → no-reply@<domain của công ty>.
       - Chưa có (mô hình C) → gửi từ domain Luxora nhưng HIỆN TÊN CÔNG TY ở phần người gửi."""
    c = _company_email_config(company_id)
    if c.get("email_domain") and c.get("email_domain_status") == "verified":
        return _from_hdr(c.get("email_from_name") or c.get("name") or "Luxora", f"no-reply@{c['email_domain']}")
    name = c.get("email_from_name") or c.get("name")
    return _from_hdr(name, _reminder_addr()) if name else REMINDER_FROM


def _log_reminder(req: "SendReminderReq", user_id: str, status: str, provider_id: str | None, error: str | None) -> None:
    url, key = os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_KEY")
    if not url or not key:
        return  # không cấu hình DB → bỏ qua ghi log, không chặn việc gửi
    import httpx
    try:
        httpx.post(
            f"{url}/rest/v1/reminder_log",
            json={
                "company_id": req.company_id, "receivable_id": req.receivable_id, "customer": req.customer,
                "invoice_codes": req.invoice_codes, "to_email": req.to, "channel": "email",
                "tier": req.tier, "subject": req.subject, "status": status,
                "provider_id": provider_id, "error": error, "sent_by": user_id,
            },
            headers={"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json", "Prefer": "return=minimal"},
            timeout=15,
        )
    except Exception:
        pass  # ghi log lỗi không được làm hỏng kết quả gửi


@app.post("/send-reminder")
def send_reminder(req: SendReminderReq, user_id: str = Depends(require_user)):
    if not _is_member(req.company_id, user_id):
        raise HTTPException(403, "Bạn không thuộc công ty này")
    if not RESEND_API_KEY:
        raise HTTPException(501, "Service chưa cấu hình RESEND_API_KEY — thêm biến môi trường trên Railway")
    to = (req.to or "").strip()
    if "@" not in to or " " in to:
        raise HTTPException(400, "Email người nhận không hợp lệ")
    import httpx
    _payload = {
        "from": _from_for(req.company_id), "to": [to],
        "subject": req.subject or "Nhắc thanh toán công nợ",
        "text": req.body, "html": _reminder_html(req.body, req.footer),
    }
    if req.reply_to and "@" in req.reply_to:
        _payload["reply_to"] = req.reply_to.strip()
    try:
        r = httpx.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {RESEND_API_KEY}", "Content-Type": "application/json"},
            json=_payload,
            timeout=30,
        )
    except httpx.HTTPError as e:
        _log_reminder(req, user_id, "failed", None, f"network: {e}")
        raise HTTPException(502, f"Không gọi được Resend: {e}")
    ok = r.status_code in (200, 201)
    provider_id = (r.json() or {}).get("id") if ok else None
    _log_reminder(req, user_id, "sent" if ok else "failed", provider_id, None if ok else r.text[:300])
    if not ok:
        raise HTTPException(502, f"Resend lỗi {r.status_code}: {r.text[:200]}")
    return {"ok": True, "id": provider_id}


# ---------- Domain gửi email theo từng công ty (option B) ----------

def _norm_status(s: str | None) -> str:
    return "verified" if s == "verified" else ("failed" if s in ("failed", "temporary_failure") else "pending")


@app.post("/email-domain")
def email_domain_setup(req: EmailDomainReq, user_id: str = Depends(require_user)):
    """Đăng ký (hoặc lấy lại) domain gửi của công ty trên Resend → trả bản ghi DNS cần thêm."""
    if not _is_member(req.company_id, user_id):
        raise HTTPException(403, "Bạn không thuộc công ty này")
    domain = (req.domain or "").strip().lower().lstrip("@")
    if "." not in domain or " " in domain:
        raise HTTPException(400, "Tên miền không hợp lệ")
    c = _company_email_config(req.company_id)
    if c.get("email_domain_id") and c.get("email_domain") == domain:
        dom = _resend_api("GET", f"/domains/{c['email_domain_id']}")      # đã đăng ký → lấy lại records
    else:
        try:
            dom = _resend_api("POST", "/domains", {"name": domain})       # đăng ký mới
        except HTTPException:
            # domain có thể đã tồn tại trên tài khoản Resend → tìm lại theo tên rồi lấy chi tiết
            lst = _resend_api("GET", "/domains")
            existing = next((d for d in (lst.get("data") or []) if d.get("name") == domain), None)
            if not existing:
                raise
            dom = _resend_api("GET", f"/domains/{existing['id']}")
    _patch_company(req.company_id, {
        "email_domain": domain, "email_domain_id": dom.get("id"),
        "email_domain_status": _norm_status(dom.get("status")),
        "email_from_name": req.from_name or c.get("name"),
    })
    return {"domain": domain, "status": dom.get("status"), "records": dom.get("records", []), "from": f"no-reply@{domain}"}


@app.post("/email-domain/verify")
def email_domain_verify(req: CompanyRef, user_id: str = Depends(require_user)):
    """Kích hoạt kiểm tra DNS + đọc lại trạng thái verify từ Resend."""
    if not _is_member(req.company_id, user_id):
        raise HTTPException(403, "Bạn không thuộc công ty này")
    c = _company_email_config(req.company_id)
    did = c.get("email_domain_id")
    if not did:
        raise HTTPException(400, "Công ty chưa đăng ký domain gửi")
    try:
        _resend_api("POST", f"/domains/{did}/verify")   # có thể lỗi khi còn pending — vẫn đọc trạng thái bên dưới
    except HTTPException:
        pass
    dom = _resend_api("GET", f"/domains/{did}")
    _patch_company(req.company_id, {"email_domain_status": _norm_status(dom.get("status"))})
    return {"domain": c.get("email_domain"), "status": dom.get("status"), "records": dom.get("records", [])}


@app.get("/email-domain")
def email_domain_get(company_id: str, user_id: str = Depends(require_user)):
    """Trạng thái domain gửi hiện tại của công ty (kèm bản ghi DNS nếu đã đăng ký)."""
    if not _is_member(company_id, user_id):
        raise HTTPException(403, "Bạn không thuộc công ty này")
    c = _company_email_config(company_id)
    out = {"domain": c.get("email_domain"), "status": c.get("email_domain_status") or "none",
           "from_name": c.get("email_from_name") or c.get("name"), "records": []}
    if c.get("email_domain_id"):
        try:
            dom = _resend_api("GET", f"/domains/{c['email_domain_id']}")
            out["status"] = dom.get("status") or out["status"]
            out["records"] = dom.get("records", [])
        except HTTPException:
            pass
    return out
