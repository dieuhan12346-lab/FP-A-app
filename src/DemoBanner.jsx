import React from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Sparkles, ArrowRight, CalendarClock } from "lucide-react";

/** Dải banner nổi ở đáy màn hình của BẢN DEMO gửi khách hàng.
 *  Link chỉnh qua env của project demo trên Vercel:
 *  - VITE_MAIN_APP_URL  → bản chính để tự đăng ký (mặc định fp-a-app.vercel.app)
 *  - VITE_CONTACT_URL   → đặt lịch tư vấn cho khách lớn (Zalo/Calendly/mailto) */
const MAIN_URL = import.meta.env.VITE_MAIN_APP_URL || "https://fp-a-app.vercel.app";
const CONTACT_URL = import.meta.env.VITE_CONTACT_URL || "mailto:dieuhan12346@gmail.com?subject=T%C6%B0%20v%E1%BA%A5n%20Ph%E1%BA%A7n%20m%E1%BB%81m%20D%C3%B2ng%20Ti%E1%BB%81n";

export default function DemoBanner() {
  const { t } = useTranslation();
  const btn = { display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 9, fontSize: 12, fontWeight: 800, textDecoration: "none", whiteSpace: "nowrap" };
  return createPortal(
    <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 99999, display: "flex", alignItems: "center", justifyContent: "center", gap: 12, padding: "9px 16px", fontFamily: "system-ui", fontSize: 12.5, color: "#1a1206", background: "linear-gradient(90deg, #F5B83D, #E8974B)", boxShadow: "0 -4px 18px rgba(0,0,0,.35)", flexWrap: "wrap" }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
        <Sparkles size={14} />
        <b>{t("demo.banner.title")}</b>
        <span>· {t("demo.banner.desc")}</span>
      </span>
      <a href={MAIN_URL} target="_blank" rel="noreferrer" style={{ ...btn, color: "#F5B83D", background: "#1a1206" }}>
        {t("demo.banner.signup")}<ArrowRight size={13} />
      </a>
      <a href={CONTACT_URL} target="_blank" rel="noreferrer" style={{ ...btn, color: "#1a1206", background: "rgba(255,255,255,.35)", border: "1px solid rgba(26,18,6,.35)" }}>
        <CalendarClock size={13} />{t("demo.banner.book")}
      </a>
    </div>,
    document.body
  );
}
