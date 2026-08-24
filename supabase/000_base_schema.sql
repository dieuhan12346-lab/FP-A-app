-- ============================================================================
-- 000 — SCHEMA GỐC
--
-- Dựng lại toàn bộ cấu trúc cơ sở dữ liệu trên một project Supabase TRỐNG.
-- File này ĐÃ GỘP mọi migration 001–018 — chạy MỘT MÌNH nó là đủ, KHÔNG chạy thêm
-- gì trong migrations/. Thư mục đó chỉ để vá cơ sở dữ liệu đang chạy dở.
--
-- Vì sao có file này: các bảng gốc trước đây được tạo tay trên dashboard, không
-- nằm trong Git — nghĩa là không dựng lại được database từ mã nguồn.
--
-- BA TRỤC PHÂN QUYỀN, mỗi trục trả lời một câu khác nhau:
--   vai (role)          → được ghi, hay chỉ đọc
--   agent (agents)      → vào được màn hình nào
--   phạm vi (data_scope)→ thấy bản ghi cả công ty, hay chỉ phần mình nhập
--
--   Mọi dữ liệu cách ly theo THÀNH VIÊN CÔNG TY, không theo user_id. Cột user_id
--   vẫn giữ để biết ai tạo dòng nào và để phục vụ data_scope = 'own'.
-- ============================================================================

-- ─────────────────────────── BẢNG ───────────────────────────

-- Danh mục tài khoản kế toán (dữ liệu tham chiếu dùng chung, ai đọc cũng được)
create table if not exists public.accounts (
  id       uuid primary key default gen_random_uuid(),
  standard text not null,
  code     text not null,
  name_vi  text not null,
  name_en  text not null,
  type     text not null,
  unique (standard, code)
);

-- Hồ sơ công ty
create table if not exists public.companies (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  country             text not null,
  language            text not null default 'vi',
  currency            text not null default 'VND',
  accounting_standard text not null default 'VAS',
  tax_regime          text,
  timezone            text not null default 'Asia/Ho_Chi_Minh',
  created_by          uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at          timestamptz not null default now(),
  statutory_standard  text not null default 'VAS',
  reporting_standard  text not null default 'VAS',
  email_domain        text,
  email_domain_id     text,
  email_domain_status text default 'none',
  email_from_name     text
);

-- Thành viên công ty. VAI TRÒ quyết định quyền:
--   owner  — toàn quyền, quản thành viên và thanh toán
--   editor — nhập/sửa số liệu nghiệp vụ, không quản thành viên
--   viewer — chỉ xem, không sửa được gì
create table if not exists public.company_members (
  company_id   uuid not null references public.companies(id) on delete cascade,
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  role         text not null default 'owner' check (role in ('owner','editor','viewer')),
  email        text,                       -- lưu lại để owner biết ai là ai (client không đọc được auth.users)
  -- Agent được phép vào: cashflow, fpa, ops, credit, collect, invoice.
  -- null = toàn quyền, KHÁC mảng rỗng = không vào được agent nào. Người mới nhận lời
  -- mời vào với '{}' (xem accept_invite); null chỉ còn ở thành viên tạo trước khi có cột này.
  agents       text[],
  -- all = thấy bản ghi toàn công ty; own = chỉ bản ghi do chính mình tạo. Owner luôn all.
  data_scope   text not null default 'all' check (data_scope in ('all','own')),
  created_at   timestamptz not null default now(),
  last_used_at timestamptz,
  primary key (company_id, user_id)
);
create index if not exists company_members_user on public.company_members (user_id);

-- Lời mời tham gia công ty. Không có bảng này thì công ty không thêm được ai,
-- vì chính sách chỉ cho người TẠO công ty tự thêm mình.
create table if not exists public.company_invites (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  email       text not null,
  role        text not null default 'viewer' check (role in ('owner','editor','viewer')),
  created_by  uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default (now() + interval '14 days'),
  accepted_at timestamptz,
  unique (company_id, email)
);
create index if not exists company_invites_email on public.company_invites (lower(email));

