import { supabase } from "./supabase";

/* ---- Dòng tiền thật: phải thu / phải chi / số dư đầu kỳ (theo từng công ty) ---- */

/** Bản dựng thiếu VITE_SUPABASE_URL/ANON_KEY (vd Vercel Preview chưa tick env) → báo rõ thay vì vỡ. */
function db() {
  if (!supabase) throw new Error("Bản dựng này chưa cấu hình Supabase — kiểm tra biến môi trường VITE_SUPABASE_URL và VITE_SUPABASE_ANON_KEY cho môi trường đang chạy (Production/Preview).");
  return supabase;
}

const mapRecv = (r) => ({
  id: r.id, customer: r.customer, amount: Number(r.amount) || 0,
  dueDate: r.due_date, status: r.status, source: r.source, invoiceNo: r.invoice_no || "",
  customerEmail: r.customer_email || "", customerPhone: r.customer_phone || "",
});
const mapPay = (p) => ({
  id: p.id, label: p.label, amount: Number(p.amount) || 0,
  dueDate: p.due_date, status: p.status, category: p.category || "other",
});

/** Toàn bộ dữ liệu dòng tiền của 1 công ty. hasReal = có ít nhất 1 bản ghi thật.
 *  invoiceLines: các dòng hóa đơn đã upload của công ty — nguồn cho khối phân loại TT200. */
export async function fetchCashflowData(companyId) {
  if (!supabase || !companyId) return { receivables: [], payables: [], openingCash: 0, invoiceLines: [], hasReal: false };
  const [r1, r2, r3] = await Promise.all([
    supabase.from("receivables").select("*").eq("company_id", companyId).order("due_date"),
    supabase.from("payables").select("*").eq("company_id", companyId).order("due_date"),
    fetchOpening(companyId),
  ]);
  if (r1.error) throw r1.error;
  if (r2.error) throw r2.error;
  // dòng hóa đơn: lỗi ở đây không được làm sập phần còn lại
  let invoiceLines = [];
  try {
    const { data, error } = await supabase
      .from("invoice_lines")
      .select("net, vat, total, ck, pay, invoice_uploads!inner(company_id)")
      .eq("invoice_uploads.company_id", companyId);
    if (!error && data) invoiceLines = data.map((l) => ({ net: Number(l.net) || 0, vat: Number(l.vat) || 0, total: Number(l.total) || 0, ck: Number(l.ck) || 0, pay: l.pay || "" }));
  } catch { /* bỏ qua */ }
  const receivables = (r1.data || []).map(mapRecv);
  const payables = (r2.data || []).map(mapPay);
  const openingCash = Number(r3?.opening_cash) || 0;
  return {
    receivables, payables, openingCash, invoiceLines,
    openingAsOf: r3?.as_of || null,
    hasReal: receivables.length > 0 || payables.length > 0 || invoiceLines.length > 0 || !!r3,
  };
}

/** Số dư đang dùng = mốc gần nhất KHÔNG vượt quá hôm nay. Nhập trước cho kỳ sau thì
 *  mốc đó chưa được dùng cho tới đúng ngày, nếu không dự báo hôm nay chạy bằng số
 *  của tương lai. Lùi về bảng cũ nếu cơ sở dữ liệu chưa chạy migration 019. */
async function fetchOpening(companyId) {
  const today = new Date();
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const { data, error } = await supabase
    .from("cashflow_opening").select("opening_cash, as_of")
    .eq("company_id", companyId).lte("as_of", iso)
    .order("as_of", { ascending: false }).limit(1).maybeSingle();
  if (!error) return data || null;
  const fb = await supabase
    .from("cashflow_settings").select("opening_cash")
    .eq("company_id", companyId).maybeSingle();
  return fb.data || null;
}

/** Toàn bộ mốc số dư đã nhập, mới nhất trước. */
export async function listOpeningHistory(companyId) {
  if (!supabase || !companyId) return [];
  const { data, error } = await supabase
    .from("cashflow_opening").select("id, as_of, opening_cash, note")
    .eq("company_id", companyId).order("as_of", { ascending: false });
  if (error) return [];   // CSDL chưa chạy 019 → coi như chưa có lịch sử
  return data || [];
}

export async function deleteOpening(id) {
  const { error } = await db().from("cashflow_opening").delete().eq("id", id);
  if (error) throw error;
}

export async function addReceivable(companyId, { customer, amount, dueDate, customerEmail, customerPhone }) {
  const { error } = await db().from("receivables")
    .insert({ company_id: companyId, customer, amount, due_date: dueDate, customer_email: customerEmail || null, customer_phone: customerPhone || null });
  if (error) throw error;
}

export async function addPayable(companyId, { label, amount, dueDate, category }) {
  const { error } = await db().from("payables")
    .insert({ company_id: companyId, label, amount, due_date: dueDate, category: category || "other" });
  if (error) throw error;
}

export async function setReceivableStatus(id, status) {
  const { error } = await db().from("receivables").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function setPayableStatus(id, status) {
  const { error } = await db().from("payables").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function deleteReceivable(id) {
  const { error } = await db().from("receivables").delete().eq("id", id);
  if (error) throw error;
}

export async function deletePayable(id) {
  const { error } = await db().from("payables").delete().eq("id", id);
  if (error) throw error;
}

/** Ghi một MỐC số dư đầu kỳ. Cùng ngày thì sửa mốc đó, ngày khác thì thêm mốc mới —
 *  lịch sử giữ lại, không đè mất như bảng cashflow_settings cũ. */
export async function saveOpeningCash(companyId, openingCash, asOf) {
  if (!companyId) throw new Error("Chưa xác định được hồ sơ công ty — tải lại trang rồi thử lại");
  if (!asOf) throw new Error("Chưa chọn ngày cho số dư này");
  const { error } = await db().from("cashflow_opening")
    .upsert({ company_id: companyId, as_of: asOf, opening_cash: openingCash }, { onConflict: "company_id,as_of" });
  if (error) throw error;
}

/** Hóa đơn bán chịu (không thu tiền ngay) → tự sinh khoản phải thu, hạn mặc định +30 ngày. */
export async function addReceivablesFromInvoiceLines(companyId, lines) {
  if (!supabase || !companyId || !lines?.length) return 0;
  const isPaidNow = (pay) => /^(tm|tiền mặt|tien mat|cash|ck|chuyển khoản|chuyen khoan|bank|transfer)$/.test(String(pay || "").trim().toLowerCase());
  const due = new Date(); due.setDate(due.getDate() + 30);
  const dueStr = due.toISOString().slice(0, 10);
  const rows = lines
    .filter((l) => !isPaidNow(l.pay) && (Number(l.total) || 0) > 0)
    .map((l) => ({
      company_id: companyId,
      customer: l.buyer || `KH hóa đơn ${l.no || l.stt}`,
      amount: Number(l.total) || 0,
      due_date: dueStr,
      source: "invoice",
      invoice_no: l.no || "",
    }));
  if (!rows.length) return 0;
  const { error } = await db().from("receivables").insert(rows);
  if (error) throw error;
  return rows.length;
}
