import { supabase } from "./supabase";

/* Xuất TOÀN BỘ dữ liệu của một công ty ra một tệp JSON.
   Phục vụ quyền truy cập/mang theo dữ liệu, và để khách tự giữ bản sao khi rời dịch vụ.

   Việc gom dữ liệu nằm DƯỚI cơ sở dữ liệu (hàm export_company_data), không ở đây.
   Bản cũ chạy một loạt SELECT ngay trong trình duyệt, nên ẩn nút với người không
   phải Chủ sở hữu chỉ là che giao diện — mở devtools là gọi lại được. Nay hàm dưới
   CSDL tự kiểm is_owner() trước khi đọc, và ghi lại mỗi lần xuất vào audit_log. */

/** Gọi hàm xuất phía máy chủ. Ném lỗi nếu người gọi không phải Chủ sở hữu. */
export async function exportCompanyData(companyId) {
  if (!supabase) throw new Error("Bản dựng này chưa cấu hình Supabase");
  if (!companyId) throw new Error("Chưa xác định được hồ sơ công ty");

  const { data, error } = await supabase.rpc("export_company_data", { cid: companyId });
  if (error) {
    // Cố ý KHÔNG lùi về cách gom ở trình duyệt: làm vậy là dựng lại đúng lỗ hổng
    // vừa bịt. Thiếu hàm thì báo thẳng để người vận hành chạy migration.
    if (error.code === "PGRST202" || /schema cache|does not exist/i.test(error.message || "")) {
      throw new Error("Cơ sở dữ liệu chưa có hàm xuất dữ liệu — chạy migration 010_export_audit.sql trước.");
    }
    throw error;
  }
  return data;
}

/** Vài lần xuất gần nhất. Chỉ Chủ sở hữu đọc được (RLS); vai khác nhận mảng rỗng. */
export async function listAuditLog(companyId, limit = 8) {
  if (!supabase || !companyId) return [];
  const { data, error } = await supabase
    .from("audit_log")
    .select("id, email, action, detail, created_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];   // cơ sở dữ liệu cũ chưa có bảng — coi như chưa có nhật ký
  return data || [];
}

/** Tải object xuống máy dưới dạng tệp JSON. */
export function downloadJson(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
