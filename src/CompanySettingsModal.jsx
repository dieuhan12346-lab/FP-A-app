import React from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { useCompany } from "./CompanyContext";
import { updateCompany } from "./lib/company";
import { setLanguage } from "./i18n";
import CompanyForm from "./CompanyForm";

const C = { panel: "#111E33", line: "rgba(255,255,255,.09)", txt: "#E8EEF9", sub: "#8CA0BE" };

export default function CompanySettingsModal({ onClose }) {
  const { t } = useTranslation();
  const { company, refresh } = useCompany();
  if (!company) return null;

  const initial = {
    name: company.name, country: company.country, language: company.language,
    currency: company.currency, accountingStandard: company.accounting_standard,
    taxRegime: company.tax_regime, timezone: company.timezone,
  };

  const submit = async (values) => {
    await updateCompany(company.id, values);
    await setLanguage(values.language);
    await refresh();
    onClose();
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(4,8,16,.6)", display: "grid", placeItems: "center", padding: 20 }} onClick={onClose}>
      <div style={{ width: "100%", maxWidth: 440, maxHeight: "90vh", overflowY: "auto", background: C.panel, border: `1px solid ${C.line}`, borderRadius: 18, padding: "26px 26px 22px", color: C.txt }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 6 }}>
          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em" }}>{t("settings.title")}</div>
          <button onClick={onClose} title={t("settings.close")} style={{ border: "none", background: "transparent", color: C.sub, cursor: "pointer", padding: 4 }}><X size={18} /></button>
        </div>
        <div style={{ fontSize: 12.5, color: C.sub, marginBottom: 20, lineHeight: 1.5 }}>{t("settings.subtitle")}</div>
        <CompanyForm initial={initial} onSubmit={submit} submitLabel={t("settings.save")} submittingLabel={t("settings.saving")} />
      </div>
    </div>
  );
}
