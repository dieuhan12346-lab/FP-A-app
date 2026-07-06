# FP&A App — Phần mềm Dòng Tiền

Ứng dụng quản trị tài chính (FP&A) viết bằng React: dòng tiền 13 tuần, đọc hóa đơn từ Excel (định khoản TT200 + kiểm tra bất thường), và các module phân tích khác.

## Chạy local

```bash
npm install
npm run dev
```

Mở http://localhost:5173 (hoặc port Vite in ra).

## Cấu trúc

- `src/phanmem-dongtien_4.jsx` — toàn bộ ứng dụng (component chính)
- `src/main.jsx` — entry point, mount app qua alias `@target-app`
- `vite.config.js` — cấu hình Vite + alias

## Module Đọc hóa đơn

Nhận file `.xlsx` dạng bảng kê phẳng (kiểu MISA/FAST): dòng đầu là header với các cột STT, Ngày HĐ, Ký hiệu, Số HĐ, MST người mua, Tên hàng hóa dịch vụ, Số lượng, Đơn giá, Thành tiền, Thuế suất (%), Tiền thuế GTGT, Tổng thanh toán…
