import { readXlsxRows } from "./bulkImportFiles";
import type {
  SuperAdminRole,
  SuperAdminRolePermissionGroup,
} from "../services/superAdminApi";

const permissionHeaders = ["Role", "Mã quyền", "Tên quyền", "Mô tả quyền", "Cấp quyền (Có/Không)"];

const normalizeCode = (value: string) => value.trim().toLocaleUpperCase();
const normalizeHeader = (value: string) =>
  value.trim().toLocaleLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export type ParsedSuperAdminRolePermissions = {
  rolePermissions: SuperAdminRolePermissionGroup[];
  importedRowCount: number;
};

export const parseSuperAdminRolePermissionsRows = (
  rows: string[][],
  roles: SuperAdminRole[],
): ParsedSuperAdminRolePermissions => {
  if (rows.length < 2) throw new Error("File Excel chưa có dòng phân quyền nào.");

  const headerIndexes = new Map(rows[0].map((header, index) => [normalizeHeader(header), index]));
  const indexes = permissionHeaders.map((header) => headerIndexes.get(normalizeHeader(header)));
  const missingHeaders = permissionHeaders.filter((_, index) => indexes[index] === undefined);
  if (missingHeaders.length > 0) {
    throw new Error(`File Excel thiếu cột: ${missingHeaders.join(", ")}.`);
  }
  const categoryIndex = headerIndexes.get(normalizeHeader("Danh mục"));

  const roleByCode = new Map(roles.map((role) => [normalizeCode(role.code), role]));
  const groups = new Map<string, Map<string, SuperAdminRolePermissionGroup["permissions"][number]>>();
  const seenAssignments = new Set<string>();
  let importedRowCount = 0;

  rows.slice(1).forEach((row, rowIndex) => {
    if (row.every((cell) => !cell?.trim())) return;
    const rowNumber = rowIndex + 2;
    const values = indexes.map((index) => row[index ?? -1]?.trim() ?? "");
    const [rawRoleCode, rawPermissionCode, name, description, rawGranted] = values;
    const category = categoryIndex === undefined
      ? "Chưa phân loại"
      : row[categoryIndex]?.trim() || "Chưa phân loại";
    const roleCode = normalizeCode(rawRoleCode);
    const permissionCode = normalizeCode(rawPermissionCode);

    if (!roleByCode.has(roleCode)) {
      throw new Error(`Mã role "${rawRoleCode}" ở dòng ${rowNumber} chưa tồn tại. Hãy tạo role trước khi nhập quyền.`);
    }
    if (!/^[A-Z][A-Z0-9_.:-]*$/.test(permissionCode)) {
      throw new Error(`Mã quyền ở dòng ${rowNumber} không hợp lệ.`);
    }
    if (!name) throw new Error(`Tên quyền ở dòng ${rowNumber} không được để trống.`);
    const grantedValue = normalizeHeader(rawGranted);
    const granted = ["co", "yes", "true", "1"].includes(grantedValue);
    if (!granted && !["khong", "no", "false", "0"].includes(grantedValue)) {
      throw new Error(`Cấp quyền ở dòng ${rowNumber} phải là Có/Không, Yes/No hoặc True/False.`);
    }

    const assignmentKey = `${roleCode}:${permissionCode}`;
    if (seenAssignments.has(assignmentKey)) {
      throw new Error(`Quyền ${permissionCode} bị lặp cho role ${roleCode} ở dòng ${rowNumber}.`);
    }
    seenAssignments.add(assignmentKey);

    if (!groups.has(roleCode)) groups.set(roleCode, new Map());
    groups.get(roleCode)?.set(permissionCode, {
      code: permissionCode,
      name,
      category,
      description,
      granted,
    });
    importedRowCount += 1;
  });

  if (importedRowCount === 0) throw new Error("File Excel không có dòng phân quyền hợp lệ.");

  return {
    rolePermissions: [...groups].map(([roleCode, assignments]) => ({
      roleCode,
      permissions: [...assignments.values()],
    })),
    importedRowCount,
  };
};

export const parseSuperAdminRolePermissionsFile = async (
  file: File,
  roles: SuperAdminRole[],
): Promise<ParsedSuperAdminRolePermissions> => {
  if (!file.name.toLocaleLowerCase().endsWith(".xlsx")) {
    throw new Error("Vui lòng chọn file Excel .xlsx.");
  }
  return parseSuperAdminRolePermissionsRows(await readXlsxRows(await file.arrayBuffer()), roles);
};
