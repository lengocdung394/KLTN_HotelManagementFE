import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, Columns3, Eye, KeyRound, RefreshCw, RotateCcw, Search, Users, X } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import ClearSearchButton from "./ClearSearchButton";
import FilterResultStatus from "./FilterResultStatus";
import {
  useGetSuperAdminBranchesQuery,
  useGetSuperAdminAccountsQuery,
  useLazyGetSuperAdminAccountDetailsQuery,
  useLazyGetSuperAdminCustomerDetailsQuery,
  useRequestSuperAdminPasswordResetMutation,
  useUpdateSuperAdminAccountMutation,
  useUpdateSuperAdminCustomerMutation,
  type SuperAdminAccount,
  type SuperAdminAccountListType,
  type SuperAdminBranch,
} from "../services/superAdminApi";
import ListPagination from "./ListPagination";
import { localizedText } from "../i18n";

type AccountView = "all" | "staff" | "customers";
type AccountTypeFilter = "ALL" | SuperAdminAccount["accountType"];
const ACCOUNT_TABLE_COLUMNS = [
  { id: "name", label: "Họ và tên", width: 190 },
  { id: "type", label: "Loại tài khoản", width: 170 },
  { id: "email", label: "Email", width: 220 },
  { id: "phone", label: "Số điện thoại", width: 160 },
  { id: "branch", label: "Chi nhánh", width: 200 },
  { id: "actions", label: "Thao tác", width: 112 },
] as const;
type AccountTableColumnId = (typeof ACCOUNT_TABLE_COLUMNS)[number]["id"];
const accountColumnLabel = (id: AccountTableColumnId) => ({
  name: localizedText("Họ và tên", "Full name"),
  type: localizedText("Loại tài khoản", "Account type"),
  email: "Email",
  phone: localizedText("Số điện thoại", "Phone number"),
  branch: localizedText("Chi nhánh", "Branch"),
  actions: localizedText("Thao tác", "Actions"),
}[id]);

type Props = {
  view: AccountView;
};

type AccountForm = {
  email: string;
  fullName: string;
  phone: string;
  identityNumber: string;
  address: string;
  position: string;
  role: string;
};

const getDisplayAccountType = (account: SuperAdminAccount): SuperAdminAccount["accountType"] => {
  const roles = new Set(account.roles);
  if (roles.has("ROLE_SUPER_ADMIN")) return "SUPER_ADMIN";
  if (/super\s*admin/i.test(account.position ?? "")) return "SUPER_ADMIN";
  if (roles.has("ROLE_ADMIN")) return "ADMIN";
  if (/admin|quản trị/i.test(account.position ?? "")) return "ADMIN";
  if (roles.has("ROLE_MANAGER")) return "MANAGER";
  if (roles.has("ROLE_EMPLOYEE")) return "EMPLOYEE";
  if (roles.has("ROLE_CUSTOMER")) return "CUSTOMER";
  return account.accountType;
};

const getAccountTypeLabel = (account: SuperAdminAccount) => {
  switch (getDisplayAccountType(account)) {
    case "SUPER_ADMIN": return "Super Admin";
    case "ADMIN": return localizedText("Admin chi nhánh", "Branch admin");
    case "MANAGER": return localizedText("Quản lý", "Manager");
    case "EMPLOYEE": return localizedText("Nhân viên", "Employee");
    case "CUSTOMER": return localizedText("Khách hàng có tài khoản", "Registered customer");
    case "WALK_IN_CUSTOMER": return localizedText("Khách vãng lai", "Walk-in guest");
    default: return localizedText("Khác", "Other");
  }
};

const getAccountTypeBadgeClass = (account: SuperAdminAccount) => {
  switch (getDisplayAccountType(account)) {
    case "SUPER_ADMIN": return "bg-violet-50 text-violet-700";
    case "ADMIN":
    case "MANAGER":
    case "EMPLOYEE": return "bg-blue-50 text-blue-700";
    case "CUSTOMER": return "bg-emerald-50 text-emerald-700";
    case "WALK_IN_CUSTOMER": return "bg-amber-50 text-amber-800";
    default: return "bg-slate-100 text-slate-700";
  }
};

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error && typeof error === "object" && "data" in error) {
    const data = (error as { data?: unknown }).data;
    if (data && typeof data === "object" && "message" in data) {
      const message = (data as { message?: unknown }).message;
      if (typeof message === "string") return message;
    }
  }
  if (error instanceof Error) return error.message;
  return fallback;
};

