-- ============================================================================
-- 019 — SỐ DƯ ĐẦU KỲ CÓ LỊCH SỬ
--
-- cashflow_settings để company_id làm KHOÁ CHÍNH nên mỗi công ty chỉ giữ được ĐÚNG
-- MỘT số dư: lưu lần sau là đè mất lần trước. Không xem lại được kỳ trước, không
-- biết ai sửa lúc nào, và dự báo cũ không tái dựng được vì con số đã bị thay.
--
-- Bảng mới lưu theo NGÀY: mỗi lần nhập là một mốc. Số dư đang dùng = mốc gần nhất
-- không vượt quá hôm nay.
--
-- Không xoá cashflow_settings — giữ để quay lui, nhưng app thôi đọc từ đó.
-- ============================================================================

create table if not exists public.cashflow_opening (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id) on delete cascade,
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  as_of        date not null,
  opening_cash numeric not null default 0,
  note         text,
  created_at   timestamptz not null default now(),
  -- Một ngày một số dư. Nhập lại cùng ngày là SỬA mốc đó, không đẻ thêm dòng trùng.
  unique (company_id, as_of)
);

create index if not exists cashflow_opening_company
  on public.cashflow_opening (company_id, as_of desc);

alter table public.cashflow_opening enable row level security;

-- Số dư đầu kỳ là con số của cả công ty, không phải bản ghi cá nhân → KHÔNG áp
-- data_scope. Cắt theo người nhập thì người khác mở ra thấy số dư 0.
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

-- Mang số dư đang có sang làm mốc đầu tiên, để không ai mất số liệu khi app đổi nguồn đọc.
insert into public.cashflow_opening (company_id, user_id, as_of, opening_cash, note)
select s.company_id,
       s.user_id,
       coalesce(s.updated_at::date, current_date),
       s.opening_cash,
       'Chuyển từ bản cũ'
  from public.cashflow_settings s
 where s.opening_cash is not null
on conflict (company_id, as_of) do nothing;

-- Kiểm: mỗi công ty có ít nhất một mốc nếu trước đó đã từng nhập số dư.
select c.name as cong_ty,
       (select count(*) from public.cashflow_opening o where o.company_id = c.id) as so_moc,
       (select o.opening_cash from public.cashflow_opening o
         where o.company_id = c.id order by o.as_of desc limit 1) as so_du_moi_nhat
  from public.companies c
 order by c.created_at;
