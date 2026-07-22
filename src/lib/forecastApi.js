import { supabase } from "./supabase";

/* Gọi dịch vụ dự báo dòng tiền (XGBoost) trên Railway.
   Gửi kèm access_token của user để service verify JWT + kiểm quyền công ty. */

const FORECAST_URL = (import.meta.env.VITE_FORECAST_URL || "https://luxora-forecast-production.up.railway.app").replace(/\/$/, "");

/** Trả về dự báo cho company_id, hoặc { empty:true } nếu chưa có giao dịch. Ném lỗi nếu auth/mạng hỏng. */
export async function fetchForecast(companyId, openingBalanceMillions, horizon = 13) {
  if (!supabase || !companyId) return null;
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new Error("Chưa đăng nhập");
  let res;
  try {
    res = await fetch(`${FORECAST_URL}/forecast`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ company_id: companyId, opening_balance: Number(openingBalanceMillions) || 0, horizon }),
    });
  } catch (e) {
    throw new Error("Không kết nối được dịch vụ dự báo");
  }
  if (res.status === 404) return { empty: true };            // chưa có giao dịch để dự báo
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Dịch vụ dự báo lỗi ${res.status}${t ? ": " + t.slice(0, 120) : ""}`);
  }
  return res.json();
}
