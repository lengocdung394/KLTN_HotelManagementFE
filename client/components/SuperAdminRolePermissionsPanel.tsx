import { useRef, useState } from "react";
import {
  ChevronDown,
  Check,
  CirclePlus,
  ChevronsUpDown,
  FileSpreadsheet,
  LayoutDashboard,
  LockKeyhole,
  Plus,
  Search,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { createXlsxWorkbook, downloadFile } from "../lib/bulkImportFiles";
import { parseSuperAdminPermissionCatalogFile } from "../lib/superAdminPermissionCatalogImport";
import { parseSuperAdminRolePermissionsFile } from "../lib/superAdminRolePermissionsImport";
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

const PERMISSION_HEADERS = ["Role", "Mã quyền", "Tên quyền", "Mô tả quyền", "Danh mục", "Cấp quyền (Có/Không)"];
const CATALOG_HEADERS = ["Mã quyền", "Tên quyền", "Danh mục", "Mô tả quyền"];
const UNCATEGORIZED = "Chưa phân loại";

const normalizeCode = (value: string) => value.trim().toLocaleUpperCase();
const categoryOf = (category?: string) => category?.trim() || UNCATEGORIZED;

const downloadPermissionTemplate = (roles: SuperAdminRole[]) => {
  const rows: Array<Array<string | number>> = [
    PERMISSION_HEADERS,
    ...Array.from({ length: 10 }, () => ["", "", "", "", "", "Có"]),
  ];
  const workbook = createXlsxWorkbook([
    {
      name: "Phân quyền",
      rows,
      validations: [
        { range: "A2:A1000", type: "list", formula1: "=RoleList" },
        { range: "F2:F1000", type: "list", formula1: '"Có,Không"' },
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
        ["Cấp quyền chọn Có hoặc Không. Nếu một role có nhiều quyền, thêm mỗi quyền vào một dòng riêng."],
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

export default function SuperAdminRolePermissionsPanel() {
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
  const [roleCode, setRoleCode] = useState("");
  const [roleName, setRoleName] = useState("");
  const [roleDescription, setRoleDescription] = useState("");
  const [roleError, setRoleError] = useState("");
  const [assignmentRoleCode, setAssignmentRoleCode] = useState("");
  const [assignmentCategory, setAssignmentCategory] = useState("all");
  const [isAssignmentCategoryOpen, setIsAssignmentCategoryOpen] = useState(false);
  const [assignmentCategorySearch, setAssignmentCategorySearch] = useState("");
  const [permissionCode, setPermissionCode] = useState("");
  const [permissionName, setPermissionName] = useState("");
  const [permissionCategory, setPermissionCategory] = useState("");
  const [permissionDescription, setPermissionDescription] = useState("");
  const [catalogError, setCatalogError] = useState("");
  const [catalogMessage, setCatalogMessage] = useState("");
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogFileError, setCatalogFileError] = useState("");
  const [catalogFileMessage, setCatalogFileMessage] = useState("");
  const [isAddPermissionDialogOpen, setIsAddPermissionDialogOpen] = useState(false);
  const [isAddRoleDialogOpen, setIsAddRoleDialogOpen] = useState(false);
  const [addPermissionMode, setAddPermissionMode] = useState<"single" | "excel">("single");
  const [importError, setImportError] = useState("");
  const [importMessage, setImportMessage] = useState("");
  const [permissionActionError, setPermissionActionError] = useState("");
  const [updatingAssignment, setUpdatingAssignment] = useState<string | null>(null);
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [overviewSearch, setOverviewSearch] = useState("");
  const [showOnlyGranted, setShowOnlyGranted] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const catalogFileInputRef = useRef<HTMLInputElement>(null);
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
    const code = normalizeCode(roleCode);
    if (!/^ROLE_[A-Z0-9_]+$/.test(code)) {
      setRoleError("Mã role cần bắt đầu bằng ROLE_ và chỉ gồm chữ in hoa, số hoặc dấu gạch dưới.");
      return;
    }
    if (roles.some((role) => role.code === code)) {
      setRoleError(`Role ${code} đã tồn tại.`);
      return;
    }
    if (!roleName.trim()) {
      setRoleError("Vui lòng nhập tên role.");
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
      setIsAddRoleDialogOpen(false);
      setActiveStep("catalog");
    } catch (error) {
      setRoleError(getErrorMessage(error, "Không thể tạo role. Vui lòng thử lại."));
    }
  };

  const createPermission = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCatalogError("");
    setCatalogMessage("");
    const code = normalizeCode(permissionCode);
    if (!/^[A-Z][A-Z0-9_.:-]*$/.test(code)) {
      setCatalogError("Mã quyền phải bắt đầu bằng chữ và chỉ gồm chữ in hoa, số, dấu gạch dưới, chấm, hai chấm hoặc gạch ngang.");
      return;
    }
    if (!permissionName.trim()) {
      setCatalogError("Vui lòng nhập tên quyền.");
      return;
    }
    if (!permissionCategory.trim()) {
      setCatalogError("Vui lòng nhập danh mục quyền.");
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
      setCatalogMessage(`Đã tạo quyền ${code}.`);
      setIsAddPermissionDialogOpen(false);
    } catch (error) {
      setCatalogError(getErrorMessage(error, "Không thể tạo quyền. Vui lòng thử lại."));
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
      setCatalogFileError(getErrorMessage(error, "Không thể đọc file hoặc nhập danh mục quyền."));
    } finally {
      setIsReadingFile(false);
      if (catalogFileInputRef.current) catalogFileInputRef.current.value = "";
    }
  };

  const toggleRolePermission = async (
    roleCode: string,
    permission: SuperAdminPermissionAssignment,
  ) => {
    const assignmentKey = `${roleCode}:${permission.code}`;
    setUpdatingAssignment(assignmentKey);
    setPermissionActionError("");
    try {
      const request = permission.granted ? removePermissionFromRole : addPermissionToRole;
      await request({ roleCode, permissionCode: permission.code }).unwrap();
    } catch (error) {
      setPermissionActionError(
        getErrorMessage(error, `Không thể cập nhật quyền ${permission.code} cho role ${roleCode}.`),
      );
    } finally {
      setUpdatingAssignment(null);
    }
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
      setActiveStep("overview");
    } catch (error) {
      setImportError(getErrorMessage(error, "Không thể đọc file hoặc nạp quyền. Vui lòng thử lại."));
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
  const selectedAssignmentRoleCode = assignmentRoleCode || roles[0]?.code || "";
  const assignmentCategories = [...new Set(permissions.map((permission) => categoryOf(permission.category)))]
    .sort((left, right) => left.localeCompare(right, "vi"));
  const selectedRolePermissionGroup = rolePermissionGroups.find(
    (group) => group.roleCode === selectedAssignmentRoleCode,
  );
  const permissionsForAssignment = permissions
    .filter((permission) =>
      assignmentCategory === "all" || categoryOf(permission.category) === assignmentCategory,
    )
    .map((permission) => ({
      ...permission,
      granted: selectedRolePermissionGroup?.permissions.find((item) => item.code === permission.code)?.granted ?? false,
    }));

  return (
    <section className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="border-b border-slate-100 p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <ShieldCheck size={19} className="text-blue-600" />
          <h2 className="text-lg font-bold text-slate-900">Cấu hình role và phân quyền</h2>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Quản lý danh mục quyền độc lập, tạo role, phân quyền và xem tổng quan.
        </p>
      </header>

      <div className="m-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 sm:m-5">
        <LockKeyhole size={17} className="mt-0.5 shrink-0 text-amber-700" />
        <p className="text-sm leading-6 text-amber-900">
          Thao tác được lưu vào backend. Danh mục quyền dùng GET/POST{" "}
          <code>/role_permissions/permissions</code> và POST{" "}
          <code>/role_permissions/permissions/import</code>. Phân quyền role dùng{" "}
          <code>GET/POST /role_permissions/roles</code>,{" "}
          <code>GET /role_permissions/roles/permissions</code>,{" "}
          <code>POST /role_permissions/roles/permissions/import</code>, và POST/DELETE tại{" "}
          <code>/role_permissions/roles/{"{roleCode}"}/permissions/{"{permissionCode}"}</code>.
        </p>
      </div>
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

      <nav className="grid grid-cols-1 gap-2 px-4 sm:grid-cols-3 sm:px-5" aria-label="Các bước cấu hình role và quyền">
        {([
          ["catalog", "1. Quản lý role & quyền", ShieldCheck],
          ["permissions", "2. Gán quyền & Excel", FileSpreadsheet],
          ["overview", "3. Tổng quan", LayoutDashboard],
        ] as const).map(([step, label, Icon]) => (
          <button
            key={step}
            type="button"
            onClick={() => navigateToStep(step)}
            aria-current={activeStep === step ? "step" : undefined}
            className={`flex items-center gap-2 rounded-lg px-3 py-3 text-sm font-semibold ${
              activeStep === step ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </nav>

      {activeStep === "catalog" && (
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
                <label className="relative block w-full sm:w-64">
                  <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="search"
                    value={catalogSearch}
                    onChange={(event) => setCatalogSearch(event.target.value)}
                    placeholder="Tìm mã, tên hoặc danh mục..."
                    aria-label="Tìm quyền trong danh mục"
                    className="h-10 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-sm outline-none focus:border-blue-400"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setRoleError("");
                    setIsAddRoleDialogOpen(true);
                  }}
                  className="flex h-10 items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 text-sm font-semibold text-blue-700 hover:bg-blue-100"
                >
                  <CirclePlus size={17} />
                  Thêm role
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCatalogError("");
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
              <div className="mt-4 space-y-3">
                {[...catalogPermissionsByCategory].map(([category, categoryPermissions]) => (
                  <details key={category} open={Boolean(catalogSearch.trim())} className="group rounded-xl border border-slate-200">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-3 hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
                      <span className="flex min-w-0 items-center gap-2.5">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-700">
                          <ShieldCheck size={17} />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-semibold text-slate-800">{category}</span>
                          <span className="block text-xs text-slate-500">{categoryPermissions.length} quyền</span>
                        </span>
                      </span>
                      <ChevronDown size={18} className="shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="grid gap-2 border-t border-slate-100 p-3 sm:grid-cols-2 xl:grid-cols-3">
                      {categoryPermissions.map((permission) => {
                        const assignedRoles = rolePermissionGroups
                          .filter((group) => group.permissions.some((item) =>
                            item.code === permission.code && item.granted,
                          ))
                          .map((group) => roles.find((role) => role.code === group.roleCode)?.name ?? group.roleCode);
                        return (
                          <article key={permission.code} className="min-w-0 rounded-lg border border-slate-200 bg-white p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <h4 className="truncate text-sm font-semibold text-slate-900" title={permission.name}>{permission.name}</h4>
                                <p className="mt-1 break-all text-xs tracking-wide text-slate-500">{permission.code}</p>
                              </div>
                              <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-semibold ${
                                assignedRoles.length ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-800"
                              }`}>
                                {assignedRoles.length ? `${assignedRoles.length} role` : "Chưa gán"}
                              </span>
                            </div>
                            {permission.description && <p className="mt-2 line-clamp-2 text-sm leading-5 text-slate-600" title={permission.description}>{permission.description}</p>}
                            {assignedRoles.length > 0 && (
                              <p className="mt-2 truncate text-xs text-slate-500" title={assignedRoles.join(", ")}>
                                {assignedRoles.join(", ")}
                              </p>
                            )}
                          </article>
                        );
                      })}
                    </div>
                  </details>
                ))}
                {filteredCatalogPermissions.length === 0 && (
                  <p className="rounded-lg border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
                    Không tìm thấy quyền phù hợp.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {activeStep === "catalog" && (
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
              <form onSubmit={(event) => void createPermission(event)}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm font-semibold text-slate-700">
                    Mã quyền
                    <input
                      required
                      value={permissionCode}
                      onChange={(event) => setPermissionCode(event.target.value)}
                      placeholder="VIEW_SPECIAL_REPORT"
                      autoComplete="off"
                      className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 font-mono text-sm font-normal outline-none focus:border-blue-400"
                    />
                  </label>
                  <label className="block text-sm font-semibold text-slate-700">
                    Tên quyền
                    <input
                      required
                      value={permissionName}
                      onChange={(event) => setPermissionName(event.target.value)}
                      placeholder="Xem báo cáo đặc biệt"
                      className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none focus:border-blue-400"
                    />
                  </label>
                </div>
                <label className="mt-3 block text-sm font-semibold text-slate-700">
                  Danh mục
                  <input
                    required
                    value={permissionCategory}
                    onChange={(event) => setPermissionCategory(event.target.value)}
                    placeholder="Ví dụ: Đặt phòng, Khách hàng, Báo cáo"
                    className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none focus:border-blue-400"
                  />
                </label>
                <label className="mt-3 block text-sm font-semibold text-slate-700">
                  Mô tả
                  <textarea
                    value={permissionDescription}
                    onChange={(event) => setPermissionDescription(event.target.value)}
                    rows={3}
                    placeholder="Mô tả chức năng mà quyền này cho phép"
                    className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal outline-none focus:border-blue-400"
                  />
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

      {activeStep === "catalog" && (
        <div className="p-4 pt-0 sm:p-5 sm:pt-0">
          <div className="rounded-xl border border-slate-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-slate-900">Các role hiện có</h3>
                <p className="mt-1 text-sm text-slate-500">{roles.length} role trong hệ thống</p>
              </div>
            </div>
            {isRolesLoading ? <p className="mt-3 text-sm text-slate-500">Đang tải role...</p> : (
            <div className="mt-3 divide-y divide-slate-100">
              {roles.map((role) => (
                <div key={role.code} className="py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-slate-800">{role.name}</p>
                    {role.system && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">Hệ thống</span>}
                  </div>
                  <p className="mt-1 font-mono text-xs text-slate-500">{role.code}</p>
                  {role.description && <p className="mt-1 text-sm text-slate-500">{role.description}</p>}
                </div>
              ))}
            </div>
            )}
            <button
              type="button"
              onClick={() => navigateToStep("permissions")}
              disabled={roles.length === 0}
              className="mt-3 text-sm font-semibold text-blue-700 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
            >
              Tiếp tục nhập quyền bằng Excel →
            </button>
            {roles.length === 0 && (
              <p className="mt-2 text-xs text-amber-700">Cần có ít nhất một role trước khi nhập phân quyền.</p>
            )}
          </div>
        </div>
      )}

      {activeStep === "catalog" && (
        <Dialog open={isAddRoleDialogOpen} onOpenChange={setIsAddRoleDialogOpen}>
          <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Thêm role</DialogTitle>
              <DialogDescription>
                Tạo role mới trước, sau đó bạn có thể gán quyền cho role ở tab Gán quyền.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={(event) => void createRole(event)}>
              <label className="block text-sm font-semibold text-slate-700">
                Mã role
                <input
                  required
                  value={roleCode}
                  onChange={(event) => setRoleCode(event.target.value)}
                  placeholder="ROLE_RECEPTIONIST"
                  autoComplete="off"
                  className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 font-mono text-sm font-normal outline-none focus:border-blue-400"
                />
              </label>
              <label className="mt-3 block text-sm font-semibold text-slate-700">
                Tên role
                <input
                  required
                  value={roleName}
                  onChange={(event) => setRoleName(event.target.value)}
                  placeholder="Lễ tân"
                  className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none focus:border-blue-400"
                />
              </label>
              <label className="mt-3 block text-sm font-semibold text-slate-700">
                Mô tả
                <textarea
                  value={roleDescription}
                  onChange={(event) => setRoleDescription(event.target.value)}
                  rows={3}
                  placeholder="Mô tả trách nhiệm của role"
                  className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal outline-none focus:border-blue-400"
                />
              </label>
              {roleError && <p role="alert" className="mt-3 text-sm text-rose-600">{roleError}</p>}
              <button
                type="submit"
                disabled={isCreatingRole || isRolesLoading || isRolesError}
                className="mt-4 flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <Plus size={16} />
                {isCreatingRole ? "Đang tạo..." : "Tạo role"}
              </button>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {activeStep === "permissions" && (
        <div className="space-y-5 p-4 sm:p-5">
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
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-slate-800">{permission.name}</p>
                                <p className="mt-1 break-all font-mono text-[11px] text-slate-500">{permission.code}</p>
                                {permission.description && (
                                  <p className="mt-1 text-xs leading-5 text-slate-500">{permission.description}</p>
                                )}
                              </div>
                              <button
                                type="button"
                                disabled={!selectedAssignmentRoleCode || isUpdatingAssignment}
                                onClick={() => void toggleRolePermission(selectedAssignmentRoleCode, permission)}
                                aria-pressed={permission.granted}
                                className={`shrink-0 rounded-md px-2.5 py-1.5 text-xs font-semibold transition disabled:cursor-wait disabled:opacity-50 ${
                                  permission.granted
                                    ? "bg-white text-rose-700 hover:bg-rose-100"
                                    : "bg-blue-600 text-white hover:bg-blue-700"
                                }`}
                              >
                                {updatingAssignment === `${selectedAssignmentRoleCode}:${permission.code}`
                                  ? "Đang lưu..."
                                  : permission.granted
                                    ? "Đã gán · Gỡ"
                                    : "Gán quyền"}
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
                      <td className="px-2 py-2">Có</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-500">
                Chọn role bằng dropdown. Mã, tên, mô tả và danh mục quyền được nhập thủ công. Có thể dùng Có/Không,
                Yes/No hoặc True/False. Một quyền được cấp khi giá trị là Có;
                dòng Không sẽ bỏ quyền đó khỏi role.
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

      {activeStep === "overview" && (
        <div className="p-4 sm:p-5">
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
                <label className="relative block min-w-0 flex-1 sm:max-w-sm">
                  <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="search"
                    value={overviewSearch}
                    onChange={(event) => setOverviewSearch(event.target.value)}
                    placeholder="Tìm role hoặc quyền..."
                    aria-label="Tìm role hoặc quyền"
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-blue-400"
                  />
                </label>
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
                                        onClick={() => void toggleRolePermission(role.code, permission)}
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
                  <p className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
                    Không tìm thấy role hoặc quyền phù hợp.
                  </p>
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
