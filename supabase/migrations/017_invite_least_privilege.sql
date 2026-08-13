-- ============================================================================
-- 017 — NGƯỜI MỚI THAM GIA MẶC ĐỊNH KHÔNG CÓ AGENT NÀO
--
-- 016 dùng agents = null nghĩa là toàn quyền, cố ý, để thành viên ĐANG CÓ không bị
-- khoá sạch lúc chạy migration. Nhưng để nguyên vậy thì người MỚI nhận lời mời vào
-- là thấy hết số liệu công ty ngay — ngược với nguyên tắc đặc quyền tối thiểu.
--
-- Từ đây accept_invite() ghi mảng RỖNG: vào được công ty, chưa vào được agent nào.
-- Owner tick mở dần trong Cài đặt công ty. Thành viên cũ (null) không đổi gì.
-- ============================================================================

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

  -- '{}' = chưa có agent nào, KHÁC null = toàn quyền. Phân biệt này là cả điểm mấu chốt.
  -- do nothing: người đã là thành viên thì giữ nguyên vai lẫn agent đang có.
  insert into public.company_members (company_id, user_id, role, email, agents)
  values (inv.company_id, auth.uid(), inv.role, auth.jwt() ->> 'email', '{}')
  on conflict (company_id, user_id) do nothing;

  update public.company_invites set accepted_at = now() where id = inv_id;
end;
$$;

revoke all on function public.accept_invite(uuid) from public;
grant execute on function public.accept_invite(uuid) to authenticated;
