-- ============================================================================
-- 011 — VAI TRÒ + LỜI MỜI (áp lên cơ sở dữ liệu ĐANG CHẠY)
--
-- Vì sao cần: giao diện quản lý thành viên đã lên nhưng bảng company_invites chưa
-- có, nên bấm Mời báo "Could not find the table 'public.company_invites'".
--
-- File này CỐ Ý chỉ làm phần vai trò + lời mời. Nó KHÔNG đụng tới chính sách của
-- các bảng nghiệp vụ (receivables, payables, transactions…) — việc chuyển các bảng
-- đó từ cách ly theo user_id sang cách ly theo thành viên công ty nằm ở
-- 000_base_schema.sql, để làm khi dựng project Singapore. Chạy cả 000 lên cơ sở dữ
-- liệu đang chạy sẽ đổi phạm vi nhìn thấy của dữ liệu cũ ngay lập tức.
--
-- Có sửa kèm MỘT lỗ hổng đang tồn tại thật, không đợi được: xem phần company_members.
-- ============================================================================

-- ─────────────────── HÀM KIỂM QUYỀN ───────────────────
-- SECURITY DEFINER để đọc company_members mà không kích hoạt đệ quy RLS của chính
-- bảng đó. Cố định search_path để không bị chiếm quyền qua schema giả.

create or replace function public.is_member(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.company_members m
                 where m.company_id = cid and m.user_id = auth.uid());
$$;

create or replace function public.can_edit(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.company_members m
                 where m.company_id = cid and m.user_id = auth.uid()
                   and m.role in ('owner','editor'));
$$;

create or replace function public.is_owner(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.company_members m
                 where m.company_id = cid and m.user_id = auth.uid()
                   and m.role = 'owner');
$$;

-- ─────────────────── LỜI MỜI ───────────────────

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

alter table public.company_invites enable row level security;

drop policy if exists "owner manages invites" on public.company_invites;
create policy "owner manages invites" on public.company_invites for all
  using (public.is_owner(company_id)) with check (public.is_owner(company_id));

drop policy if exists "invitee reads own invite" on public.company_invites;
create policy "invitee reads own invite" on public.company_invites for select
  using (lower(email) = lower(auth.jwt() ->> 'email'));

-- ─────────────────── THÀNH VIÊN ───────────────────
-- LỖ HỔNG ĐANG CÓ: chính sách cũ "own membership" chỉ kiểm auth.uid() = user_id mà
-- KHÔNG kiểm company_id. Nghĩa là bất kỳ ai đăng nhập cũng tự thêm mình vào bất kỳ
-- công ty nào (chỉ cần biết id), rồi đọc dữ liệu công ty đó. Tách làm 4 chính sách.

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

-- ─────────────────── NHẬN LỜI MỜI ───────────────────
-- Làm bằng hàm phía máy chủ để VAI TRÒ lấy từ chính lời mời, người dùng không tự
-- truyền vai vào được. Để client tự insert company_members thì họ khai vai 'owner'.
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

  insert into public.company_members (company_id, user_id, role, email)
  values (inv.company_id, auth.uid(), inv.role, auth.jwt() ->> 'email')
  on conflict (company_id, user_id) do update set role = excluded.role;

  update public.company_invites set accepted_at = now() where id = inv_id;
end;
$$;

revoke all on function public.accept_invite(uuid) from public;
grant execute on function public.accept_invite(uuid) to authenticated;
