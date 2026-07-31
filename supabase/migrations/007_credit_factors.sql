-- ============================================================================
-- 007 — Chỉ số tín dụng NHẬP TAY theo từng khách (chấm điểm tín dụng, mô hình B)
--
-- Điểm hành vi thanh toán tính TỰ ĐỘNG từ bảng receivables (không lưu ở đây).
-- Bảng này chỉ lưu các chỉ số tài chính người dùng TỰ NHẬP (mình không có báo cáo
-- tài chính của khách): thanh khoản, đòn bẩy, ngành, quy mô (0..100) + hạn mức đề nghị.
--
-- CHẠY: Supabase Dashboard → SQL Editor → dán → Run. Idempotent.
-- ============================================================================

create table if not exists public.credit_factors (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id) on delete cascade,
  customer     text not null,              -- tên khách (khớp receivables.customer, so khớp lowercase ở app)
  liquidity    int,                        -- 0..100 (nhập tay)
  leverage     int,                        -- 0..100
  industry     int,                        -- 0..100 (điểm ngành, nhập tay)
  size         int,                        -- 0..100 (quy mô)
  industry_key text,                       -- nhãn ngành hiển thị
  requested    numeric,                    -- hạn mức khách đề nghị (triệu)
  updated_at   timestamptz not null default now(),
  unique (company_id, customer)
);

create index if not exists credit_factors_company_idx on public.credit_factors (company_id);

alter table public.credit_factors enable row level security;

drop policy if exists credit_factors_rw on public.credit_factors;
create policy credit_factors_rw on public.credit_factors
  for all using (
    exists (select 1 from public.company_members m
            where m.company_id = credit_factors.company_id and m.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.company_members m
            where m.company_id = credit_factors.company_id and m.user_id = auth.uid())
  );
