import type { Promotion } from "../services/promotionApi";

type PromotionDiscount = Pick<Promotion, "type" | "value" | "valueType" | "maxDiscountAmount">;
type PromotionEligibility = Pick<
  Promotion,
  "minimumOrderAmount" | "minBookingValue" | "minRoomValue" | "minServiceValue" | "active" | "status"
> & Partial<Pick<Promotion, "startDate" | "endDate" | "type" | "value" | "valueType">> & { used?: boolean; isUsed?: boolean };

type PromotionEligibilityOptions = {
  alreadyApplied?: boolean;
  applyAt?: string | null;
};

const promotionDateTimestamp = (value: string | undefined, endOfDay = false) => {
  if (!value) return Number.NaN;
  const dateValue = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? `${value}T${endOfDay ? "23:59:59.999" : "00:00:00"}`
    : value;
  return new Date(dateValue).getTime();
};

export const promotionEligibilityMessage = (
  promotion: PromotionEligibility,
  orderTotal: number,
  roomTotal: number,
  serviceTotal: number,
  options: PromotionEligibilityOptions = {},
) => {
  const failures: string[] = [];
  const bookingMinimum = Math.max(Number(promotion.minimumOrderAmount ?? 0), Number(promotion.minBookingValue ?? 0));
  const roomMinimum = Number(promotion.minRoomValue ?? 0);
  const serviceMinimum = Number(promotion.minServiceValue ?? 0);

  if (bookingMinimum > orderTotal) failures.push(`Tổng booking cần đạt ${bookingMinimum.toLocaleString("vi-VN")}đ`);
  if (roomMinimum > roomTotal) failures.push(`Tiền phòng cần đạt ${roomMinimum.toLocaleString("vi-VN")}đ`);
  if (serviceMinimum > serviceTotal) failures.push(`Tiền dịch vụ cần đạt ${serviceMinimum.toLocaleString("vi-VN")}đ`);

  const status = String(promotion.status ?? "").toUpperCase();
  const startTimestamp = promotionDateTimestamp(promotion.startDate);
  const endTimestamp = promotionDateTimestamp(promotion.endDate, true);
  const now = Date.now();
  const isExpired = status === "EXPIRED" || (Number.isFinite(endTimestamp) && endTimestamp < now);
  const appliedAtTimestamp = options.applyAt ? new Date(options.applyAt).getTime() : Number.NaN;
  const wasAppliedDuringValidity = options.alreadyApplied
    && Number.isFinite(appliedAtTimestamp)
    && Number.isFinite(startTimestamp)
    && Number.isFinite(endTimestamp)
    && appliedAtTimestamp >= startTimestamp
    && appliedAtTimestamp <= endTimestamp;
  const canReuseExpiredPromotion = isExpired && wasAppliedDuringValidity;

  if (
    status === "INACTIVE"
    || status === "DRAFT"
    || ((isExpired || promotion.active === false) && !canReuseExpiredPromotion)
    || (!options.alreadyApplied && Number.isFinite(startTimestamp) && startTimestamp > now)
  ) {
    failures.push("Mã khuyến mãi không còn hiệu lực");
  }
  if (!options.alreadyApplied && (promotion.used === true || promotion.isUsed === true)) {
    failures.push("Mã khuyến mãi này đã được sử dụng");
  }

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