"""
Lõi dự báo dòng tiền theo tuần.
Mô hình: detrend tuyến tính + XGBoost học phần dư (residual) → cây không phải
ngoại suy xu hướng (điểm yếu chí mạng của tree khi chuỗi tăng dần). Tự backtest
theo thời gian ra MAPE, và LÙI VỀ baseline khi dữ liệu quá mỏng (nói thật, không bịa ML).

Chạy thử:  uv run --with xgboost --with scikit-learn --with numpy --with pandas python ml-service/forecast.py
"""
from __future__ import annotations
import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression
from xgboost import XGBRegressor

MIN_ML_WEEKS = 26          # < ngần này tuần → XGBoost overfit → dùng baseline
FEATS = ["lag1", "lag2", "lag3", "lag4", "rmean4", "rstd4", "wom", "month", "quarter", "monthend"]


def _to_monday_index(dates) -> pd.DatetimeIndex:
    return pd.DatetimeIndex(pd.to_datetime(dates))


def _feature_frame(resid: np.ndarray, idx: pd.DatetimeIndex) -> pd.DataFrame:
    df = pd.DataFrame({"y": resid}, index=idx)
    for L in (1, 2, 3, 4):
        df[f"lag{L}"] = df["y"].shift(L)
    df["rmean4"] = df["y"].shift(1).rolling(4).mean()
    df["rstd4"] = df["y"].shift(1).rolling(4).std()
    df["wom"] = ((df.index.day - 1) // 7 + 1).astype(int)     # tuần trong tháng
    df["month"] = df.index.month
    df["quarter"] = df.index.quarter
    df["monthend"] = (df.index.day >= 24).astype(int)          # tuần cuối tháng (lương/thuế)
    return df


def _fit_and_forecast(idx: pd.DatetimeIndex, y: np.ndarray, horizon: int):
    """Detrend + XGBoost trên phần dư, dự báo đệ quy `horizon` tuần."""
    n = len(y)
    t = np.arange(n).reshape(-1, 1)
    lr = LinearRegression().fit(t, y)
    resid = y - lr.predict(t)

    feat = _feature_frame(resid, idx).dropna()
    Xtr, ytr = feat[FEATS], feat["y"]
    model = XGBRegressor(
        n_estimators=200, learning_rate=0.05, max_depth=3,
        subsample=0.85, colsample_bytree=0.9, random_state=42, n_jobs=1,
    )
    model.fit(Xtr, ytr)

    fdates = pd.date_range(idx[-1] + pd.Timedelta(weeks=1), periods=horizon, freq="W-MON")
    hist = pd.Series(resid, index=idx)
    preds: list[float] = []
    for i, d in enumerate(fdates):
        s = pd.concat([hist, pd.Series(preds, index=fdates[:i])]) if preds else hist
        row = {
            "lag1": s.iloc[-1], "lag2": s.iloc[-2], "lag3": s.iloc[-3], "lag4": s.iloc[-4],
            "rmean4": s.iloc[-4:].mean(), "rstd4": s.iloc[-4:].std(ddof=1),
            "wom": (d.day - 1) // 7 + 1, "month": d.month, "quarter": d.quarter,
            "monthend": int(d.day >= 24),
        }
        preds.append(float(model.predict(pd.DataFrame([row])[FEATS])[0]))

    future_trend = lr.predict(np.arange(n, n + horizon).reshape(-1, 1))
    fc = np.maximum(0.0, np.array(preds) + future_trend)       # dòng tiền không âm
    return fc, fdates


def _backtest(idx, y, horizon):
    """Giữ lại `h` tuần cuối, train phần còn lại, dự báo đệ quy, so sai số."""
    h = min(horizon, max(4, len(y) // 5))
    if len(y) - h < 16:
        return None
    fc, _ = _fit_and_forecast(idx[:-h], y[:-h], h)
    actual = y[-h:]
    err = actual - fc[:h]
    mask = actual != 0
    mape = float(np.mean(np.abs(err[mask] / actual[mask])) * 100) if mask.any() else None
    return {"mape": mape, "mae": float(np.mean(np.abs(err))), "resid_std": float(np.std(err)), "steps": int(h)}


def _baseline(idx, y, horizon):
    """Mức phẳng = trung bình min(8, n) tuần gần nhất."""
    lvl = float(np.mean(y[-min(8, len(y)):]))
    fdates = pd.date_range(idx[-1] + pd.Timedelta(weeks=1), periods=horizon, freq="W-MON")
    return np.full(horizon, max(0.0, lvl)), fdates


def forecast_series(dates, values, horizon=13):
    """Dự báo một chuỗi tuần (inflow hoặc outflow). Trả về dict JSON-able."""
    idx = _to_monday_index(dates)
    y = np.asarray(values, dtype=float)
    n = len(y)
    if n < 8:
        fdates = pd.date_range((idx[-1] if n else pd.Timestamp.today()) + pd.Timedelta(weeks=1), periods=horizon, freq="W-MON")
        last = float(y[-1]) if n else 0.0
        return {"model": "insufficient", "reason": f"chỉ {n} tuần dữ liệu", "dates": [d.date().isoformat() for d in fdates], "forecast": [max(0.0, last)] * horizon, "backtest": None}
    if n < MIN_ML_WEEKS:
        fc, fdates = _baseline(idx, y, horizon)
        return {"model": "baseline", "reason": f"cần ≥{MIN_ML_WEEKS} tuần cho XGBoost, hiện {n}", "dates": [d.date().isoformat() for d in fdates], "forecast": [float(v) for v in fc], "backtest": None}
    fc, fdates = _fit_and_forecast(idx, y, horizon)
    bt = _backtest(idx, y, horizon)
    return {"model": "xgboost", "weeks_history": n, "dates": [d.date().isoformat() for d in fdates], "forecast": [float(v) for v in fc], "backtest": bt}


def forecast_cashflow(weekly, horizon=13, opening_balance=0.0):
    """weekly: [{weekStart, inflow, outflow}] → dự báo in/out + đường số dư + khoảng tin cậy."""
    weekly = sorted(weekly, key=lambda w: w["weekStart"])
    dates = [w["weekStart"] for w in weekly]
    fin = forecast_series(dates, [w.get("inflow", 0) for w in weekly], horizon)
    fout = forecast_series(dates, [w.get("outflow", 0) for w in weekly], horizon)

    inflow, outflow, fdates = fin["forecast"], fout["forecast"], fin["dates"]
    net = [inflow[i] - outflow[i] for i in range(horizon)]
    bal, cur = [], float(opening_balance)
    for v in net:
        cur += v
        bal.append(cur)

    # khoảng tin cậy: từ resid_std của backtest (nở theo căn bậc hai của horizon)
    std_in = (fin.get("backtest") or {}).get("resid_std") or 0.0
    std_out = (fout.get("backtest") or {}).get("resid_std") or 0.0
    std_net = (std_in ** 2 + std_out ** 2) ** 0.5
    lo, hi, run = [], [], 0.0
    for i in range(horizon):
        run += std_net ** 2
        w = 1.64 * (run ** 0.5)      # ~90% một phía cộng dồn
        lo.append(bal[i] - w)
        hi.append(bal[i] + w)

    return {
        "horizon": horizon,
        "dates": fdates,
        "inflow": inflow, "outflow": outflow, "net": net,
        "balance": bal, "balance_lo": lo, "balance_hi": hi,
        "model_in": fin["model"], "model_out": fout["model"],
        "mape_in": (fin.get("backtest") or {}).get("mape"),
        "mape_out": (fout.get("backtest") or {}).get("mape"),
        "notes": {"in": fin.get("reason"), "out": fout.get("reason")},
    }


# --------------------- chạy thử với dữ liệu tổng hợp ---------------------
if __name__ == "__main__":
    rng = np.random.default_rng(7)

    def synth(n_weeks, base, growth, season_amp, noise):
        idx = pd.date_range("2024-01-01", periods=n_weeks, freq="W-MON")
        t = np.arange(n_weeks)
        season = season_amp * np.sin(2 * np.pi * (idx.month - 1) / 12)   # mùa vụ theo tháng
        monthend = np.where(idx.day >= 24, season_amp * 0.6, 0)          # đỉnh cuối tháng
        y = base + growth * t + season + monthend + rng.normal(0, noise, n_weeks)
        return idx, np.maximum(0, y)

    print("=== A. Chuỗi 2 năm (104 tuần), có xu hướng tăng + mùa vụ → XGBoost ===")
    idx, y = synth(104, base=300, growth=1.4, season_amp=60, noise=25)
    r = forecast_series([d.date().isoformat() for d in idx], y, horizon=13)
    print("model:", r["model"], "| backtest:", r["backtest"])
    print("mean lịch sử 8 tuần cuối: %.0f | dự báo tuần +1..+13: %s" % (np.mean(y[-8:]), [round(v) for v in r["forecast"]]))
    trend_ok = r["forecast"][-1] > np.max(y[:-13])   # ngoại suy được vượt đỉnh cũ?
    print("→ Ngoại suy vượt đỉnh lịch sử (tree thường KHÔNG làm được):", trend_ok)

    print("\n=== B. Chuỗi ngắn 12 tuần → phải LÙI baseline ===")
    idx2, y2 = synth(12, base=400, growth=0, season_amp=30, noise=20)
    r2 = forecast_series([d.date().isoformat() for d in idx2], y2, horizon=13)
    print("model:", r2["model"], "| lý do:", r2["reason"])

    print("\n=== C. forecast_cashflow đầy đủ (in/out → số dư) ===")
    weekly = [{"weekStart": d.date().isoformat(),
               "inflow": float(y[i]),
               "outflow": float(max(0, 0.9 * y[i] + rng.normal(0, 20)))} for i, d in enumerate(idx)]
    fc = forecast_cashflow(weekly, horizon=13, opening_balance=500)
    print("model in/out:", fc["model_in"], "/", fc["model_out"])
    print("MAPE in/out: %s / %s" % (round(fc["mape_in"], 1) if fc["mape_in"] else None,
                                    round(fc["mape_out"], 1) if fc["mape_out"] else None))
    print("số dư dự báo 13 tuần:", [round(v) for v in fc["balance"]])
    print("\nOK — lõi dự báo chạy được." )
