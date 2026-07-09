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
