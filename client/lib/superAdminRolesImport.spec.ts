import { describe, expect, it } from "vitest";
import { parseSuperAdminRolesRows } from "./superAdminRolesImport";
import type { SuperAdminRole } from "../services/superAdminApi";

const headers = ["Mã role", "Tên role", "Mô tả"];
const existingRoles: SuperAdminRole[] = [
  { code: "ROLE_ADMIN", name: "Admin", description: "", system: true },
];

describe("parseSuperAdminRolesRows", () => {
  it("normalizes role codes and parses valid rows", () => {
    expect(parseSuperAdminRolesRows([
      headers,
      [" role_manager ", "Quản lý", "Quản lý khách sạn"],
    ], existingRoles)).toEqual([
      { code: "ROLE_MANAGER", name: "Quản lý", description: "Quản lý khách sạn" },
    ]);
  });

  it("accepts headers without Vietnamese diacritics", () => {
    expect(parseSuperAdminRolesRows([
      ["Ma role", "Ten role", "Mo ta"],
      ["ROLE_MANAGER", "Quản lý", "Quản lý khách sạn"],
    ], existingRoles)).toHaveLength(1);
  });

  it("rejects missing headers, invalid codes, empty fields, and duplicates", () => {
    expect(() => parseSuperAdminRolesRows([["Mã role", "Tên role"], ["ROLE_X", "X"]], [])).toThrow(/thiếu cột/);
    expect(() => parseSuperAdminRolesRows([headers, ["MANAGER", "Quản lý", "Mô tả"]], [])).toThrow(/không hợp lệ/);
    expect(() => parseSuperAdminRolesRows([headers, ["ROLE_X", " ", "Mô tả"]], [])).toThrow(/Tên role/);
    expect(() => parseSuperAdminRolesRows([headers, ["ROLE_X", "X", " "]], [])).toThrow(/Mô tả role/);
    expect(() => parseSuperAdminRolesRows([headers, ["ROLE_ADMIN", "Admin mới", "Mô tả"]], existingRoles)).toThrow(/đã tồn tại/);
    expect(() => parseSuperAdminRolesRows([
      headers,
      ["ROLE_X", "X", "Mô tả"],
      ["role_x", "X khác", "Mô tả khác"],
    ], [])).toThrow(/bị trùng/);
    expect(() => parseSuperAdminRolesRows([headers], [])).toThrow(/chưa có dòng/);
  });
});
