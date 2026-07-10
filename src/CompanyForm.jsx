import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { COUNTRIES, OTHER_REGION, regionForCountry, CURRENCIES, ACCOUNTING_STANDARDS, TIMEZONES } from "./lib/regionDefaults";

const C = { bg: "#0B1526", panel: "#111E33", line: "rgba(255,255,255,.09)", txt: "#E8EEF9", sub: "#8CA0BE", green: "#26C287", red: "#F26D6D" };

const inputStyle = {
  width: "100%", padding: "10px 13px", borderRadius: 10, fontSize: 13.5,
  color: C.txt, background: "rgba(255,255,255,.05)", border: `1px solid ${C.line}`, outline: "none", fontFamily: "inherit",
};
const labelStyle = { fontSize: 12, color: C.sub, display: "block", marginBottom: 6, fontWeight: 600 };
const fieldWrap = { marginBottom: 14 };

/** Form dùng chung cho onboarding (tạo công ty) và trang cài đặt (sửa hồ sơ công ty).
 *  lockAllButName: hồ sơ đã tạo là bất biến — chỉ cho sửa tên công ty. */
export default function CompanyForm({ initial, onSubmit, submitLabel, submittingLabel, lockAllButName = false }) {
  const { t } = useTranslation();
  const [name, setName] = useState(initial?.name || "");
  const [country, setCountry] = useState(initial?.country || "VN");
  const [language, setLanguage] = useState(initial?.language || regionForCountry(initial?.country || "VN").language);
  const [currency, setCurrency] = useState(initial?.currency || regionForCountry(initial?.country || "VN").currency);
  const [accountingStandard, setAccountingStandard] = useState(initial?.accountingStandard || regionForCountry(initial?.country || "VN").accountingStandard);
  const [taxRegime, setTaxRegime] = useState(initial?.taxRegime || t(regionForCountry(initial?.country || "VN").taxRegimeKey));
  const [timezone, setTimezone] = useState(initial?.timezone || regionForCountry(initial?.country || "VN").timezone);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const onCountryChange = (code) => {
    setCountry(code);
    const r = COUNTRIES.find((c) => c.code === code) || OTHER_REGION;
    setLanguage(r.language);
    setCurrency(r.currency);
    setAccountingStandard(r.accountingStandard);
    setTaxRegime(t(r.taxRegimeKey));
    setTimezone(r.timezone);
  };

  const lockedStyle = lockAllButName ? { ...inputStyle, opacity: 0.5, cursor: "not-allowed" } : inputStyle;

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (!name.trim()) { setErr(t("onb.err.name")); return; }
    setBusy(true);
    try {
      await onSubmit({ name: name.trim(), country, language, currency, accountingStandard, taxRegime, timezone });
    } catch (ex) {
      setErr(ex.message || String(ex));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <div style={fieldWrap}>
        <label style={labelStyle}>{t("onb.name")}</label>
        <input style={inputStyle} type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("onb.name.ph")} />
      </div>

      <div style={fieldWrap}>
        <label style={labelStyle}>{t("onb.country")}</label>
        <select style={lockedStyle} disabled={lockAllButName} value={country} onChange={(e) => onCountryChange(e.target.value)}>
          {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{t(c.nameKey)}</option>)}
          <option value="OTHER">{t("country.OTHER")}</option>
        </select>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={fieldWrap}>
          <label style={labelStyle}>{t("onb.language")}</label>
          <select style={lockedStyle} disabled={lockAllButName} value={language} onChange={(e) => setLanguage(e.target.value)}>
            <option value="vi">Tiếng Việt</option>
            <option value="en">English</option>
          </select>
        </div>
        <div style={fieldWrap}>
          <label style={labelStyle}>{t("onb.currency")}</label>
          <select style={lockedStyle} disabled={lockAllButName} value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={fieldWrap}>
          <label style={labelStyle}>{t("onb.standard")}</label>
          <select style={lockedStyle} disabled={lockAllButName} value={accountingStandard} onChange={(e) => setAccountingStandard(e.target.value)}>
            {ACCOUNTING_STANDARDS.map((s) => <option key={s} value={s}>{t("onb.standard." + s)}</option>)}
          </select>
        </div>
        <div style={fieldWrap}>
          <label style={labelStyle}>{t("onb.timezone")}</label>
          <select style={lockedStyle} disabled={lockAllButName} value={timezone} onChange={(e) => setTimezone(e.target.value)}>
            {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
          </select>
        </div>
      </div>

      <div style={fieldWrap}>
        <label style={labelStyle}>{t("onb.tax")}</label>
        <input style={lockedStyle} disabled={lockAllButName} type="text" value={taxRegime} onChange={(e) => setTaxRegime(e.target.value)} />
      </div>

      {err && <div style={{ marginBottom: 12, fontSize: 12.5, color: C.red }}>{err}</div>}

      <button type="submit" disabled={busy} style={{ width: "100%", marginTop: 4, padding: "12px 0", borderRadius: 10, border: "none", cursor: "pointer", fontWeight: 800, fontSize: 14, color: "#06251a", background: `linear-gradient(135deg, ${C.green}, #1FA877)`, opacity: busy ? 0.6 : 1 }}>
        {busy ? (submittingLabel || t("onb.submitting")) : (submitLabel || t("onb.submit"))}
      </button>
    </form>
  );
}
