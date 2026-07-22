import { supabase } from "./supabase";

/* ---- Giao dịch tiền thật: lưu / tải / xoá lô nhập (từ sổ quỹ ERP) ---- */

function db() {
  if (!supabase) throw new Error("Bản dựng này chưa cấu hình Supabase — kiểm tra VITE_SUPABASE_URL và VITE_SUPABASE_ANON_KEY.");
  return supabase;
}

const mapTxn = (r) => ({
  id: r.id,
  date: r.txn_date,
  amtIn: Number(r.amount_in) || 0,
  amtOut: Number(r.amount_out) || 0,
  balance: r.balance == null ? null : Number(r.balance),
  account: r.account || "",
  voucherNo: r.voucher_no || "",
  desc: r.description || "",
  note: r.note || "",
  importId: r.import_id,
  sourceFile: r.source_file || "",
});

/** Lưu một lô giao dịch đã parse từ file sổ quỹ. Trả về { importId, count }. */
export async function saveLedgerImport(companyId, { sourceFile = "", account = "" } = {}, txns = []) {
  if (!companyId) throw new Error("Chưa xác định được hồ sơ công ty — tải lại trang rồi thử lại.");
  if (!txns.length) return { importId: null, count: 0 };
  const importId = (globalThis.crypto?.randomUUID?.() || `imp_${Date.now()}_${Math.random().toString(36).slice(2)}`);
  const rows = txns.map((t) => ({
    company_id: companyId,
    txn_date: t.date,
    amount_in: Number(t.amtIn) || 0,
    amount_out: Number(t.amtOut) || 0,
    balance: t.balance == null ? null : Number(t.balance),
    account: t.account || account || null,
    voucher_no: t.voucherNo || null,
    description: t.desc || null,
    note: t.note || null,
    source: "ledger_import",
    source_file: sourceFile || null,
    import_id: importId,
  }));
  const { error } = await db().from("transactions").insert(rows);
  if (error) throw error;
  return { importId, count: rows.length };
}

/** Tải toàn bộ giao dịch của hồ sơ công ty (cũ → mới), đã map. */
export async function fetchTransactions(companyId) {
  if (!supabase || !companyId) return [];
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("company_id", companyId)
    .order("txn_date", { ascending: true });
  if (error) throw error;
  return (data || []).map(mapTxn);
}

/** Danh sách các lô đã nhập (mới nhất trước) — để hiển thị/xoá. */
export async function listLedgerImports(companyId) {
  if (!supabase || !companyId) return [];
  const { data, error } = await supabase
    .from("transactions")
    .select("import_id, source_file, txn_date, created_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const byImport = new Map();
  for (const r of data || []) {
    if (!r.import_id) continue;
    const g = byImport.get(r.import_id) || { importId: r.import_id, sourceFile: r.source_file || "", createdAt: r.created_at, count: 0, from: r.txn_date, to: r.txn_date };
    g.count++;
    if (r.txn_date < g.from) g.from = r.txn_date;
    if (r.txn_date > g.to) g.to = r.txn_date;
    byImport.set(r.import_id, g);
  }
  return [...byImport.values()];
}

/** Xoá một lô đã nhập. */
export async function deleteLedgerImport(importId) {
  if (!importId) return;
  const { error } = await db().from("transactions").delete().eq("import_id", importId);
  if (error) throw error;
}

/** Gom giao dịch thành chuỗi thu/chi theo tuần (đơn vị TRIỆU) cho dự báo.
 *  Trả về { weeks: [{weekStart, inflow, outflow, net}], firstDate, lastDate }. */
export function weeklySeriesFromTxns(txns, { toMillions = true } = {}) {
  if (!txns.length) return { weeks: [], firstDate: null, lastDate: null };
  const scale = toMillions ? 1e6 : 1;
  // Toàn bộ mốc ngày tính bằng UTC để toISOString không lùi ngày theo múi giờ máy.
  const monday = (iso) => {
    const d = new Date(iso + "T00:00:00Z");
    const dow = (d.getUTCDay() + 6) % 7; // 0 = thứ Hai
    d.setUTCDate(d.getUTCDate() - dow);
    return d.toISOString().slice(0, 10);
  };
  const sorted = [...txns].sort((a, b) => (a.date < b.date ? -1 : 1));
  const map = new Map();
  for (const t of sorted) {
    const w = monday(t.date);
    const g = map.get(w) || { weekStart: w, inflow: 0, outflow: 0 };
    g.inflow += (Number(t.amtIn) || 0) / scale;
    g.outflow += (Number(t.amtOut) || 0) / scale;
    map.set(w, g);
  }
  // điền tuần trống giữa first..last để chuỗi liên tục (mô hình cần đều nhịp)
  const first = monday(sorted[0].date), last = monday(sorted[sorted.length - 1].date);
  const weeks = [];
  for (let d = new Date(first + "T00:00:00Z"); d.toISOString().slice(0, 10) <= last; d.setUTCDate(d.getUTCDate() + 7)) {
    const w = d.toISOString().slice(0, 10);
    const g = map.get(w) || { weekStart: w, inflow: 0, outflow: 0 };
    weeks.push({ ...g, net: g.inflow - g.outflow });
  }
  return { weeks, firstDate: sorted[0].date, lastDate: sorted[sorted.length - 1].date };
}
