import { localizedText } from "../i18n";

type RoomChange = {
  field?: unknown;
  label?: unknown;
  before?: unknown;
  after?: unknown;
  oldValue?: unknown;
  newValue?: unknown;
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

const displayValue = (value: unknown) => {
  if (value == null || value === "") return "—";
  if (Array.isArray(value)) return value.map(displayValue).join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

export const formatEntityUpdateNotification = (value: unknown, entityName: string) => {
  const event = asRecord(value);
  const data = asRecord(event?.data) ?? event;
  const hotelId = event?.hotelId == null ? "" : ` tại khách sạn #${String(event.hotelId)}`;
  const action = String(event?.action ?? "").toUpperCase();
  const actionText = action === "CREATE" || action === "CREATED" ? "được thêm mới" : "được chỉnh sửa";
  const changesValue = data?.changes ?? data?.changedFields;
  const changes = Array.isArray(changesValue) ? changesValue as RoomChange[] : [];
  const descriptions = changes.flatMap((change) => {
    const record = asRecord(change);
    if (!record) return [];
    const name = record.label ?? record.field;
    const before = record.before ?? record.oldValue;
    const after = record.after ?? record.newValue;
    if (name == null || before === undefined || after === undefined) return [];
    return [`${String(name)}: ${displayValue(before)} → ${displayValue(after)}`];
  });

  return descriptions.length > 0
    ? `${entityName} ${actionText}${hotelId}: ${descriptions.join("; ")}.`
    : `${entityName} ${actionText}${hotelId}.`;
};

export const formatRoomUpdateNotification = (value: unknown) => {
  const event = asRecord(value);
  const data = asRecord(event?.data) ?? event;
  const roomNumber = data?.roomNumber == null ? "" : `Phòng ${String(data.roomNumber)}`;
  const action = String(event?.action ?? "").toUpperCase();
  if (action === "CHECKOUT_COMPLETED") {
    return localizedText(
      `${roomNumber || "Phòng"} vừa check-out xong. Trạng thái phòng đã được cập nhật sang đang dọn dẹp trong mục dọn dẹp.`,
      `${roomNumber || "Room"} has just checked out. Its status was updated to cleaning in housekeeping.`,
    );
  }
  if (action === "HOUSEKEEPING_COMPLETED") {
    return `${roomNumber || "Phòng"} đã dọn xong; trạng thái được cập nhật thành sẵn sàng.`;
  }
  return formatEntityUpdateNotification(value, roomNumber || "Phòng");
};

export const isHousekeepingCompletionUpdate = (value: unknown) =>
  String(asRecord(value)?.action ?? "").toUpperCase() === "HOUSEKEEPING_COMPLETED";

export const isCheckoutCompletionUpdate = (value: unknown) =>
  String(asRecord(value)?.action ?? "").toUpperCase() === "CHECKOUT_COMPLETED";
