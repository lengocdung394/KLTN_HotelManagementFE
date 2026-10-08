import { readXlsxRows } from "./bulkImportFiles";
import type { SuperAdminPermissionCatalogItem } from "../services/superAdminApi";

const requiredPermissionHeaders = ["Mã quyền", "Tên quyền", "Mô tả quyền"];
const categoryHeader = "Danh mục";

const normalizeCode = (value: string) => value.trim().toLocaleUpperCase();
const normalizeHeader = (value: string) =>
  value.trim().toLocaleLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export type ParsedSuperAdminPermissionCatalog = {
  permissions: SuperAdminPermissionCatalogItem[];
};

export const parseSuperAdminPermissionCatalogRows = (
  rows: string[][],
): ParsedSuperAdminPermissionCatalog => {
  if (rows.length < 2) throw new Error("File Excel chưa có dòng quyền nào.");

  const headerIndexes = new Map(rows[0].map((header, index) => [normalizeHeader(header), index]));
  const indexes = requiredPermissionHeaders.map((header) => headerIndexes.get(normalizeHeader(header)));
  const missingHeaders = requiredPermissionHeaders.filter((_, index) => indexes[index] === undefined);
  if (missingHeaders.length > 0) {
    throw new Error(`File Excel thiếu cột: ${missingHeaders.join(", ")}.`);
  }
  const categoryIndex = headerIndexes.get(normalizeHeader(categoryHeader));

  const seenCodes = new Set<string>();
  const permissions: SuperAdminPermissionCatalogItem[] = [];

  rows.slice(1).forEach((row, rowIndex) => {
    if (row.every((cell) => !cell?.trim())) return;
    const rowNumber = rowIndex + 2;
    const values = indexes.map((index) => row[index ?? -1]?.trim() ?? "");
    const [rawCode, name, description] = values;
    const category = categoryIndex === undefined
      ? "Chưa phân loại"
      : row[categoryIndex]?.trim() || "";
    const code = normalizeCode(rawCode);

    if (!/^[A-Z][A-Z0-9_.:-]*$/.test(code)) {
      throw new Error(`Mã quyền ở dòng ${rowNumber} không hợp lệ.`);
    }
    if (!name) throw new Error(`Tên quyền ở dòng ${rowNumber} không được để trống.`);
    if (!category) throw new Error(`Danh mục ở dòng ${rowNumber} không được để trống.`);
    if (seenCodes.has(code)) {
      throw new Error(`Mã quyền ${code} bị lặp ở dòng ${rowNumber}.`);
    }

    seenCodes.add(code);
    permissions.push({ code, name, category, description });
  });

  if (permissions.length === 0) throw new Error("File Excel không có dòng quyền hợp lệ.");
  return { permissions };
};

export const parseSuperAdminPermissionCatalogFile = async (
  file: File,
): Promise<ParsedSuperAdminPermissionCatalog> => {
  if (!file.name.toLocaleLowerCase().endsWith(".xlsx")) {
    throw new Error("Vui lòng chọn file Excel .xlsx.");
  }
  return parseSuperAdminPermissionCatalogRows(await readXlsxRows(await file.arrayBuffer()));
};
