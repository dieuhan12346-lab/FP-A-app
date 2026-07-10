const LOCALE = { VND: "vi-VN", USD: "en-US", SGD: "en-SG", GBP: "en-GB", AUD: "en-AU", EUR: "de-DE", JPY: "ja-JP" };
const SYMBOL = { VND: "₫", USD: "$", SGD: "S$", GBP: "£", AUD: "A$", EUR: "€", JPY: "¥" };
const SUFFIX_CURRENCY = new Set(["VND"]); // ký hiệu đứng sau số (kiểu VN): "1.000.000 ₫"

/** Định dạng số tiền (đơn vị gốc, không phải triệu) theo tiền tệ của công ty. */
export function fmtMoney(amount, currency = "VND") {
  const locale = LOCALE[currency] || "en-US";
  const symbol = SYMBOL[currency] || currency + " ";
  const n = Math.round(amount).toLocaleString(locale);
  return SUFFIX_CURRENCY.has(currency) ? `${n} ${symbol}` : `${symbol}${n}`;
}

/** Amount tính theo triệu (unit dữ liệu demo hiện có) → chuỗi tiền tệ đầy đủ. */
export function fmtMoneyM(amountInMillions, currency = "VND") {
  return fmtMoney(amountInMillions * 1e6, currency);
}

/** Số tiền gốc (không phải triệu) → dạng rút gọn theo triệu: "12.180.000 ₫" → "12.18 tr" / "$12.18M". */
export function fmtMoneyCompactM(amount, currency = "VND") {
  const locale = LOCALE[currency] || "en-US";
  const symbol = SYMBOL[currency] || currency + " ";
  const v = (Number(amount) || 0) / 1e6;
  const n = v.toLocaleString(locale, { maximumFractionDigits: 2 });
  return currency === "VND" ? `${n} tr` : `${symbol}${n}M`;
}
