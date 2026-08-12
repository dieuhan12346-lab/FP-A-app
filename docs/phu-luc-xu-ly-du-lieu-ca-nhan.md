# Phụ lục: Xử lý dữ liệu cá nhân (DPA)

> ⚠️ **BẢN NHÁP — CHƯA CÓ GIÁ TRỊ PHÁP LÝ.**
> Tài liệu này do người phát triển soạn dựa trên **những gì phần mềm thực sự làm**, để luật sư
> rà soát và hoàn thiện. Không phải tư vấn pháp lý. Phải có luật sư duyệt trước khi ký với khách hàng.
>
> Căn cứ dự kiến: Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân.

Phụ lục này là một phần không tách rời của Hợp đồng/Điều khoản dịch vụ giữa:

- **Bên Kiểm soát dữ liệu (Khách hàng)**: công ty sử dụng phần mềm Luxora.
- **Bên Xử lý dữ liệu (Luxora)**: đơn vị cung cấp phần mềm.

Khách hàng quyết định thu thập dữ liệu gì và dùng vào việc gì. Luxora chỉ xử lý theo yêu cầu của
Khách hàng để vận hành phần mềm.

---

## 1. Dữ liệu cá nhân được xử lý

Phần mềm lưu các trường sau. Trong đó **chỉ những trường đánh dấu ⚠️ là dữ liệu cá nhân**; phần còn
lại là dữ liệu kinh doanh của Khách hàng.

### 1.1 Người dùng phần mềm (nhân sự của Khách hàng)

| Dữ liệu | Nguồn |
|---|---|
| ⚠️ Địa chỉ email đăng nhập | Khách hàng tự đăng ký, hoặc đăng nhập bằng Google |
| Vai trò / công ty được phân quyền | Khách hàng thiết lập |

### 1.2 Đối tác/khách hàng của Khách hàng (bên mua chịu)

| Dữ liệu | Bảng | Ghi chú |
|---|---|---|
| ⚠️ Email liên hệ | `receivables.customer_email` | Dùng để gửi thư nhắc thanh toán |
| ⚠️ Số điện thoại | `receivables.customer_phone` | Dùng để nhắc qua SMS/Zalo/WhatsApp |
| ⚠️ Tên người liên hệ trong nội dung thư | `reminder_log.subject`, nội dung email | Do Khách hàng nhập/soạn |
| Tên tổ chức, mã số hóa đơn, số tiền, hạn thanh toán | `receivables` | Dữ liệu kinh doanh |
| Báo cáo tài chính đối tác, hạn mức đã duyệt | `credit_factors` | Do Khách hàng nhập/tải lên |

### 1.3 Dữ liệu kinh doanh khác (không phải dữ liệu cá nhân)

Số dư đầu kỳ, khoản phải chi, giao dịch sổ quỹ/sao kê đã tải lên, hóa đơn, nhật ký gửi thư nhắc nợ.

**Lưu ý quan trọng:** nếu bên mua chịu là **cá nhân hoặc hộ kinh doanh**, thì tên, email, số điện
thoại và cả **thông tin công nợ** của họ đều là dữ liệu cá nhân. Khách hàng có trách nhiệm bảo đảm
có cơ sở pháp lý hợp lệ trước khi nhập các dữ liệu này.

---

## 2. Mục đích và phạm vi xử lý

Luxora xử lý dữ liệu **chỉ để** cung cấp các chức năng Khách hàng sử dụng:

1. Lưu trữ và hiển thị công nợ, dòng tiền của Khách hàng.
2. Dự báo dòng tiền (tính toán trên số liệu giao dịch, không dùng dữ liệu cá nhân).
3. Soạn và gửi thư nhắc thanh toán tới địa chỉ do Khách hàng cung cấp.
4. Chấm điểm tín dụng đối tác trên số liệu do Khách hàng nhập.

Luxora **không** dùng dữ liệu của Khách hàng để quảng cáo, không bán, không chia sẻ cho bên thứ ba
ngoài danh sách tại Mục 4, và **không dùng để huấn luyện mô hình** phục vụ khách hàng khác.

---

## 3. Nơi lưu trữ và chuyển dữ liệu ra nước ngoài

Dữ liệu **được lưu trữ ngoài lãnh thổ Việt Nam**:

| Hệ thống | Vai trò | Khu vực |
|---|---|---|
| Supabase (PostgreSQL trên AWS) | Toàn bộ cơ sở dữ liệu | **Sydney, Úc** — AWS vùng `ap-southeast-2` |
| Railway | Dịch vụ dự báo & gửi thư (không lưu trữ dữ liệu) | Ngoài Việt Nam |
| Resend | Gửi email; lưu nhật ký và **nội dung thư đã gửi** | Hoa Kỳ |
| Vercel | Máy chủ giao diện (không lưu dữ liệu ứng dụng) | Toàn cầu (CDN) |
| Google | Chỉ khi Khách hàng chọn đăng nhập bằng Google | Toàn cầu |

