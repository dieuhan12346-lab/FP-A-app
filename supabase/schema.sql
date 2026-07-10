-- Schema cho FP&A app — chạy trong Supabase Dashboard > SQL Editor
-- Mỗi user chỉ thấy dữ liệu của mình (RLS theo auth.uid()).

create table if not exists public.invoice_uploads (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  file_name   text not null,
  header_row  int,
  cols        int,
  mapped      int,
  created_at  timestamptz not null default now()
);

create table if not exists public.invoice_lines (
  id         uuid primary key default gen_random_uuid(),
  upload_id  uuid not null references public.invoice_uploads(id) on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  stt        int,
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

create index if not exists invoice_uploads_user_created on public.invoice_uploads (user_id, created_at desc);
create index if not exists invoice_lines_upload on public.invoice_lines (upload_id);

alter table public.invoice_uploads enable row level security;
alter table public.invoice_lines  enable row level security;

drop policy if exists "own uploads" on public.invoice_uploads;
create policy "own uploads" on public.invoice_uploads
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own lines" on public.invoice_lines;
create policy "own lines" on public.invoice_lines
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============ Company / regional profile (multi-tenant) ============
-- Mỗi công ty có 1 hồ sơ vùng (ngôn ngữ, tiền tệ, chuẩn kế toán, thuế, múi giờ).
-- 1 user có thể thuộc nhiều company qua company_members; hiện tại UI chỉ dùng company đầu tiên của user.

create table if not exists public.companies (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null,
  country              text not null,                    -- ISO 2-letter: VN, US, SG, GB, AU, OTHER
  language             text not null default 'vi',        -- 'vi' | 'en'
  currency             text not null default 'VND',       -- ISO 4217
  accounting_standard  text not null default 'VAS',        -- 'VAS' | 'IFRS'
  tax_regime           text,
  timezone             text not null default 'Asia/Ho_Chi_Minh',
  created_by           uuid not null default auth.uid() references auth.users(id),
  created_at           timestamptz not null default now()
);

create table if not exists public.company_members (
  company_id  uuid not null references public.companies(id) on delete cascade,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  role        text not null default 'owner',
  created_at  timestamptz not null default now(),
  primary key (company_id, user_id)
);

create index if not exists company_members_user on public.company_members (user_id);

alter table public.companies enable row level security;
alter table public.company_members enable row level security;

drop policy if exists "own membership" on public.company_members;
create policy "own membership" on public.company_members
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- creator can always read their own company row (needed right after insert,
-- before the company_members row exists); members can read afterwards too.
drop policy if exists "read own or member company" on public.companies;
create policy "read own or member company" on public.companies
  for select using (
    created_by = auth.uid()
    or exists (select 1 from public.company_members m where m.company_id = companies.id and m.user_id = auth.uid())
  );

drop policy if exists "insert own company" on public.companies;
create policy "insert own company" on public.companies
  for insert with check (auth.uid() = created_by);

drop policy if exists "update member company" on public.companies;
create policy "update member company" on public.companies
  for update using (
    exists (select 1 from public.company_members m where m.company_id = companies.id and m.user_id = auth.uid())
  );

-- ============ Immutable company profile ============
-- Hồ sơ công ty là bất biến sau khi tạo: chỉ cột "name" được phép update.
-- Muốn cấu hình khác (quốc gia, tiền tệ, chuẩn kế toán...) thì tạo hồ sơ mới.
revoke update on public.companies from authenticated;
grant update (name) on public.companies to authenticated;
