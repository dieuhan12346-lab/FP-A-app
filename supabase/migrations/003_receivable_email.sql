-- ============ Email khách nợ (cho agent nhắc nợ gửi email) ============
-- Thêm email liên hệ vào công nợ phải thu. Nhắc nợ qua email cần địa chỉ này.
-- Chạy trong Supabase Dashboard > SQL Editor.

alter table public.receivables
  add column if not exists customer_email text;
