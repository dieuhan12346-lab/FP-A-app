import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { CompanyProvider, useCompany } from "./CompanyContext";
import { createCompany } from "./lib/company";
import { listMyInvites, acceptInvite } from "./lib/members";
import { supabase } from "./lib/supabase";
import CompanyForm from "./CompanyForm";

const C = { bg: "#0B1526", panel: "#111E33", line: "rgba(255,255,255,.09)", txt: "#E8EEF9", sub: "#8CA0BE", green: "#26C287", red: "#F26D6D" };

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

  if (!company) return <NoCompany onDone={refresh} />;

  return children;
}

/** Chưa thuộc công ty nào: nếu có lời mời thì cho tham gia, không thì tạo hồ sơ mới. */
function NoCompany({ onDone }) {
  const { t } = useTranslation();
  const [invites, setInvites] = useState(null);   // null = đang tải
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => { listMyInvites().then(setInvites).catch(() => setInvites([])); }, []);

  const join = async (inv) => {
    setBusy(inv.id); setErr("");
    try { await acceptInvite(inv.id); await onDone(); }
    catch (ex) { setErr(ex.message); setBusy(""); }
  };

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: C.bg, fontFamily: "system-ui", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 440, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 18, padding: "30px 28px", color: C.txt }}>

        {/* Lời mời chờ sẵn — hiện TRƯỚC form tạo công ty, vì phần lớn người được mời
            không có nhu cầu tạo công ty mới, họ chỉ cần vào công ty đã mời họ. */}
        {invites && invites.length > 0 && (
          <div style={{ marginBottom: 26 }}>
            <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em" }}>{t("join.title")}</div>
            <div style={{ fontSize: 13, color: C.sub, marginTop: 6, marginBottom: 16, lineHeight: 1.5 }}>{t("join.desc")}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {invites.map((i) => (
                <div key={i.id} style={{ display: "flex", alignItems: "center", gap: 11, padding: "12px 14px", borderRadius: 12, background: "rgba(255,255,255,.04)", border: `1px solid ${C.line}` }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{i.companyName || t("join.company")}</div>
                    {/* Có tên người mời thì hiện — người nhận cần đối chiếu được lời mời
                        này có thật không trước khi bấm Tham gia. */}
                    <div style={{ fontSize: 11.5, color: C.sub, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {t("mem.role." + i.role)}{i.invitedBy ? " · " + t("join.by", { who: i.invitedBy }) : ""}
                    </div>
                  </div>
                  <button onClick={() => join(i)} disabled={busy === i.id}
                    style={{ flex: "0 0 auto", padding: "9px 18px", borderRadius: 10, border: "none", cursor: "pointer", fontWeight: 800, fontSize: 13, color: "#06251a", background: C.green, opacity: busy === i.id ? 0.6 : 1, fontFamily: "inherit" }}>
                    {busy === i.id ? t("join.busy") : t("join.btn")}
                  </button>
                </div>
              ))}
            </div>
            {err && <div style={{ marginTop: 11, fontSize: 12.5, color: C.red }}>{err}</div>}
            <div style={{ marginTop: 22, paddingTop: 18, borderTop: `1px solid ${C.line}`, fontSize: 12.5, color: C.sub }}>{t("join.or")}</div>
          </div>
        )}

        <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em" }}>{t("onb.title")}</div>
        <div style={{ fontSize: 13, color: C.sub, marginTop: 6, marginBottom: 22, lineHeight: 1.5 }}>{t("onb.subtitle")}</div>
        <CompanyForm onSubmit={async (values) => { await createCompany(values); await onDone(); }} />
      </div>
    </div>
  );
}
