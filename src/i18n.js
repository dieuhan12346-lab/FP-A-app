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

/** Áp dụng lựa chọn ngôn ngữ đã lưu của user (gọi sau khi biết session). */
export function applyUserLanguage(user) {
  const saved = user?.user_metadata?.lang;
  if ((saved === "vi" || saved === "en") && saved !== i18n.language) {
    i18n.changeLanguage(saved);
    try { localStorage.setItem(STORAGE_KEY, saved); } catch {}
  }
}

export default i18n;
