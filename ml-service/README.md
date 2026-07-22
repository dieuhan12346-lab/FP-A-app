# Luxora — Dịch vụ dự báo dòng tiền (XGBoost)

Microservice Python đọc lịch sử giao dịch tiền (bảng `transactions` của Supabase) và trả về dự báo dòng tiền 13 tuần cho app React.

## Mô hình
- **Detrend tuyến tính + XGBoost học phần dư** → cây không phải ngoại suy xu hướng (điểm yếu chí mạng của tree khi chuỗi tăng dần).
- Feature: lag 1–4 tuần, rolling mean/std 4 tuần, tuần-trong-tháng, tháng, quý, cờ cuối tháng (lương/thuế).
- **Backtest theo thời gian** (giữ tuần cuối) → MAPE/MAE thật.
- **Lùi baseline** khi < 26 tuần dữ liệu (nói thật, không bịa ML).
- Dự báo inflow & outflow riêng → đường số dư + khoảng tin cậy từ sai số backtest.

## Chạy local
```bash
uv run --with fastapi --with uvicorn --with xgboost --with scikit-learn \
       --with numpy --with pandas --with httpx uvicorn app:app --port 8000
# self-test lõi:  python forecast.py     | test API:  python test_api.py
```

## API
`POST /forecast`
```jsonc
// đường 1: truyền thẳng (test được, không cần DB)
{ "weekly": [{ "weekStart": "2025-01-06", "inflow": 320, "outflow": 280 }], "opening_balance": 500, "horizon": 13 }
// đường 2: đọc từ Supabase
{ "company_id": "<uuid>", "opening_balance": 500 }
```
Trả về: `inflow[], outflow[], net[], balance[], balance_lo[], balance_hi[], model_in/out, mape_in/out`.

## Deploy (Railway / Render / Fly)
Có sẵn `Dockerfile`. Biến môi trường cần đặt trên host:
| Biến | Ý nghĩa |
|---|---|
| `SUPABASE_JWT_SECRET` | **JWT Secret** (Settings → API → JWT Secret) — để verify token người gọi |
| `SUPABASE_URL` | URL project Supabase |
| `SUPABASE_SERVICE_KEY` | **service-role key** — bí mật, chỉ đặt ở server, KHÔNG bao giờ đưa vào frontend |
| `ALLOW_ORIGINS` | Origin app được phép gọi (mặc định đã gồm app.luxorasystem.com) |

## Bảo mật
- ✅ **Xác thực JWT (đã làm)**: `/forecast` yêu cầu `Authorization: Bearer <supabase access_token>`. Service verify chữ ký (HS256), hạn dùng, audience; theo `company_id` thì đối chiếu `company_members` — không thuộc công ty → 403. Thiếu/sai token → 401.
  - *Nếu project bật khoá bất đối xứng (ES256/RS256) thay cho JWT Secret cũ, cần đổi sang verify bằng JWKS — báo tôi.*
- **service-role key** bỏ qua RLS → tuyệt đối chỉ nằm ở service này, không đưa ra frontend.
- Đặt `SUPABASE_JWT_SECRET` bắt buộc: thiếu nó thì `/forecast` trả 500 (fail-closed, không cho qua).
