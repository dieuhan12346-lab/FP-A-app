#!/usr/bin/env node
/**
 * Xoá TOÀN BỘ dữ liệu của một công ty khỏi cơ sở dữ liệu.
 * Dùng khi khách hàng chấm dứt dịch vụ và yêu cầu xoá dữ liệu.
 *
 * CỐ Ý KHÔNG ĐƯA VÀO GIAO DIỆN APP — thao tác không thể hoàn tác, phải do người vận hành chạy tay.
 *
 * Cách dùng:
 *   1) Xem trước (mặc định, KHÔNG xoá gì):
 *        node scripts/xoa-du-lieu-cong-ty.cjs <company_id>
 *   2) Xoá thật — phải gõ đúng tên công ty như trong cơ sở dữ liệu:
 *        node scripts/xoa-du-lieu-cong-ty.cjs <company_id> --confirm "Tên Công Ty ABC"
 *
 * Biến môi trường bắt buộc:
 *   SUPABASE_URL, SUPABASE_SERVICE_KEY
 *
 * LƯU Ý: script này KHÔNG xoá dữ liệu nằm ở bên thứ ba — nhật ký và nội dung
 * thư đã gửi vẫn còn trên hệ thống Resend. Phải yêu cầu Resend xoá riêng.
 */

const URL_ = (process.env.SUPABASE_URL || "").replace(/^<|>$/g, "").trim();
const KEY = (process.env.SUPABASE_SERVICE_KEY || "").replace(/^<|>$/g, "").trim();
const [, , companyId, ...rest] = process.argv;

const confirmIdx = rest.indexOf("--confirm");
const confirmName = confirmIdx >= 0 ? rest[confirmIdx + 1] : null;
const DRY = !confirmName;

/* Xoá con trước, cha sau. Bảng nào thêm mới thì bổ sung vào đây. */
const TABLES = [
  "reminder_log",
  "credit_factors",
  "transactions",
  "cashflow_settings",
  "payables",
  "receivables",
  "company_members",
];

const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

async function req(path, opts = {}) {
  const r = await fetch(`${URL_}/rest/v1/${path}`, { headers: H, ...opts });
  const text = await r.text();
  if (!r.ok) throw new Error(`${r.status} ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : [];
}

async function count(table, filter) {
  const r = await fetch(`${URL_}/rest/v1/${table}?${filter}&select=*`, {
    headers: { ...H, Prefer: "count=exact", Range: "0-0" },
  });
  if (!r.ok) return `lỗi ${r.status}`;
  const cr = r.headers.get("content-range") || "";
  return Number(cr.split("/")[1] ?? 0);
}

(async () => {
  if (!URL_ || !KEY) {
    console.error("✗ Thiếu SUPABASE_URL hoặc SUPABASE_SERVICE_KEY trong biến môi trường.");
    process.exit(1);
  }
  if (!companyId) {
    console.error("Cách dùng: node scripts/xoa-du-lieu-cong-ty.cjs <company_id> [--confirm \"Tên công ty\"]");
    process.exit(1);
  }

  // 1. Xác định công ty
  const rows = await req(`companies?id=eq.${companyId}&select=id,name`);
  if (!rows.length) { console.error(`✗ Không tìm thấy công ty có id ${companyId}`); process.exit(1); }
  const company = rows[0];

  console.log(`\nCông ty: ${company.name}`);
  console.log(`Mã:      ${company.id}\n`);

  // 2. Đếm dữ liệu sẽ bị xoá
  const uploads = await req(`invoice_uploads?company_id=eq.${companyId}&select=id`);
  const uploadIds = uploads.map((u) => u.id);

  console.log("Dữ liệu sẽ bị xoá:");
  let total = 0;
  for (const t of TABLES) {
    const n = await count(t, `company_id=eq.${companyId}`);
    if (typeof n === "number") total += n;
    console.log(`  ${t.padEnd(20)} ${n}`);
  }
  const nLines = uploadIds.length ? await count("invoice_lines", `upload_id=in.(${uploadIds.join(",")})`) : 0;
  console.log(`  ${"invoice_lines".padEnd(20)} ${nLines}`);
  console.log(`  ${"invoice_uploads".padEnd(20)} ${uploads.length}`);
  console.log(`  ${"companies".padEnd(20)} 1`);
  if (typeof nLines === "number") total += nLines;
  total += uploads.length + 1;
  console.log(`  ${"".padEnd(20)} ─────`);
  console.log(`  ${"TỔNG".padEnd(20)} ${total} bản ghi\n`);

  // 3. Dừng ở chế độ xem trước
  if (DRY) {
    console.log("● CHẾ ĐỘ XEM TRƯỚC — chưa xoá gì.");
    console.log(`  Muốn xoá thật, chạy lại kèm:  --confirm "${company.name}"\n`);
    return;
  }

  // 4. Chốt chặn: tên phải khớp tuyệt đối
  if (confirmName !== company.name) {
    console.error(`✗ Tên xác nhận không khớp.\n  Bạn gõ:      "${confirmName}"\n  Trong CSDL:  "${company.name}"\n  Không xoá gì.\n`);
    process.exit(1);
  }

  // 5. Xoá — con trước, cha sau
  console.log("Đang xoá…");
  for (const t of TABLES) {
    await req(`${t}?company_id=eq.${companyId}`, { method: "DELETE", headers: { ...H, Prefer: "return=minimal" } });
    console.log(`  ✓ ${t}`);
  }
  if (uploadIds.length) {
    await req(`invoice_lines?upload_id=in.(${uploadIds.join(",")})`, { method: "DELETE", headers: { ...H, Prefer: "return=minimal" } });
    console.log("  ✓ invoice_lines");
    await req(`invoice_uploads?company_id=eq.${companyId}`, { method: "DELETE", headers: { ...H, Prefer: "return=minimal" } });
    console.log("  ✓ invoice_uploads");
  }
  await req(`companies?id=eq.${companyId}`, { method: "DELETE", headers: { ...H, Prefer: "return=minimal" } });
  console.log("  ✓ companies");

  console.log(`\n✓ Đã xoá toàn bộ dữ liệu của "${company.name}".`);
  console.log("\n⚠ CHƯA XONG — còn dữ liệu ở bên thứ ba:");
  console.log("  • Resend vẫn giữ nhật ký và nội dung các thư nhắc nợ đã gửi → yêu cầu Resend xoá riêng.");
  console.log("  • Tài khoản đăng nhập (auth.users) không bị xoá → xoá thủ công trong Supabase nếu người dùng yêu cầu.");
  console.log("  • Bản sao lưu tự động của Supabase vẫn còn dữ liệu cho tới khi hết hạn lưu giữ.\n");
})().catch((e) => { console.error("\n✗ Lỗi:", e.message, "\n"); process.exit(1); });