const toAccountForm = (account: SuperAdminAccount): AccountForm => ({
  email: account.email ?? "",
  fullName: account.fullName ?? "",
  phone: account.phone ?? "",
  identityNumber: account.identityNumber ?? "",
  address: account.address ?? "",
  position: account.position ?? "",
  role: account.roles.find((role) => ["ROLE_ADMIN", "ROLE_MANAGER", "ROLE_EMPLOYEE"].includes(role)) ?? "",
});

const ALL_BRANCHES = "all";

export default function SuperAdminAccountManagementPanel({ view }: Props) {
  const accountType: SuperAdminAccountListType =
    view === "staff" ? "STAFF" : view === "customers" ? "CUSTOMERS" : "ALL";
  const {
    data: accounts = [],
    isLoading,
    isFetching,
    isError,
    error: listError,
    refetch,
  } = useGetSuperAdminAccountsQuery(accountType);
  const {
    data: branches = [],
    isError: isBranchesError,
    isLoading: isBranchesLoading,
  } = useGetSuperAdminBranchesQuery(undefined, { skip: view !== "staff" });
  const [getAccountDetails] = useLazyGetSuperAdminAccountDetailsQuery();
  const [getCustomerDetails] = useLazyGetSuperAdminCustomerDetailsQuery();
  const [updateAccount, { isLoading: isUpdatingAccount }] = useUpdateSuperAdminAccountMutation();
  const [updateCustomer, { isLoading: isUpdatingCustomer }] = useUpdateSuperAdminCustomerMutation();
  const [requestPasswordReset, { isLoading: isRequestingReset }] = useRequestSuperAdminPasswordResetMutation();
  const [search, setSearch] = useState("");
  const [accountTypeFilter, setAccountTypeFilter] = useState<AccountTypeFilter>("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [branchSearch, setBranchSearch] = useState("");
  const [branchFilter, setBranchFilter] = useState(ALL_BRANCHES);
  const [isBranchFilterOpen, setIsBranchFilterOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<SuperAdminAccount | null>(null);
  const [form, setForm] = useState<AccountForm | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [visibleColumns, setVisibleColumns] = useState<Record<AccountTableColumnId, boolean>>({
    name: true,
    type: true,
    email: true,
    phone: true,
    branch: true,
    actions: true,
  });
  const availableColumns = ACCOUNT_TABLE_COLUMNS.filter(
    (column) => view !== "customers" || column.id !== "branch",
  );
  const shownColumns = availableColumns.filter((column) => visibleColumns[column.id]);
  const tableWidth = shownColumns.reduce((total, column) => total + column.width, 0);

  const staffAccounts = useMemo(
    () => accounts.filter((account) => ["ADMIN", "MANAGER", "EMPLOYEE"].includes(getDisplayAccountType(account))),
    [accounts],
  );
  const accountsInView = view === "staff" ? staffAccounts : accounts;
  const branchFilteredAccounts = useMemo(
    () => accountsInView.filter((account) =>
      view !== "staff" || branchFilter === ALL_BRANCHES || String(account.hotelId) === branchFilter,
    ),
    [accountsInView, branchFilter, view],
  );
  const filteredAccounts = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();
    if (accountTypeFilter === "ALL" && !normalizedSearch) return branchFilteredAccounts;

    return branchFilteredAccounts.filter((account) => {
      if (accountTypeFilter !== "ALL" && getDisplayAccountType(account) !== accountTypeFilter) return false;
      if (!normalizedSearch) return true;
      return [
        account.fullName,
        account.email,
        account.phone,
        account.hotelName,
        account.accountId,
        account.profileId,
        getAccountTypeLabel(account),
      ].some((value) => value?.toLocaleLowerCase().includes(normalizedSearch));
    });
  }, [accountTypeFilter, branchFilteredAccounts, search]);
  const totalPages = Math.max(1, Math.ceil(filteredAccounts.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedAccounts = filteredAccounts.slice((safePage - 1) * pageSize, safePage * pageSize);

  useEffect(() => {
    setPage(1);
  }, [search, accountTypeFilter, branchFilter, view, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);
  const visibleBranches = useMemo(() => {
    const normalizedSearch = branchSearch.trim().toLocaleLowerCase();
    return branches.filter((branch) =>
      `${branch.name} ${branch.provinceName ?? ""}`.toLocaleLowerCase().includes(normalizedSearch),
    );
  }, [branches, branchSearch]);
  const selectedBranchName = branches.find((branch) => String(branch.id) === branchFilter)?.name;

  const title =
    view === "staff" ? localizedText("Tài khoản nhân sự", "Staff accounts")
      : view === "customers" ? localizedText("Tài khoản khách hàng", "Customer accounts")
        : localizedText("Tổng quan toàn bộ tài khoản", "All accounts overview");

  const openDetails = async (account: SuperAdminAccount) => {
    setIsLoadingDetails(true);
    setDetailError("");
    setActionError("");
    setActionMessage("");
    try {
      const details = account.accountType === "WALK_IN_CUSTOMER" || account.accountType === "CUSTOMER"
        ? await getCustomerDetails(account.profileId).unwrap()
        : account.accountId
          ? await getAccountDetails(account.accountId).unwrap()
          : account;
      setSelectedAccount(details);
      setForm(toAccountForm(details));
    } catch (error) {
      setDetailError(getErrorMessage(error, localizedText("Không thể tải chi tiết tài khoản.", "Could not load account details.")));
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const submitUpdate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedAccount || !form) return;
    const isStaff = ["ADMIN", "MANAGER", "EMPLOYEE"].includes(getDisplayAccountType(selectedAccount));
    const emailChanged = form.email.trim().toLowerCase() !== (selectedAccount.email ?? "").trim().toLowerCase();
    if (isStaff && emailChanged && !selectedAccount.accountId) {
      setActionError(localizedText(
        "Không thể gửi liên kết đặt lại vì tài khoản nhân viên chưa có mã tài khoản.",
        "Cannot send a reset link because this employee account has no account ID.",
      ));
      return;
    }
    setActionError("");
    setActionMessage("");
    try {
      const updated = selectedAccount.accountType === "WALK_IN_CUSTOMER" || selectedAccount.accountType === "CUSTOMER"
        ? await updateCustomer({
            customerId: selectedAccount.profileId,
            request: {
              name: form.fullName,
              phone: form.phone,
              email: form.email,
              identityNumber: form.identityNumber,
            },
          }).unwrap()
        : selectedAccount.accountId
          ? await updateAccount({
              accountId: selectedAccount.accountId,
              request: {
                email: form.email,
                fullName: form.fullName,
                phone: form.phone,
                address: form.address,
                position: form.position,
                role: selectedAccount.profileId !== selectedAccount.accountId && form.role
                  ? form.role as "ROLE_ADMIN" | "ROLE_MANAGER" | "ROLE_EMPLOYEE"
                  : undefined,
              },
            }).unwrap()
          : null;

      if (!updated) {
        setActionError(localizedText("Không xác định được tài khoản để cập nhật.", "Could not identify the account to update."));
        return;
      }
      setSelectedAccount(updated);
      setForm(toAccountForm(updated));
      setActionMessage(isStaff && emailChanged
        ? localizedText("Đã lưu thông tin và đổi email. Đang tạo mật khẩu mới và gửi đến email mới.", "Information and email saved. Generating a new password and sending it to the new email.")
        : localizedText("Cập nhật thông tin thành công.", "Information updated successfully."));
      if (isStaff && emailChanged && selectedAccount.accountId) {
        try {
          await requestPasswordReset(selectedAccount.accountId).unwrap();
          setActionMessage(localizedText(
            `Đã lưu thông tin và gửi mật khẩu mới đến ${form.email.trim()}.`,
            `Information saved and a new password was sent to ${form.email.trim()}.`,
          ));
        } catch (resetError) {
          setActionError(getErrorMessage(
            resetError,
            localizedText(
              "Email đã được đổi nhưng không gửi được mật khẩu mới. Vui lòng thử cấp lại mật khẩu.",
              "The email was updated, but the new password could not be sent. Please retry the password reset.",
            ),
          ));
        }
      }
      void refetch();
    } catch (error) {
      setActionError(getErrorMessage(error, localizedText("Không thể cập nhật thông tin tài khoản.", "Could not update the account information.")));
    }
  };

  const handlePasswordReset = async () => {
    if (!selectedAccount?.accountId) return;
    setActionError("");
    setActionMessage("");
    try {
      await requestPasswordReset(selectedAccount.accountId).unwrap();
      setActionMessage(localizedText(
        `Đã tạo mật khẩu mới và gửi đến ${selectedAccount.email}.`,
        `A new password was generated and sent to ${selectedAccount.email}.`,
      ));
    } catch (error) {
      setActionError(getErrorMessage(error, localizedText("Không thể cấp lại mật khẩu.", "Could not reset the password.")));
    }
  };

  const isCustomer = selectedAccount?.accountType === "CUSTOMER" || selectedAccount?.accountType === "WALK_IN_CUSTOMER";
  const isStaff = selectedAccount
    ? ["ADMIN", "MANAGER", "EMPLOYEE"].includes(getDisplayAccountType(selectedAccount))
    : false;
  const hasEmployeeProfile = Boolean(
    selectedAccount && !isCustomer && selectedAccount.profileId !== selectedAccount.accountId,
  );
  const canEdit = selectedAccount?.accountType !== "SUPER_ADMIN";
  const isSaving = isUpdatingAccount || isUpdatingCustomer;
  const isBusy = isLoading || isFetching;
  const hasAccountFilters = Boolean(
    search.trim()
    || accountTypeFilter !== "ALL"
    || (view === "staff" && branchFilter !== ALL_BRANCHES),
  );
  const accountTypeOptions: { value: AccountTypeFilter; label: string }[] = view === "staff"
    ? [
        { value: "ADMIN", label: localizedText("Admin chi nhánh", "Branch admin") },
        { value: "MANAGER", label: localizedText("Quản lý", "Manager") },
        { value: "EMPLOYEE", label: localizedText("Nhân viên", "Employee") },
      ]
    : view === "customers"
      ? [
          { value: "CUSTOMER", label: localizedText("Khách hàng có tài khoản", "Registered customer") },
          { value: "WALK_IN_CUSTOMER", label: localizedText("Khách vãng lai", "Walk-in guest") },
        ]
      : [
          { value: "SUPER_ADMIN", label: "Super Admin" },
          { value: "ADMIN", label: localizedText("Admin chi nhánh", "Branch admin") },
          { value: "MANAGER", label: localizedText("Quản lý", "Manager") },
          { value: "EMPLOYEE", label: localizedText("Nhân viên", "Employee") },
          { value: "CUSTOMER", label: localizedText("Khách hàng có tài khoản", "Registered customer") },
          { value: "WALK_IN_CUSTOMER", label: localizedText("Khách vãng lai", "Walk-in guest") },
          { value: "OTHER", label: localizedText("Khác", "Other") },
        ];

  return (
    <>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">{title}</h2>
            <p className="mt-1 max-w-3xl text-sm text-slate-500">
              {view === "staff"
                ? localizedText("Danh sách tài khoản admin chi nhánh, quản lý và nhân viên.", "Branch admin, manager, and employee accounts.")
                : view === "customers"
                  ? localizedText("Danh sách khách hàng đã đăng ký web và khách vãng lai chưa có tài khoản.", "Registered website customers and walk-in guests without accounts.")
                  : localizedText("Danh sách tài khoản nhân sự, khách hàng đăng ký web và khách vãng lai.", "Staff accounts, registered website customers, and walk-in guests.")}
              {" "}{localizedText("Thông tin mật khẩu và mã hóa mật khẩu không được hiển thị.", "Passwords and password hashes are not displayed.")}
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3">
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-slate-100 px-3 py-1.5 font-semibold text-slate-700">{localizedText("Tổng", "Total")}: {branchFilteredAccounts.length}</span>
            {view !== "customers" && (
              <>
                <span className="rounded-full bg-blue-50 px-3 py-1.5 font-semibold text-blue-700">
                  {localizedText("Nhân sự", "Staff")}: {branchFilteredAccounts.filter((account) => ["ADMIN", "MANAGER", "EMPLOYEE"].includes(getDisplayAccountType(account))).length}
                </span>
                {view === "all" && (
                  <span className="rounded-full bg-violet-50 px-3 py-1.5 font-semibold text-violet-700">
                    Super Admin: {accounts.filter((account) => getDisplayAccountType(account) === "SUPER_ADMIN").length}
                  </span>
                )}
              </>
            )}
            {view !== "staff" && (
              <>
                <span className="rounded-full bg-emerald-50 px-3 py-1.5 font-semibold text-emerald-700">
                  {localizedText("Đã đăng ký", "Registered")}: {accounts.filter((account) => getDisplayAccountType(account) === "CUSTOMER").length}
                </span>
                <span className="rounded-full bg-amber-50 px-3 py-1.5 font-semibold text-amber-800">
                  {localizedText("Vãng lai", "Walk-in")}: {accounts.filter((account) => getDisplayAccountType(account) === "WALK_IN_CUSTOMER").length}
                </span>
              </>
            )}
          </div>
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative block w-full sm:w-72 sm:flex-none">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={localizedText("Tìm tên, email, SĐT, mã hoặc chi nhánh", "Search name, email, phone, ID, or branch")}
                aria-label={localizedText("Tìm tài khoản", "Search accounts")}
                className="h-10 w-full rounded-lg border border-slate-200 pl-9 pr-10 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
              <ClearSearchButton value={search} onClear={() => setSearch("")} label={localizedText("Xóa tìm kiếm", "Clear search")} />
            </div>
          <div className="flex w-full flex-col gap-2 sm:w-full sm:flex-row sm:flex-wrap sm:items-center sm:justify-end lg:w-auto lg:flex-nowrap">
            <select
              value={accountTypeFilter}
              onChange={(event) => setAccountTypeFilter(event.target.value as AccountTypeFilter)}
              aria-label={localizedText("Lọc theo loại tài khoản", "Filter by account type")}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 sm:w-52 sm:flex-none"
            >
              <option value="ALL">{localizedText("Tất cả loại tài khoản", "All account types")}</option>
              {accountTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            {view === "staff" && (
              <Popover
                open={isBranchFilterOpen}
                onOpenChange={(open) => {
                  setIsBranchFilterOpen(open);
                  if (!open) setBranchSearch("");
                }}
              >
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    aria-label={localizedText("Lọc nhân sự theo chi nhánh", "Filter staff by branch")}
                    className="flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 text-left text-sm text-slate-700 outline-none hover:bg-slate-50 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 sm:w-56 sm:flex-none"
                  >
                    <span className="truncate">{selectedBranchName ?? localizedText("Tất cả chi nhánh", "All branches")}</span>
                    <ChevronDown size={15} className="shrink-0 text-slate-400" />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-[var(--radix-popover-trigger-width)] p-0">
                  <Command>
                    <CommandInput
                      placeholder={localizedText("Tìm chi nhánh...", "Search branches...")}
                      value={branchSearch}
                      onValueChange={setBranchSearch}
                    />
                    {isBranchesLoading && (
                      <p role="status" className="px-3 py-2 text-xs text-slate-500">
                        {localizedText("Đang tải danh sách chi nhánh...", "Loading branches...")}
                      </p>
                    )}
                    {isBranchesError && (
                      <p role="alert" className="px-3 py-2 text-xs text-rose-600">
                        {localizedText("Không thể tải danh sách chi nhánh.", "Could not load branches.")}
                      </p>
                    )}
                    <CommandList>
                      <CommandEmpty>{localizedText("Không tìm thấy chi nhánh.", "No branches found.")}</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value={localizedText("Tất cả chi nhánh", "All branches")}
                          onSelect={() => {
                            setBranchFilter(ALL_BRANCHES);
                            setIsBranchFilterOpen(false);
                          }}
                        >
                          <Check className={`mr-2 h-4 w-4 ${branchFilter === ALL_BRANCHES ? "opacity-100" : "opacity-0"}`} />
                          {localizedText("Tất cả chi nhánh", "All branches")}
                        </CommandItem>
                        {visibleBranches.map((branch: SuperAdminBranch) => (
                          <CommandItem
                            key={branch.id}
                            value={`${branch.name} ${branch.provinceName ?? ""}`}
                            onSelect={() => {
                              setBranchFilter(String(branch.id));
                              setIsBranchFilterOpen(false);
                            }}
                          >
                            <Check className={`mr-2 h-4 w-4 ${branchFilter === String(branch.id) ? "opacity-100" : "opacity-0"}`} />
                            <span className="truncate">{branch.name}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            )}
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label={localizedText("Tùy chỉnh cột bảng tài khoản", "Customize account table columns")}
                  className="flex h-10 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
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
                {availableColumns.map((column) => {
                  const isLastVisibleColumn = shownColumns.length === 1 && visibleColumns[column.id];
                  return (
                    <label
                      key={column.id}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      <input
                        type="checkbox"
                        checked={visibleColumns[column.id]}
                        disabled={isLastVisibleColumn}
                        onChange={(event) => {
                          setVisibleColumns((current) => ({
                            ...current,
                            [column.id]: event.target.checked,
                          }));
                        }}
                        className="h-4 w-4 rounded border-slate-300 accent-blue-600"
                      />
                      {accountColumnLabel(column.id)}
                    </label>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setVisibleColumns({
                    name: true,
                    type: true,
                    email: true,
                    phone: true,
                    branch: true,
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
                if (isBusy) return;
                if (hasAccountFilters) {
                  setSearch("");
                  setAccountTypeFilter("ALL");
                  setBranchFilter(ALL_BRANCHES);
                }
                void refetch();
              }}
              disabled={isBusy}
              aria-label={hasAccountFilters ? localizedText("Đặt lại bộ lọc", "Reset filters") : localizedText("Tải lại danh sách tài khoản", "Reload accounts")}
              title={hasAccountFilters ? localizedText("Đặt lại bộ lọc", "Reset filters") : localizedText("Tải lại danh sách tài khoản", "Reload accounts")}
              aria-busy={isBusy}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-100"
            >
              {isBusy
                ? <RefreshCw size={16} className="animate-spin" />
                : hasAccountFilters
                  ? <RotateCcw size={15} />
                  : <RefreshCw size={16} />}
            </button>
          </div>
          </div>
        </div>

        {isBusy ? (
          <div role="status" aria-live="polite" className="mt-4 flex min-h-48 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-8 text-sm text-blue-700">
            <RefreshCw size={17} className="animate-spin" />
            <span>{localizedText("Đang tải danh sách tài khoản...", "Loading accounts...")}</span>
          </div>
        ) : isError ? (
          <div role="alert" className="mt-4 flex flex-wrap items-center justify-center gap-3 rounded-xl border border-rose-200 bg-rose-50 p-6 text-center text-sm text-rose-700">
            <span>{getErrorMessage(listError, localizedText("Không thể tải danh sách tài khoản.", "Could not load accounts."))}</span>
            <button type="button" onClick={() => void refetch()} className="font-semibold underline">{localizedText("Thử lại", "Retry")}</button>
          </div>
        ) : filteredAccounts.length === 0 ? (
          <FilterResultStatus filterKey={JSON.stringify([search, accountTypeFilter, branchFilter])}><div className="py-12 text-center">
            <Users size={25} className="mx-auto text-slate-300" />
            <p className="mt-3 text-sm font-medium text-slate-600">
              {accountsInView.length === 0 ? localizedText("Chưa có tài khoản hoặc hồ sơ phù hợp.", "No matching accounts or profiles yet.") : localizedText("Không tìm thấy hồ sơ phù hợp với bộ lọc.", "No profiles match the selected filters.")}
            </p>
          </div></FilterResultStatus>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
            <table
              className="min-w-full table-fixed text-left text-sm"
              style={{ width: `${tableWidth + 64}px` }}
            >
              <colgroup>
                <col style={{ width: "64px" }} />
                {shownColumns.map((column) => (
                  <col key={column.id} style={{ width: `${column.width}px` }} />
                ))}
              </colgroup>
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="whitespace-nowrap px-4 py-3 font-semibold">STT</th>
                  {shownColumns.map((column) => (
                    <th
                      key={column.id}
                      className={`px-4 py-3 font-semibold ${column.id === "actions" ? "whitespace-nowrap text-right" : ""}`}
                    >
                      {accountColumnLabel(column.id)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedAccounts.map((account, index) => (
                  <tr key={`${account.accountId ?? account.profileId}-${account.accountType}`} className="text-slate-700">
                    <td className="px-4 py-3 tabular-nums text-slate-500">{(safePage - 1) * pageSize + index + 1}</td>
                    {visibleColumns.name && <td className="px-4 py-3 font-semibold text-slate-900">{account.fullName || localizedText("Chưa cập nhật", "Not provided")}</td>}
                    {visibleColumns.type && <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getAccountTypeBadgeClass(account)}`}>
                        {getAccountTypeLabel(account)}
                      </span>
                    </td>}
                    {visibleColumns.email && <td className="px-4 py-3">{account.email || localizedText("Chưa cập nhật", "Not provided")}</td>}
                    {visibleColumns.phone && <td className="px-4 py-3">{account.phone || localizedText("Chưa cập nhật", "Not provided")}</td>}
                    {view !== "customers" && visibleColumns.branch && <td className="px-4 py-3">{account.hotelName || "—"}</td>}
                    {visibleColumns.actions && <td className="whitespace-nowrap px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => void openDetails(account)}
                        className="inline-flex whitespace-nowrap items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <Eye size={14} />
                        {localizedText("Chi tiết", "Details")}
                      </button>
                    </td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!isBusy && !isError && filteredAccounts.length > 0 && (
          <>
            <ListPagination totalItems={filteredAccounts.length} page={safePage} pageSize={pageSize} mode="table" onPageChange={setPage} onPageSizeChange={setPageSize} />
            <p className="mt-3 text-xs text-slate-400">
              {localizedText("Đang hiển thị", "Showing")} {filteredAccounts.length} / {branchFilteredAccounts.length} {localizedText("hồ sơ", "accounts")}.
            </p>
          </>
        )}
      </section>

      {(selectedAccount || isLoadingDetails || detailError) && (
        <div
          className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/50 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedAccount(null);
              setDetailError("");
            }
          }}
        >
          <section className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
            <header className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-blue-600">{localizedText("Chi tiết tài khoản", "Account details")}</p>
                <h2 className="mt-1 text-xl font-bold text-slate-900">
                  {selectedAccount?.fullName || (isLoadingDetails ? localizedText("Đang tải...", "Loading...") : localizedText("Không thể tải", "Unable to load"))}
                </h2>
                {selectedAccount && <p className="mt-1 text-sm text-slate-500">{getAccountTypeLabel(selectedAccount)}</p>}
              </div>
              <button
                type="button"
                onClick={() => { setSelectedAccount(null); setDetailError(""); }}
                aria-label={localizedText("Đóng", "Close")}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </header>

            {isLoadingDetails ? (
              <p className="py-10 text-center text-sm text-slate-500">{localizedText("Đang tải chi tiết tài khoản...", "Loading account details...")}</p>
            ) : detailError ? (
              <p role="alert" className="mt-5 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{detailError}</p>
            ) : selectedAccount && form ? (
              <form onSubmit={(event) => void submitUpdate(event)} className="mt-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-sm font-semibold text-slate-700">
                    {localizedText("Họ và tên", "Full name")}
                    <input required={hasEmployeeProfile || Boolean(isCustomer)} disabled={!canEdit || (!hasEmployeeProfile && !isCustomer)} value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none focus:border-blue-400 disabled:bg-slate-100 disabled:text-slate-500" />
                  </label>
                  <label className="text-sm font-semibold text-slate-700">
                    {localizedText("Email đăng nhập / liên hệ", "Login/contact email")}
                    <input type="email" disabled={!canEdit} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none focus:border-blue-400 disabled:bg-slate-100 disabled:text-slate-500" />
                  </label>
                  <label className="text-sm font-semibold text-slate-700">
                    {localizedText("Số điện thoại", "Phone number")}
                    <input disabled={!canEdit || (!hasEmployeeProfile && !isCustomer)} value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none focus:border-blue-400 disabled:bg-slate-100 disabled:text-slate-500" />
                  </label>
                  {isCustomer ? (
                    <label className="text-sm font-semibold text-slate-700">
                      {localizedText("CCCD / giấy tờ", "ID document")}
                      <input disabled={!canEdit} value={form.identityNumber} onChange={(event) => setForm({ ...form, identityNumber: event.target.value })} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none focus:border-blue-400 disabled:bg-slate-100 disabled:text-slate-500" />
                    </label>
                  ) : (
                    <label className="text-sm font-semibold text-slate-700">
                      {localizedText("Chức vụ", "Position")}
                      <input disabled={!canEdit || !hasEmployeeProfile} value={form.position} onChange={(event) => setForm({ ...form, position: event.target.value })} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none focus:border-blue-400 disabled:bg-slate-100 disabled:text-slate-500" />
                    </label>
                  )}
                  {!isCustomer && (
                    <>
                      <label className="text-sm font-semibold text-slate-700">
                        {localizedText("Vai trò tài khoản", "Account role")}
                        <select
                          value={form.role}
                          onChange={(event) => setForm({ ...form, role: event.target.value })}
                          disabled={!canEdit || !hasEmployeeProfile}
                          className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 font-normal outline-none focus:border-blue-400 disabled:bg-slate-100"
                        >
                          <option value="">{localizedText("Không đổi vai trò", "Keep current role")}</option>
                          <option value="ROLE_ADMIN">{localizedText("Admin chi nhánh", "Branch admin")}</option>
                          <option value="ROLE_MANAGER">{localizedText("Quản lý", "Manager")}</option>
                          <option value="ROLE_EMPLOYEE">{localizedText("Nhân viên", "Employee")}</option>
                        </select>
                      </label>
                      <label className="text-sm font-semibold text-slate-700">
                        {localizedText("Chi nhánh", "Branch")}
                        <input readOnly value={selectedAccount.hotelName ?? "—"} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 font-normal text-slate-500" />
                      </label>
                    </>
                  )}
                  {selectedAccount.accountId && (
                    <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
                      {localizedText("Mã tài khoản", "Account ID")}
                      <input readOnly value={selectedAccount.accountId} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 font-mono font-normal text-slate-500" />
                    </label>
                  )}
                  {selectedAccount.accountType === "WALK_IN_CUSTOMER" && (
                    <p className="text-sm text-amber-800 sm:col-span-2">
                      {localizedText("Khách vãng lai chưa có tài khoản đăng nhập web; chức năng cấp lại mật khẩu không áp dụng.", "Walk-in guests do not have a website login account; password reset is not available.")}
                    </p>
                  )}
                </div>

                <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
                  {isStaff
                    ? localizedText(
                      "Không nhập mật khẩu tại đây. Khi đổi email, mật khẩu mới sẽ được tạo và gửi tới email mới.",
                      "Passwords cannot be entered here. When the email changes, a new password will be generated and sent to the new address.",
                      )
                    : isCustomer && selectedAccount.accountType === "CUSTOMER"
                    ? localizedText("Mật khẩu và mã hash không được hiển thị. Cấp lại mật khẩu sẽ tạo mật khẩu mới và gửi tới email tài khoản.", "Passwords and password hashes are not displayed. Resetting the password creates a new password and sends it to the account email.")
                      : localizedText("Mật khẩu và mã hash không được hiển thị.", "Passwords and password hashes are not displayed.")}
                </p>
                {actionError && <p role="alert" className="mt-3 text-sm text-rose-600">{actionError}</p>}
                {actionMessage && <p role="status" className="mt-3 text-sm text-emerald-700">{actionMessage}</p>}

                <div className="mt-5 flex flex-wrap justify-between gap-2">
                  {selectedAccount.accountId && selectedAccount.email && (isStaff || isCustomer) && (
                    <button
                      type="button"
                      onClick={() => void handlePasswordReset()}
                      disabled={isRequestingReset || (isStaff && form.email.trim().toLowerCase() !== (selectedAccount.email ?? "").trim().toLowerCase())}
                      className="inline-flex items-center gap-2 rounded-lg border border-amber-200 px-4 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-50 disabled:opacity-50"
                    >
                      <KeyRound size={15} />
                      {isRequestingReset
                        ? localizedText("Đang gửi mật khẩu mới...", "Sending new password...")
                        : localizedText("Cấp lại mật khẩu", "Reset password")}
                    </button>
                  )}
                  <div className="ml-auto flex gap-2">
                    <button type="button" onClick={() => setSelectedAccount(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                      Đóng
                    </button>
                    {canEdit && (
                      <button type="submit" disabled={isSaving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                        {isSaving ? "Đang lưu..." : "Lưu thay đổi"}
                      </button>
                    )}
                  </div>
                </div>
              </form>
            ) : null}
          </section>
        </div>
      )}
    </>
  );
}
