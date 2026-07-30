-- Số điện thoại khách nợ (cho nhắc nợ qua Zalo ZNS / SMS). Chạy trong Supabase SQL Editor.
alter table public.receivables
  add column if not exists customer_phone text;
