import { useMemo, useState } from "react";
import { AlertCircle, Check, ChevronDown, ChevronRight, KeyRound, Layers3, LoaderCircle, LockKeyhole, RefreshCw, Search, ShieldCheck, UsersRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { localizedText } from "../i18n";
import ClearSearchButton from "../components/ClearSearchButton";
import FilterResultStatus from "../components/FilterResultStatus";
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
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(() => new Set());
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

  const branchRoles = roles.filter((role) => role.code.trim().toLocaleUpperCase() !== "ROLE_SUPER_ADMIN");
  const selectedRole = branchRoles.find((role) => role.code === selectedRoleCode) ?? branchRoles[0];
  const assignedPermissions = rolePermissionGroups
    .find((group) => group.roleCode === selectedRole?.code)
    ?.permissions.filter((permission) => permission.granted) ?? [];
  const assignedCategoryCount = new Set(assignedPermissions.map((permission) => categoryOf(permission.category))).size;
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
      <header className="border-b border-slate-100 bg-white p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-blue-100 bg-blue-50 text-blue-700">
            <ShieldCheck size={19} />
          </span>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">{localizedText("Quản trị truy cập", "Access management")}</p>
            <h3 className="mt-1 text-lg font-bold text-slate-900">{localizedText("Quyền theo vai trò", "Permissions by role")}</h3>
            <p className="mt-1 max-w-2xl text-sm text-slate-500">
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
          className="inline-flex w-fit items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
        >
          <RefreshCw size={15} className={isLoading ? "animate-spin" : ""} />
          {localizedText("Làm mới", "Refresh")}
        </button>
        </div>
      </header>

      {!isLoading && !isError && roles.length > 0 && (
        <div className="border-b border-slate-100 bg-gradient-to-b from-slate-50 to-white p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-slate-800">{localizedText("Chọn vai trò", "Select a role")}</p>
              <p className="mt-0.5 text-xs text-slate-500">{localizedText("Chọn vai trò để xem các quyền đã được cấp.", "Choose a role to view its assigned permissions.")}</p>
            </div>
            <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
              {branchRoles.length} {localizedText("vai trò", "roles")}
            </span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4" role="tablist" aria-label={localizedText("Vai trò", "Roles")}>
            {branchRoles.map((role) => {
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
                  className={`flex min-w-0 items-center gap-3 rounded-xl border p-3 text-left transition ${
                    isSelected
                      ? "border-blue-300 bg-blue-50 text-blue-800 shadow-sm ring-2 ring-blue-100"
                      : "border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:bg-blue-50/50"
                  }`}
                >
                  <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-sm font-bold ${isSelected ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"}`}>
                    {role.name.trim().charAt(0).toLocaleUpperCase()}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold">{role.name}</span>
                    <span className="mt-0.5 block truncate text-[10px] opacity-70">{role.code}</span>
                  </span>
                  {isSelected && <Check size={16} className="ml-auto shrink-0 text-blue-600" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {!isLoading && !isError && selectedRole && (
        <div className="grid gap-3 border-b border-slate-100 bg-white p-4 sm:grid-cols-3 sm:p-5">
          <SummaryCard icon={UsersRound} label={localizedText("Vai trò", "Roles")} value={String(branchRoles.length)} tone="violet" />
          <SummaryCard icon={KeyRound} label={localizedText("Quyền được cấp", "Assigned permissions")} value={String(assignedPermissions.length)} tone="blue" />
          <SummaryCard icon={Layers3} label={localizedText("Danh mục quyền", "Permission categories")} value={String(assignedCategoryCount)} tone="emerald" />
        </div>
      )}

      <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/50 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="relative flex h-11 w-full max-w-xl items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3.5 text-slate-400 shadow-sm transition focus-within:border-blue-400 focus-within:ring-4 focus-within:ring-blue-50">
          <Search size={17} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={localizedText("Tìm quyền trong vai trò đang chọn...", "Search permissions in the selected role...")}
            aria-label={localizedText("Tìm quyền", "Search permissions")}
            className="w-full bg-transparent pr-7 text-sm text-slate-700 outline-none placeholder:text-slate-400"
          />
          <ClearSearchButton value={search} onClear={() => setSearch("")} label={localizedText("Xóa tìm kiếm", "Clear search")} />
        </div>
        {selectedRole && (
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
            <Check size={14} />
            {permissionCategories.reduce((total, category) => total + category.permissions.length, 0)} {localizedText("quyền phù hợp", "matching permissions")}
          </span>
        )}
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
            className="bg-slate-50/60 p-4 sm:p-5"
          >
              <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-blue-100 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5">
                <div className="flex items-center gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700">
                    <ShieldCheck size={21} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-blue-600">{localizedText("Đang xem quyền của", "Viewing permissions for")}</p>
                    <h4 className="mt-0.5 truncate text-lg font-bold text-slate-900">{selectedRole.name}</h4>
                    {selectedRole.description && <p className="mt-0.5 text-sm text-slate-500">{selectedRole.description}</p>}
                  </div>
                </div>
                <span className="w-fit rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600">{selectedRole.code}</span>
              </div>
              {permissionCategories.length === 0 ? (
                <FilterResultStatus filterKey={JSON.stringify([search, selectedRole.code])}><div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-10 text-center">
                  <KeyRound size={25} className="mx-auto text-slate-300" />
                  <span className="mt-2 block text-sm font-medium text-slate-500">
                    {search.trim()
                      ? localizedText("Không tìm thấy quyền phù hợp trong vai trò này.", "No matching permissions in this role.")
                      : localizedText("Chưa có quyền được cấp.", "No permissions assigned.")}
                  </span>
                </div></FilterResultStatus>
              ) : (
                <div className="grid gap-3 xl:grid-cols-2">
                  {permissionCategories.map(({ category, permissions }, index) => {
                    const categoryKey = `${selectedRole.code}:${category}`;
                    const isExpanded = expandedCategories.has(categoryKey);
                    const contentId = `permission-category-${selectedRole.code}-${index}`;
                    return (
                    <section key={category} className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:border-blue-200 hover:shadow-md">
                      <button
                        type="button"
                        aria-expanded={isExpanded}
                        aria-controls={contentId}
                        onClick={() => setExpandedCategories((current) => {
                          const next = new Set(current);
                          if (next.has(categoryKey)) next.delete(categoryKey);
                          else next.add(categoryKey);
                          return next;
                        })}
                        className={`flex w-full items-center justify-between gap-3 px-4 py-4 text-left transition ${isExpanded ? "bg-blue-50/70" : "hover:bg-slate-50"}`}
                      >
                        <span className="flex min-w-0 items-center gap-3">
                          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${isExpanded ? "bg-blue-600 text-white" : "bg-blue-50 text-blue-600"}`}>
                            <Layers3 size={17} />
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-bold text-slate-800">{category}</span>
                            <span className="mt-0.5 block text-xs text-slate-500">{permissions.length} {localizedText("quyền đã cấp", "assigned permissions")}</span>
                          </span>
                        </span>
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm">
                          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </span>
                      </button>
                      {isExpanded && (
                        <div id={contentId} className="grid gap-2 border-t border-slate-100 p-3 sm:grid-cols-2">
                          {permissions.map((permission) => (
                            <div key={permission.code} title={permission.description || permission.code} className="flex min-w-0 items-start gap-2.5 rounded-xl border border-emerald-100/80 bg-gradient-to-br from-emerald-50/70 to-white p-3">
                              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-700">
                                <Check size={12} />
                              </span>
                              <span className="min-w-0">
                                <span className="block text-xs font-semibold leading-5 text-slate-700">{permission.name}</span>
                                {permission.description && <span className="mt-0.5 line-clamp-2 block text-[11px] leading-4 text-slate-500">{permission.description}</span>}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </section>
                    );
                  })}
                </div>
              )}
          </article>
        ) : (
          <p className="p-10 text-center text-sm text-slate-500">
            {localizedText("Chưa có vai trò để hiển thị.", "There are no roles to display.")}
          </p>
        )
      )}
      <footer className="flex items-center gap-2 border-t border-slate-100 bg-white px-5 py-4 text-xs text-slate-500">
        <LockKeyhole size={14} />
        {localizedText("Quản lý không thể thêm, xóa hoặc sửa quyền tại màn hình này.", "Managers cannot add, remove, or edit permissions here.")}
      </footer>
    </section>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  tone: "violet" | "blue" | "emerald";
}) {
  const styles = {
    violet: "border-violet-100 bg-violet-50/60 text-violet-700",
    blue: "border-blue-100 bg-blue-50/60 text-blue-700",
    emerald: "border-emerald-100 bg-emerald-50/60 text-emerald-700",
  };

  return (
    <div className={`flex items-center gap-3 rounded-2xl border p-3.5 ${styles[tone]}`}>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white shadow-sm">
        <Icon size={18} />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-xs font-medium opacity-80">{label}</span>
        <span className="mt-0.5 block text-xl font-bold leading-none">{value}</span>
      </span>
    </div>
  );
}

function matchesPermission(permission: SuperAdminPermissionAssignment, query: string) {
  return [permission.code, permission.name, permission.category, permission.description]
    .some((value) => value?.toLocaleLowerCase().includes(query));
}
