import { useMemo, useState } from "react";
import { Check, ChevronDown, Eye, KeyRound, RefreshCw, Search, Users, X } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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

type AccountView = "all" | "staff" | "customers";

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
    case "ADMIN": return "Admin chi nhánh";
    case "MANAGER": return "Quản lý";
    case "EMPLOYEE": return "Nhân viên";
    case "CUSTOMER": return "Khách hàng có tài khoản";
    case "WALK_IN_CUSTOMER": return "Khách vãng lai";
    default: return "Khác";
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
  const [branchSearch, setBranchSearch] = useState("");
  const [branchFilter, setBranchFilter] = useState(ALL_BRANCHES);
  const [isBranchFilterOpen, setIsBranchFilterOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<SuperAdminAccount | null>(null);
  const [form, setForm] = useState<AccountForm | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");

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
    return branchFilteredAccounts.filter((account) => {
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
  }, [branchFilteredAccounts, search]);
  const visibleBranches = useMemo(() => {
    const normalizedSearch = branchSearch.trim().toLocaleLowerCase();
    return branches.filter((branch) =>
      `${branch.name} ${branch.provinceName ?? ""}`.toLocaleLowerCase().includes(normalizedSearch),
    );
  }, [branches, branchSearch]);
  const selectedBranchName = branches.find((branch) => String(branch.id) === branchFilter)?.name;

  const title =
    view === "staff" ? "Tài khoản nhân sự"
      : view === "customers" ? "Tài khoản khách hàng"
        : "Tổng quan toàn bộ tài khoản";

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
      setDetailError(getErrorMessage(error, "Không thể tải chi tiết tài khoản."));
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const submitUpdate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedAccount || !form) return;
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
        setActionError("Không xác định được tài khoản để cập nhật.");
        return;
      }
      setSelectedAccount(updated);
      setForm(toAccountForm(updated));
      setActionMessage("Cập nhật thông tin thành công.");
      void refetch();
    } catch (error) {
      setActionError(getErrorMessage(error, "Không thể cập nhật thông tin tài khoản."));
    }
  };

  const handlePasswordReset = async () => {
    if (!selectedAccount?.accountId) return;
    setActionError("");
    setActionMessage("");
    try {
      await requestPasswordReset(selectedAccount.accountId).unwrap();
      setActionMessage(`Đã gửi mã OTP đặt lại mật khẩu đến ${selectedAccount.email}.`);
    } catch (error) {
      setActionError(getErrorMessage(error, "Không thể gửi yêu cầu đặt lại mật khẩu."));
    }
  };

  const isCustomer = selectedAccount?.accountType === "CUSTOMER" || selectedAccount?.accountType === "WALK_IN_CUSTOMER";
  const hasEmployeeProfile = Boolean(
    selectedAccount && !isCustomer && selectedAccount.profileId !== selectedAccount.accountId,
  );
  const canEdit = selectedAccount?.accountType !== "SUPER_ADMIN";
  const isSaving = isUpdatingAccount || isUpdatingCustomer;
  const isBusy = isLoading || isFetching;

  return (
    <>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{title}</h2>
            <p className="mt-1 max-w-3xl text-sm text-slate-500">
              {view === "staff"
                ? "Danh sách tài khoản admin chi nhánh, quản lý và nhân viên."
                : view === "customers"
                  ? "Danh sách khách hàng đã đăng ký web và khách vãng lai chưa có tài khoản."
                  : "Danh sách tài khoản nhân sự, khách hàng đăng ký web và khách vãng lai."}
              {" "}Thông tin mật khẩu và mã hóa mật khẩu không được hiển thị.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void refetch()}
            disabled={isBusy}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw size={15} className={isBusy ? "animate-spin" : ""} />
            Tải lại
          </button>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-slate-100 px-3 py-1.5 font-semibold text-slate-700">Tổng: {branchFilteredAccounts.length}</span>
            {view !== "customers" && (
              <>
                <span className="rounded-full bg-blue-50 px-3 py-1.5 font-semibold text-blue-700">
                  Nhân sự: {branchFilteredAccounts.filter((account) => ["ADMIN", "MANAGER", "EMPLOYEE"].includes(getDisplayAccountType(account))).length}
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
                  Đã đăng ký: {accounts.filter((account) => getDisplayAccountType(account) === "CUSTOMER").length}
                </span>
                <span className="rounded-full bg-amber-50 px-3 py-1.5 font-semibold text-amber-800">
                  Vãng lai: {accounts.filter((account) => getDisplayAccountType(account) === "WALK_IN_CUSTOMER").length}
                </span>
              </>
            )}
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
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
                    aria-label="Lọc nhân sự theo chi nhánh"
                    className="flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 text-left text-sm text-slate-700 outline-none hover:bg-slate-50 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 sm:w-56"
                  >
                    <span className="truncate">{selectedBranchName ?? "Tất cả chi nhánh"}</span>
                    <ChevronDown size={15} className="shrink-0 text-slate-400" />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-[var(--radix-popover-trigger-width)] p-0">
                  <Command>
                    <CommandInput
                      placeholder="Tìm chi nhánh..."
                      value={branchSearch}
                      onValueChange={setBranchSearch}
                    />
                    {isBranchesLoading && (
                      <p role="status" className="px-3 py-2 text-xs text-slate-500">
                        Đang tải danh sách chi nhánh...
                      </p>
                    )}
                    {isBranchesError && (
                      <p role="alert" className="px-3 py-2 text-xs text-rose-600">
                        Không thể tải danh sách chi nhánh.
                      </p>
                    )}
                    <CommandList>
                      <CommandEmpty>Không tìm thấy chi nhánh.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="Tất cả chi nhánh"
                          onSelect={() => {
                            setBranchFilter(ALL_BRANCHES);
                            setIsBranchFilterOpen(false);
                          }}
                        >
                          <Check className={`mr-2 h-4 w-4 ${branchFilter === ALL_BRANCHES ? "opacity-100" : "opacity-0"}`} />
                          Tất cả chi nhánh
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
            <label className="relative block w-full sm:w-72">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Tìm tên, email, SĐT, mã hoặc chi nhánh"
                className="h-10 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </label>
          </div>
        </div>

        {isError && (
          <div role="alert" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
            <span>{getErrorMessage(listError, "Không thể tải danh sách tài khoản.")}</span>
            <button type="button" onClick={() => void refetch()} className="font-semibold underline">Thử lại</button>
          </div>
        )}

        {isLoading ? (
          <p className="py-12 text-center text-sm text-slate-500">Đang tải danh sách tài khoản...</p>
        ) : filteredAccounts.length === 0 ? (
          <div className="py-12 text-center">
            <Users size={25} className="mx-auto text-slate-300" />
            <p className="mt-3 text-sm font-medium text-slate-600">
              {accountsInView.length === 0 ? "Chưa có tài khoản hoặc hồ sơ phù hợp." : "Không tìm thấy hồ sơ phù hợp với bộ lọc."}
            </p>
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Họ và tên</th>
                  <th className="px-4 py-3 font-semibold">Loại tài khoản</th>
                  <th className="px-4 py-3 font-semibold">Email</th>
                  <th className="px-4 py-3 font-semibold">Số điện thoại</th>
                  <th className="px-4 py-3 font-semibold">Chi nhánh</th>
                  <th className="px-4 py-3 text-right font-semibold">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAccounts.map((account) => (
                  <tr key={`${account.accountId ?? account.profileId}-${account.accountType}`} className="text-slate-700">
                    <td className="px-4 py-3 font-semibold text-slate-900">{account.fullName || "Chưa cập nhật"}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getAccountTypeBadgeClass(account)}`}>
                        {getAccountTypeLabel(account)}
                      </span>
                    </td>
                    <td className="px-4 py-3">{account.email || "Chưa cập nhật"}</td>
                    <td className="px-4 py-3">{account.phone || "Chưa cập nhật"}</td>
                    <td className="px-4 py-3">{account.hotelName || "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => void openDetails(account)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <Eye size={14} />
                        Chi tiết
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-xs text-slate-400">                Đang hiển thị {filteredAccounts.length} / {branchFilteredAccounts.length} hồ sơ.</p>
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
                <p className="text-xs font-bold uppercase tracking-wider text-blue-600">Chi tiết tài khoản</p>
                <h2 className="mt-1 text-xl font-bold text-slate-900">
                  {selectedAccount?.fullName || (isLoadingDetails ? "Đang tải..." : "Không thể tải")}
                </h2>
                {selectedAccount && <p className="mt-1 text-sm text-slate-500">{getAccountTypeLabel(selectedAccount)}</p>}
              </div>
              <button
                type="button"
                onClick={() => { setSelectedAccount(null); setDetailError(""); }}
                aria-label="Đóng"
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </header>

            {isLoadingDetails ? (
              <p className="py-10 text-center text-sm text-slate-500">Đang tải chi tiết tài khoản...</p>
            ) : detailError ? (
              <p role="alert" className="mt-5 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{detailError}</p>
            ) : selectedAccount && form ? (
              <form onSubmit={(event) => void submitUpdate(event)} className="mt-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-sm font-semibold text-slate-700">
                    Họ và tên
                    <input required={hasEmployeeProfile || Boolean(isCustomer)} disabled={!canEdit || (!hasEmployeeProfile && !isCustomer)} value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none focus:border-blue-400 disabled:bg-slate-100 disabled:text-slate-500" />
                  </label>
                  <label className="text-sm font-semibold text-slate-700">
                    Email đăng nhập / liên hệ
                    <input type="email" disabled={!canEdit} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none focus:border-blue-400 disabled:bg-slate-100 disabled:text-slate-500" />
                  </label>
                  <label className="text-sm font-semibold text-slate-700">
                    Số điện thoại
                    <input disabled={!canEdit || (!hasEmployeeProfile && !isCustomer)} value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none focus:border-blue-400 disabled:bg-slate-100 disabled:text-slate-500" />
                  </label>
                  {isCustomer ? (
                    <label className="text-sm font-semibold text-slate-700">
                      CCCD / giấy tờ
                      <input disabled={!canEdit} value={form.identityNumber} onChange={(event) => setForm({ ...form, identityNumber: event.target.value })} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none focus:border-blue-400 disabled:bg-slate-100 disabled:text-slate-500" />
                    </label>
                  ) : (
                    <label className="text-sm font-semibold text-slate-700">
                      Chức vụ
                      <input disabled={!canEdit || !hasEmployeeProfile} value={form.position} onChange={(event) => setForm({ ...form, position: event.target.value })} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none focus:border-blue-400 disabled:bg-slate-100 disabled:text-slate-500" />
                    </label>
                  )}
                  {!isCustomer && (
                    <>
                      <label className="text-sm font-semibold text-slate-700">
                        Vai trò tài khoản
                        <select
                          value={form.role}
                          onChange={(event) => setForm({ ...form, role: event.target.value })}
                          disabled={!canEdit || !hasEmployeeProfile}
                          className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 font-normal outline-none focus:border-blue-400 disabled:bg-slate-100"
                        >
                          <option value="">Không đổi vai trò</option>
                          <option value="ROLE_ADMIN">Admin chi nhánh</option>
                          <option value="ROLE_MANAGER">Quản lý</option>
                          <option value="ROLE_EMPLOYEE">Nhân viên</option>
                        </select>
                      </label>
                      <label className="text-sm font-semibold text-slate-700">
                        Chi nhánh
                        <input readOnly value={selectedAccount.hotelName ?? "—"} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 font-normal text-slate-500" />
                      </label>
                    </>
                  )}
                  {selectedAccount.accountId && (
                    <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
                      Mã tài khoản
                      <input readOnly value={selectedAccount.accountId} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 font-mono font-normal text-slate-500" />
                    </label>
                  )}
                  {selectedAccount.accountType === "WALK_IN_CUSTOMER" && (
                    <p className="text-sm text-amber-800 sm:col-span-2">
                      Khách vãng lai chưa có tài khoản đăng nhập web; chức năng cấp lại mật khẩu không áp dụng.
                    </p>
                  )}
                </div>

                <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
                  Mật khẩu và mã hash không được hiển thị. Cấp lại mật khẩu sẽ gửi OTP tới email đang lưu trong tài khoản.
                </p>
                {actionError && <p role="alert" className="mt-3 text-sm text-rose-600">{actionError}</p>}
                {actionMessage && <p role="status" className="mt-3 text-sm text-emerald-700">{actionMessage}</p>}

                <div className="mt-5 flex flex-wrap justify-between gap-2">
                  {selectedAccount.accountId && selectedAccount.accountType !== "SUPER_ADMIN" && selectedAccount.email && (
                    <button
                      type="button"
                      onClick={() => void handlePasswordReset()}
                      disabled={isRequestingReset}
                      className="inline-flex items-center gap-2 rounded-lg border border-amber-200 px-4 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-50 disabled:opacity-50"
                    >
                      <KeyRound size={15} />
                      {isRequestingReset ? "Đang gửi OTP..." : "Cấp lại mật khẩu"}
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
