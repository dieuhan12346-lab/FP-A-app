-- ============================================================================
-- 018 — PHẠM VI DỮ LIỆU THEO TỪNG NGƯỜI: toàn công ty ↔ chỉ của mình
--
-- Trục thứ ba, độc lập với vai và agent:
--   vai    → được ghi hay chỉ đọc
--   agent  → vào được màn hình nào
--   scope  → trong màn hình đó, thấy bản ghi của cả công ty hay chỉ của mình
--
-- MẶC ĐỊNH 'all' — CỐ Ý. Đặt 'own' làm mặc định thì Nhắc nợ và Đối soát vỡ ngay:
-- người nhập hoá đơn thường khác người đi đòi nợ, mà bên đòi nợ sẽ không thấy công
-- nợ bên kia nhập. Cấp 'own' cho ai thì owner tự chọn từng người, ví dụ nhân viên
-- nhập liệu thời vụ chỉ nên thấy phần mình gõ.
--
-- cashflow_settings KHÔNG theo scope: nó là một dòng số dư đầu kỳ của cả công ty,
-- không phải bản ghi của ai. Cắt theo người là ai cũng thấy số dư bằng 0.
-- ============================================================================

alter table public.company_members
  add column if not exists data_scope text not null default 'all';

do $$
begin
  alter table public.company_members
    add constraint company_members_data_scope_check check (data_scope in ('all','own'));
exception when duplicate_object then null;
end $$;

comment on column public.company_members.data_scope is
  'all = thấy bản ghi toàn công ty; own = chỉ bản ghi do chính mình tạo. Owner luôn all.';

create or replace function public.sees_all(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.company_members m
     where m.company_id = cid and m.user_id = auth.uid()
       and (m.role = 'owner' or coalesce(m.data_scope, 'all') = 'all')
  );
$$;

revoke all on function public.sees_all(uuid) from public;
grant execute on function public.sees_all(uuid) to authenticated;

-- ─────────── ÁP SCOPE VÀO CÁC BẢNG BẢN GHI ───────────

drop policy if exists "read receivables" on public.receivables;
create policy "read receivables" on public.receivables for select
  using (public.is_member(company_id) and (public.sees_all(company_id) or user_id = auth.uid()));
drop policy if exists "update receivables" on public.receivables;
create policy "update receivables" on public.receivables for update
  using (public.can_edit(company_id) and (public.sees_all(company_id) or user_id = auth.uid()))
  with check (public.can_edit(company_id) and (public.sees_all(company_id) or user_id = auth.uid()));
drop policy if exists "delete receivables" on public.receivables;
create policy "delete receivables" on public.receivables for delete
  using (public.can_edit(company_id) and (public.sees_all(company_id) or user_id = auth.uid()));

drop policy if exists "read payables" on public.payables;
create policy "read payables" on public.payables for select
  using (public.is_member(company_id) and (public.sees_all(company_id) or user_id = auth.uid()));
drop policy if exists "update payables" on public.payables;
create policy "update payables" on public.payables for update
  using (public.can_edit(company_id) and (public.sees_all(company_id) or user_id = auth.uid()))
  with check (public.can_edit(company_id) and (public.sees_all(company_id) or user_id = auth.uid()));
drop policy if exists "delete payables" on public.payables;
create policy "delete payables" on public.payables for delete
  using (public.can_edit(company_id) and (public.sees_all(company_id) or user_id = auth.uid()));

drop policy if exists "read transactions" on public.transactions;
create policy "read transactions" on public.transactions for select
  using (public.is_member(company_id) and (public.sees_all(company_id) or user_id = auth.uid()));
drop policy if exists "update transactions" on public.transactions;
create policy "update transactions" on public.transactions for update
  using (public.can_edit(company_id) and (public.sees_all(company_id) or user_id = auth.uid()))
  with check (public.can_edit(company_id) and (public.sees_all(company_id) or user_id = auth.uid()));
drop policy if exists "delete transactions" on public.transactions;
create policy "delete transactions" on public.transactions for delete
  using (public.can_edit(company_id) and (public.sees_all(company_id) or user_id = auth.uid()));

-- Hai bảng dưới cộng thêm điều kiện agent đã đặt ở 016.
drop policy if exists "read invoice_uploads" on public.invoice_uploads;
create policy "read invoice_uploads" on public.invoice_uploads for select
  using (public.is_member(company_id) and public.has_agent(company_id, 'invoice')
         and (public.sees_all(company_id) or user_id = auth.uid()));
drop policy if exists "update invoice_uploads" on public.invoice_uploads;
create policy "update invoice_uploads" on public.invoice_uploads for update
  using (public.can_edit(company_id) and public.has_agent(company_id, 'invoice')
         and (public.sees_all(company_id) or user_id = auth.uid()))
  with check (public.can_edit(company_id) and public.has_agent(company_id, 'invoice')
         and (public.sees_all(company_id) or user_id = auth.uid()));
drop policy if exists "delete invoice_uploads" on public.invoice_uploads;
create policy "delete invoice_uploads" on public.invoice_uploads for delete
  using (public.can_edit(company_id) and public.has_agent(company_id, 'invoice')
         and (public.sees_all(company_id) or user_id = auth.uid()));

-- credit_factors là hồ sơ tín dụng của KHÁCH HÀNG, dùng chung cả công ty — cắt theo
-- người nhập là mỗi người chấm điểm một kiểu trên cùng một khách. Giữ theo agent thôi.
