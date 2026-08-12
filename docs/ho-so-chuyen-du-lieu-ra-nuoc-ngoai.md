# Hồ sơ đánh giá tác động chuyển dữ liệu cá nhân ra nước ngoài

> ⚠️ **BẢN NHÁP KỸ THUẬT — CHƯA PHẢI HỒ SƠ NỘP ĐƯỢC.**
>
> Tài liệu này cung cấp **phần nội dung kỹ thuật** để luật sư đưa vào đúng biểu mẫu quy định.
> Người soạn không phải luật sư.
>
> **⚠️ Kiểm tra đầu tiên với luật sư:** khung pháp lý hiện hành là gì? Nghị định 13/2023/NĐ-CP,
> hay đã có **Luật Bảo vệ dữ liệu cá nhân** thay thế/bổ sung? Nghĩa vụ, biểu mẫu, cơ quan tiếp nhận
> và thời hạn nộp phụ thuộc vào câu trả lời này. **Không dựa vào mốc 2023 nêu trên.**
>
> Cần luật sư xác định thêm:
> - Ai là bên phải lập hồ sơ: Khách hàng (bên kiểm soát), Luxora (bên xử lý), hay cả hai?
> - Đúng biểu mẫu tại phụ lục văn bản đang có hiệu lực (không dùng cấu trúc dưới đây làm biểu mẫu).
> - Thời hạn nộp và cơ quan tiếp nhận.

---

## A. Thông tin các bên

### A.1 Bên chuyển dữ liệu

| Mục | Nội dung |
|---|---|
| Tên tổ chức | *[CẦN ĐIỀN — tên pháp nhân đầy đủ]* |
| Mã số doanh nghiệp | *[CẦN ĐIỀN]* |
| Địa chỉ trụ sở | *[CẦN ĐIỀN]* |
| Người đại diện theo pháp luật | *[CẦN ĐIỀN]* |
| Bộ phận/người phụ trách bảo vệ dữ liệu cá nhân | *[CẦN ĐIỀN — họ tên, chức danh, điện thoại, email]* |

> Nếu Khách hàng (công ty sử dụng phần mềm) là bên phải lập hồ sơ, thì đây là thông tin của **Khách
> hàng**, không phải của Luxora. Luật sư xác định.

### A.2 Các bên tiếp nhận dữ liệu ở nước ngoài

| Bên tiếp nhận | Vai trò | Dữ liệu nhận | Khu vực lưu trữ |
|---|---|---|---|
| **Supabase** (nền tảng cơ sở dữ liệu, chạy trên AWS) | Lưu trữ toàn bộ cơ sở dữ liệu | Tất cả dữ liệu tại Mục B | Ngoài Việt Nam — *[CẦN XÁC NHẬN vùng cụ thể tại bảng điều khiển Supabase → Settings → General → Region]* |
| **Railway** | Chạy dịch vụ dự báo dòng tiền và gửi thư nhắc nợ. **Không lưu trữ dữ liệu** — chỉ đọc, tính toán, trả kết quả | Đọc giao dịch, công nợ; ghi nhật ký gửi thư | Ngoài Việt Nam |
| **Resend** | Gửi email nhắc thanh toán. **Có lưu nhật ký và nội dung thư đã gửi** trên hệ thống của họ | Địa chỉ email người nhận, tiêu đề và nội dung thư | Hoa Kỳ |
| **Vercel** | Máy chủ giao diện web. Không lưu dữ liệu ứng dụng | Không | Mạng phân phối toàn cầu |
| **Google** | Chỉ áp dụng khi người dùng chọn đăng nhập bằng tài khoản Google | Địa chỉ email đăng nhập | Toàn cầu |

*[CẦN ĐIỀN: địa chỉ pháp lý và đầu mối liên hệ của từng nhà cung cấp — lấy trong điều khoản dịch vụ
và phụ lục xử lý dữ liệu của họ.]*

---

## B. Loại dữ liệu cá nhân được chuyển

Phần mềm chuyển ra nước ngoài các dữ liệu sau. Phân biệt rõ **dữ liệu cá nhân** và dữ liệu kinh doanh:

### B.1 Dữ liệu cá nhân

