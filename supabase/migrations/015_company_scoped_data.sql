-- ============================================================================
-- 015 — DỮ LIỆU NGHIỆP VỤ CÁCH LY THEO CÔNG TY (thay vì theo từng người)
--
-- ĐỌC KỸ TRƯỚC KHI CHẠY — file này ĐỔI PHẠM VI NHÌN THẤY CỦA DỮ LIỆU ĐANG SỐNG.
--
-- Hiện tại các bảng nghiệp vụ cách ly theo user_id: mỗi người chỉ thấy dòng mình
-- nhập. Hệ quả là mời đồng nghiệp vào công ty xong họ thấy app rỗng — đúng vai,
-- nhưng không thấy số liệu ai khác nhập.
--
-- Sau khi chạy: MỌI THÀNH VIÊN CÔNG TY ĐỀU ĐỌC ĐƯỢC toàn bộ số liệu của công ty
-- đó. Đây là điều mong muốn (cả phòng dùng chung một bộ sổ), nhưng nếu trước đây
-- có ai dùng chung một công ty để giữ số liệu riêng thì số liệu đó lộ ra với các
-- thành viên còn lại. Kiểm trước bằng:
--
--   select company_id, user_id, count(*) from public.receivables group by 1,2;
--
-- Quyền GHI chia theo vai: owner + editor sửa được, viewer chỉ đọc.
-- Cột user_id giữ nguyên để biết ai tạo dòng nào, nhưng thôi dùng để phân quyền.
-- ============================================================================

-- ─────────── BƯỚC 1: DỌN company_id CÒN TRỐNG ───────────
-- invoice_uploads đời đầu có thể chưa gắn company_id. Chuyển sang phân quyền theo
-- công ty mà cột đó trống thì dòng ĐÓ BIẾN MẤT với tất cả mọi người. Điền trước.
-- Chỉ điền khi không mơ hồ: người tạo chỉ thuộc đúng một công ty.

update public.invoice_uploads u
   set company_id = m.company_id
  from public.company_members m
 where u.company_id is null
   and m.user_id = u.user_id
   and (select count(*) from public.company_members m2 where m2.user_id = u.user_id) = 1;

-- ─────────── BƯỚC 2: CÔNG TY ───────────
-- Thành viên phải đọc được hồ sơ công ty, nếu không người mới nhận lời mời vào
-- xong vẫn bị hỏi tạo công ty (fetchMyCompany trả null vì đọc companies không ra).

drop policy if exists "own company" on public.companies;
drop policy if exists "read own company" on public.companies;
drop policy if exists "read own or member company" on public.companies;
create policy "read own or member company" on public.companies for select
  using (created_by = auth.uid() or public.is_member(id));

drop policy if exists "update member company" on public.companies;
drop policy if exists "owner updates company" on public.companies;
create policy "owner updates company" on public.companies for update
  using (public.is_owner(id)) with check (public.is_owner(id));

-- ─────────── BƯỚC 3: BẢNG NGHIỆP VỤ ───────────
-- ĐỌC cho mọi thành viên (is_member), GHI cho owner + editor (can_edit).

drop policy if exists "own receivables" on public.receivables;
drop policy if exists "company receivables" on public.receivables;
drop policy if exists "read receivables" on public.receivables;
create policy "read receivables" on public.receivables for select using (public.is_member(company_id));
drop policy if exists "insert receivables" on public.receivables;
create policy "insert receivables" on public.receivables for insert with check (public.can_edit(company_id));
drop policy if exists "update receivables" on public.receivables;
create policy "update receivables" on public.receivables for update using (public.can_edit(company_id)) with check (public.can_edit(company_id));
drop policy if exists "delete receivables" on public.receivables;
create policy "delete receivables" on public.receivables for delete using (public.can_edit(company_id));

drop policy if exists "own payables" on public.payables;
drop policy if exists "company payables" on public.payables;
drop policy if exists "read payables" on public.payables;
create policy "read payables" on public.payables for select using (public.is_member(company_id));
drop policy if exists "insert payables" on public.payables;
create policy "insert payables" on public.payables for insert with check (public.can_edit(company_id));
drop policy if exists "update payables" on public.payables;
create policy "update payables" on public.payables for update using (public.can_edit(company_id)) with check (public.can_edit(company_id));
drop policy if exists "delete payables" on public.payables;
create policy "delete payables" on public.payables for delete using (public.can_edit(company_id));

drop policy if exists "own cashflow_settings" on public.cashflow_settings;
drop policy if exists "company cashflow_settings" on public.cashflow_settings;
drop policy if exists "read cashflow_settings" on public.cashflow_settings;
create policy "read cashflow_settings" on public.cashflow_settings for select using (public.is_member(company_id));
drop policy if exists "insert cashflow_settings" on public.cashflow_settings;
create policy "insert cashflow_settings" on public.cashflow_settings for insert with check (public.can_edit(company_id));
drop policy if exists "update cashflow_settings" on public.cashflow_settings;
create policy "update cashflow_settings" on public.cashflow_settings for update using (public.can_edit(company_id)) with check (public.can_edit(company_id));
drop policy if exists "delete cashflow_settings" on public.cashflow_settings;
create policy "delete cashflow_settings" on public.cashflow_settings for delete using (public.can_edit(company_id));

