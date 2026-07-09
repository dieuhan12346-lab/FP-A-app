import { supabase } from "./supabase";

/** Công ty đầu tiên mà user hiện tại là thành viên, hoặc null nếu chưa có. */
export async function fetchMyCompany() {
  if (!supabase) return null;
  const { data: member, error: e1 } = await supabase
    .from("company_members")
    .select("company_id")
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
  return company;
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
  return company;
}

export async function updateCompany(companyId, patch) {
  if (!supabase) throw new Error("Supabase chưa được cấu hình");
  const dbPatch = {};
  if (patch.name !== undefined) dbPatch.name = patch.name;
  if (patch.country !== undefined) dbPatch.country = patch.country;
  if (patch.language !== undefined) dbPatch.language = patch.language;
  if (patch.currency !== undefined) dbPatch.currency = patch.currency;
  if (patch.accountingStandard !== undefined) dbPatch.accounting_standard = patch.accountingStandard;
  if (patch.taxRegime !== undefined) dbPatch.tax_regime = patch.taxRegime;
  if (patch.timezone !== undefined) dbPatch.timezone = patch.timezone;
  const { data, error } = await supabase.from("companies").update(dbPatch).eq("id", companyId).select().single();
  if (error) throw error;
  return data;
}