-- Công nợ phải thu
create table if not exists public.receivables (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.companies(id) on delete cascade,
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  customer       text not null,
  amount         numeric not null,
  due_date       date not null,
  status         text not null default 'open',
  source         text not null default 'manual',
  invoice_no     text,
  created_at     timestamptz not null default now(),
  customer_email text,
  customer_phone text
);
create index if not exists receivables_company_due on public.receivables (company_id, due_date);

-- Khoản phải chi
create table if not exists public.payables (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  label      text not null,
  amount     numeric not null,
  due_date   date not null,
  status     text not null default 'open',
  created_at timestamptz not null default now(),
  category   text not null default 'other'
);
create index if not exists payables_company_due on public.payables (company_id, due_date);

-- Số dư đầu kỳ theo công ty
create table if not exists public.cashflow_settings (
  company_id   uuid primary key references public.companies(id) on delete cascade,
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  opening_cash numeric not null default 0,
  updated_at   timestamptz not null default now()
);

-- Số dư đầu kỳ theo MỐC NGÀY. Thay cashflow_settings ở trên (bảng đó mỗi công ty chỉ
-- giữ được một số dư, lưu lần sau đè mất lần trước). Giữ cả hai: app đọc bảng này,
-- bảng kia còn để quay lui.
create table if not exists public.cashflow_opening (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id) on delete cascade,
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  as_of        date not null,
  opening_cash numeric not null default 0,
  note         text,
  created_at   timestamptz not null default now(),
  -- Một ngày một số dư. Nhập lại cùng ngày là SỬA mốc đó, không đẻ dòng trùng.
  unique (company_id, as_of)
);
create index if not exists cashflow_opening_company on public.cashflow_opening (company_id, as_of desc);

-- Giao dịch tiền (nhập từ sổ quỹ / sao kê ERP)
create table if not exists public.transactions (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  txn_date    date not null,
  amount_in   numeric not null default 0,
  amount_out  numeric not null default 0,
  balance     numeric,
  account     text,
  voucher_no  text,
  description text,
  note        text,
  source      text not null default 'ledger_import',
  source_file text,
  import_id   uuid,
  created_at  timestamptz not null default now()
);
create index if not exists transactions_company_date on public.transactions (company_id, txn_date);
create index if not exists transactions_import on public.transactions (import_id);

-- Lô hóa đơn đã tải lên
create table if not exists public.invoice_uploads (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  file_name  text not null,
  header_row integer,
  cols       integer,
  mapped     integer,
  created_at timestamptz not null default now(),
  -- bắt buộc: phân quyền dựa vào cột này, để rỗng là dòng không ai đọc được
  company_id uuid not null references public.companies(id) on delete cascade
);
create index if not exists invoice_uploads_company on public.invoice_uploads (company_id, created_at desc);
create index if not exists invoice_uploads_user_created on public.invoice_uploads (user_id, created_at desc);

-- Dòng hóa đơn
create table if not exists public.invoice_lines (
  id         uuid primary key default gen_random_uuid(),
  upload_id  uuid not null references public.invoice_uploads(id) on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  stt        integer,
  date       text,
  serial     text,
  no         text,
  buyer_tax  text,
  buyer      text,
  item       text,
  unit       text,
  qty        numeric,
  price      numeric,
  amount     numeric,
  ck_rate    numeric,
  ck         numeric,
  net        numeric,
  vat_rate   numeric,
  vat        numeric,
  total      numeric,
  pay        text,
  created_at timestamptz not null default now()
);
create index if not exists invoice_lines_upload on public.invoice_lines (upload_id);

