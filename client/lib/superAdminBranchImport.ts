import { createXlsxWorkbook, downloadFile, readXlsxRowsByName } from "./bulkImportFiles";
import { parseSuperAdminRoomPolicyRows } from "./superAdminRoomPolicyImport";
import type { SuperAdminRoomPolicy } from "../services/superAdminApi";
import { VIETNAM_PROVINCES } from "./vietnamProvinces";

type BranchImportFields = {
  name: string;
  phone: string;
  address: string;
  provinceName: string;
  adminUsername: string;
  adminPassword: string;
  managerFullName: string;
  managerEmail: string;
  managerPhone: string;
  managerPassword: string;
};

export type SuperAdminBranchImport = {
  branch: Pick<BranchImportFields, "name" | "phone" | "address" | "provinceName">;
  adminUsername: string;
  adminPassword: string;
  managerAccount: {
    fullName: string;
    email: string;
    phone: string;
    password: string;
  };
  roomPolicies: SuperAdminRoomPolicy[];
};

const branchColumnAliases: Record<keyof BranchImportFields, readonly string[]> = {
  name: ["tenchinhanh", "branchname"],
  phone: ["sodienthoaichinhanh", "branchphone"],
  address: ["diachi", "address"],
  provinceName: ["tinhthanh", "tinhthanhpho", "provincename"],
  adminUsername: ["tentaikhoanadmin", "adminusername"],
  adminPassword: ["matkhauadmin", "adminpassword"],
  managerFullName: ["hotenquanly", "managerfullname"],
  managerEmail: ["emailquanly", "manageremail"],
  managerPhone: ["sodienthoaiquanly", "managerphone"],
  managerPassword: ["matkhauquanly", "managerpassword"],
};

const normalizeHeader = (value: string) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/đ/g, "d").replace(/[^a-z0-9]/g, "");

const normalizePhone = (value: string, label: string) => {
  let phone = value.trim().replace(/[\s().-]/g, "");
  if (/^9\d{8}$/.test(phone)) phone = `0${phone}`;
  if (/^84\d{9}$/.test(phone)) phone = `+${phone}`;
  if (!/^(0\d{9}|\+84\d{9})$/.test(phone)) {
    throw new Error(`${label} phải có 10 số và bắt đầu bằng 0 hoặc mã +84.`);
  }
  return phone;
};

export const parseSuperAdminBranchRows = (
  branchRows: string[][],
  roomPolicyRows: string[][],
): SuperAdminBranchImport => {
  if (branchRows.length < 2) throw new Error("File Excel chưa có dòng thông tin chi nhánh.");

  const indexes = new Map<keyof BranchImportFields, number>();
  branchRows[0].forEach((header, index) => {
    const normalized = normalizeHeader(header);
    Object.entries(branchColumnAliases).forEach(([field, aliases]) => {
      if (aliases.includes(normalized)) indexes.set(field as keyof BranchImportFields, index);
    });
  });
  const missingHeaders = Object.keys(branchColumnAliases)
    .filter((field) => !indexes.has(field as keyof BranchImportFields));
  if (missingHeaders.length) {
    throw new Error("File thiếu các cột thông tin chi nhánh, admin hoặc quản lý.");
  }

  const dataRows = branchRows.slice(1).filter((row) => row.some((cell) => cell.trim()));
  if (dataRows.length !== 1) {
    throw new Error("Mỗi file chỉ nhập thông tin cho một chi nhánh.");
  }
  const row = dataRows[0];
  const readRaw = (field: keyof BranchImportFields) => row[indexes.get(field)!] ?? "";
  const read = (field: keyof BranchImportFields) => readRaw(field).trim();
  const provinceInput = read("provinceName");
  const provinceName = VIETNAM_PROVINCES.find(
    (province) => normalizeHeader(province) === normalizeHeader(provinceInput),
  );
  if (!provinceName) throw new Error("Tỉnh/thành trong file không khớp danh sách hiện có.");

  const fields: BranchImportFields = {
    name: read("name"),
    phone: normalizePhone(read("phone"), "Số điện thoại chi nhánh"),
    address: read("address"),
    provinceName,
    adminUsername: read("adminUsername"),
    adminPassword: readRaw("adminPassword"),
    managerFullName: read("managerFullName"),
    managerEmail: read("managerEmail"),
    managerPhone: normalizePhone(read("managerPhone"), "Số điện thoại quản lý"),
    managerPassword: readRaw("managerPassword"),
  };
  const requiredFields: [keyof BranchImportFields, string][] = [
    ["name", "Tên chi nhánh"],
    ["address", "Địa chỉ"],
    ["adminUsername", "Tên tài khoản admin"],
    ["adminPassword", "Mật khẩu admin"],
    ["managerFullName", "Họ tên quản lý"],
    ["managerEmail", "Email quản lý"],
    ["managerPassword", "Mật khẩu quản lý"],
  ];
  for (const [field, label] of requiredFields) {
    if (!fields[field].trim()) throw new Error(`${label} không được để trống.`);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.managerEmail)) {
    throw new Error("Email quản lý không đúng định dạng.");
  }

  return {
    branch: {
      name: fields.name,
      phone: fields.phone,
      address: fields.address,
      provinceName: fields.provinceName,
    },
    adminUsername: fields.adminUsername,
    adminPassword: fields.adminPassword,
    managerAccount: {
      fullName: fields.managerFullName,
      email: fields.managerEmail,
      phone: fields.managerPhone,
      password: fields.managerPassword,
    },
    roomPolicies: parseSuperAdminRoomPolicyRows(roomPolicyRows),
  };
};

export const downloadSuperAdminBranchTemplate = () => {
  const workbook = createXlsxWorkbook([
    {
      name: "Branch info",
      rows: [
        ["Tên chi nhánh", "Số điện thoại chi nhánh", "Địa chỉ", "Tỉnh/thành", "Tên tài khoản admin", "Mật khẩu admin", "Họ tên quản lý", "Email quản lý", "Số điện thoại quản lý", "Mật khẩu quản lý"],
        ["", "", "", "", "", "", "", "", "", ""],
      ],
      maskedTextColumns: [5, 9],
      validations: [{ range: "D2", type: "list", formula1: "VietnamProvinces" }],
    },
    {
      name: "Room policy",
      rows: [
        ["Loại phòng", "Diện tích (m2)", "Giá cơ bản", "Sức chứa chuẩn", "Khách thêm tối đa", "Phụ thu người lớn", "Phụ thu trẻ em"],
        ...(["STANDARD", "DELUXE", "SUITE", "FAMILY"] as const).map((roomType) => [roomType, "", "", "", "", "", ""]),
      ],
    },
    {
      name: "Province options",
      rows: VIETNAM_PROVINCES.map((province) => [province]),
      hidden: true,
    },
  ], [{
    name: "VietnamProvinces",
    formula: `'Province options'!$A$1:$A$${VIETNAM_PROVINCES.length}`,
  }]);
  downloadFile("mau-tao-chi-nhanh.xlsx", workbook);
};

export const parseSuperAdminBranchFile = async (file: File): Promise<SuperAdminBranchImport> => {
  if (!file.name.toLocaleLowerCase().endsWith(".xlsx")) {
    throw new Error("Vui lòng chọn file Excel định dạng .xlsx.");
  }
  const workbook = await file.arrayBuffer();
  const [branchRows, roomPolicyRows] = await Promise.all([
    readXlsxRowsByName(workbook, "Branch info", false),
    readXlsxRowsByName(workbook, "Room policy"),
  ]);
  return parseSuperAdminBranchRows(branchRows, roomPolicyRows);
};
