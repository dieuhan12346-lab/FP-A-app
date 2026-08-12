import { supabase } from "./supabase";

/* Xuất TOÀN BỘ dữ liệu của một công ty ra một tệp JSON.
   Phục vụ quyền truy cập/mang theo dữ liệu, và để khách tự giữ bản sao khi rời dịch vụ.
   Chỉ đọc — RLS vẫn áp dụng, nên người dùng chỉ xuất được dữ liệu công ty mình thuộc về. */

/** Các bảng gắn trực tiếp company_id. Thêm bảng mới thì khai báo ở đây. */
const DIRECT_TABLES = [
  "receivables",
  "payables",
  "cashflow_settings",
  "transactions",
  "credit_factors",
  "reminder_log",
  "invoice_uploads",
];

/** Gom dữ liệu công ty → object. Bảng nào lỗi/không tồn tại thì ghi rõ thay vì làm hỏng cả bản xuất. */
export async function exportCompanyData(companyId) {
  if (!supabase) throw new Error("Bản dựng này chưa cấu hình Supabase");
  if (!companyId) throw new Error("Chưa xác định được hồ sơ công ty");

  const out = {
    exportedAt: new Date().toISOString(),
    companyId,
    note: "Bản xuất dữ liệu công ty từ phần mềm Luxora. Mỗi khoá là một bảng dữ liệu.",
    tables: {},
    errors: {},
  };

  // Hồ sơ công ty
  const c = await supabase.from("companies").select("*").eq("id", companyId).maybeSingle();
  if (c.error) out.errors.companies = c.error.message; else out.tables.companies = c.data ? [c.data] : [];

  // Các bảng gắn company_id
  for (const t of DIRECT_TABLES) {
    const { data, error } = await supabase.from(t).select("*").eq("company_id", companyId);
    if (error) out.errors[t] = error.message; else out.tables[t] = data || [];
  }

  // Dòng hóa đơn: nối qua invoice_uploads của công ty
  try {
    const ids = (out.tables.invoice_uploads || []).map((u) => u.id);
    if (ids.length) {
      const { data, error } = await supabase.from("invoice_lines").select("*").in("upload_id", ids);
      if (error) out.errors.invoice_lines = error.message; else out.tables.invoice_lines = data || [];
    } else out.tables.invoice_lines = [];
  } catch (e) {
    out.errors.invoice_lines = String(e?.message || e);
  }

  out.summary = Object.fromEntries(Object.entries(out.tables).map(([k, v]) => [k, Array.isArray(v) ? v.length : 0]));
  return out;
}

/** Tải object xuống máy dưới dạng tệp JSON. */
export function downloadJson(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
