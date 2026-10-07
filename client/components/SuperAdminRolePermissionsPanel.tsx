import { useRef, useState } from "react";
import {
  Check,
  FileSpreadsheet,
  LayoutDashboard,
  LockKeyhole,
  Plus,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { createXlsxWorkbook, downloadFile } from "../lib/bulkImportFiles";
import { parseSuperAdminRolePermissionsFile } from "../lib/superAdminRolePermissionsImport";
import {
  useCreateSuperAdminRoleMutation,
  useGetSuperAdminRolePermissionsQuery,
  useGetSuperAdminRolesQuery,
  useAddSuperAdminPermissionToRoleMutation,
  useImportSuperAdminRolePermissionsMutation,
  useRemoveSuperAdminPermissionFromRoleMutation,
  type SuperAdminPermissionAssignment,
  type SuperAdminRole,
} from "../services/superAdminApi";

type WorkflowStep = "roles" | "permissions" | "overview";

const PERMISSION_HEADERS = ["Role", "Mã quyền", "Tên quyền", "Mô tả quyền", "Cấp quyền (Có/Không)"];

const normalizeCode = (value: string) => value.trim().toLocaleUpperCase();

const downloadPermissionTemplate = (roles: SuperAdminRole[]) => {
  const rows: Array<Array<string | number>> = [
    PERMISSION_HEADERS,
    ...Array.from({ length: 10 }, () => ["", "", "", "", "Có"]),
  ];
  const workbook = createXlsxWorkbook([
    {
      name: "Phân quyền",
      rows,
      validations: [
        { range: "A2:A1000", type: "list", formula1: "=RoleList" },
        { range: "E2:E1000", type: "list", formula1: '"Có,Không"' },
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
        ["Nhập tay Mã quyền, Tên quyền và Mô tả quyền. Mỗi dòng là một quyền của một role."],
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
  const [createRoleRequest, { isLoading: isCreatingRole }] = useCreateSuperAdminRoleMutation();
  const [importRolePermissionsRequest, { isLoading: isSavingPermissions }] =
    useImportSuperAdminRolePermissionsMutation();
  const [addPermissionToRole, { isLoading: isAddingPermission }] =
    useAddSuperAdminPermissionToRoleMutation();
  const [removePermissionFromRole, { isLoading: isRemovingPermission }] =
    useRemoveSuperAdminPermissionFromRoleMutation();
  const [activeStep, setActiveStep] = useState<WorkflowStep>("roles");
  const [roleCode, setRoleCode] = useState("");
  const [roleName, setRoleName] = useState("");
  const [roleDescription, setRoleDescription] = useState("");
  const [roleError, setRoleError] = useState("");
  const [importError, setImportError] = useState("");
  const [importMessage, setImportMessage] = useState("");
  const [permissionActionError, setPermissionActionError] = useState("");
  const [updatingAssignment, setUpdatingAssignment] = useState<string | null>(null);
  const [isReadingFile, setIsReadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasCreatedRole = roles.some((role) => !role.system);
  const isImporting = isReadingFile || isSavingPermissions;
  const isUpdatingAssignment = isAddingPermission || isRemovingPermission;
  const permissionByCode = new Map<string, SuperAdminPermissionAssignment>();
  rolePermissionGroups.forEach((group) =>
    group.permissions.forEach((permission) => permissionByCode.set(permission.code, permission)),
  );
  const permissions = [...permissionByCode.values()];

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
      setActiveStep("permissions");
    } catch (error) {
      setRoleError(getErrorMessage(error, "Không thể tạo role. Vui lòng thử lại."));
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
    if (step !== "roles" && !hasCreatedRole) {
      setRoleError("Hãy tạo ít nhất một role trước khi nhập quyền hoặc xem tổng quan.");
      setActiveStep("roles");
      return;
    }
    setRoleError("");
    setActiveStep(step);
  };

  return (
    <section className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="border-b border-slate-100 p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <ShieldCheck size={19} className="text-blue-600" />
          <h2 className="text-lg font-bold text-slate-900">Cấu hình role và phân quyền</h2>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Tạo role thủ công, nhập quyền bằng Excel, sau đó xem bản tổng quan.
        </p>
      </header>

      <div className="m-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 sm:m-5">
        <LockKeyhole size={17} className="mt-0.5 shrink-0 text-amber-700" />
        <p className="text-sm leading-6 text-amber-900">
          Tạo role và nạp quyền sẽ được gửi lên backend. Nếu API chưa được triển khai ở server,
          hệ thống sẽ hiển thị lỗi và không giả lập lưu thành công.
          {" "}Các API đang dùng: <code>GET/POST /role_permissions/roles</code>,{" "}
          <code>GET /role_permissions/roles/permissions</code>,{" "}
          <code>POST /role_permissions/roles/permissions/import</code>, và POST/DELETE tại{" "}
          <code>/role_permissions/roles/{"{roleCode}"}/permissions/{"{permissionCode}"}</code>.
        </p>
      </div>
      {(isRolesError || isRolePermissionsError) && (
        <div role="alert" className="mx-4 mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 sm:mx-5">
          <p>Không thể tải role hoặc cấu hình quyền từ backend.</p>
          <div className="mt-2 flex gap-3 font-semibold">
            {isRolesError && <button type="button" onClick={() => void refetchRoles()}>Tải lại role</button>}
            {isRolePermissionsError && <button type="button" onClick={() => void refetchRolePermissions()}>Tải lại quyền</button>}
          </div>
        </div>
      )}

      <nav className="grid grid-cols-1 gap-2 px-4 sm:grid-cols-3 sm:px-5" aria-label="Các bước cấu hình role">
        {([
          ["roles", "1. Tạo role", Plus],
          ["permissions", "2. Nhập quyền Excel", FileSpreadsheet],
          ["overview", "3. Tổng quan", LayoutDashboard],
        ] as const).map(([step, label, Icon]) => (
          <button
            key={step}
            type="button"
            onClick={() => navigateToStep(step)}
            disabled={step !== "roles" && !hasCreatedRole}
            aria-current={activeStep === step ? "step" : undefined}
            className={`flex items-center gap-2 rounded-lg px-3 py-3 text-sm font-semibold ${
              activeStep === step ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            } disabled:cursor-not-allowed disabled:opacity-50`}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </nav>

      {activeStep === "roles" && (
        <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <form onSubmit={(event) => void createRole(event)} className="h-fit rounded-xl border border-slate-200 p-4">
            <h3 className="font-bold text-slate-900">Tạo role thủ công</h3>
            <label className="mt-4 block text-sm font-semibold text-slate-700">
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
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none focus:border-blue-400"
              />
            </label>
            <label className="mt-3 block text-sm font-semibold text-slate-700">
              Mô tả
              <textarea
                value={roleDescription}
                onChange={(event) => setRoleDescription(event.target.value)}
                rows={3}
                placeholder="Mô tả trách nhiệm của role"
                className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 font-normal outline-none focus:border-blue-400"
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

          <div className="rounded-xl border border-slate-200 p-4">
            <h3 className="font-bold text-slate-900">Các role hiện có <span className="text-sm font-medium text-slate-500">({roles.length})</span></h3>
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
              disabled={!hasCreatedRole}
              className="mt-3 text-sm font-semibold text-blue-700 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
            >
              Tiếp tục nhập quyền bằng Excel →
            </button>
            {!hasCreatedRole && (
              <p className="mt-2 text-xs text-amber-700">Tạo ít nhất một role mới để mở bước nhập quyền.</p>
            )}
          </div>
        </div>
      )}

      {activeStep === "permissions" && (
        <div className="p-4 sm:p-5">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-center gap-2">
                <FileSpreadsheet size={18} className="text-emerald-700" />
                <h3 className="font-bold text-slate-900">Nhập quyền từ Excel</h3>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Tạo role trước rồi tải file mẫu. Danh sách role được đưa vào sheet riêng và cột Role
                có danh sách thả xuống; bạn tự nhập mã, tên và mô tả quyền.
              </p>
              <button
                type="button"
                onClick={() => downloadPermissionTemplate(roles)}
                disabled={!hasCreatedRole}
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
                  disabled={!hasCreatedRole || isImporting}
                  onChange={(event) => void importPermissions(event.currentTarget.files?.[0])}
                  className="mt-1.5 block w-full rounded-lg border border-slate-200 p-2 text-sm font-normal file:mr-3 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:font-semibold file:text-blue-700"
                />
              </label>
              {!hasCreatedRole && (
                <p className="mt-3 text-sm text-amber-700">Hãy tạo role trước để tạo file Excel có danh sách role.</p>
              )}
              {isImporting && <p role="status" className="mt-3 text-sm text-blue-700">Đang đọc file phân quyền...</p>}
              {importError && <p role="alert" className="mt-3 text-sm text-rose-600">{importError}</p>}
              {importMessage && <p role="status" className="mt-3 text-sm text-emerald-700">{importMessage}</p>}
              <button
                type="button"
                onClick={() => navigateToStep("overview")}
                disabled={!hasCreatedRole}
                className="mt-4 flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
              >
                <Upload size={16} />
                Xem bản tổng quan
              </button>
            </div>

            <div className="rounded-xl border border-slate-200 p-4">
              <h3 className="font-bold text-slate-900">Định dạng file Excel</h3>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-xs">
                  <thead className="bg-slate-50 font-bold text-slate-600">
                    <tr>{PERMISSION_HEADERS.map((header) => <th key={header} className="px-2 py-2">{header}</th>)}</tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-slate-100 text-slate-600">
                      <td className="px-2 py-2">Chọn từ danh sách</td>
                      <td className="px-2 py-2">BOOKING_VIEW</td>
                      <td className="px-2 py-2">Xem đặt phòng</td>
                      <td className="px-2 py-2">Xem danh sách đặt phòng</td>
                      <td className="px-2 py-2">Có</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-500">
                Chọn role bằng dropdown. Mã, tên và mô tả quyền được nhập thủ công. Có thể dùng Có/Không,
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
              onClick={() => navigateToStep("roles")}
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
                disabled={!hasCreatedRole}
                className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Nhập quyền Excel
              </button>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {permissionActionError && (
                <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                  {permissionActionError}
                </p>
              )}
              {roles.map((role) => {
                const assignedPermissions = rolePermissionGroups.find((group) => group.roleCode === role.code)?.permissions ?? [];
                return (
                  <article key={role.code} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-bold text-slate-900">{role.name}</h4>
                          {role.system && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">Hệ thống</span>}
                        </div>
                        <p className="mt-1 font-mono text-xs text-slate-500">{role.code}</p>
                        {role.description && <p className="mt-1 text-sm text-slate-500">{role.description}</p>}
                      </div>
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                        {assignedPermissions.filter((permission) => permission.granted).length} quyền được cấp
                      </span>
                    </div>
                    {assignedPermissions.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {assignedPermissions.map((permission) => (
                          <span
                            key={permission.code}
                            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs ${
                              permission.granted ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {permission.granted && <Check size={13} className="text-emerald-600" />}
                            <span className="font-semibold">{permission.name}</span>
                            <span className="font-mono text-slate-500">({permission.code})</span>
                            {permission.description && <span className="hidden text-slate-500 sm:inline">— {permission.description}</span>}
                            <button
                              type="button"
                              disabled={isUpdatingAssignment}
                              onClick={() => void toggleRolePermission(role.code, permission)}
                              className={`ml-1 rounded-md px-2 py-1 font-semibold transition disabled:cursor-wait disabled:opacity-50 ${
                                permission.granted
                                  ? "bg-rose-100 text-rose-700 hover:bg-rose-200"
                                  : "bg-blue-100 text-blue-700 hover:bg-blue-200"
                              }`}
                            >
                              {updatingAssignment === `${role.code}:${permission.code}`
                                ? "Đang lưu..."
                                : permission.granted
                                  ? "Gỡ quyền"
                                  : "Gán quyền"}
                            </button>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-slate-500">Chưa được gán quyền nào.</p>
                    )}
                  </article>
                );
              })}
            </div>
          )}
          <button
            type="button"
            onClick={() => setActiveStep("permissions")}
            disabled={!hasCreatedRole}
            className="mt-4 text-sm font-semibold text-blue-700 hover:underline"
          >
            Nhập hoặc cập nhật quyền từ Excel →
          </button>
        </div>
      )}
    </section>
  );
}