-- Chấm điểm tín dụng: số liệu BCTC nhập tay + quyết định hạn mức
create table if not exists public.credit_factors (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.companies(id) on delete cascade,
  customer       text not null,
  liquidity      integer,          -- không còn dùng (thay bằng financials)
  leverage       integer,          -- không còn dùng
  industry       integer,          -- không còn dùng
  size           integer,          -- không còn dùng
  industry_key   text,
  requested      numeric,
  updated_at     timestamptz not null default now(),
  financials     jsonb,
  approved_limit numeric,
  approved_at    timestamptz,
  approved_score integer,
  review_at      date,
  years_active   numeric,          -- không còn dùng
  unique (company_id, customer)
);
create index if not exists credit_factors_company_idx on public.credit_factors (company_id);

-- Nhật ký thư nhắc nợ đã gửi
create table if not exists public.reminder_log (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id) on delete cascade,
  receivable_id text,
  customer      text,
  invoice_codes text,
  to_email      text not null,
  channel       text not null default 'email',
  tier          text,
  subject       text,
  status        text not null,
  provider_id   text,
  error         text,
  sent_by       uuid,
  created_at    timestamptz not null default now()
);
create index if not exists reminder_log_company_idx on public.reminder_log (company_id, created_at desc);

-- Nhật ký thao tác nhạy cảm (xuất toàn bộ dữ liệu…). Chỉ hàm SECURITY DEFINER ghi.
create table if not exists public.audit_log (
  id         bigint generated always as identity primary key,
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id    uuid references auth.users(id) on delete set null,
  email      text,
  action     text not null,
  detail     jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_log_company on public.audit_log (company_id, created_at desc);

-- ────────────── HÀM KIỂM QUYỀN ──────────────
-- SECURITY DEFINER để đọc company_members mà không kích hoạt đệ quy RLS của chính bảng đó.
-- Cố định search_path để không bị chiếm quyền qua schema giả.

create or replace function public.is_member(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.company_members m
                 where m.company_id = cid and m.user_id = auth.uid());
$$;

-- Quyền GHI: chỉ owner và editor. viewer chỉ đọc.
create or replace function public.can_edit(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.company_members m
                 where m.company_id = cid and m.user_id = auth.uid()
                   and m.role in ('owner','editor'));
$$;

-- Quyền QUẢN TRỊ: chỉ owner (mời/xoá thành viên, đổi hồ sơ công ty).
create or replace function public.is_owner(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.company_members m
                 where m.company_id = cid and m.user_id = auth.uid()
                   and m.role = 'owner');
$$;

-- Vào được AGENT nào. Owner luôn vào hết; agents null = toàn quyền (thành viên đời cũ).
create or replace function public.has_agent(cid uuid, agent text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.company_members m
                 where m.company_id = cid and m.user_id = auth.uid()
                   and (m.role = 'owner' or m.agents is null or agent = any(m.agents)));
$$;

-- Thấy bản ghi của CẢ CÔNG TY hay chỉ phần mình nhập.
create or replace function public.sees_all(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.company_members m
                 where m.company_id = cid and m.user_id = auth.uid()
                   and (m.role = 'owner' or coalesce(m.data_scope, 'all') = 'all'));
$$;

-- ─────────────────── ROW LEVEL SECURITY ───────────────────
-- Bắt buộc: thiếu phần này là mất toàn bộ cách ly dữ liệu giữa các công ty.

alter table public.accounts          enable row level security;
alter table public.companies         enable row level security;
alter table public.company_members   enable row level security;
alter table public.company_invites   enable row level security;
alter table public.receivables       enable row level security;
alter table public.payables          enable row level security;
alter table public.cashflow_settings enable row level security;
alter table public.cashflow_opening  enable row level security;
alter table public.transactions      enable row level security;
alter table public.invoice_uploads   enable row level security;
alter table public.invoice_lines     enable row level security;
alter table public.credit_factors    enable row level security;
alter table public.reminder_log      enable row level security;
alter table public.audit_log         enable row level security;

-- Danh mục tài khoản: dữ liệu tham chiếu, ai đăng nhập cũng đọc được
drop policy if exists "read accounts" on public.accounts;
create policy "read accounts" on public.accounts for select using (true);

-- ── Công ty ──
drop policy if exists "read own or member company" on public.companies;
create policy "read own or member company" on public.companies for select
  using (created_by = auth.uid() or public.is_member(id));

drop policy if exists "insert own company" on public.companies;
create policy "insert own company" on public.companies for insert
  with check (auth.uid() = created_by);

-- Sửa hồ sơ công ty: chỉ owner
drop policy if exists "update member company" on public.companies;
drop policy if exists "owner updates company" on public.companies;
create policy "owner updates company" on public.companies for update
  using (public.is_owner(id)) with check (public.is_owner(id));

-- ── Thành viên: GỐC CỦA TOÀN BỘ PHÂN QUYỀN, quyền ghi phải siết chặt ──
drop policy if exists "own membership" on public.company_members;

-- Đọc: thấy dòng của mình, và owner thấy toàn bộ thành viên công ty mình
drop policy if exists "read own membership" on public.company_members;
create policy "read own membership" on public.company_members for select
  using (auth.uid() = user_id or public.is_owner(company_id));

-- Thêm: tự thêm CHÍNH MÌNH, và chỉ khi (a) mình tạo công ty, hoặc
-- (b) có lời mời hợp lệ đúng email + đúng vai trò. KHÔNG được nới chính sách này.
drop policy if exists "join own company" on public.company_members;
create policy "join own company" on public.company_members for insert
  with check (
    auth.uid() = user_id
    and (
      exists (select 1 from public.companies c
              where c.id = company_members.company_id and c.created_by = auth.uid())
      or exists (select 1 from public.company_invites i
                 where i.company_id = company_members.company_id
                   and lower(i.email) = lower(auth.jwt() ->> 'email')
                   and i.role = company_members.role
                   and i.accepted_at is null
                   and i.expires_at > now())
    )
  );

-- Sửa: dòng của mình (last_used_at), hoặc owner đổi vai trò người khác
drop policy if exists "update own membership" on public.company_members;
create policy "update own membership" on public.company_members for update
  using (auth.uid() = user_id or public.is_owner(company_id))
  with check (auth.uid() = user_id or public.is_owner(company_id));

-- Xoá: tự rời công ty, hoặc owner gỡ thành viên
drop policy if exists "delete own membership" on public.company_members;
create policy "delete own membership" on public.company_members for delete
  using (auth.uid() = user_id or public.is_owner(company_id));

-- ── Lời mời: owner quản; người được mời đọc được lời mời gửi cho email của mình ──
drop policy if exists "owner manages invites" on public.company_invites;
create policy "owner manages invites" on public.company_invites for all
  using (public.is_owner(company_id)) with check (public.is_owner(company_id));

drop policy if exists "invitee reads own invite" on public.company_invites;
create policy "invitee reads own invite" on public.company_invites for select
  using (lower(email) = lower(auth.jwt() ->> 'email'));

-- ── Dữ liệu nghiệp vụ ──
-- Ba điều kiện chồng nhau, mỗi cái trả lời một câu khác:
--   is_member / can_edit  → vai: được đọc, hay được cả ghi
--   has_agent             → có được vào agent chứa dữ liệu này không
--   sees_all              → thấy bản ghi cả công ty, hay chỉ phần mình nhập
--
-- Dòng tiền (receivables, payables, transactions) CỐ Ý không kiểm has_agent: mấy
-- bảng này là đầu vào chung của FP&A, Nhắc nợ và Chấm điểm — siết theo agent ở đây
-- là mấy agent kia mù luôn. Việc ẩn báo cáo tổng quan làm ở tầng giao diện.

drop policy if exists "own receivables" on public.receivables;
drop policy if exists "company receivables" on public.receivables;
drop policy if exists "read receivables" on public.receivables;
create policy "read receivables" on public.receivables for select
  using (public.is_member(company_id) and (public.sees_all(company_id) or user_id = auth.uid()));
drop policy if exists "insert receivables" on public.receivables;
create policy "insert receivables" on public.receivables for insert
  with check (public.can_edit(company_id));
drop policy if exists "update receivables" on public.receivables;
create policy "update receivables" on public.receivables for update
  using (public.can_edit(company_id) and (public.sees_all(company_id) or user_id = auth.uid()))
  with check (public.can_edit(company_id) and (public.sees_all(company_id) or user_id = auth.uid()));
drop policy if exists "delete receivables" on public.receivables;
create policy "delete receivables" on public.receivables for delete
  using (public.can_edit(company_id) and (public.sees_all(company_id) or user_id = auth.uid()));

drop policy if exists "own payables" on public.payables;
drop policy if exists "company payables" on public.payables;
drop policy if exists "read payables" on public.payables;
create policy "read payables" on public.payables for select
  using (public.is_member(company_id) and (public.sees_all(company_id) or user_id = auth.uid()));
drop policy if exists "insert payables" on public.payables;
create policy "insert payables" on public.payables for insert
  with check (public.can_edit(company_id));
drop policy if exists "update payables" on public.payables;
create policy "update payables" on public.payables for update
  using (public.can_edit(company_id) and (public.sees_all(company_id) or user_id = auth.uid()))
  with check (public.can_edit(company_id) and (public.sees_all(company_id) or user_id = auth.uid()));
drop policy if exists "delete payables" on public.payables;
create policy "delete payables" on public.payables for delete
  using (public.can_edit(company_id) and (public.sees_all(company_id) or user_id = auth.uid()));

-- Số dư đầu kỳ: MỘT dòng của cả công ty, không phải bản ghi của ai → không theo scope.
drop policy if exists "own cashflow_settings" on public.cashflow_settings;
drop policy if exists "company cashflow_settings" on public.cashflow_settings;
drop policy if exists "read cashflow_settings" on public.cashflow_settings;
create policy "read cashflow_settings" on public.cashflow_settings for select
  using (public.is_member(company_id));
drop policy if exists "insert cashflow_settings" on public.cashflow_settings;
create policy "insert cashflow_settings" on public.cashflow_settings for insert
  with check (public.can_edit(company_id));
drop policy if exists "update cashflow_settings" on public.cashflow_settings;
create policy "update cashflow_settings" on public.cashflow_settings for update
  using (public.can_edit(company_id)) with check (public.can_edit(company_id));
drop policy if exists "delete cashflow_settings" on public.cashflow_settings;
create policy "delete cashflow_settings" on public.cashflow_settings for delete
  using (public.can_edit(company_id));

-- Mốc số dư đầu kỳ: cũng là con số của cả công ty → không theo scope.
drop policy if exists "read cashflow_opening" on public.cashflow_opening;
create policy "read cashflow_opening" on public.cashflow_opening for select
  using (public.is_member(company_id));
drop policy if exists "insert cashflow_opening" on public.cashflow_opening;
create policy "insert cashflow_opening" on public.cashflow_opening for insert
  with check (public.can_edit(company_id));
drop policy if exists "update cashflow_opening" on public.cashflow_opening;
create policy "update cashflow_opening" on public.cashflow_opening for update
  using (public.can_edit(company_id)) with check (public.can_edit(company_id));
drop policy if exists "delete cashflow_opening" on public.cashflow_opening;
create policy "delete cashflow_opening" on public.cashflow_opening for delete
  using (public.can_edit(company_id));

drop policy if exists "own transactions" on public.transactions;
drop policy if exists "company transactions" on public.transactions;
drop policy if exists "read transactions" on public.transactions;
create policy "read transactions" on public.transactions for select
  using (public.is_member(company_id) and (public.sees_all(company_id) or user_id = auth.uid()));
drop policy if exists "insert transactions" on public.transactions;
create policy "insert transactions" on public.transactions for insert
  with check (public.can_edit(company_id));
drop policy if exists "update transactions" on public.transactions;
create policy "update transactions" on public.transactions for update
  using (public.can_edit(company_id) and (public.sees_all(company_id) or user_id = auth.uid()))
  with check (public.can_edit(company_id) and (public.sees_all(company_id) or user_id = auth.uid()));
drop policy if exists "delete transactions" on public.transactions;
create policy "delete transactions" on public.transactions for delete
  using (public.can_edit(company_id) and (public.sees_all(company_id) or user_id = auth.uid()));

-- Đọc hoá đơn: kiểm cả agent lẫn phạm vi.
drop policy if exists "own invoice_uploads" on public.invoice_uploads;
drop policy if exists "company invoice_uploads" on public.invoice_uploads;
drop policy if exists "read invoice_uploads" on public.invoice_uploads;
create policy "read invoice_uploads" on public.invoice_uploads for select
  using (public.is_member(company_id) and public.has_agent(company_id, 'invoice')
         and (public.sees_all(company_id) or user_id = auth.uid()));
drop policy if exists "insert invoice_uploads" on public.invoice_uploads;
create policy "insert invoice_uploads" on public.invoice_uploads for insert
  with check (public.can_edit(company_id) and public.has_agent(company_id, 'invoice'));
drop policy if exists "update invoice_uploads" on public.invoice_uploads;
create policy "update invoice_uploads" on public.invoice_uploads for update
  using (public.can_edit(company_id) and public.has_agent(company_id, 'invoice')
         and (public.sees_all(company_id) or user_id = auth.uid()))
  with check (public.can_edit(company_id) and public.has_agent(company_id, 'invoice')
         and (public.sees_all(company_id) or user_id = auth.uid()));
drop policy if exists "delete invoice_uploads" on public.invoice_uploads;
create policy "delete invoice_uploads" on public.invoice_uploads for delete
  using (public.can_edit(company_id) and public.has_agent(company_id, 'invoice')
         and (public.sees_all(company_id) or user_id = auth.uid()));

-- Chấm điểm tín dụng: theo agent, KHÔNG theo scope — hồ sơ tín dụng của khách là
-- của chung, cắt theo người nhập thì mỗi người chấm một điểm trên cùng một khách.
drop policy if exists "own credit_factors" on public.credit_factors;
drop policy if exists "company credit_factors" on public.credit_factors;
drop policy if exists "read credit_factors" on public.credit_factors;
create policy "read credit_factors" on public.credit_factors for select
  using (public.is_member(company_id) and public.has_agent(company_id, 'credit'));
drop policy if exists "insert credit_factors" on public.credit_factors;
create policy "insert credit_factors" on public.credit_factors for insert
  with check (public.can_edit(company_id) and public.has_agent(company_id, 'credit'));
drop policy if exists "update credit_factors" on public.credit_factors;
create policy "update credit_factors" on public.credit_factors for update
  using (public.can_edit(company_id) and public.has_agent(company_id, 'credit'))
  with check (public.can_edit(company_id) and public.has_agent(company_id, 'credit'));
drop policy if exists "delete credit_factors" on public.credit_factors;
create policy "delete credit_factors" on public.credit_factors for delete
  using (public.can_edit(company_id) and public.has_agent(company_id, 'credit'));

-- Dòng hoá đơn không có company_id riêng — đi vòng qua invoice_uploads, nên tự thừa
-- hưởng cả điều kiện agent lẫn scope của bảng cha.
drop policy if exists "own lines" on public.invoice_lines;
drop policy if exists "company lines" on public.invoice_lines;
drop policy if exists "read invoice_lines" on public.invoice_lines;
create policy "read invoice_lines" on public.invoice_lines for select
  using (exists (select 1 from public.invoice_uploads u where u.id = invoice_lines.upload_id));
drop policy if exists "write invoice_lines" on public.invoice_lines;
create policy "write invoice_lines" on public.invoice_lines for all
  using (exists (select 1 from public.invoice_uploads u
                 where u.id = invoice_lines.upload_id and public.can_edit(u.company_id)))
  with check (exists (select 1 from public.invoice_uploads u
                      where u.id = invoice_lines.upload_id and public.can_edit(u.company_id)));

-- Nhắc nợ: theo agent. Ghi do máy chủ (service role, bỏ qua RLS).
drop policy if exists reminder_log_select on public.reminder_log;
create policy reminder_log_select on public.reminder_log for select
  using (public.is_member(company_id) and public.has_agent(company_id, 'collect'));
-- Nhật ký thao tác: chỉ Chủ sở hữu đọc. CỐ Ý không có policy insert/update/delete —
-- chỉ hàm SECURITY DEFINER ghi được, nên không ai xoá được dấu vết của chính mình.
drop policy if exists "owner reads audit_log" on public.audit_log;
create policy "owner reads audit_log" on public.audit_log for select
  using (public.is_owner(company_id));

-- ────────────── NHẬN LỜI MỜI ──────────────
-- Làm bằng hàm phía máy chủ để VAI TRÒ lấy từ chính lời mời, người dùng không
-- tự truyền vai vào được. Nếu để client tự insert company_members thì họ có thể
-- khai vai 'owner' — tự nâng quyền.
create or replace function public.accept_invite(inv_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare inv record;
begin
  select * into inv
    from public.company_invites
   where id = inv_id
     and lower(email) = lower(auth.jwt() ->> 'email')
     and accepted_at is null
     and expires_at > now();

  if not found then
    raise exception 'Lời mời không hợp lệ, đã dùng hoặc đã hết hạn';
  end if;

  -- do nothing, KHÔNG do update: người ĐÃ là thành viên mà nhận lời mời thì giữ
  -- nguyên vai. Ghi đè thì chủ sở hữu tự mời email mình rồi bấm Tham gia là tự hạ
  -- mình xuống editor — owner duy nhất làm vậy là công ty còn zero owner, kẹt hẳn.
  -- agents = '{}' → đặc quyền tối thiểu: vào được công ty, chưa vào được agent nào,
  -- owner mở dần. '{}' KHÁC null (null = toàn quyền) — cả điểm mấu chốt nằm ở đây.
  insert into public.company_members (company_id, user_id, role, email, agents)
  values (inv.company_id, auth.uid(), inv.role, auth.jwt() ->> 'email', '{}')
  on conflict (company_id, user_id) do nothing;

  update public.company_invites set accepted_at = now() where id = inv_id;
end;
$$;

revoke all on function public.accept_invite(uuid) from public;
grant execute on function public.accept_invite(uuid) to authenticated;

-- Lời mời đang chờ của chính mình, KÈM tên công ty và người mời. Cần hàm riêng vì
-- RLS của companies chỉ cho thành viên đọc (người được mời chưa phải thành viên nên
-- join thẳng ra null), còn tên người mời thì nằm ở auth.users mà client không đọc
-- được. Nới policy cho người có lời mời thì lộ nguyên dòng companies; hàm này chỉ
-- trả đúng những cột màn hình cần.
create or replace function public.my_invites()
returns table (
  id           uuid,
  company_id   uuid,
  company_name text,
  role         text,
  invited_by   text,
  expires_at   timestamptz
)
language sql stable security definer set search_path = public as $$
  select i.id,
         i.company_id,
         c.name,
         i.role,
         coalesce(u.raw_user_meta_data ->> 'display_name', u.email),
         i.expires_at
    from public.company_invites i
    join public.companies c on c.id = i.company_id
    left join auth.users u on u.id = i.created_by
   where lower(i.email) = lower(auth.jwt() ->> 'email')
     and i.accepted_at is null
     and i.expires_at > now();
$$;

revoke all on function public.my_invites() from public;
grant execute on function public.my_invites() to authenticated;

-- ────────────── XUẤT TOÀN BỘ DỮ LIỆU ──────────────
-- Làm dưới cơ sở dữ liệu chứ không ở trình duyệt: ẩn nút chỉ là che giao diện, ai
-- cũng mở devtools gọi lại đúng loạt SELECT đó được. Hàm kiểm is_owner() trước khi
-- đọc, và ghi lại mỗi lần xuất.
--
-- GIỚI HẠN: chặn được TÍNH NĂNG XUẤT, không chặn được việc đọc. Vai xem vẫn đọc
-- từng bảng theo RLS nên vẫn tự chép ra được — đọc thì không thể "gỡ đọc". Cái đổi
-- được là bản xuất một cú bấm chỉ Chủ sở hữu có, và mọi lần xuất đều để lại dấu vết.
create or replace function public.export_company_data(cid uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  tbls jsonb;
  sums jsonb;
begin
  if not public.is_owner(cid) then
    raise exception 'Chỉ Chủ sở hữu công ty mới xuất được toàn bộ dữ liệu';
  end if;

  select jsonb_build_object(
    'companies',         coalesce((select jsonb_agg(to_jsonb(t)) from public.companies         t where t.id = cid),         '[]'::jsonb),
    'company_members',   coalesce((select jsonb_agg(to_jsonb(t)) from public.company_members   t where t.company_id = cid), '[]'::jsonb),
    'receivables',       coalesce((select jsonb_agg(to_jsonb(t)) from public.receivables       t where t.company_id = cid), '[]'::jsonb),
    'payables',          coalesce((select jsonb_agg(to_jsonb(t)) from public.payables          t where t.company_id = cid), '[]'::jsonb),
    'cashflow_settings', coalesce((select jsonb_agg(to_jsonb(t)) from public.cashflow_settings t where t.company_id = cid), '[]'::jsonb),
    'transactions',      coalesce((select jsonb_agg(to_jsonb(t)) from public.transactions      t where t.company_id = cid), '[]'::jsonb),
    'credit_factors',    coalesce((select jsonb_agg(to_jsonb(t)) from public.credit_factors    t where t.company_id = cid), '[]'::jsonb),
    'reminder_log',      coalesce((select jsonb_agg(to_jsonb(t)) from public.reminder_log      t where t.company_id = cid), '[]'::jsonb),
    'invoice_uploads',   coalesce((select jsonb_agg(to_jsonb(t)) from public.invoice_uploads   t where t.company_id = cid), '[]'::jsonb),
    'invoice_lines',     coalesce((select jsonb_agg(to_jsonb(l)) from public.invoice_lines l
                                     join public.invoice_uploads u on u.id = l.upload_id
                                    where u.company_id = cid),                                  '[]'::jsonb)
  ) into tbls;

  select jsonb_object_agg(key, jsonb_array_length(value)) into sums from jsonb_each(tbls);

  insert into public.audit_log (company_id, user_id, email, action, detail)
  values (cid, auth.uid(), auth.jwt() ->> 'email', 'export', sums);

  return jsonb_build_object(
    'exportedAt', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'companyId',  cid,
    'note',       'Bản xuất dữ liệu công ty từ phần mềm Luxora. Mỗi khoá trong "tables" là một bảng.',
    'tables',     tbls,
    'summary',    sums
  );
end;
$$;

-- Mặc định Postgres cho PUBLIC chạy hàm mới — phải thu lại, nếu không vai anon
-- (khách chưa đăng nhập) cũng gọi được.
revoke all on function public.export_company_data(uuid) from public;
grant execute on function public.export_company_data(uuid) to authenticated;
