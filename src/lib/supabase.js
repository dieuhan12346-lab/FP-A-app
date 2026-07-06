import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** null khi chưa cấu hình .env.local — app vẫn chạy, chỉ tắt phần lưu trữ */
export const supabase = url && anonKey ? createClient(url, anonKey) : null;
