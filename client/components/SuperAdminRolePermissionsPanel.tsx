import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  Check,
  ChevronsUpDown,
  Columns3,
  FileSpreadsheet,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";
import { createXlsxWorkbook, downloadFile } from "../lib/bulkImportFiles";
import { parseSuperAdminPermissionCatalogFile } from "../lib/superAdminPermissionCatalogImport";
import { parseSuperAdminRolePermissionsFile } from "../lib/superAdminRolePermissionsImport";
import { parseSuperAdminRolesFile } from "../lib/superAdminRolesImport";
import ClearSearchButton from "./ClearSearchButton";
import FilterResultStatus from "./FilterResultStatus";
import ListPagination from "./ListPagination";
import i18n, { localizedText } from "../i18n";
import { useAppDispatch } from "../store/hooks";
import {
  superAdminApi,
  useCreateSuperAdminPermissionMutation,
  useUpdateSuperAdminPermissionMutation,
  useCreateSuperAdminRoleMutation,
  useUpdateSuperAdminRoleMutation,
  useGetSuperAdminPermissionCatalogQuery,
  useGetSuperAdminRolePermissionsQuery,
  useGetSuperAdminRolesQuery,
  useAddSuperAdminPermissionToRoleMutation,
  useImportSuperAdminPermissionCatalogMutation,
  useImportSuperAdminRolePermissionsMutation,
  useRemoveSuperAdminPermissionFromRoleMutation,
  type SuperAdminPermissionAssignment,
  type SuperAdminPermissionCatalogItem,
  type SuperAdminRole,
} from "../services/superAdminApi";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "./ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

type WorkflowStep = "catalog" | "permissions" | "overview";
type Props = {
  view: "roles" | "permissions";
};

const PERMISSION_HEADERS = ["Role", "Mã quyền", "Tên quyền", "Mô tả quyền", "Danh mục", "Cấp quyền (Có/Không)"];
const CATALOG_HEADERS = ["Mã quyền", "Tên quyền", "Danh mục", "Mô tả quyền"];
const ROLE_HEADERS = ["Mã role", "Tên role", "Mô tả"];
const UNCATEGORIZED = "Chưa phân loại";
const CATALOG_TABLE_COLUMNS = [
  { id: "category", label: "Phân loại", width: 190 },
  { id: "name", label: "Tên quyền", width: 250 },
  { id: "code", label: "Mã quyền", width: 240 },
  { id: "description", label: "Mô tả", width: 340 },
  { id: "roles", label: "Vai trò được gán", width: 480 },
  { id: "actions", label: "Thao tác", width: 160 },
] as const;
type CatalogTableColumnId = (typeof CATALOG_TABLE_COLUMNS)[number]["id"];
const catalogColumnLabel = (id: CatalogTableColumnId) => ({
  category: localizedText("Phân loại", "Category"),
  name: localizedText("Tên quyền", "Permission name"),
  code: localizedText("Mã quyền", "Permission code"),
  description: localizedText("Mô tả", "Description"),
  roles: localizedText("Vai trò được gán", "Assigned roles"),
  actions: localizedText("Thao tác", "Actions"),
}[id]);
const ROLE_TABLE_COLUMNS = [
  { id: "name", label: "Tên vai trò", width: 180 },
  { id: "code", label: "Mã vai trò", width: 200 },
  { id: "description", label: "Mô tả", width: 240 },
  { id: "count", label: "Quyền đã gán", width: 200 },
  { id: "permissions", label: "Danh sách quyền", width: 740 },
  { id: "actions", label: "Thao tác", width: 120 },
] as const;
type RoleTableColumnId = (typeof ROLE_TABLE_COLUMNS)[number]["id"];
const roleColumnLabel = (id: RoleTableColumnId) => ({
  name: localizedText("Tên vai trò", "Role name"),
  code: localizedText("Mã vai trò", "Role code"),
  description: localizedText("Mô tả", "Description"),
  count: localizedText("Quyền đã gán", "Assigned permissions"),
  permissions: localizedText("Danh sách quyền", "Permission list"),
  actions: localizedText("Thao tác", "Actions"),
}[id]);
const normalizeCode = (value: string) => value.trim().toLocaleUpperCase();
const categoryOf = (category?: string) => category?.trim() || UNCATEGORIZED;
const normalizePermissionName = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLocaleLowerCase()
    .replace(/\s+/g, " ")
    .trim();
const permissionNameTranslations: Record<string, string> = {
  "xem bao cao doanh thu": "View revenue reports",
  "quan ly cai dat chi nhanh": "Manage branch settings",
  "quan ly cai dat he thong": "Manage system settings",
  "tao cong viec": "Create tasks",
  "xoa cong viec": "Delete tasks",
  "cap nhat trang thai cong viec": "Update task status",
  "xem cong viec": "View tasks",
  "quan ly tien nghi": "Manage amenities",
  "quan ly toa nha": "Manage buildings",
  "quan ly tang": "Manage floors",
  "xem tien nghi": "View amenities",
  "xem toa nha": "View buildings",
  "xem tang": "View floors",
  "tao dich vu": "Create services",
  "xoa dich vu": "Delete services",
  "quan ly trang thai dich vu": "Manage service status",
  "cap nhat dich vu": "Update services",
  "xem dich vu": "View services",
  "tao hoa don": "Create invoices",
  "in hoa don": "Print invoices",
  "xem hoa don": "View invoices",
  "tao khuyen mai": "Create promotions",
  "xoa khuyen mai": "Delete promotions",
  "cap nhat khuyen mai": "Update promotions",
  "xem khuyen mai": "View promotions",
  "quan ly khach hang": "Manage customers",
  "xem khach hang": "View customers",
  "them nhan vien": "Add employees",
  "xoa nhan vien": "Delete employees",
  "quan ly ca lam viec": "Manage shifts",
  "cap nhat nhan vien": "Update employees",
  "xem nhan vien": "View employees",
  "xem ca lam viec": "View shifts",
  "quan ly nhan/tra phong": "Manage check-in/check-out",
  "xem nhan/tra phong": "View check-in/check-out",
  "tao phong": "Create rooms",
  "xoa phong": "Delete rooms",
  "cap nhat phong": "Update rooms",
  "cap nhat trang thai phong": "Update room status",
  "xem phong": "View rooms",
  "tao chi nhanh": "Create branches",
  "tao quyen": "Create permissions",
  "tao vai tro": "Create roles",
  "xoa quyen": "Delete permissions",
  "xoa vai tro": "Delete roles",
  "quan ly phan quyen": "Manage role permissions",
  "quan ly role": "Manage roles",
  "cap nhat quyen": "Update permissions",
  "cap nhat vai tro": "Update roles",
  "xem quyen": "View permissions",
  "xem vai tro": "View roles",
  "quan ly ho so ca nhan": "Manage personal profiles",
  "xem bang dieu khien": "View dashboard",
  "tong quan": "Overview",
  "tổng quan": "Overview",
  "cong viec": "Tasks",
  "công việc": "Tasks",
  "co so vat chat": "Facilities",
  "cơ sở vật chất": "Facilities",
  "tao dat phong": "Create bookings",
  "xoa dat phong": "Delete bookings",
  "cap nhat dat phong": "Update bookings",
  "xem dat phong": "View bookings",
  "dat phong": "Bookings",
  "cai dat": "Settings",
  "cài đặt": "Settings",
  "hoa don": "Invoices",
  "hóa đơn": "Invoices",
  "tai khoan": "Account",
  "tài khoản": "Account",
  "tai khoan ca nhan": "Personal account",
  "tài khoản cá nhân": "Personal account",
  "quan tri phan quyen": "Access management",
  "quản trị phân quyền": "Access management",
  "quan li chi nhanh": "Branch management",
  "quản lý chi nhánh": "Branch management",
  "khuyen mai": "Promotions",
  "khuyến mãi": "Promotions",
  "nhan su": "Human resources",
  "nhân sự": "Human resources",
  "nhan tra phong": "Check-in/out",
  "nhận trả phòng": "Check-in/out",
  "nhan/tra phong": "Check-in/out",
  "nhận/trả phòng": "Check-in/out",
  "khach hang": "Customers",
  "khách hàng": "Customers",
  "nhan vien": "Employees",
  "nhân viên": "Employees",
  "phong": "Rooms",
  "phòng": "Rooms",
  "dich vu": "Services",
  "dịch vụ": "Services",
  "bao cao": "Reports",
  "báo cáo": "Reports",
  "chuyen doi": "Conversion",
  "chuyển đổi": "Conversion",
  "thiet lap": "Configuration",
  "thiết lập": "Configuration",
  "tao role": "Create roles",
  "xoa role": "Delete roles",
  "cap nhat role": "Update roles",
  "xem role": "View roles",
  "quan ly role": "Manage roles",
  "cho phep xem bao cao doanh thu": "Allows viewing revenue reports",
  "cho phep quan ly cai dat chi nhanh": "Allows managing branch settings",
  "cho phep quan ly cai dat he thong": "Allows managing system settings",
  "cho phep tao cong viec": "Allows creating tasks",
  "cho phep xoa cong viec": "Allows deleting tasks",
  "cho phep cap nhat trang thai cong viec": "Allows updating task status",
  "cho phep xem cong viec": "Allows viewing tasks",
  "cho phep quan ly tien nghi": "Allows managing amenities",
  "cho phep quan ly toa nha": "Allows managing buildings",
  "cho phep quan ly tang": "Allows managing floors",
  "cho phep xem tien nghi": "Allows viewing amenities",
  "cho phep xem toa nha": "Allows viewing buildings",
  "cho phep xem tang": "Allows viewing floors",
  "cho phep tao dich vu": "Allows creating services",
  "cho phep xoa dich vu": "Allows deleting services",
  "tao chi nhanh va tai khoan ban dau": "Create a branch and initial account",
  "nhap va gan permission": "Import and assign permissions",
  "cho phép xem đặt phòng": "Allows viewing bookings",
  "cho phép tạo đặt phòng": "Allows creating bookings",
  "cho phép cập nhật đặt phòng": "Allows updating bookings",
  "cho phép xóa đặt phòng": "Allows deleting bookings",
  "cho phép xem quyền": "Allows viewing permissions",
  "cho phép quản lý quyền": "Allows managing permissions",
  "cho phép xem vai trò": "Allows viewing roles",
  "cho phép quản lý vai trò": "Allows managing roles",
  "cho phép xem dashboard": "Allows viewing dashboard",
  "cho phép xem đặt phòng": "Allows viewing bookings",
  "cho phép tạo đặt phòng": "Allows creating bookings",
  "cho phép cập nhật đặt phòng": "Allows updating bookings",
  "cho phép xóa đặt phòng": "Allows deleting bookings",
  "cho phép xem quyền": "Allows viewing permissions",
  "cho phép quản lý quyền": "Allows managing permissions",
  "cho phép xem vai trò": "Allows viewing roles",
  "cho phép quản lý vai trò": "Allows managing roles",
  "cho phép xem dashboard": "Allows viewing dashboard",
  "cho phep xem dat phong": "Allows viewing bookings",
  "cho phep tao dat phong": "Allows creating bookings",
  "cho phep cap nhat dat phong": "Allows updating bookings",
  "cho phep xoa dat phong": "Allows deleting bookings",
  "cho phep xem quyen": "Allows viewing permissions",
  "cho phep quan ly quyen": "Allows managing permissions",
  "cho phep xem vai tro": "Allows viewing roles",
  "cho phep quan ly vai tro": "Allows managing roles",
  "cho phep xem bang dieu khien": "Allows viewing dashboard",
  "có quyền xem đặt phòng": "Allows viewing bookings",
  "có quyền tạo đặt phòng": "Allows creating bookings",
  "có quyền cập nhật đặt phòng": "Allows updating bookings",
  "có quyền xóa đặt phòng": "Allows deleting bookings",
  "có quyền xem quyền": "Allows viewing permissions",
  "có quyền quản lý quyền": "Allows managing permissions",
  "có quyền xem vai trò": "Allows viewing roles",
  "có quyền quản lý vai trò": "Allows managing roles",
  "có quyền xem dashboard": "Allows viewing dashboard",
};
const translateDisplayText = (value: string | undefined | null) => {
  if (!value) return value ?? "";
  if (!i18n.language.startsWith("en")) return value;
  const normalized = normalizePermissionName(value).replace(/[.!?]+$/, "");
  const translation = permissionNameTranslations[normalized];
  if (translation) return translation;

  const descriptionPrefix = "cho phep ";
  if (!normalized.startsWith(descriptionPrefix)) return value;

  const permissionLabel = permissionNameTranslations[normalized.slice(descriptionPrefix.length)];
  if (!permissionLabel) return value;

  const actionForms: Record<string, string> = {
    "View ": "viewing ",
    "Create ": "creating ",
    "Delete ": "deleting ",
    "Update ": "updating ",
    "Manage ": "managing ",
    "Add ": "adding ",
    "Print ": "printing ",
  };
  const action = Object.entries(actionForms).find(([prefix]) => permissionLabel.startsWith(prefix));
  return action
    ? `Allows ${action[1]}${permissionLabel.slice(action[0].length)}`
    : value;
};
const permissionNameLabel = (name: string) => translateDisplayText(name);
const getApiFieldErrors = (
  error: unknown,
  fieldAliases: Record<string, string[]>,
): Record<string, string> => {
  const fieldErrors: Record<string, string> = {};
  const matchField = (value: unknown) => {
    if (typeof value !== "string") return undefined;
    const normalized = value.toLocaleLowerCase().replace(/[_-]+/g, " ").trim();
    return Object.entries(fieldAliases).find(([, aliases]) =>
      aliases.some((alias) => normalized === alias || normalized.includes(alias)),
    )?.[0];
  };
  const getMessage = (value: unknown): string | undefined => {
    if (typeof value === "string") return value;
    if (Array.isArray(value)) {
      const messages = value.map(getMessage).filter((message): message is string => Boolean(message));
      return messages.length > 0 ? messages.join(" ") : undefined;
    }
    if (!value || typeof value !== "object") return undefined;
    for (const key of ["message", "defaultMessage", "reason"]) {
      if (key in value && typeof value[key] === "string") return value[key];
    }
    return undefined;
  };

  const data = error && typeof error === "object" && "data" in error ? error.data : error;
  if (data && typeof data === "object") {
    for (const errorsKey of ["errors", "fieldErrors", "validationErrors"]) {
      if (!(errorsKey in data)) continue;
      const errors = data[errorsKey];
      if (Array.isArray(errors)) {
        errors.forEach((item) => {
          if (!item || typeof item !== "object") return;
          const field = matchField(item.field ?? item.name ?? item.property ?? item.path);
          const message = getMessage(item);
          if (field && message) fieldErrors[field] = message;
        });
      } else if (errors && typeof errors === "object") {
        Object.entries(errors).forEach(([key, value]) => {
          const field = matchField(key);
          const message = getMessage(value);
          if (field && message) fieldErrors[field] = message;
        });
      }
    }
  }

  const message = getMessage(data && typeof data === "object" && "message" in data ? data.message : error);
  if (message) {
    const field = matchField(message);
    if (field && !fieldErrors[field]) fieldErrors[field] = message;
    const normalizedMessage = message.toLocaleLowerCase();
    if (
      !fieldErrors.code
      && /(already exists|already used|duplicate|đã tồn tại|đã được sử dụng|trùng)/i.test(normalizedMessage)
    ) {
      fieldErrors.code = message;
    }
  }

  return fieldErrors;
};

