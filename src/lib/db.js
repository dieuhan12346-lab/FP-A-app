import { supabase } from "./supabase";

/* ---- Đọc hóa đơn: lưu / tải / lịch sử kết quả parse ---- */

/** Lưu 1 lần upload + các dòng hóa đơn, gắn theo hồ sơ công ty đang dùng.
 *  Trả về upload id, hoặc null nếu chưa cấu hình. */
export async function saveInvoiceUpload(fileName, meta, lines, companyId) {
  if (!supabase) return null;
  const { data: up, error: e1 } = await supabase
    .from("invoice_uploads")
    .insert({ file_name: fileName, header_row: meta.headerRow, cols: meta.cols, mapped: meta.mapped, company_id: companyId || null })
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

function mapLine(r) {
  return {
    stt: r.stt, date: r.date || "", serial: r.serial || "", no: r.no || "",
    buyerTax: r.buyer_tax || "", buyer: r.buyer || "", item: r.item || "", unit: r.unit || "",
    qty: Number(r.qty) || 0, price: Number(r.price) || 0, amount: Number(r.amount) || 0,
    ckRate: Number(r.ck_rate) || 0, ck: Number(r.ck) || 0, net: Number(r.net) || 0,
    vatRate: Number(r.vat_rate) || 0, vat: Number(r.vat) || 0, total: Number(r.total) || 0,
    pay: r.pay || "",
  };
}

async function fetchUploadWithLines(up) {
  const { data: rows, error } = await supabase
    .from("invoice_lines")
    .select("*")
    .eq("upload_id", up.id)
    .order("stt", { ascending: true });
  if (error) throw error;
  return {
    id: up.id,
    meta: { name: up.file_name, headerRow: up.header_row, cols: up.cols, mapped: up.mapped },
    lines: (rows || []).map(mapLine),
  };
}

/** Tải lần upload gần nhất CỦA HỒ SƠ CÔNG TY đang dùng (kèm các dòng), hoặc null.
 *  Hồ sơ mới chưa có upload nào → trả null → lịch sử trống. */
export async function loadLatestInvoiceUpload(companyId) {
  if (!supabase || !companyId) return null;
  const { data: up, error } = await supabase
    .from("invoice_uploads")
    .select("id, file_name, header_row, cols, mapped")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!up) return null;
  return fetchUploadWithLines(up);
}

/** Danh sách các lần upload của hồ sơ công ty (mới nhất trước, kèm số dòng). */
export async function listInvoiceUploads(companyId) {
  if (!supabase || !companyId) return [];
  const { data, error } = await supabase
    .from("invoice_uploads")
    .select("id, file_name, created_at, invoice_lines(count)")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) throw error;
  return (data || []).map((r) => ({
    id: r.id,
    fileName: r.file_name,
    createdAt: r.created_at,
    lineCount: (r.invoice_lines && r.invoice_lines[0] && r.invoice_lines[0].count) || 0,
  }));
}

/** Mở lại 1 lần upload trong lịch sử (kèm các dòng). */
export async function loadInvoiceUpload(uploadId) {
  if (!supabase) return null;
  const { data: up, error } = await supabase
    .from("invoice_uploads")
    .select("id, file_name, header_row, cols, mapped")
    .eq("id", uploadId)
    .single();
  if (error) throw error;
  return fetchUploadWithLines(up);
}

/** Xóa 1 lần upload (các dòng hóa đơn xóa theo nhờ FK cascade). */
export async function deleteInvoiceUpload(uploadId) {
  if (!supabase) return;
  const { error } = await supabase.from("invoice_uploads").delete().eq("id", uploadId);
  if (error) throw error;
}
