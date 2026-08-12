# Quy trình chuyển cơ sở dữ liệu sang vùng Singapore

Chuyển từ project Supabase hiện tại (**Sydney — `ap-southeast-2`**) sang project mới ở
**Singapore — `ap-southeast-1`**.

## Vì sao làm bây giờ

- Toàn bộ dữ liệu hiện tại là **bản thử** (9 công ty tên `"a"`, `samsri`, `sru`) — **chưa có khách thật**.
- Càng nhiều khách càng khó chuyển. Bây giờ là thời điểm rẻ nhất.
- Kèm theo giải quyết một rủi ro riêng: **schema gốc chưa có trong Git** (xem Bước 3).

## Điều cần biết trước

| | |
|---|---|
| **Về pháp lý** | Không thay đổi gì — Sydney hay Singapore đều ngoài Việt Nam, nghĩa vụ như nhau. Lợi ích là **độ trễ** (~30ms thay vì ~60ms) và vị thế khu vực |
| **Cách làm** | **Dựng mới, bắt đầu sạch** — không di chuyển tài khoản đăng nhập, nên không có rủi ro hỏng đăng nhập |
| **Sẽ mất** | 6 tài khoản hiện có (gồm 2 người lạ đã tự đăng ký), 9 công ty thử, 109 dòng dữ liệu thử, nhật ký nhắc nợ. **Bạn phải đăng ký lại tài khoản của mình** |
| **Không mất** | Toàn bộ mã nguồn, tài liệu, cấu hình Resend, tên miền gửi email đã verify |
| **Thời gian** | Khoảng 45–60 phút |
| **Quay lui** | Giữ project cũ tới khi chắc chắn — chỉ cần đổi lại biến môi trường là về như cũ |

> ⚠️ **Mật khẩu cơ sở dữ liệu**: chỉ gõ trong cửa sổ dòng lệnh của bạn. **Đừng dán vào chat, ảnh chụp
> màn hình, hay commit.** Nếu quên, đặt lại tại Supabase → Settings → Database → Reset database password.

---

## Bước 1 — Cài Supabase CLI

Chọn một trong hai:

```bash
npm install -g supabase
```

hoặc dùng Scoop trên Windows:

```bash
scoop install supabase
```

Kiểm tra:

```bash
supabase --version
```

---

## Bước 2 — Xuất schema từ project cũ

Lấy chuỗi kết nối tại **Supabase (project cũ) → Settings → Database → Connection string → URI**,
thay `[YOUR-PASSWORD]` bằng mật khẩu thật.

```bash
cd E:/Work/dongtien-preview
supabase db dump --db-url "postgresql://postgres:MAT_KHAU@db.krajllyrixcctkqhoxxi.supabase.co:5432/postgres" -f supabase/schema.sql
```

**Kiểm tra file vừa tạo** — phải thấy đủ:

```bash
grep -c "create table" supabase/schema.sql      # mong ≥ 9
grep -c "create policy" supabase/schema.sql     # mong ≥ 5 (các chính sách RLS)
grep "row level security" supabase/schema.sql   # phải có
```

Nếu thiếu chính sách RLS thì **dừng lại** — chuyển sang project mới mà mất RLS là mất toàn bộ cách ly
giữa các công ty.

---

## Bước 3 — Đưa schema vào Git

Đây là phần sửa lỗi tồn đọng: hiện các bảng gốc (`companies`, `company_members`, `receivables`,
`payables`, `cashflow_settings`, `invoice_uploads`, `invoice_lines`) **không có trong thư mục
migrations** — chúng được tạo tay trên dashboard. Nghĩa là **không dựng lại được database từ repo**.

Sau khi có `supabase/schema.sql`, đưa vào Git để lần sau dựng lại được.

---

## Bước 4 — Tạo project mới ở Singapore

