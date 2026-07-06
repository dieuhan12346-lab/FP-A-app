import { supabase } from "./supabase";

/* ---- Đọc hóa đơn: lưu / tải kết quả parse ---- */

/** Lưu 1 lần upload + các dòng hóa đơn. Trả về upload id, hoặc null nếu chưa cấu hình. */
export async function saveInvoiceUpload(fileName, meta, lines) {
  if (!supabase) return null;
  const { data: up, error: e1 } = await supabase
    .from("invoice_uploads")
    .insert({ file_name: fileName, header_row: meta.headerRow, cols: meta.cols, mapped: meta.mapped })
    .select("id")
    .single();
  if (e1) throw e1;
  const rows = lines.map((l) => ({
    upload_id: up.id,
    stt: l.stt, date: l.date, serial: l.serial, no: l.no,
    buyer_tax: l.buyerTax, buyer: l.buyer, item: l.item, unit: l.unit,
    qty: l.qty, price: l.price, amount: l.amount,
    ck_rate: l.ckRate, ck: l.ck, net: l.net,
    vat_rate: l.vatRate, vat: l.vat, total: l.total, pay: l.pay,
  }));
  const { error: e2 } = await supabase.from("invoice_lines").insert(rows);
  if (e2) throw e2;
  return up.id;
}

/** Tải lần upload gần nhất của user (kèm các dòng), hoặc null. */
export async function loadLatestInvoiceUpload() {
  if (!supabase) return null;
  const { data: up, error: e1 } = await supabase
    .from("invoice_uploads")
    .select("id, file_name, header_row, cols, mapped")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (e1) throw e1;
  if (!up) return null;
  const { data: rows, error: e2 } = await supabase
    .from("invoice_lines")
    .select("*")
    .eq("upload_id", up.id)
    .order("stt", { ascending: true });
  if (e2) throw e2;
  const lines = (rows || []).map((r) => ({
    stt: r.stt, date: r.date || "", serial: r.serial || "", no: r.no || "",
    buyerTax: r.buyer_tax || "", buyer: r.buyer || "", item: r.item || "", unit: r.unit || "",
    qty: Number(r.qty) || 0, price: Number(r.price) || 0, amount: Number(r.amount) || 0,
    ckRate: Number(r.ck_rate) || 0, ck: Number(r.ck) || 0, net: Number(r.net) || 0,
    vatRate: Number(r.vat_rate) || 0, vat: Number(r.vat) || 0, total: Number(r.total) || 0,
    pay: r.pay || "",
  }));
  return { meta: { name: up.file_name, headerRow: up.header_row, cols: up.cols, mapped: up.mapped }, lines };
}
