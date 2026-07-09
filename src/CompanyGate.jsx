import React from "react";
import { useTranslation } from "react-i18next";
import { CompanyProvider, useCompany } from "./CompanyContext";
import { createCompany } from "./lib/company";
import { supabase } from "./lib/supabase";
import { setLanguage } from "./i18n";
import CompanyForm from "./CompanyForm";

const C = { bg: "#0B1526", panel: "#111E33", line: "rgba(255,255,255,.09)", txt: "#E8EEF9", sub: "#8CA0BE" };

export default function CompanyGate({ children }) {
  return (
    <CompanyProvider>
      <CompanyGateInner>{children}</CompanyGateInner>
    </CompanyProvider>
  );
}

function CompanyGateInner({ children }) {
  const { t } = useTranslation();
  const { company, loading, refresh } = useCompany();

  if (!supabase) return children; // chưa cấu hình Supabase — bỏ qua bước công ty

  if (loading) {
    return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: C.bg, color: C.sub, fontFamily: "system-ui" }}>{t("onb.loading")}</div>;
  }

  if (!company) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: C.bg, fontFamily: "system-ui", padding: 20 }}>
        <div style={{ width: "100%", maxWidth: 440, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 18, padding: "30px 28px", color: C.txt }}>
          <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em" }}>{t("onb.title")}</div>
          <div style={{ fontSize: 13, color: C.sub, marginTop: 6, marginBottom: 22, lineHeight: 1.5 }}>{t("onb.subtitle")}</div>
          <CompanyForm onSubmit={async (values) => { await createCompany(values); await setLanguage(values.language); await refresh(); }} />
        </div>
      </div>
    );
  }

  return children;
}
