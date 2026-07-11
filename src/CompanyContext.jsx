import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { fetchMyCompany } from "./lib/company";
import { supabase } from "./lib/supabase";
import { applyCompanyUiLanguage } from "./i18n";

export const CompanyContext = createContext({ company: null, loading: true, refresh: async () => {} });

export function useCompany() {
  return useContext(CompanyContext);
}

export function CompanyProvider({ children }) {
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fxTick, setFxTick] = useState(0);

  // Tỷ giá mới về từ API → render lại các số tiền đã quy đổi
  useEffect(() => {
    const onFx = () => setFxTick((v) => v + 1);
    window.addEventListener("fx-rates-updated", onFx);
    return () => window.removeEventListener("fx-rates-updated", onFx);
  }, []);

  const refresh = useCallback(async () => {
    if (!supabase) { setCompany(null); setLoading(false); return; }
    setLoading(true);
    try {
      const c = await fetchMyCompany();
      setCompany(c);
      if (c) applyCompanyUiLanguage(c);
    } catch {
      setCompany(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return <CompanyContext.Provider value={{ company, loading, refresh, fxTick }}>{children}</CompanyContext.Provider>;
}
