import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

let i18n: (typeof import("../i18n"))["default"];
let translateDisplayText: (typeof import("./permissionLocalization"))["translateDisplayText"];
let translateRoleDescription: (typeof import("./permissionLocalization"))["translateRoleDescription"];
let translateRoleName: (typeof import("./permissionLocalization"))["translateRoleName"];
let originalLanguage: string;

beforeAll(async () => {
  vi.stubGlobal("localStorage", { getItem: () => null });
  const i18nModule = await import("../i18n");
  const permissionLocalizationModule = await import("./permissionLocalization");
  i18n = i18nModule.default;
  translateDisplayText = permissionLocalizationModule.translateDisplayText;
  translateRoleDescription = permissionLocalizationModule.translateRoleDescription;
  translateRoleName = permissionLocalizationModule.translateRoleName;
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

describe("translateDisplayText", () => {
  it("translates role, category, permission, and description labels", () => {
    expect(translateDisplayText("khách hàng toàn hệ thống")).toBe("System-wide customer");
    expect(translateDisplayText("Có thể là khách hàng vãng lai hoặc là khách hàng chính thống đã có tài khoản"))
      .toBe("May be a walk-in customer or a registered customer with an account");
    expect(translateDisplayText("Đặt phòng")).toBe("Bookings");
    expect(translateDisplayText("Tạo đặt phòng")).toBe("Create bookings");
    expect(translateDisplayText("Cho phép tạo đặt phòng.")).toBe("Allows creating bookings");
  });

  it("leaves source text unchanged in Vietnamese", async () => {
    await i18n.changeLanguage("vi");
    expect(translateDisplayText("Đặt phòng")).toBe("Đặt phòng");
  });
});

describe("role localization", () => {
  it("translates role names and descriptions by role code", () => {
    const roles = [
      ["ROLE_SUPER_ADMIN", "Quản trị viên hệ thống", "Super Admin", "Quản lý toàn bộ hệ thống, bao gồm các chi nhánh, tài khoản, vai trò, quyền hạn và cấu hình chung.", "Manages the entire platform, including all branches, accounts, roles, permissions, and system settings."],
      ["ROLE_CUSTOMER", "Khách hàng", "Customer", "Đại diện cho khách lưu trú, bao gồm khách vãng lai và khách hàng đã đăng ký tài khoản.", "Represents a hotel guest, whether a walk-in customer or a registered account holder."],
      ["ROLE_ADMIN", "Quản trị viên chi nhánh", "Branch Administrator", "Quản lý người dùng, cấu hình và dữ liệu hoạt động của chi nhánh được phân công.", "Manages users, settings, and operational data for the assigned branch."],
      ["ROLE_MANAGER", "Quản lý chi nhánh", "Branch Manager", "Điều phối hoạt động hằng ngày và nhân viên tại chi nhánh được phân công.", "Coordinates daily operations and staff at the assigned branch."],
      ["ROLE_EMPLOYEE", "Nhân viên chi nhánh", "Branch Employee", "Thực hiện các công việc được giao tại chi nhánh theo quyền hạn của tài khoản.", "Performs assigned duties at the branch according to the permissions granted to the account."],
    ] as const;

    for (const [code, name, translatedName, description, translatedDescription] of roles) {
      expect(translateRoleName(code, name)).toBe(translatedName);
      expect(translateRoleDescription(code, description)).toBe(translatedDescription);
    }
  });

  it("translates legacy role names and preserves Vietnamese display", async () => {
    expect(translateRoleName("ROLE_MANAGER", "Quản lí")).toBe("Branch Manager");
    expect(translateRoleDescription("ROLE_ADMIN", "Admin của mỗi chi nhánh có vai trò tổng quản lý"))
      .toBe("Administers the assigned branch and oversees its operations.");
    expect(translateRoleDescription("ROLE_MANAGER", "Quản lí của mỗi chi nhánh")).toBe("Manages the assigned hotel branch.");
    expect(translateRoleDescription("ROLE_EMPLOYEE", "Có thể là nhân viên lễ tân, buồng phòng, bảo vệ"))
      .toBe("May be a front desk, housekeeping, or security employee.");
    await i18n.changeLanguage("vi");
    expect(translateRoleName("ROLE_MANAGER", "Quản lí")).toBe("Quản lí");
  });
});
