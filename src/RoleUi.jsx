import React from "react";
import { useTranslation } from "react-i18next";
import { Eye } from "lucide-react";
import { useCompany } from "./CompanyContext";

/* Hiển thị vai "Chỉ xem". Quyền thật do RLS chặn ở tầng cơ sở dữ liệu — hai thành phần
   dưới chỉ để người dùng hiểu vì sao không thấy nút, thay vì tưởng app hỏng. */

const SUB = "#8CA0BE";
const LINE = "rgba(255,255,255,.09)";

/** Chip trên thanh tiêu đề — cho biết phiên này đang ở vai chỉ xem. */
export function RoBadge() {
  const { t } = useTranslation();
  return (
    <span title={t("ro.tip")} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 700, color: SUB, background: "rgba(255,255,255,.05)", border: `1px solid ${LINE}`, padding: "5px 11px", borderRadius: 20 }}>
      <Eye size={13} />{t("ro.badge")}
    </span>
  );
}

/** Dòng ghi chú thay chỗ cụm nút vừa bị ẩn. `k` chọn câu chữ cho đúng ngữ cảnh.
 *  Hết hạn dùng thử thì luôn ưu tiên câu về hết hạn — nói "vai Chỉ xem" với một
 *  người đang là Chủ sở hữu là sai hẳn nguyên nhân, họ sẽ đi tìm nhầm chỗ. */
export function RoNote({ k = "ro.note", style }) {
  const { t } = useTranslation();
  const { expired } = useCompany();
  if (expired) k = "ro.note.trial";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 13px", borderRadius: 10, fontSize: 12, color: SUB, background: "rgba(255,255,255,.03)", border: `1px dashed ${LINE}`, lineHeight: 1.5, ...style }}>
      <Eye size={14} style={{ flex: "0 0 auto" }} />{t(k)}
    </div>
  );
}