| Dữ liệu | Chủ thể dữ liệu | Nơi lưu | Mục đích |
|---|---|---|---|
| Địa chỉ email đăng nhập | Nhân sự của Khách hàng | Supabase (+ Google nếu đăng nhập bằng Google) | Xác thực người dùng |
| Email liên hệ của bên mua chịu | Người liên hệ phía đối tác | Supabase, **Resend** | Gửi thư nhắc thanh toán |
| Số điện thoại của bên mua chịu | Người liên hệ phía đối tác | Supabase | Nhắc qua SMS/Zalo/WhatsApp |
| Tên người liên hệ xuất hiện trong nội dung thư | Người liên hệ phía đối tác | Supabase, **Resend** | Nội dung thư nhắc nợ |

> **Trường hợp làm tăng nghĩa vụ:** nếu bên mua chịu là **cá nhân hoặc hộ kinh doanh**, thì tên tổ
> chức, số tiền nợ, hạn thanh toán và lịch sử thanh toán của họ **cũng là dữ liệu cá nhân**. Cần
> luật sư xác định trước, vì phạm vi hồ sơ sẽ rộng hơn nhiều.

### B.2 Dữ liệu không phải dữ liệu cá nhân (dữ liệu kinh doanh của Khách hàng)

Số dư đầu kỳ, các khoản phải thu/phải chi của tổ chức, giao dịch sổ quỹ và sao kê ngân hàng đã tải
lên, hóa đơn, báo cáo tài chính đối tác, hạn mức tín dụng đã duyệt.

### B.3 Dữ liệu **không** được chuyển

Phần mềm **không** thu thập: căn cước công dân, số tài khoản cá nhân của chủ thể dữ liệu, dữ liệu
sinh trắc học, dữ liệu sức khỏe, hay bất kỳ loại dữ liệu cá nhân nhạy cảm nào.

---

## C. Mục đích xử lý sau khi chuyển ra nước ngoài

Dữ liệu **không** được chuyển ra nước ngoài để khai thác thương mại. Việc chuyển là **hệ quả kỹ thuật**
của việc dùng dịch vụ hạ tầng đám mây, phục vụ đúng bốn chức năng Khách hàng sử dụng:

1. **Lưu trữ** — cơ sở dữ liệu đặt trên hạ tầng Supabase.
2. **Dự báo dòng tiền** — tính toán trên số liệu giao dịch; **không sử dụng dữ liệu cá nhân**.
3. **Gửi thư nhắc thanh toán** — bắt buộc chuyển địa chỉ email người nhận cho nhà cung cấp dịch vụ gửi thư.
4. **Chấm điểm tín dụng đối tác** — tính trên số liệu tài chính và lịch sử thanh toán do Khách hàng nhập.

Không bên tiếp nhận nào được phép dùng dữ liệu cho mục đích riêng, bán lại, hay huấn luyện mô hình
phục vụ bên khác. *[CẦN ĐỐI CHIẾU: xác nhận điều này trong điều khoản dịch vụ của từng nhà cung cấp.]*

---

## D. Biện pháp bảo vệ đang áp dụng

Các biện pháp sau **đã triển khai và kiểm chứng được**:

| Biện pháp | Mô tả |
|---|---|
| **Phân tách dữ liệu ở tầng cơ sở dữ liệu** | Mọi bảng gắn mã công ty; chính sách Row Level Security của PostgreSQL đối chiếu bảng thành viên trước khi cho đọc. **Đã kiểm chứng:** khoá công khai dùng trong trình duyệt không đọc được bất kỳ dòng nào khi chưa đăng nhập hợp lệ |
| **Xác thực và phân quyền** | Dịch vụ dự báo/gửi thư xác minh chữ ký token và kiểm tra người dùng có thuộc công ty đó không, trước khi đọc hoặc ghi bất kỳ dữ liệu nào |
| **Mã hóa đường truyền** | TLS cho toàn bộ kết nối giữa trình duyệt, cơ sở dữ liệu và các dịch vụ |
| **Quản lý khoá bí mật** | Khoá đặc quyền chỉ nằm ở biến môi trường phía máy chủ, không nhúng trong mã giao diện |
| **Nhật ký gửi thư** | Ghi lại từng lần gửi: người gửi, người nhận, thời điểm, kết quả |
| **Giới hạn dữ liệu gửi ra ngoài** | Chỉ địa chỉ email và nội dung thư được chuyển cho nhà cung cấp gửi thư; không gửi kèm dữ liệu công nợ nào khác |

