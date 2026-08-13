-- ============================================================================
-- 012 — TÊN CÔNG TY TRONG LỜI MỜI
--
-- Màn hình nhận lời mời hiện "(chưa rõ tên)": client đọc company_invites rồi join
-- sang companies để lấy tên, nhưng RLS của companies chỉ cho người TẠO hoặc THÀNH
-- VIÊN đọc. Người được mời chưa phải thành viên → join trả null.
--
-- Không nới policy của companies cho người có lời mời: làm vậy là lộ nguyên dòng
-- (quốc gia, tiền tệ, chuẩn kế toán, email_domain…) cho người còn chưa vào công ty.
-- Thay vào đó dùng hàm chỉ trả đúng những cột cần hiển thị.
-- ============================================================================

create or replace function public.my_invites()
returns table (id uuid, company_id uuid, company_name text, role text, expires_at timestamptz)
language sql stable security definer set search_path = public as $$
  select i.id, i.company_id, c.name, i.role, i.expires_at
    from public.company_invites i
    join public.companies c on c.id = i.company_id
   where lower(i.email) = lower(auth.jwt() ->> 'email')
     and i.accepted_at is null
     and i.expires_at > now();
$$;

-- Hàm lọc theo email của chính người gọi, nên SECURITY DEFINER ở đây không mở rộng
-- phạm vi: không truyền tham số nào vào được để xem lời mời của người khác.
revoke all on function public.my_invites() from public;
grant execute on function public.my_invites() to authenticated;
