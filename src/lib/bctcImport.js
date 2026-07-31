import * as XLSX from "xlsx";

/* Đọc BCTC từ Excel (MISA/Fast/mẫu TT200) → map các mã số cần cho chấm điểm tín dụng.
   Mã số TRÙNG giữa các báo cáo (vd mã 20: KQKD "LN gộp" ≠ LCTT "Dòng tiền HĐKD") nên
   phải xác định từng sheet thuộc báo cáo nào rồi mới lấy đúng mã. */

// mã số → field, theo từng loại báo cáo
const CDKT = { "100": "tsNganHan", "131": "phaiThuKH", "140": "hangTonKho", "270": "tongTaiSan", "300": "tongNo", "310": "noNganHan", "410": "vonCSH" };
const KQKD = { "10": "doanhThu", "11": "gvhb", "23": "chiPhiLaiVay", "30": "lnHDKD", "60": "lnst" };
const LCTT = { "20": "dongTienHDKD" };

const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d");

/** Parse số kiểu VN/US, ngoặc đơn = âm; ô số của XLSX vốn đã là number. */
export function toNumBCTC(v) {
  if (v == null || v === "") return null;
  if (typeof v === "number") return isFinite(v) ? v : null;
  let s = String(v).trim();
  if (!/\d/.test(s)) return null;
  let neg = /^\(.*\)$/.test(s);
  if (neg) s = s.slice(1, -1);
  if (/^-/.test(s)) neg = true;
  s = s.replace(/[^\d.,]/g, "");
  const lc = s.lastIndexOf(","), ld = s.lastIndexOf(".");
  if (lc > -1 && ld > -1) s = lc > ld ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  else if (lc > -1) { const after = s.length - lc - 1; s = (after <= 2 && (s.match(/,/g) || []).length === 1) ? s.replace(",", ".") : s.replace(/,/g, ""); }
  else { const p = s.split("."); if (p.length > 2 || (p.length === 2 && p[1].length === 3)) s = s.replace(/\./g, ""); }
  const n = parseFloat(s);
  if (!isFinite(n)) return null;
  return neg ? -Math.abs(n) : n;
}

function detectType(text) {
  const s = norm(text);
  if (/bao cao luu chuyen tien|luu chuyen tien te/.test(s)) return "LCTT";
  if (/ket qua (hoat dong )?kinh doanh|bao cao ket qua/.test(s)) return "KQKD";
  if (/can doi ke toan|bang can doi/.test(s)) return "CDKT";
  return null;
}

/** Dòng TIÊU ĐỀ báo cáo: khớp tên báo cáo VÀ không phải dòng dữ liệu (không có mã số + số tiền). */
function headingType(row) {
  const t = detectType(row.join(" "));
  if (!t) return null;
  const cells = row.map((c) => String(c ?? "").trim()).filter(Boolean);
  const hasCode = cells.some((c) => /^\d{2,3}$/.test(c));
  const hasNum = cells.some((c) => { const n = toNumBCTC(c); return n != null && Math.abs(n) >= 1000; });
  return hasCode && hasNum ? null : t;   // có cả mã lẫn số → là dòng dữ liệu, không phải tiêu đề
}

/** Giá trị của một dòng: ô SỐ đầu tiên sau cột mã (bỏ qua thuyết minh dạng "V.01"). */
function valueAfter(row, codeIdx) {
  for (let j = codeIdx + 1; j < row.length; j++) {
    const n = toNumBCTC(row[j]);
    if (n != null && Math.abs(n) >= 1) return n;   // bỏ số nhỏ như số thuyết minh 1..99? -> giữ ngưỡng nhẹ
  }
  return null;
}

const MAP_OF = { CDKT, KQKD, LCTT };

/** Trả về { tsNganHan, noNganHan, ... } từ buffer Excel. Field nào không tìm thấy thì bỏ trống.
 *  Dò theo TỪNG VÙNG: một sheet có thể chứa cả 3 báo cáo (gặp tiêu đề nào thì đổi bộ mã từ đó). */
export function parseBCTC(buf) {
  const wb = XLSX.read(buf, { type: "buffer" });
  const out = {};
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: "" });
    // Loại báo cáo mặc định của sheet (theo tên sheet + vài dòng đầu); có thể đổi giữa chừng.
    let type = detectType(name) || detectType(rows.slice(0, 8).map((r) => r.join(" ")).join(" "));
    for (const row of rows) {
      const t2 = headingType(row);
      if (t2) { type = t2; continue; }                       // dòng tiêu đề báo cáo → đổi vùng
      // Chưa biết loại → dùng các mã KHÔNG trùng nhau (bỏ mã 20 để không nhầm KQKD/LCTT).
      const useMap = type ? MAP_OF[type] : { ...CDKT, ...KQKD };
      for (let i = 0; i < row.length; i++) {
        const code = String(row[i] ?? "").trim();
        const field = useMap[code];
        if (field && out[field] == null) {
          const val = valueAfter(row, i);
          if (val != null) out[field] = val;
        }
      }
    }
  }
  return out;
}
