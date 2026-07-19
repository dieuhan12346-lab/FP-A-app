import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import "./i18n";
import { supabase } from "./lib/supabase";

const C = { bg: "#0B1526", panel: "#111E33", line: "rgba(255,255,255,.09)", txt: "#E8EEF9", sub: "#8CA0BE", green: "#26C287", red: "#F26D6D" };

const inputStyle = {
  width: "100%", padding: "11px 14px", borderRadius: 10, fontSize: 14,
  color: C.txt, background: "rgba(255,255,255,.05)", border: `1px solid ${C.line}`, outline: "none",
};

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.6 6 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.8 1.1 8 3l5.7-5.7C34.6 6 29.6 4 24 4c-7.6 0-14.1 4.3-17.7 10.7z" />
      <path fill="#4CAF50" d="M24 44c5.5 0 10.5-2.1 14.3-5.6l-6.6-5.6C29.6 34.6 27 35.5 24 35.5c-5.2 0-9.6-3.3-11.2-7.9l-6.6 5.1C9.8 39.6 16.3 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.6l6.6 5.6C40.5 36.5 44 31 44 24c0-1.3-.1-2.7-.4-3.5z" />
    </svg>
  );
}

export default function AuthGate({ children }) {
  const { t } = useTranslation();
  const [session, setSession] = useState(undefined); // undefined = đang kiểm tra
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  // Xoá phần hash rác OAuth để lại sau đăng nhập Google (#access_token=... hoặc chỉ "#").
  // App không dùng hash để routing nên cắt đi vô hại — chỉ để URL sạch.
  const cleanAuthHash = () => {
    // App KHÔNG dùng hash để routing → mọi hash đều là rác OAuth: #access_token=…, #error=…,
    // hoặc "#" trơ Supabase để lại sau khi nuốt token. Với "#" trơ, location.hash === "" nên
    // phải kiểm thêm href.endsWith("#").
    if (window.location.hash || window.location.href.endsWith("#")) {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  };

  useEffect(() => {
    if (!supabase) { setSession(null); return; }
    // Hoãn 1 nhịp: Supabase xử lý token trong URL bất đồng bộ, dọn ngay lúc mount là quá sớm.
    const t = setTimeout(cleanAuthHash, 0);
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => { setSession(s); cleanAuthHash(); });
    return () => { clearTimeout(t); sub.subscription.unsubscribe(); };
  }, []);

  // Chưa cấu hình .env.local: cho app chạy bình thường, hiện nhắc nhở nhỏ
  if (!supabase) {
    return (
      <>
        {children}
        <div style={{ position: "fixed", bottom: 14, right: 14, zIndex: 9999, fontSize: 12, color: "#FBBF24", background: "#1F2937", border: "1px solid #FBBF2444", padding: "8px 14px", borderRadius: 10, fontFamily: "system-ui" }}>
          {t("auth.notConfigured")}
        </div>
      </>
    );
  }

  if (session === undefined) {
    return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: C.bg, color: C.sub, fontFamily: "system-ui" }}>{t("auth.checkingSession")}</div>;
  }

  if (!session) {
    const submit = async (e) => {
      e.preventDefault();
      setErr(""); setNotice(""); setBusy(true);
      try {
        if (mode === "signup") {
          const { data, error } = await supabase.auth.signUp({ email, password: pw, options: { data: { display_name: name.trim() } } });
          if (error) throw error;
          if (!data.session) setNotice(t("auth.signupNotice"));
        } else {
          const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
          if (error) throw error;
        }
      } catch (ex) {
        setErr(ex.message === "Invalid login credentials" ? t("auth.err.badCredentials") : ex.message);
      } finally { setBusy(false); }
    };

    const signInWithGoogle = async () => {
      setErr(""); setNotice("");
      try {
        const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin } });
        if (error) throw error;
      } catch (ex) {
        setErr(ex.message);
      }
    };

    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: C.bg, fontFamily: "system-ui", padding: 20 }}>
        <form onSubmit={submit} style={{ width: "100%", maxWidth: 380, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 18, padding: "30px 28px", color: C.txt }}>
          <div style={{ fontSize: 21, fontWeight: 800, letterSpacing: "-0.02em" }}>{t("auth.title")}</div>
          <div style={{ fontSize: 13, color: C.sub, marginTop: 5, marginBottom: 22 }}>
            {mode === "signin" ? t("auth.subtitle.signin") : t("auth.subtitle.signup")}
          </div>

          <button type="button" onClick={signInWithGoogle} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 9, padding: "11px 0", borderRadius: 10, border: `1px solid ${C.line}`, cursor: "pointer", fontWeight: 700, fontSize: 13.5, color: C.txt, background: "rgba(255,255,255,.04)" }}>
            <GoogleIcon />{t("auth.google")}
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "18px 0", color: C.sub, fontSize: 11.5 }}>
            <div style={{ flex: 1, height: 1, background: C.line }} />{t("auth.orGoogle")}<div style={{ flex: 1, height: 1, background: C.line }} />
          </div>

          {mode === "signup" && <>
            <label style={{ fontSize: 12.5, color: C.sub, display: "block", marginBottom: 6 }}>{t("auth.name")}</label>
            <input style={{ ...inputStyle, marginBottom: 14 }} type="text" required minLength={2} value={name} onChange={(e) => setName(e.target.value)} placeholder={t("auth.name.ph")} />
          </>}
          <label style={{ fontSize: 12.5, color: C.sub, display: "block", marginBottom: 6 }}>{t("auth.email")}</label>
          <input style={inputStyle} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("auth.email.ph")} />
          <label style={{ fontSize: 12.5, color: C.sub, display: "block", margin: "14px 0 6px" }}>{t("auth.password")}</label>
          <input style={inputStyle} type="password" required minLength={6} value={pw} onChange={(e) => setPw(e.target.value)} placeholder="••••••••" />
          {err && <div style={{ marginTop: 12, fontSize: 12.5, color: C.red }}>{err}</div>}
          {notice && <div style={{ marginTop: 12, fontSize: 12.5, color: C.green }}>{notice}</div>}
          <button type="submit" disabled={busy} style={{ width: "100%", marginTop: 20, padding: "12px 0", borderRadius: 10, border: "none", cursor: "pointer", fontWeight: 800, fontSize: 14, color: "#06251a", background: `linear-gradient(135deg, ${C.green}, #1FA877)`, opacity: busy ? 0.6 : 1 }}>
            {busy ? t("auth.processing") : mode === "signin" ? t("auth.signin") : t("auth.signup")}
          </button>
          <div style={{ marginTop: 16, fontSize: 12.5, color: C.sub, textAlign: "center" }}>
            {mode === "signin" ? t("auth.noAccount") : t("auth.haveAccount")}
            <a onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setErr(""); setNotice(""); }} style={{ color: C.green, cursor: "pointer", fontWeight: 700 }}>
              {mode === "signin" ? t("auth.signup") : t("auth.signin")}
            </a>
          </div>
        </form>
      </div>
    );
  }

  return children;
}
