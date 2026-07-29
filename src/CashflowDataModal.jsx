import React, { useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { X, Plus, Wallet, TrendingUp, TrendingDown, Check, RotateCcw, FileSpreadsheet } from "lucide-react";
import { addReceivable, addPayable, setReceivableStatus, setPayableStatus, deleteReceivable, deletePayable, saveOpeningCash } from "./lib/cashflow";
import LedgerImportSection from "./LedgerImportSection";
import { fmtMoney, moneySymbol } from "./lib/money";
import { booksCurrencyFor, chartFor } from "./lib/regionDefaults";

const C = { panel: "#111E33", panel2: "rgba(255,255,255,.04)", line: "rgba(255,255,255,.09)", txt: "#E8EEF9", sub: "#8CA0BE", green: "#26C287", gold: "#E8B34B", red: "#F26D6D", cyan: "#39B8D8" };

const inp = { padding: "8px 11px", borderRadius: 9, fontSize: 12.5, color: C.txt, background: "rgba(255,255,255,.05)", border: `1px solid ${C.line}`, outline: "none", fontFamily: "inherit" };

export default function CashflowDataModal({ company, companyId, data, onChanged, onClose, asPage = false }) {
  const { t } = useTranslation();
  const currency = company?.currency || "VND";
  const books = booksCurrencyFor(company?.country);
  const fmtAmt = (v) => fmtMoney(Number(v) || 0, currency, books);
  const cashAccts = chartFor(company?.statutoryStandard || "VAS") === "VAS" ? "111+112" : "1000+1100";
  const [err, setErr] = useState("");
  const [opening, setOpening] = useState(data?.openingCash ?? 0);
  const [savingOpen, setSavingOpen] = useState(false);
  const [rForm, setRForm] = useState({ customer: "", amount: "", dueDate: "", email: "" });
  const [pForm, setPForm] = useState({ label: "", amount: "", dueDate: "", category: "supplier" });
  const CATS = ["supplier", "payroll", "tax", "other"];

  const receivables = data?.receivables || [];
  const payables = data?.payables || [];

  const run = async (fn) => {
    setErr("");
    try { await fn(); onChanged(); }
    catch (ex) { setErr(ex.message); }
  };

  const [openSaved, setOpenSaved] = useState(false);
  const saveOpening = () => {
    setErr(""); setOpenSaved(false); setSavingOpen(true);
    saveOpeningCash(companyId, Number(opening) || 0)
      .then(() => { setOpenSaved(true); onChanged(); setTimeout(() => setOpenSaved(false), 2500); })
      .catch((ex) => setErr(ex.message))
      .finally(() => setSavingOpen(false));
  };

  const addR = () => {
    if (!rForm.customer.trim() || !rForm.amount || !rForm.dueDate) { setErr(t("cf.data.err.fill")); return; }
    run(async () => {
      await addReceivable(companyId, { customer: rForm.customer.trim(), amount: Number(rForm.amount) || 0, dueDate: rForm.dueDate, customerEmail: rForm.email.trim() });
      setRForm({ customer: "", amount: "", dueDate: "", email: "" });
    });
  };

  const addP = () => {
    if (!pForm.label.trim() || !pForm.amount || !pForm.dueDate) { setErr(t("cf.data.err.fill")); return; }
    run(async () => {
      await addPayable(companyId, { label: pForm.label.trim(), amount: Number(pForm.amount) || 0, dueDate: pForm.dueDate, category: pForm.category });
      setPForm({ label: "", amount: "", dueDate: "", category: pForm.category });
    });
  };

  // Dòng data dùng ĐÚNG grid như hàng nhập ở trên → cột canh thẳng dưới từng ô nhập.
  const ROW_COLS_RECV = "minmax(0,1.3fr) minmax(0,0.8fr) 116px minmax(0,1.1fr) 72px";
  const ROW_COLS_PAY = "minmax(0,1.4fr) minmax(0,1fr) 130px 128px 78px";
  const Row = ({ item, isRecv }) => {
    const paid = item.status === "paid";
    const iconBtn = (color, bordered) => ({ display: "grid", placeItems: "center", width: 26, height: 26, borderRadius: 7, border: `1px solid ${bordered || "transparent"}`, cursor: "pointer", color, background: "transparent", flex: "0 0 auto", fontFamily: "inherit" });
    return (
      <div style={{ display: "grid", gridTemplateColumns: isRecv ? ROW_COLS_RECV : ROW_COLS_PAY, gap: 8, alignItems: "center", padding: "7px 11px", borderRadius: 10, background: C.panel2, border: `1px solid ${C.line}`, opacity: paid ? 0.55 : 1 }}>
        {/* Nội dung / Khách hàng */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, fontSize: 12.5, fontWeight: 600 }}>
          <span style={{ textDecoration: paid ? "line-through" : "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{isRecv ? item.customer : item.label}</span>
          {isRecv && item.source === "invoice" && <span title={t("cf.data.fromInvoice")} style={{ flex: "0 0 auto", display: "inline-flex", alignItems: "center", gap: 3, fontSize: 9, fontWeight: 800, padding: "1px 5px", borderRadius: 5, color: C.cyan, background: C.cyan + "1c" }}><FileSpreadsheet size={9} />HĐ{item.invoiceNo ? " " + item.invoiceNo : ""}</span>}
        </div>
        {/* Số tiền */}
        <div className="tnum" style={{ fontSize: 12, fontWeight: 700, textAlign: "right", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{fmtAmt(item.amount)}</div>
        {/* Hạn */}
        <div className="tnum" style={{ fontSize: 11.5, color: C.sub, whiteSpace: "nowrap" }}>{item.dueDate}</div>
        {/* Cột 4: email khách (Phải thu) | loại chi (Phải chi) */}
        {isRecv
          ? <div title={item.customerEmail || ""} style={{ minWidth: 0, fontSize: 11, color: item.customerEmail ? C.sub : C.line, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.customerEmail || "—"}</div>
          : <div style={{ minWidth: 0 }}><span style={{ display: "inline-block", maxWidth: "100%", fontSize: 9.5, fontWeight: 800, padding: "2px 7px", borderRadius: 5, color: C.gold, background: C.gold + "1c", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", verticalAlign: "middle" }}>{t("cf.cat." + (item.category || "other"))}</span></div>}
        {/* Hành động (canh dưới nút + Thêm) */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 5 }}>
          <button onClick={() => run(() => (isRecv ? setReceivableStatus : setPayableStatus)(item.id, paid ? "open" : "paid"))}
            title={paid ? t("cf.data.reopen") : t("cf.data.markPaid")}
            style={iconBtn(paid ? C.sub : C.green, paid ? C.line : C.green + "55")}>
            {paid ? <RotateCcw size={13} /> : <Check size={13} />}
          </button>
          <button onClick={() => run(() => (isRecv ? deleteReceivable : deletePayable)(item.id))} title={t("cf.data.del")}
            style={iconBtn(C.red)}><X size={13} /></button>
        </div>
      </div>
    );
  };

  const box = (
      <div style={{ width: "100%", maxWidth: asPage ? 920 : 660, maxHeight: asPage ? "none" : "92vh", overflowY: "auto", margin: asPage ? "0 auto" : undefined, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 18, padding: "24px 24px 20px", color: C.txt, fontFamily: "system-ui" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 4 }}>
          <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: "-0.02em" }}>{t("cf.data.title")}</div>
          <button onClick={onClose} style={{ border: "none", background: "transparent", color: C.sub, cursor: "pointer", padding: 4 }}><X size={18} /></button>
        </div>
        <div style={{ fontSize: 12, color: C.sub, marginBottom: 18, lineHeight: 1.5 }}>{t("cf.data.subtitle")}</div>

        {err && <div style={{ marginBottom: 14, padding: "9px 13px", borderRadius: 9, fontSize: 12.5, color: C.red, background: C.red + "14", border: `1px solid ${C.red}44` }}>⚠ {err}</div>}

        {/* Nhập sổ quỹ từ ERP (MISA) → bảng transactions, nguồn lịch sử cho dự báo */}
        <LedgerImportSection companyId={companyId} onImported={onChanged} C={C} inp={inp} currency={currency} books={books} />

        {/* Số dư đầu kỳ */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
          <Wallet size={15} color={C.gold} />
          <span style={{ fontSize: 13, fontWeight: 700 }}>{t("cf.data.opening", { accts: cashAccts })}</span>
          <input className="tnum" type="number" min="0" step="1000000" value={opening} onChange={(e) => setOpening(e.target.value)} style={{ ...inp, width: 180, textAlign: "right" }} />
          <span style={{ fontSize: 11, color: C.sub }}>{moneySymbol(currency)}</span>
          <button onClick={saveOpening} disabled={savingOpen} style={{ padding: "8px 16px", borderRadius: 9, border: "none", cursor: "pointer", fontWeight: 800, fontSize: 12, color: "#06251a", background: C.green, opacity: savingOpen ? 0.6 : 1, fontFamily: "inherit" }}>{savingOpen ? "…" : t("cf.data.save")}</button>
          {openSaved && <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 700, color: C.green }}><Check size={13} />{t("cf.data.saved")}</span>}
        </div>

        {/* Phải thu */}
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 9 }}>
          <TrendingUp size={15} color={C.green} />
          <span style={{ fontSize: 13.5, fontWeight: 800 }}>{t("cf.data.recv")}</span>
          <span style={{ fontSize: 11, color: C.sub }}>· {receivables.length}</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: ROW_COLS_RECV, gap: 8, marginBottom: 10 }}>
          <input style={inp} placeholder={t("cf.data.customer")} value={rForm.customer} onChange={(e) => setRForm({ ...rForm, customer: e.target.value })} />
          <input className="tnum" style={inp} type="number" min="0" placeholder={t("cf.data.amount", { cur: moneySymbol(currency) })} value={rForm.amount} onChange={(e) => setRForm({ ...rForm, amount: e.target.value })} />
          <input className="tnum" style={inp} type="date" value={rForm.dueDate} onChange={(e) => setRForm({ ...rForm, dueDate: e.target.value })} />
          <input style={inp} type="email" placeholder={t("cf.data.email")} value={rForm.email} onChange={(e) => setRForm({ ...rForm, email: e.target.value })} />
          <button onClick={addR} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5, borderRadius: 9, border: `1px dashed ${C.green}66`, cursor: "pointer", fontWeight: 700, fontSize: 12, color: C.green, background: "transparent", fontFamily: "inherit" }}><Plus size={13} />{t("cf.data.add")}</button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 22 }}>
          {receivables.length === 0 && <div style={{ fontSize: 12, color: C.sub, padding: "6px 2px" }}>{t("cf.data.recv.empty")}</div>}
          {receivables.map((r) => <Row key={r.id} item={r} isRecv />)}
        </div>

        {/* Phải chi */}
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 9 }}>
          <TrendingDown size={15} color={C.red} />
          <span style={{ fontSize: 13.5, fontWeight: 800 }}>{t("cf.data.pay")}</span>
          <span style={{ fontSize: 11, color: C.sub }}>· {payables.length}</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.4fr) minmax(0,1fr) 130px 128px 78px", gap: 8, marginBottom: 10 }}>
          <input style={inp} placeholder={t("cf.data.label")} value={pForm.label} onChange={(e) => setPForm({ ...pForm, label: e.target.value })} />
          <input className="tnum" style={inp} type="number" min="0" placeholder={t("cf.data.amount", { cur: moneySymbol(currency) })} value={pForm.amount} onChange={(e) => setPForm({ ...pForm, amount: e.target.value })} />
          <input className="tnum" style={inp} type="date" value={pForm.dueDate} onChange={(e) => setPForm({ ...pForm, dueDate: e.target.value })} />
          <select style={inp} value={pForm.category} onChange={(e) => setPForm({ ...pForm, category: e.target.value })}>
            {CATS.map((c) => <option key={c} value={c}>{t("cf.cat." + c)}</option>)}
          </select>
          <button onClick={addP} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5, borderRadius: 9, border: `1px dashed ${C.red}66`, cursor: "pointer", fontWeight: 700, fontSize: 12, color: C.red, background: "transparent", fontFamily: "inherit" }}><Plus size={13} />{t("cf.data.add")}</button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {payables.length === 0 && <div style={{ fontSize: 12, color: C.sub, padding: "6px 2px" }}>{t("cf.data.pay.empty")}</div>}
          {payables.map((p) => <Row key={p.id} item={p} isRecv={false} />)}
        </div>

        <div style={{ marginTop: 16, fontSize: 11, color: C.sub, lineHeight: 1.55 }}>{t("cf.data.note")}</div>
      </div>
  );
  if (asPage) return box;
  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 100000, background: "rgba(4,8,16,.72)", backdropFilter: "blur(3px)", display: "grid", placeItems: "center", padding: 20 }} onClick={onClose}>
      {box}
    </div>,
    document.body
  );
}
