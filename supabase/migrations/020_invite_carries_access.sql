-- ============================================================================
-- 020 — LỜI MỜI MANG THEO AGENT VÀ PHẠM VI DỮ LIỆU
--
-- 017 cho người mới vào với agents = '{}' rồi owner tick mở dần. Thực tế dùng thì
-- dở: người được mời vào thấy màn hình trống, phải nhắn owner, owner phải mở app
-- lần nữa. Hai người chờ nhau cho một việc lẽ ra quyết một lần.
--
-- Nay owner chọn agent + phạm vi NGAY LÚC MỜI, accept_invite chép thẳng sang dòng
-- thành viên. Vào phát là dùng được đúng phần được giao.
-- ============================================================================

alter table public.company_invites
  add column if not exists agents text[] not null default '{}';

alter table public.company_invites
  add column if not exists data_scope text not null default 'all';

do $$
begin
  alter table public.company_invites
    add constraint company_invites_data_scope_check check (data_scope in ('all','own'));
exception when duplicate_object then null;
end $$;

comment on column public.company_invites.agents is
  'Agent cấp cho người được mời, chép sang company_members khi họ nhận lời mời.';

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

  -- Vai, agent và phạm vi đều lấy từ chính lời mời — client không tự khai được.
  -- do nothing: người đã là thành viên thì giữ nguyên quyền đang có, nhận lời mời
  -- không được phép sửa quyền của họ.
  insert into public.company_members (company_id, user_id, role, email, agents, data_scope)
  values (inv.company_id, auth.uid(), inv.role, auth.jwt() ->> 'email',
          coalesce(inv.agents, '{}'), coalesce(inv.data_scope, 'all'))
  on conflict (company_id, user_id) do nothing;

  update public.company_invites set accepted_at = now() where id = inv_id;
end;
$$;

revoke all on function public.accept_invite(uuid) from public;
grant execute on function public.accept_invite(uuid) to authenticated;
