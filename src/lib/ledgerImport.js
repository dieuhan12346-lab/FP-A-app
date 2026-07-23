/* ============================================================
   Nhập sổ quỹ / sổ cái tiền từ file xuất ERP (ưu tiên MISA · TT200).
   Đích chính: Sổ quỹ tiền mặt S07-DN và Sổ chi tiết TK 111/112.
   Cho ra chuỗi giao dịch tiền THẬT theo ngày → nguồn cho dự báo dòng tiền.

   Thuần dữ liệu (nhận AOA từ SheetJS), không import React/XLSX để test được ở Node.
   ============================================================ */

export const norm = (s) => String(s == null ? "" : s).trim().toLowerCase().replace(/\s+/g, " ");

/* số kiểu VN: '1.234.567,89' hoặc '1,234,567.89' hoặc '1234567' */
export function toNum(v) {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return isFinite(v) ? v : 0;
  let s = String(v).trim();
  const neg = /^\(.*\)$/.test(s) || /-$/.test(s); // (1.000) hoặc 1.000-
  s = s.replace(/[^\d,.-]/g, "");
  if (!s) return 0;
  let n;
  if (s.indexOf(",") >= 0 && s.indexOf(".") >= 0) {
    // dấu nào ở sau cùng là thập phân
    n = s.lastIndexOf(",") > s.lastIndexOf(".")
      ? parseFloat(s.replace(/\./g, "").replace(",", "."))
      : parseFloat(s.replace(/,/g, ""));
  } else if (s.indexOf(",") >= 0) {
    // chỉ có phẩy: nếu đứng cách đuôi 3 số → nghìn (bỏ), ngược lại thập phân
    n = /,\d{3}(\D|$)/.test(s + " ") && !/,\d{1,2}$/.test(s)
      ? parseFloat(s.replace(/,/g, ""))
      : parseFloat(s.replace(",", "."));
  } else {
    n = parseFloat(s.replace(/(?<=\d)\.(?=\d{3}(\D|$))/g, ""));
  }
  if (!isFinite(n)) return 0;
  return neg ? -Math.abs(n) : n;
}

/* ngày: Excel serial (số) hoặc chuỗi dd/mm/yyyy, yyyy-mm-dd → 'yyyy-mm-dd' | null */
export function parseDateCell(v) {
  if (v == null || v === "") return null;
  if (typeof v === "number") {
    if (v > 20000 && v < 90000) {           // vùng serial hợp lý (~1954–2146)
      const d = new Date(Math.round((v - 25569) * 86400000));
      return isNaN(d) ? null : d.toISOString().slice(0, 10);
    }
    return null;
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/); // dd/mm/yyyy
  if (m) {
    let [, d, mo, y] = m; if (y.length === 2) y = "20" + y;
    if (+mo >= 1 && +mo <= 12 && +d >= 1 && +d <= 31)
      return `${y}-${String(+mo).padStart(2, "0")}-${String(+d).padStart(2, "0")}`;
  }
  m = s.match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})$/);       // yyyy-mm-dd
  if (m) return `${m[1]}-${String(+m[2]).padStart(2, "0")}-${String(+m[3]).padStart(2, "0")}`;
  return null;
}