const downloadRoleTemplate = () => {
  const workbook = createXlsxWorkbook([
    {
      name: "Danh sách vai trò",
      rows: [
        ROLE_HEADERS,
        ["ROLE_RECEPTIONIST", "Lễ tân", "Tiếp nhận khách và quản lý đặt phòng"],
      ],
    },
    {
      name: "Hướng dẫn",
      rows: [
        ["HƯỚNG DẪN NHẬP VAI TRÒ"],
        ["Mỗi dòng khai báo một vai trò."],
        ["Giữ nguyên ba cột: Mã role, Tên role, Mô tả."],
        ["Mã role phải bắt đầu bằng ROLE_ và chỉ gồm chữ in hoa, số hoặc dấu gạch dưới."],
        ["Mã role không được trùng với role đã có trong hệ thống."],
        ["Cả ba trường đều bắt buộc."],
      ],
    },
  ]);
  downloadFile("mau-danh-sach-vai-tro.xlsx", workbook);
};

const downloadPermissionTemplate = (roles: SuperAdminRole[]) => {
  const rows: Array<Array<string | number>> = [
    PERMISSION_HEADERS,
    ...Array.from({ length: 10 }, () => ["", "", "", "", "", ""]),
  ];
  const workbook = createXlsxWorkbook([
    {
      name: "Phân quyền",
      rows,
      validations: [
        { range: "A2:A1000", type: "list", formula1: "=RoleList" },
        { range: "F2:F1000", type: "list", formula1: "\"Có,Không\"" },
      ],
    },
    {
      name: "Danh sách role",
      rows: [
        ["Mã role", "Tên role", "Mô tả"],
        ...roles.map((role) => [role.code, role.name, role.description]),
      ],
    },
    {
      name: "Hướng dẫn",
      rows: [
        ["HƯỚNG DẪN NHẬP QUYỀN"],
        ["Tạo role trước, sau đó tải file mẫu để tự động lấy danh sách role."],
        ["Chọn role bằng danh sách thả xuống ở cột Role; sheet Danh sách role được tạo tự động."],
        ["Nhập Mã quyền, Tên quyền, Mô tả quyền và Danh mục. Mỗi dòng là một quyền của một role."],
        ["Chọn Có để cấp hoặc Không để gỡ quyền; cột trống mặc định là Có."],
        ["Khi nhập, danh sách quyền của từng role xuất hiện trong file sẽ được thay theo các dòng Có."],
        ["Mã quyền chỉ dùng chữ, số, dấu gạch dưới, chấm, hai chấm hoặc gạch ngang."],
        ["Không nhập mật khẩu hay dữ liệu nhạy cảm vào file."],
      ],
    },
  ], [
    {
      name: "RoleList",
      formula: `'Danh sách role'!$A$2:$A$${roles.length + 1}`,
    },
  ]);
  downloadFile("mau-phan-quyen-role.xlsx", workbook);
};

const downloadPermissionCatalogTemplate = () => {
  const workbook = createXlsxWorkbook([
    {
      name: "Danh mục quyền",
      rows: [
        CATALOG_HEADERS,
        ["VIEW_SPECIAL_REPORT", "Xem báo cáo đặc biệt", "Báo cáo", "Cho phép xem báo cáo đặc biệt"],
      ],
    },
    {
      name: "Hướng dẫn",
      rows: [
        ["HƯỚNG DẪN NHẬP DANH MỤC QUYỀN"],
        ["Mỗi dòng khai báo một quyền; quyền có thể chưa được gán cho role nào."],
        ["Giữ nguyên bốn cột: Mã quyền, Tên quyền, Danh mục, Mô tả quyền."],
        ["Danh mục là nhóm hiển thị, ví dụ: Đặt phòng, Phòng, Khách hàng, Báo cáo."],
        ["Mã quyền chỉ gồm chữ in hoa, số, dấu gạch dưới, chấm, hai chấm hoặc gạch ngang; bắt đầu bằng chữ."],
        ["Nếu mã quyền đã tồn tại, hệ thống cập nhật tên, danh mục và mô tả mà không thay đổi việc gán quyền vào role."],
      ],
    },
  ]);
  downloadFile("mau-danh-muc-quyen.xlsx", workbook);
};

