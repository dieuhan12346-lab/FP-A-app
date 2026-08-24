import { supabase } from "./supabase";

/* Quản lý thành viên công ty: mời · đổi vai · gỡ · nhận lời mời.
   Quyền thật do RLS ở tầng cơ sở dữ liệu quyết định — các hàm dưới chỉ là lớp gọi.
   Vai trò: owner (toàn quyền) · editor (nhập/sửa số liệu) · viewer (chỉ xem). */

export const ROLES = ["owner", "editor", "viewer"];

/* Agent phân quyền được. Trùng id với NAV trong app.
   Dòng tiền và FP&A nằm trong danh sách này vì chúng LÀ báo cáo tổng quan toàn công
   ty — thứ mà nhân sự cấp nhân viên không mặc nhiên được xem. */
export const AGENTS = ["cashflow", "fpa", "ops", "credit", "collect", "invoice"];

/* Phạm vi bản ghi nhìn thấy trong một agent: cả công ty, hay chỉ phần mình nhập. */
export const SCOPES = ["all", "own"];

/** Đặt phạm vi dữ liệu cho một thành viên. */
export async function setMemberScope(companyId, userId, scope) {
  if (!SCOPES.includes(scope)) throw new Error("Phạm vi không hợp lệ");
  const { error } = await db().from("company_members")
    .update({ data_scope: scope }).eq("company_id", companyId).eq("user_id", userId);
  if (error) throw error;
}

/** Vai + danh sách agent của chính mình. agents = null nghĩa là toàn quyền. */
export async function myAccess(companyId) {
  if (!supabase || !companyId) return { role: null, agents: null };
  const { data: u } = await supabase.auth.getUser();
  const uid = u?.user?.id;
  if (!uid) return { role: null, agents: null };
  const { data, error } = await supabase
    .from("company_members").select("role, agents")
    .eq("company_id", companyId).eq("user_id", uid).maybeSingle();
  if (error) {
    // CSDL chưa có cột agents → thử lại chỉ với role, đừng khoá người đang dùng
    const { data: d2 } = await supabase
      .from("company_members").select("role")
      .eq("company_id", companyId).eq("user_id", uid).maybeSingle();
    return { role: d2?.role || null, agents: null };
  }
  return { role: data?.role || null, agents: data?.agents ?? null };
}

/** Đặt danh sách agent cho một thành viên. null = toàn quyền. */
export async function setMemberAgents(companyId, userId, agents) {
  const list = agents === null ? null : AGENTS.filter((a) => agents.includes(a));
  const { error } = await db().from("company_members")
    .update({ agents: list }).eq("company_id", companyId).eq("user_id", userId);
  if (error) throw error;
}

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

/** Danh sách thành viên. Owner thấy tất cả; vai khác chỉ thấy dòng của mình (do RLS).
 *  Chọn cột theo kiểu lùi dần: CSDL chưa chạy migration mới thì thiếu agents/data_scope,
 *  select thẳng sẽ lỗi và danh sách thành viên im lặng thành rỗng — đã dính đúng lỗi
 *  này một lần với cột email, không lặp lại. */
export async function listMembers(companyId) {
  if (!supabase || !companyId) return [];
  const COLS = [
    "user_id, role, email, agents, data_scope, created_at",
    "user_id, role, email, agents, created_at",
    "user_id, role, email, created_at",
    "user_id, role, created_at",
  ];
  let last;
  for (const cols of COLS) {
    const { data, error } = await supabase
      .from("company_members").select(cols)
      .eq("company_id", companyId).order("created_at");
    if (!error) return data || [];
    last = error;
  }
  throw last;
}

/** Lời mời đang chờ của công ty (chỉ owner đọc được). */
export async function listInvites(companyId) {
  if (!supabase || !companyId) return [];
  const COLS = [
    "id, email, role, agents, data_scope, created_at, expires_at, accepted_at",
    "id, email, role, created_at, expires_at, accepted_at",   // CSDL chưa chạy 020
  ];
  let last;
  for (const cols of COLS) {
    const { data, error } = await supabase
      .from("company_invites").select(cols)
      .eq("company_id", companyId).is("accepted_at", null).order("created_at", { ascending: false });
    if (!error) return (data || []).filter((i) => new Date(i.expires_at) > new Date());
    last = error;
  }
  throw last;
}

/** Mời một người, KÈM quyền họ sẽ có khi vào. Mời lại cùng email thì ghi đè và gia hạn.
 *  Quyền nằm trên lời mời để accept_invite chép sang — client không tự khai được. */
export async function inviteMember(companyId, email, role = "viewer", agents = [], scope = "all") {
  const mail = String(email || "").trim().toLowerCase();
  if (!mail.includes("@")) throw new Error("Email không hợp lệ");
  if (!ROLES.includes(role)) throw new Error("Vai trò không hợp lệ");
  if (!SCOPES.includes(scope)) throw new Error("Phạm vi không hợp lệ");
  const expires = new Date(Date.now() + 14 * 864e5).toISOString();
  const row = {
    company_id: companyId, email: mail, role, expires_at: expires, accepted_at: null,
    agents: AGENTS.filter((a) => (agents || []).includes(a)), data_scope: scope,
  };
  let { error } = await db().from("company_invites").upsert(row, { onConflict: "company_id,email" });
  if (error) {
    // CSDL chưa chạy 020 → mời được nhưng chưa mang theo quyền, owner tick sau
    const { agents: _a, data_scope: _s, ...bare } = row;
    ({ error } = await db().from("company_invites").upsert(bare, { onConflict: "company_id,email" }));
  }
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

/** Lời mời đang chờ dành cho chính mình (dùng để hiện lời nhắc sau khi đăng nhập).
 *  Qua hàm my_invites() vì RLS của companies không cho người chưa-là-thành-viên đọc
 *  tên công ty — join thẳng từ client sẽ ra "(chưa rõ tên)". */
export async function listMyInvites() {
  if (!supabase) return [];

  const { data, error } = await supabase.rpc("my_invites");
  if (!error) {
    return (data || []).map((i) => ({
      id: i.id, companyId: i.company_id, role: i.role,
      companyName: i.company_name || "", invitedBy: i.invited_by || "",
    }));
  }

  // CSDL chưa chạy migration 013 → vẫn hiện lời mời, chỉ thiếu tên công ty + người mời.
  // Ở đây lùi được vì bản cũ không lộ thêm gì, chỉ hiển thị kém hơn.
  // Nhưng PHẢI kêu ra: đường lui này im lặng thì mọi lỗi của hàm đều trông y hệt
  // "chưa chạy migration", và đó chính là cách một lỗi thật lẩn được cả buổi.
  console.warn("[Luxora] my_invites() lỗi, dùng cách cũ (sẽ thiếu tên công ty):", error);

  const fb = await supabase
    .from("company_invites")
    .select("id, company_id, role, expires_at, companies(name)")
    .is("accepted_at", null);
  if (fb.error) return [];
  return (fb.data || [])
    .filter((i) => new Date(i.expires_at) > new Date())
    .map((i) => ({ id: i.id, companyId: i.company_id, role: i.role, companyName: i.companies?.name || "" }));
}

/** Nhận lời mời. Vai trò lấy từ chính lời mời ở phía máy chủ — client không truyền vai vào được. */
export async function acceptInvite(inviteId) {
  const { error } = await db().rpc("accept_invite", { inv_id: inviteId });
  if (error) throw error;
}
