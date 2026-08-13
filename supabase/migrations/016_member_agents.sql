-- ============================================================================
-- 016 — PHÂN QUYỀN THEO TỪNG AGENT
--
-- Vai (owner/editor/viewer) trả lời "được ghi hay chỉ đọc". Cột dưới đây trả lời
-- câu khác: "được vào những agent nào". Kế toán chỉ cần Đọc hoá đơn — không có lý
-- do cho họ thấy chấm điểm tín dụng hay nhắc nợ của cả công ty.
--
-- agents = null nghĩa là TOÀN QUYỀN. Chọn null thay vì mảng rỗng để thành viên
-- đang có không bị khoá sạch ngay khi chạy migration này.
-- Owner luôn vào được mọi agent, không phụ thuộc cột này.
-- ============================================================================

alter table public.company_members add column if not exists agents text[];

comment on column public.company_members.agents is
  'Danh sách agent được dùng: fpa, ops, credit, collect, invoice. null = toàn quyền.';

create or replace function public.has_agent(cid uuid, agent text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.company_members m
     where m.company_id = cid
       and m.user_id = auth.uid()
       and (m.role = 'owner' or m.agents is null or agent = any(m.agents))
  );
$$;

-- ─────────── SIẾT RLS THEO AGENT ───────────
-- Chỉ áp cho bảng thuộc HẲN về một agent. Dòng tiền (receivables, payables,
-- transactions, cashflow_settings) là dữ liệu nền nhiều agent cùng đọc — giữ nguyên
-- theo vai, siết theo agent ở đó là làm hỏng cả app.

-- Chấm điểm tín dụng
drop policy if exists "read credit_factors" on public.credit_factors;
create policy "read credit_factors" on public.credit_factors for select
  using (public.is_member(company_id) and public.has_agent(company_id, 'credit'));
drop policy if exists "insert credit_factors" on public.credit_factors;
create policy "insert credit_factors" on public.credit_factors for insert
  with check (public.can_edit(company_id) and public.has_agent(company_id, 'credit'));
drop policy if exists "update credit_factors" on public.credit_factors;
create policy "update credit_factors" on public.credit_factors for update
  using (public.can_edit(company_id) and public.has_agent(company_id, 'credit'))
  with check (public.can_edit(company_id) and public.has_agent(company_id, 'credit'));
drop policy if exists "delete credit_factors" on public.credit_factors;
create policy "delete credit_factors" on public.credit_factors for delete
  using (public.can_edit(company_id) and public.has_agent(company_id, 'credit'));

-- Đọc hoá đơn
drop policy if exists "read invoice_uploads" on public.invoice_uploads;
create policy "read invoice_uploads" on public.invoice_uploads for select
  using (public.is_member(company_id) and public.has_agent(company_id, 'invoice'));
drop policy if exists "insert invoice_uploads" on public.invoice_uploads;
create policy "insert invoice_uploads" on public.invoice_uploads for insert
  with check (public.can_edit(company_id) and public.has_agent(company_id, 'invoice'));
drop policy if exists "update invoice_uploads" on public.invoice_uploads;
create policy "update invoice_uploads" on public.invoice_uploads for update
  using (public.can_edit(company_id) and public.has_agent(company_id, 'invoice'))
  with check (public.can_edit(company_id) and public.has_agent(company_id, 'invoice'));
drop policy if exists "delete invoice_uploads" on public.invoice_uploads;
create policy "delete invoice_uploads" on public.invoice_uploads for delete
  using (public.can_edit(company_id) and public.has_agent(company_id, 'invoice'));

-- Dòng hoá đơn đi theo upload nên tự thừa hưởng điều kiện agent ở trên.

-- Nhắc nợ
drop policy if exists reminder_log_select on public.reminder_log;
create policy reminder_log_select on public.reminder_log for select
  using (public.is_member(company_id) and public.has_agent(company_id, 'collect'));

revoke all on function public.has_agent(uuid, text) from public;
grant execute on function public.has_agent(uuid, text) to authenticated;
