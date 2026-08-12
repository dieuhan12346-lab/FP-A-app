import { supabase } from "./supabase";

/* Quản lý thành viên công ty: mời · đổi vai · gỡ · nhận lời mời.
   Quyền thật do RLS ở tầng cơ sở dữ liệu quyết định — các hàm dưới chỉ là lớp gọi.
   Vai trò: owner (toàn quyền) · editor (nhập/sửa số liệu) · viewer (chỉ xem). */

export const ROLES = ["owner", "editor", "viewer"];

function db() {
  if (!supabase) throw new Error("Bản dựng này chưa cấu hình Supabase");
  return supabase;
}

/** Vai trò của chính mình trong một công ty. Trả null nếu không phải thành viên. */
export async function myRole(companyId) {
  if (!supabase || !companyId) return null;
  const { data: u } = await supabase.auth.getUser();
  const uid = u?.user?.id;
  if (!uid) return null;
  const { data, error } = await supabase
    .from("company_members").select("role")
    .eq("company_id", companyId).eq("user_id", uid).maybeSingle();
  if (error) return null;
  return data?.role || null;
}

/** Danh sách thành viên. Owner thấy tất cả; vai khác chỉ thấy dòng của mình (do RLS). */
export async function listMembers(companyId) {
  if (!supabase || !companyId) return [];
  const { data, error } = await supabase
    .from("company_members").select("user_id, role, email, created_at")
    .eq("company_id", companyId).order("created_at");
  if (error) throw error;
  return data || [];
}

/** Lời mời đang chờ của công ty (chỉ owner đọc được). */
export async function listInvites(companyId) {
  if (!supabase || !companyId) return [];
  const { data, error } = await supabase
    .from("company_invites").select("id, email, role, created_at, expires_at, accepted_at")
    .eq("company_id", companyId).is("accepted_at", null).order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).filter((i) => new Date(i.expires_at) > new Date());
}

/** Mời một người vào công ty. Mời lại cùng email thì ghi đè vai và gia hạn. */
export async function inviteMember(companyId, email, role = "viewer") {
  const mail = String(email || "").trim().toLowerCase();
  if (!mail.includes("@")) throw new Error("Email không hợp lệ");
  if (!ROLES.includes(role)) throw new Error("Vai trò không hợp lệ");
  const expires = new Date(Date.now() + 14 * 864e5).toISOString();
  const { error } = await db().from("company_invites").upsert(
    { company_id: companyId, email: mail, role, expires_at: expires, accepted_at: null },
    { onConflict: "company_id,email" }
  );
  if (error) throw error;
}

/** Huỷ một lời mời chưa dùng. */
export async function cancelInvite(inviteId) {
  const { error } = await db().from("company_invites").delete().eq("id", inviteId);
  if (error) throw error;
}

/** Đổi vai của một thành viên (chỉ owner). */
export async function changeRole(companyId, userId, role) {
  if (!ROLES.includes(role)) throw new Error("Vai trò không hợp lệ");
  const { error } = await db().from("company_members")
    .update({ role }).eq("company_id", companyId).eq("user_id", userId);
  if (error) throw error;
}

/** Gỡ thành viên khỏi công ty, đồng thời xoá lời mời cũ để họ không tự vào lại. */
export async function removeMember(companyId, userId, email) {
  const client = db();
  const { error } = await client.from("company_members")
    .delete().eq("company_id", companyId).eq("user_id", userId);
  if (error) throw error;
  if (email) {
    // lời mời còn hiệu lực sẽ cho họ tham gia lại — phải xoá kèm
    await client.from("company_invites")
      .delete().eq("company_id", companyId).eq("email", String(email).toLowerCase())
      .then(() => {}, () => {});
  }
}

/** Lời mời đang chờ dành cho chính mình (dùng để hiện lời nhắc sau khi đăng nhập). */
export async function listMyInvites() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("company_invites")
    .select("id, company_id, role, expires_at, companies(name)")
    .is("accepted_at", null);
  if (error) return [];
  return (data || [])
    .filter((i) => new Date(i.expires_at) > new Date())
    .map((i) => ({ id: i.id, companyId: i.company_id, role: i.role, companyName: i.companies?.name || "" }));
}

/** Nhận lời mời. Vai trò lấy từ chính lời mời ở phía máy chủ — client không truyền vai vào được. */
export async function acceptInvite(inviteId) {
  const { error } = await db().rpc("accept_invite", { inv_id: inviteId });
  if (error) throw error;
}