### Biện pháp **chưa** có — cần bổ sung trước khi nộp hồ sơ

| Thiếu | Ảnh hưởng |
|---|---|
| Quy trình xoá/xuất toàn bộ dữ liệu khi chấm dứt dịch vụ | Không chứng minh được khả năng thực hiện quyền xoá dữ liệu |
| Chính sách xoay vòng khoá bí mật định kỳ | Rủi ro kéo dài nếu khoá bị lộ |
| Quy trình và cam kết thời hạn thông báo sự cố lộ lọt | Là nội dung bắt buộc trong hồ sơ |
| Xác nhận chu kỳ sao lưu và thời gian lưu giữ bản sao | Chưa mô tả được vòng đời dữ liệu |
| Hợp đồng/phụ lục xử lý dữ liệu ký với từng nhà cung cấp | Chưa có văn bản ràng buộc trách nhiệm bên tiếp nhận |

---

## E. Đánh giá mức độ ảnh hưởng và rủi ro

| Rủi ro | Khả năng xảy ra | Hậu quả | Biện pháp giảm thiểu |
|---|---|---|---|
| Lộ khoá đặc quyền máy chủ | Thấp | **Nghiêm trọng** — vượt qua toàn bộ cơ chế phân tách, đọc được dữ liệu mọi công ty | Khoá chỉ ở máy chủ; **cần bổ sung** xoay vòng định kỳ và giám sát truy cập bất thường |
| Nhà cung cấp nước ngoài bị tấn công | Thấp | Trung bình–Nghiêm trọng tùy phạm vi | Chọn nhà cung cấp lớn có chứng nhận bảo mật; *[CẦN ĐỐI CHIẾU chứng nhận cụ thể của từng bên]* |
| Gửi thư nhắc nợ nhầm người nhận | Trung bình | Trung bình — lộ thông tin công nợ cho bên thứ ba | Người dùng phải xác nhận trước khi gửi; địa chỉ do Khách hàng tự nhập và kiểm tra |
| Nhân sự Khách hàng lạm quyền truy cập | Trung bình | Trung bình | Phân quyền theo công ty; **cần bổ sung** phân quyền chi tiết theo vai trò trong nội bộ một công ty |
| Gián đoạn/mất dữ liệu do sự cố nhà cung cấp | Thấp | Nghiêm trọng | *[CẦN XÁC NHẬN chính sách sao lưu và khôi phục theo gói dịch vụ đang dùng]* |

---

## F. Cơ sở pháp lý của việc xử lý

*[CẦN LUẬT SƯ XÁC ĐỊNH]* — dự kiến các hướng sau, cần thẩm định:

- Dữ liệu liên hệ của **nhân sự Khách hàng**: cần thiết để thực hiện hợp đồng dịch vụ.
- Dữ liệu liên hệ của **bên mua chịu**: liên quan tới quan hệ mua bán chịu giữa Khách hàng và đối
  tác. Cần xác định cơ sở pháp lý phù hợp và ai có trách nhiệm thông báo cho chủ thể dữ liệu.

Trong phần mềm, **Khách hàng là bên nhập dữ liệu liên hệ của đối tác** và đã được nêu nghĩa vụ bảo
đảm cơ sở pháp lý tại Phụ lục xử lý dữ liệu cá nhân (xem `phu-luc-xu-ly-du-lieu-ca-nhan.md`).

---

## G. Việc cần làm — theo thứ tự

1. **Hỏi luật sư khung pháp lý hiện hành** — Nghị định 13/2023 hay Luật Bảo vệ dữ liệu cá nhân? Đúng
   biểu mẫu, đúng cơ quan tiếp nhận, đúng thời hạn.
2. **Xác định ai phải lập hồ sơ** — Khách hàng, Luxora, hay cả hai.
3. **Xác nhận vùng lưu trữ Supabase** và điền vào Mục A.2.
4. **Xác định bên mua chịu có thể là cá nhân/hộ kinh doanh không** — quyết định phạm vi hồ sơ.
5. **Bổ sung 5 biện pháp còn thiếu** tại Mục D trước khi nộp.
6. **Ký phụ lục xử lý dữ liệu với từng nhà cung cấp** (Supabase, Resend, Railway, Vercel).
7. Chuyển toàn bộ nội dung này sang **đúng biểu mẫu** quy định và nộp.
