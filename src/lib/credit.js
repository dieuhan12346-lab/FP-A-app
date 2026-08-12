import { supabase } from "./supabase";

/* Chỉ số tín dụng nhập tay theo từng khách (bảng credit_factors). Điểm hành vi
   thanh toán tính từ receivables ở app; đây chỉ là các chỉ số tài chính nhập tay. */

const normKey = (s) => String(s || "").trim().toLowerCase();

/** Tải chỉ số của công ty → map { customerKey: { requested, financials:{...số liệu BCTC} } }. */
export async function fetchCreditFactors(companyId) {
  if (!supabase || !companyId) return {};
  const { data, error } = await supabase
    .from("credit_factors")
    .select("customer, requested, financials, approved_limit, approved_at, approved_score, review_at")
    .eq("company_id", companyId);
  if (error) throw error;
  const map = {};
  for (const r of data || []) {
    map[normKey(r.customer)] = {
      requested: r.requested == null ? "" : Number(r.requested),
      financials: r.financials || null,
      approvedLimit: r.approved_limit == null ? null : Number(r.approved_limit),
      approvedAt: r.approved_at || null,
      approvedScore: r.approved_score == null ? null : Number(r.approved_score),
      reviewAt: r.review_at || null,
    };
  }
  return map;
}

/** Lưu quyết định tín dụng: duyệt hạn mức và/hoặc đặt lịch rà soát lại. */
export async function saveCreditDecision(companyId, customer, { approvedLimit, approvedScore, reviewAt } = {}) {
  if (!supabase) throw new Error("Bản dựng này chưa cấu hình Supabase");
  if (!companyId) throw new Error("Chưa xác định được hồ sơ công ty");
  const row = { company_id: companyId, customer, updated_at: new Date().toISOString() };
  if (approvedLimit !== undefined) {
    row.approved_limit = approvedLimit == null ? null : Number(approvedLimit);
    row.approved_at = approvedLimit == null ? null : new Date().toISOString();
    row.approved_score = approvedScore == null ? null : Number(approvedScore);
  }
  if (reviewAt !== undefined) row.review_at = reviewAt || null;
  const { error } = await supabase.from("credit_factors").upsert(row, { onConflict: "company_id,customer" });
  if (error) throw error;
}

/** Lưu (upsert) cho 1 khách. fields: { requested, financials:{...các mã số BCTC} }. */
export async function saveCreditFactors(companyId, customer, fields) {
  if (!supabase) throw new Error("Bản dựng này chưa cấu hình Supabase");
  if (!companyId) throw new Error("Chưa xác định được hồ sơ công ty");
  const num = (v) => (v === "" || v == null ? null : Number(v));
  // Chỉ giữ các số hợp lệ trong financials (bỏ ô trống).
  const fin = {};
  for (const [k, v] of Object.entries(fields.financials || {})) if (v !== "" && v != null && isFinite(Number(v))) fin[k] = Number(v);
  const { error } = await supabase.from("credit_factors").upsert(
    {
      company_id: companyId, customer,
      requested: num(fields.requested),
      financials: Object.keys(fin).length ? fin : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "company_id,customer" }
  );
  if (error) throw error;
}
