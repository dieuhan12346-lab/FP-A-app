/** Chế độ bản demo gửi khách hàng.
 *  - Bản demo: deploy riêng với biến môi trường VITE_DEMO_MODE=true (không cần Supabase)
 *    → bỏ đăng nhập, mọi module chạy số minh họa, có banner "Bản demo".
 *  - Bản chính: không đặt biến này → bắt buộc đăng nhập, KHÔNG có số demo:
 *    module Dòng tiền chỉ hiện số thật của công ty (chưa nhập thì trống). */
export const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === "true";