/* alias tiêu đề cột (chuẩn hoá) → field. Bao cả sổ quỹ (Thu/Chi) và sổ cái TK (Nợ/Có). */
export const LEDGER_ALIAS = {
  postDate: ["ngày, tháng ghi sổ", "ngày tháng ghi sổ", "ngày ghi sổ", "ngày gs", "ngày hạch toán", "posting date", "ngày", "date", "trans date", "txn date"],
  docDate:  ["ngày, tháng chứng từ", "ngày tháng chứng từ", "ngày chứng từ", "ngày ct", "ngày ct gốc", "document date", "voucher date"],
  voucherNo:["số hiệu chứng từ", "số hiệu ct", "số chứng từ", "số ct", "số phiếu", "số ct thu", "số ct chi", "voucher no", "số hiệu", "journal reference", "reference", "ref", "ref no", "doc no", "document number", "document no", "belegnummer", "beleg", "journal entry", "assignment", "je no"],
  desc:     ["diễn giải", "nội dung", "nội dung kinh tế", "description", "memo", "details", "narration", "text", "item text", "buchungstext", "sgtxt"],
  amountGroup: ["số tiền", "amount", "transaction"],
  in:  ["thu", "phát sinh nợ", " psnợ", "ghi nợ", "nợ", "phát sinh thu", "tiền thu", "thu vào", "debit", "receipt", "phát sinh nợ (thu)", "soll", "sollbetrag", "debit amount", "money in", "paid in"],
  out: ["chi", "phát sinh có", "psng có", "phát sinh có ", "ghi có", "có", "phát sinh chi", "tiền chi", "chi ra", "credit", "payment", "phát sinh có (chi)", "haben", "habenbetrag", "credit amount", "money out", "paid out", "withdrawal"],
  bal: ["tồn", "số dư", "số dư cuối", "số dư cuối kỳ", "luỹ kế", "lũy kế", "balance", "số tồn", "cumulative balance", "running balance", "saldo"],
  note: ["ghi chú", "note", "remark", "ghi chú "],
  // SAP FBL3N / sao kê: một cột số tiền có dấu + cột chỉ báo Nợ/Có (S/H, D/C)
  amount: ["amount", "amount in local currency", "amount in doc. curr.", "amount in doc currency", "betrag", "amount (lc)", "lc amount", "amount in lc"],
  dc: ["d/c", "debit/credit", "debit/credit ind", "s/h", "soll/haben", "dr/cr", "d/c ind"],
};

const OPENING_RE = /(số dư|tồn|dư)\s*(đầu)/i;                 // "Số dư đầu kỳ", "Tồn đầu kỳ"
const CLOSING_RE = /(số dư|tồn|dư)\s*(cuối)/i;               // "Số dư cuối kỳ"
const TOTAL_RE   = /^(cộng|tổng cộng|cộng phát sinh|cộng số phát sinh)/i;
const FOOTER_RE  = /(sổ này có|người ghi sổ|kế toán trưởng|người lập|giám đốc|người đại diện|ngày.*tháng.*năm)/i;

function matchField(cellNorm, field) {
  return LEDGER_ALIAS[field].some((a) => cellNorm === a);
}
function isCodeRow(cells) {
  const nonEmpty = cells.filter((c) => String(c).trim() !== "");
  return nonEmpty.length >= 2 && nonEmpty.every((c) => /^[a-zA-Z0-9]{1,2}$/.test(String(c).trim()));
}

/* Tìm dòng tiêu đề: dòng đầu tiên (quét ≤30) khớp ≥2 field neo. */
function findHeaderRow(aoa) {
  const anchors = ["postDate", "docDate", "desc", "voucherNo", "amountGroup", "in", "out", "amount"];
  for (let i = 0; i < Math.min(aoa.length, 30); i++) {
    const cells = (aoa[i] || []).map(norm);
    let hit = 0;
    for (const f of anchors) if (cells.some((c) => matchField(c, f))) hit++;
    if (hit >= 2 && cells.some((c) => matchField(c, "postDate") || matchField(c, "docDate")) &&
        cells.some((c) => matchField(c, "desc") || matchField(c, "amountGroup") || matchField(c, "in") || matchField(c, "out") || matchField(c, "amount"))) return i;
  }
  return -1;
}

/* Dựng chỉ mục cột. Xử lý header 2 tầng: nhóm "Số tiền" (dòng h) + phụ Thu/Chi/Tồn (dòng h+1). */
export function buildLedgerColIndex(aoa, hRow) {
  const head = (aoa[hRow] || []).map(norm);
  const idx = {};
  for (const f of ["postDate", "docDate", "voucherNo", "desc", "amountGroup", "in", "out", "bal", "note", "amount", "dc"]) {
    for (let j = 0; j < head.length; j++) if (matchField(head[j], f)) { idx[f] = j; break; }
  }
  let usedSub = false;
  if (idx.in == null || idx.out == null) {
    const sub = (aoa[hRow + 1] || []).map(norm);
    const from = idx.amountGroup != null ? idx.amountGroup : 0;
    for (let j = from; j < sub.length; j++) {
      if (idx.in == null && matchField(sub[j], "in")) { idx.in = j; usedSub = true; }
      else if (idx.out == null && matchField(sub[j], "out")) { idx.out = j; usedSub = true; }
      else if (idx.bal == null && matchField(sub[j], "bal")) { idx.bal = j; usedSub = true; }
    }
  }
  return { idx, usedSub };
}

