export type RoomDateRange = { checkIn: string; checkOut: string };
export type ServicePriceSelection = {
  quantity: number;
  originalQuantity?: number;
  price?: number;
  isExisting?: boolean;
};

export type ServicePriceLine = {
  quantity: number;
  unitPrice: number;
  isAdditional: boolean;
};

export function roundVndAmount(amount: number) {
  return Math.round(amount);
}

export function getBookingTotalFromBreakdown({
  storedTotal,
  roomTotal,
  serviceTotal,
  surchargeTotal,
  discountTotal,
}: {
  storedTotal: number;
  roomTotal: number;
  serviceTotal: number;
  surchargeTotal: number;
  discountTotal: number;
}) {
  const expectedTotal = Math.max(0, roomTotal + serviceTotal + surchargeTotal - discountTotal);
  return roundVndAmount(Math.max(storedTotal, expectedTotal));
}

export function getBookingSurchargeBreakdown(details: readonly Record<string, unknown>[]) {
  return details.reduce((totals, detail) => {
    const status = String(detail.bookingStatusType ?? detail.bookingDetailStatus ?? detail.status ?? "").trim().toUpperCase();
    const isCancelled = status === "CANCELLED";
    const earlyFee = Number(detail.earlyCheckInFee ?? detail.earlyCheckinFee ?? 0);
    const lateFee = Number(detail.lateCheckOutFee ?? detail.lateCheckoutFee ?? detail.lateFee ?? 0);
    const otherSurcharges = Number(detail.otherSurcharges ?? 0);

    return {
      earlyCheckinFeeTotal: totals.earlyCheckinFeeTotal + (!isCancelled && Number.isFinite(earlyFee) ? earlyFee : 0),
      lateCheckoutFeeTotal: totals.lateCheckoutFeeTotal + (!isCancelled && Number.isFinite(lateFee) ? lateFee : 0),
      otherSurchargesTotal: totals.otherSurchargesTotal + (Number.isFinite(otherSurcharges) ? otherSurcharges : 0),
    };
  }, {
    earlyCheckinFeeTotal: 0,
    lateCheckoutFeeTotal: 0,
    otherSurchargesTotal: 0,
  });
}

export function getServiceQuantityForRoom(
  selection: { quantity: number; applyToRoom?: boolean },
  guestCount: number,
) {
  return selection.applyToRoom === true ? guestCount : selection.quantity;
}

export function getServicePriceBreakdown(
  selection: ServicePriceSelection,
  currentPrice: number,
): ServicePriceLine[] {
  const quantity = Math.max(0, Number(selection.quantity) || 0);
  const catalogPrice = Number.isFinite(currentPrice) ? currentPrice : 0;
  if (!selection.isExisting) {
    return quantity > 0 ? [{ quantity, unitPrice: catalogPrice, isAdditional: false }] : [];
  }

  const originalQuantity = Math.max(0, Number(selection.originalQuantity ?? quantity) || 0);
  const bookedQuantity = Math.min(quantity, originalQuantity);
  const additionalQuantity = Math.max(0, quantity - bookedQuantity);
  const bookedPrice = Number(selection.price ?? catalogPrice);
  return [
    ...(bookedQuantity > 0 ? [{ quantity: bookedQuantity, unitPrice: bookedPrice, isAdditional: false }] : []),
    ...(additionalQuantity > 0 ? [{ quantity: additionalQuantity, unitPrice: catalogPrice, isAdditional: true }] : []),
  ];
}

export function sumRoomPriceForRange<T extends { id: string }>(
  room: T,
  range: RoomDateRange,
  getPriceForDate: (room: T, date: string) => number,
  surchargePerNight: number = 0,
) {
  if (!range.checkIn || !range.checkOut || range.checkIn >= range.checkOut) {
    return 0;
  }

  let total = 0;
  for (let date = range.checkIn; date < range.checkOut; date = shiftDay(date, 1)) {
    total += getPriceForDate(room, date) + surchargePerNight;
  }

  return total;
}

export function shiftDay(dateStr: string, delta: number) {
  const date = new Date(`${dateStr}T00:00:00`);
  date.setDate(date.getDate() + delta);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
