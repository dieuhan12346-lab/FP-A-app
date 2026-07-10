import React, { useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { X, Plus, ArrowLeft } from "lucide-react";
import { useCompany } from "./CompanyContext";
import { updateCompanyName, createCompany } from "./lib/company";
import { setLanguage } from "./i18n";
import CompanyForm from "./CompanyForm";

const C = { panel: "#111E33", line: "rgba(255,255,255,.09)", txt: "#E8EEF9", sub: "#8CA0BE", green: "#26C287" };

export default function CompanySettingsModal({ onClose }) {
  const { t } = useTranslation();
  const { company, refresh } = useCompany();
  const [mode, setMode] = useState("edit"); // "edit" | "create"
  if (!company) return null;

  const initial = {
    name: company.name, country: company.country, language: company.language,
    currency: company.currency, accountingStandard: company.accountingStandard,
    taxRegime: company.taxRegime, timezone: company.timezone,
  };

  // Hồ sơ đã tạo là bất biến — chỉ đổi được tên công ty
  const submitEdit = async (values) => {
    await updateCompanyName(company.id, values.name);
    await refresh();
    onClose();
  };

  // Hồ sơ mới trở thành hồ sơ đang sử dụng
  const submitCreate = async (values) => {
    await createCompany(values);
    await setLanguage(values.language);
    await refresh();
    onClose();
  };

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 100000, background: "rgba(4,8,16,.72)", backdropFilter: "blur(3px)", display: "grid", placeItems: "center", padding: 20 }} onClick={onClose}>
      <div style={{ width: "100%", maxWidth: 440, maxHeight: "90vh", overflowY: "auto", background: C.panel, border: `1px solid ${C.line}`, borderRadius: 18, padding: "26px 26px 22px", color: C.txt }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 6 }}>
          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em" }}>
            {mode === "edit" ? t("settings.title") : t("settings.newProfile.title")}
          </div>
          <button onClick={onClose} title={t("settings.close")} style={{ border: "none", background: "transparent", color: C.sub, cursor: "pointer", padding: 4 }}><X size={18} /></button>
        </div>

        {mode === "edit" ? (
          <>
            <div style={{ fontSize: 12.5, color: C.sub, marginBottom: 16, lineHeight: 1.5 }}>{t("settings.locked.hint")}</div>
            <CompanyForm initial={initial} lockAllButName onSubmit={submitEdit} submitLabel={t("settings.save")} submittingLabel={t("settings.saving")} />
            <button onClick={() => setMode("create")} style={{ width: "100%", marginTop: 10, padding: "11px 0", borderRadius: 10, cursor: "pointer", fontWeight: 700, fontSize: 13, color: C.green, background: "transparent", border: `1px dashed ${C.green}66`, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, fontFamily: "inherit" }}>
              <Plus size={15} />{t("settings.newProfile")}
            </button>
          </>
        ) : (
          <>
            <div style={{ fontSize: 12.5, color: C.sub, marginBottom: 16, lineHeight: 1.5 }}>{t("settings.newProfile.subtitle")}</div>
            <CompanyForm onSubmit={submitCreate} submitLabel={t("onb.submit")} submittingLabel={t("onb.submitting")} />
            <button onClick={() => setMode("edit")} style={{ width: "100%", marginTop: 10, padding: "10px 0", borderRadius: 10, cursor: "pointer", fontWeight: 600, fontSize: 12.5, color: C.sub, background: "transparent", border: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontFamily: "inherit" }}>
              <ArrowLeft size={14} />{t("settings.back")}
            </button>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
