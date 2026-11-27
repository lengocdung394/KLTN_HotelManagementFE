import { describe, expect, it } from "vitest";
import { createXlsxWorkbook, readZipFiles } from "./bulkImportFiles";
import { parseSuperAdminBranchRows } from "./superAdminBranchImport";

const branchHeaders = [
  "Tên chi nhánh",
  "Số điện thoại chi nhánh",
  "Địa chỉ",
  "Tỉnh/thành",
  "Tên tài khoản admin",
  "Mật khẩu admin",
  "Họ tên quản lý",
  "Email quản lý",
  "Số điện thoại quản lý",
  "Mật khẩu quản lý",
];
const roomPolicyRows = [
  ["Loại phòng", "Diện tích (m2)", "Giá cơ bản", "Sức chứa chuẩn", "Khách thêm tối đa", "Phụ thu người lớn", "Phụ thu trẻ em"],
  ...["STANDARD", "DELUXE", "SUITE", "FAMILY"].map((type) => [type, "25", "1000000", "2", "1", "100000", "50000"]),
];

describe("parseSuperAdminBranchRows", () => {
  it("writes masked display formatting for password cells", async () => {
    const workbook = createXlsxWorkbook([
      {
        name: "Branch info",
        rows: [["Password", "Province"], ["secret", ""]],
        maskedTextColumns: [0],
        validations: [{ range: "B2", type: "list", formula1: "ProvinceList" }],
      },
      { name: "Province options", rows: [["Hà Nội"]], hidden: true },
    ], [{ name: "ProvinceList", formula: "'Province options'!$A$1:$A$1" }]);
    const entries = await readZipFiles(await workbook.arrayBuffer());
    const sheet = entries.find((entry) => entry.name === "xl/worksheets/sheet1.xml");
    const styles = entries.find((entry) => entry.name === "xl/styles.xml");
    const workbookXml = entries.find((entry) => entry.name === "xl/workbook.xml");
    expect(sheet).toBeDefined();
    expect(styles).toBeDefined();
    expect(workbookXml).toBeDefined();

    const sheetXml = new TextDecoder().decode(sheet!.content);
    expect(sheetXml).toContain('r="A2" s="1"');
    expect(sheetXml).toContain("<dataValidation type=\"list\"");
    expect(sheetXml).toContain("<formula1>ProvinceList</formula1>");
    expect(new TextDecoder().decode(styles!.content)).toContain('formatCode="*•;*•;*•;*•"');
    expect(new TextDecoder().decode(workbookXml!.content)).toContain('name="Province options" sheetId="2" state="hidden"');
    expect(new TextDecoder().decode(workbookXml!.content)).toContain("&apos;Province options&apos;!$A$1:$A$1");
  });

  it("parses one branch, account passwords, and its four room policies", () => {
    expect(parseSuperAdminBranchRows([
      branchHeaders,
      ["Khách sạn Sen Việt", "0912345678", "1 Nguyễn Huệ", "Hà Nội", "sen-admin", " Admin#123 ", "Nguyễn An", "an@example.com", "987654321", " Manager#123 "],
    ], roomPolicyRows)).toEqual({
      branch: {
        name: "Khách sạn Sen Việt",
        phone: "0912345678",
        address: "1 Nguyễn Huệ",
        provinceName: "Hà Nội",
      },
      adminUsername: "sen-admin",
      adminPassword: " Admin#123 ",
      managerAccount: {
        fullName: "Nguyễn An",
        email: "an@example.com",
        phone: "0987654321",
        password: " Manager#123 ",
      },
      roomPolicies: ["STANDARD", "DELUXE", "SUITE", "FAMILY"].map((roomType) => ({
        roomType,
        area: 25,
        basePrice: 1000000,
        standardCapacity: 2,
        maxExtraGuests: 1,
        extraAdultFee: 100000,
        extraChildFee: 50000,
      })),
    });
  });

  it("requires exactly one branch row and validates required branch data", () => {
    const branchRow = ["Khách sạn Sen Việt", "0912345678", "1 Nguyễn Huệ", "Hà Nội", "sen-admin", "Admin#123", "Nguyễn An", "an@example.com", "0987654321", "Manager#123"];
    expect(() => parseSuperAdminBranchRows([branchHeaders], roomPolicyRows)).toThrow(/chưa có dòng thông tin/);
    expect(() => parseSuperAdminBranchRows([branchHeaders, branchRow, branchRow], roomPolicyRows)).toThrow(/một chi nhánh/);
    expect(() => parseSuperAdminBranchRows([
      branchHeaders,
      ["Khách sạn Sen Việt", "0912345678", "1 Nguyễn Huệ", "Tỉnh không hợp lệ", "sen-admin", "Admin#123", "Nguyễn An", "an@example.com", "0987654321", "Manager#123"],
    ], roomPolicyRows)).toThrow(/Tỉnh\/thành/);
    expect(() => parseSuperAdminBranchRows([
      branchHeaders,
      ["Khách sạn Sen Việt", "0912345678", "1 Nguyễn Huệ", "Hà Nội", "sen-admin", "Admin#123", "Nguyễn An", "email-sai", "0987654321", "Manager#123"],
    ], roomPolicyRows)).toThrow(/Email/);
    expect(() => parseSuperAdminBranchRows([
      branchHeaders,
      ["Khách sạn Sen Việt", "0912345678", "1 Nguyễn Huệ", "Hà Nội", "sen-admin", "", "Nguyễn An", "an@example.com", "0987654321", "Manager#123"],
    ], roomPolicyRows)).toThrow(/Mật khẩu admin/);
    expect(() => parseSuperAdminBranchRows([
      branchHeaders,
      ["Khách sạn Sen Việt", "0912345678", "1 Nguyễn Huệ", "Hà Nội", "sen-admin", "Admin#123", "Nguyễn An", "an@example.com", "0987654321", ""],
    ], roomPolicyRows)).toThrow(/Mật khẩu quản lý/);
  });
});
