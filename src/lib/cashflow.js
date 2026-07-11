import { supabase } from "./supabase";

/* ---- Dòng tiền thật: phải thu / phải chi / số dư đầu kỳ (theo từng công ty) ---- */

const mapRecv = (r) => ({
  id: r.id, customer: r.customer, amount: Number(r.amount) || 0,
  dueDate: r.due_date, status: r.status, source: r.source, invoiceNo: r.invoice_no || "",
});
const mapPay = (p) => ({
  id: p.id, label: p.label, amount: Number(p.amount) || 0,
  dueDate: p.due_date, status: p.status,
});

/** Toàn bộ dữ liệu dòng tiền của 1 công ty. hasReal = có ít nhất 1 bản ghi thật. */
export async function fetchCashflowData(companyId) {
  if (!supabase || !companyId) return { receivables: [], payables: [], openingCash: 0, hasReal: false };
  const [r1, r2, r3] = await Promise.all([
    supabase.from("receivables").select("*").eq("company_id", companyId).order("due_date"),
    supabase.from("payables").select("*").eq("company_id", companyId).order("due_date"),
    supabase.from("cashflow_settings").select("opening_cash").eq("company_id", companyId).maybeSingle(),
  ]);
  if (r1.error) throw r1.error;
  if (r2.error) throw r2.error;
  if (r3.error) throw r3.error;
  const receivables = (r1.data || []).map(mapRecv);
  const payables = (r2.data || []).map(mapPay);
  const openingCash = Number(r3.data?.opening_cash) || 0;
  return { receivables, payables, openingCash, hasReal: receivables.length > 0 || payables.length > 0 || !!r3.data };
}

export async function addReceivable(companyId, { customer, amount, dueDate }) {
  const { error } = await supabase.from("receivables")
    .insert({ company_id: companyId, customer, amount, due_date: dueDate });
  if (error) throw error;
}

export async function addPayable(companyId, { label, amount, dueDate }) {
  const { error } = await supabase.from("payables")
    .insert({ company_id: companyId, label, amount, due_date: dueDate });
  if (error) throw error;
}

export async function setReceivableStatus(id, status) {
  const { error } = await supabase.from("receivables").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function setPayableStatus(id, status) {
  const { error } = await supabase.from("payables").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function deleteReceivable(id) {
  const { error } = await supabase.from("receivables").delete().eq("id", id);
  if (error) throw error;
}

export async function deletePayable(id) {
  const { error } = await supabase.from("payables").delete().eq("id", id);
  if (error) throw error;
}

export async function saveOpeningCash(companyId, openingCash) {
  const { error } = await supabase.from("cashflow_settings")
    .upsert({ company_id: companyId, opening_cash: openingCash, updated_at: new Date().toISOString() });
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
  const { error } = await supabase.from("receivables").insert(rows);
  if (error) throw error;
  return rows.length;
}
