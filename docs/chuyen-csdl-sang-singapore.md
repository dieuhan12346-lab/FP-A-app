# Quy trình chuyển cơ sở dữ liệu sang vùng Singapore

Chuyển từ project Supabase hiện tại (**Sydney — `ap-southeast-2`**) sang project mới ở
**Singapore — `ap-southeast-1`**.

## Điều cần biết trước

| | |
|---|---|
| **Về pháp lý** | Không đổi gì — Sydney hay Singapore đều ngoài Việt Nam, nghĩa vụ như nhau. Lợi ích là **độ trễ** (~30ms thay vì ~60ms) và vị thế khu vực |
| **Cách làm** | **Dựng mới, bắt đầu sạch.** Không di chuyển tài khoản đăng nhập nên không có rủi ro hỏng đăng nhập |
| **Sẽ mất** | Toàn bộ tài khoản hiện có (kể cả người lạ đã tự đăng ký), các công ty thử, công nợ, hoá đơn, nhật ký nhắc nợ. **Mọi người phải đăng ký lại** |
| **Không mất** | Mã nguồn, tài liệu, cấu hình Resend, tên miền gửi email đã verify |
| **Thời gian** | Khoảng 40 phút |
| **Quay lui** | Giữ project cũ tới khi chắc chắn — đổi lại biến môi trường là về như cũ |

> ⚠️ **Mật khẩu cơ sở dữ liệu và service key**: chỉ gõ/dán trong dashboard và cửa sổ dòng lệnh của
> bạn. **Đừng dán vào chat, ảnh chụp màn hình, hay commit.**

### Trước khi bắt đầu: có gì đáng giữ không?

Dữ liệu hiện tại nhìn như dữ liệu thử (nhiều công ty cùng tên `"a"`). Nếu có gì thật cần giữ:

- Vào Cài đặt công ty → **Xuất toàn bộ dữ liệu công ty** cho từng công ty, lưu file JSON lại.
- **Chưa có đường nhập ngược.** File đó để đối chiếu và nhập tay, không tự đổ vào project mới được.

Không có gì cần giữ thì bỏ qua, làm tiếp cho nhanh.

---

## Bước 1 — Tạo project mới ở Singapore

Supabase → **New project**:

- **Region**: `Southeast Asia (Singapore)` — chọn sai vùng thì phải làm lại từ đầu, không đổi được sau
- **Database password**: đặt mật khẩu mạnh, lưu vào trình quản lý mật khẩu
- Tên project: đặt khác project cũ để khỏi nhầm khi đổi biến môi trường

Xong ghi lại **Project ref** (chuỗi trong URL dashboard).

---

## Bước 2 — Dựng schema

Mở [`supabase/000_base_schema.sql`](../supabase/000_base_schema.sql), copy **toàn bộ** → SQL Editor
của project **mới** → Run.

File này đã gộp mọi migration 001–018. **Không chạy thêm gì trong `supabase/migrations/`** — thư mục
đó chỉ dùng để vá cơ sở dữ liệu đang chạy dở, chạy lại trên project mới là thừa.

Kiểm ngay sau khi chạy — cả 3 truy vấn phải ra đúng:

```sql
select count(*) as so_bang from information_schema.tables
 where table_schema = 'public';
-- mong đợi: 13

select count(*) as so_policy from pg_policies where schemaname = 'public';
-- mong đợi: 38

select count(*) as chua_bat_rls from pg_tables t
 where t.schemaname = 'public'
   and not exists (select 1 from pg_class c
                    join pg_namespace n on n.oid = c.relnamespace
                   where n.nspname = 'public' and c.relname = t.tablename and c.relrowsecurity);
-- mong đợi: 0
```

Số thứ ba khác 0 là **dừng lại** — có bảng chưa bật RLS, tức mọi người đọc được dữ liệu của nhau.

---

## Bước 3 — Danh mục tài khoản kế toán

Bảng `accounts` là dữ liệu tham chiếu, schema tạo ra bảng rỗng.

Mở [`supabase/seed_accounts.sql`](../supabase/seed_accounts.sql), copy toàn bộ → SQL Editor project
**mới** → Run. Câu `select` cuối file tự in ra số lượng: phải là **IFRS 13, VAS 18**.

Bỏ bước này thì bảng phân loại tài khoản trống, module Đọc hoá đơn không tự phân loại được.

