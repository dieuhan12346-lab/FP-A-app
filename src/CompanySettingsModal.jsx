import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { X, Plus, ArrowLeft, Pencil, Building2, Check, Download, Users, Trash2, Mail, History } from "lucide-react";
import { useCompany } from "./CompanyContext";
import { updateCompanySettings, createCompany, listMyCompanies, switchCompany } from "./lib/company";
import { exportCompanyData, downloadJson, listAuditLog } from "./lib/dataExport";
import { ROLES, AGENTS, SCOPES, myRole, listMembers, listInvites, inviteMember, cancelInvite, changeRole, removeMember, setMemberAgents, setMemberScope } from "./lib/members";
import { sendInvite } from "./lib/forecastApi";
import CompanyForm from "./CompanyForm";

const C = { panel: "#111E33", panel2: "rgba(255,255,255,.04)", line: "rgba(255,255,255,.09)", txt: "#E8EEF9", sub: "#8CA0BE", green: "#26C287", red: "#F26D6D" };

/* Chọn agent cho một thành viên.
   null = toàn quyền (khác hẳn mảng rỗng = không vào được agent nào). Giữ phân biệt
   này vì thành viên cũ chưa phân agent đều đang null — coi null như rỗng là khoá
   sạch mọi người ngay lần đầu mở màn hình. */
function AgentPicker({ value, busy, onChange, t }) {
  const all = value == null;
  const set = new Set(all ? AGENTS : value);
  const toggle = (id) => {
    const next = new Set(all ? AGENTS : value);
    next.has(id) ? next.delete(id) : next.add(id);
    onChange(next.size === AGENTS.length ? null : [...next]);
  };
  const chip = (on) => ({
    padding: "3px 9px", borderRadius: 7, fontSize: 10.5, fontWeight: 700, fontFamily: "inherit",
    cursor: busy ? "default" : "pointer", opacity: busy ? 0.5 : 1,
    color: on ? "#06251a" : C.sub,
    background: on ? C.green : "transparent",
    border: `1px solid ${on ? C.green : C.line}`,
  });
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 8, paddingTop: 8, borderTop: `1px dashed ${C.line}`, alignItems: "center" }}>
      <span style={{ fontSize: 10.5, color: C.sub, marginRight: 2 }}>{t("mem.agents")}</span>
      {AGENTS.map((id) => (
        <button key={id} disabled={busy} onClick={() => toggle(id)} style={chip(set.has(id))}>{t("nav." + id)}</button>
      ))}
      {set.size === 0 && <span style={{ fontSize: 10.5, color: C.red }}>{t("mem.agents.none")}</span>}
    </div>
  );
}

