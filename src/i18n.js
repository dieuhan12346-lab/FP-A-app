import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { supabase } from "./lib/supabase";
import vi from "./locales/vi.json";
import en from "./locales/en.json";

const STORAGE_KEY = "dongtien_lang";

function readStoredLang() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "vi" || v === "en" ? v : null;
  } catch {
    return null;
  }
}

i18n.use(initReactI18next).init({
  resources: { vi: { translation: vi }, en: { translation: en } },
  lng: readStoredLang() || "vi",
  fallbackLng: "vi",
  interpolation: { escapeValue: false, prefix: "{", suffix: "}" },
});

/** Đổi ngôn ngữ + lưu vào localStorage (thiết bị) và Supabase (theo user, nếu đã đăng nhập). */
export async function setLanguage(lg) {
  i18n.changeLanguage(lg);
  try { localStorage.setItem(STORAGE_KEY, lg); } catch {}
  if (supabase) {
    try {
      const { data } = await supabase.auth.getUser();
      if (data?.user) await supabase.auth.updateUser({ data: { lang: lg } });
    } catch {}
  }
}

/** Áp dụng lựa chọn ngôn ngữ đã lưu của user (gọi sau khi biết session).
 *  company: hồ sơ đang dùng — hồ sơ ngoài VN ép tiếng Anh nên KHÔNG được ghi đè,
 *  chỉ đồng bộ lựa chọn vào thiết bị để dùng khi quay về hồ sơ VN. */
export function applyUserLanguage(user, company) {
  const saved = user?.user_metadata?.lang;
  if (saved !== "vi" && saved !== "en") return;
  try { localStorage.setItem(STORAGE_KEY, saved); } catch {}
  if (company && company.country && company.country !== "VN") return; // UI đang bị ép EN
  if (saved !== i18n.language) i18n.changeLanguage(saved);
}

/** Ngôn ngữ UI theo quốc gia hồ sơ công ty:
 *  - Ngoài Việt Nam → ép tiếng Anh (nút chuyển VI/EN bị ẩn; không ghi đè lựa chọn đã lưu
 *    để khi quay về hồ sơ VN vẫn nhớ ý user).
 *  - Việt Nam → ưu tiên lựa chọn user đã lưu, chưa có thì lấy ngôn ngữ mặc định của hồ sơ. */
export function applyCompanyUiLanguage(company) {
  if (!company) return;
  const target = company.country && company.country !== "VN"
    ? "en"
    : readStoredLang() || (company.language === "en" ? "en" : "vi");
  if (target !== i18n.language) i18n.changeLanguage(target);
}

export default i18n;
