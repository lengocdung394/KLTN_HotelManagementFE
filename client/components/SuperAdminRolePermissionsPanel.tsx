import { useRef, useState } from "react";
import {
  ChevronDown,
  Check,
  CirclePlus,
  ChevronsUpDown,
  Columns3,
  FileSpreadsheet,
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
import { localizedText } from "../i18n";
import {
  useCreateSuperAdminPermissionMutation,
  useCreateSuperAdminRoleMutation,
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

const PERMISSION_HEADERS = ["Role", "Mã quyền", "Tên quyền", "Mô tả quyền", "Danh mục"];
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
const ROLE_TABLE_COLUMNS = [
  { id: "name", label: "Tên vai trò", width: 180 },
  { id: "code", label: "Mã vai trò", width: 200 },
  { id: "description", label: "Mô tả", width: 240 },
  { id: "count", label: "Quyền đã gán", width: 140 },
  { id: "permissions", label: "Danh sách quyền", width: 740 },
] as const;
type RoleTableColumnId = (typeof ROLE_TABLE_COLUMNS)[number]["id"];

const normalizeCode = (value: string) => value.trim().toLocaleUpperCase();
const categoryOf = (category?: string) => category?.trim() || UNCATEGORIZED;

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
    ...Array.from({ length: 10 }, () => ["", "", "", "", ""]),
  ];
  const workbook = createXlsxWorkbook([
    {
      name: "Phân quyền",
      rows,
      validations: [
        { range: "A2:A1000", type: "list", formula1: "=RoleList" },
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
        ["Mỗi dòng sẽ thêm một quyền mới cho role đã chọn. Nếu một role có nhiều quyền, thêm mỗi quyền vào một dòng riêng."],
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
  const [importPermissionCatalogRequest, { isLoading: isSavingPermissionCatalog }] =
    useImportSuperAdminPermissionCatalogMutation();
  const [createRoleRequest, { isLoading: isCreatingRole }] = useCreateSuperAdminRoleMutation();
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
  });
  const [roleCode, setRoleCode] = useState("");
  const [roleName, setRoleName] = useState("");
  const [roleDescription, setRoleDescription] = useState("");
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
  const [catalogError, setCatalogError] = useState("");
  const [permissionFieldErrors, setPermissionFieldErrors] = useState<Record<string, string>>({});
  const [catalogMessage, setCatalogMessage] = useState("");
  const [catalogSearch, setCatalogSearch] = useState("");
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

  const createRole = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setRoleError("");
    const fieldErrors: Record<string, string> = {};
    const code = normalizeCode(roleCode);
    if (!/^ROLE_[A-Z0-9_]+$/.test(code)) {
      fieldErrors.code = localizedText("Mã role cần bắt đầu bằng ROLE_ và chỉ gồm chữ in hoa, số hoặc dấu gạch dưới.", "Role codes must start with ROLE_ and contain only uppercase letters, numbers, or underscores.");
    }
    if (!fieldErrors.code && roles.some((role) => role.code === code)) {
      fieldErrors.code = localizedText(`Role ${code} đã tồn tại.`, `Role ${code} already exists.`);
    }
    if (!roleName.trim()) fieldErrors.name = localizedText("Vui lòng nhập tên role.", "Enter a role name.");
    if (!roleDescription.trim()) fieldErrors.description = localizedText("Vui lòng nhập mô tả role.", "Enter a role description.");
    setRoleFieldErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) {
      return;
    }
    try {
      await createRoleRequest({
        code,
        name: roleName.trim(),
        description: roleDescription.trim(),
      }).unwrap();
      setRoleCode("");
      setRoleName("");
      setRoleDescription("");
      setRoleFieldErrors({});
      setIsAddRoleDialogOpen(false);
      setActiveStep("catalog");
    } catch (error) {
      setRoleError(getErrorMessage(error, localizedText("Không thể tạo role. Vui lòng thử lại.", "Could not create the role. Please try again.")));
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

  const createPermission = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCatalogError("");
    setCatalogMessage("");
    const fieldErrors: Record<string, string> = {};
    const code = normalizeCode(permissionCode);
    if (!/^[A-Z][A-Z0-9_.:-]*$/.test(code)) {
      fieldErrors.code = localizedText("Mã quyền phải bắt đầu bằng chữ và chỉ gồm chữ in hoa, số, dấu gạch dưới, chấm, hai chấm hoặc gạch ngang.", "Permission codes must start with a letter and contain only uppercase letters, numbers, underscores, periods, colons, or hyphens.");
    }
    if (!fieldErrors.code && permissions.some((permission) => normalizeCode(permission.code) === code)) {
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
      await createPermissionRequest({
        code,
        name: permissionName.trim(),
        category: permissionCategory.trim(),
        description: permissionDescription.trim(),
      }).unwrap();
      setPermissionCode("");
      setPermissionName("");
      setPermissionCategory("");
      setPermissionDescription("");
      setPermissionFieldErrors({});
      setCatalogMessage(`Đã tạo quyền ${code}.`);
      setIsAddPermissionDialogOpen(false);
    } catch (error) {
      setCatalogError(getErrorMessage(error, localizedText("Không thể tạo quyền. Vui lòng thử lại.", "Could not create the permission. Please try again.")));
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
    try {
      const request = permission.granted ? removePermissionFromRole : addPermissionToRole;
      await request({ roleCode, permissionCode: permission.code }).unwrap();
      return true;
    } catch (error) {
      setPermissionActionError(
        getErrorMessage(error, `Không thể cập nhật quyền ${permission.code} cho role ${roleCode}.`),
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

    for (const roleCode of pendingBulkPermissionAssignment.roleCodes) {
      try {
        await addPermissionToRole({
          roleCode,
          permissionCode: pendingBulkPermissionAssignment.permission.code,
        }).unwrap();
      } catch {
        failedRoles.push(roleCode);
      }
    }

    const assignedCount = pendingBulkPermissionAssignment.roleCodes.length - failedRoles.length;
    if (failedRoles.length > 0) {
      setPermissionActionError(
        `Đã gán quyền cho ${assignedCount}/${pendingBulkPermissionAssignment.roleCodes.length} vai trò. Không thể gán cho: ${failedRoles.join(", ")}.`,
      );
      setPendingBulkPermissionAssignment({
        ...pendingBulkPermissionAssignment,
        roleCodes: failedRoles,
      });
    } else {
      setCatalogMessage(
        `Đã gán quyền ${pendingBulkPermissionAssignment.permission.name} cho ${assignedCount} vai trò.`,
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
  const catalogPermissionsByCategory = new Map<string, typeof filteredCatalogPermissions>();
  filteredCatalogPermissions.forEach((permission) => {
    const category = categoryOf(permission.category);
    const categoryPermissions = catalogPermissionsByCategory.get(category) ?? [];
    categoryPermissions.push(permission);
    catalogPermissionsByCategory.set(category, categoryPermissions);
  });
  const shownCatalogColumns = CATALOG_TABLE_COLUMNS.filter((column) => visibleCatalogColumns[column.id]);
  const shownCatalogTableWidth = shownCatalogColumns.reduce((total, column) => total + column.width, 0);
  const shownRoleColumns = ROLE_TABLE_COLUMNS.filter((column) => visibleRoleColumns[column.id]);
  const shownRoleTableWidth = shownRoleColumns.reduce((total, column) => total + column.width, 0);
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
            {view === "roles" ? "Quản lý vai trò" : "Quản lý quyền"}
          </h2>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          {view === "roles"
            ? "Tạo và xem các vai trò được sử dụng trong hệ thống."
            : "Quản lý danh mục quyền, gán quyền cho vai trò và xem tổng quan phân quyền."}
        </p>
      </header>

      {(isRolesError || isRolePermissionsError || isPermissionCatalogError) && (
        <div role="alert" className="mx-4 mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 sm:mx-5">
          <p>Không thể tải role hoặc danh mục quyền từ backend.</p>
          <div className="mt-2 flex gap-3 font-semibold">
            {isRolesError && <button type="button" onClick={() => void refetchRoles()}>Tải lại role</button>}
            {isRolePermissionsError && <button type="button" onClick={() => void refetchRolePermissions()}>Tải lại quyền</button>}
            {isPermissionCatalogError && <button type="button" onClick={() => void refetchPermissionCatalog()}>Tải danh mục quyền</button>}
          </div>
        </div>
      )}

      {view === "roles" && (
        <div className="p-4 sm:p-5">
          <div className="rounded-xl border border-slate-200 p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-slate-900">Các vai trò hiện có</h3>
                <p className="mt-1 text-sm text-slate-500">{roles.length} vai trò trong hệ thống</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      aria-label="Tùy chỉnh cột bảng vai trò"
                      className="flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <Columns3 size={16} />
                      Cột
                      <ChevronDown size={16} />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-56 p-2">
                    <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Hiển thị cột
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
                          {column.label}
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
                      })}
                      className="mt-1 w-full rounded-md border-t border-slate-100 px-2 pt-2 text-left text-xs font-semibold text-blue-700 hover:text-blue-800"
                    >
                      Hiện tất cả cột
                    </button>
                  </PopoverContent>
                </Popover>
                <button
                  type="button"
                  onClick={() => {
                    setRoleError("");
                    setRoleFieldErrors({});
                    setRoleFileError("");
                    setRoleFileMessage("");
                    setAddRoleMode("single");
                    setIsAddRoleDialogOpen(true);
                  }}
                  className="flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  <CirclePlus size={17} />
                  Thêm vai trò
                </button>
              </div>
            </div>
            {roleError && <p role="alert" className="mt-3 text-sm text-rose-600">{roleError}</p>}
            {roleFileError && <p role="alert" className="mt-3 text-sm text-rose-600">{roleFileError}</p>}
            {roleFileMessage && <p role="status" className="mt-3 text-sm text-emerald-700">{roleFileMessage}</p>}
            {isRolesLoading ? (
              <p className="py-10 text-center text-sm text-slate-500">Đang tải vai trò...</p>
            ) : roles.length === 0 ? (
              <div className="mt-4 rounded-lg border border-dashed border-slate-300 px-4 py-10 text-center">
                <p className="font-semibold text-slate-700">Chưa có vai trò nào</p>
                <p className="mt-1 text-sm text-slate-500">Tạo vai trò để bắt đầu phân quyền cho tài khoản.</p>
              </div>
            ) : (
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
                          <span>{column.label}</span>
                          <div className="inline-flex shrink-0 rounded-lg bg-slate-200/70 p-0.5 normal-case tracking-normal">
                            <button
                              type="button"
                              aria-pressed={!showAllRolePermissions}
                              onClick={() => setShowAllRolePermissions(false)}
                              className={`rounded-md px-2 py-1 text-[11px] font-semibold ${
                                !showAllRolePermissions ? "bg-white text-blue-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
                              }`}
                            >
                              Đã gán
                            </button>
                            <button
                              type="button"
                              aria-pressed={showAllRolePermissions}
                              onClick={() => setShowAllRolePermissions(true)}
                              className={`rounded-md px-2 py-1 text-[11px] font-semibold ${
                                showAllRolePermissions ? "bg-white text-blue-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
                              }`}
                            >
                              Tất cả
                            </button>
                          </div>
                        </div>
                          ) : column.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {roles.map((role, index) => {
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
                            <td className="px-4 py-3 tabular-nums text-slate-500">{index + 1}</td>
                            {visibleRoleColumns.name && <td className="break-words px-4 py-3 font-semibold text-slate-900">
                            <span className="flex flex-wrap items-center gap-2">
                              {role.name}
                              {role.system && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">Hệ thống</span>}
                            </span>
                            </td>}
                            {visibleRoleColumns.code && <td className="break-all px-4 py-3 font-mono text-xs text-slate-600">{role.code}</td>}
                            {visibleRoleColumns.description && <td className="break-words px-4 py-3 text-slate-600">{role.description || "—"}</td>}
                            {visibleRoleColumns.count && <td className="px-4 py-3 text-center">
                            <span className="whitespace-nowrap rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                              {grantedCount} quyền
                            </span>
                            </td>}
                            {visibleRoleColumns.permissions && <td className="px-4 py-3 align-top">
                            {visibleRolePermissions.length > 0 ? (
                              <div className="flex flex-wrap gap-1.5">
                                {visibleRolePermissions.map((permission) => (
                                  <span
                                    key={permission.code}
                                    title={`${permission.name} (${permission.code})`}
                                    className={`inline-flex items-center gap-1 rounded-md py-1 pl-2 pr-1 text-xs font-medium ${
                                      permission.granted ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-600"
                                    }`}
                                  >
                                    <span>{permission.name}</span>
                                    <button
                                      type="button"
                                      aria-label={`${permission.granted ? "Gỡ" : "Gán"} quyền ${permission.name} ${permission.granted ? "khỏi" : "cho"} vai trò ${role.name}`}
                                      title={`${permission.granted ? "Gỡ" : "Gán"} quyền ${permission.name}`}
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
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {view === "permissions" && activeStep === "catalog" && (
        <div className="p-4 sm:p-5">
          <div className="min-w-0 rounded-xl border border-slate-200 p-4 sm:p-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h3 className="font-bold text-slate-900">Danh mục quyền theo nhóm</h3>
                <p className="mt-1 text-sm text-slate-500">
                  {permissions.length} quyền · {catalogPermissionsByCategory.size} danh mục · bao gồm cả quyền chưa gán role
                </p>
              </div>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                <div className="relative block w-full sm:w-64">
                  <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={catalogSearch}
                    onChange={(event) => setCatalogSearch(event.target.value)}
                    placeholder="Tìm mã, tên hoặc danh mục..."
                    aria-label="Tìm quyền trong danh mục"
                    className="h-10 w-full rounded-lg border border-slate-200 pl-9 pr-10 text-sm outline-none focus:border-blue-400"
                  />
                    <ClearSearchButton value={catalogSearch} onClear={() => setCatalogSearch("")} label="Xóa tìm kiếm" />
                  </div>
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      aria-label="Tùy chỉnh cột bảng"
                      className="flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <Columns3 size={16} />
                      Cột
                      <ChevronDown size={16} />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-56 p-2">
                    <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Hiển thị cột
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
                          {column.label}
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
                      Hiện tất cả cột
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
                  Nạp quyền
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCatalogError("");
                    setPermissionFieldErrors({});
                    setCatalogFileError("");
                    setIsAddPermissionDialogOpen(true);
                  }}
                  className="flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  <CirclePlus size={17} />
                  Thêm quyền
                </button>
              </div>
            </div>
            {catalogMessage && <p role="status" className="mt-3 text-sm text-emerald-700">{catalogMessage}</p>}
            {catalogFileMessage && <p role="status" className="mt-3 text-sm text-emerald-700">{catalogFileMessage}</p>}
            {isPermissionCatalogLoading ? (
              <p className="py-10 text-center text-sm text-slate-500">Đang tải danh mục quyền...</p>
            ) : permissions.length === 0 ? (
              <div className="mt-4 rounded-lg border border-dashed border-slate-300 px-4 py-10 text-center">
                <p className="font-semibold text-slate-700">Chưa có quyền nào</p>
                <p className="mt-1 text-sm text-slate-500">Dùng nút “Thêm quyền” để tạo quyền hoặc nhập danh mục từ Excel.</p>
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
                          {column.label}
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
                                  {category}
                                </span>
                              </td>
                            )}
                            {visibleCatalogColumns.name && (
                              <td className="px-4 py-3 font-semibold text-slate-900">{permission.name}</td>
                            )}
                            {visibleCatalogColumns.code && (
                              <td className="break-all px-4 py-3 font-mono text-xs text-slate-600">{permission.code}</td>
                            )}
                            {visibleCatalogColumns.description && (
                              <td className="px-4 py-3 text-slate-600">{permission.description || "—"}</td>
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
                                <span className="text-xs text-slate-400">Chưa gán</span>
                              )}
                            </td>}
                            {visibleCatalogColumns.actions && <td className="whitespace-nowrap px-4 py-3 text-right">
                              <button
                                type="button"
                                disabled={roles.length === 0 || isUpdatingAssignment}
                                onClick={() => {
                                  setCatalogAssignmentRoleCode(roles[0]?.code ?? "");
                                  setPermissionToAssign(permission);
                                }}
                                className="rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                Gán quyền
                              </button>
                            </td>}
                          </tr>
                        );
                      })}
                    </tbody>
                  ))}
                </table>
                {filteredCatalogPermissions.length === 0 && (
                  <FilterResultStatus filterKey={catalogSearch}><p className="rounded-lg border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
                    Không tìm thấy quyền phù hợp.
                  </p></FilterResultStatus>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {view === "permissions" && activeStep === "catalog" && (
        <Dialog open={isAddPermissionDialogOpen} onOpenChange={setIsAddPermissionDialogOpen}>
          <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Thêm quyền vào danh mục</DialogTitle>
              <DialogDescription>
                Tạo một quyền mới hoặc nhập nhiều quyền từ Excel. Quyền được thêm vào danh mục, chưa tự động gán cho role.
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
                <CirclePlus size={16} />
                Tạo quyền lẻ
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
                Nhập từ Excel
              </button>
            </div>
            {addPermissionMode === "single" ? (
              <form noValidate onSubmit={(event) => void createPermission(event)}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm font-semibold text-slate-700">
                    Mã quyền <span aria-hidden="true" className="text-rose-600">*</span>
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
                    {permissionFieldErrors.code && <span id="permission-code-error" className="mt-1 block text-xs font-normal text-rose-600">{permissionFieldErrors.code}</span>}
                  </label>
                  <label className="block text-sm font-semibold text-slate-700">
                    Tên quyền <span aria-hidden="true" className="text-rose-600">*</span>
                    <input
                      value={permissionName}
                      aria-invalid={Boolean(permissionFieldErrors.name)}
                      aria-describedby={permissionFieldErrors.name ? "permission-name-error" : undefined}
                      onChange={(event) => {
                        setPermissionName(event.target.value);
                        setPermissionFieldErrors((current) => ({ ...current, name: "" }));
                        setCatalogError("");
                      }}
                      placeholder="Xem báo cáo đặc biệt"
                      className={`mt-1.5 h-10 w-full rounded-lg border px-3 text-sm font-normal outline-none focus:border-blue-400 ${permissionFieldErrors.name ? "border-rose-400" : "border-slate-200"}`}
                    />
                    {permissionFieldErrors.name && <span id="permission-name-error" className="mt-1 block text-xs font-normal text-rose-600">{permissionFieldErrors.name}</span>}
                  </label>
                </div>
                <label className="mt-3 block text-sm font-semibold text-slate-700">
                  Danh mục <span aria-hidden="true" className="text-rose-600">*</span>
                  <input
                    value={permissionCategory}
                    aria-invalid={Boolean(permissionFieldErrors.category)}
                    aria-describedby={permissionFieldErrors.category ? "permission-category-error" : undefined}
                    onChange={(event) => {
                      setPermissionCategory(event.target.value);
                      setPermissionFieldErrors((current) => ({ ...current, category: "" }));
                      setCatalogError("");
                    }}
                    placeholder="Ví dụ: Đặt phòng, Khách hàng, Báo cáo"
                    className={`mt-1.5 h-10 w-full rounded-lg border px-3 text-sm font-normal outline-none focus:border-blue-400 ${permissionFieldErrors.category ? "border-rose-400" : "border-slate-200"}`}
                  />
                  {permissionFieldErrors.category && <span id="permission-category-error" className="mt-1 block text-xs font-normal text-rose-600">{permissionFieldErrors.category}</span>}
                </label>
                <label className="mt-3 block text-sm font-semibold text-slate-700">
                  Mô tả <span aria-hidden="true" className="text-rose-600">*</span>
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
                    placeholder="Mô tả chức năng mà quyền này cho phép"
                    className={`mt-1.5 w-full rounded-lg border px-3 py-2 text-sm font-normal outline-none focus:border-blue-400 ${permissionFieldErrors.description ? "border-rose-400" : "border-slate-200"}`}
                  />
                  {permissionFieldErrors.description && <span id="permission-description-error" className="mt-1 block text-xs font-normal text-rose-600">{permissionFieldErrors.description}</span>}
                </label>
                {catalogError && <p role="alert" className="mt-3 text-sm text-rose-600">{catalogError}</p>}
                <button
                  type="submit"
                  disabled={isCreatingPermission || isPermissionCatalogLoading || isPermissionCatalogError}
                  className="mt-4 flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  <Plus size={16} />
                  {isCreatingPermission ? "Đang tạo..." : "Tạo quyền"}
                </button>
              </form>
            ) : (
              <div>
                <p className="text-sm leading-5 text-slate-600">
                  File Excel cần có mã quyền, tên quyền, danh mục và mô tả. Nếu mã đã tồn tại, thông tin quyền được cập nhật mà không đổi role đang được gán.
                </p>
                <button
                  type="button"
                  onClick={downloadPermissionCatalogTemplate}
                  className="mt-4 flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <FileSpreadsheet size={16} />
                  Tải file Excel mẫu
                </button>
                <label className="mt-4 block text-sm font-semibold text-slate-700">
                  Chọn file danh mục quyền (.xlsx)
                  <input
                    ref={catalogFileInputRef}
                    type="file"
                    accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    disabled={isImporting}
                    onChange={(event) => void importPermissionCatalog(event.currentTarget.files?.[0])}
                    className="mt-1.5 block w-full rounded-lg border border-slate-200 p-2 text-sm font-normal file:mr-3 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:font-semibold file:text-blue-700"
                  />
                </label>
                {isReadingFile && <p role="status" className="mt-3 text-sm text-blue-700">Đang đọc file quyền...</p>}
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
              <DialogTitle>Nạp quyền</DialogTitle>
              <DialogDescription>
                Thêm quyền mới cho vai trò đã có sẵn. Chọn role hiện có trong file rồi nhập các quyền cần cấp.
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-slate-900">Định dạng file Excel</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Mỗi dòng là một quyền mới cần thêm cho role đã tồn tại.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => downloadPermissionTemplate(roles)}
                  disabled={roles.length === 0}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <FileSpreadsheet size={16} />
                  Tải file Excel mẫu
                </button>
              </div>
              <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full min-w-[680px] text-left text-xs">
                  <thead className="bg-slate-50 font-bold text-slate-600">
                    <tr>{PERMISSION_HEADERS.map((header) => <th key={header} className="px-3 py-2">{header}</th>)}</tr>
                  </thead>
                  <tbody>
                    <tr className="divide-x divide-slate-100 text-slate-600">
                      {["ROLE_MANAGER", "VIEW_BOOKINGS", "Xem đặt phòng", "Cho phép xem đặt phòng", "Đặt phòng"].map((value) => (
                        <td key={value} className="px-3 py-2">{value}</td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            <label className="block text-sm font-semibold text-slate-700">
              Chọn file phân quyền (.xlsx)
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
              <p className="text-sm text-amber-700">Hãy tạo role trước để nhập phân quyền.</p>
            )}
            {isImporting && <p role="status" className="text-sm text-blue-700">Đang đọc file phân quyền...</p>}
            {importError && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{importError}</p>}
            {importMessage && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{importMessage}</p>}
          </DialogContent>
        </Dialog>
      )}

      {view === "roles" && (
        <Dialog open={isAddRoleDialogOpen} onOpenChange={setIsAddRoleDialogOpen}>
          <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Thêm vai trò</DialogTitle>
              <DialogDescription>
                Tạo vai trò thủ công hoặc nhập danh sách vai trò từ Excel.
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
                <CirclePlus size={16} />
                Tạo vai trò lẻ
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
                Nhập từ Excel
              </button>
            </div>
            {addRoleMode === "single" ? (
              <form noValidate onSubmit={(event) => void createRole(event)} className="mt-4">
                <label className="block text-sm font-semibold text-slate-700">
                  Mã role <span aria-hidden="true" className="text-rose-600">*</span>
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
                  {roleFieldErrors.code && <span id="role-code-error" className="mt-1 block text-xs font-normal text-rose-600">{roleFieldErrors.code}</span>}
                </label>
                <label className="mt-3 block text-sm font-semibold text-slate-700">
                  Tên role <span aria-hidden="true" className="text-rose-600">*</span>
                  <input
                    value={roleName}
                    aria-invalid={Boolean(roleFieldErrors.name)}
                    aria-describedby={roleFieldErrors.name ? "role-name-error" : undefined}
                    onChange={(event) => {
                      setRoleName(event.target.value);
                      setRoleFieldErrors((current) => ({ ...current, name: "" }));
                      setRoleError("");
                    }}
                    placeholder="Lễ tân"
                    className={`mt-1.5 h-10 w-full rounded-lg border px-3 text-sm font-normal outline-none focus:border-blue-400 ${roleFieldErrors.name ? "border-rose-400" : "border-slate-200"}`}
                  />
                  {roleFieldErrors.name && <span id="role-name-error" className="mt-1 block text-xs font-normal text-rose-600">{roleFieldErrors.name}</span>}
                </label>
                <label className="mt-3 block text-sm font-semibold text-slate-700">
                  Mô tả <span aria-hidden="true" className="text-rose-600">*</span>
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
                    placeholder="Mô tả trách nhiệm của role"
                    className={`mt-1.5 w-full rounded-lg border px-3 py-2 text-sm font-normal outline-none focus:border-blue-400 ${roleFieldErrors.description ? "border-rose-400" : "border-slate-200"}`}
                  />
                  {roleFieldErrors.description && <span id="role-description-error" className="mt-1 block text-xs font-normal text-rose-600">{roleFieldErrors.description}</span>}
                </label>
                {roleError && <p role="alert" className="mt-3 text-sm text-rose-600">{roleError}</p>}
                <button
                  type="submit"
                  disabled={isCreatingRole || isRolesLoading || isRolesError}
                  className="mt-4 flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  <Plus size={16} />
                  {isCreatingRole ? "Đang tạo..." : "Tạo vai trò"}
                </button>
              </form>
            ) : (
              <div className="mt-4">
                <p className="text-sm leading-5 text-slate-600">
                  File Excel gồm ba cột bắt buộc: mã role, tên role và mô tả. Mã role phải duy nhất và bắt đầu bằng ROLE_.
                </p>
                <button
                  type="button"
                  onClick={downloadRoleTemplate}
                  className="mt-4 flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <FileSpreadsheet size={16} />
                  Tải file Excel mẫu
                </button>
                <label className="mt-4 block text-sm font-semibold text-slate-700">
                  Chọn file danh sách vai trò (.xlsx)
                  <input
                    ref={roleFileInputRef}
                    type="file"
                    accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    disabled={isImportingRoles || isRolesLoading || isRolesError}
                    onChange={(event) => void importRoles(event.currentTarget.files?.[0])}
                    className="mt-1.5 block w-full rounded-lg border border-slate-200 p-2 text-sm font-normal file:mr-3 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:font-semibold file:text-blue-700"
                  />
                </label>
                {isImportingRoles && <p role="status" className="mt-3 text-sm text-blue-700">Đang kiểm tra và tạo vai trò...</p>}
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
              <DialogTitle>Gán quyền cho vai trò</DialogTitle>
              <DialogDescription>
                Chọn vai trò để gán quyền {permissionToAssign?.name ? <strong>{permissionToAssign.name}</strong> : "này"}.
              </DialogDescription>
            </DialogHeader>
            <label className="block text-sm font-semibold text-slate-700">
              Vai trò
              <select
                value={catalogAssignmentRoleCode}
                onChange={(event) => setCatalogAssignmentRoleCode(event.target.value)}
                disabled={roles.length === 0}
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal outline-none focus:border-blue-400"
              >
                {roles.map((role) => (
                  <option key={role.code} value={role.code}>{role.name} ({role.code})</option>
                ))}
              </select>
            </label>
            {isPermissionAlreadyAssignedToSelectedRole && (
              <p role="status" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Quyền này đã được gán cho vai trò đang chọn.
              </p>
            )}
            <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-3">
              <p className="text-sm text-slate-700">
                Chưa có quyền này: <strong>{rolesMissingPermission.length}</strong> / {roles.length} vai trò
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
                Gán cho tất cả vai trò còn thiếu
              </button>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPermissionToAssign(null)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Hủy
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
                Tiếp tục
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
              {pendingPermissionChange?.permission.granted ? "Xác nhận gỡ quyền" : "Xác nhận gán quyền"}
            </DialogTitle>
            <DialogDescription>
              {pendingPermissionChange && (() => {
                const role = roles.find((item) => item.code === pendingPermissionChange.roleCode);
                const permission = pendingPermissionChange.permission;
                return pendingPermissionChange.permission.granted
                  ? <>Bạn có chắc muốn gỡ quyền <strong>{permission.name}</strong> ({permission.code}) khỏi role <strong>{role?.name ?? role?.code ?? pendingPermissionChange.roleCode}</strong>?</>
                  : <>Bạn có chắc muốn gán quyền <strong>{permission.name}</strong> ({permission.code}) cho role <strong>{role?.name ?? role?.code ?? pendingPermissionChange.roleCode}</strong>?</>;
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
              Hủy
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
                ? "Đang lưu..."
                : pendingPermissionChange?.permission.granted
                  ? "Gỡ quyền"
                  : "Gán quyền"}
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
            <DialogTitle>Xác nhận gán quyền hàng loạt</DialogTitle>
            <DialogDescription>
              {pendingBulkPermissionAssignment && (
                <>
                  Gán quyền <strong>{pendingBulkPermissionAssignment.permission.name}</strong> (
                  {pendingBulkPermissionAssignment.permission.code}) cho{" "}
                  <strong>{pendingBulkPermissionAssignment.roleCodes.length} vai trò chưa có quyền này</strong>.
                  Chỉ cần xác nhận một lần để áp dụng cho toàn bộ danh sách bên dưới.
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
              Hủy
            </button>
            <button
              type="button"
              onClick={() => void confirmBulkPermissionAssignment()}
              disabled={isConfirmingBulkAssignment || !pendingBulkPermissionAssignment?.roleCodes.length}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isConfirmingBulkAssignment
                ? "Đang gán..."
                : `Gán cho tất cả (${pendingBulkPermissionAssignment?.roleCodes.length ?? 0})`}
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
                  {roles.length === 0 && <option value="">Chưa có role</option>}
                  {roles.map((role) => (
                    <option key={role.code} value={role.code}>{role.name} ({role.code})</option>
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
                            <span className="truncate">{category}</span>
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
                          <h4 className="font-semibold text-slate-800">{category}</h4>
                          <span className="text-xs text-slate-500">
                            {categoryPermissions.filter((permission) => permission.granted).length} / {categoryPermissions.length} đã gán
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
                                  <p className="text-sm font-semibold text-slate-800">{permission.name}</p>
                                  <p className="mt-1 break-all font-mono text-[11px] text-slate-500">{permission.code}</p>
                                  {permission.description && (
                                    <p className="mt-1 text-xs leading-5 text-slate-500">{permission.description}</p>
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
                                  ? "Đang lưu..."
                                  : permission.granted
                                    ? "Gỡ"
                                    : "Gán"}
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
                              <h4 className="font-bold text-slate-900">{role.name}</h4>
                              {role.system && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">Hệ thống</span>}
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
                        {role.description && <p className="mb-3 text-sm text-slate-500">{role.description}</p>}
                        {visiblePermissions.length > 0 ? (
                          <div className="space-y-4">
                            {[...visiblePermissionsByCategory].map(([category, categoryPermissions]) => (
                              <section key={category} aria-label={`Danh mục ${category}`}>
                                <div className="mb-2 flex items-center justify-between border-b border-slate-100 pb-2">
                                  <h5 className="text-sm font-semibold text-slate-700">{category}</h5>
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
                                          <p className="text-sm font-semibold text-slate-800">{permission.name}</p>
                                          <p className="mt-0.5 break-all font-mono text-[11px] text-slate-500">{permission.code}</p>
                                          {permission.description && <p className="mt-1 text-xs leading-5 text-slate-500">{permission.description}</p>}
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
                                          ? "Đang lưu..."
                                          : permission.granted
                                            ? "Gỡ"
                                            : "Gán"}
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
