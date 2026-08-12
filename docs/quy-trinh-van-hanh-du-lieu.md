# Quy trình vận hành dữ liệu

Tài liệu cho **người vận hành hệ thống**. Bổ khuyết những mục còn thiếu được nêu trong
`phu-luc-xu-ly-du-lieu-ca-nhan.md` và `ho-so-chuyen-du-lieu-ra-nuoc-ngoai.md`.

---

## 1. Xuất dữ liệu của một công ty

**Khách hàng tự làm được**, không cần người vận hành:

> Trong app → biểu tượng công ty → **Xuất toàn bộ dữ liệu công ty**

Tải về tệp JSON gồm: hồ sơ công ty, công nợ phải thu/phải chi, số dư đầu kỳ, giao dịch sổ quỹ đã
nhập, hóa đơn và dòng hóa đơn, chấm điểm tín dụng, nhật ký nhắc nợ.

Row Level Security vẫn áp dụng khi xuất — người dùng chỉ lấy được dữ liệu công ty mình thuộc về.

---

## 2. Xoá toàn bộ dữ liệu của một công ty

Dùng khi khách hàng chấm dứt dịch vụ và yêu cầu xoá dữ liệu.

**Cố ý không đưa vào giao diện app** — thao tác không hoàn tác được, phải chạy tay.

### Bước 1 — Xem trước (không xoá gì)

```bash
node scripts/xoa-du-lieu-cong-ty.cjs <company_id>
```

In ra tên công ty và số bản ghi từng bảng sẽ bị xoá. **Đối chiếu tên công ty trước khi sang bước 2.**

### Bước 2 — Xoá thật

```bash
node scripts/xoa-du-lieu-cong-ty.cjs <company_id> --confirm "Tên công ty đúng như trong CSDL"
```

Tên gõ vào phải **khớp tuyệt đối** với tên trong cơ sở dữ liệu, sai một ký tự là script dừng.

Cần biến môi trường `SUPABASE_URL` và `SUPABASE_SERVICE_KEY`.

### Bước 3 — Xử lý phần script KHÔNG xoá được

| Còn sót ở đâu | Cách xử lý |
|---|---|
| **Resend** — nhật ký và nội dung thư nhắc nợ đã gửi | Gửi yêu cầu xoá tới Resend |
| **Tài khoản đăng nhập** (`auth.users`) | Xoá thủ công trong Supabase → Authentication, nếu người dùng yêu cầu |
| **Bản sao lưu tự động của Supabase** | Dữ liệu vẫn còn tới khi hết hạn lưu giữ của gói dịch vụ — nêu rõ điều này với khách hàng |

> Ghi lại: ngày xoá, ai thực hiện, số bản ghi đã xoá, các bước ở Bước 3 đã làm.

---

## 3. Xoay vòng khoá bí mật

### Khoá cần xoay và mức độ nguy hiểm

| Khoá | Nằm ở | Nếu lộ |
|---|---|---|
| `SUPABASE_SERVICE_KEY` | Biến môi trường Railway | **Nghiêm trọng nhất** — bỏ qua toàn bộ Row Level Security, đọc/ghi được dữ liệu **mọi công ty** |
| `RESEND_API_KEY` | Biến môi trường Railway | Gửi email mạo danh miền của bạn; đọc nhật ký thư đã gửi |
| `SUPABASE_JWT_SECRET` | Biến môi trường Railway | Có thể giả mạo token đăng nhập |
| `VITE_SUPABASE_ANON_KEY` | Nhúng trong mã giao diện — **vốn đã công khai** | Không nguy hiểm nếu RLS còn nguyên; đã kiểm chứng không đọc được dòng nào khi chưa đăng nhập |

### Chu kỳ đề xuất

- **Định kỳ:** 6 tháng một lần.
- **Ngay lập tức:** khi khoá bị lộ (dán nhầm vào ảnh chụp màn hình, chat, commit), hoặc khi có người
  rời nhóm vận hành.

### Cách xoay `SUPABASE_SERVICE_KEY`

1. Supabase → **Project Settings → API** → tạo khoá service mới.
2. Railway → service `luxora-forecast` → **Variables** → cập nhật `SUPABASE_SERVICE_KEY`.
   ⚠️ **Dán nguyên văn, không kèm dấu `< >` hay khoảng trắng** — lỗi này từng xảy ra và làm dịch vụ
   trả 401 "Invalid API key".
3. Bấm **Deploy/Apply** để áp dụng.
4. Kiểm tra: `curl https://<railway-domain>/health` phải trả `ok: true`, và thử một lần gửi thư nhắc
   nợ để chắc chắn phần đọc dữ liệu còn chạy.
5. Thu hồi khoá cũ trong Supabase.

### Cách xoay `RESEND_API_KEY`

1. Resend → **API Keys** → tạo khoá mới quyền **Full access** (cần quyền này để quản lý tên miền gửi).
2. Railway → cập nhật `RESEND_API_KEY` → Deploy.
3. Gửi thử một thư nhắc nợ để xác nhận.
4. Xoá khoá cũ trên Resend.

### Nguyên tắc

- **Không bao giờ** dán khoá vào ảnh chụp màn hình, tin nhắn, hay commit vào Git.
- Khoá chỉ nằm trong biến môi trường phía máy chủ.
- Sau khi xoay, kiểm tra dịch vụ chạy được **trước khi** thu hồi khoá cũ.

---

## 4. Khi nghi ngờ lộ lọt dữ liệu

1. **Xoay ngay** khoá bị nghi lộ (Mục 3) — làm trước, điều tra sau.
2. Xem nhật ký truy cập Supabase để khoanh vùng phạm vi và thời gian.
3. Xác định dữ liệu nào bị ảnh hưởng, của công ty nào.
4. Thông báo cho khách hàng bị ảnh hưởng.

> ⚠️ **Chưa có** cam kết thời hạn thông báo bằng văn bản. Luật có quy định thời hạn cụ thể — cần
> luật sư xác định và đưa vào điều khoản dịch vụ.

---

## 5. Việc còn thiếu

| Việc | Trạng thái |
|---|---|
| Xuất dữ liệu công ty | ✅ Có trong app |
| Xoá dữ liệu công ty | ✅ Script có chốt chặn |
| Quy trình xoay khoá | ✅ Tài liệu này |
| Nhắc xoay khoá định kỳ | ❌ Chưa tự động — hiện phải tự nhớ |
| Cam kết thời hạn thông báo sự cố | ❌ Cần luật sư |
| Xác nhận chu kỳ sao lưu Supabase | ❌ Cần kiểm tra theo gói dịch vụ đang dùng |
| Phụ lục xử lý dữ liệu ký với từng nhà cung cấp | ❌ Chưa ký với bên nào |
