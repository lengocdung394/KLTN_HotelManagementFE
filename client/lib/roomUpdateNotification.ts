import { localizedText } from "../i18n";

type RoomChange = {
  field?: unknown;
  label?: unknown;
  before?: unknown;
  after?: unknown;
  oldValue?: unknown;
  newValue?: unknown;
};

const normalizeText = (value: string) =>
  value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase().replace(/\s+/g, " ").trim();

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

const localizeEntityName = (name: string) => {
  const normalized = normalizeText(name);
  const prefixes: Array<[string, string]> = [
    ["chinh sach phong", "Room policy"],
    ["cau hinh gia va suc chua phong", "Room pricing and capacity policy"],
    ["cau hinh gia", "Room pricing configuration"],
    ["cau hinh", "Configuration"],
    ["phong", "Room"],
    ["toa nha", "Building"],
    ["tang", "Floor"],
    ["dich vu", "Service"],
    ["nhan vien", "Employee"],
  ];
  const prefix = prefixes.find(([vietnamese]) =>
    normalized === vietnamese || normalized.startsWith(`${vietnamese} `),
  );
  if (!prefix) return name;
  const remainder = name.slice(prefix[0].length);
  return `${prefix[1]}${remainder}`.replace(/\bthuộc\b/gi, "in");
};

const localizeFieldName = (name: string) => {
  const fieldNames: Record<string, string> = {
    "area": "Area",
    "dien tich": "Area",
    "baseprice": "Base price",
    "gia": "Price",
    "gia co ban": "Base price",
    "price": "Price",
    "roomtype": "Room type",
    "loai phong": "Room type",
    "mo ta": "Description",
    "extraadultfee": "Extra adult fee",
    "phu thu nguoi lon": "Extra adult fee",
    "extrachildfee": "Extra child fee",
    "phu thu tre em": "Extra child fee",
    "capacity": "Capacity",
    "standardcapacity": "Standard capacity",
    "suc chua": "Capacity",
    "maxextraguests": "Maximum extra guests",
    "trang thai": "Status",
  };
  return fieldNames[normalizeText(name)] ?? name;
};

