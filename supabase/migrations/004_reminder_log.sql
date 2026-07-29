-- Nhật ký nhắc nợ: mỗi email/tin nhắc đã gửi (qua Resend) → chống gửi trùng, phục vụ đối soát & scheduler.
create table if not exists public.reminder_log (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id) on delete cascade,
  receivable_id text,               -- id hoặc khoá khách (gộp nhiều HĐ → không phải 1 receivable duy nhất)
  customer     text,
  invoice_codes text,               -- danh sách mã HĐ trong lần nhắc (ngăn cách ", ")
  to_email     text not null,
  channel      text not null default 'email',
  tier         text,                -- gentle | firm | urgent (bậc escalation lúc gửi)
  subject      text,
  status       text not null,       -- sent | failed
  provider_id  text,                -- message id do Resend trả về
  error        text,
  sent_by      uuid,                -- auth user id đã bấm gửi (null nếu do scheduler)
  created_at   timestamptz not null default now()
);

create index if not exists reminder_log_company_idx on public.reminder_log (company_id, created_at desc);

-- RLS: thành viên công ty đọc được nhật ký của công ty mình; ghi do service-role (bỏ qua RLS).
alter table public.reminder_log enable row level security;

drop policy if exists reminder_log_select on public.reminder_log;
create policy reminder_log_select on public.reminder_log
  for select using (
    exists (
      select 1 from public.company_members m
      where m.company_id = reminder_log.company_id and m.user_id = auth.uid()
    )
  );
