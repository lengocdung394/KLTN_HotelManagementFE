import { describe, expect, it } from "vitest";
import { parseSuperAdminRolePermissionsRows } from "./superAdminRolePermissionsImport";
import type { SuperAdminRole } from "../services/superAdminApi";

const roles: SuperAdminRole[] = [
  { code: "ROLE_MANAGER", name: "Quản lý", description: "", system: false },
  { code: "ROLE_RECEPTION", name: "Lễ tân", description: "", system: false },
];

const headers = ["Role", "Mã quyền", "Tên quyền", "Mô tả quyền", "Danh mục"];

describe("parseSuperAdminRolePermissionsRows", () => {
  it("groups new permissions by existing role and marks each permission as granted", () => {
    const parsed = parseSuperAdminRolePermissionsRows([
      headers,
      ["ROLE_MANAGER", "BOOKING_VIEW", "Xem đặt phòng", "Xem booking", "Đặt phòng"],
      ["ROLE_MANAGER", "BOOKING_EDIT", "Sửa đặt phòng", "", "Đặt phòng"],
      ["ROLE_RECEPTION", "BOOKING_VIEW", "Xem đặt phòng", "Xem booking", "Đặt phòng"],
    ], roles);

    expect(parsed.importedRowCount).toBe(3);
    expect(parsed.rolePermissions).toEqual([
      {
        roleCode: "ROLE_MANAGER",
        permissions: [
          { code: "BOOKING_VIEW", name: "Xem đặt phòng", category: "Đặt phòng", description: "Xem booking", granted: true },
          { code: "BOOKING_EDIT", name: "Sửa đặt phòng", category: "Đặt phòng", description: "", granted: true },
        ],
      },
      {
        roleCode: "ROLE_RECEPTION",
        permissions: [
          { code: "BOOKING_VIEW", name: "Xem đặt phòng", category: "Đặt phòng", description: "Xem booking", granted: true },
        ],
      },
    ]);
  });

  it("honors the Có/Không grant column from the full-system workbook", () => {
    const parsed = parseSuperAdminRolePermissionsRows([
      ["Role", "Mã quyền", "Tên quyền", "Danh mục", "Mô tả quyền", "Cấp quyền (Có/Không)"],
      ["ROLE_MANAGER", "VIEW_BOOKINGS", "Xem đặt phòng", "Đặt phòng", "Cho phép xem đặt phòng", "Có"],
      ["ROLE_MANAGER", "DELETE_BOOKING", "Xóa đặt phòng", "Đặt phòng", "Cho phép xóa đặt phòng", "Không"],
    ], roles);

    expect(parsed.importedRowCount).toBe(2);
    expect(parsed.rolePermissions[0].permissions.map(({ code, granted }) => ({ code, granted }))).toEqual([
      { code: "VIEW_BOOKINGS", granted: true },
      { code: "DELETE_BOOKING", granted: false },
    ]);
  });

  it("rejects unknown values in the Có/Không grant column", () => {
    expect(() => parseSuperAdminRolePermissionsRows([
      ["Role", "Mã quyền", "Tên quyền", "Mô tả quyền", "Danh mục", "Cấp quyền (Có/Không)"],
      ["ROLE_MANAGER", "VIEW_BOOKINGS", "Xem đặt phòng", "", "Đặt phòng", "Maybe"],
    ], roles)).toThrow(/chỉ nhận Có hoặc Không/);
  });

  it("rejects rows with roles that were not created", () => {
    expect(() => parseSuperAdminRolePermissionsRows([
      headers,
      ["ROLE_UNKNOWN", "BOOKING_VIEW", "Xem đặt phòng", "", "Đặt phòng"],
    ], roles)).toThrow(/chưa tồn tại/);
  });

  it("rejects duplicate permissions for the same role", () => {
    expect(() => parseSuperAdminRolePermissionsRows([
      headers,
      ["ROLE_MANAGER", "BOOKING_VIEW", "Xem đặt phòng", "", "Đặt phòng"],
      ["ROLE_MANAGER", "BOOKING_VIEW", "Xem đặt phòng", "", "Đặt phòng"],
    ], roles)).toThrow(/bị lặp/);
  });

  it("allows the same permission code to be assigned to different roles", () => {
    const parsed = parseSuperAdminRolePermissionsRows([
      headers,
      ["ROLE_MANAGER", "BOOKING_VIEW", "Xem đặt phòng", "", "Đặt phòng"],
      ["ROLE_RECEPTION", "BOOKING_VIEW", "Xem đặt phòng", "", "Đặt phòng"],
    ], roles);

    expect(parsed.rolePermissions).toHaveLength(2);
  });

  it("imports category when provided and defaults old templates to uncategorized", () => {
    const categorized = parseSuperAdminRolePermissionsRows([
      headers,
      ["ROLE_MANAGER", "BOOKING_VIEW", "Xem đặt phòng", "", "Đặt phòng"],
    ], roles);
    const legacy = parseSuperAdminRolePermissionsRows([
      headers.slice(0, 4),
      ["ROLE_MANAGER", "BOOKING_VIEW", "Xem đặt phòng", ""],
    ], roles);

    expect(categorized.rolePermissions[0].permissions[0].category).toBe("Đặt phòng");
    expect(legacy.rolePermissions[0].permissions[0].category).toBe("Chưa phân loại");
  });

  it("rejects files missing required column headers", () => {
    expect(() => parseSuperAdminRolePermissionsRows([
      ["Role", "Mã quyền"],
      ["ROLE_MANAGER", "BOOKING_VIEW"],
    ], roles)).toThrow(/thiếu cột/);
  });
});
