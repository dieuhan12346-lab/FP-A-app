-- ============================================================================
-- 001 — Tách chuẩn kế toán thành 2 vai trò + cho phép sửa sau khi tạo hồ sơ
--
-- CHẠY: Supabase Dashboard → SQL Editor → dán toàn bộ file này → Run.
-- An toàn chạy lại nhiều lần (idempotent). Không xoá cột, không mất dữ liệu.
--
-- Vì sao:
--   accounting_standard là MỘT giá trị, nhưng công ty thật có hai vai trò khác nhau:
--     statutory_standard = chuẩn nộp cơ quan quản lý sở tại (VN: VAS/TT200; US: US GAAP)
--     reporting_standard = chuẩn lập báo cáo cho công ty mẹ / nhà đầu tư
--   Công ty FDI ở Việt Nam điển hình: nộp VAS, báo cáo IFRS.
--   Và chuẩn kế toán có đổi thật (DN Việt Nam áp dụng IFRS theo lộ trình QĐ 345/QĐ-BTC),
--   nên không thể khoá vĩnh viễn — bắt tạo hồ sơ mới đồng nghĩa vứt toàn bộ sổ sách.
-- ============================================================================

-- 1. Thêm 2 cột mới (chưa bắt buộc, để bước 2 điền dữ liệu trước)
alter table public.companies
  add column if not exists statutory_standard text,
  add column if not exists reporting_standard text;

-- 2. Chuyển dữ liệu cũ: hồ sơ đang có 1 chuẩn → dùng chuẩn đó cho cả hai vai trò
update public.companies
   set statutory_standard = coalesce(statutory_standard, accounting_standard, 'VAS'),
       reporting_standard = coalesce(reporting_standard, accounting_standard, 'VAS')
 where statutory_standard is null or reporting_standard is null;

-- 3. Giờ mới siết ràng buộc (chạy sau bước 2 nên không hồ sơ nào bị null)
alter table public.companies
  alter column statutory_standard set default 'VAS',
  alter column reporting_standard set default 'VAS';

alter table public.companies
  alter column statutory_standard set not null,
  alter column reporting_standard set not null;

-- 4. Chỉ nhận giá trị hợp lệ
alter table public.companies drop constraint if exists companies_statutory_standard_check;
alter table public.companies drop constraint if exists companies_reporting_standard_check;
alter table public.companies
  add constraint companies_statutory_standard_check check (statutory_standard in ('VAS', 'IFRS', 'USGAAP')),
  add constraint companies_reporting_standard_check check (reporting_standard in ('VAS', 'IFRS', 'USGAAP'));

-- 5. Mở quyền sửa cho 2 cột chuẩn (trước đây chỉ có "name").
--    Quốc gia/tiền tệ/múi giờ vẫn khoá: đổi thì toàn bộ số liệu cũ vô nghĩa.
revoke update on public.companies from authenticated;
grant update (name, statutory_standard, reporting_standard) on public.companies to authenticated;

-- LƯU Ý: cột accounting_standard được giữ nguyên có chủ đích — bản app đang chạy trên
-- production vẫn đọc nó, nên migration này chạy trước hay sau khi deploy đều không gãy.
-- Chỉ xoá nó khi mọi bản deploy đã dùng 2 cột mới:
--     alter table public.companies drop column accounting_standard;

-- 6. Hệ tài khoản tổng quát dùng chung cho IFRS lẫn US GAAP, nên tên tài khoản không được
--    trích dẫn riêng một chuẩn: công ty Mỹ áp dụng ASC 606, không phải IFRS 15. Hai chuẩn
--    này hội tụ và có CÙNG tên gọi "Revenue from Contracts with Customers", nên bỏ phần
--    trong ngoặc là đúng cho cả hai.
--    (Seed dùng "on conflict do nothing" nên không tự sửa được, phải update tường minh.)
update public.accounts
   set name_en = 'Revenue from contracts with customers'
 where standard = 'IFRS' and code = '4000'
   and name_en <> 'Revenue from contracts with customers';

-- ============ Kiểm tra sau khi chạy ============
-- select name, country, accounting_standard, statutory_standard, reporting_standard
--   from public.companies;
-- select standard, code, name_en from public.accounts where code = '4000';
