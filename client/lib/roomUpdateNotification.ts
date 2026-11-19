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
    /^(.*?)\s+(?:vừa\s+)?(được thêm mới|được chỉnh sửa|được cập nhật|đã được cập nhật)(?:\s+tại khách sạn\s+#?([^:]+?))?(?:\s*:\s*(.*?))?\.?$/i,
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

const ENGLISH_SERVICE_CATEGORIES: Record<string, string> = {
  "dịch vụ phòng": "Room service",
  "thể thao": "Sports",
  "nhà hàng": "Restaurant",
  "điện tử": "Electronics",
  "khác": "Other",
};

const localizeServiceDescription = (description: string) =>
  description
    .replace(/^Dịch vụ (?=")/i, "Service ")
    .replace(/\(mã /gi, "(ID ")
    .replace(/, giá /gi, ", price ")
    .replace(/, danh mục (Dịch vụ phòng|Thể thao|Nhà hàng|Điện tử|Khác)(?=,|\.|$)/gi, (_, category: string) =>
      `, category ${ENGLISH_SERVICE_CATEGORIES[category.toLocaleLowerCase()]}`,
    )
    .replace(/, danh mục /gi, ", category ")
    .replace(/, trạng thái đang hoạt động/gi, ", status: Active")
    .replace(/, trạng thái tạm ngưng/gi, ", status: Inactive")
    .replace(/\/lần\b/gi, "/use")
    .replace(/\/người\b/gi, "/person")
    .replace(/\/giờ\b/gi, "/hour")
    .replace(/\/ngày\b/gi, "/day")
    .replace(/đ\//gi, " VND per ")
    .replace(/Áp dụng toàn hệ thống/gi, "Applies system-wide")
    .replace(/Áp dụng cho chi nhánh/gi, "Applies to branch")
    .replace(/vừa được chỉnh sửa/gi, "was updated")
    .replace(/Thay đổi:/gi, "Changes:");

const localizeBookingDescription = (description: string) =>
  description
    .replace(/Mã booking:/gi, "Booking ID:")
    .replace(/Khách hàng:/gi, "Guest:")
    .replace(/SĐT:/gi, "Phone:")
    .replace(/Tổng tiền booking:/gi, "Booking total:")
    .replace(/Tổng tiền:/gi, "Total:")
    .replace(/Số tiền thanh toán:/gi, "Payment amount:")
    .replace(/Phương thức:/gi, "Payment method:")
    .replace(/Nội dung cập nhật:/gi, "Update details:")
    .replace(/Chênh lệch:/gi, "Difference:")
    .replace(/tại khách sạn/gi, "at hotel")
    .replace(/Tiền mặt/gi, "Cash")
    .replace(/Chuyển khoản \(VietQR\)/gi, "Bank transfer (VietQR)")
    .replace(/Ví điện tử/gi, "E-wallet");

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
  SHIFT_SCHEDULE_REMINDER: "Plan next week's shifts",
  SYSTEM: "System notification",
};

export const localizeNotificationTitle = (type: string, title: string) => {
  if (type === "SYSTEM" && title === "Cần phân công dọn phòng") {
    return localizedText(title, "Housekeeping assignment required");
  }
  return localizedText(title, ENGLISH_NOTIFICATION_TITLES[type] ?? title);
};

export const localizeNotificationDescription = (type: string, description: string) => {
  if (type === "SHIFT_SCHEDULE_REMINDER") {
    const reminder = description.match(/^Vui lòng phân công lịch làm việc cho tuần bắt đầu ngày (.+?)\.?$/i);
    if (reminder) {
      return localizedText(description, `Please assign work shifts for the week starting ${reminder[1]}.`);
    }
  }
  if (type === "HOUSEKEEPING_TASK_ASSIGNED") {
    const assignment = description.match(/^Bạn được giao dọn phòng (.+?) sau checkout\.?$/i);
    if (assignment) {
      return localizedText(description, `You have been assigned to clean room ${assignment[1]} after checkout.`);
    }
  }
  if (type === "HOUSEKEEPING_TASK_REASSIGNED") {
    const reassignment = description.match(
      /^Việc dọn phòng (.+?) được chuyển cho bạn\. Vui lòng hoàn tất và xác nhận\.?$/i,
    );
    if (reassignment) {
      return localizedText(
        description,
        `The cleaning task for room ${reassignment[1]} has been reassigned to you. Please complete and confirm it.`,
      );
    }
  }
  if (type === "HOUSEKEEPING_TASK_COMPLETED") {
    const completion = description.match(
      /^Phòng (.+?) đã được dọn xong và chuyển sang trạng thái sẵn sàng\.?$/i,
    );
    if (completion) {
      return localizedText(description, `Room ${completion[1]} has been cleaned and is now ready.`);
    }
  }
  if (type === "SYSTEM") {
    const checkout = description.match(
      /^Phòng (.+?) vừa checkout\. Quản lý cần phân công nhân viên buồng phòng\.?$/i,
    );
    if (checkout) {
      return localizedText(
        description,
        `Room ${checkout[1]} has just checked out. A manager needs to assign a housekeeping employee.`,
      );
    }
    const overdue = description.match(
      /^Phòng (.+?) chưa được xác nhận dọn sau 1 giờ; cần quản lý phân công lại\.?$/i,
    );
    if (overdue) {
      return localizedText(
        description,
        `Room ${overdue[1]} was not marked as cleaned after one hour; a manager needs to reassign the task.`,
      );
    }
  }
  const staticDescriptions: Record<string, Array<[RegExp, string]>> = {
    ROOM_CREATED: [[/^Một phòng mới vừa được thêm vào chi nhánh\.?$/i, "A new room was added to the branch."]],
    ROOM_UPDATED: [[/^Thông tin một phòng tại chi nhánh vừa được cập nhật\.?$/i, "Room information was updated at the branch."]],
    BUILDING_CREATED: [[/^Một tòa nhà mới vừa được thêm vào chi nhánh\.?$/i, "A new building was added to the branch."]],
    BUILDING_UPDATED: [[/^Thông tin tòa nhà tại chi nhánh vừa được cập nhật\.?$/i, "Building information was updated at the branch."]],
    FLOOR_CREATED: [[/^Một tầng mới vừa được thêm vào tòa nhà\.?$/i, "A new floor was added to the building."]],
    FLOOR_UPDATED: [[/^Thông tin tầng trong tòa nhà vừa được cập nhật\.?$/i, "Floor information in the building was updated."]],
  };
  const staticDescription = staticDescriptions[type]?.find(([pattern]) => pattern.test(description));
  if (staticDescription) return localizedText(description, staticDescription[1]);

  if (type === "SERVICE_IMPORT_COMPLETED") {
    const completed = description.match(/^Đã nhập thành công (\d+) dịch vụ\.?$/i);
    if (completed) return localizedText(description, `${completed[1]} services imported successfully.`);
  }
  if (type === "SERVICE_IMPORT_FAILED") {
    return localizedText(description, description.replace(/^Không thể nhập dịch vụ:/i, "Could not import services:"));
  }
  if (type === "SERVICE_CREATED" || type === "SERVICE_UPDATED") {
    return localizedText(description, localizeServiceDescription(description));
  }
  if (type.startsWith("BOOKING_") || type === "PAYMENT_RECEIVED") {
    const translated = localizeBookingDescription(description);
    if (translated !== description) return localizedText(description, translated);
  }
  if (type === "PROMOTION_CREATED" || type === "PROMOTION_UPDATED") {
    const promotion = description.match(
      /^Chương trình "(.+?)" với mã (.+?) vừa được (tạo|cập nhật)\.?$/i,
    );
    if (promotion) {
      return localizedText(
        description,
        `Promotion "${promotion[1]}" with code ${promotion[2]} was ${promotion[3] === "tạo" ? "created" : "updated"}.`,
      );
    }
  }
  if (type === "EMPLOYEE_CREATED") {
    const employee = description.match(/^Nhân viên (.+?) vừa được thêm vào chi nhánh\.?$/i);
    if (employee) return localizedText(description, `Employee ${employee[1]} was added to the branch.`);
  }
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
