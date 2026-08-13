import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { fetchMyCompany } from "./lib/company";
import { myRole } from "./lib/members";
import { supabase } from "./lib/supabase";
import { applyCompanyUiLanguage } from "./i18n";

export const CompanyContext = createContext({ company: null, role: null, canEdit: true, isOwner: true, loading: true, refresh: async () => {} });

export function useCompany() {
  return useContext(CompanyContext);
}

export function CompanyProvider({ children }) {
  const [company, setCompany] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fxTick, setFxTick] = useState(0);

  // Tỷ giá mới về từ API → render lại các số tiền đã quy đổi
  useEffect(() => {
    const onFx = () => setFxTick((v) => v + 1);
    window.addEventListener("fx-rates-updated", onFx);
    return () => window.removeEventListener("fx-rates-updated", onFx);
  }, []);

  const refresh = useCallback(async () => {
    if (!supabase) { setCompany(null); setRole(null); setLoading(false); return; }
    setLoading(true);
    try {
      const c = await fetchMyCompany();
      setCompany(c);
      if (c) applyCompanyUiLanguage(c);
      setRole(c ? await myRole(c.id) : null);
    } catch {
      setCompany(null);
      setRole(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  /* Chốt chặn quyền thật nằm ở RLS trong cơ sở dữ liệu. Hai cờ dưới chỉ để giao diện
     khỏi mời người ta bấm một nút chắc chắn báo lỗi — nên khi chưa biết vai (bản dựng
     demo, hoặc CSDL chưa có cột role) thì mở, không khoá nhầm người đang dùng bình thường. */
  const canEdit = role !== "viewer";
  const isOwner = role !== "viewer" && role !== "editor";

  return <CompanyContext.Provider value={{ company, role, canEdit, isOwner, loading, refresh, fxTick }}>{children}</CompanyContext.Provider>;
}
