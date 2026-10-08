import { describe, expect, it } from "vitest";
import { parseSuperAdminPermissionCatalogRows } from "./superAdminPermissionCatalogImport";

const headers = ["Mã quyền", "Tên quyền", "Danh mục", "Mô tả quyền"];

describe("parseSuperAdminPermissionCatalogRows", () => {
  it("normalizes permission codes and imports standalone permissions", () => {
    expect(parseSuperAdminPermissionCatalogRows([
      headers,
      [" view_report ", "Xem báo cáo", "Báo cáo", "Xem các báo cáo"],
      ["EXPORT_REPORT", "Xuất báo cáo", "Báo cáo", ""],
    ])).toEqual({
      permissions: [
        { code: "VIEW_REPORT", name: "Xem báo cáo", category: "Báo cáo", description: "Xem các báo cáo" },
        { code: "EXPORT_REPORT", name: "Xuất báo cáo", category: "Báo cáo", description: "" },
      ],
    });
  });

  it("accepts headers without Vietnamese diacritics", () => {
    expect(parseSuperAdminPermissionCatalogRows([
      ["Ma quyen", "Ten quyen", "Danh muc", "Mo ta quyen"],
      ["VIEW_REPORT", "Xem báo cáo", "Báo cáo", ""],
    ]).permissions).toHaveLength(1);
  });

  it("keeps compatibility with old files without a category column", () => {
    const parsed = parseSuperAdminPermissionCatalogRows([
      ["Mã quyền", "Tên quyền", "Mô tả quyền"],
      ["VIEW_REPORT", "Xem báo cáo", "Xem báo cáo"],
    ]);

    expect(parsed.permissions[0].category).toBe("Chưa phân loại");
  });

  it("rejects a missing header", () => {
    expect(() => parseSuperAdminPermissionCatalogRows([
      ["Mã quyền", "Tên quyền", "Danh mục"],
      ["VIEW_REPORT", "Xem báo cáo", "Báo cáo"],
    ])).toThrow(/thiếu cột/);
  });

  it("rejects invalid permission codes", () => {
    expect(() => parseSuperAdminPermissionCatalogRows([
      headers,
      ["bad code", "Xem báo cáo", "Báo cáo", ""],
    ])).toThrow(/không hợp lệ/);
  });

  it("rejects duplicate permission codes", () => {
    expect(() => parseSuperAdminPermissionCatalogRows([
      headers,
      ["VIEW_REPORT", "Xem báo cáo", "Báo cáo", ""],
      ["view_report", "Xem báo cáo khác", "Báo cáo", ""],
    ])).toThrow(/bị lặp/);
  });

  it("rejects empty permission names and empty data", () => {
    expect(() => parseSuperAdminPermissionCatalogRows([
      headers,
      ["VIEW_REPORT", " ", "Báo cáo", ""],
    ])).toThrow(/không được để trống/);
    expect(() => parseSuperAdminPermissionCatalogRows([
      headers,
      ["VIEW_REPORT", "Xem báo cáo", " ", ""],
    ])).toThrow(/Danh mục.*không được để trống/);
    expect(() => parseSuperAdminPermissionCatalogRows([headers])).toThrow(/chưa có dòng quyền/);
  });
});
