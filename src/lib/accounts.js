import { supabase } from "./supabase";

/** Hệ tài khoản dự phòng (đủ cho bút toán bán hàng) — dùng khi Supabase chưa cấu hình
 *  hoặc bảng accounts chưa seed. Bản đầy đủ nằm ở bảng public.accounts (supabase/schema.sql). */
const FALLBACK = {
  VAS: {
    "111":  { vi: "Tiền mặt", en: "Cash on hand" },
    "112":  { vi: "Tiền gửi ngân hàng", en: "Cash at bank" },
    "131":  { vi: "Phải thu của khách hàng", en: "Trade receivables" },
    "511":  { vi: "Doanh thu bán hàng và cung cấp dịch vụ", en: "Revenue from sales and services" },
    "521":  { vi: "Các khoản giảm trừ doanh thu", en: "Revenue deductions" },
    "3331": { vi: "Thuế GTGT phải nộp", en: "VAT payable" },
  },
  IFRS: {
    "1000": { vi: "Tiền mặt", en: "Cash on hand" },
    "1100": { vi: "Tiền gửi ngân hàng", en: "Cash at bank" },
    "1200": { vi: "Phải thu khách hàng", en: "Trade receivables" },
    "2300": { vi: "Thuế bán hàng/GTGT phải nộp", en: "VAT payable" },
    "4000": { vi: "Doanh thu từ hợp đồng với khách hàng", en: "Revenue from contracts with customers" },
  },
};

let cache = null;
let loading = null;

/** Nạp hệ tài khoản (VAS + IFRS) từ bảng accounts — gọi 1 lần, các lần sau dùng cache. */
export function loadAccounts() {
  if (!supabase || cache || loading) return loading || Promise.resolve();
  loading = supabase
    .from("accounts")
    .select("standard,code,name_vi,name_en")
    .then(({ data }) => {
      if (data && data.length) {
        const m = {};
        for (const r of data) (m[r.standard] = m[r.standard] || {})[r.code] = { vi: r.name_vi, en: r.name_en };
        cache = m;
        window.dispatchEvent(new Event("accounts-loaded"));
      }
    })
    .catch(() => {})
    .finally(() => { loading = null; });
  return loading;
}

/** Tên tài khoản theo chuẩn + ngôn ngữ; null nếu không có mã này. */
export function accountName(standard, code, lang) {
  const src = cache || FALLBACK;
  const a = src[standard] && src[standard][code];
  return a ? (lang === "vi" ? a.vi : a.en) : null;
}