export default function SuperAdminRolePermissionsPanel({ view }: Props) {
  const dispatch = useAppDispatch();
  const {
    data: roles = [],
    isLoading: isRolesLoading,
    isError: isRolesError,
    refetch: refetchRoles,
  } = useGetSuperAdminRolesQuery();
  const {
    data: rolePermissionGroups = [],
    isLoading: isRolePermissionsLoading,
    isError: isRolePermissionsError,
    refetch: refetchRolePermissions,
  } = useGetSuperAdminRolePermissionsQuery();
  const {
    data: permissions = [],
    isLoading: isPermissionCatalogLoading,
    isError: isPermissionCatalogError,
    refetch: refetchPermissionCatalog,
  } = useGetSuperAdminPermissionCatalogQuery();
  const [createPermissionRequest, { isLoading: isCreatingPermission }] =
    useCreateSuperAdminPermissionMutation();
  const [updatePermissionRequest, { isLoading: isUpdatingPermission }] =
    useUpdateSuperAdminPermissionMutation();
  const [importPermissionCatalogRequest, { isLoading: isSavingPermissionCatalog }] =
    useImportSuperAdminPermissionCatalogMutation();
  const [createRoleRequest, { isLoading: isCreatingRole }] = useCreateSuperAdminRoleMutation();
  const [updateRoleRequest, { isLoading: isUpdatingRole }] = useUpdateSuperAdminRoleMutation();
  const [importRolePermissionsRequest, { isLoading: isSavingPermissions }] =
    useImportSuperAdminRolePermissionsMutation();
  const [addPermissionToRole, { isLoading: isAddingPermission }] =
    useAddSuperAdminPermissionToRoleMutation();
  const [removePermissionFromRole, { isLoading: isRemovingPermission }] =
    useRemoveSuperAdminPermissionFromRoleMutation();
  const [activeStep, setActiveStep] = useState<WorkflowStep>("catalog");
  const [showAllRolePermissions, setShowAllRolePermissions] = useState(false);
  const [visibleRoleColumns, setVisibleRoleColumns] = useState<Record<RoleTableColumnId, boolean>>({
    name: true,
    code: true,
    description: true,
    count: true,
    permissions: true,
    actions: true,
  });
  const [roleSearch, setRoleSearch] = useState("");
  const [rolePage, setRolePage] = useState(1);
  const [rolePageSize, setRolePageSize] = useState(10);
  const [roleCode, setRoleCode] = useState("");
  const [roleName, setRoleName] = useState("");
  const [roleDescription, setRoleDescription] = useState("");
  const [editingRoleCode, setEditingRoleCode] = useState<string | null>(null);
  const [roleError, setRoleError] = useState("");
  const [roleFieldErrors, setRoleFieldErrors] = useState<Record<string, string>>({});
  const [addRoleMode, setAddRoleMode] = useState<"single" | "excel">("single");
  const [roleFileError, setRoleFileError] = useState("");
  const [roleFileMessage, setRoleFileMessage] = useState("");
  const [isImportingRoles, setIsImportingRoles] = useState(false);
  const [assignmentRoleCode, setAssignmentRoleCode] = useState("");
  const [assignmentCategory, setAssignmentCategory] = useState("all");
  const [isAssignmentCategoryOpen, setIsAssignmentCategoryOpen] = useState(false);
  const [assignmentCategorySearch, setAssignmentCategorySearch] = useState("");
  const [permissionCode, setPermissionCode] = useState("");
  const [permissionName, setPermissionName] = useState("");
  const [permissionCategory, setPermissionCategory] = useState("");
  const [permissionDescription, setPermissionDescription] = useState("");
  const [editingPermissionCode, setEditingPermissionCode] = useState<string | null>(null);
  const [catalogError, setCatalogError] = useState("");
  const [permissionFieldErrors, setPermissionFieldErrors] = useState<Record<string, string>>({});
  const [catalogMessage, setCatalogMessage] = useState("");
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogPage, setCatalogPage] = useState(1);
  const [catalogPageSize, setCatalogPageSize] = useState(10);
  const [visibleCatalogColumns, setVisibleCatalogColumns] = useState<Record<CatalogTableColumnId, boolean>>({
    category: true,
    name: true,
    code: true,
    description: true,
    roles: true,
    actions: true,
  });
  const [catalogFileError, setCatalogFileError] = useState("");
  const [catalogFileMessage, setCatalogFileMessage] = useState("");
  const [isAddPermissionDialogOpen, setIsAddPermissionDialogOpen] = useState(false);
  const [isAddRoleDialogOpen, setIsAddRoleDialogOpen] = useState(false);
  const [isImportRolePermissionsDialogOpen, setIsImportRolePermissionsDialogOpen] = useState(false);
  const [addPermissionMode, setAddPermissionMode] = useState<"single" | "excel">("single");
  const [importError, setImportError] = useState("");
  const [importMessage, setImportMessage] = useState("");
  const [permissionActionError, setPermissionActionError] = useState("");
  const [pendingPermissionChange, setPendingPermissionChange] = useState<{
    roleCode: string;
    permission: SuperAdminPermissionAssignment;
  } | null>(null);
  const [pendingBulkPermissionAssignment, setPendingBulkPermissionAssignment] = useState<{
    permission: SuperAdminPermissionCatalogItem;
    roleCodes: string[];
  } | null>(null);
  const [permissionToAssign, setPermissionToAssign] = useState<SuperAdminPermissionCatalogItem | null>(null);
  const [catalogAssignmentRoleCode, setCatalogAssignmentRoleCode] = useState("");
  const [isConfirmingPermissionChange, setIsConfirmingPermissionChange] = useState(false);
  const [isConfirmingBulkAssignment, setIsConfirmingBulkAssignment] = useState(false);
  const [updatingAssignment, setUpdatingAssignment] = useState<string | null>(null);
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [overviewSearch, setOverviewSearch] = useState("");
  const [showOnlyGranted, setShowOnlyGranted] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const catalogFileInputRef = useRef<HTMLInputElement>(null);
  const roleFileInputRef = useRef<HTMLInputElement>(null);
  const isImporting = isReadingFile || isSavingPermissions || isSavingPermissionCatalog;
  const isUpdatingAssignment = isAddingPermission || isRemovingPermission;
  const optimisticallyUpdateRolePermission = (
    targetRoleCode: string,
    permission: SuperAdminPermissionAssignment,
    granted: boolean,
  ) => dispatch(superAdminApi.util.updateQueryData(
    "getSuperAdminRolePermissions",
    undefined,
    (groups) => {
      let group = groups.find((item) => item.roleCode === targetRoleCode);
      if (!group && granted) {
        group = { roleCode: targetRoleCode, permissions: [] };
        groups.push(group);
      }

      const currentPermission = group?.permissions.find((item) => item.code === permission.code);
      if (currentPermission) {
        currentPermission.granted = granted;
      } else if (granted) {
        group?.permissions.push({ ...permission, granted: true });
      }
    },
  ));

  const getErrorMessage = (error: unknown, fallback: string) => {
    if (error && typeof error === "object" && "data" in error) {
      const data = error.data;
      if (data && typeof data === "object" && "message" in data && typeof data.message === "string") {
        return data.message;
      }
    }
    if (error instanceof Error) return error.message;
    return fallback;
  };

  const resetRoleForm = () => {
    setRoleCode("");
    setRoleName("");
    setRoleDescription("");
    setRoleFieldErrors({});
    setRoleError("");
    setEditingRoleCode(null);
  };

  const createRole = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setRoleError("");
    const fieldErrors: Record<string, string> = {};
    const code = normalizeCode(roleCode);
    if (!/^ROLE_[A-Z0-9_]+$/.test(code)) {
      fieldErrors.code = localizedText("Mã role cần bắt đầu bằng ROLE_ và chỉ gồm chữ in hoa, số hoặc dấu gạch dưới.", "Role codes must start with ROLE_ and contain only uppercase letters, numbers, or underscores.");
    }
    if (!editingRoleCode && !fieldErrors.code && roles.some((role) => role.code === code)) {
      fieldErrors.code = localizedText(`Role ${code} đã tồn tại.`, `Role ${code} already exists.`);
    }
    if (!roleName.trim()) fieldErrors.name = localizedText("Vui lòng nhập tên role.", "Enter a role name.");
    if (!roleDescription.trim()) fieldErrors.description = localizedText("Vui lòng nhập mô tả role.", "Enter a role description.");
    setRoleFieldErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) {
      return;
    }
    try {
      if (editingRoleCode) {
        await updateRoleRequest({
          roleCode: editingRoleCode,
          data: {
            code,
            name: roleName.trim(),
            description: roleDescription.trim(),
          },
        }).unwrap();
      } else {
        await createRoleRequest({
          code,
          name: roleName.trim(),
          description: roleDescription.trim(),
        }).unwrap();
      }
      resetRoleForm();
      setIsAddRoleDialogOpen(false);
      setActiveStep("catalog");
    } catch (error) {
      const fieldErrors = getApiFieldErrors(error, {
        code: ["code", "role code", "rolecode", "mã role"],
        name: ["name", "role name", "rolename", "tên role"],
        description: ["description", "mô tả"],
      });
      if (Object.keys(fieldErrors).length > 0) {
        setRoleFieldErrors(fieldErrors);
      } else {
        setRoleError(getErrorMessage(error, editingRoleCode
          ? localizedText("Không thể cập nhật role. Vui lòng thử lại.", "Could not update the role. Please try again.")
          : localizedText("Không thể tạo role. Vui lòng thử lại.", "Could not create the role. Please try again.")));
      }
    }
  };

  const importRoles = async (file?: File) => {
    setRoleFileError("");
    setRoleFileMessage("");
    if (!file) return;

    setIsImportingRoles(true);
    let createdCount = 0;
    try {
      const importedRoles = await parseSuperAdminRolesFile(file, roles);
      for (const role of importedRoles) {
        try {
          await createRoleRequest(role).unwrap();
          createdCount += 1;
        } catch (error) {
          const reason = getErrorMessage(error, "Lỗi không xác định.");
          const progress = createdCount > 0
            ? ` Đã tạo ${createdCount}/${importedRoles.length} vai trò trước khi gặp lỗi.`
            : "";
          setRoleFileError(`Không thể tạo role ${role.code}: ${reason}${progress}`);
          return;
        }
      }

      setRoleFileMessage(`Đã tạo ${createdCount} vai trò từ ${file.name}.`);
      setIsAddRoleDialogOpen(false);
    } catch (error) {
      setRoleFileError(getErrorMessage(error, "Không thể đọc file hoặc nhập danh sách vai trò."));
    } finally {
      setIsImportingRoles(false);
      if (roleFileInputRef.current) roleFileInputRef.current.value = "";
    }
  };

  const resetPermissionForm = () => {
    setPermissionCode("");
    setPermissionName("");
    setPermissionCategory("");
    setPermissionDescription("");
    setPermissionFieldErrors({});
    setCatalogError("");
    setEditingPermissionCode(null);
  };

  const createPermission = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCatalogError("");
    setCatalogMessage("");
    const fieldErrors: Record<string, string> = {};
    const code = normalizeCode(permissionCode);
    if (!/^[A-Z][A-Z0-9_.:-]*$/.test(code)) {
      fieldErrors.code = localizedText("Mã quyền phải bắt đầu bằng chữ và chỉ gồm chữ in hoa, số, dấu gạch dưới, chấm, hai chấm hoặc gạch ngang.", "Permission codes must start with a letter and contain only uppercase letters, numbers, underscores, periods, colons, or hyphens.");
    }
    if (!editingPermissionCode && !fieldErrors.code && permissions.some((permission) => normalizeCode(permission.code) === code)) {
      fieldErrors.code = localizedText(`Mã quyền ${code} đã tồn tại.`, `Permission code ${code} already exists.`);
    }
    if (!permissionName.trim()) fieldErrors.name = localizedText("Vui lòng nhập tên quyền.", "Enter a permission name.");
    if (!permissionCategory.trim()) fieldErrors.category = localizedText("Vui lòng nhập danh mục quyền.", "Enter a permission category.");
    if (!permissionDescription.trim()) fieldErrors.description = localizedText("Vui lòng nhập mô tả quyền.", "Enter a permission description.");
    setPermissionFieldErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) {
      return;
    }
    try {
      if (editingPermissionCode) {
        await updatePermissionRequest({
          permissionCode: editingPermissionCode,
          data: {
            code,
            name: permissionName.trim(),
            category: permissionCategory.trim(),
            description: permissionDescription.trim(),
          },
        }).unwrap();
      } else {
        await createPermissionRequest({
          code,
          name: permissionName.trim(),
          category: permissionCategory.trim(),
          description: permissionDescription.trim(),
        }).unwrap();
      }
      resetPermissionForm();
      setCatalogMessage(
        editingPermissionCode
          ? localizedText(`Đã cập nhật quyền ${code}.`, `Permission ${code} updated.`)
          : localizedText(`Đã tạo quyền ${code}.`, `Permission ${code} created.`),
      );
      setIsAddPermissionDialogOpen(false);
    } catch (error) {
      const fieldErrors = getApiFieldErrors(error, {
        code: ["code", "permission code", "permissioncode", "mã quyền"],
        name: ["name", "permission name", "permissionname", "tên quyền"],
        category: ["category", "danh mục"],
        description: ["description", "mô tả"],
      });
      if (Object.keys(fieldErrors).length > 0) {
        setPermissionFieldErrors(fieldErrors);
      } else {
        setCatalogError(getErrorMessage(error, editingPermissionCode
          ? localizedText("Không thể cập nhật quyền. Vui lòng thử lại.", "Could not update the permission. Please try again.")
          : localizedText("Không thể tạo quyền. Vui lòng thử lại.", "Could not create the permission. Please try again.")));
      }
    }
  };

  const importPermissionCatalog = async (file?: File) => {
    setCatalogFileError("");
    setCatalogFileMessage("");
    if (!file) return;
    setIsReadingFile(true);
    try {
      const parsed = await parseSuperAdminPermissionCatalogFile(file);
      await importPermissionCatalogRequest(parsed.permissions).unwrap();
      setCatalogFileMessage(`Đã nhập ${parsed.permissions.length} quyền từ ${file.name}.`);
      setIsAddPermissionDialogOpen(false);
    } catch (error) {
      setCatalogFileError(getErrorMessage(error, localizedText("Không thể đọc file hoặc nhập danh mục quyền.", "Could not read the file or import the permission catalog.")));
    } finally {
      setIsReadingFile(false);
      if (catalogFileInputRef.current) catalogFileInputRef.current.value = "";
    }
  };

  const toggleRolePermission = async (
    roleCode: string,
    permission: SuperAdminPermissionAssignment,
  ): Promise<boolean> => {
    const assignmentKey = `${roleCode}:${permission.code}`;
    setUpdatingAssignment(assignmentKey);
    setPermissionActionError("");
    const optimisticUpdate = optimisticallyUpdateRolePermission(
      roleCode,
      permission,
      !permission.granted,
    );
    try {
      const request = permission.granted ? removePermissionFromRole : addPermissionToRole;
      await request({ roleCode, permissionCode: permission.code }).unwrap();
      return true;
    } catch (error) {
      optimisticUpdate.undo();
      setPermissionActionError(
        getErrorMessage(
          error,
          localizedText(
            `Không thể cập nhật quyền ${permission.code} cho role ${roleCode}.`,
            `Could not update permission ${permission.code} for role ${roleCode}.`,
          ),
        ),
      );
      return false;
    } finally {
      setUpdatingAssignment(null);
    }
  };

  const confirmPermissionChange = async () => {
    if (!pendingPermissionChange) return;
    setIsConfirmingPermissionChange(true);
    const succeeded = await toggleRolePermission(
      pendingPermissionChange.roleCode,
      pendingPermissionChange.permission,
    );
    setIsConfirmingPermissionChange(false);
    if (succeeded) setPendingPermissionChange(null);
  };

  const confirmBulkPermissionAssignment = async () => {
    if (!pendingBulkPermissionAssignment) return;
    setIsConfirmingBulkAssignment(true);
    setPermissionActionError("");
    const failedRoles: string[] = [];
    const permissionAssignment = {
      ...pendingBulkPermissionAssignment.permission,
      granted: false,
    };

    for (const roleCode of pendingBulkPermissionAssignment.roleCodes) {
      const optimisticUpdate = optimisticallyUpdateRolePermission(
        roleCode,
        permissionAssignment,
        true,
      );
      try {
        await addPermissionToRole({
          roleCode,
          permissionCode: pendingBulkPermissionAssignment.permission.code,
        }).unwrap();
      } catch {
        optimisticUpdate.undo();
        failedRoles.push(roleCode);
      }
    }

    const assignedCount = pendingBulkPermissionAssignment.roleCodes.length - failedRoles.length;
    if (failedRoles.length > 0) {
      setPermissionActionError(
        localizedText(
          `Đã gán quyền cho ${assignedCount}/${pendingBulkPermissionAssignment.roleCodes.length} vai trò. Không thể gán cho: ${failedRoles.join(", ")}.`,
          `Permission assigned to ${assignedCount}/${pendingBulkPermissionAssignment.roleCodes.length} roles. Could not assign to: ${failedRoles.join(", ")}.`,
        ),
      );
      setPendingBulkPermissionAssignment({
        ...pendingBulkPermissionAssignment,
        roleCodes: failedRoles,
      });
    } else {
      setCatalogMessage(
        localizedText(
          `Đã gán quyền ${permissionNameLabel(pendingBulkPermissionAssignment.permission.name)} cho ${assignedCount} vai trò.`,
          `Permission ${permissionNameLabel(pendingBulkPermissionAssignment.permission.name)} assigned to ${assignedCount} roles.`,
        ),
      );
      setPendingBulkPermissionAssignment(null);
    }
    setIsConfirmingBulkAssignment(false);
  };

  const importPermissions = async (file?: File) => {
    setImportError("");
    setImportMessage("");
    if (!file) return;
    setIsReadingFile(true);
    try {
      const parsed = await parseSuperAdminRolePermissionsFile(file, roles);
      await importRolePermissionsRequest(parsed.rolePermissions).unwrap();
      setImportMessage(`Đã nạp ${parsed.importedRowCount} dòng phân quyền từ ${file.name}.`);
    } catch (error) {
      setImportError(getErrorMessage(error, localizedText("Không thể đọc file hoặc nạp quyền. Vui lòng thử lại.", "Could not read the file or load the permissions. Please try again.")));
    } finally {
      setIsReadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };
  const navigateToStep = (step: WorkflowStep) => {
    setRoleError("");
    setIsAddPermissionDialogOpen(false);
    setIsAddRoleDialogOpen(false);
    setActiveStep(step);
  };
  const filteredCatalogPermissions = permissions.filter((permission) =>
    [permission.code, permission.name, categoryOf(permission.category), permission.description]
      .some((value) => value.toLocaleLowerCase().includes(catalogSearch.trim().toLocaleLowerCase())),
  );
  const catalogTotalPages = Math.max(1, Math.ceil(filteredCatalogPermissions.length / catalogPageSize));
  const safeCatalogPage = Math.min(catalogPage, catalogTotalPages);
  const paginatedCatalogPermissions = filteredCatalogPermissions.slice(
    (safeCatalogPage - 1) * catalogPageSize,
    safeCatalogPage * catalogPageSize,
  );
  const catalogPermissionsByCategory = new Map<string, typeof filteredCatalogPermissions>();
  paginatedCatalogPermissions.forEach((permission) => {
    const category = categoryOf(permission.category);
    const categoryPermissions = catalogPermissionsByCategory.get(category) ?? [];
    categoryPermissions.push(permission);
    catalogPermissionsByCategory.set(category, categoryPermissions);
  });
  const catalogCategoryCount = new Set(
    filteredCatalogPermissions.map((permission) => categoryOf(permission.category)),
  ).size;
  const shownCatalogColumns = CATALOG_TABLE_COLUMNS.filter((column) => visibleCatalogColumns[column.id]);
  const shownCatalogTableWidth = shownCatalogColumns.reduce((total, column) => total + column.width, 0);
  const shownRoleColumns = ROLE_TABLE_COLUMNS.filter((column) => visibleRoleColumns[column.id]);
  const shownRoleTableWidth = shownRoleColumns.reduce((total, column) => total + column.width, 0);
  const filteredRoles = useMemo(() => {
    const query = roleSearch.trim().toLocaleLowerCase();
    if (!query) return roles;
    return roles.filter((role) =>
      [role.code, role.name, role.description].some((value) => value?.toLocaleLowerCase().includes(query)),
    );
  }, [roleSearch, roles]);
  const roleTotalPages = Math.max(1, Math.ceil(filteredRoles.length / rolePageSize));
  const safeRolePage = Math.min(rolePage, roleTotalPages);
  const paginatedRoles = filteredRoles.slice(
    (safeRolePage - 1) * rolePageSize,
    safeRolePage * rolePageSize,
  );
  useEffect(() => {
    setRolePage(1);
  }, [roleSearch, rolePageSize]);
  useEffect(() => {
    if (rolePage > roleTotalPages) setRolePage(roleTotalPages);
  }, [rolePage, roleTotalPages]);
  useEffect(() => {
    setCatalogPage(1);
  }, [catalogSearch, catalogPageSize]);
  useEffect(() => {
    if (catalogPage > catalogTotalPages) setCatalogPage(catalogTotalPages);
  }, [catalogPage, catalogTotalPages]);
  const permissionSerialNumbers = new Map(
    filteredCatalogPermissions.map((permission, index) => [permission.code, index + 1]),
  );
  const selectedAssignmentRoleCode = assignmentRoleCode || roles[0]?.code || "";
  const assignmentCategories = [...new Set(permissions.map((permission) => categoryOf(permission.category)))]
    .sort((left, right) => left.localeCompare(right, "vi"));
  const selectedRolePermissionGroup = rolePermissionGroups.find(
    (group) => group.roleCode === selectedAssignmentRoleCode,
  );
  const isPermissionAlreadyAssignedToSelectedRole = permissionToAssign
    ? rolePermissionGroups
      .find((group) => group.roleCode === catalogAssignmentRoleCode)
      ?.permissions.some((permission) => permission.code === permissionToAssign.code && permission.granted) ?? false
    : false;
  const rolesMissingPermission = permissionToAssign
    ? roles.filter((role) =>
      !rolePermissionGroups
        .find((group) => group.roleCode === role.code)
        ?.permissions.some((permission) => permission.code === permissionToAssign.code && permission.granted),
    )
    : [];
  const permissionsForAssignment = permissions
    .filter((permission) =>
      assignmentCategory === "all" || categoryOf(permission.category) === assignmentCategory,
    )
    .map((permission) => ({
      ...permission,
      granted: selectedRolePermissionGroup?.permissions.find((item) => item.code === permission.code)?.granted ?? false,
    }));

  return (
    <section className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="border-b border-slate-100 p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <ShieldCheck size={19} className="text-blue-600" />
          <h2 className="text-lg font-bold text-slate-900">
            {view === "roles" ? localizedText("Quản lý vai trò", "Manage roles") : localizedText("Quản lý quyền", "Manage permissions")}
          </h2>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          {view === "roles"
            ? localizedText("Tạo và xem các vai trò được sử dụng trong hệ thống.", "Create and view roles used in the system.")
            : localizedText("Quản lý danh mục quyền, gán quyền cho vai trò và xem tổng quan phân quyền.", "Manage the permission catalog, assign permissions to roles, and review permission assignments.")}
        </p>
      </header>

      {(isRolesError || isRolePermissionsError || isPermissionCatalogError) && (
        <div role="alert" className="mx-4 mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 sm:mx-5">
          <p>{localizedText("Không thể tải role hoặc danh mục quyền từ backend.", "Could not load roles or the permission catalog from the backend.")}</p>
          <div className="mt-2 flex gap-3 font-semibold">
            {isRolesError && <button type="button" onClick={() => void refetchRoles()}>{localizedText("Tải lại role", "Reload roles")}</button>}
            {isRolePermissionsError && <button type="button" onClick={() => void refetchRolePermissions()}>{localizedText("Tải lại quyền", "Reload permissions")}</button>}
            {isPermissionCatalogError && <button type="button" onClick={() => void refetchPermissionCatalog()}>{localizedText("Tải danh mục quyền", "Reload permission catalog")}</button>}
          </div>
        </div>
      )}

      {view === "roles" && (
        <div className="p-4 sm:p-5">
          <div className="rounded-xl border border-slate-200 p-4 sm:p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="font-bold text-slate-900">{localizedText("Các vai trò hiện có", "Existing roles")}</h3>
                <p className="mt-1 text-sm text-slate-500">{filteredRoles.length} {localizedText("vai trò phù hợp", "matching roles")}</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative block w-full sm:w-64">
                  <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={roleSearch}
                    onChange={(event) => setRoleSearch(event.target.value)}
                    placeholder={localizedText("Tìm tên hoặc mã vai trò...", "Search role name or code...")}
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-10 text-sm outline-none focus:border-blue-400"
                  />
                  <ClearSearchButton value={roleSearch} onClear={() => setRoleSearch("")} label={localizedText("Xóa tìm kiếm", "Clear search")} />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        aria-label={localizedText("Tùy chỉnh cột bảng vai trò", "Customize role table columns")}
                        className="flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <Columns3 size={16} />
                        {localizedText("Cột", "Columns")}
                        <ChevronDown size={16} />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-56 p-2">
                      <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {localizedText("Hiển thị cột", "Show columns")}
                      </p>
                      {ROLE_TABLE_COLUMNS.map((column) => {
                        const isLastVisibleColumn = shownRoleColumns.length === 1 && visibleRoleColumns[column.id];
                        return (
                          <label
                            key={column.id}
                            className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm text-slate-700 hover:bg-slate-50"
                          >
                            <input
                              type="checkbox"
                              checked={visibleRoleColumns[column.id]}
                              disabled={isLastVisibleColumn}
                              onChange={(event) => {
                                setVisibleRoleColumns((current) => ({
                                  ...current,
                                  [column.id]: event.target.checked,
                                }));
                              }}
                              className="h-4 w-4 rounded border-slate-300 accent-blue-600"
                            />
                            {roleColumnLabel(column.id)}
                          </label>
                        );
                      })}
                      <button
                        type="button"
                        onClick={() => setVisibleRoleColumns({
                          name: true,
                          code: true,
                          description: true,
                          count: true,
                          permissions: true,
                          actions: true,
                        })}
                        className="mt-1 w-full rounded-md border-t border-slate-100 px-2 pt-2 text-left text-xs font-semibold text-blue-700 hover:text-blue-800"
                      >
                        {localizedText("Hiện tất cả cột", "Show all columns")}
                      </button>
                    </PopoverContent>
                  </Popover>
                  <button
                    type="button"
                    onClick={() => {
                      resetRoleForm();
                      setRoleError("");
                      setRoleFileError("");
                      setRoleFileMessage("");
                      setAddRoleMode("single");
                      setIsAddRoleDialogOpen(true);
                    }}
                    className="flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
                  >
                    <Plus size={16} />
                    {localizedText("Thêm vai trò", "Add role")}
                  </button>
                </div>
              </div>
            </div>
            {roleError && <p role="alert" className="mt-3 text-sm text-rose-600">{roleError}</p>}
            {roleFileError && <p role="alert" className="mt-3 text-sm text-rose-600">{roleFileError}</p>}
            {roleFileMessage && <p role="status" className="mt-3 text-sm text-emerald-700">{roleFileMessage}</p>}
            {isRolesLoading ? (
              <p className="py-10 text-center text-sm text-slate-500">{localizedText("Đang tải vai trò...", "Loading roles...")}</p>
            ) : roles.length === 0 ? (
              <div className="mt-4 rounded-lg border border-dashed border-slate-300 px-4 py-10 text-center">
                <p className="font-semibold text-slate-700">{localizedText("Chưa có vai trò nào", "No roles yet")}</p>
                <p className="mt-1 text-sm text-slate-500">{localizedText("Tạo vai trò để bắt đầu phân quyền cho tài khoản.", "Create a role to begin assigning permissions to accounts.")}</p>
              </div>
            ) : (
              <>
                <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
                <table
                  className="min-w-full table-fixed text-left text-sm"
                  style={{ width: `${shownRoleTableWidth + 64}px` }}
                >
                  <colgroup>
                    <col style={{ width: "64px" }} />
                    {shownRoleColumns.map((column) => (
                      <col key={column.id} style={{ width: `${column.width}px` }} />
                    ))}
                  </colgroup>
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th scope="col" className="whitespace-nowrap px-4 py-3 font-semibold">STT</th>
                      {shownRoleColumns.map((column) => (
                        <th
                          key={column.id}
                          scope="col"
                          className={`px-4 py-3 font-semibold ${column.id === "count" ? "whitespace-nowrap text-center" : ""}`}
                        >
                          {column.id === "permissions" ? (
                            <div className="flex items-center justify-between gap-3">
                              <span>{roleColumnLabel(column.id)}</span>
                              <div className="inline-flex shrink-0 rounded-lg bg-slate-200/70 p-0.5 normal-case tracking-normal">
                                <button
                                  type="button"
                                  aria-pressed={!showAllRolePermissions}
                                  onClick={() => setShowAllRolePermissions(false)}
                                  className={`rounded-md px-2 py-1 text-[11px] font-semibold ${
                                    !showAllRolePermissions ? "bg-white text-blue-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
                                  }`}
                                >
                                  {localizedText("Đã gán", "Assigned")}
                                </button>
                                <button
                                  type="button"
                                  aria-pressed={showAllRolePermissions}
                                  onClick={() => setShowAllRolePermissions(true)}
                                  className={`rounded-md px-2 py-1 text-[11px] font-semibold ${
                                    showAllRolePermissions ? "bg-white text-blue-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
                                  }`}
                                >
                                  {localizedText("Tất cả", "All")}
                                </button>
                              </div>
                            </div>
                          ) : roleColumnLabel(column.id)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedRoles.map((role, index) => {
                      const assignedPermissions = rolePermissionGroups.find((group) => group.roleCode === role.code)?.permissions ?? [];
                      const grantedPermissions = assignedPermissions.filter((permission) => permission.granted);
                      const grantedCount = grantedPermissions.length;
                      const permissionAssignments = new Map(assignedPermissions.map((permission) => [permission.code, permission]));
                      const visibleRolePermissions = showAllRolePermissions
                        ? permissions.map((permission) => ({
                            ...permission,
                            granted: permissionAssignments.get(permission.code)?.granted ?? false,
                          }))
                        : grantedPermissions;
                      return (
                        <tr key={role.code} className="text-slate-700 transition-colors hover:bg-slate-50/60">
                            <td className="px-4 py-3 tabular-nums text-slate-500">{(safeRolePage - 1) * rolePageSize + index + 1}</td>
                            {visibleRoleColumns.name && <td className="break-words px-4 py-3 font-semibold text-slate-900">
                            <div className="flex flex-wrap items-center gap-2">
                              <span>{translateDisplayText(role.name)}</span>
                              {role.system && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">{localizedText("Hệ thống", "System")}</span>}
                            </div>
                            </td>}
                            {visibleRoleColumns.code && <td className="break-all px-4 py-3 font-mono text-xs text-slate-600">{role.code}</td>}
                            {visibleRoleColumns.description && <td className="break-words px-4 py-3 text-slate-600">{role.description || "—"}</td>}
                            {visibleRoleColumns.count && <td className="px-4 py-3 text-center">
                            <span className="whitespace-nowrap rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                              {grantedCount} {localizedText("quyền", "permissions")}
                            </span>
                            </td>}
                            {visibleRoleColumns.permissions && <td className="px-4 py-3 align-top">
                            {visibleRolePermissions.length > 0 ? (
                              <div className="flex flex-wrap gap-1.5">
                                {visibleRolePermissions.map((permission) => (
                                  <span
                                    key={permission.code}
                                    title={`${permissionNameLabel(permission.name)} (${permission.code})`}
                                    className={`inline-flex items-center gap-1 rounded-md py-1 pl-2 pr-1 text-xs font-medium ${
                                      permission.granted ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-600"
                                    }`}
                                  >
                                    <span>{permissionNameLabel(permission.name)}</span>
                                    <button
                                      type="button"
                                      aria-label={`${permission.granted ? "Gỡ" : "Gán"} quyền ${permissionNameLabel(permission.name)} ${permission.granted ? "khỏi" : "cho"} vai trò ${role.name}`}
                                      title={`${permission.granted ? "Gỡ" : "Gán"} quyền ${permissionNameLabel(permission.name)}`}
                                      disabled={isUpdatingAssignment}
                                      onClick={() => setPendingPermissionChange({ roleCode: role.code, permission })}
                                      className={`rounded p-0.5 focus-visible:outline focus-visible:outline-2 disabled:cursor-not-allowed disabled:opacity-50 ${
                                        permission.granted
                                          ? "text-blue-500 hover:bg-rose-100 hover:text-rose-700 focus-visible:outline-rose-500"
                                          : "text-slate-500 hover:bg-emerald-100 hover:text-emerald-700 focus-visible:outline-emerald-500"
                                      }`}
                                    >
                                      {permission.granted ? <X size={12} /> : <Plus size={12} />}
                                    </button>
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400">
                                {showAllRolePermissions
                                  ? isPermissionCatalogLoading ? "Đang tải quyền..." : "Chưa có quyền trong danh mục"
                                  : "Chưa gán quyền"}
                              </span>
                            )}
                          </td>}
                            {visibleRoleColumns.actions && <td className="px-4 py-3 align-top">
                              <button
                                type="button"
                                onClick={() => {
                                  setRoleCode(role.code);
                                  setRoleName(role.name);
                                  setRoleDescription(role.description);
                                  setEditingRoleCode(role.code);
                                  setRoleError("");
                                  setRoleFieldErrors({});
                                  setAddRoleMode("single");
                                  setIsAddRoleDialogOpen(true);
                                }}
                                className="inline-flex items-center justify-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                              >
                                <Pencil size={12} />
                                {localizedText("Sửa", "Edit")}
                              </button>
                            </td>}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                </div>
                <ListPagination
                  totalItems={filteredRoles.length}
                  page={safeRolePage}
                  pageSize={rolePageSize}
                  mode="table"
                  onPageChange={setRolePage}
                  onPageSizeChange={setRolePageSize}
                />
              </>
            )}
          </div>
        </div>
      )}

      {view === "permissions" && activeStep === "catalog" && (
        <div className="p-4 sm:p-5">
          <div className="min-w-0 rounded-xl border border-slate-200 p-4 sm:p-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h3 className="font-bold text-slate-900">{localizedText("Danh mục quyền theo nhóm", "Permission catalog by category")}</h3>
                <p className="mt-1 text-sm text-slate-500">
                  {localizedText(`${filteredCatalogPermissions.length} quyền · ${catalogCategoryCount} danh mục · bao gồm cả quyền chưa gán role`, `${filteredCatalogPermissions.length} permissions · ${catalogCategoryCount} categories · including unassigned permissions`)}
                </p>
              </div>
              <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative block w-full sm:w-64">
                  <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={catalogSearch}
                    onChange={(event) => setCatalogSearch(event.target.value)}
                    placeholder={localizedText("Tìm mã, tên hoặc danh mục...", "Search code, name, or category...")}
                    aria-label={localizedText("Tìm quyền trong danh mục", "Search permissions in catalog")}
                    className="h-10 w-full rounded-lg border border-slate-200 pl-9 pr-10 text-sm outline-none focus:border-blue-400"
                  />
                  <ClearSearchButton value={catalogSearch} onClear={() => setCatalogSearch("")} label={localizedText("Xóa tìm kiếm", "Clear search")} />
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        aria-label={localizedText("Tùy chỉnh cột bảng", "Customize table columns")}
                        className="flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <Columns3 size={16} />
                        {localizedText("Cột", "Columns")}
                        <ChevronDown size={16} />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-56 p-2">
                      <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {localizedText("Hiển thị cột", "Show columns")}
                      </p>
                      {CATALOG_TABLE_COLUMNS.map((column) => {
                        const isLastVisibleColumn = shownCatalogColumns.length === 1 && visibleCatalogColumns[column.id];
                        return (
                          <label
                            key={column.id}
                            className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm text-slate-700 hover:bg-slate-50"
                          >
                            <input
                              type="checkbox"
                              checked={visibleCatalogColumns[column.id]}
                              disabled={isLastVisibleColumn}
                              onChange={(event) => {
                                setVisibleCatalogColumns((current) => ({
                                  ...current,
                                  [column.id]: event.target.checked,
                                }));
                              }}
                              className="h-4 w-4 rounded border-slate-300 accent-blue-600"
                            />
                            {catalogColumnLabel(column.id)}
                          </label>
                        );
                      })}
                      <button
                        type="button"
                        onClick={() => setVisibleCatalogColumns({
                          category: true,
                          name: true,
                          code: true,
                          description: true,
                          roles: true,
                          actions: true,
                        })}
                        className="mt-1 w-full rounded-md border-t border-slate-100 px-2 pt-2 text-left text-xs font-semibold text-blue-700 hover:text-blue-800"
                      >
                        {localizedText("Hiện tất cả cột", "Show all columns")}
                      </button>
                    </PopoverContent>
                  </Popover>
                  <button
                    type="button"
                    onClick={() => {
                      setImportError("");
                      setImportMessage("");
                      setIsImportRolePermissionsDialogOpen(true);
                    }}
                    className="flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <FileSpreadsheet size={16} />
                    {localizedText("Nạp quyền", "Import permissions")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      resetPermissionForm();
                      setCatalogFileError("");
                      setIsAddPermissionDialogOpen(true);
                    }}
                    className="flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
                  >
                    <Plus size={16} />
                    {localizedText("Thêm quyền", "Add permission")}
                  </button>
                </div>
              </div>
            </div>
            {catalogMessage && <p role="status" className="mt-3 text-sm text-emerald-700">{catalogMessage}</p>}
            {catalogFileMessage && <p role="status" className="mt-3 text-sm text-emerald-700">{catalogFileMessage}</p>}
            {isPermissionCatalogLoading ? (
              <p className="py-10 text-center text-sm text-slate-500">{localizedText("Đang tải danh mục quyền...", "Loading permission catalog...")}</p>
            ) : permissions.length === 0 ? (
              <div className="mt-4 rounded-lg border border-dashed border-slate-300 px-4 py-10 text-center">
                <p className="font-semibold text-slate-700">{localizedText("Chưa có quyền nào", "No permissions yet")}</p>
                <p className="mt-1 text-sm text-slate-500">{localizedText("Dùng nút “Thêm quyền” để tạo quyền hoặc nhập danh mục từ Excel.", "Use “Add permission” to create a permission or import a catalog from Excel.")}</p>
              </div>
            ) : (
              <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
                <table
                  className="min-w-full table-fixed text-left text-sm"
                  style={{ width: `${shownCatalogTableWidth + 64}px` }}
                >
                  <colgroup>
                    <col style={{ width: "64px" }} />
                    {shownCatalogColumns.map((column) => (
                      <col key={column.id} style={{ width: `${column.width}px` }} />
                    ))}
                  </colgroup>
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th scope="col" className="whitespace-nowrap px-4 py-3 font-semibold">STT</th>
                      {shownCatalogColumns.map((column) => (
                        <th
                          key={column.id}
                          scope="col"
                          className={`px-4 py-3 font-semibold ${column.id === "actions" ? "text-right" : ""}`}
                        >
                          {catalogColumnLabel(column.id)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  {[...catalogPermissionsByCategory].map(([category, categoryPermissions], categoryIndex) => (
                    <tbody key={category} className="divide-y divide-slate-100">
                      {categoryPermissions.map((permission, index) => {
                        const assignedRoles = rolePermissionGroups
                          .filter((group) => group.permissions.some((item) =>
                            item.code === permission.code && item.granted,
                          ))
                          .map((group) => roles.find((role) => role.code === group.roleCode)?.name ?? group.roleCode);
                        return (
                          <tr
                            key={permission.code}
                            className={`align-top text-slate-700 transition-colors hover:bg-slate-50/60 ${
                              index === 0 && categoryIndex > 0 ? "border-t border-slate-200" : ""
                            }`}
                          >
                            <td className="px-4 py-3 tabular-nums text-slate-500">
                              {permissionSerialNumbers.get(permission.code)}
                            </td>
                            {visibleCatalogColumns.category && index === 0 && (
                              <td rowSpan={categoryPermissions.length} className="border-r border-slate-200 bg-slate-50/60 px-4 py-3 align-middle">
                                <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                                  {translateDisplayText(category)}
                                </span>
                              </td>
                            )}
                            {visibleCatalogColumns.name && (
                              <td className="px-4 py-3 font-semibold text-slate-900">{permissionNameLabel(permission.name)}</td>
                            )}
                            {visibleCatalogColumns.code && (
                              <td className="break-all px-4 py-3 font-mono text-xs text-slate-600">{permission.code}</td>
                            )}
                            {visibleCatalogColumns.description && (
                              <td className="px-4 py-3 text-slate-600">{translateDisplayText(permission.description) || "—"}</td>
                            )}
                            {visibleCatalogColumns.roles && <td className="px-4 py-3">
                              {assignedRoles.length > 0 ? (
                                <div className="flex flex-wrap gap-1.5">
                                  {assignedRoles.map((roleName) => (
                                    <span key={roleName} className="rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
                                      {roleName}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-xs text-slate-400">{localizedText("Chưa gán", "Not assigned")}</span>
                              )}
                            </td>}
                            {visibleCatalogColumns.actions && <td className="whitespace-nowrap px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                                  onClick={() => {
                                    setPermissionCode(permission.code);
                                    setPermissionName(permission.name);
                                    setPermissionCategory(permission.category);
                                    setPermissionDescription(permission.description);
                                    setEditingPermissionCode(permission.code);
                                    setCatalogError("");
                                    setPermissionFieldErrors({});
                                    setIsAddPermissionDialogOpen(true);
                                  }}
                                >
                                  <span className="inline-flex items-center gap-1">
                                    <Pencil size={11} />
                                    {localizedText("Sửa", "Edit")}
                                  </span>
                                </button>
                                <button
                                  type="button"
                                  disabled={roles.length === 0 || isUpdatingAssignment}
                                  onClick={() => {
                                    setCatalogAssignmentRoleCode(roles[0]?.code ?? "");
                                    setPermissionToAssign(permission);
                                  }}
                                  className="rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  {localizedText("Gán quyền", "Assign permission")}
                                </button>
                              </div>
                            </td>}
                          </tr>
                        );
                      })}
                    </tbody>
                  ))}
                </table>
                {filteredCatalogPermissions.length === 0 && (
                  <FilterResultStatus filterKey={catalogSearch}><p className="rounded-lg border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
                    {localizedText("Không tìm thấy quyền phù hợp.", "No matching permissions found.")}
                  </p></FilterResultStatus>
                )}
              </div>
            )}
            {!isPermissionCatalogLoading && permissions.length > 0 && (
              <ListPagination
                totalItems={filteredCatalogPermissions.length}
                page={safeCatalogPage}
                pageSize={catalogPageSize}
                mode="table"
                onPageChange={setCatalogPage}
                onPageSizeChange={setCatalogPageSize}
              />
            )}
          </div>
        </div>
      )}

      {view === "permissions" && activeStep === "catalog" && (
        <Dialog
          open={isAddPermissionDialogOpen}
          onOpenChange={(open) => {
            setIsAddPermissionDialogOpen(open);
            if (!open) resetPermissionForm();
          }}
        >
          <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingPermissionCode ? localizedText("Chỉnh sửa quyền", "Edit permission") : localizedText("Thêm quyền vào danh mục", "Add permissions to the catalog")}</DialogTitle>
              <DialogDescription>
                {editingPermissionCode
                  ? localizedText("Cập nhật thông tin quyền đã có trong danh mục.", "Update the details of an existing permission in the catalog.")
                  : localizedText("Tạo một quyền mới hoặc nhập nhiều quyền từ Excel. Quyền được thêm vào danh mục, chưa tự động gán cho role.", "Create a permission or import multiple permissions from Excel. Permissions are added to the catalog but are not automatically assigned to a role.")}
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setAddPermissionMode("single")}
                aria-pressed={addPermissionMode === "single"}
                className={`flex items-center justify-center gap-2 rounded-md px-3 py-2.5 text-sm font-semibold ${
                  addPermissionMode === "single" ? "bg-white text-blue-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Plus size={16} />
                {localizedText("Tạo quyền lẻ", "Create a permission")}
              </button>
              <button
                type="button"
                onClick={() => setAddPermissionMode("excel")}
                aria-pressed={addPermissionMode === "excel"}
                className={`flex items-center justify-center gap-2 rounded-md px-3 py-2.5 text-sm font-semibold ${
                  addPermissionMode === "excel" ? "bg-white text-blue-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <FileSpreadsheet size={16} />
                {localizedText("Nhập từ Excel", "Import from Excel")}
              </button>
            </div>
            {addPermissionMode === "single" ? (
              <form noValidate onSubmit={(event) => void createPermission(event)}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm font-semibold text-slate-700">
                    {localizedText("Mã quyền", "Permission code")} <span aria-hidden="true" className="text-rose-600">*</span>
                    <input
                      value={permissionCode}
                      aria-invalid={Boolean(permissionFieldErrors.code)}
                      aria-describedby={permissionFieldErrors.code ? "permission-code-error" : undefined}
                      onChange={(event) => {
                        setPermissionCode(event.target.value);
                        setPermissionFieldErrors((current) => ({ ...current, code: "" }));
                        setCatalogError("");
                      }}
                      placeholder="VIEW_SPECIAL_REPORT"
                      autoComplete="off"
                      className={`mt-1.5 h-10 w-full rounded-lg border px-3 font-mono text-sm font-normal outline-none focus:border-blue-400 ${permissionFieldErrors.code ? "border-rose-400" : "border-slate-200"}`}
                    />
                    {permissionFieldErrors.code && <span id="permission-code-error" role="alert" className="mt-1 block text-xs font-normal text-rose-600">{permissionFieldErrors.code}</span>}
                  </label>
                  <label className="block text-sm font-semibold text-slate-700">
                    {localizedText("Tên quyền", "Permission name")} <span aria-hidden="true" className="text-rose-600">*</span>
                    <input
                      value={permissionName}
                      aria-invalid={Boolean(permissionFieldErrors.name)}
                      aria-describedby={permissionFieldErrors.name ? "permission-name-error" : undefined}
                      onChange={(event) => {
                        setPermissionName(event.target.value);
                        setPermissionFieldErrors((current) => ({ ...current, name: "" }));
                        setCatalogError("");
                      }}
                      placeholder={localizedText("Xem báo cáo đặc biệt", "View special report")}
                      className={`mt-1.5 h-10 w-full rounded-lg border px-3 text-sm font-normal outline-none focus:border-blue-400 ${permissionFieldErrors.name ? "border-rose-400" : "border-slate-200"}`}
                    />
                    {permissionFieldErrors.name && <span id="permission-name-error" role="alert" className="mt-1 block text-xs font-normal text-rose-600">{permissionFieldErrors.name}</span>}
                  </label>
                </div>
                <label className="mt-3 block text-sm font-semibold text-slate-700">
                  {localizedText("Danh mục", "Category")} <span aria-hidden="true" className="text-rose-600">*</span>
                  <input
                    value={permissionCategory}
                    aria-invalid={Boolean(permissionFieldErrors.category)}
                    aria-describedby={permissionFieldErrors.category ? "permission-category-error" : undefined}
                    onChange={(event) => {
                      setPermissionCategory(event.target.value);
                      setPermissionFieldErrors((current) => ({ ...current, category: "" }));
                      setCatalogError("");
                    }}
                    placeholder={localizedText("Ví dụ: Đặt phòng, Khách hàng, Báo cáo", "e.g. Bookings, Customers, Reports")}
                    className={`mt-1.5 h-10 w-full rounded-lg border px-3 text-sm font-normal outline-none focus:border-blue-400 ${permissionFieldErrors.category ? "border-rose-400" : "border-slate-200"}`}
                  />
                  {permissionFieldErrors.category && <span id="permission-category-error" role="alert" className="mt-1 block text-xs font-normal text-rose-600">{permissionFieldErrors.category}</span>}
                </label>
                <label className="mt-3 block text-sm font-semibold text-slate-700">
                  {localizedText("Mô tả", "Description")} <span aria-hidden="true" className="text-rose-600">*</span>
                  <textarea
                    value={permissionDescription}
                    aria-invalid={Boolean(permissionFieldErrors.description)}
                    aria-describedby={permissionFieldErrors.description ? "permission-description-error" : undefined}
                    onChange={(event) => {
                      setPermissionDescription(event.target.value);
                      setPermissionFieldErrors((current) => ({ ...current, description: "" }));
                      setCatalogError("");
                    }}
                    rows={3}
                    placeholder={localizedText("Mô tả chức năng mà quyền này cho phép", "Describe the functionality this permission allows")}
                    className={`mt-1.5 w-full rounded-lg border px-3 py-2 text-sm font-normal outline-none focus:border-blue-400 ${permissionFieldErrors.description ? "border-rose-400" : "border-slate-200"}`}
                  />
                  {permissionFieldErrors.description && <span id="permission-description-error" role="alert" className="mt-1 block text-xs font-normal text-rose-600">{permissionFieldErrors.description}</span>}
                </label>
                {catalogError && <p role="alert" className="mt-3 text-sm text-rose-600">{catalogError}</p>}
                <button
                  type="submit"
                  disabled={isCreatingPermission || isUpdatingPermission || isPermissionCatalogLoading || isPermissionCatalogError}
                  className="mt-4 flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  <Plus size={16} />
                  {isCreatingPermission || isUpdatingPermission
                    ? localizedText("Đang lưu...", "Saving...")
                    : editingPermissionCode
                      ? localizedText("Lưu thay đổi", "Save changes")
                      : localizedText("Tạo quyền", "Create permission")}
                </button>
              </form>
            ) : (
              <div>
                <p className="text-sm leading-5 text-slate-600">
                {localizedText("File Excel cần có mã quyền, tên quyền, danh mục và mô tả. Nếu mã đã tồn tại, thông tin quyền được cập nhật mà không đổi role đang được gán.", "The Excel file must include permission code, name, category, and description. Existing codes update permission details without changing assigned roles.")}
                </p>
                <button
                  type="button"
                  onClick={downloadPermissionCatalogTemplate}
                  className="mt-4 flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <FileSpreadsheet size={16} />
                  {localizedText("Tải file Excel mẫu", "Download Excel template")}
                </button>
                <label className="mt-4 block text-sm font-semibold text-slate-700">
                  {localizedText("Chọn file danh mục quyền (.xlsx)", "Choose permission catalog file (.xlsx)")}
                  <input
                    ref={catalogFileInputRef}
                    type="file"
                    accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    disabled={isImporting}
                    onChange={(event) => void importPermissionCatalog(event.currentTarget.files?.[0])}
                    className="mt-1.5 block w-full rounded-lg border border-slate-200 p-2 text-sm font-normal file:mr-3 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:font-semibold file:text-blue-700"
                  />
                </label>
                {isReadingFile && <p role="status" className="mt-3 text-sm text-blue-700">{localizedText("Đang đọc file quyền...", "Reading permissions file...")}</p>}
                {catalogFileError && <p role="alert" className="mt-3 text-sm text-rose-600">{catalogFileError}</p>}
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}

      {view === "permissions" && (
        <Dialog
          open={isImportRolePermissionsDialogOpen}
          onOpenChange={setIsImportRolePermissionsDialogOpen}
        >
          <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{localizedText("Nạp quyền", "Import permissions")}</DialogTitle>
              <DialogDescription>
                {localizedText("Nhập ma trận Có/Không. Với mỗi role xuất hiện trong file, danh sách quyền hiện có sẽ được thay theo các dòng được đánh dấu Có.", "Import a grant matrix. For each role in the file, the existing permission list is replaced by rows marked Yes.")}
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-slate-900">{localizedText("Định dạng file Excel", "Excel file format")}</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {localizedText("Dùng file toàn hệ thống để áp dụng Có/Không cho nhiều role, hoặc tải mẫu trống để tự nhập quyền.", "Use the full-system workbook to apply grants/revocations for multiple roles, or download a blank template.")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => downloadPermissionTemplate(roles)}
                  disabled={roles.length === 0}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <FileSpreadsheet size={16} />
                  {localizedText("Tải file Excel mẫu", "Download Excel template")}
                </button>
                <a
                  href="/role-permissions-initial-admin.xlsx"
                  download="phan-quyen-toan-he-thong.xlsx"
                  className="flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"
                >
                  <FileSpreadsheet size={16} />
                  {localizedText("Tải file phân quyền toàn hệ thống", "Download full-system permissions")}
                </a>
              </div>
              <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full min-w-[780px] text-left text-xs">
                  <thead className="bg-slate-50 font-bold text-slate-600">
                    <tr>{PERMISSION_HEADERS.map((header) => <th key={header} className="px-3 py-2">{header}</th>)}</tr>
                  </thead>
                  <tbody>
                    <tr className="divide-x divide-slate-100 text-slate-600">
                      {["ROLE_MANAGER", "VIEW_BOOKINGS", "Xem đặt phòng", "Cho phép xem đặt phòng", "Đặt phòng", "Có"].map((value) => (
                        <td key={value} className="px-3 py-2">{value}</td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            <label className="block text-sm font-semibold text-slate-700">
              {localizedText("Chọn file phân quyền (.xlsx)", "Choose permissions file (.xlsx)")}
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                disabled={roles.length === 0 || isImporting}
                onChange={(event) => void importPermissions(event.currentTarget.files?.[0])}
                className="mt-1.5 block w-full rounded-lg border border-slate-200 p-2 text-sm font-normal file:mr-3 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:font-semibold file:text-blue-700 disabled:opacity-50"
              />
            </label>
            {roles.length === 0 && (
              <p className="text-sm text-amber-700">{localizedText("Hãy tạo role trước để nhập phân quyền.", "Create a role before importing permissions.")}</p>
            )}
            {isImporting && <p role="status" className="text-sm text-blue-700">{localizedText("Đang đọc file phân quyền...", "Reading permissions file...")}</p>}
            {importError && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{importError}</p>}
            {importMessage && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{importMessage}</p>}
          </DialogContent>
        </Dialog>
      )}

      {view === "roles" && (
        <Dialog open={isAddRoleDialogOpen} onOpenChange={(open) => {
          setIsAddRoleDialogOpen(open);
          if (!open) resetRoleForm();
        }}>
          <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingRoleCode ? localizedText("Chỉnh sửa vai trò", "Edit role") : localizedText("Thêm vai trò", "Add a role")}</DialogTitle>
              <DialogDescription>
                {editingRoleCode
                  ? localizedText("Cập nhật thông tin vai trò hiện có.", "Update the details for the selected role.")
                  : localizedText("Tạo vai trò thủ công hoặc nhập danh sách vai trò từ Excel.", "Create a role manually or import a list of roles from Excel.")}
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setAddRoleMode("single")}
                aria-pressed={addRoleMode === "single"}
                className={`flex items-center justify-center gap-2 rounded-md px-3 py-2.5 text-sm font-semibold ${
                  addRoleMode === "single" ? "bg-white text-blue-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Plus size={16} />
                {localizedText("Tạo vai trò lẻ", "Create a role")}
              </button>
              <button
                type="button"
                onClick={() => setAddRoleMode("excel")}
                aria-pressed={addRoleMode === "excel"}
                className={`flex items-center justify-center gap-2 rounded-md px-3 py-2.5 text-sm font-semibold ${
                  addRoleMode === "excel" ? "bg-white text-blue-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <FileSpreadsheet size={16} />
                {localizedText("Nhập từ Excel", "Import from Excel")}
              </button>
            </div>
            {addRoleMode === "single" ? (
              <form noValidate onSubmit={(event) => void createRole(event)} className="mt-4">
                <label className="block text-sm font-semibold text-slate-700">
                  {localizedText("Mã role", "Role code")} <span aria-hidden="true" className="text-rose-600">*</span>
                  <input
                    value={roleCode}
                    aria-invalid={Boolean(roleFieldErrors.code)}
                    aria-describedby={roleFieldErrors.code ? "role-code-error" : undefined}
                    onChange={(event) => {
                      setRoleCode(event.target.value);
                      setRoleFieldErrors((current) => ({ ...current, code: "" }));
                      setRoleError("");
                    }}
                    placeholder="ROLE_RECEPTIONIST"
                    autoComplete="off"
                    className={`mt-1.5 h-10 w-full rounded-lg border px-3 font-mono text-sm font-normal outline-none focus:border-blue-400 ${roleFieldErrors.code ? "border-rose-400" : "border-slate-200"}`}
                  />
                  {roleFieldErrors.code && <span id="role-code-error" role="alert" className="mt-1 block text-xs font-normal text-rose-600">{roleFieldErrors.code}</span>}
                </label>
                <label className="mt-3 block text-sm font-semibold text-slate-700">
                  {localizedText("Tên role", "Role name")} <span aria-hidden="true" className="text-rose-600">*</span>
                  <input
                    value={roleName}
                    aria-invalid={Boolean(roleFieldErrors.name)}
                    aria-describedby={roleFieldErrors.name ? "role-name-error" : undefined}
                    onChange={(event) => {
                      setRoleName(event.target.value);
                      setRoleFieldErrors((current) => ({ ...current, name: "" }));
                      setRoleError("");
                    }}
                    placeholder={localizedText("Lễ tân", "Receptionist")}
                    className={`mt-1.5 h-10 w-full rounded-lg border px-3 text-sm font-normal outline-none focus:border-blue-400 ${roleFieldErrors.name ? "border-rose-400" : "border-slate-200"}`}
                  />
                  {roleFieldErrors.name && <span id="role-name-error" role="alert" className="mt-1 block text-xs font-normal text-rose-600">{roleFieldErrors.name}</span>}
                </label>
                <label className="mt-3 block text-sm font-semibold text-slate-700">
                  {localizedText("Mô tả", "Description")} <span aria-hidden="true" className="text-rose-600">*</span>
                  <textarea
                    value={roleDescription}
                    aria-invalid={Boolean(roleFieldErrors.description)}
                    aria-describedby={roleFieldErrors.description ? "role-description-error" : undefined}
                    onChange={(event) => {
                      setRoleDescription(event.target.value);
                      setRoleFieldErrors((current) => ({ ...current, description: "" }));
                      setRoleError("");
                    }}
                    rows={3}
                    placeholder={localizedText("Mô tả trách nhiệm của role", "Describe the role's responsibilities")}
                    className={`mt-1.5 w-full rounded-lg border px-3 py-2 text-sm font-normal outline-none focus:border-blue-400 ${roleFieldErrors.description ? "border-rose-400" : "border-slate-200"}`}
                  />
                  {roleFieldErrors.description && <span id="role-description-error" role="alert" className="mt-1 block text-xs font-normal text-rose-600">{roleFieldErrors.description}</span>}
                </label>
                {roleError && <p role="alert" className="mt-3 text-sm text-rose-600">{roleError}</p>}
                <button
                  type="submit"
                  disabled={isCreatingRole || isUpdatingRole || isRolesLoading || isRolesError}
                  className="mt-4 flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  <Plus size={16} />
                  {isCreatingRole || isUpdatingRole
                    ? localizedText("Đang lưu...", "Saving...")
                    : editingRoleCode
                      ? localizedText("Lưu thay đổi", "Save changes")
                      : localizedText("Tạo vai trò", "Create role")}
                </button>
              </form>
            ) : (
              <div className="mt-4">
                <p className="text-sm leading-5 text-slate-600">
                  {localizedText("File Excel gồm ba cột bắt buộc: mã role, tên role và mô tả. Mã role phải duy nhất và bắt đầu bằng ROLE_.", "The Excel file requires three columns: role code, role name, and description. Each role code must be unique and start with ROLE_.")}
                </p>
                <button
                  type="button"
                  onClick={downloadRoleTemplate}
                  className="mt-4 flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <FileSpreadsheet size={16} />
                  {localizedText("Tải file Excel mẫu", "Download Excel template")}
                </button>
                <label className="mt-4 block text-sm font-semibold text-slate-700">
                  {localizedText("Chọn file danh sách vai trò (.xlsx)", "Choose roles file (.xlsx)")}
                  <input
                    ref={roleFileInputRef}
                    type="file"
                    accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    disabled={isImportingRoles || isRolesLoading || isRolesError}
                    onChange={(event) => void importRoles(event.currentTarget.files?.[0])}
                    className="mt-1.5 block w-full rounded-lg border border-slate-200 p-2 text-sm font-normal file:mr-3 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:font-semibold file:text-blue-700"
                  />
                </label>
                {isImportingRoles && <p role="status" className="mt-3 text-sm text-blue-700">{localizedText("Đang kiểm tra và tạo vai trò...", "Validating and creating roles...")}</p>}
                {roleFileError && <p role="alert" className="mt-3 text-sm text-rose-600">{roleFileError}</p>}
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}

      {view === "permissions" && (
        <Dialog
          open={permissionToAssign !== null}
          onOpenChange={(open) => {
            if (!open) setPermissionToAssign(null);
          }}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{localizedText("Gán quyền cho vai trò", "Assign permission to a role")}</DialogTitle>
              <DialogDescription>
                {localizedText("Chọn vai trò để gán quyền ", "Choose a role to assign ")}
                {permissionToAssign?.name ? <strong>{permissionNameLabel(permissionToAssign.name)}</strong> : localizedText("này", "this permission")}.
              </DialogDescription>
            </DialogHeader>
            <label className="block text-sm font-semibold text-slate-700">
              {localizedText("Vai trò", "Role")}
              <select
                value={catalogAssignmentRoleCode}
                onChange={(event) => setCatalogAssignmentRoleCode(event.target.value)}
                disabled={roles.length === 0}
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal outline-none focus:border-blue-400"
              >
                {roles.length === 0 && <option value="">{localizedText("Chưa có role", "No roles available")}</option>}
                {roles.map((role) => (
                  <option key={role.code} value={role.code}>{translateDisplayText(role.name)} ({role.code})</option>
                ))}
              </select>
            </label>
            {isPermissionAlreadyAssignedToSelectedRole && (
              <p role="status" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                {localizedText("Quyền này đã được gán cho vai trò đang chọn.", "This permission is already assigned to the selected role.")}
              </p>
            )}
            <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-3">
              <p className="text-sm text-slate-700">
                {localizedText("Chưa có quyền này: ", "Not assigned yet: ")}<strong>{rolesMissingPermission.length}</strong> / {roles.length} {localizedText("vai trò", "roles")}
              </p>
              <button
                type="button"
                disabled={!permissionToAssign || rolesMissingPermission.length === 0 || isUpdatingAssignment}
                onClick={() => {
                  if (!permissionToAssign || rolesMissingPermission.length === 0) return;
                  setPermissionActionError("");
                  setPendingBulkPermissionAssignment({
                    permission: permissionToAssign,
                    roleCodes: rolesMissingPermission.map((role) => role.code),
                  });
                  setPermissionToAssign(null);
                }}
                className="mt-2 w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {localizedText("Gán cho tất cả vai trò còn thiếu", "Assign to all roles missing this permission")}
              </button>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPermissionToAssign(null)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                {localizedText("Hủy", "Cancel")}
              </button>
              <button
                type="button"
                disabled={!catalogAssignmentRoleCode || roles.length === 0 || isUpdatingAssignment || isPermissionAlreadyAssignedToSelectedRole}
                onClick={() => {
                  if (!permissionToAssign) return;
                  setPendingPermissionChange({
                    roleCode: catalogAssignmentRoleCode,
                    permission: { ...permissionToAssign, granted: false },
                  });
                  setPermissionToAssign(null);
                }}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {localizedText("Tiếp tục", "Continue")}
              </button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      <Dialog
        open={pendingPermissionChange !== null}
        onOpenChange={(open) => {
          if (!open && !isConfirmingPermissionChange) setPendingPermissionChange(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {pendingPermissionChange?.permission.granted
                ? localizedText("Xác nhận gỡ quyền", "Confirm permission removal")
                : localizedText("Xác nhận gán quyền", "Confirm permission assignment")}
            </DialogTitle>
            <DialogDescription>
              {pendingPermissionChange && (() => {
                const role = roles.find((item) => item.code === pendingPermissionChange.roleCode);
                const permission = pendingPermissionChange.permission;
                return pendingPermissionChange.permission.granted
                  ? <>{localizedText("Bạn có chắc muốn gỡ quyền ", "Are you sure you want to remove ")}<strong>{permissionNameLabel(permission.name)}</strong> ({permission.code}) {localizedText("khỏi role ", "from role ")}<strong>{role?.name ?? role?.code ?? pendingPermissionChange.roleCode}</strong>?</>
                  : <>{localizedText("Bạn có chắc muốn gán quyền ", "Are you sure you want to assign ")}<strong>{permissionNameLabel(permission.name)}</strong> ({permission.code}) {localizedText("cho role ", "to role ")}<strong>{role?.name ?? role?.code ?? pendingPermissionChange.roleCode}</strong>?</>;
              })()}
            </DialogDescription>
          </DialogHeader>
          {permissionActionError && <p role="alert" className="text-sm text-rose-600">{permissionActionError}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setPendingPermissionChange(null)}
              disabled={isConfirmingPermissionChange}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {localizedText("Hủy", "Cancel")}
            </button>
            <button
              type="button"
              onClick={() => void confirmPermissionChange()}
              disabled={isConfirmingPermissionChange || !pendingPermissionChange}
              className={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${
                pendingPermissionChange?.permission.granted
                  ? "bg-rose-600 hover:bg-rose-700"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {isConfirmingPermissionChange
                ? localizedText("Đang lưu...", "Saving...")
                : pendingPermissionChange?.permission.granted
                  ? localizedText("Gỡ quyền", "Remove permission")
                  : localizedText("Gán quyền", "Assign permission")}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={pendingBulkPermissionAssignment !== null}
        onOpenChange={(open) => {
          if (!open && !isConfirmingBulkAssignment) {
            setPendingBulkPermissionAssignment(null);
            setPermissionActionError("");
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{localizedText("Xác nhận gán quyền hàng loạt", "Confirm bulk permission assignment")}</DialogTitle>
            <DialogDescription>
              {pendingBulkPermissionAssignment && (
                <>
                  {localizedText("Gán quyền ", "Assign ")}<strong>{permissionNameLabel(pendingBulkPermissionAssignment.permission.name)}</strong> (
                  {pendingBulkPermissionAssignment.permission.code}) {localizedText("cho ", "to ")}
                  <strong>{pendingBulkPermissionAssignment.roleCodes.length} {localizedText("vai trò chưa có quyền này", "roles that do not have this permission")}</strong>.
                  {" "}{localizedText("Chỉ cần xác nhận một lần để áp dụng cho toàn bộ danh sách bên dưới.", "Confirm once to apply it to the entire list below.")}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {pendingBulkPermissionAssignment && (
            <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-200 p-3 text-sm text-slate-600">
              {pendingBulkPermissionAssignment.roleCodes.map((roleCode) => {
                const role = roles.find((item) => item.code === roleCode);
                return <div key={roleCode}>{role?.name ?? roleCode} ({roleCode})</div>;
              })}
            </div>
          )}
          {permissionActionError && (
            <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
              {permissionActionError}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setPendingBulkPermissionAssignment(null);
                setPermissionActionError("");
              }}
              disabled={isConfirmingBulkAssignment}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {localizedText("Hủy", "Cancel")}
            </button>
            <button
              type="button"
              onClick={() => void confirmBulkPermissionAssignment()}
              disabled={isConfirmingBulkAssignment || !pendingBulkPermissionAssignment?.roleCodes.length}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isConfirmingBulkAssignment
                ? localizedText("Đang gán...", "Assigning...")
                : localizedText(
                    `Gán cho tất cả (${pendingBulkPermissionAssignment?.roleCodes.length ?? 0})`,
                    `Assign to all (${pendingBulkPermissionAssignment?.roleCodes.length ?? 0})`,
                  )}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {view === "permissions" && activeStep === "permissions" && (
        <div className="space-y-5 p-4 sm:p-5">
          <button
            type="button"
            onClick={() => navigateToStep("catalog")}
            className="text-sm font-semibold text-blue-700 hover:underline"
          >
            ← Quay lại danh sách quyền
          </button>
          <section className="mb-5 rounded-xl border border-slate-200 p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-bold text-slate-900">Gán quyền theo danh mục</h3>
                <p className="mt-1 text-sm leading-5 text-slate-500">
                  Chọn role và nhóm quyền, sau đó gán hoặc gỡ quyền trực tiếp. Danh mục thuộc về permission;
                  chọn nhóm ở đây chỉ giúp lọc quyền.
                </p>
              </div>
              <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
                {permissions.length} quyền trong danh mục
              </span>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-semibold text-slate-700">
                Role
                <select
                  value={selectedAssignmentRoleCode}
                  onChange={(event) => setAssignmentRoleCode(event.target.value)}
                  disabled={roles.length === 0}
                  className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal outline-none focus:border-blue-400"
                >
                  {roles.length === 0 && <option value="">{localizedText("Chưa có role", "No roles available")}</option>}
                  {roles.map((role) => (
                    <option key={role.code} value={role.code}>{translateDisplayText(role.name)} ({role.code})</option>
                  ))}
                </select>
              </label>
              <div className="block text-sm font-semibold text-slate-700">
                <span>Danh mục permission</span>
                <Popover
                  open={isAssignmentCategoryOpen}
                  onOpenChange={(open) => {
                    setIsAssignmentCategoryOpen(open);
                    if (!open) setAssignmentCategorySearch("");
                  }}
                >
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      role="combobox"
                      aria-expanded={isAssignmentCategoryOpen}
                      aria-label="Chọn hoặc tìm danh mục permission"
                      disabled={assignmentCategories.length === 0}
                      className="mt-1.5 flex h-10 w-full items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 text-left text-sm font-normal outline-none hover:border-blue-300 focus:border-blue-400 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span className="truncate">
                        {assignmentCategory === "all" ? "Tất cả danh mục" : assignmentCategory}
                      </span>
                      <ChevronsUpDown size={16} className="shrink-0 text-slate-400" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
                    <Command shouldFilter>
                      <CommandInput
                        value={assignmentCategorySearch}
                        onValueChange={setAssignmentCategorySearch}
                        placeholder="Tìm danh mục..."
                        aria-label="Tìm danh mục permission"
                      />
                      <CommandList>
                        <CommandEmpty>Không tìm thấy danh mục.</CommandEmpty>
                        <CommandItem
                          value="Tất cả danh mục"
                          onSelect={() => {
                            setAssignmentCategory("all");
                            setIsAssignmentCategoryOpen(false);
                          }}
                        >
                          <Check
                            size={16}
                            className={`mr-2 ${assignmentCategory === "all" ? "opacity-100" : "opacity-0"}`}
                          />
                          Tất cả danh mục
                        </CommandItem>
                        {assignmentCategories.map((category) => (
                          <CommandItem
                            key={category}
                            value={category}
                            onSelect={() => {
                              setAssignmentCategory(category);
                              setIsAssignmentCategoryOpen(false);
                            }}
                          >
                            <Check
                              size={16}
                              className={`mr-2 ${assignmentCategory === category ? "opacity-100" : "opacity-0"}`}
                            />
                            <span className="truncate">{translateDisplayText(category)}</span>
                          </CommandItem>
                        ))}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {permissionActionError && (
              <p role="alert" className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                {permissionActionError}
              </p>
            )}
            {isRolePermissionsLoading || isPermissionCatalogLoading ? (
              <p className="mt-5 text-sm text-slate-500">Đang tải quyền...</p>
            ) : isRolePermissionsError || isPermissionCatalogError ? (
              <p role="alert" className="mt-5 text-sm text-rose-600">
                Không tải được danh sách quyền. Hãy tải lại dữ liệu trước khi gán quyền.
              </p>
            ) : permissions.length === 0 ? (
              <p className="mt-5 rounded-lg border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
                Chưa có permission trong danh mục. Hãy tạo quyền hoặc nhập từ Excel ở bước Danh mục quyền.
              </p>
            ) : (
              <div className="mt-4">
                {assignmentCategories
                  .filter((category) => assignmentCategory === "all" || category === assignmentCategory)
                  .map((category) => {
                    const categoryPermissions = permissionsForAssignment.filter(
                      (permission) => categoryOf(permission.category) === category,
                    );
                    if (categoryPermissions.length === 0) return null;
                    return (
                      <section key={category} className="mb-5 last:mb-0" aria-label={`Danh mục ${category}`}>
                        <div className="mb-2 flex items-center justify-between border-b border-slate-100 pb-2">
                          <h4 className="font-semibold text-slate-800">{translateDisplayText(category)}</h4>
                          <span className="text-xs text-slate-500">
                            {categoryPermissions.filter((permission) => permission.granted).length} / {categoryPermissions.length} {localizedText("đã gán", "assigned")}
                          </span>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                          {categoryPermissions.map((permission) => (
                            <article
                              key={permission.code}
                              className={`flex min-w-0 items-start justify-between gap-3 rounded-lg border p-3 ${
                                permission.granted ? "border-emerald-100 bg-emerald-50/50" : "border-slate-200 bg-white"
                              }`}
                            >
                              <div className="flex min-w-0 gap-2">
                                {permission.granted && <Check size={15} className="mt-0.5 shrink-0 text-emerald-600" />}
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-slate-800">{permissionNameLabel(permission.name)}</p>
                                  <p className="mt-1 break-all font-mono text-[11px] text-slate-500">{permission.code}</p>
                                  {permission.description && (
                                    <p className="mt-1 text-xs leading-5 text-slate-500">{translateDisplayText(permission.description)}</p>
                                  )}
                                </div>
                              </div>
                              <button
                                type="button"
                                disabled={!selectedAssignmentRoleCode || isUpdatingAssignment}
                                onClick={() => {
                                  setPermissionActionError("");
                                  setPendingPermissionChange({
                                    roleCode: selectedAssignmentRoleCode,
                                    permission,
                                  });
                                }}
                                aria-pressed={permission.granted}
                                className={`shrink-0 rounded-md px-2 py-1 text-xs font-semibold transition disabled:cursor-wait disabled:opacity-50 ${
                                  permission.granted
                                    ? "bg-white text-rose-700 hover:bg-rose-100"
                                    : "bg-blue-100 text-blue-700 hover:bg-blue-200"
                                }`}
                              >
                                {updatingAssignment === `${selectedAssignmentRoleCode}:${permission.code}`
                                  ? localizedText("Đang lưu...", "Saving...")
                                  : permission.granted
                                    ? localizedText("Gỡ", "Remove")
                                    : localizedText("Gán", "Assign")}
                              </button>
                            </article>
                          ))}
                        </div>
                      </section>
                    );
                  })}
              </div>
            )}
          </section>

          <>
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-center gap-2">
                <FileSpreadsheet size={18} className="text-emerald-700" />
                <h3 className="font-bold text-slate-900">Nhập quyền từ Excel</h3>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Tạo role trước rồi tải file mẫu. Danh sách role được đưa vào sheet riêng và cột Role
                có danh sách thả xuống; bạn tự nhập mã, tên, mô tả và danh mục quyền.
              </p>
              <button
                type="button"
                onClick={() => downloadPermissionTemplate(roles)}
                disabled={roles.length === 0}
                className="mt-4 flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                <FileSpreadsheet size={16} />
                Tải file Excel mẫu
              </button>
              <label className="mt-4 block text-sm font-semibold text-slate-700">
                Chọn file phân quyền (.xlsx)
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  disabled={roles.length === 0 || isImporting}
                  onChange={(event) => void importPermissions(event.currentTarget.files?.[0])}
                  className="mt-1.5 block w-full rounded-lg border border-slate-200 p-2 text-sm font-normal file:mr-3 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:font-semibold file:text-blue-700"
                />
              </label>
              {roles.length === 0 && (
                <p className="mt-3 text-sm text-amber-700">Hãy tạo role trước để nhập phân quyền.</p>
              )}
              {isImporting && <p role="status" className="mt-3 text-sm text-blue-700">Đang đọc file phân quyền...</p>}
              {importError && <p role="alert" className="mt-3 text-sm text-rose-600">{importError}</p>}
              {importMessage && <p role="status" className="mt-3 text-sm text-emerald-700">{importMessage}</p>}
              <button
                type="button"
                onClick={() => navigateToStep("overview")}
                disabled={roles.length === 0}
                className="mt-4 flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
              >
                <Upload size={16} />
                Xem bản tổng quan
              </button>
            </div>

            <div className="rounded-xl border border-slate-200 p-4">
              <h3 className="font-bold text-slate-900">Định dạng file Excel</h3>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[680px] text-left text-xs">
                  <thead className="bg-slate-50 font-bold text-slate-600">
                    <tr>{PERMISSION_HEADERS.map((header) => <th key={header} className="px-2 py-2">{header}</th>)}</tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-slate-100 text-slate-600">
                      <td className="px-2 py-2">Chọn từ danh sách</td>
                      <td className="px-2 py-2">BOOKING_VIEW</td>
                      <td className="px-2 py-2">Xem đặt phòng</td>
                      <td className="px-2 py-2">Xem danh sách đặt phòng</td>
                      <td className="px-2 py-2">Đặt phòng</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-500">
                Chọn role bằng dropdown. Mã, tên, mô tả và danh mục quyền được nhập thủ công.
                Mỗi dòng hợp lệ sẽ thêm quyền đó cho role đã chọn.
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-slate-200 p-4">
            <h3 className="font-bold text-slate-900">Role có thể gán trong file</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {roles.map((role) => (
                <span key={role.code} className="rounded-full bg-slate-100 px-3 py-1.5 font-mono text-xs text-slate-700">
                  {role.code}
                </span>
              ))}
            </div>
          </div>
          </>
        </div>
      )}

      {view === "permissions" && activeStep === "overview" && (
        <div className="p-4 sm:p-5">
          <button
            type="button"
            onClick={() => navigateToStep("catalog")}
            className="mb-4 text-sm font-semibold text-blue-700 hover:underline"
          >
            ← Quay lại danh sách quyền
          </button>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="font-bold text-slate-900">Bản tổng quan role và quyền</h3>
              <p className="mt-1 text-sm text-slate-500">
                {roles.length} role · {permissions.length} quyền trong danh mục
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigateToStep("catalog")}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              + Tạo role
            </button>
          </div>
          {isRolePermissionsLoading ? (
            <p className="mt-4 text-sm text-slate-500">Đang tải cấu hình quyền...</p>
          ) : permissions.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-slate-300 px-4 py-10 text-center">
              <p className="font-semibold text-slate-700">Chưa có quyền nào được nhập</p>
              <p className="mt-1 text-sm text-slate-500">Tạo role trước, sau đó nhập danh sách quyền từ file Excel.</p>
              <button
                type="button"
                onClick={() => navigateToStep("permissions")}
                disabled={roles.length === 0}
                className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Nhập quyền Excel
              </button>
            </div>
          ) : (
            <div className="mt-4">
              {permissionActionError && (
                <p role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                  {permissionActionError}
                </p>
              )}
              <div className="mb-4 flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative block min-w-0 flex-1 sm:max-w-sm">
                  <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={overviewSearch}
                    onChange={(event) => setOverviewSearch(event.target.value)}
                    placeholder="Tìm role hoặc quyền..."
                    aria-label="Tìm role hoặc quyền"
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-10 text-sm outline-none focus:border-blue-400"
                  />
                  <ClearSearchButton value={overviewSearch} onClear={() => setOverviewSearch("")} label="Xóa tìm kiếm" />
                </div>
                <button
                  type="button"
                  onClick={() => setShowOnlyGranted((current) => !current)}
                  aria-pressed={!showOnlyGranted}
                  className="inline-flex h-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                >
                  {showOnlyGranted ? "Đang xem quyền đã cấp" : "Đang xem tất cả quyền"}
                  <span className="ml-1 text-blue-700">{showOnlyGranted ? "· Hiện tất cả" : "· Chỉ quyền đã cấp"}</span>
                </button>
              </div>
              <div className="space-y-3">
                {roles.map((role) => {
                  const assignedPermissions = rolePermissionGroups.find((group) => group.roleCode === role.code)?.permissions ?? [];
                  const grantedCount = assignedPermissions.filter((permission) => permission.granted).length;
                  const normalizedSearch = overviewSearch.trim().toLocaleLowerCase();
                  const roleMatchesSearch = [role.name, role.code, role.description]
                    .some((value) => value.toLocaleLowerCase().includes(normalizedSearch));
                  const visiblePermissions = assignedPermissions.filter((permission) => {
                    if (showOnlyGranted && !permission.granted) return false;
                    if (!normalizedSearch || roleMatchesSearch) return true;
                    return [permission.name, permission.code, permission.category ?? UNCATEGORIZED, permission.description]
                      .some((value) => value.toLocaleLowerCase().includes(normalizedSearch));
                  });
                  const visiblePermissionsByCategory = new Map<string, typeof visiblePermissions>();
                  visiblePermissions.forEach((permission) => {
                    const category = categoryOf(permission.category);
                    const categoryPermissions = visiblePermissionsByCategory.get(category) ?? [];
                    categoryPermissions.push(permission);
                    visiblePermissionsByCategory.set(category, categoryPermissions);
                  });
                  if (normalizedSearch && !roleMatchesSearch && visiblePermissions.length === 0) return null;

                  return (
                    <details key={role.code} className="group rounded-xl border border-slate-200 bg-white">
                      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 rounded-xl p-4 hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-700">
                            <ShieldCheck size={17} />
                          </span>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="font-bold text-slate-900">{translateDisplayText(role.name)}</h4>
                              {role.system && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">{localizedText("Hệ thống", "System")}</span>}
                            </div>
                            <p className="mt-0.5 truncate font-mono text-xs text-slate-500">{role.code}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                            {grantedCount} / {assignedPermissions.length} quyền
                          </span>
                          <ChevronDown size={18} className="text-slate-400 transition-transform group-open:rotate-180" />
                        </div>
                      </summary>
                      <div className="border-t border-slate-100 p-4">
                        {role.description && <p className="mb-3 text-sm text-slate-500">{translateDisplayText(role.description)}</p>}
                        {visiblePermissions.length > 0 ? (
                          <div className="space-y-4">
                            {[...visiblePermissionsByCategory].map(([category, categoryPermissions]) => (
                              <section key={category} aria-label={`Danh mục ${category}`}>
                                <div className="mb-2 flex items-center justify-between border-b border-slate-100 pb-2">
                                  <h5 className="text-sm font-semibold text-slate-700">{translateDisplayText(category)}</h5>
                                  <span className="text-xs text-slate-500">{categoryPermissions.length} quyền</span>
                                </div>
                                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                                  {categoryPermissions.map((permission) => (
                                    <div
                                      key={permission.code}
                                      className={`flex min-w-0 items-start justify-between gap-2 rounded-lg border p-3 ${
                                        permission.granted ? "border-emerald-100 bg-emerald-50/50" : "border-slate-100 bg-slate-50"
                                      }`}
                                    >
                                      <div className="flex min-w-0 gap-2">
                                        {permission.granted && <Check size={15} className="mt-0.5 shrink-0 text-emerald-600" />}
                                        <div className="min-w-0">
                                          <p className="text-sm font-semibold text-slate-800">{permissionNameLabel(permission.name)}</p>
                                          <p className="mt-0.5 break-all font-mono text-[11px] text-slate-500">{permission.code}</p>
                                          {permission.description && <p className="mt-1 text-xs leading-5 text-slate-500">{translateDisplayText(permission.description)}</p>}
                                        </div>
                                      </div>
                                      <button
                                        type="button"
                                        disabled={isUpdatingAssignment}
                                        onClick={() => {
                                          setPermissionActionError("");
                                          setPendingPermissionChange({ roleCode: role.code, permission });
                                        }}
                                        className={`shrink-0 rounded-md px-2 py-1 text-xs font-semibold transition disabled:cursor-wait disabled:opacity-50 ${
                                          permission.granted
                                            ? "bg-white text-rose-700 hover:bg-rose-100"
                                            : "bg-blue-100 text-blue-700 hover:bg-blue-200"
                                        }`}
                                      >
                                        {updatingAssignment === `${role.code}:${permission.code}`
                                          ? localizedText("Đang lưu...", "Saving...")
                                          : permission.granted
                                            ? localizedText("Gỡ", "Remove")
                                            : localizedText("Gán", "Assign")}
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </section>
                            ))}
                          </div>
                        ) : (
                          <p className="rounded-lg bg-slate-50 px-3 py-4 text-center text-sm text-slate-500">
                            {normalizedSearch ? "Không tìm thấy quyền phù hợp." : "Role này chưa được gán quyền nào."}
                          </p>
                        )}
                      </div>
                    </details>
                  );
                })}
                {overviewSearch.trim() && !roles.some((role) => {
                  const roleMatchesSearch = [role.name, role.code, role.description]
                    .some((value) => value.toLocaleLowerCase().includes(overviewSearch.trim().toLocaleLowerCase()));
                  const assignedPermissions = rolePermissionGroups.find((group) => group.roleCode === role.code)?.permissions ?? [];
                  return roleMatchesSearch || assignedPermissions.some((permission) =>
                    (!showOnlyGranted || permission.granted) &&
                    [permission.name, permission.code, categoryOf(permission.category), permission.description]
                      .some((value) => value.toLocaleLowerCase().includes(overviewSearch.trim().toLocaleLowerCase())),
                  );
                }) && (
                  <FilterResultStatus filterKey={overviewSearch}><p className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
                    Không tìm thấy role hoặc quyền phù hợp.
                  </p></FilterResultStatus>
                )}
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={() => navigateToStep("permissions")}
            disabled={roles.length === 0}
            className="mt-4 text-sm font-semibold text-blue-700 hover:underline"
          >
            Nhập hoặc cập nhật quyền từ Excel →
          </button>
        </div>
      )}
    </section>
  );
}