1. [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**
2. Đặt tên, ví dụ `luxora-sg`
3. **Region: Southeast Asia (Singapore)** ⬅️ đúng bước cần thiết của cả quy trình này
4. Đặt mật khẩu CSDL mới, lưu vào trình quản lý mật khẩu
5. Chờ project khởi tạo xong (~2 phút)

---

## Bước 5 — Dựng schema trên project mới

**Cách A** — dán trực tiếp: mở `supabase/schema.sql`, copy toàn bộ → SQL Editor của project **mới** → Run.

**Cách B** — bằng CLI:

```bash
psql "postgresql://postgres:MAT_KHAU_MOI@db.<ref-moi>.supabase.co:5432/postgres" -f supabase/schema.sql
```

Kiểm tra: Table Editor của project mới phải thấy đủ các bảng, và mỗi bảng có nhãn **RLS enabled**.

---

## Bước 6 — Cấu hình xác thực

### 6.1 Đăng nhập bằng Google

1. Project mới → **Authentication → Providers → Google** → bật
2. Điền **Client ID** và **Client Secret** (lấy từ project cũ, hoặc từ Google Cloud Console)
3. ⚠️ **Bước hay bị quên:** vào [Google Cloud Console](https://console.cloud.google.com) → Credentials
   → OAuth client → thêm **Authorized redirect URI** mới:

   ```
   https://<ref-moi>.supabase.co/auth/v1/callback
   ```

   Không thêm thì đăng nhập Google sẽ báo lỗi `redirect_uri_mismatch`.

### 6.2 Địa chỉ chuyển hướng của app

Project mới → **Authentication → URL Configuration**:

- **Site URL**: `https://app.luxorasystem.com`
- **Redirect URLs**: thêm `https://app.luxorasystem.com/**` và `http://localhost:5173/**`

---

## Bước 7 — Cập nhật biến môi trường

Lấy từ project **mới**: Settings → API (URL, anon key, service_role key) và Settings → API → JWT Settings (JWT secret).

> ⚠️ Dán **nguyên văn**, không kèm dấu `< >` hay khoảng trắng — lỗi này từng làm dịch vụ trả
> 401 "Invalid API key".

### 7.1 Vercel (giao diện)

Project → Settings → Environment Variables:

| Biến | Giá trị |
|---|---|
| `VITE_SUPABASE_URL` | `https://<ref-moi>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | anon key mới |

Sau đó **Redeploy** nhánh `production` để bản build lấy biến mới.

### 7.2 Railway (dịch vụ dự báo & gửi email)

Service `luxora-forecast` → Variables:

| Biến | Giá trị |
|---|---|
| `SUPABASE_URL` | `https://<ref-moi>.supabase.co` |
| `SUPABASE_SERVICE_KEY` | service_role key mới |
| `SUPABASE_JWT_SECRET` | JWT secret mới |

`RESEND_API_KEY` và `REMINDER_FROM` **giữ nguyên** — không liên quan.

Sau đó Deploy lại.

### 7.3 Máy của bạn

Sửa `E:\Work\dongtien-preview\.env.local`:

```
VITE_SUPABASE_URL=https://<ref-moi>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key mới>
```

---

## Bước 8 — Chạy các migration bổ sung

Trên project mới, SQL Editor, chạy lần lượt các file trong `supabase/migrations/` **nếu**
`schema.sql` chưa bao gồm (dump từ project cũ thì đã có sẵn — kiểm tra trước bằng cách xem các bảng
`credit_factors`, `reminder_log`, `transactions` và các cột `customer_email`, `customer_phone`,
`financials`, `approved_limit`, `review_at` đã có chưa).

---

## Bước 9 — Kiểm tra

Theo đúng thứ tự này, dừng lại ngay nếu bước nào hỏng:

1. **`/health` của dịch vụ** — `curl https://luxora-forecast-production.up.railway.app/health` → `ok: true`
2. **RLS còn nguyên** — dùng anon key gọi thử, phải trả **0 dòng**:
   ```bash
   curl "https://<ref-moi>.supabase.co/rest/v1/companies?select=*" -H "apikey: <anon-key-moi>"
   ```
   Nếu trả về dữ liệu → **RLS hỏng, dừng lại ngay**.
3. **Đăng ký lại tài khoản** trên app, tạo hồ sơ công ty
4. **Nhập thử một khoản phải thu** có email của bạn
5. **Gửi thử email nhắc nợ** — phải nhận được thư từ `no-reply@luxorasystem.com`
6. **Chấm điểm tín dụng** — import 3 file BCTC, kiểm tra ra đủ 9 tỷ số
7. **Xuất dữ liệu công ty** — nút trong phần cài đặt, tải được file JSON

---

## Bước 10 — Dọn dẹp

**Chỉ làm sau khi Bước 9 xong sạch và đã dùng vài ngày:**

1. Cập nhật hai tài liệu pháp lý: đổi vùng lưu trữ Sydney → Singapore
   (`phu-luc-xu-ly-du-lieu-ca-nhan.md`, `ho-so-chuyen-du-lieu-ra-nuoc-ngoai.md`)
2. Xoá project Supabase cũ — Settings → General → Delete project
3. Thu hồi khoá service của project cũ (tự mất khi xoá project)

> **Quay lui:** nếu có vấn đề, đổi biến môi trường ở Vercel và Railway về giá trị cũ rồi deploy lại.
> Project cũ vẫn nguyên vẹn cho tới Bước 10.

---

## Việc cần quyết trước khi bắt đầu

- [ ] **Chấp nhận mất 6 tài khoản hiện có**, gồm 2 người lạ đã tự đăng ký (`msamiha506@gmail.com`,
      `kavigovi2304@gmail.com`) và 2 công ty thử của họ. Nếu muốn giữ thì phải di chuyển tài khoản —
      phức tạp hơn nhiều, và không đáng với dữ liệu thử.
- [ ] **Có muốn giới hạn đăng ký không?** App hiện mở công khai, ai có link cũng tạo được tài khoản.
      Đây là dịp thuận tiện để đổi (chỉ cho mời, hoặc duyệt tay).
