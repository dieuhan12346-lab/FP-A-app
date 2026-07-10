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

/** Công ty đang dùng = công ty mới nhất mà user là thành viên (tạo hồ sơ mới sẽ tự chuyển sang nó). */
export async function fetchMyCompany() {
  if (!supabase) return null;
  const { data: member, error: e1 } = await supabase
    .from("company_members")
    .select("company_id")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (e1) throw e1;
  if (!member) return null;
  const { data: company, error: e2 } = await supabase
    .from("companies")
    .select("*")
    .eq("id", member.company_id)
    .single();
  if (e2) throw e2;
  return normalizeCompany(company);
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
  return normalizeCompany(company);
}

/** Hồ sơ công ty là bất biến sau khi tạo — chỉ được đổi tên.
 *  (Database cũng chặn ở tầng cột: xem phần "immutable" trong supabase/schema.sql.) */
export async function updateCompanyName(companyId, name) {
  if (!supabase) throw new Error("Supabase chưa được cấu hình");
  const { data, error } = await supabase.from("companies").update({ name }).eq("id", companyId).select().single();
  if (error) throw error;
  return normalizeCompany(data);
}
