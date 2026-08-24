-- ============================================================================
-- SEED — DANH MỤC TÀI KHOẢN KẾ TOÁN (VAS + IFRS)
--
-- Dữ liệu tham chiếu dùng chung, không thuộc công ty nào. Chạy SAU
-- 000_base_schema.sql khi dựng project mới.
--
-- Vì sao có file này: danh mục trước đây chỉ tồn tại trong cơ sở dữ liệu, không
-- nằm trong Git — dựng project mới là phải mở project cũ ra chép tay. Cùng loại
-- trôi lệch với schema gốc, sửa nốt.
--
-- Thêm tài khoản mới thì sửa ở đây rồi chạy lại: on conflict nên chạy lại vô hại.
-- ============================================================================

insert into public.accounts (standard, code, name_vi, name_en, type) values
  -- ── IFRS ──
  ('IFRS','1000','Tiền mặt','Cash on hand','asset'),
  ('IFRS','1100','Tiền gửi ngân hàng','Cash at bank','asset'),
  ('IFRS','1200','Phải thu khách hàng','Trade receivables','asset'),
  ('IFRS','1300','Hàng tồn kho','Inventories','asset'),
  ('IFRS','2100','Phải trả người bán','Trade payables','liability'),
  ('IFRS','2300','Thuế bán hàng/GTGT phải nộp','VAT / sales tax payable','liability'),
  ('IFRS','2400','Lương phải trả','Payroll liabilities','liability'),
  ('IFRS','3000','Vốn cổ phần','Share capital','equity'),
  ('IFRS','3100','Lợi nhuận giữ lại','Retained earnings','equity'),
  ('IFRS','4000','Doanh thu từ hợp đồng với khách hàng','Revenue from contracts with customers','revenue'),
  ('IFRS','5000','Giá vốn hàng bán','Cost of sales','expense'),
  ('IFRS','6000','Chi phí bán hàng','Selling expenses','expense'),
  ('IFRS','6100','Chi phí quản lý chung','General & administrative expenses','expense'),

  -- ── VAS (Thông tư 200) ──
  ('VAS','111','Tiền mặt','Cash on hand','asset'),
  ('VAS','112','Tiền gửi ngân hàng','Cash at bank','asset'),
  ('VAS','131','Phải thu của khách hàng','Trade receivables','asset'),
  ('VAS','133','Thuế GTGT được khấu trừ','Deductible VAT','asset'),
  ('VAS','156','Hàng hóa','Merchandise inventory','asset'),
  ('VAS','331','Phải trả cho người bán','Trade payables','liability'),
  ('VAS','3331','Thuế GTGT phải nộp','VAT payable','liability'),
  ('VAS','334','Phải trả người lao động','Payables to employees','liability'),
  ('VAS','411','Vốn đầu tư của chủ sở hữu','Owner''s invested capital','equity'),
  ('VAS','421','Lợi nhuận sau thuế chưa phân phối','Undistributed profit after tax','equity'),
  ('VAS','511','Doanh thu bán hàng và cung cấp dịch vụ','Revenue from sales and services','revenue'),
  ('VAS','515','Doanh thu hoạt động tài chính','Finance income','revenue'),
  ('VAS','521','Các khoản giảm trừ doanh thu','Revenue deductions (trade discounts, returns, allowances)','contra_revenue'),
  ('VAS','632','Giá vốn hàng bán','Cost of goods sold','expense'),
  ('VAS','635','Chi phí tài chính','Finance costs','expense'),
  ('VAS','641','Chi phí bán hàng','Selling expenses','expense'),
  ('VAS','642','Chi phí quản lý doanh nghiệp','General & administrative expenses','expense'),
  ('VAS','911','Xác định kết quả kinh doanh','Income summary','other')
on conflict (standard, code) do update
  set name_vi = excluded.name_vi,
      name_en = excluded.name_en,
      type    = excluded.type;

-- Kiểm: phải ra IFRS 13, VAS 18 (tổng 31).
select standard, count(*) as so_tai_khoan
  from public.accounts group by standard order by standard;
