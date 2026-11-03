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
