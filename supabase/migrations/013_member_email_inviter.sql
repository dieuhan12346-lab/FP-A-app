-- ============================================================================
-- 013 — CỘT company_members.email + NGƯỜI MỜI TRONG LỜI MỜI
--
-- 000_base_schema.sql khai company_members có cột email và last_used_at, nhưng đó
-- là cột MỚI do file đó thêm — cơ sở dữ liệu đang chạy chưa có, và 011 không mang
-- sang. Ứng dụng thì đã dùng rồi, nên đang hỏng ba chỗ:
--   · listMembers() select email  → lỗi, modal nuốt lỗi, danh sách thành viên rỗng
--   · createCompany() insert email → LỖI HẲN, không tạo được hồ sơ công ty mới
--   · my_invites() ở 013 bản trước → ERROR 42703: column m.email does not exist
--
-- File này thêm cột, điền lại từ auth.users, rồi dựng lại my_invites().
-- ============================================================================

-- ─────────────── CỘT CÒN THIẾU ───────────────

alter table public.company_members add column if not exists email        text;
alter table public.company_members add column if not exists last_used_at timestamptz;

-- Điền email cho các dòng đã có. auth.users chỉ đọc được bằng quyền cao, nên chạy
-- ở SQL Editor (service role) là đúng chỗ.
update public.company_members m
   set email = u.email
  from auth.users u
 where u.id = m.user_id
   and m.email is null;

-- ─────────────── NGƯỜI MỜI ───────────────
-- Bắt buộc drop trước: Postgres không cho create or replace khi đổi danh sách cột trả về.
drop function if exists public.my_invites();

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

-- Lấy thẳng từ auth.users, không qua company_members: người mời luôn có trong
-- auth.users, còn dòng company_members thì có thể đã bị gỡ.
revoke all on function public.my_invites() from public;
grant execute on function public.my_invites() to authenticated;