const localizeEntityUpdateDescription = (description: string) => {
  const match = description.match(
    /^(.*?)\s+(được thêm mới|được chỉnh sửa|được cập nhật|đã được cập nhật)(?:\s+tại khách sạn\s+#?([^:]+?))?(?:\s*:\s*(.*?))?\.?$/i,
  );
  if (!match) return description;

  const [, entityName, rawAction, hotelName, rawChanges] = match;
  const action = normalizeText(rawAction) === "duoc them moi" ? "was added" : "was updated";
  const changes = rawChanges
    ? rawChanges.split(/\s*;\s*/).map((change) => {
        const separatorIndex = change.indexOf(":");
        if (separatorIndex < 0) return change;
        const fieldName = change.slice(0, separatorIndex);
        return `${localizeFieldName(fieldName)}:${change.slice(separatorIndex + 1)}`;
      }).join("; ")
    : "";
  const location = hotelName ? ` at hotel ${hotelName.trim()}` : "";
  return `${localizeEntityName(entityName)} ${action}${location}${changes ? `: ${changes}` : ""}.`;
};

const ENGLISH_NOTIFICATION_TITLES: Record<string, string> = {
  BOOKING_CREATED: "New booking",
  BOOKING_UPDATED: "Booking updated",
  BOOKING_CANCELLED: "Booking cancelled",
  BOOKING_REFUND_REQUESTED: "Refund requested",
  BOOKING_REFUND_COMPLETED: "Refund completed",
  PAYMENT_RECEIVED: "Payment received",
  ROOM_CREATED: "New room",
  ROOM_UPDATED: "Room updated",
  BUILDING_CREATED: "New building",
  BUILDING_UPDATED: "Building updated",
  FLOOR_CREATED: "New floor",
  FLOOR_UPDATED: "Floor updated",
  ROOM_POLICY_CREATED: "New room policy",
  ROOM_POLICY_UPDATED: "Room policy updated",
  EMPLOYEE_CREATED: "New employee",
  EMPLOYEE_UPDATED: "Employee updated",
  PROMOTION_CREATED: "New promotion",
  PROMOTION_UPDATED: "Promotion updated",
  SERVICE_CREATED: "New service",
  SERVICE_UPDATED: "Service updated",
  SERVICE_IMPORT_COMPLETED: "Service import completed",
  SERVICE_IMPORT_FAILED: "Service import failed",
  HOUSEKEEPING_TASK_ASSIGNED: "Housekeeping task assigned",
  HOUSEKEEPING_TASK_REASSIGNED: "Housekeeping task reassigned",
  HOUSEKEEPING_TASK_COMPLETED: "Housekeeping task completed",
  SYSTEM: "System notification",
};

export const localizeNotificationTitle = (type: string, title: string) =>
  localizedText(title, ENGLISH_NOTIFICATION_TITLES[type] ?? title);

export const localizeNotificationDescription = (type: string, description: string) => {
  if (type === "ROOM_POLICY_CREATED") {
    const createdPolicy = description.match(
      /^Cấu hình giá và sức chứa phòng(?:\s+(.+?))?\s+mới vừa được thêm vào chi nhánh\.?$/i,
    );
    if (createdPolicy) {
      const roomType = createdPolicy[1]?.trim();
      return localizedText(
        description,
        `A new room pricing and capacity policy${roomType ? ` for ${roomType}` : ""} was added to the branch.`,
      );
    }
  }
  if (type === "ROOM_POLICY_UPDATED") {
    const updatedPolicy = description.match(
      /^Cấu hình giá và sức chứa phòng(?:\s+(.+?))?\s+(?:vừa được cập nhật|được cập nhật|đã được cập nhật)\.?$/i,
    );
    if (updatedPolicy) {
      const roomType = updatedPolicy[1]?.trim();
      return localizedText(
        description,
        `The room pricing and capacity policy${roomType ? ` for ${roomType}` : ""} was updated.`,
      );
    }
  }
  return localizedText(description, localizeEntityUpdateDescription(description));
};

export const formatEntityUpdateNotification = (value: unknown, entityName: string) => {
  const event = asRecord(value);
  const data = asRecord(event?.data) ?? event;
  const hotelId = event?.hotelId == null
    ? ""
    : localizedText(` tại khách sạn #${String(event.hotelId)}`, ` at hotel #${String(event.hotelId)}`);
  const action = String(event?.action ?? "").toUpperCase();
  const actionText = action === "CREATE" || action === "CREATED"
    ? localizedText("được thêm mới", "was added")
    : localizedText("được chỉnh sửa", "was updated");
  const changesValue = data?.changes ?? data?.changedFields;
  const changes = Array.isArray(changesValue) ? changesValue as RoomChange[] : [];
  const descriptions = changes.flatMap((change) => {
    const record = asRecord(change);
    if (!record) return [];
    const name = record.label ?? record.field;
    const before = record.before ?? record.oldValue;
    const after = record.after ?? record.newValue;
    if (name == null || before === undefined || after === undefined) return [];
    return [`${localizedText(String(name), localizeFieldName(String(name)))}: ${displayValue(before)} → ${displayValue(after)}`];
  });

  return descriptions.length > 0
    ? `${localizedText(entityName, localizeEntityName(entityName))} ${actionText}${hotelId}: ${descriptions.join("; ")}.`
    : `${localizedText(entityName, localizeEntityName(entityName))} ${actionText}${hotelId}.`;
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
    return localizedText(
      `${roomNumber || "Phòng"} đã dọn xong; trạng thái được cập nhật thành sẵn sàng.`,
      `${roomNumber || "Room"} has been cleaned and is now ready.`,
    );
  }
  return formatEntityUpdateNotification(value, roomNumber || "Phòng");
};

export const isHousekeepingCompletionUpdate = (value: unknown) =>
  String(asRecord(value)?.action ?? "").toUpperCase() === "HOUSEKEEPING_COMPLETED";

export const isCheckoutCompletionUpdate = (value: unknown) =>
  String(asRecord(value)?.action ?? "").toUpperCase() === "CHECKOUT_COMPLETED";
