import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { fetchMyCompany } from "./lib/company";
import { myAccess } from "./lib/members";
import { supabase } from "./lib/supabase";
import { applyCompanyUiLanguage } from "./i18n";

export const CompanyContext = createContext({ company: null, role: null, agents: null, canEdit: true, isOwner: true, canUse: () => true, expired: false, trialDaysLeft: null, loading: true, refresh: async () => {} });

export function useCompany() {
  return useContext(CompanyContext);
}

export function CompanyProvider({ children }) {
  const [company, setCompany] = useState(null);
  const [role, setRole] = useState(null);
  const [agents, setAgents] = useState(null);   // null = toàn quyền agent
  const [loading, setLoading] = useState(true);
  const [fxTick, setFxTick] = useState(0);

  // Tỷ giá mới về từ API → render lại các số tiền đã quy đổi
  useEffect(() => {
    const onFx = () => setFxTick((v) => v + 1);
    window.addEventListener("fx-rates-updated", onFx);
    return () => window.removeEventListener("fx-rates-updated", onFx);
  }, []);

  const refresh = useCallback(async () => {
    if (!supabase) { setCompany(null); setRole(null); setAgents(null); setLoading(false); return; }
    setLoading(true);
    try {
      const c = await fetchMyCompany();
      setCompany(c);
      if (c) applyCompanyUiLanguage(c);
      const a = c ? await myAccess(c.id) : { role: null, agents: null };
      setRole(a.role);
      setAgents(a.agents);
    } catch {
      setCompany(null);
      setRole(null);
      setAgents(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  /* Chốt chặn quyền thật nằm ở RLS trong cơ sở dữ liệu. Hai cờ dưới chỉ để giao diện
     khỏi mời người ta bấm một nút chắc chắn báo lỗi — nên khi chưa biết vai (bản dựng
     demo, hoặc CSDL chưa có cột role) thì mở, không khoá nhầm người đang dùng bình thường. */
  /* Dùng thử hết hạn → khoá ghi, giữ nguyên quyền đọc và xuất dữ liệu.
     Chốt chặn thật nằm ở can_edit() dưới RLS; ở đây chỉ để giao diện khỏi mời người
     ta bấm một nút chắc chắn bị từ chối. */
  const trialEnd = company?.trialEndsAt ? new Date(company.trialEndsAt) : null;
  const expired = company?.plan === "trial" && trialEnd != null && trialEnd <= new Date();
  const trialDaysLeft = company?.plan === "trial" && trialEnd
    ? Math.ceil((trialEnd - new Date()) / 864e5)
    : null;

  const canEdit = role !== "viewer" && !expired;
  const isOwner = role !== "viewer" && role !== "editor";

  /* Được vào agent nào. Owner luôn vào hết; agents null (chưa phân, hoặc CSDL chưa
     có cột) cũng mở hết — cùng quy ước fail-open, chốt chặn thật là has_agent() ở RLS. */
  const canUse = (id) => isOwner || agents == null || agents.includes(id);

  return <CompanyContext.Provider value={{ company, role, agents, canEdit, isOwner, canUse, expired, trialDaysLeft, loading, refresh, fxTick }}>{children}</CompanyContext.Provider>;
}
