import { convertFromVnd } from "./rates";

const LOCALE = { VND: "vi-VN", USD: "en-US", SGD: "en-SG", GBP: "en-GB", AUD: "en-AU", EUR: "de-DE", JPY: "ja-JP" };
const SYMBOL = { VND: "₫", USD: "$", SGD: "S$", GBP: "£", AUD: "A$", EUR: "€", JPY: "¥" };
const SUFFIX_CURRENCY = new Set(["VND"]); // ký hiệu đứng sau số (kiểu VN): "1.000.000 ₫"

/** Định dạng số tiền gốc VND (không phải triệu) theo tiền tệ của công ty — tự quy đổi tỷ giá. */
export function fmtMoney(amountVnd, currency = "VND") {
  const locale = LOCALE[currency] || "en-US";
  const symbol = SYMBOL[currency] || currency + " ";
  const v = convertFromVnd(Number(amountVnd) || 0, currency);
  const n = Math.round(v).toLocaleString(locale);
  return SUFFIX_CURRENCY.has(currency) ? `${n} ${symbol}` : `${symbol}${n}`;
}

/** Amount tính theo triệu VND (unit dữ liệu demo hiện có) → chuỗi tiền tệ đầy đủ. */
export function fmtMoneyM(amountInMillions, currency = "VND") {
  return fmtMoney(amountInMillions * 1e6, currency);
}

/** Số tiền gốc VND → dạng rút gọn: "12.180.000 ₫" → "12,18 tr" / "$463.5". */
export function fmtMoneyCompactM(amountVnd, currency = "VND") {
  if (currency === "VND") {
    const n = ((Number(amountVnd) || 0) / 1e6).toLocaleString("vi-VN", { maximumFractionDigits: 2 });
    return `${n} tr`;
  }
  return compactForeign(convertFromVnd(Number(amountVnd) || 0, currency), currency);
}

/** Số đã tính theo triệu VND (không chia lại) → dạng gọn: 150 → "150 tr" / "$5.7K". */
export function fmtCompactM(amountInMillions, currency = "VND", opts = {}) {
  if (currency === "VND") {
    const n = (Number(amountInMillions) || 0).toLocaleString("vi-VN", { maximumFractionDigits: opts.maximumFractionDigits ?? 0 });
    return `${n} tr`;
  }
  return compactForeign(convertFromVnd((Number(amountInMillions) || 0) * 1e6, currency), currency);
}

/** Số đã tính theo tỷ VND — dùng cho doanh thu năm ở module chấm điểm tín dụng. */
export function fmtCompactB(amountInBillions, currency = "VND") {
  if (currency === "VND") {
    const n = (Number(amountInBillions) || 0).toLocaleString("vi-VN", { maximumFractionDigits: 1 });
    return `${n} tỷ`;
  }
  return compactForeign(convertFromVnd((Number(amountInBillions) || 0) * 1e9, currency), currency);
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
