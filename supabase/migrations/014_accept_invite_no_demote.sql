-- ============================================================================
-- 014 — NHẬN LỜI MỜI KHÔNG ĐƯỢC HẠ VAI NGƯỜI ĐANG CÓ
--
-- accept_invite() đang có:
--     on conflict (company_id, user_id) do update set role = excluded.role
-- Nghĩa là ai ĐÃ là thành viên mà bấm nhận một lời mời thì vai bị GHI ĐÈ theo lời
-- mời. Chủ sở hữu tự mời chính email mình (vai mặc định của ô mời là "Nhập liệu")
-- rồi bấm Tham gia là tự hạ mình xuống editor. Nếu đó là owner duy nhất thì công ty
-- còn ZERO owner: không ai mời được người khác, đổi vai, sửa hồ sơ, hay xuất dữ liệu.
-- Không có đường tự cứu trong app — phải vào SQL sửa tay.
--
-- Sửa: đã là thành viên thì nhận lời mời KHÔNG đổi vai. Muốn nâng/hạ vai người đã
-- có thì dùng ô đổi vai trong Cài đặt công ty (changeRole), đúng chỗ của nó.
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

  -- do nothing, KHÔNG do update: vai của người đã là thành viên giữ nguyên.
  insert into public.company_members (company_id, user_id, role, email)
  values (inv.company_id, auth.uid(), inv.role, auth.jwt() ->> 'email')
  on conflict (company_id, user_id) do nothing;

  update public.company_invites set accepted_at = now() where id = inv_id;
end;
$$;

revoke all on function public.accept_invite(uuid) from public;
grant execute on function public.accept_invite(uuid) to authenticated;

-- ─────────── CỨU CÔNG TY ĐÃ MẤT HẾT OWNER ───────────
-- Chạy để xem công ty nào đang không còn owner:
--
--   select c.id, c.name from public.companies c
--    where not exists (select 1 from public.company_members m
--                       where m.company_id = c.id and m.role = 'owner');
--
-- Trả vai owner cho người đã tạo công ty:
--
--   update public.company_members m set role = 'owner'
--     from public.companies c
--    where c.id = m.company_id and m.user_id = c.created_by
--      and not exists (select 1 from public.company_members o
--                       where o.company_id = c.id and o.role = 'owner');