export default function CompanySettingsModal({ onClose }) {
  const { t, i18n } = useTranslation();
  const { company, refresh } = useCompany();
  const [mode, setMode] = useState("list"); // "list" | "edit" | "create"
  const [companies, setCompanies] = useState(null); // null = đang tải
  const [busyId, setBusyId] = useState(null);
  const [err, setErr] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState("");
  const [audit, setAudit] = useState([]);

  /** Tải toàn bộ dữ liệu công ty hiện tại về máy dưới dạng JSON. */
  const doExport = async () => {
    setExporting(true); setExportMsg(""); setErr("");
    try {
      const data = await exportCompanyData(company.id);
      const slug = String(company.name || "cong-ty").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
      downloadJson(data, `luxora-${slug}-${new Date().toISOString().slice(0, 10)}.json`);
      const n = Object.values(data.summary || {}).reduce((s, v) => s + v, 0);
      setExportMsg(t("settings.export.done", { n }));
      setAudit(await listAuditLog(company.id));   // lần xuất vừa rồi hiện ngay trong nhật ký
    } catch (ex) { setErr(ex.message); }
    finally { setExporting(false); }
  };

  // ── Thành viên & lời mời ──
  const [role, setRole] = useState(null);          // vai của chính mình trong công ty đang chọn
  const [members, setMembers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [invitesOk, setInvitesOk] = useState(true);   // false = CSDL chưa chạy migration 011
  const [invEmail, setInvEmail] = useState("");
  const [invRole, setInvRole] = useState("editor");
  const [inviteMsg, setInviteMsg] = useState(null);   // { ok, text } sau khi mời
  const [mBusy, setMBusy] = useState("");
  // Cùng quy ước với CompanyContext: chưa biết vai thì mở, đừng khoá nhầm người đang dùng bình thường.
  const isOwner = role !== "editor" && role !== "viewer";

  const reloadMembers = async () => {
    if (!company?.id) return;
    setRole(await myRole(company.id));
    try { setMembers(await listMembers(company.id)); } catch { setMembers([]); }
    // Phân biệt "chưa có lời mời nào" với "cơ sở dữ liệu chưa có bảng lời mời" — trường
    // hợp sau phải ẩn ô mời, nếu không người dùng bấm rồi ăn lỗi PostgREST thô.
    try { setInvites(await listInvites(company.id)); setInvitesOk(true); }
    catch { setInvites([]); setInvitesOk(false); }
    setAudit(await listAuditLog(company.id));
  };
  useEffect(() => { reloadMembers(); }, [company?.id]);

  const runM = async (key, fn) => {
    setMBusy(key); setErr("");
    try { await fn(); await reloadMembers(); }
    catch (ex) { setErr(ex.message); }
    finally { setMBusy(""); }
  };
  const doInvite = () => runM("invite", async () => {
    const mail = invEmail.trim().toLowerCase();
    await inviteMember(company.id, mail, invRole);
    setInvEmail(""); setInviteMsg("");
    // Lời mời đã ghi xong. Thư gửi hỏng thì KHÔNG huỷ lời mời — người được mời vẫn
    // vào được bằng cách đăng nhập đúng email này, nên chỉ báo để owner tự nhắn tay.
    try {
      await sendInvite({ companyId: company.id, to: mail, role: invRole, lang: i18n.language });
      setInviteMsg({ ok: true, text: t("mem.invite.sent", { email: mail }) });
    } catch (ex) {
      setInviteMsg({ ok: false, text: t("mem.invite.noMail", { err: ex.message }) });
    }
  });

  useEffect(() => {
    listMyCompanies().then(setCompanies).catch((ex) => { setCompanies([]); setErr(ex.message); });
  }, []);

  if (!company) return null;

  const initial = {
    name: company.name, country: company.country, language: company.language,
    currency: company.currency,
    statutoryStandard: company.statutoryStandard, reportingStandard: company.reportingStandard,
    taxRegime: company.taxRegime, timezone: company.timezone,
  };

  // Quốc gia/tiền tệ vẫn bất biến; tên và chuẩn kế toán thì sửa được
  const submitEdit = async (values) => {
    await updateCompanySettings(company.id, {
      name: values.name,
      statutoryStandard: values.statutoryStandard,
      reportingStandard: values.reportingStandard,
    });
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

  const summary = (c) => {
    const std = c.statutoryStandard === c.reportingStandard
      ? c.statutoryStandard
      : `${c.statutoryStandard} → ${c.reportingStandard}`;
    return [t("country." + c.country), c.currency, std].filter(Boolean).join(" · ");
  };

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
                        {isOwner && <button onClick={(e) => { e.stopPropagation(); setMode("edit"); }} title={t("settings.renameCurrent")} style={{ display: "grid", placeItems: "center", width: 28, height: 28, borderRadius: 8, border: "none", cursor: "pointer", color: C.sub, background: "transparent" }}><Pencil size={14} /></button>}
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

            {/* Thành viên công ty — chỉ owner quản được.
                Ẩn hẳn nếu cơ sở dữ liệu chưa có bảng phân vai (bản cũ) để không hiện khối rỗng. */}
            {(members.length > 0 || role) && (
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${C.line}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
                <Users size={15} color={C.sub} />
                <span style={{ fontSize: 13, fontWeight: 700 }}>{t("mem.title")}</span>
                <span style={{ fontSize: 11, color: C.sub }}>· {members.length}</span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {members.map((m) => (
                  <div key={m.user_id} style={{ padding: "8px 11px", borderRadius: 9, background: C.panel2, border: `1px solid ${C.line}` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.email || m.user_id.slice(0, 8) + "…"}</span>
                    {role === "owner" ? (
                      <select value={m.role} disabled={mBusy === "role" + m.user_id}
                        onChange={(e) => runM("role" + m.user_id, () => changeRole(company.id, m.user_id, e.target.value))}
                        style={{ padding: "5px 8px", borderRadius: 7, fontSize: 11.5, color: C.txt, background: "rgba(255,255,255,.06)", border: `1px solid ${C.line}`, fontFamily: "inherit" }}>
                        {ROLES.map((r) => <option key={r} value={r}>{t("mem.role." + r)}</option>)}
                      </select>
                    ) : (
                      <span style={{ fontSize: 11.5, color: C.sub }}>{t("mem.role." + m.role)}</span>
                    )}
                    {role === "owner" && members.length > 1 && (
                      <button onClick={() => runM("del" + m.user_id, () => removeMember(company.id, m.user_id, m.email))}
                        title={t("mem.remove")} disabled={mBusy === "del" + m.user_id}
                        style={{ display: "grid", placeItems: "center", width: 26, height: 26, borderRadius: 7, border: "none", cursor: "pointer", color: C.red, background: "transparent" }}>
                        <Trash2 size={13} />
                      </button>
                    )}
                    </div>
                    {/* Agent được phép dùng. Owner luôn vào hết nên không cần chọn. */}
                    {role === "owner" && m.role !== "owner" && m.agents !== undefined && (
                      <AgentPicker
                        value={m.agents}
                        busy={mBusy === "ag" + m.user_id}
                        onChange={(next) => runM("ag" + m.user_id, () => setMemberAgents(company.id, m.user_id, next))}
                        t={t}
                      />
                    )}
                    {/* Phạm vi bản ghi. Chỉ hiện khi CSDL đã có cột (m.data_scope !== undefined). */}
                    {role === "owner" && m.role !== "owner" && m.data_scope !== undefined && (
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 7, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 10.5, color: C.sub }}>{t("mem.scope")}</span>
                        {SCOPES.map((s) => {
                          const on = (m.data_scope || "all") === s;
                          return (
                            <button key={s} disabled={mBusy === "sc" + m.user_id}
                              onClick={() => runM("sc" + m.user_id, () => setMemberScope(company.id, m.user_id, s))}
                              style={{ padding: "3px 9px", borderRadius: 7, fontSize: 10.5, fontWeight: 700, fontFamily: "inherit",
                                cursor: "pointer", color: on ? "#06202f" : C.sub,
                                background: on ? "#39B8D8" : "transparent",
                                border: `1px solid ${on ? "#39B8D8" : C.line}` }}>
                              {t("mem.scope." + s)}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {role === "owner" && !invitesOk && (
                <div style={{ marginTop: 9, padding: "9px 12px", borderRadius: 9, fontSize: 11.5, color: C.sub, background: "rgba(255,255,255,.03)", border: `1px dashed ${C.line}`, lineHeight: 1.5 }}>
                  {t("mem.needMigration")}
                </div>
              )}

              {role === "owner" && invitesOk && (
                <>
                  {invites.length > 0 && (
                    <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                      {invites.map((i) => (
                        <div key={i.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 11px", borderRadius: 9, background: "transparent", border: `1px dashed ${C.line}` }}>
                          <Mail size={12} color={C.sub} style={{ flex: "0 0 auto" }} />
                          <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: C.sub, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{i.email}</span>
                          <span style={{ fontSize: 11, color: C.sub, flex: "0 0 auto" }}>{t("mem.role." + i.role)} · {t("mem.pending")}</span>
                          <button onClick={() => runM("inv" + i.id, () => cancelInvite(i.id))} title={t("mem.cancelInvite")}
                            style={{ display: "grid", placeItems: "center", width: 24, height: 24, borderRadius: 6, border: "none", cursor: "pointer", color: C.sub, background: "transparent" }}>
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 7, marginTop: 9, flexWrap: "wrap" }}>
                    <input type="email" value={invEmail} onChange={(e) => setInvEmail(e.target.value)} placeholder={t("mem.invite.ph")}
                      style={{ flex: "1 1 160px", minWidth: 0, padding: "8px 11px", borderRadius: 9, fontSize: 12.5, color: C.txt, background: "rgba(255,255,255,.05)", border: `1px solid ${C.line}`, outline: "none", fontFamily: "inherit" }} />
                    <select value={invRole} onChange={(e) => setInvRole(e.target.value)}
                      style={{ padding: "8px 10px", borderRadius: 9, fontSize: 12.5, color: C.txt, background: "rgba(255,255,255,.05)", border: `1px solid ${C.line}`, fontFamily: "inherit" }}>
                      {ROLES.map((r) => <option key={r} value={r}>{t("mem.role." + r)}</option>)}
                    </select>
                    <button onClick={doInvite} disabled={mBusy === "invite" || !invEmail.trim()}
                      style={{ padding: "8px 15px", borderRadius: 9, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 12.5, color: "#06251a", background: C.green, opacity: mBusy === "invite" || !invEmail.trim() ? 0.6 : 1, fontFamily: "inherit" }}>
                      {mBusy === "invite" ? t("mem.inviting") : t("mem.invite")}
                    </button>
                  </div>
                  {inviteMsg && (
                    <div style={{ marginTop: 8, fontSize: 11.5, color: inviteMsg.ok ? C.green : C.gold, lineHeight: 1.5 }}>
                      {inviteMsg.text}
                    </div>
                  )}
                  <div style={{ marginTop: 7, fontSize: 11, color: C.sub, lineHeight: 1.5 }}>{t("mem.invite.hint")}</div>
                </>
              )}
            </div>
            )}

            {/* Xuất toàn bộ dữ liệu công ty — quyền mang theo dữ liệu, và để giữ bản sao khi rời dịch vụ.
                Gom cả sổ sách vào một file nên để Chủ sở hữu giữ, không mở cho mọi thành viên. */}
            {isOwner && (
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${C.line}` }}>
              <button onClick={doExport} disabled={exporting} style={{ width: "100%", padding: "10px 0", borderRadius: 10, cursor: exporting ? "default" : "pointer", fontWeight: 700, fontSize: 12.5, color: C.txt, background: C.panel2, border: `1px solid ${C.line}`, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, fontFamily: "inherit", opacity: exporting ? 0.7 : 1 }}>
                <Download size={14} />{exporting ? t("settings.export.busy") : t("settings.export")}
              </button>
              <div style={{ marginTop: 7, fontSize: 11, color: exportMsg ? C.green : C.sub, lineHeight: 1.5 }}>{exportMsg || t("settings.export.hint")}</div>

              {/* Nhật ký xuất — thành viên vai xem vẫn đọc được dữ liệu nên vẫn tự chép ra
                  được; chặn hẳn thì không, nhưng bản xuất một cú bấm thì để lại dấu vết. */}
              {audit.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 7 }}>
                    <History size={13} color={C.sub} />
                    <span style={{ fontSize: 12, fontWeight: 700 }}>{t("audit.title")}</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {audit.map((a) => {
                      const rows = Object.values(a.detail || {}).reduce((s, v) => s + (Number(v) || 0), 0);
                      return (
                        <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: C.sub }}>
                          <span style={{ flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.email || "—"}</span>
                          <span style={{ flex: "0 0 auto" }}>{t("audit.rows", { n: rows })}</span>
                          <span style={{ flex: "0 0 auto" }}>{new Date(a.created_at).toLocaleString()}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            )}
          </>
        )}

        {mode === "edit" && (
          <>
            <div style={{ fontSize: 12.5, color: C.sub, marginBottom: 16, lineHeight: 1.5 }}>{t("settings.locked.hint")}</div>
            <CompanyForm initial={initial} editing onSubmit={submitEdit} submitLabel={t("settings.save")} submittingLabel={t("settings.saving")} />
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
