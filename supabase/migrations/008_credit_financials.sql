-- 008 — Lưu số liệu Báo cáo tài chính (BCTC) của khách để chấm điểm tín dụng chuẩn ngân hàng.
-- Các mã số BCTC (TS ngắn hạn, Nợ ngắn hạn, Tổng nợ, LNST, Dòng tiền HĐKD...) lưu dạng jsonb;
-- app tự tính 9 tỷ số (Current/Quick/Nợ-TS/ICR/ROA/ROE/Vòng quay HTK/DSO/Dòng tiền-Nợ).
-- CHẠY: Supabase SQL Editor → dán → Run. Idempotent.

alter table public.credit_factors
  add column if not exists financials jsonb;
