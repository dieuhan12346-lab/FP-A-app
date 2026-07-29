-- ============================================================================
-- 005 — Domain gửi email nhắc nợ theo TỪNG công ty (option B)
--
-- CHẠY: Supabase Dashboard → SQL Editor → dán file này → Run. Idempotent, không mất dữ liệu.
--
-- Mỗi công ty đăng ký tên miền riêng (vd luxorasystem.com) để email nhắc nợ đi TỪ
-- domain của họ. Service (ml-service) đăng ký domain với Resend, lưu id + trạng thái
-- verify tại đây; chỉ gửi email thật khi status = 'verified'.
-- ============================================================================

alter table public.companies
  add column if not exists email_domain        text,           -- vd "luxorasystem.com"
  add column if not exists email_domain_id     text,           -- id domain bên Resend
  add column if not exists email_domain_status text default 'none',  -- none | pending | verified | failed
  add column if not exists email_from_name     text;           -- tên hiển thị người gửi (mặc định = tên công ty)
