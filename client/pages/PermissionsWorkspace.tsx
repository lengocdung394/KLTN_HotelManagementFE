import { useMemo, useState } from "react";
import { AlertCircle, Check, LoaderCircle, LockKeyhole, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { localizedText } from "../i18n";
import {
  useGetSuperAdminRolePermissionsQuery,
  useGetSuperAdminRolesQuery,
  type SuperAdminPermissionAssignment,
} from "../services/superAdminApi";

const getErrorMessage = (error: unknown) => {
  if (!error || typeof error !== "object") {
    return localizedText("Đã xảy ra lỗi. Vui lòng thử lại.", "Something went wrong. Please try again.");
  }
  const apiError = error as { data?: { message?: string }; message?: string; error?: string };
  return apiError.data?.message
    ?? apiError.message
    ?? apiError.error
    ?? localizedText("Đã xảy ra lỗi. Vui lòng thử lại.", "Something went wrong. Please try again.");
};

const categoryOf = (category?: string) =>
  category?.trim() || localizedText("Chưa phân loại", "Uncategorized");

export default function PermissionsWorkspace() {
  const [search, setSearch] = useState("");
  const [selectedRoleCode, setSelectedRoleCode] = useState("");
  const {
    data: roles = [],
    isLoading: isRolesLoading,
    isError: isRolesError,
    error: rolesError,
    refetch: refetchRoles,
  } = useGetSuperAdminRolesQuery();
  const {
    data: rolePermissionGroups = [],
    isLoading: isPermissionsLoading,
    isError: isPermissionsError,
    error: permissionsError,
    refetch: refetchPermissions,
  } = useGetSuperAdminRolePermissionsQuery();
  const isLoading = isRolesLoading || isPermissionsLoading;
  const isError = isRolesError || isPermissionsError;
  const error = isRolesError ? rolesError : permissionsError;

  const selectedRole = roles.find((role) => role.code === selectedRoleCode) ?? roles[0];
  const permissionCategories = useMemo(() => {
    if (!selectedRole) return [];
    const query = search.trim().toLocaleLowerCase();
    const permissions = rolePermissionGroups.find((group) => group.roleCode === selectedRole.code)?.permissions ?? [];
    const visiblePermissions = permissions
      .filter((permission) => permission.granted)
      .filter((permission) => !query || matchesPermission(permission, query));
    const permissionsByCategory = new Map<string, SuperAdminPermissionAssignment[]>();
    visiblePermissions.forEach((permission) => {
      const category = categoryOf(permission.category);
      const categoryPermissions = permissionsByCategory.get(category) ?? [];
      categoryPermissions.push(permission);
      permissionsByCategory.set(category, categoryPermissions);
    });
    return [...permissionsByCategory.entries()]
      .sort(([left], [right]) => left.localeCompare(right, "vi"))
      .map(([category, categoryPermissions]) => ({
        category,
        permissions: categoryPermissions.sort((left, right) => left.name.localeCompare(right.name, "vi")),
      }));
  }, [selectedRole, rolePermissionGroups, search]);

  const refresh = () => {
    void refetchRoles();
    void refetchPermissions();
  };

  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-col gap-4 border-b border-slate-100 bg-slate-50/70 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-100 text-blue-700">
            <ShieldCheck size={19} />
          </span>
          <div>
            <h3 className="font-bold text-slate-900">{localizedText("Quyền theo vai trò", "Permissions by role")}</h3>
            <p className="mt-1 text-sm text-slate-500">
              {localizedText(
                "Chỉ xem quyền đang được cấp. Mọi thay đổi do Super Admin quản lý.",
                "View assigned permissions only. Changes are managed by the Super Admin.",
              )}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={isLoading}
          className="inline-flex w-fit items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
        >
          <RefreshCw size={15} className={isLoading ? "animate-spin" : ""} />
          {localizedText("Làm mới", "Refresh")}
        </button>
      </header>

      {!isLoading && !isError && roles.length > 0 && (
        <div className="border-b border-slate-100 bg-slate-50/60 px-4 pt-3">
          <div className="flex flex-wrap gap-2" role="tablist" aria-label={localizedText("Vai trò", "Roles")}>
            {roles.map((role) => {
              const isSelected = role.code === selectedRole?.code;
              return (
                <button
                  key={role.code}
                  type="button"
                  role="tab"
                  id={`permission-role-tab-${role.code}`}
                  aria-selected={isSelected}
                  aria-controls="permission-role-panel"
                  onClick={() => setSelectedRoleCode(role.code)}
                  className={`rounded-t-lg border px-4 py-2 text-sm font-semibold transition ${
                    isSelected
                      ? "border-slate-200 border-b-white bg-white text-blue-700"
                      : "border-transparent text-slate-500 hover:border-slate-200 hover:bg-white hover:text-slate-800"
                  }`}
                >
                  {role.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="border-b border-slate-100 p-4">
        <label className="flex h-10 max-w-xl items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-slate-400">
          <Search size={16} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={localizedText("Tìm quyền trong vai trò đang chọn...", "Search permissions in the selected role...")}
            className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
          />
        </label>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 p-10 text-sm text-slate-500">
          <LoaderCircle size={18} className="animate-spin" />
          {localizedText("Đang tải cấu hình quyền...", "Loading permission configuration...")}
        </div>
      ) : isError ? (
        <div className="p-8 text-center">
          <AlertCircle size={22} className="mx-auto text-rose-500" />
          <p className="mt-3 text-sm font-semibold text-slate-800">
            {localizedText("Không tải được cấu hình quyền", "Could not load permissions")}
          </p>
          <p className="mt-1 text-sm text-slate-500">{getErrorMessage(error)}</p>
          <button type="button" onClick={refresh} className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
            {localizedText("Thử lại", "Try again")}
          </button>
        </div>
      ) : (
        selectedRole ? (
          <article
            id="permission-role-panel"
            role="tabpanel"
            aria-labelledby={`permission-role-tab-${selectedRole.code}`}
            className="p-5"
          >
              <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                <h4 className="font-semibold text-slate-900">{selectedRole.name}</h4>
                <span className="font-mono text-xs text-slate-500">{selectedRole.code}</span>
              </div>
              {selectedRole.description && <p className="mt-1 text-sm text-slate-500">{selectedRole.description}</p>}
              {permissionCategories.length === 0 ? (
                <div className="mt-4">
                  <span className="text-sm text-slate-400">
                    {search.trim()
                      ? localizedText("Không tìm thấy quyền phù hợp trong vai trò này.", "No matching permissions in this role.")
                      : localizedText("Chưa có quyền được cấp.", "No permissions assigned.")}
                  </span>
                </div>
              ) : (
                <div className="mt-4 space-y-4">
                  {permissionCategories.map(({ category, permissions }) => (
                    <section key={category} aria-label={category}>
                      <h5 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                        {category}
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                          {permissions.length}
                        </span>
                      </h5>
                      <div className="flex flex-wrap gap-2">
                        {permissions.map((permission) => (
                          <span key={permission.code} title={permission.description || permission.code} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-100 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-800">
                            <Check size={13} />
                            <span>{permission.name}</span>
                          </span>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              )}
          </article>
        ) : (
          <p className="p-10 text-center text-sm text-slate-500">
            {localizedText("Chưa có vai trò để hiển thị.", "There are no roles to display.")}
          </p>
        )
      )}
      <footer className="flex items-center gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3 text-xs text-slate-500">
        <LockKeyhole size={14} />
        {localizedText("Quản lý không thể thêm, xóa hoặc sửa quyền tại màn hình này.", "Managers cannot add, remove, or edit permissions here.")}
      </footer>
    </section>
  );
}

function matchesPermission(permission: SuperAdminPermissionAssignment, query: string) {
  return [permission.code, permission.name, permission.category, permission.description]
    .some((value) => value?.toLocaleLowerCase().includes(query));
}
