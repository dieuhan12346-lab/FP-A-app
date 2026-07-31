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

/** Giá trị cho dòng khớp theo TÊN: bỏ qua ô trông giống MÃ SỐ/STT (số nguyên 1–3 chữ số),
 *  tránh nhặt nhầm "400" ở cột mã làm giá trị. */
function valueForLabel(row) {
  let start = -1;
  for (let j = 0; j < row.length; j++) if (/^\d{1,3}$/.test(String(row[j] ?? "").trim())) start = j;
  return valueAfter(row, start);
}

const MAP_OF = { CDKT, KQKD, LCTT };

/* Dò theo TÊN chỉ tiêu — cho file không có cột Mã số (bản xuất từ web dữ liệu, báo cáo tự lập).
   Thứ tự quan trọng: mẫu cụ thể đặt trước để không khớp nhầm dòng tổng quát. */
const LABEL_RULES = [
  // KQKD
  [/doanh thu thuan/, "doanhThu"],
  [/gia von hang ban/, "gvhb"],
  [/chi phi lai vay/, "chiPhiLaiVay"],
  [/loi nhuan thuan tu hoat dong kinh doanh/, "lnHDKD"],
  [/loi nhuan sau thue thu nhap doanh nghiep|loi nhuan sau thue(?! cua)/, "lnst"],
  // LCTT
  [/luu chuyen tien thuan tu hoat dong kinh doanh/, "dongTienHDKD"],
  // CĐKT
  [/tai san ngan han/, "tsNganHan"],
  [/phai thu (ngan han )?(cua )?khach hang/, "phaiThuKH"],
  [/hang ton kho/, "hangTonKho"],
  [/tong (cong )?tai san|tong cong nguon von/, "tongTaiSan"],
  [/no phai tra/, "tongNo"],
  [/no ngan han/, "noNganHan"],
  [/von chu so huu/, "vonCSH"],
];

const PERIOD_RE = /^(q[1-4]\s*[-/]?\s*\d{4}|\d{4}\s*[-/]?\s*q[1-4]|nam\s*\d{4}|quy\s*[1-4]|\d{4})$|so (cuoi nam|dau nam|cuoi ky)|nam nay|nam truoc/;

/* Dòng TỶ SỐ đã tính sẵn (bảng "Chỉ số tài chính") — KHÔNG phải số liệu gốc.
   Vd "Tỷ số Nợ trên tổng tài sản" = 35.32 sẽ khớp nhầm thành Tổng tài sản nếu không loại. */
const RATIO_LABEL_RE = /^(ty so|ty suat|chi so|he so|kha nang thanh toan|kha nang tra|thu nhap tren|gia tri so sach|vong quay|ky thu tien|bien loi nhuan|lai co ban|lai suy giam|eps|bvps|p\/e|p\/b|roa|roe)/;
/* Khoản mục dễ khớp nhầm: "LNST CHƯA PHÂN PHỐI" là lợi nhuận giữ lại trên Bảng cân đối
   (số thời điểm), KHÔNG phải LNST trong kỳ của KQKD. Loại trước khi dò theo tên. */
const LABEL_EXCLUDE = /chua phan phoi|luy ke|du phong|nguoi mua tra tien truoc|tra truoc cho nguoi ban|phai thu noi bo|phai thu khac|phai thu theo tien do/;
/* Bỏ tiền tố đánh số/mục lục: "A. ", "11. ", "I. ", "D ", "- " … để so khớp đúng phần tên. */
const stripLead = (s) => s.replace(/^[-•\s]*((so|muc)\s*)?([ivxlcdm]+|[a-z]|\d+)\s*[.)]\s*/i, "").replace(/^[a-z]\s+(?=[a-z])/i, "").trim();

/* Chỉ tiêu DÒNG CHẢY (phát sinh trong kỳ — KQKD/LCTT): số quý phải cộng 4 quý (TTM)
   mới so được với chỉ tiêu THỜI ĐIỂM của Bảng cân đối. Nếu không, DSO/vòng quay/ROA/ROE sai ~4 lần. */
const FLOW_FIELDS = new Set(["doanhThu", "gvhb", "chiPhiLaiVay", "lnHDKD", "lnst", "dongTienHDKD"]);
const isQuarter = (label) => /^q[1-4]\s*[-/]?\s*\d{4}|^\d{4}\s*[-/]?\s*q[1-4]|^quy\s*[1-4]/.test(norm(String(label)));

