-- ============================================================================
-- 021 — DÙNG THỬ 14 NGÀY, HẾT HẠN KHOÁ CHỈ-XEM, 30 NGÀY SAU MỚI XOÁ
--
-- Vòng đời một công ty:
--   trial   → 14 ngày, dùng đầy đủ
--   expired → hết 14 ngày mà chưa mua: ĐỌC và XUẤT được, KHÔNG ghi được nữa
--   purge   → 30 ngày sau khi hết hạn: vào danh sách chờ xoá, người vận hành duyệt
--   paid    → đã mua, không hết hạn
--
-- Khoá đặt trong can_edit() chứ không ở giao diện: hàm đó là cửa của MỌI thao tác
-- ghi trong RLS, nên hết hạn là chặn được cả đường gọi API trực tiếp, không chỉ ẩn nút.
--
-- Đọc và xuất KHÔNG bị chặn — is_member() và is_owner() giữ nguyên. Khách hết hạn
-- vẫn lấy được sổ sách của mình về. Chặn cả đường xuất là giữ dữ liệu làm con tin.
-- ============================================================================

alter table public.companies
  add column if not exists plan text not null default 'trial';

alter table public.companies
  add column if not exists trial_ends_at timestamptz not null default (now() + interval '14 days');

do $$
begin
  alter table public.companies
    add constraint companies_plan_check check (plan in ('trial','paid'));
exception when duplicate_object then null;
end $$;

comment on column public.companies.plan is
  'trial = đang dùng thử (hết trial_ends_at thì khoá ghi) · paid = đã mua, không hết hạn.';

-- Công ty ĐANG CÓ được coi là đã mua. Không làm bước này thì migration vừa chạy xong
-- là mọi công ty hiện tại bắt đầu đếm ngược 14 ngày, kể cả công ty của chính bạn.
update public.companies set plan = 'paid' where plan = 'trial';

-- ─────────────── KHOÁ GHI KHI HẾT HẠN ───────────────

create or replace function public.can_edit(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
      from public.company_members m
      join public.companies c on c.id = m.company_id
     where m.company_id = cid
       and m.user_id = auth.uid()
       and m.role in ('owner','editor')
       and (c.plan <> 'trial' or c.trial_ends_at > now())
  );
$$;

-- ─────────────── DANH SÁCH CHỜ XOÁ ───────────────
-- Chỉ LIỆT KÊ, không xoá. Người vận hành xem rồi tự chạy script xoá.
-- Cố ý không dùng pg_cron xoá thẳng: một lỗi logic là xoá nhầm hàng loạt, không ai kịp chặn.

create or replace function public.purge_queue()
returns table (
  company_id   uuid,
  ten_cong_ty  text,
  het_han_ngay date,
  qua_han_ngay integer,
  so_ban_ghi   bigint
)
language sql stable security definer set search_path = public as $$
  select c.id,
         c.name,
         c.trial_ends_at::date,
         (current_date - c.trial_ends_at::date)::int,
         (select count(*) from public.receivables r where r.company_id = c.id)
       + (select count(*) from public.payables   p where p.company_id = c.id)
       + (select count(*) from public.transactions t where t.company_id = c.id)
    from public.companies c
   where c.plan = 'trial'
     and c.trial_ends_at < now() - interval '30 days'
   order by c.trial_ends_at;
$$;

-- Chỉ người vận hành chạy bằng service role trong SQL Editor. Không mở cho người dùng.
revoke all on function public.purge_queue() from public;

-- Xem ngay: hiện tại phải rỗng, vì mọi công ty vừa được đánh dấu 'paid'.
select * from public.purge_queue();
