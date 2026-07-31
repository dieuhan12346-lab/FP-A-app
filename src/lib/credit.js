import { supabase } from "./supabase";

/* Chỉ số tín dụng nhập tay theo từng khách (bảng credit_factors). Điểm hành vi
   thanh toán tính từ receivables ở app; đây chỉ là các chỉ số tài chính nhập tay. */

const normKey = (s) => String(s || "").trim().toLowerCase();

/** Tải toàn bộ chỉ số nhập tay của công ty → map { customerKey: {liquidity,leverage,industry,size,industry_key,requested} }. */
export async function fetchCreditFactors(companyId) {
  if (!supabase || !companyId) return {};
  const { data, error } = await supabase
    .from("credit_factors")
    .select("customer, liquidity, leverage, industry, size, industry_key, requested")
    .eq("company_id", companyId);
  if (error) throw error;
  const map = {};
  for (const r of data || []) {
    map[normKey(r.customer)] = {
      liquidity: r.liquidity, leverage: r.leverage, industry: r.industry, size: r.size,
      industry_key: r.industry_key || "", requested: r.requested == null ? "" : Number(r.requested),
    };
  }
  return map;
}

/** Lưu (upsert) chỉ số nhập tay cho 1 khách. fields: {liquidity,leverage,industry,size,industry_key,requested}. */
export async function saveCreditFactors(companyId, customer, fields) {
  if (!supabase) throw new Error("Bản dựng này chưa cấu hình Supabase");
  if (!companyId) throw new Error("Chưa xác định được hồ sơ công ty");
  const num = (v) => (v === "" || v == null ? null : Number(v));
  const { error } = await supabase.from("credit_factors").upsert(
    {
      company_id: companyId, customer,
      liquidity: num(fields.liquidity), leverage: num(fields.leverage),
      industry: num(fields.industry), size: num(fields.size),
      industry_key: fields.industry_key || null, requested: num(fields.requested),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "company_id,customer" }
  );
  if (error) throw error;
}