/* Parse AOA sổ quỹ/sổ cái → { ok, headerRow, colIndex, openingBalance, transactions[], columns } */
export function parseLedger(aoa) {
  if (!aoa || !aoa.length) return { ok: false, reason: "empty", headerRow: -1, colIndex: {}, transactions: [], columns: [] };
  const hRow = findHeaderRow(aoa);
  if (hRow < 0) return { ok: false, reason: "no-header", headerRow: -1, colIndex: {}, transactions: [], columns: [] };
  const { idx, usedSub } = buildLedgerColIndex(aoa, hRow);
  const columns = (aoa[hRow] || []).map((c, j) => ({ j, label: String(c).replace(/[\r\n]+/g, " ").trim() }));

  if ((idx.in == null && idx.out == null && idx.amount == null) || idx.postDate == null && idx.docDate == null) {
    return { ok: false, reason: "unmapped", headerRow: hRow, colIndex: idx, transactions: [], columns, usedSub };
  }

  let start = hRow + (usedSub ? 2 : 1);
  if (isCodeRow((aoa[start] || []).map((c) => String(c).trim()))) start++; // bỏ dòng mã A/B/1/2…

  const { transactions, openingBalance } = extractTransactions(aoa, start, idx);
  return { ok: true, headerRow: hRow, start, colIndex: idx, usedSub, openingBalance, transactions, columns };
}

/* Trích giao dịch từ AOA khi đã biết dòng bắt đầu + chỉ mục cột.
   Dùng chung cho auto-detect và map cột thủ công (UI cho người dùng gán lại cột). */
export function extractTransactions(aoa, start, idx) {
  const dateCol = idx.postDate != null ? idx.postDate : idx.docDate;
  const dateColB = idx.docDate != null ? idx.docDate : idx.postDate;
  const transactions = [];
  let openingBalance = null;
  for (let i = start; i < aoa.length; i++) {
    const row = aoa[i] || [];
    const cell = (j) => (j == null ? "" : row[j]);
    const descRaw = String(cell(idx.desc)).replace(/[\r\n]+/g, " ").trim();
    if (FOOTER_RE.test(descRaw)) break;                       // tới chân sổ → dừng
    let amtIn = 0, amtOut = 0;
    if (idx.in != null || idx.out != null) {
      amtIn = idx.in != null ? toNum(cell(idx.in)) : 0;
      amtOut = idx.out != null ? toNum(cell(idx.out)) : 0;
    } else if (idx.amount != null) {
      // SAP FBL3N / sao kê: 1 cột số tiền có dấu (+ chỉ báo Nợ/Có). Soll/S/Debit/D → tiền vào.
      const raw = toNum(cell(idx.amount));
      const ind = idx.dc != null ? norm(cell(idx.dc)) : "";
      const debit = ind ? /^(s|d)/.test(ind) : raw >= 0;
      if (debit) amtIn = Math.abs(raw); else amtOut = Math.abs(raw);
    }
    const bal = idx.bal != null ? toNum(cell(idx.bal)) : null;

    if (OPENING_RE.test(descRaw)) { if (openingBalance == null) openingBalance = bal != null ? bal : amtIn; continue; }
    if (CLOSING_RE.test(descRaw) || TOTAL_RE.test(descRaw)) continue;

    const date = parseDateCell(cell(dateCol)) || parseDateCell(cell(dateColB));
    if (!date) continue;                                      // dòng không có ngày hợp lệ → bỏ
    if (amtIn === 0 && amtOut === 0) continue;                // không phát sinh → bỏ
    transactions.push({
      date,
      amtIn: Math.abs(amtIn),
      amtOut: Math.abs(amtOut),
      balance: bal,
      voucherNo: String(cell(idx.voucherNo) || (idx.voucherNo != null ? cell(idx.voucherNo + 1) : "") || "").trim(),
      desc: descRaw,
      note: String(cell(idx.note) || "").trim(),
    });
  }
  return { transactions, openingBalance };
}
