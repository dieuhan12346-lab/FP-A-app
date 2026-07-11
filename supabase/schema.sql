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

-- ============ Company switching ============
-- Hồ sơ đang dùng = hồ sơ có last_used_at mới nhất (chuyển hồ sơ trong modal Hồ sơ công ty).
alter table public.company_members
  add column if not exists last_used_at timestamptz;

-- ============ Invoice history per company profile ============
-- Lịch sử hóa đơn gắn theo hồ sơ công ty: tạo hồ sơ mới → lịch sử trống,
-- quay lại hồ sơ cũ → dữ liệu cũ vẫn còn.
alter table public.invoice_uploads
  add column if not exists company_id uuid references public.companies(id) on delete cascade;
create index if not exists invoice_uploads_company on public.invoice_uploads (company_id, created_at desc);

-- Dữ liệu cũ (trước khi có cột này) gán về hồ sơ công ty ĐẦU TIÊN của mỗi user
update public.invoice_uploads u
set company_id = (
  select m.company_id from public.company_members m
  where m.user_id = u.user_id
  order by m.created_at asc
  limit 1
)
where u.company_id is null;

-- ============ Cashflow thật: công nợ phải thu / phải chi / số dư đầu kỳ ============
-- Mỗi công ty một bộ dữ liệu. Module Dòng tiền dùng số thật khi có, không thì chạy demo.

create table if not exists public.receivables (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  customer   text not null,
  amount     numeric not null,                 -- VND
  due_date   date not null,
  status     text not null default 'open' check (status in ('open','paid')),
  source     text not null default 'manual' check (source in ('manual','invoice')),
  invoice_no text,
  created_at timestamptz not null default now()
);

create table if not exists public.payables (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  label      text not null,                    -- nội dung chi: lương, thuê nhà, NCC...
  amount     numeric not null,                 -- VND
  due_date   date not null,
  status     text not null default 'open' check (status in ('open','paid')),
  created_at timestamptz not null default now()
);

-- Loại chi → tài khoản trong khối "Phân loại theo TT200":
-- supplier→331 · payroll→334 · tax→333 · other→642
alter table public.payables
  add column if not exists category text not null default 'other';

create table if not exists public.cashflow_settings (
  company_id   uuid primary key references public.companies(id) on delete cascade,
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  opening_cash numeric not null default 0,     -- VND · số dư đầu kỳ TK 111+112
  updated_at   timestamptz not null default now()
);

create index if not exists receivables_company_due on public.receivables (company_id, due_date);
create index if not exists payables_company_due on public.payables (company_id, due_date);

alter table public.receivables enable row level security;
alter table public.payables enable row level security;
alter table public.cashflow_settings enable row level security;

drop policy if exists "own receivables" on public.receivables;
create policy "own receivables" on public.receivables
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own payables" on public.payables;
create policy "own payables" on public.payables
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own cashflow settings" on public.cashflow_settings;
create policy "own cashflow settings" on public.cashflow_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============ Chart of accounts: VAS (TT200) + IFRS ============
-- Dữ liệu tham chiếu dùng chung, chỉ đọc. Module Đọc hóa đơn lấy tên tài khoản
-- theo accounting_standard của công ty.

create table if not exists public.accounts (
  id       uuid primary key default gen_random_uuid(),
  standard text not null check (standard in ('VAS','IFRS')),
  code     text not null,
  name_vi  text not null,
  name_en  text not null,
  type     text not null check (type in ('asset','liability','equity','revenue','contra_revenue','expense','other')),
  unique (standard, code)
);

alter table public.accounts enable row level security;
drop policy if exists "read accounts" on public.accounts;
create policy "read accounts" on public.accounts for select to authenticated using (true);

insert into public.accounts (standard, code, name_vi, name_en, type) values
  -- VAS · Thông tư 200/2014/TT-BTC (các TK dùng trong app)
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
  ('VAS','911','Xác định kết quả kinh doanh','Income summary','other'),
  -- IFRS · hệ mã minh họa phổ biến (IFRS không quy định số hiệu tài khoản)
  ('IFRS','1000','Tiền mặt','Cash on hand','asset'),
  ('IFRS','1100','Tiền gửi ngân hàng','Cash at bank','asset'),
  ('IFRS','1200','Phải thu khách hàng','Trade receivables','asset'),
  ('IFRS','1300','Hàng tồn kho','Inventories','asset'),
  ('IFRS','2100','Phải trả người bán','Trade payables','liability'),
  ('IFRS','2300','Thuế bán hàng/GTGT phải nộp','VAT / sales tax payable','liability'),
  ('IFRS','2400','Lương phải trả','Payroll liabilities','liability'),
  ('IFRS','3000','Vốn cổ phần','Share capital','equity'),
  ('IFRS','3100','Lợi nhuận giữ lại','Retained earnings','equity'),
  ('IFRS','4000','Doanh thu từ hợp đồng với khách hàng','Revenue from contracts with customers (IFRS 15)','revenue'),
  ('IFRS','5000','Giá vốn hàng bán','Cost of sales','expense'),
  ('IFRS','6000','Chi phí bán hàng','Selling expenses','expense'),
  ('IFRS','6100','Chi phí quản lý chung','General & administrative expenses','expense')
on conflict (standard, code) do nothing;
