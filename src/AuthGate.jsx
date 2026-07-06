import React, { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";

const C = { bg: "#0B1526", panel: "#111E33", line: "rgba(255,255,255,.09)", txt: "#E8EEF9", sub: "#8CA0BE", green: "#26C287", red: "#F26D6D" };

const inputStyle = {
  width: "100%", padding: "11px 14px", borderRadius: 10, fontSize: 14,
  color: C.txt, background: "rgba(255,255,255,.05)", border: `1px solid ${C.line}`, outline: "none",
};

export default function AuthGate({ children }) {
  const [session, setSession] = useState(undefined); // undefined = đang kiểm tra
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supabase) { setSession(null); return; }
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Chưa cấu hình .env.local: cho app chạy bình thường, hiện nhắc nhở nhỏ
  if (!supabase) {
    return (
      <>
        {children}
        <div style={{ position: "fixed", bottom: 14, right: 14, zIndex: 9999, fontSize: 12, color: "#FBBF24", background: "#1F2937", border: "1px solid #FBBF2444", padding: "8px 14px", borderRadius: 10, fontFamily: "system-ui" }}>
          ⚠ Chưa cấu hình Supabase — tạo file .env.local (xem .env.local.example)
        </div>
      </>
    );
  }

  if (session === undefined) {
    return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: C.bg, color: C.sub, fontFamily: "system-ui" }}>Đang kiểm tra phiên đăng nhập…</div>;
  }

  if (!session) {
    const submit = async (e) => {
      e.preventDefault();
      setErr(""); setNotice(""); setBusy(true);
      try {
        if (mode === "signup") {
          const { data, error } = await supabase.auth.signUp({ email, password: pw, options: { data: { display_name: name.trim() } } });
          if (error) throw error;
          if (!data.session) setNotice("Đã tạo tài khoản — kiểm tra email để xác nhận rồi đăng nhập.");
        } else {
          const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
          if (error) throw error;
        }
      } catch (ex) {
        setErr(ex.message === "Invalid login credentials" ? "Sai email hoặc mật khẩu" : ex.message);
      } finally { setBusy(false); }
    };
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: C.bg, fontFamily: "system-ui", padding: 20 }}>
        <form onSubmit={submit} style={{ width: "100%", maxWidth: 380, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 18, padding: "30px 28px", color: C.txt }}>
          <div style={{ fontSize: 21, fontWeight: 800, letterSpacing: "-0.02em" }}>Phần mềm Dòng Tiền</div>
          <div style={{ fontSize: 13, color: C.sub, marginTop: 5, marginBottom: 22 }}>
            {mode === "signin" ? "Đăng nhập để xem dữ liệu của bạn" : "Tạo tài khoản mới"}
          </div>
          {mode === "signup" && <>
            <label style={{ fontSize: 12.5, color: C.sub, display: "block", marginBottom: 6 }}>Tên đăng nhập</label>
            <input style={{ ...inputStyle, marginBottom: 14 }} type="text" required minLength={2} value={name} onChange={(e) => setName(e.target.value)} placeholder="Nguyễn Văn A" />
          </>}
          <label style={{ fontSize: 12.5, color: C.sub, display: "block", marginBottom: 6 }}>Email</label>
          <input style={inputStyle} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ban@congty.vn" />
          <label style={{ fontSize: 12.5, color: C.sub, display: "block", margin: "14px 0 6px" }}>Mật khẩu</label>
          <input style={inputStyle} type="password" required minLength={6} value={pw} onChange={(e) => setPw(e.target.value)} placeholder="••••••••" />
          {err && <div style={{ marginTop: 12, fontSize: 12.5, color: C.red }}>{err}</div>}
          {notice && <div style={{ marginTop: 12, fontSize: 12.5, color: C.green }}>{notice}</div>}
          <button type="submit" disabled={busy} style={{ width: "100%", marginTop: 20, padding: "12px 0", borderRadius: 10, border: "none", cursor: "pointer", fontWeight: 800, fontSize: 14, color: "#06251a", background: `linear-gradient(135deg, ${C.green}, #1FA877)`, opacity: busy ? 0.6 : 1 }}>
            {busy ? "Đang xử lý…" : mode === "signin" ? "Đăng nhập" : "Đăng ký"}
          </button>
          <div style={{ marginTop: 16, fontSize: 12.5, color: C.sub, textAlign: "center" }}>
            {mode === "signin" ? "Chưa có tài khoản? " : "Đã có tài khoản? "}
            <a onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setErr(""); setNotice(""); }} style={{ color: C.green, cursor: "pointer", fontWeight: 700 }}>
              {mode === "signin" ? "Đăng ký" : "Đăng nhập"}
            </a>
          </div>
        </form>
      </div>
    );
  }

  return children;
}
