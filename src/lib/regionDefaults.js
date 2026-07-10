/** Hồ sơ vùng mặc định theo quốc gia — set khi tạo công ty, sửa được sau. */
export const COUNTRIES = [
  { code: "VN", nameKey: "country.VN", language: "vi", currency: "VND", accountingStandard: "VAS", timezone: "Asia/Ho_Chi_Minh", taxRegimeKey: "tax.VN" },
  { code: "US", nameKey: "country.US", language: "en", currency: "USD", accountingStandard: "IFRS", timezone: "America/New_York", taxRegimeKey: "tax.US" },
  { code: "SG", nameKey: "country.SG", language: "en", currency: "SGD", accountingStandard: "IFRS", timezone: "Asia/Singapore", taxRegimeKey: "tax.SG" },
  { code: "GB", nameKey: "country.GB", language: "en", currency: "GBP", accountingStandard: "IFRS", timezone: "Europe/London", taxRegimeKey: "tax.GB" },
  { code: "AU", nameKey: "country.AU", language: "en", currency: "AUD", accountingStandard: "IFRS", timezone: "Australia/Sydney", taxRegimeKey: "tax.AU" },
];

export const OTHER_REGION = { code: "OTHER", nameKey: "country.OTHER", language: "en", currency: "USD", accountingStandard: "IFRS", timezone: "UTC", taxRegimeKey: "tax.OTHER" };

export function regionForCountry(code) {
  return COUNTRIES.find((c) => c.code === code) || OTHER_REGION;
}

export const CURRENCIES = ["VND", "USD", "SGD", "GBP", "AUD", "EUR", "JPY"];
export const ACCOUNTING_STANDARDS = ["VAS", "IFRS"];

const TIMEZONES = [
  "Asia/Ho_Chi_Minh", "America/New_York", "America/Los_Angeles", "Asia/Singapore",
  "Europe/London", "Australia/Sydney", "UTC", "Asia/Tokyo", "Europe/Paris",
];
export { TIMEZONES };