drop policy if exists "own transactions" on public.transactions;
drop policy if exists "company transactions" on public.transactions;
drop policy if exists "read transactions" on public.transactions;
create policy "read transactions" on public.transactions for select using (public.is_member(company_id));
drop policy if exists "insert transactions" on public.transactions;
create policy "insert transactions" on public.transactions for insert with check (public.can_edit(company_id));
drop policy if exists "update transactions" on public.transactions;
create policy "update transactions" on public.transactions for update using (public.can_edit(company_id)) with check (public.can_edit(company_id));
drop policy if exists "delete transactions" on public.transactions;
create policy "delete transactions" on public.transactions for delete using (public.can_edit(company_id));

drop policy if exists "own invoice_uploads" on public.invoice_uploads;
drop policy if exists "company invoice_uploads" on public.invoice_uploads;
drop policy if exists "read invoice_uploads" on public.invoice_uploads;
create policy "read invoice_uploads" on public.invoice_uploads for select using (public.is_member(company_id));
drop policy if exists "insert invoice_uploads" on public.invoice_uploads;
create policy "insert invoice_uploads" on public.invoice_uploads for insert with check (public.can_edit(company_id));
drop policy if exists "update invoice_uploads" on public.invoice_uploads;
create policy "update invoice_uploads" on public.invoice_uploads for update using (public.can_edit(company_id)) with check (public.can_edit(company_id));
drop policy if exists "delete invoice_uploads" on public.invoice_uploads;
create policy "delete invoice_uploads" on public.invoice_uploads for delete using (public.can_edit(company_id));

drop policy if exists "own credit_factors" on public.credit_factors;
drop policy if exists "company credit_factors" on public.credit_factors;
drop policy if exists "read credit_factors" on public.credit_factors;
create policy "read credit_factors" on public.credit_factors for select using (public.is_member(company_id));
drop policy if exists "insert credit_factors" on public.credit_factors;
create policy "insert credit_factors" on public.credit_factors for insert with check (public.can_edit(company_id));
drop policy if exists "update credit_factors" on public.credit_factors;
create policy "update credit_factors" on public.credit_factors for update using (public.can_edit(company_id)) with check (public.can_edit(company_id));
drop policy if exists "delete credit_factors" on public.credit_factors;
create policy "delete credit_factors" on public.credit_factors for delete using (public.can_edit(company_id));

-- Dòng hoá đơn không có company_id riêng — đi vòng qua invoice_uploads.
drop policy if exists "own lines" on public.invoice_lines;
drop policy if exists "company lines" on public.invoice_lines;
drop policy if exists "read invoice_lines" on public.invoice_lines;
create policy "read invoice_lines" on public.invoice_lines for select
  using (exists (select 1 from public.invoice_uploads u
                 where u.id = invoice_lines.upload_id and public.is_member(u.company_id)));
drop policy if exists "write invoice_lines" on public.invoice_lines;
create policy "write invoice_lines" on public.invoice_lines for all
  using (exists (select 1 from public.invoice_uploads u
                 where u.id = invoice_lines.upload_id and public.can_edit(u.company_id)))
  with check (exists (select 1 from public.invoice_uploads u
                      where u.id = invoice_lines.upload_id and public.can_edit(u.company_id)));

-- Nhật ký nhắc nợ: mọi thành viên đọc; ghi do máy chủ (service role, bỏ qua RLS).
drop policy if exists reminder_log_select on public.reminder_log;
create policy reminder_log_select on public.reminder_log for select
  using (public.is_member(company_id));

-- ─────────── BƯỚC 4: BÁO CÁO SAU KHI CHẠY ───────────
-- Kết quả cuối cùng của script. Mọi số phải bằng 0. Khác 0 nghĩa là còn dòng
-- không gắn công ty nào → sau migration này KHÔNG AI nhìn thấy chúng nữa
-- (dữ liệu vẫn còn nguyên trong bảng, chỉ là RLS chặn). Báo lại để xử lý tay.

select 'invoice_uploads chưa gắn công ty' as canh_bao, count(*) as so_dong
  from public.invoice_uploads where company_id is null
union all
select 'dòng hoá đơn thuộc upload chưa gắn công ty', count(*)
  from public.invoice_lines l
  join public.invoice_uploads u on u.id = l.upload_id
 where u.company_id is null;

-- ─────────── NẾU BÁO CÁO KHÁC 0: GẮN TAY ───────────
-- Bước 1 — xem từng dòng và người tạo thuộc những công ty nào:
--
--   select u.id, u.file_name, u.created_at, u.user_id,
--          (select count(*) from public.company_members m where m.user_id = u.user_id) as so_cong_ty,
--          (select string_agg(c.name, ' | ') from public.company_members m
--             join public.companies c on c.id = m.company_id
--            where m.user_id = u.user_id) as cac_cong_ty
--     from public.invoice_uploads u
--    where u.company_id is null
--    order by u.created_at;
--
-- Bước 2 — gắn cho đúng công ty (KHÔNG đoán; nhìn tên file + ngày rồi tự quyết):
--
--   update public.invoice_uploads
--      set company_id = '<company_id>'
--    where id in ('<upload_id>', '<upload_id>');
--
-- invoice_lines đi theo upload nên không cần sửa riêng.
