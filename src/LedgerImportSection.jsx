import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import * as XLSX from "xlsx";
import { FileSpreadsheet, UploadCloud, Check, AlertTriangle, Trash2, SlidersHorizontal } from "lucide-react";
import { parseLedger, extractTransactions } from "./lib/ledgerImport";
import { saveLedgerImport, listLedgerImports, deleteLedgerImport } from "./lib/transactions";

/* Nhập sổ quỹ / sổ cái tiền từ file xuất ERP (MISA S07-DN…) → bảng transactions.
   Nhúng trong modal Dữ liệu dòng tiền. C, inp: style truyền từ modal cho đồng bộ. */
const FIELDS = [
  { k: "postDate", labelKey: "led.f.date" },
  { k: "in", labelKey: "led.f.in" },
  { k: "out", labelKey: "led.f.out" },
  { k: "desc", labelKey: "led.f.desc" },
  { k: "bal", labelKey: "led.f.bal" },
];

export default function LedgerImportSection({ companyId, onImported, C, inp, initialAoa = null, initialName = "" }) {
  const { t } = useTranslation();
  const fileRef = useRef();
  const [imports, setImports] = useState([]);
  const [st, setSt] = useState(null); // { fileName, aoa, start, columns, colIndex, txns, opening }
  const [showMap, setShowMap] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  const reload = () => { if (companyId) listLedgerImports(companyId).then(setImports).catch(() => {}); };
  useEffect(reload, [companyId]);
  // preview/demo: nạp sẵn một AOA để thấy giao diện chạy mà không cần upload
  useEffect(() => { if (initialAoa) loadAoa(initialAoa, initialName || "sample.xlsx"); /* eslint-disable-next-line */ }, []);

  const columnsFromAoa = (aoa, headerRow) => {
    const maxCols = aoa.reduce((m, r) => Math.max(m, (r || []).length), 0);
    const head = aoa[headerRow] || [];
    const sub = aoa[headerRow + 1] || [];          // phụ đề Thu/Chi/Tồn (header 2 tầng)
    const clean = (v) => String(v || "").replace(/[\r\n]+/g, " ").trim();
    return Array.from({ length: maxCols }, (_, j) => {
      const label = [clean(head[j]), clean(sub[j])].filter(Boolean).join(" — ");
      return { j, label: label || `${t("led.col")} ${j + 1}` };
    });
  };

  // Parse một AOA (từ file upload hoặc dữ liệu nạp sẵn) → cập nhật xem trước.
  const loadAoa = (aoa, fileName) => {
    setErr(""); setOk(""); setShowMap(false);
    try {
      const r = parseLedger(aoa);
      const headerRow = r.headerRow >= 0 ? r.headerRow : 0;
      const start = r.headerRow >= 0 ? r.start : headerRow + 1;
      const base = { fileName, aoa, start, columns: columnsFromAoa(aoa, headerRow), colIndex: { ...(r.colIndex || {}) }, txns: r.transactions || [], opening: r.openingBalance ?? null };
      setSt(base);
      if (r.headerRow < 0) { setErr(t("led.err.noHeader")); setShowMap(true); }
      else if (!base.txns.length) setShowMap(true);
    } catch (ex) { setErr(ex.message || String(ex)); }
  };

  const onFile = (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    setSt(null);
    const rd = new FileReader();
    rd.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target.result, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "" });
        loadAoa(aoa, f.name);
      } catch (ex) { setErr(ex.message || String(ex)); }
    };
    rd.readAsArrayBuffer(f);
    e.target.value = "";
  };

  const remap = (field, val) => {
    const colIndex = { ...st.colIndex, [field]: val === "" ? null : Number(val) };
    const { transactions, openingBalance } = extractTransactions(st.aoa, st.start, colIndex);
    setSt({ ...st, colIndex, txns: transactions, opening: openingBalance });
  };

  const save = () => {
    if (!st?.txns?.length) { setErr(t("led.err.noTxns")); return; }
    setBusy(true); setErr("");
    saveLedgerImport(companyId, { sourceFile: st.fileName, account: "111" }, st.txns)
      .then(({ count }) => { setOk(t("led.saved", { n: count })); setSt(null); setShowMap(false); reload(); onImported?.(); setTimeout(() => setOk(""), 3500); })
      .catch((ex) => setErr(ex.message))
      .finally(() => setBusy(false));
  };

  const del = (id) => { setErr(""); deleteLedgerImport(id).then(() => { reload(); onImported?.(); }).catch((ex) => setErr(ex.message)); };

  const stats = st ? (() => {
    const ds = st.txns.map((x) => x.date).sort();
    return {
      n: st.txns.length,
      from: ds[0], to: ds[ds.length - 1],
      tin: st.txns.reduce((s, x) => s + x.amtIn, 0),
      tout: st.txns.reduce((s, x) => s + x.amtOut, 0),
    };
  })() : null;

  const money = (v) => (Number(v) || 0).toLocaleString("vi-VN") + " ₫";
  const btn = (bg, col) => ({ padding: "8px 15px", borderRadius: 9, border: "none", cursor: "pointer", fontWeight: 800, fontSize: 12, color: col, background: bg, fontFamily: "inherit" });

  return (
    <div style={{ marginBottom: 22, padding: 14, borderRadius: 12, background: "rgba(255,255,255,.025)", border: `1px dashed ${C.cyan}55` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <FileSpreadsheet size={15} color={C.cyan} />
        <span style={{ fontSize: 13.5, fontWeight: 800 }}>{t("led.title")}</span>
        <span style={{ fontSize: 10, fontWeight: 800, color: C.cyan, background: C.cyan + "1c", padding: "2px 7px", borderRadius: 5 }}>MISA · S07-DN</span>
      </div>
      <div style={{ fontSize: 11.5, color: C.sub, marginBottom: 11, lineHeight: 1.5 }}>{t("led.desc")}</div>

      <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={onFile} style={{ display: "none" }} />
      <button onClick={() => fileRef.current?.click()} style={{ ...btn(C.cyan + "1c", C.cyan), display: "inline-flex", alignItems: "center", gap: 7, border: `1px solid ${C.cyan}55` }}>
        <UploadCloud size={14} />{t("led.upload")}
      </button>

      {err && <div style={{ marginTop: 11, padding: "8px 11px", borderRadius: 8, fontSize: 12, color: C.red, background: C.red + "14", border: `1px solid ${C.red}44`, display: "flex", gap: 7, alignItems: "flex-start" }}><AlertTriangle size={13} style={{ flex: "0 0 auto", marginTop: 1 }} />{err}</div>}
      {ok && <div style={{ marginTop: 11, padding: "8px 11px", borderRadius: 8, fontSize: 12, color: C.green, background: C.green + "14", border: `1px solid ${C.green}44`, display: "flex", gap: 7, alignItems: "center" }}><Check size={13} />{ok}</div>}

      {/* Xem trước sau khi parse */}
      {st && (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 10, background: "rgba(255,255,255,.03)", border: `1px solid ${C.line}` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: C.txt, wordBreak: "break-all" }}>{st.fileName}</span>
            <button onClick={() => setShowMap((s) => !s)} style={{ ...btn("transparent", C.sub), border: `1px solid ${C.line}`, display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 10px" }}><SlidersHorizontal size={12} />{t("led.remap")}</button>
          </div>

          {stats && stats.n > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 8, marginTop: 10 }}>
              <Stat C={C} label={t("led.st.txns")} val={stats.n} />
              <Stat C={C} label={t("led.st.range")} val={stats.from && stats.to ? `${stats.from} → ${stats.to}` : "—"} small />
              <Stat C={C} label={t("led.st.in")} val={money(stats.tin)} col={C.green} small />
              <Stat C={C} label={t("led.st.out")} val={money(stats.tout)} col={C.red} small />
              {st.opening != null && <Stat C={C} label={t("led.st.opening")} val={money(st.opening)} col={C.gold} small />}
            </div>
          )}
          {stats && stats.n === 0 && <div style={{ fontSize: 12, color: C.gold, marginTop: 9, display: "flex", gap: 6, alignItems: "center" }}><AlertTriangle size={13} />{t("led.err.noTxns")}</div>}

          {/* Map cột thủ công (dự phòng khi auto trượt) */}
          {showMap && (
            <div style={{ marginTop: 11, paddingTop: 11, borderTop: `1px solid ${C.line}` }}>
              <div style={{ fontSize: 11, color: C.sub, marginBottom: 8 }}>{t("led.mapHint")}</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 8 }}>
                {FIELDS.map((f) => (
                  <label key={f.k} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span style={{ fontSize: 10.5, color: C.sub }}>{t(f.labelKey)}</span>
                    <select value={st.colIndex[f.k] ?? ""} onChange={(e) => remap(f.k, e.target.value)} style={{ ...inp, padding: "6px 9px" }}>
                      <option value="">— {t("led.none")} —</option>
                      {st.columns.map((c) => <option key={c.j} value={c.j}>{c.label}</option>)}
                    </select>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button onClick={save} disabled={busy || !st.txns.length} style={{ ...btn(C.green, "#06251a"), opacity: busy || !st.txns.length ? 0.5 : 1, display: "inline-flex", alignItems: "center", gap: 6 }}><Check size={13} />{busy ? "…" : t("led.save", { n: st.txns.length })}</button>
            <button onClick={() => { setSt(null); setShowMap(false); setErr(""); }} style={{ ...btn("transparent", C.sub), border: `1px solid ${C.line}` }}>{t("led.cancel")}</button>
          </div>
        </div>
      )}

      {/* Lô đã nhập */}
      {imports.length > 0 && (
        <div style={{ marginTop: 13 }}>
          <div style={{ fontSize: 11, color: C.sub, marginBottom: 7 }}>{t("led.imports")} · {imports.length}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {imports.map((im) => (
              <div key={im.importId} style={{ display: "flex", alignItems: "center", gap: 9, padding: "7px 10px", borderRadius: 8, background: "rgba(255,255,255,.03)", border: `1px solid ${C.line}` }}>
                <FileSpreadsheet size={13} color={C.sub} style={{ flex: "0 0 auto" }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{im.sourceFile || t("led.batch")}</div>
                  <div className="tnum" style={{ fontSize: 10, color: C.sub, marginTop: 1 }}>{t("led.rows", { n: im.count })} · {im.from} → {im.to}</div>
                </div>
                <button onClick={() => del(im.importId)} title={t("led.del")} style={{ display: "grid", placeItems: "center", width: 24, height: 24, borderRadius: 6, border: "none", cursor: "pointer", color: C.red, background: "transparent" }}><Trash2 size={13} /></button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ C, label, val, col, small }) {
  return (
    <div style={{ padding: "8px 10px", borderRadius: 8, background: "rgba(255,255,255,.03)", border: `1px solid ${C.line}` }}>
      <div style={{ fontSize: 9.5, color: C.sub, textTransform: "uppercase", letterSpacing: ".04em" }}>{label}</div>
      <div className="tnum" style={{ fontSize: small ? 12 : 17, fontWeight: 800, color: col || C.txt, marginTop: 2 }}>{val}</div>
    </div>
  );
}
