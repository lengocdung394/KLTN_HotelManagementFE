import type { Promotion } from "../services/promotionApi";

type PromotionDiscount = Pick<Promotion, "type" | "value" | "valueType" | "maxDiscountAmount">;
type PromotionEligibility = Pick<
  Promotion,
  "minimumOrderAmount" | "minBookingValue" | "minRoomValue" | "minServiceValue" | "active" | "status"
> & { used?: boolean; isUsed?: boolean };

export const promotionEligibilityMessage = (
  promotion: PromotionEligibility,
  orderTotal: number,
  roomTotal: number,
  serviceTotal: number,
) => {
  const failures: string[] = [];
  const bookingMinimum = Math.max(Number(promotion.minimumOrderAmount ?? 0), Number(promotion.minBookingValue ?? 0));
  const roomMinimum = Number(promotion.minRoomValue ?? 0);
  const serviceMinimum = Number(promotion.minServiceValue ?? 0);

  if (bookingMinimum > orderTotal) failures.push(`Tổng booking cần đạt ${bookingMinimum.toLocaleString("vi-VN")}đ`);
  if (roomMinimum > roomTotal) failures.push(`Tiền phòng cần đạt ${roomMinimum.toLocaleString("vi-VN")}đ`);
  if (serviceMinimum > serviceTotal) failures.push(`Tiền dịch vụ cần đạt ${serviceMinimum.toLocaleString("vi-VN")}đ`);

  const status = String(promotion.status ?? "").toUpperCase();
  if (promotion.active === false || status === "INACTIVE" || status === "EXPIRED" || status === "DRAFT") {
    failures.push("Mã khuyến mãi không còn hiệu lực");
  }
  if (promotion.used === true || promotion.isUsed === true) failures.push("Mã khuyến mãi này đã được sử dụng");

  return failures.length > 0 ? `${failures.join("; ")}.` : "";
};

export const calculatePromotionDiscount = (
  promotion: PromotionDiscount,
  roomTotal: number,
  serviceTotal: number,
  subtotal: number,
) => {
  const scope = String(promotion.type ?? "TOTAL").toUpperCase();
  const baseAmount = Math.max(0, scope === "ROOM" ? roomTotal : scope === "SERVICE" ? serviceTotal : subtotal);
  const value = Math.max(0, Number(promotion.value) || 0);
  const isFixedAmount = String(promotion.valueType ?? "PERCENTAGE").toUpperCase().includes("FIXED");
  const discount = isFixedAmount ? value : Math.round(baseAmount * value / 100);
  const maxDiscountAmount = Number(promotion.maxDiscountAmount);
  const cappedDiscount = !isFixedAmount && Number.isFinite(maxDiscountAmount) && maxDiscountAmount > 0
    ? Math.min(discount, maxDiscountAmount)
    : discount;

  return Math.min(baseAmount, cappedDiscount);
};