/** Tìm hàng tiêu đề kỳ (Q3-2025 | 2024 | Số cuối năm…) → [{idx,label}]. */
export function detectPeriods(rows) {
  for (const row of rows.slice(0, 12)) {
    const hits = [];
    for (let i = 1; i < row.length; i++) {
      const c = String(row[i] ?? "").trim();
      if (c && PERIOD_RE.test(norm(c))) hits.push({ idx: i, label: c });
    }
    if (hits.length >= 2) return hits;          // ≥2 cột kỳ → là hàng tiêu đề kỳ
  }
  return [];
}

/** Đọc BCTC từ Excel. Trả { values, periods }:
 *   - values: { tsNganHan, noNganHan, ... } (field nào không thấy thì bỏ trống)
 *   - periods: các kỳ tìm thấy (file nhiều kỳ theo cột) — UI cho chọn kỳ
 *  Hai cách dò, bổ trợ nhau: theo MÃ SỐ (mẫu TT200) và theo TÊN chỉ tiêu (file không có mã số).
 *  Dò theo TỪNG VÙNG: một sheet có thể chứa cả 3 báo cáo (gặp tiêu đề nào thì đổi bộ mã từ đó).
 *  periodIdx: chỉ số cột kỳ muốn lấy (mặc định: kỳ cuối = mới nhất). */
export function parseBCTC(buf, periodIdx = null) {
  const wb = XLSX.read(buf, { type: "buffer" });
  const out = {};
  let periods = [], ttm = false;
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: "" });
    const ps = detectPeriods(rows);
    if (ps.length > periods.length) periods = ps;
    // Cột giá trị muốn lấy: kỳ người dùng chọn, mặc định kỳ cuối (mới nhất).
    const col = ps.length ? (periodIdx != null && ps[periodIdx] ? ps[periodIdx].idx : ps[ps.length - 1].idx) : null;
    // Số liệu theo QUÝ + đủ 4 quý → chỉ tiêu dòng chảy lấy TỔNG 4 quý gần nhất (TTM).
    const end = ps.length ? (periodIdx != null && ps[periodIdx] ? periodIdx : ps.length - 1) : -1;
    const useTTM = periodIdx == null && ps.length >= 4 && ps.slice(-4).every((p) => isQuarter(p.label));
    const ttmCols = useTTM ? ps.slice(end - 3, end + 1).map((p) => p.idx) : null;
    if (useTTM) ttm = true;
    const valAt = (row, field) => {
      if (ttmCols && FLOW_FIELDS.has(field)) {                 // cộng 4 quý cho chỉ tiêu dòng chảy
        let s = 0, got = false;
        for (const c of ttmCols) { const v = toNumBCTC(row[c]); if (v != null) { s += v; got = true; } }
        return got ? Math.round(s * 100) / 100 : null;
      }
      return col != null ? toNumBCTC(row[col]) : null;
    };
    // Loại báo cáo mặc định của sheet (theo tên sheet + vài dòng đầu); có thể đổi giữa chừng.
    let type = detectType(name) || detectType(rows.slice(0, 8).map((r) => r.join(" ")).join(" "));
    for (const row of rows) {
      const t2 = headingType(row);
      if (t2) { type = t2; continue; }                       // dòng tiêu đề báo cáo → đổi vùng
      // 1) Dò theo mã số. Chưa biết loại báo cáo → chỉ dùng mã KHÔNG trùng (bỏ mã 20).
      const useMap = type ? MAP_OF[type] : { ...CDKT, ...KQKD };
      let matched = false;
      for (let i = 0; i < row.length; i++) {
        const code = String(row[i] ?? "").trim();
        const field = useMap[code];
        if (field) {
          matched = true;
          if (out[field] == null) {
            const val = col != null ? valAt(row, field) : valueAfter(row, i);
            if (val != null) out[field] = val;
          }
        }
      }
      // 2) Không có mã số → dò theo TÊN chỉ tiêu (ô đầu tiên có chữ).
      if (!matched) {
        const raw = norm(row.find((c) => String(c ?? "").trim() && !/^-?[\d.,()]+$/.test(String(c).trim())) || "");
        const label = stripLead(raw);
        if (label.length >= 6 && !RATIO_LABEL_RE.test(label) && !LABEL_EXCLUDE.test(label)) {   // bỏ dòng tỷ số & khoản dễ nhầm
          for (const [re, field] of LABEL_RULES) {
            if (out[field] == null && re.test(label)) {
              const val = col != null ? valAt(row, field) : valueForLabel(row);
              if (val != null) { out[field] = val; }
              break;                                          // mỗi dòng chỉ khớp 1 chỉ tiêu
            }
          }
        }
      }
    }
  }
  return { values: out, periods, ttm };
}
