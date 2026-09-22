export type RoomDateRange = { checkIn: string; checkOut: string };

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
