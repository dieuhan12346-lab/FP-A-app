-- ============ Giao dịch tiền thật (lịch sử dòng tiền theo ngày) ============
-- Nguồn: nhập từ sổ quỹ / sổ cái TK 111·112 xuất từ ERP (MISA S07-DN…).
-- Đây là chuỗi thời gian thu/chi thật → nền cho dự báo dòng tiền học từ lịch sử.
-- Chạy trong Supabase Dashboard > SQL Editor.

create table if not exists public.transactions (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id) on delete cascade,
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  txn_date     date not null,                              -- ngày ghi sổ
  amount_in    numeric not null default 0,                 -- tiền vào (VND)
  amount_out   numeric not null default 0,                 -- tiền ra (VND)
  balance      numeric,                                     -- số dư luỹ kế nếu file có
  account      text,                                        -- 111 / 112 …
  voucher_no   text,
  description  text,
  note         text,
  source       text not null default 'ledger_import',      -- ledger_import | manual
  source_file  text,                                        -- tên file đã nhập
  import_id    uuid,                                         -- gom theo lần nhập (xoá/replace cả lô)
  created_at   timestamptz not null default now()
);

create index if not exists transactions_company_date on public.transactions (company_id, txn_date);
create index if not exists transactions_import on public.transactions (import_id);

alter table public.transactions enable row level security;

drop policy if exists "own transactions" on public.transactions;
create policy "own transactions" on public.transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
