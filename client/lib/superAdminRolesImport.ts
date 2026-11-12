import { readXlsxRows } from "./bulkImportFiles";
import type { CreateSuperAdminRoleRequest, SuperAdminRole } from "../services/superAdminApi";

const roleHeaders = ["Mã role", "Tên role", "Mô tả"];
const normalizeCode = (value: string) => value.trim().toLocaleUpperCase();
const normalizeHeader = (value: string) =>
  value.trim().toLocaleLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export const parseSuperAdminRolesRows = (
  rows: string[][],
  existingRoles: SuperAdminRole[],
): CreateSuperAdminRoleRequest[] => {
  if (rows.length < 2) throw new Error("File Excel chưa có dòng vai trò nào.");

  const headerIndexes = new Map(rows[0].map((header, index) => [normalizeHeader(header), index]));
  const indexes = roleHeaders.map((header) => headerIndexes.get(normalizeHeader(header)));
  const missingHeaders = roleHeaders.filter((_, index) => indexes[index] === undefined);
  if (missingHeaders.length > 0) {
    throw new Error(`File Excel thiếu cột: ${missingHeaders.join(", ")}.`);
  }

  const seenCodes = new Set(existingRoles.map((role) => normalizeCode(role.code)));
  const parsedRoles: CreateSuperAdminRoleRequest[] = [];

  rows.slice(1).forEach((row, rowIndex) => {
    if (row.every((cell) => !cell?.trim())) return;
    const rowNumber = rowIndex + 2;
    const [rawCode, rawName, rawDescription] = indexes.map((index) => row[index ?? -1]?.trim() ?? "");
    const code = normalizeCode(rawCode);

    if (!/^ROLE_[A-Z0-9_]+$/.test(code)) {
      throw new Error(`Mã role ở dòng ${rowNumber} không hợp lệ.`);
    }
    if (!rawName) throw new Error(`Tên role ở dòng ${rowNumber} không được để trống.`);
    if (!rawDescription) throw new Error(`Mô tả role ở dòng ${rowNumber} không được để trống.`);
    if (seenCodes.has(code)) {
      throw new Error(`Mã role ${code} bị trùng hoặc đã tồn tại.`);
    }

    seenCodes.add(code);
    parsedRoles.push({ code, name: rawName, description: rawDescription });
  });

  if (parsedRoles.length === 0) throw new Error("File Excel không có dòng vai trò hợp lệ.");
  return parsedRoles;
};

export const parseSuperAdminRolesFile = async (
  file: File,
  existingRoles: SuperAdminRole[],
): Promise<CreateSuperAdminRoleRequest[]> => {
  if (!file.name.toLocaleLowerCase().endsWith(".xlsx")) {
    throw new Error("Vui lòng chọn file Excel .xlsx.");
  }
  return parseSuperAdminRolesRows(await readXlsxRows(await file.arrayBuffer()), existingRoles);
};
