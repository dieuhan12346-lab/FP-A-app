import React, { useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { X, Plus, Wallet, TrendingUp, TrendingDown, Check, RotateCcw, FileSpreadsheet } from "lucide-react";
import { addReceivable, addPayable, setReceivableStatus, setPayableStatus, deleteReceivable, deletePayable, saveOpeningCash } from "./lib/cashflow";

const C = { panel: "#111E33", panel2: "rgba(255,255,255,.04)", line: "rgba(255,255,255,.09)", txt: "#E8EEF9", sub: "#8CA0BE", green: "#26C287", gold: "#E8B34B", red: "#F26D6D", cyan: "#39B8D8" };

const inp = { padding: "8px 11px", borderRadius: 9, fontSize: 12.5, color: C.txt, background: "rgba(255,255,255,.05)", border: `1px solid ${C.line}`, outline: "none", fontFamily: "inherit" };

export default function CashflowDataModal({ companyId, data, onChanged, onClose }) {
  const { t } = useTranslation();
  const [err, setErr] = useState("");
  const [opening, setOpening] = useState(data?.openingCash ?? 0);
  const [savingOpen, setSavingOpen] = useState(false);
  const [rForm, setRForm] = useState({ customer: "", amount: "", dueDate: "" });
  const [pForm, setPForm] = useState({ label: "", amount: "", dueDate: "" });

  const receivables = data?.receivables || [];
  const payables = data?.payables || [];

  const run = async (fn) => {
    setErr("");
    try { await fn(); onChanged(); }
    catch (ex) { setErr(ex.message); }
  };

  const saveOpening = () => run(async () => {
    setSavingOpen(true);
    try { await saveOpeningCash(companyId, Number(opening) || 0); } finally { setSavingOpen(false); }
  });

  const addR = () => {
    if (!rForm.customer.trim() || !rForm.amount || !rForm.dueDate) { setErr(t("cf.data.err.fill")); return; }
    run(async () => {
      await addReceivable(companyId, { customer: rForm.customer.trim(), amount: Number(rForm.amount) || 0, dueDate: rForm.dueDate });
      setRForm({ customer: "", amount: "", dueDate: "" });
    });
  };

  const addP = () => {
    if (!pForm.label.trim() || !pForm.amount || !pForm.dueDate) { setErr(t("cf.data.err.fill")); return; }
    run(async () => {
      await addPayable(companyId, { label: pForm.label.trim(), amount: Number(pForm.amount) || 0, dueDate: pForm.dueDate });
      setPForm({ label: "", amount: "", dueDate: "" });
    });
  };

  const Row = ({ item, isRecv }) => {
    const paid = item.status === "paid";
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 11px", borderRadius: 10, background: C.panel2, border: `1px solid ${C.line}`, opacity: paid ? 0.55 : 1 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            <span style={{ textDecoration: paid ? "line-through" : "none" }}>{isRecv ? item.customer : item.label}</span>
            {isRecv && item.source === "invoice" && <span title={t("cf.data.fromInvoice")} style={{ flex: "0 0 auto", display: "inline-flex", alignItems: "center", gap: 3, fontSize: 9, fontWeight: 800, padding: "1px 5px", borderRadius: 5, color: C.cyan, background: C.cyan + "1c" }}><FileSpreadsheet size={9} />HĐ{item.invoiceNo ? " " + item.invoiceNo : ""}</span>}
          </div>
          <div className="tnum" style={{ fontSize: 10.5, color: C.sub, marginTop: 1 }}>{(Number(item.amount) || 0).toLocaleString("vi-VN")} ₫ · {t("cf.data.due")} {item.dueDate}</div>
        </div>
        <button onClick={() => run(() => (isRecv ? setReceivableStatus : setPayableStatus)(item.id, paid ? "open" : "paid"))}
          title={paid ? t("cf.data.reopen") : t("cf.data.markPaid")}
          style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 9px", borderRadius: 7, border: `1px solid ${paid ? C.line : C.green + "55"}`, cursor: "pointer", fontSize: 10.5, fontWeight: 700, color: paid ? C.sub : C.green, background: paid ? "transparent" : C.green + "14", fontFamily: "inherit" }}>
          {paid ? <><RotateCcw size={11} />{t("cf.data.reopen")}</> : <><Check size={11} />{t("cf.data.markPaid")}</>}
        </button>
        <button onClick={() => run(() => (isRecv ? deleteReceivable : deletePayable)(item.id))} title={t("cf.data.del")}
          style={{ display: "grid", placeItems: "center", width: 24, height: 24, borderRadius: 6, border: "none", cursor: "pointer", color: C.red, background: "transparent" }}><X size={13} /></button>
      </div>
    );
  };

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 100000, background: "rgba(4,8,16,.72)", backdropFilter: "blur(3px)", display: "grid", placeItems: "center", padding: 20 }} onClick={onClose}>
      <div style={{ width: "100%", maxWidth: 660, maxHeight: "92vh", overflowY: "auto", background: C.panel, border: `1px solid ${C.line}`, borderRadius: 18, padding: "24px 24px 20px", color: C.txt, fontFamily: "system-ui" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 4 }}>
          <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: "-0.02em" }}>{t("cf.data.title")}</div>
          <button onClick={onClose} style={{ border: "none", background: "transparent", color: C.sub, cursor: "pointer", padding: 4 }}><X size={18} /></button>
        </div>
        <div style={{ fontSize: 12, color: C.sub, marginBottom: 18, lineHeight: 1.5 }}>{t("cf.data.subtitle")}</div>

        {/* Số dư đầu kỳ */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
          <Wallet size={15} color={C.gold} />
          <span style={{ fontSize: 13, fontWeight: 700 }}>{t("cf.data.opening")}</span>
          <input className="tnum" type="number" min="0" step="1000000" value={opening} onChange={(e) => setOpening(e.target.value)} style={{ ...inp, width: 180, textAlign: "right" }} />
          <span style={{ fontSize: 11, color: C.sub }}>₫</span>
          <button onClick={saveOpening} disabled={savingOpen} style={{ padding: "8px 16px", borderRadius: 9, border: "none", cursor: "pointer", fontWeight: 800, fontSize: 12, color: "#06251a", background: C.green, opacity: savingOpen ? 0.6 : 1, fontFamily: "inherit" }}>{t("cf.data.save")}</button>
        </div>

        {/* Phải thu */}
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 9 }}>
          <TrendingUp size={15} color={C.green} />
          <span style={{ fontSize: 13.5, fontWeight: 800 }}>{t("cf.data.recv")}</span>
          <span style={{ fontSize: 11, color: C.sub }}>· {receivables.length}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
          {receivables.length === 0 && <div style={{ fontSize: 12, color: C.sub, padding: "6px 2px" }}>{t("cf.data.recv.empty")}</div>}
          {receivables.map((r) => <Row key={r.id} item={r} isRecv />)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.6fr) minmax(0,1fr) 150px 84px", gap: 8, marginBottom: 22 }}>
          <input style={inp} placeholder={t("cf.data.customer")} value={rForm.customer} onChange={(e) => setRForm({ ...rForm, customer: e.target.value })} />
          <input className="tnum" style={inp} type="number" min="0" placeholder={t("cf.data.amount")} value={rForm.amount} onChange={(e) => setRForm({ ...rForm, amount: e.target.value })} />
          <input className="tnum" style={inp} type="date" value={rForm.dueDate} onChange={(e) => setRForm({ ...rForm, dueDate: e.target.value })} />
          <button onClick={addR} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5, borderRadius: 9, border: `1px dashed ${C.green}66`, cursor: "pointer", fontWeight: 700, fontSize: 12, color: C.green, background: "transparent", fontFamily: "inherit" }}><Plus size={13} />{t("cf.data.add")}</button>
        </div>

        {/* Phải chi */}
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 9 }}>
          <TrendingDown size={15} color={C.red} />
          <span style={{ fontSize: 13.5, fontWeight: 800 }}>{t("cf.data.pay")}</span>
          <span style={{ fontSize: 11, color: C.sub }}>· {payables.length}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
          {payables.length === 0 && <div style={{ fontSize: 12, color: C.sub, padding: "6px 2px" }}>{t("cf.data.pay.empty")}</div>}
          {payables.map((p) => <Row key={p.id} item={p} isRecv={false} />)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.6fr) minmax(0,1fr) 150px 84px", gap: 8 }}>
          <input style={inp} placeholder={t("cf.data.label")} value={pForm.label} onChange={(e) => setPForm({ ...pForm, label: e.target.value })} />
          <input className="tnum" style={inp} type="number" min="0" placeholder={t("cf.data.amount")} value={pForm.amount} onChange={(e) => setPForm({ ...pForm, amount: e.target.value })} />
          <input className="tnum" style={inp} type="date" value={pForm.dueDate} onChange={(e) => setPForm({ ...pForm, dueDate: e.target.value })} />
          <button onClick={addP} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5, borderRadius: 9, border: `1px dashed ${C.red}66`, cursor: "pointer", fontWeight: 700, fontSize: 12, color: C.red, background: "transparent", fontFamily: "inherit" }}><Plus size={13} />{t("cf.data.add")}</button>
        </div>

        {err && <div style={{ marginTop: 14, fontSize: 12.5, color: C.red }}>{err}</div>}
        <div style={{ marginTop: 16, fontSize: 11, color: C.sub, lineHeight: 1.55 }}>{t("cf.data.note")}</div>
      </div>
    </div>,
    document.body
  );
}