---

## Bước 4 — Cấu hình xác thực

Project mới → **Authentication**:

1. **Providers → Google**: bật, dán Client ID + Client Secret (dùng lại của project cũ được).
   Nhớ thêm callback URL mới của Supabase vào Google Cloud Console.
2. **URL Configuration**:
   - Site URL: `https://app.luxorasystem.com`
   - Redirect URLs: thêm cả `http://localhost:5173/**` để chạy máy mình

Bỏ qua bước này là đăng nhập Google hỏng, dù cơ sở dữ liệu đúng.

---

## Bước 5 — Đổi biến môi trường

Lấy từ project mới: **Settings → API** (URL, anon key, service_role key) và
**Settings → API → JWT Settings** (JWT secret).

### Vercel — Settings → Environment Variables

| Biến | Giá trị |
|---|---|
| `VITE_SUPABASE_URL` | `https://<ref-moi>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | anon key mới |

### Railway (dịch vụ dự báo & gửi email)

| Biến | Giá trị |
|---|---|
| `SUPABASE_URL` | `https://<ref-moi>.supabase.co` |
| `SUPABASE_SERVICE_KEY` | service_role key mới |
| `SUPABASE_JWT_SECRET` | JWT secret mới |
| `RESEND_API_KEY` | giữ nguyên |
| `REMINDER_FROM` | giữ nguyên |
| `APP_URL` | `https://app.luxorasystem.com` — dùng trong thư mời |

> Dán key **không kèm dấu `<` `>` hay khoảng trắng thừa**. Đã từng mất buổi vì chuyện này: key bị bọc
> trong `< >` làm Supabase trả 401, biểu hiện ra ngoài là lỗi 502 khi gửi nhắc nợ.

### Máy của bạn — `.env.local`

Sửa `VITE_SUPABASE_URL` và `VITE_SUPABASE_ANON_KEY`. File này đã gitignore, không commit.

Xong thì **redeploy cả Vercel lẫn Railway** — biến môi trường chỉ có tác dụng sau khi build lại.

---

## Bước 6 — Kiểm tra

Theo thứ tự, cái sau chỉ đúng khi cái trước đúng:

1. **Đăng ký tài khoản mới** → tạo được hồ sơ công ty → vào được app.
2. **Nhập một khoản phải thu** → tải lại trang vẫn còn.
3. **Mời một email thứ hai** → đăng nhập bằng email đó → thấy lời mời **kèm tên công ty và tên người
   mời** → bấm Tham gia.
4. **Người vừa tham gia phải thấy thanh bên chỉ có Gói & Định giá** — đúng như thiết kế đặc quyền
   tối thiểu. Owner tick agent cho họ thì mục tương ứng mới hiện.
5. **Cách ly dữ liệu** — chạy ở máy mình, thay bằng URL và anon key mới:

   ```bash
   curl "https://<ref-moi>.supabase.co/rest/v1/receivables?select=*" -H "apikey: <ANON_KEY_MOI>"
   ```

   Phải trả `[]`. Ra dữ liệu là RLS hỏng, **dừng lại và quay lui**.

6. **Dự báo dòng tiền** chạy được (kiểm Railway đã nhận biến mới).
7. **Gửi thử một email nhắc nợ** (kiểm Resend + JWT secret mới).

---

## Bước 7 — Dọn dẹp

Chỉ làm khi đã dùng project mới ổn định **vài ngày**:

- Xoay lại token Supabase và mật khẩu cơ sở dữ liệu nếu từng lộ ra ảnh chụp màn hình.
- **Pause** project cũ (đừng xoá ngay — pause là còn quay lui được).
- Xoá hẳn project cũ sau khi chắc chắn không cần nữa.
- Cân nhắc **tắt đăng ký công khai** ở project mới nếu chưa mở bán: Authentication → Providers →
  Email → tắt *Enable sign ups*. Project cũ từng có người lạ tự đăng ký.

---

## Việc cần quyết trước khi bắt đầu

- **Có giữ dữ liệu hiện tại không?** Nếu có, xuất JSON trước (xem đầu tài liệu) — nhưng phải nhập tay.
- **Có tắt đăng ký công khai không?**
- **Làm vào lúc nào?** Trong lúc chuyển, app sẽ gián đoạn vài phút giữa hai lần deploy.
