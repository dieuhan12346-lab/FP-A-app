import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { fetchMyCompany } from "./lib/company";
import { supabase } from "./lib/supabase";
import { applyCompanyLanguageDefault } from "./i18n";

export const CompanyContext = createContext({ company: null, loading: true, refresh: async () => {} });

export function useCompany() {
  return useContext(CompanyContext);
}

export function CompanyProvider({ children }) {
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!supabase) { setCompany(null); setLoading(false); return; }
    setLoading(true);
    try {
      const c = await fetchMyCompany();
      setCompany(c);
      if (c) applyCompanyLanguageDefault(c.language);
    } catch {
      setCompany(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return <CompanyContext.Provider value={{ company, loading, refresh }}>{children}</CompanyContext.Provider>;
}
