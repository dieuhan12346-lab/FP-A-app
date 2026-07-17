/** Tỷ giá VND → tiền tệ khác.
 *  Nguồn: open.er-api.com (miễn phí, không cần key, cập nhật hàng ngày, có VND).
 *  Cache localStorage 24h; API lỗi/mất mạng thì rơi về bảng tỷ giá cố định bên dưới. */

const CACHE_KEY = "fx-rates-vnd-v1";
const TTL_MS = 24 * 60 * 60 * 1000;
const API_URL = "https://open.er-api.com/v6/latest/VND";

// Bảng dự phòng: số VND đổi được 1 đơn vị ngoại tệ (tham khảo, tự cập nhật khi cần)
const STATIC_VND_PER_UNIT = { USD: 26300, EUR: 30300, GBP: 35300, SGD: 20400, AUD: 17200, JPY: 162 };

function staticRates() {
  const r = { VND: 1 };
  for (const [cur, vnd] of Object.entries(STATIC_VND_PER_UNIT)) r[cur] = 1 / vnd;
  return r;
}

let rates = staticRates();
let source = "static"; // "static" | "cache" | "live"

// Đọc cache đồng bộ ngay khi import để render đầu tiên đã có tỷ giá đúng
try {
  const c = JSON.parse(localStorage.getItem(CACHE_KEY));
  if (c && c.rates && Date.now() - c.ts < TTL_MS) { rates = { ...rates, ...c.rates }; source = "cache"; }
} catch { /* cache hỏng thì bỏ qua */ }

/** Đổi số tiền VND sang tiền tệ đích theo tỷ giá hiện có. */
export function convertFromVnd(amountVnd, currency) {
  if (!currency || currency === "VND") return amountVnd;
  const m = rates[currency];
  return m ? amountVnd * m : amountVnd;
}

/** Đổi giữa HAI đơn vị bất kỳ — dùng cho "sổ sách ghi tiền tệ A, hiển thị tiền tệ B".
 *  rates[cur] = số đơn vị `cur` đổi được từ 1 VND, nên quy về VND rồi đổi tiếp. */
export function convert(amount, from = "VND", to = "VND") {
  const n = Number(amount) || 0;
  if (from === to) return n;
  const rFrom = from === "VND" ? 1 : rates[from];
  const rTo = to === "VND" ? 1 : rates[to];
  if (!rFrom || !rTo) return n; // thiếu tỷ giá → trả nguyên, đừng bịa số
  return (n / rFrom) * rTo;
}

/** "live" (API) | "cache" (API của <24h trước) | "static" (bảng dự phòng) */
export function ratesSource() { return source; }

export async function refreshRates() {
  try {
    const res = await fetch(API_URL);
    const j = await res.json();
    if (j && j.result === "success" && j.rates) {
      rates = { ...staticRates(), ...j.rates };
      source = "live";
      try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), rates: j.rates })); } catch { /* storage đầy */ }
      window.dispatchEvent(new Event("fx-rates-updated"));
    }
  } catch { /* giữ nguyên cache/static */ }
}

// Cache còn hạn thì thôi, hết hạn hoặc chưa có thì gọi API 1 lần lúc mở app
if (source !== "cache") refreshRates();
