import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import vi from "./locales/vi.json";
import en from "./locales/en.json";

i18n.use(initReactI18next).init({
  resources: { vi: { translation: vi }, en: { translation: en } },
  lng: "vi", // tạm cho tới khi biết hồ sơ công ty; applyCompanyUiLanguage sẽ chốt
  fallbackLng: "vi",
  interpolation: { escapeValue: false, prefix: "{", suffix: "}" },
});

/** Ngôn ngữ UI do QUỐC GIA của hồ sơ công ty quyết định — không có lựa chọn thủ công:
 *  Việt Nam → tiếng Việt · ngoài Việt Nam → tiếng Anh. */
export function langForCountry(country) {
  return (country || "VN") === "VN" ? "vi" : "en"; // chưa đặt quốc gia → coi như VN
}

export function applyCompanyUiLanguage(company) {
  if (!company) return;
  const target = langForCountry(company.country);
  if (target !== i18n.language) i18n.changeLanguage(target);
}

export default i18n;
