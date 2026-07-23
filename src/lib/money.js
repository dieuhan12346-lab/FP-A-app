import { convert } from "./rates";

const LOCALE = { VND: "vi-VN", USD: "en-US", SGD: "en-SG", GBP: "en-GB", AUD: "en-AU", EUR: "de-DE", JPY: "ja-JP" };
const SYMBOL = { VND: "₫", USD: "$", SGD: "S$", GBP: "£", AUD: "A$", EUR: "€", JPY: "¥" };
const SUFFIX_CURRENCY = new Set(["VND"]); // ký hiệu đứng sau số (kiểu VN): "1.000.000 ₫"

/* Hai đơn vị KHÁC NHAU, đừng lẫn:
 *   books   = đơn vị sổ sách ghi — hóa đơn VN ghi VND, hóa đơn Mỹ ghi USD (suy từ quốc gia hồ sơ).
 *   display = đơn vị muốn xem (company.currency).
 * Mặc định books="VND" giữ nguyên hành vi cũ cho mọi chỗ chưa truyền. */

/** Số tiền nguyên (không phải triệu) ghi bằng `books` → chuỗi theo `display`. */
export function fmtMoney(amount, display = "VND", books = "VND") {
  const locale = LOCALE[display] || "en-US";
  const symbol = SYMBOL[display] || display + " ";
  const v = convert(amount, books, display);
  const n = Math.round(v).toLocaleString(locale);
  return SUFFIX_CURRENCY.has(display) ? `${n} ${symbol}` : `${symbol}${n}`;
}

/** Ký hiệu tiền tệ theo mã: VND→₫, USD→$, GBP→£… (mã lạ → chính mã đó). */
export function moneySymbol(cur = "VND") { return SYMBOL[cur] || cur; }

/** Số đã tính theo TRIỆU đơn vị sổ sách → chuỗi tiền tệ đầy đủ. */
export function fmtMoneyM(amountInMillions, display = "VND", books = "VND") {
  return fmtMoney((Number(amountInMillions) || 0) * 1e6, display, books);
}

/** Số tiền nguyên → dạng rút gọn: "12.180.000 ₫" → "12,18 tr" / "$463.5". */
export function fmtMoneyCompactM(amount, display = "VND", books = "VND") {
  if (display === "VND" && books === "VND") {
    const n = ((Number(amount) || 0) / 1e6).toLocaleString("vi-VN", { maximumFractionDigits: 2 });
    return `${n} tr`;
  }
  return compactForeign(convert(amount, books, display), display);
}

/** Số đã tính theo TRIỆU đơn vị sổ sách → dạng gọn: 150 → "150 tr" / "$5.7K". */
export function fmtCompactM(amountInMillions, display = "VND", opts = {}, books = "VND") {
  if (display === "VND" && books === "VND") {
    const n = (Number(amountInMillions) || 0).toLocaleString("vi-VN", { maximumFractionDigits: opts.maximumFractionDigits ?? 0 });
    return `${n} tr`;
  }
  return compactForeign(convert((Number(amountInMillions) || 0) * 1e6, books, display), display);
}

/** Số đã tính theo TỶ đơn vị sổ sách — dùng cho doanh thu năm ở module chấm điểm tín dụng. */
export function fmtCompactB(amountInBillions, display = "VND", books = "VND") {
  if (display === "VND" && books === "VND") {
    const n = (Number(amountInBillions) || 0).toLocaleString("vi-VN", { maximumFractionDigits: 1 });
    return `${n} tỷ`;
  }
  return compactForeign(convert((Number(amountInBillions) || 0) * 1e9, books, display), display);
}

/** Rút gọn ngoại tệ theo độ lớn thật sau quy đổi: 5.730 → "$5.7K", 19.100.000 → "$19.1M". */
function compactForeign(value, currency) {
  const locale = LOCALE[currency] || "en-US";
  const symbol = SYMBOL[currency] || currency + " ";
  const abs = Math.abs(value);
  let n, suffix;
  if (abs >= 1e9)      { n = value / 1e9; suffix = "B"; }
  else if (abs >= 1e6) { n = value / 1e6; suffix = "M"; }
  else if (abs >= 1e3) { n = value / 1e3; suffix = "K"; }
  else                 { n = value;       suffix = ""; }
  const str = n.toLocaleString(locale, { maximumFractionDigits: abs >= 1e3 ? 1 : 0 });
  return `${symbol}${str}${suffix}`;
}