> ⚠️ **Việc cần làm trước khi ký khách đầu tiên:** Nghị định 13/2023/NĐ-CP quy định nghĩa vụ lập
> **Hồ sơ đánh giá tác động chuyển dữ liệu cá nhân ra nước ngoài** và gửi Bộ Công an. Cần luật sư
> xác định phạm vi áp dụng và ai là bên phải lập hồ sơ (Khách hàng, Luxora, hay cả hai).

---

## 4. Bên xử lý dữ liệu phụ

Luxora sử dụng các nhà cung cấp tại Mục 3 làm bên xử lý phụ. Luxora sẽ thông báo trước cho Khách
hàng khi thay đổi danh sách này.

---

## 5. Biện pháp bảo vệ đang áp dụng

Những biện pháp sau **đã được triển khai** trong phần mềm:

- **Phân tách dữ liệu theo từng công ty ở tầng cơ sở dữ liệu.** Mọi bảng gắn `company_id`; chính
  sách Row Level Security của PostgreSQL đối chiếu bảng thành viên trước khi cho đọc. Khoá công khai
  dùng trong trình duyệt **không đọc được bất kỳ dòng dữ liệu nào** nếu chưa đăng nhập hợp lệ.
- **Xác thực bằng JWT.** Dịch vụ dự báo/gửi thư xác minh chữ ký token và kiểm tra người dùng có
  thuộc công ty đó không, trước khi trả về hoặc ghi bất kỳ dữ liệu nào.
- **Mã hóa đường truyền** (TLS) cho mọi kết nối.
- **Khoá bí mật chỉ nằm ở phía máy chủ**, không nhúng trong mã giao diện.
- **Nhật ký gửi thư** ghi lại từng lần gửi (người gửi, người nhận, thời điểm, kết quả).

### Khoảng trống cần khắc phục

| Vấn đề | Trạng thái |
|---|---|
| Quy trình xoá/xuất toàn bộ dữ liệu khi Khách hàng chấm dứt dịch vụ | **Chưa có** — hiện phải thực hiện thủ công |
| Chính sách xoay vòng khoá bí mật máy chủ định kỳ | **Chưa có** |
| Quy trình và cam kết thời hạn thông báo sự cố lộ lọt dữ liệu | **Chưa có văn bản** |
| Sao lưu và khôi phục — chu kỳ, thời gian lưu giữ | Cần xác nhận theo gói dịch vụ Supabase đang dùng |

---

## 6. Quyền của chủ thể dữ liệu

Khi chủ thể dữ liệu (người có email/số điện thoại được lưu) yêu cầu **truy cập, chỉnh sửa, xoá,
rút lại sự đồng ý hoặc phản đối xử lý**:

- **Khách hàng** là bên tiếp nhận và trả lời yêu cầu.
- **Luxora** hỗ trợ trong phạm vi kỹ thuật (trích xuất, chỉnh sửa, xoá dữ liệu trong hệ thống) trong
  thời hạn hai bên thống nhất.

Khách hàng có thể tự xoá email/số điện thoại của một đối tác ngay trong phần mềm tại trang Nhập dữ liệu.

---

## 7. Thời hạn lưu trữ và xoá dữ liệu

- Dữ liệu được lưu trong suốt thời gian Khách hàng sử dụng dịch vụ.
- Khi chấm dứt dịch vụ, Luxora xoá hoặc bàn giao lại dữ liệu theo yêu cầu của Khách hàng trong thời
  hạn hai bên thống nhất *(cần bổ sung số ngày cụ thể — đề xuất 30 ngày)*.
- Nhật ký gửi thư có thể được giữ lâu hơn để phục vụ đối chiếu, tranh chấp *(cần xác định thời hạn)*.

---

## 8. Nghĩa vụ của Khách hàng

Khách hàng chịu trách nhiệm:

1. Bảo đảm **có cơ sở pháp lý hợp lệ** khi nhập email/số điện thoại của đối tác vào phần mềm.
2. Thông báo cho chủ thể dữ liệu về việc xử lý dữ liệu của họ theo quy định.
3. Nội dung thư nhắc nợ do Khách hàng soạn/duyệt trước khi gửi — Luxora không kiểm duyệt nội dung.
4. Quản lý tài khoản truy cập của nhân sự thuộc Khách hàng.

---

## 9. Nội dung cần luật sư bổ sung

- [ ] Xác định chính xác vai trò pháp lý của mỗi bên theo Nghị định 13/2023/NĐ-CP.
- [ ] Hồ sơ đánh giá tác động xử lý dữ liệu cá nhân và hồ sơ chuyển dữ liệu ra nước ngoài.
- [ ] Thời hạn cụ thể: thông báo sự cố, xoá dữ liệu, phản hồi yêu cầu của chủ thể dữ liệu.
- [ ] Điều khoản trách nhiệm, giới hạn trách nhiệm, bồi thường.
- [ ] Quyền kiểm tra/đánh giá của Khách hàng đối với Luxora.
- [ ] Đối chiếu với Luật An ninh mạng về yêu cầu lưu trữ dữ liệu tại Việt Nam đối với loại hình
      dịch vụ này.
