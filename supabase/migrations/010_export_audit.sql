-- ============================================================================
-- 010 — XUẤT DỮ LIỆU CÓ KIỂM QUYỀN + NHẬT KÝ
--
-- Trước đây nút "Xuất dữ liệu" chạy hoàn toàn ở trình duyệt: nó gọi một loạt
-- SELECT rồi ghép file JSON. Ẩn nút với người không phải Chủ sở hữu chỉ là che
-- giao diện — ai cũng mở được devtools và gọi lại đúng những SELECT đó.
--
-- File này chuyển việc xuất xuống cơ sở dữ liệu:
--   · hàm export_company_data() kiểm is_owner() TRƯỚC khi đọc bất cứ thứ gì
--   · mỗi lần xuất ghi một dòng vào audit_log — ai, lúc nào, bao nhiêu dòng
--
-- GIỚI HẠN CẦN BIẾT: việc này chặn TÍNH NĂNG XUẤT, không chặn được việc đọc.
-- Thành viên vai xem vẫn đọc được từng bảng theo RLS, nên vẫn tự chép ra được.
-- Đọc thì không thể "gỡ đọc"; cái đổi được là bản xuất gọn một cú bấm giờ chỉ
-- Chủ sở hữu có, và mọi lần xuất đều để lại dấu vết quy được về người.
-- ============================================================================

-- Có sẵn trong 000_base_schema.sql; lặp lại ở đây để file chạy được độc lập trên
-- cơ sở dữ liệu cũ (chưa có bộ hàm phân vai). create or replace nên chạy lại vô hại.
create or replace function public.is_owner(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.company_members m
                 where m.company_id = cid and m.user_id = auth.uid()
                   and m.role = 'owner');
$$;

-- ─────────────────────── NHẬT KÝ ───────────────────────

create table if not exists public.audit_log (
  id         bigint generated always as identity primary key,
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id    uuid references auth.users(id) on delete set null,
  email      text,
  action     text not null,
  detail     jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_company on public.audit_log (company_id, created_at desc);

alter table public.audit_log enable row level security;

drop policy if exists "owner reads audit_log" on public.audit_log;
create policy "owner reads audit_log" on public.audit_log for select
  using (public.is_owner(company_id));

-- CỐ Ý không có policy insert/update/delete: chỉ hàm SECURITY DEFINER (và service
-- role phía máy chủ) ghi được. Người dùng không tự thêm dòng giả, cũng không xoá
-- được dấu vết của chính mình — nhật ký mà đối tượng bị ghi sửa được thì vô nghĩa.

-- ─────────────────────── XUẤT DỮ LIỆU ───────────────────────

create or replace function public.export_company_data(cid uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  tbls jsonb;
  sums jsonb;
begin
  -- Kiểm quyền TRƯỚC khi đọc. Hàm chạy quyền chủ sở hữu hàm (bỏ qua RLS), nên
  -- dòng này chính là chốt chặn duy nhất — đặt sai chỗ là hở toàn bộ dữ liệu.
  if not public.is_owner(cid) then
    raise exception 'Chỉ Chủ sở hữu công ty mới xuất được toàn bộ dữ liệu';
  end if;

  select jsonb_build_object(
    'companies',         coalesce((select jsonb_agg(to_jsonb(t)) from public.companies         t where t.id = cid),         '[]'::jsonb),
    'company_members',   coalesce((select jsonb_agg(to_jsonb(t)) from public.company_members   t where t.company_id = cid), '[]'::jsonb),
    'receivables',       coalesce((select jsonb_agg(to_jsonb(t)) from public.receivables       t where t.company_id = cid), '[]'::jsonb),
    'payables',          coalesce((select jsonb_agg(to_jsonb(t)) from public.payables          t where t.company_id = cid), '[]'::jsonb),
    'cashflow_settings', coalesce((select jsonb_agg(to_jsonb(t)) from public.cashflow_settings t where t.company_id = cid), '[]'::jsonb),
    'transactions',      coalesce((select jsonb_agg(to_jsonb(t)) from public.transactions      t where t.company_id = cid), '[]'::jsonb),
    'credit_factors',    coalesce((select jsonb_agg(to_jsonb(t)) from public.credit_factors    t where t.company_id = cid), '[]'::jsonb),
    'reminder_log',      coalesce((select jsonb_agg(to_jsonb(t)) from public.reminder_log      t where t.company_id = cid), '[]'::jsonb),
    'invoice_uploads',   coalesce((select jsonb_agg(to_jsonb(t)) from public.invoice_uploads   t where t.company_id = cid), '[]'::jsonb),
    'invoice_lines',     coalesce((select jsonb_agg(to_jsonb(l)) from public.invoice_lines l
                                     join public.invoice_uploads u on u.id = l.upload_id
                                    where u.company_id = cid),                                  '[]'::jsonb)
  ) into tbls;

  select jsonb_object_agg(key, jsonb_array_length(value)) into sums from jsonb_each(tbls);

  insert into public.audit_log (company_id, user_id, email, action, detail)
  values (cid, auth.uid(), auth.jwt() ->> 'email', 'export', sums);

  return jsonb_build_object(
    'exportedAt', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'companyId',  cid,
    'note',       'Bản xuất dữ liệu công ty từ phần mềm Luxora. Mỗi khoá trong "tables" là một bảng.',
    'tables',     tbls,
    'summary',    sums
  );
end;
$$;

-- Mặc định Postgres cho PUBLIC chạy hàm mới — phải thu lại, nếu không vai anon
-- (khách chưa đăng nhập) cũng gọi được.
revoke all on function public.export_company_data(uuid) from public;
grant execute on function public.export_company_data(uuid) to authenticated;
