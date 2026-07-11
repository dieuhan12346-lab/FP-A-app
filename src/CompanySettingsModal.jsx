import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { X, Plus, ArrowLeft, Pencil, Building2, Check } from "lucide-react";
import { useCompany } from "./CompanyContext";
import { updateCompanyName, createCompany, listMyCompanies, switchCompany } from "./lib/company";
import CompanyForm from "./CompanyForm";

const C = { panel: "#111E33", panel2: "rgba(255,255,255,.04)", line: "rgba(255,255,255,.09)", txt: "#E8EEF9", sub: "#8CA0BE", green: "#26C287", red: "#F26D6D" };

export default function CompanySettingsModal({ onClose }) {
  const { t } = useTranslation();
  const { company, refresh } = useCompany();
  const [mode, setMode] = useState("list"); // "list" | "edit" | "create"
  const [companies, setCompanies] = useState(null); // null = đang tải
  const [busyId, setBusyId] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    listMyCompanies().then(setCompanies).catch((ex) => { setCompanies([]); setErr(ex.message); });
  }, []);

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

  // Hồ sơ mới (một bộ sổ sách mới) trở thành hồ sơ đang sử dụng
  // (ngôn ngữ UI do CompanyContext tự áp theo quốc gia hồ sơ sau refresh)
  const submitCreate = async (values) => {
    await createCompany(values);
    await refresh();
    onClose();
  };

  const pick = async (c) => {
    if (c.id === company.id || busyId) return;
    setErr(""); setBusyId(c.id);
    try {
      await switchCompany(c.id);
      await refresh();
      onClose();
    } catch (ex) { setErr(ex.message); setBusyId(null); }
  };

  const summary = (c) => [t("country." + c.country), c.currency, c.accountingStandard].filter(Boolean).join(" · ");

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 100000, background: "rgba(4,8,16,.72)", backdropFilter: "blur(3px)", display: "grid", placeItems: "center", padding: 20 }} onClick={onClose}>
      <div style={{ width: "100%", maxWidth: 460, maxHeight: "90vh", overflowY: "auto", background: C.panel, border: `1px solid ${C.line}`, borderRadius: 18, padding: "26px 26px 22px", color: C.txt }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 6 }}>
          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em" }}>
            {mode === "list" ? t("settings.profiles") : mode === "edit" ? t("settings.title") : t("settings.newProfile.title")}
          </div>
          <button onClick={onClose} title={t("settings.close")} style={{ border: "none", background: "transparent", color: C.sub, cursor: "pointer", padding: 4 }}><X size={18} /></button>
        </div>

        {mode === "list" && (
          <>
            <div style={{ fontSize: 12.5, color: C.sub, marginBottom: 16, lineHeight: 1.5 }}>{t("settings.switchHint")}</div>
            {companies === null && <div style={{ fontSize: 12.5, color: C.sub, padding: "10px 0" }}>{t("onb.loading")}</div>}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {(companies || []).map((c) => {
                const active = c.id === company.id;
                return (
                  <div key={c.id} onClick={() => pick(c)}
                    style={{ display: "flex", alignItems: "center", gap: 11, padding: "11px 13px", borderRadius: 12, cursor: active ? "default" : "pointer", background: active ? C.green + "14" : C.panel2, border: `1px solid ${active ? C.green + "55" : C.line}`, opacity: busyId && busyId !== c.id ? 0.5 : 1 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 9, flex: "0 0 auto", display: "grid", placeItems: "center", background: active ? C.green + "22" : "rgba(255,255,255,.06)" }}>
                      <Building2 size={16} color={active ? C.green : C.sub} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</div>
                      <div style={{ fontSize: 11, color: C.sub, marginTop: 2 }}>{summary(c)}</div>
                    </div>
                    {active ? (
                      <>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10.5, fontWeight: 800, color: C.green, background: C.green + "1f", padding: "3px 9px", borderRadius: 7 }}><Check size={12} />{t("settings.active")}</span>
                        <button onClick={(e) => { e.stopPropagation(); setMode("edit"); }} title={t("settings.renameCurrent")} style={{ display: "grid", placeItems: "center", width: 28, height: 28, borderRadius: 8, border: "none", cursor: "pointer", color: C.sub, background: "transparent" }}><Pencil size={14} /></button>
                      </>
                    ) : busyId === c.id ? (
                      <span style={{ fontSize: 11, color: C.sub }}>{t("settings.switching")}</span>
                    ) : null}
                  </div>
                );
              })}
            </div>
            {err && <div style={{ marginTop: 12, fontSize: 12.5, color: C.red }}>{err}</div>}
            <button onClick={() => setMode("create")} style={{ width: "100%", marginTop: 14, padding: "11px 0", borderRadius: 10, cursor: "pointer", fontWeight: 700, fontSize: 13, color: C.green, background: "transparent", border: `1px dashed ${C.green}66`, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, fontFamily: "inherit" }}>
              <Plus size={15} />{t("settings.newProfile")}
            </button>
          </>
        )}

        {mode === "edit" && (
          <>
            <div style={{ fontSize: 12.5, color: C.sub, marginBottom: 16, lineHeight: 1.5 }}>{t("settings.locked.hint")}</div>
            <CompanyForm initial={initial} lockAllButName onSubmit={submitEdit} submitLabel={t("settings.save")} submittingLabel={t("settings.saving")} />
            <button onClick={() => setMode("list")} style={{ width: "100%", marginTop: 10, padding: "10px 0", borderRadius: 10, cursor: "pointer", fontWeight: 600, fontSize: 12.5, color: C.sub, background: "transparent", border: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontFamily: "inherit" }}>
              <ArrowLeft size={14} />{t("settings.backToList")}
            </button>
          </>
        )}

        {mode === "create" && (
          <>
            <div style={{ fontSize: 12.5, color: C.sub, marginBottom: 16, lineHeight: 1.5 }}>{t("settings.newProfile.subtitle")}</div>
            <CompanyForm onSubmit={submitCreate} submitLabel={t("onb.submit")} submittingLabel={t("onb.submitting")} />
            <button onClick={() => setMode("list")} style={{ width: "100%", marginTop: 10, padding: "10px 0", borderRadius: 10, cursor: "pointer", fontWeight: 600, fontSize: 12.5, color: C.sub, background: "transparent", border: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontFamily: "inherit" }}>
              <ArrowLeft size={14} />{t("settings.backToList")}
            </button>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
