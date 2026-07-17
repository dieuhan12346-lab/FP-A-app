/** Hồ sơ vùng mặc định theo quốc gia — chỉ là GỢI Ý khi tạo công ty, sửa được sau.
 *
 *  statutory  = chuẩn nộp cho cơ quan quản lý sở tại (bắt buộc, theo luật nước đó).
 *  reporting  = chuẩn lập báo cáo cho công ty mẹ/nhà đầu tư (tùy nhu cầu).
 *  Hai cái này KHÔNG suy ra từ quốc gia được: DN Việt Nam có thể áp dụng IFRS tự nguyện
 *  theo lộ trình QĐ 345/QĐ-BTC, còn công ty FDI thì thường statutory=VAS + reporting=IFRS. */
export const COUNTRIES = [
  { code: "VN", nameKey: "country.VN", language: "vi", currency: "VND", statutoryStandard: "VAS",    reportingStandard: "VAS",    timezone: "Asia/Ho_Chi_Minh", taxRegimeKey: "tax.VN" },
  { code: "US", nameKey: "country.US", language: "en", currency: "USD", statutoryStandard: "USGAAP", reportingStandard: "USGAAP", timezone: "America/New_York",  taxRegimeKey: "tax.US" },
  { code: "SG", nameKey: "country.SG", language: "en", currency: "SGD", statutoryStandard: "IFRS",   reportingStandard: "IFRS",   timezone: "Asia/Singapore",   taxRegimeKey: "tax.SG" },
  { code: "GB", nameKey: "country.GB", language: "en", currency: "GBP", statutoryStandard: "IFRS",   reportingStandard: "IFRS",   timezone: "Europe/London",    taxRegimeKey: "tax.GB" },
  { code: "AU", nameKey: "country.AU", language: "en", currency: "AUD", statutoryStandard: "IFRS",   reportingStandard: "IFRS",   timezone: "Australia/Sydney", taxRegimeKey: "tax.AU" },
];

export const OTHER_REGION = { code: "OTHER", nameKey: "country.OTHER", language: "en", currency: "USD", statutoryStandard: "IFRS", reportingStandard: "IFRS", timezone: "UTC", taxRegimeKey: "tax.OTHER" };

export function regionForCountry(code) {
  return COUNTRIES.find((c) => c.code === code) || OTHER_REGION;
}

export const CURRENCIES = ["VND", "USD", "SGD", "GBP", "AUD", "EUR", "JPY"];
export const ACCOUNTING_STANDARDS = ["VAS", "IFRS", "USGAAP"];

/** Hệ tài khoản dùng cho một chuẩn.
 *  Chỉ VAS có hệ tài khoản thống nhất bắt buộc (TT200/2014/TT-BTC). IFRS và US GAAP
 *  đều KHÔNG quy định số hiệu tài khoản — doanh nghiệp tự đặt — nên dùng chung một hệ
 *  tổng quát. Bút toán bán hàng của IFRS 15 và ASC 606 cũng trùng nhau ở mức này. */
export function chartFor(standard) {
  return standard === "VAS" ? "VAS" : "IFRS";
}
const TIMEZONES = [
  "Asia/Ho_Chi_Minh", "America/New_York", "America/Los_Angeles", "Asia/Singapore",
  "Europe/London", "Australia/Sydney", "UTC", "Asia/Tokyo", "Europe/Paris",
];
export { TIMEZONES };
