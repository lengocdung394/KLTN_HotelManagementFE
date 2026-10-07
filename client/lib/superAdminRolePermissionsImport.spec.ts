import { describe, expect, it } from "vitest";
import { parseSuperAdminRolePermissionsRows } from "./superAdminRolePermissionsImport";
import type { SuperAdminRole } from "../services/superAdminApi";

const roles: SuperAdminRole[] = [
  { code: "ROLE_MANAGER", name: "Quản lý", description: "", system: false },
  { code: "ROLE_RECEPTION", name: "Lễ tân", description: "", system: false },
];

const headers = ["Role", "Mã quyền", "Tên quyền", "Mô tả quyền", "Cấp quyền (Có/Không)"];

describe("parseSuperAdminRolePermissionsRows", () => {
  it("groups manually entered permissions by selected role and retains granted flags", () => {
    const parsed = parseSuperAdminRolePermissionsRows([
      headers,
      ["ROLE_MANAGER", "BOOKING_VIEW", "Xem đặt phòng", "Xem booking", "Có"],
      ["ROLE_MANAGER", "BOOKING_EDIT", "Sửa đặt phòng", "", "Không"],
      ["ROLE_RECEPTION", "BOOKING_VIEW", "Xem đặt phòng", "Xem booking", "Yes"],
    ], roles);

    expect(parsed.importedRowCount).toBe(3);
    expect(parsed.rolePermissions).toEqual([
      {
        roleCode: "ROLE_MANAGER",
        permissions: [
          { code: "BOOKING_VIEW", name: "Xem đặt phòng", description: "Xem booking", granted: true },
          { code: "BOOKING_EDIT", name: "Sửa đặt phòng", description: "", granted: false },
        ],
      },
      {
        roleCode: "ROLE_RECEPTION",
        permissions: [
          { code: "BOOKING_VIEW", name: "Xem đặt phòng", description: "Xem booking", granted: true },
        ],
      },
    ]);
  });

  it("rejects rows with roles that were not created", () => {
    expect(() => parseSuperAdminRolePermissionsRows([
      headers,
      ["ROLE_UNKNOWN", "BOOKING_VIEW", "Xem đặt phòng", "", "Có"],
    ], roles)).toThrow(/chưa tồn tại/);
  });

  it("rejects duplicate permissions for the same role", () => {
    expect(() => parseSuperAdminRolePermissionsRows([
      headers,
      ["ROLE_MANAGER", "BOOKING_VIEW", "Xem đặt phòng", "", "Có"],
      ["ROLE_MANAGER", "BOOKING_VIEW", "Xem đặt phòng", "", "Không"],
    ], roles)).toThrow(/bị lặp/);
  });

  it("allows the same permission code to be assigned to different roles", () => {
    const parsed = parseSuperAdminRolePermissionsRows([
      headers,
      ["ROLE_MANAGER", "BOOKING_VIEW", "Xem đặt phòng", "", "Có"],
      ["ROLE_RECEPTION", "BOOKING_VIEW", "Xem đặt phòng", "", "Không"],
    ], roles);

    expect(parsed.rolePermissions).toHaveLength(2);
  });

  it("rejects files missing required column headers", () => {
    expect(() => parseSuperAdminRolePermissionsRows([
      ["Role", "Mã quyền"],
      ["ROLE_MANAGER", "BOOKING_VIEW"],
    ], roles)).toThrow(/thiếu cột/);
  });
});
