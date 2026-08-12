-- 009 — Quyết định tín dụng cho từng khách: hạn mức ĐÃ DUYỆT + lịch rà soát lại.
-- Dùng cho 2 nút "Áp dụng hạn mức" / "Đặt lịch rà soát" trong module Chấm điểm tín dụng.
-- Hạn mức đã duyệt còn để cảnh báo khi dư nợ khách vượt hạn mức được cấp.
-- CHẠY: Supabase SQL Editor → dán → Run. Idempotent.

alter table public.credit_factors
  add column if not exists approved_limit numeric,      -- hạn mức đã duyệt (triệu)
  add column if not exists approved_at    timestamptz,  -- thời điểm duyệt
  add column if not exists approved_score int,          -- điểm tại thời điểm duyệt (để biết đã cũ chưa)
  add column if not exists review_at      date;         -- hạn rà soát lại
