import { supabase } from "./supabase";

/** Chuẩn hoá row từ Supabase (snake_case) sang camelCase dùng trong toàn bộ app. */
function normalizeCompany(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    country: row.country,
    language: row.language,
    currency: row.currency,
    accountingStandard: row.accounting_standard,
    taxRegime: row.tax_regime,
    timezone: row.timezone,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

/** Membership + company, đã xử lý DB cũ chưa có cột last_used_at. */
async function fetchMemberships() {
  const sel = (withLastUsed) =>
    supabase
      .from("company_members")
      .select((withLastUsed ? "last_used_at, " : "") + "company_id, created_at, companies(*)")
      .order(withLastUsed ? "last_used_at" : "created_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });
  try {
    const { data, error } = await sel(true);
    if (error) throw error;
    return data || [];
  } catch {
    const { data, error } = await sel(false);
    if (error) throw error;
    return data || [];
  }
}

/** Công ty đang dùng = hồ sơ được chọn gần nhất (last_used_at), fallback hồ sơ mới tạo nhất. */
export async function fetchMyCompany() {
  if (!supabase) return null;
  const rows = await fetchMemberships();
  const hit = rows.find((r) => r.companies);
  return hit ? normalizeCompany(hit.companies) : null;
}

/** Tất cả hồ sơ công ty của user — mỗi công ty là một bộ sổ sách riêng. */
export async function listMyCompanies() {
  if (!supabase) return [];
  const rows = await fetchMemberships();
  return rows.filter((r) => r.companies).map((r) => normalizeCompany(r.companies));
}

export async function createCompany({ name, country, language, currency, accountingStandard, taxRegime, timezone }) {
  if (!supabase) throw new Error("Supabase chưa được cấu hình");
  const { data: userRes, error: eu } = await supabase.auth.getUser();
  if (eu) throw eu;
  const uid = userRes?.user?.id;
  const { data: company, error: e1 } = await supabase
    .from("companies")
    .insert({ name, country, language, currency, accounting_standard: accountingStandard, tax_regime: taxRegime, timezone, created_by: uid })
    .select()
    .single();
  if (e1) throw e1;
  const { error: e2 } = await supabase
    .from("company_members")
    .insert({ company_id: company.id, user_id: uid, role: "owner" });
  if (e2) throw e2;
  // hồ sơ mới trở thành hồ sơ đang dùng (bỏ qua lỗi nếu DB chưa có cột last_used_at)
  await switchCompany(company.id).catch(() => {});
  return normalizeCompany(company);
}

/** Chuyển sang dùng hồ sơ khác — ghi last_used_at để mọi thiết bị cùng nhận. */
export async function switchCompany(companyId) {
  if (!supabase) return;
  const { error } = await supabase
    .from("company_members")
    .update({ last_used_at: new Date().toISOString() })
    .eq("company_id", companyId);
  if (error) throw error;
}

/** Hồ sơ công ty là bất biến sau khi tạo — chỉ được đổi tên.
 *  (Database cũng chặn ở tầng cột: xem phần "immutable" trong supabase/schema.sql.) */
export async function updateCompanyName(companyId, name) {
  if (!supabase) throw new Error("Supabase chưa được cấu hình");
  const { data, error } = await supabase.from("companies").update({ name }).eq("id", companyId).select().single();
  if (error) throw error;
  return normalizeCompany(data);
}
