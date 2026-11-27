import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

let i18n: (typeof import("../i18n"))["default"];
let localizeNotificationDescription: (typeof import("./roomUpdateNotification"))["localizeNotificationDescription"];
let localizeNotificationTitle: (typeof import("./roomUpdateNotification"))["localizeNotificationTitle"];
let originalLanguage: string;

beforeAll(async () => {
  vi.stubGlobal("localStorage", { getItem: () => null });
  const i18nModule = await import("../i18n");
  const notificationModule = await import("./roomUpdateNotification");
  i18n = i18nModule.default;
  localizeNotificationDescription = notificationModule.localizeNotificationDescription;
  localizeNotificationTitle = notificationModule.localizeNotificationTitle;
  originalLanguage = i18n.language;
});

afterAll(() => {
  vi.unstubAllGlobals();
});

beforeEach(async () => {
  await i18n.changeLanguage("en");
});

afterEach(async () => {
  await i18n.changeLanguage(originalLanguage);
});

describe("localizeNotificationDescription", () => {
  it("translates payment labels and payment methods while preserving values", () => {
    expect(localizeNotificationDescription(
      "PAYMENT_RECEIVED",
      "Mã booking: #BK-1 | Khách hàng: Lan | SĐT: 0123 | Số tiền thanh toán: 200.030đ | Phương thức: Tiền mặt.",
    )).toBe("Booking ID: #BK-1 | Guest: Lan | Phone: 0123 | Payment amount: 200.030đ | Payment method: Cash.");
  });

  it("translates booking update details", () => {
    expect(localizeNotificationDescription(
      "BOOKING_UPDATED",
      "Nội dung cập nhật: điều chỉnh 1 phòng/khung ngày/số khách, cập nhật khuyến mãi.",
    )).toBe("Update details: adjust 1 room, stay dates, or guest count, update promotion.");
  });

  it("translates payment-timeout booking cancellation notifications", () => {
    expect(localizeNotificationDescription(
      "BOOKING_CANCELLED",
      "Booking #BK202611274090 đã bị hủy: Quá thời gian chờ thanh toán",
    )).toBe("Booking #BK202611274090 was cancelled: Payment window expired");
  });

  it("translates service notification labels and status", () => {
    expect(localizeNotificationDescription(
      "SERVICE_CREATED",
      '"Massage" (mã SRV-1), giá 100000.00đ/lần, danh mục Spa, trạng thái đang hoạt động. Áp dụng cho chi nhánh Khách sạn Hoa Hồng.',
    )).toBe('"Massage" (ID SRV-1), price 100000.00 VND per use, category Spa, status: Active. Applies to branch Khách sạn Hoa Hồng.');
    expect(localizeNotificationDescription(
      "SERVICE_CREATED",
      '"Dịch vụ tắm suối" (mã SRV-2), giá 100000.00đ/người, danh mục Dịch vụ phòng, trạng thái đang hoạt động. Áp dụng toàn hệ thống.',
    )).toBe('"Dịch vụ tắm suối" (ID SRV-2), price 100000.00 VND per person, category Room service, status: Active. Applies system-wide.');
    expect(localizeNotificationDescription(
      "SERVICE_UPDATED",
      'Dịch vụ "Massage Thư Giãn" (mã SRV-3), giá 250000.00đ/lần, danh mục Spa, trạng thái đang hoạt động. vừa được chỉnh sửa.',
    )).toBe('Service "Massage Thư Giãn" (ID SRV-3), price 250000.00 VND per use, category Spa, status: Active. was updated.');
  });

  it("translates service import completion and failure notifications", () => {
    expect(localizeNotificationDescription(
      "SERVICE_IMPORT_COMPLETED",
      "Đã nhập thành công 3 dịch vụ.",
    )).toBe("3 services imported successfully.");
    expect(localizeNotificationDescription(
      "SERVICE_IMPORT_FAILED",
      "Không thể nhập dịch vụ: The database is unavailable.",
    )).toBe("Could not import services: The database is unavailable.");
  });

  it("translates standard floor notification descriptions", () => {
    expect(localizeNotificationDescription(
      "FLOOR_CREATED",
      "Một tầng mới vừa được thêm vào tòa nhà.",
    )).toBe("A new floor was added to the building.");
  });

  it("translates 'vừa' in room update descriptions", () => {
    expect(localizeNotificationDescription(
      "ROOM_UPDATED",
      "Phòng 102 vừa được cập nhật.",
    )).toBe("Room 102 was updated.");
  });

  it("translates shift assignment and housekeeping notifications", () => {
    expect(localizeNotificationTitle("SHIFT_SCHEDULE_REMINDER", "Lập lịch ca làm tuần tới"))
      .toBe("Plan next week's shifts");
    expect(localizeNotificationDescription(
      "SHIFT_SCHEDULE_REMINDER",
      "Vui lòng phân công lịch làm việc cho tuần bắt đầu ngày 2026-11-16.",
    )).toBe("Please assign work shifts for the week starting 2026-11-16.");
    expect(localizeNotificationDescription(
      "HOUSEKEEPING_TASK_ASSIGNED",
      "Bạn được giao dọn phòng 102 sau checkout.",
    )).toBe("You have been assigned to clean room 102 after checkout.");
    expect(localizeNotificationDescription(
      "HOUSEKEEPING_TASK_REASSIGNED",
      "Việc dọn phòng 102 được chuyển cho bạn. Vui lòng hoàn tất và xác nhận.",
    )).toBe("The cleaning task for room 102 has been reassigned to you. Please complete and confirm it.");
    expect(localizeNotificationDescription(
      "HOUSEKEEPING_TASK_COMPLETED",
      "Phòng 102 đã được dọn xong và chuyển sang trạng thái sẵn sàng.",
    )).toBe("Room 102 has been cleaned and is now ready.");
    expect(localizeNotificationTitle("SYSTEM", "Cần phân công dọn phòng"))
      .toBe("Housekeeping assignment required");
    expect(localizeNotificationDescription(
      "SYSTEM",
      "Phòng 102 vừa checkout. Quản lý cần phân công nhân viên buồng phòng.",
    )).toBe("Room 102 has just checked out. A manager needs to assign a housekeeping employee.");
    expect(localizeNotificationDescription(
      "SYSTEM",
      "Phòng 102 chưa được xác nhận dọn sau 1 giờ; cần quản lý phân công lại.",
    )).toBe("Room 102 was not marked as cleaned after one hour; a manager needs to reassign the task.");
  });
});
