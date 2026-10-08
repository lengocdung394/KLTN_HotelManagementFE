import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  CircleUserRound,
  LayoutDashboard,
  LogOut,
  MapPin,
  Plus,
  ShieldCheck,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { baseApi } from "../services/baseApi";
import { bindSuperAdminSocketEvents, joinSuperAdminAccountsRoom } from "../lib/socket";
import { uploadProvinceBackgroundToCloudinary } from "../services/cloudinaryUploadApi";
import {
  useCreateSuperAdminBranchMutation,
  useCreateSuperAdminProvinceMutation,
  useGetSuperAdminBranchDetailsQuery,
  useGetSuperAdminBranchesQuery,
  useGetSuperAdminBranchesByProvinceQuery,
  useGetSuperAdminProvincesQuery,
  useSaveSuperAdminBranchRoomPoliciesMutation,
  useUpdateSuperAdminProvinceBackgroundMutation,
  type SuperAdminRoomPolicy,
  type SuperAdminBranch,
  type SuperAdminBranchDetails,
  type CreateBranchAccountRequest,
  type CreateBranchAdminAccountRequest,
} from "../services/superAdminApi";
import { useCreateSharedAmenityMutation, useGetAllAmenitiesQuery } from "../services/amenityApi";
import SuperAdminRolePermissionsPanel from "../components/SuperAdminRolePermissionsPanel";
import SuperAdminAccountManagementPanel from "../components/SuperAdminAccountManagementPanel";

type AdminSection =
  | "overview"
  | "branches"
  | "provinces"
  | "amenities"
  | "permissions"
  | "accounts-overview"
  | "staff-accounts"
  | "customer-accounts";

const formatMoney = (amount: number) => `${amount.toLocaleString("vi-VN")} đ`;

const provinceColorThemes = [
  {
    sidebarActive: "bg-sky-500/15 text-sky-300",
    sidebarHover: "hover:bg-sky-500/10 hover:text-sky-200",
    pillActive: "bg-sky-100 text-sky-700",
    pillIdle: "bg-sky-50 text-sky-700 hover:bg-sky-100",
    card: "border-sky-100 bg-sky-50/70 hover:border-sky-200",
    icon: "bg-sky-100 text-sky-700",
    badge: "bg-sky-100 text-sky-700",
    button: "border-sky-200 text-sky-700 hover:bg-sky-100",
  },
  {
    sidebarActive: "bg-violet-500/15 text-violet-300",
    sidebarHover: "hover:bg-violet-500/10 hover:text-violet-200",
    pillActive: "bg-violet-100 text-violet-700",
    pillIdle: "bg-violet-50 text-violet-700 hover:bg-violet-100",
    card: "border-violet-100 bg-violet-50/70 hover:border-violet-200",
    icon: "bg-violet-100 text-violet-700",
    badge: "bg-violet-100 text-violet-700",
    button: "border-violet-200 text-violet-700 hover:bg-violet-100",
  },
  {
    sidebarActive: "bg-emerald-500/15 text-emerald-300",
    sidebarHover: "hover:bg-emerald-500/10 hover:text-emerald-200",
    pillActive: "bg-emerald-100 text-emerald-700",
    pillIdle: "bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
    card: "border-emerald-100 bg-emerald-50/70 hover:border-emerald-200",
    icon: "bg-emerald-100 text-emerald-700",
    badge: "bg-emerald-100 text-emerald-700",
    button: "border-emerald-200 text-emerald-700 hover:bg-emerald-100",
  },
  {
    sidebarActive: "bg-amber-500/15 text-amber-300",
    sidebarHover: "hover:bg-amber-500/10 hover:text-amber-200",
    pillActive: "bg-amber-100 text-amber-800",
    pillIdle: "bg-amber-50 text-amber-800 hover:bg-amber-100",
    card: "border-amber-100 bg-amber-50/70 hover:border-amber-200",
    icon: "bg-amber-100 text-amber-700",
    badge: "bg-amber-100 text-amber-700",
    button: "border-amber-200 text-amber-700 hover:bg-amber-100",
  },
  {
    sidebarActive: "bg-rose-500/15 text-rose-300",
    sidebarHover: "hover:bg-rose-500/10 hover:text-rose-200",
    pillActive: "bg-rose-100 text-rose-700",
    pillIdle: "bg-rose-50 text-rose-700 hover:bg-rose-100",
    card: "border-rose-100 bg-rose-50/70 hover:border-rose-200",
    icon: "bg-rose-100 text-rose-700",
    badge: "bg-rose-100 text-rose-700",
    button: "border-rose-200 text-rose-700 hover:bg-rose-100",
  },
] as const;

const DEFAULT_PROVINCE_COVER = "/province-covers/city.svg";

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "data" in error) {
    const data = (error as { data?: unknown }).data;
    if (data && typeof data === "object") {
      const payload = data as { message?: unknown; detail?: unknown };
      if (typeof payload.message === "string") return payload.message;
      if (typeof payload.detail === "string") return payload.detail;
    }
  }
  return fallback;
};

const initialBranchForm = {
  name: "",
  address: "",
  phone: "",
  provinceName: "",
  adminAccount: { username: "", password: "" },
  managerAccount: { fullName: "", email: "", phone: "", password: "" },
};

const branchAccountSections = [
  { key: "managerAccount", title: "Tài khoản quản lý chi nhánh" },
] as const;

const branchAccountFields: {
  key: keyof CreateBranchAccountRequest;
  label: string;
  type: string;
  autoComplete: string;
}[] = [
  { key: "fullName", label: "Họ và tên", type: "text", autoComplete: "name" },
  { key: "email", label: "Email", type: "email", autoComplete: "email" },
  { key: "phone", label: "Số điện thoại", type: "tel", autoComplete: "tel" },
  { key: "password", label: "Mật khẩu", type: "password", autoComplete: "new-password" },
];

const branchAdminAccountFields: {
  key: keyof CreateBranchAdminAccountRequest;
  label: string;
  type: string;
  autoComplete: string;
}[] = [
  { key: "username", label: "Tên tài khoản", type: "text", autoComplete: "username" },
  { key: "password", label: "Mật khẩu", type: "password", autoComplete: "new-password" },
];

type AdminDashboardPageProps = {
  onLogout: () => void;
};

export default function AdminDashboardPage({ onLogout }: AdminDashboardPageProps) {
  const dispatch = useAppDispatch();
  const { fullName, email } = useAppSelector((state) => state.auth);
  const [section, setSection] = useState<AdminSection>("overview");
  const [isBranchMenuOpen, setIsBranchMenuOpen] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [expandedBranchGroup, setExpandedBranchGroup] = useState<string | null>(null);
  const [isBranchFormOpen, setIsBranchFormOpen] = useState(false);
  const [isProvinceFormOpen, setIsProvinceFormOpen] = useState(false);
  const [branchForm, setBranchForm] = useState(initialBranchForm);
  const [branchFormError, setBranchFormError] = useState("");
  const [provinceName, setProvinceName] = useState("");
  const [provinceBackgroundFile, setProvinceBackgroundFile] = useState<File | null>(null);
  const [provinceFormError, setProvinceFormError] = useState("");
  const [isUploadingProvinceBackground, setIsUploadingProvinceBackground] = useState(false);
  const [uploadingProvinceId, setUploadingProvinceId] = useState<string | null>(null);
  const [provinceCardUploadError, setProvinceCardUploadError] = useState("");
  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null);
  const [selectedProvinceId, setSelectedProvinceId] = useState("");
  const [amenityName, setAmenityName] = useState("");

  useEffect(() => {
    const unbindSuperAdminEvents = bindSuperAdminSocketEvents({
      onCustomerCreated: () => {
        dispatch(baseApi.util.invalidateTags(["SuperAdminAccounts", "SuperAdminBranch"]));
      },
      onAccountCreated: () => {
        dispatch(baseApi.util.invalidateTags(["SuperAdminAccounts", "SuperAdminBranch"]));
      },
      onBranchCreated: () => {
        dispatch(baseApi.util.invalidateTags(["SuperAdminAccounts", "SuperAdminBranch"]));
      },
    });
    joinSuperAdminAccountsRoom();
    return unbindSuperAdminEvents;
  }, [dispatch]);
  const [amenityPrice, setAmenityPrice] = useState("");
  const [amenityError, setAmenityError] = useState("");
  const {
    data: branches = [],
    isLoading: isBranchesLoading,
    isError: isBranchesError,
    refetch: refetchBranches,
  } = useGetSuperAdminBranchesQuery();
  const {
    data: provinces = [],
    isLoading: isProvincesLoading,
    isError: isProvincesError,
  } = useGetSuperAdminProvincesQuery();
  const {
    data: branchesByProvince = [],
    isLoading: isProvinceBranchesLoading,
    isError: isProvinceBranchesError,
  } = useGetSuperAdminBranchesByProvinceQuery(selectedProvinceId, { skip: !selectedProvinceId });
  const [createBranch, { isLoading: isCreatingBranch }] = useCreateSuperAdminBranchMutation();
  const [createProvince, { isLoading: isCreatingProvince }] = useCreateSuperAdminProvinceMutation();
  const [updateProvinceBackground] = useUpdateSuperAdminProvinceBackgroundMutation();
  const { data: amenities = [], isLoading: isAmenitiesLoading, isError: isAmenitiesError } = useGetAllAmenitiesQuery();
  const [createAmenity, { isLoading: isCreatingAmenity }] = useCreateSharedAmenityMutation();
  const {
    data: branchDetails,
    isLoading: isBranchDetailsLoading,
    isError: isBranchDetailsError,
  } = useGetSuperAdminBranchDetailsQuery(selectedBranchId ?? 0, { skip: selectedBranchId === null });

  const totalRevenue = useMemo(
    () => branches.reduce((sum, branch) => sum + (Number(branch.totalRevenue) || 0), 0),
    [branches],
  );
  const totalEmployees = useMemo(
    () => branches.reduce((sum, branch) => sum + (Number(branch.employeeCount) || 0), 0),
    [branches],
  );
  const totalBookings = useMemo(
    () => branches.reduce((sum, branch) => sum + (Number(branch.bookingCount) || 0), 0),
    [branches],
  );
  const provinceDashboardBranches =
    section === "branches" && selectedProvinceId ? branchesByProvince : branches;
  const isProvinceDashboardLoading =
    section === "branches" && selectedProvinceId ? isProvinceBranchesLoading : isBranchesLoading;
  const dashboardRevenue = useMemo(
    () => provinceDashboardBranches.reduce((sum, branch) => sum + (Number(branch.totalRevenue) || 0), 0),
    [provinceDashboardBranches],
  );
  const dashboardEmployees = useMemo(
    () => provinceDashboardBranches.reduce((sum, branch) => sum + (Number(branch.employeeCount) || 0), 0),
    [provinceDashboardBranches],
  );
  const dashboardBookings = useMemo(
    () => provinceDashboardBranches.reduce((sum, branch) => sum + (Number(branch.bookingCount) || 0), 0),
    [provinceDashboardBranches],
  );

  const submitBranch = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBranchFormError("");
    try {
      await createBranch(branchForm).unwrap();
      setBranchForm(initialBranchForm);
      setIsBranchFormOpen(false);
    } catch (error) {
      setBranchFormError(getErrorMessage(error, "Không thể tạo chi nhánh. Vui lòng thử lại."));
    }
  };

  const submitProvince = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setProvinceFormError("");
    if (!provinceBackgroundFile) {
      setProvinceFormError("Vui lòng chọn ảnh nền cho tỉnh/thành.");
      return;
    }
    setIsUploadingProvinceBackground(true);
    try {
      const backgroundImageUrl = await uploadProvinceBackgroundToCloudinary(provinceBackgroundFile, provinceName);
      const province = await createProvince({ name: provinceName.trim(), backgroundImageUrl }).unwrap();
      setBranchForm((current) => ({ ...current, provinceName: province.name }));
      setProvinceName("");
      setProvinceBackgroundFile(null);
      setIsProvinceFormOpen(false);
    } catch (error) {
      setProvinceFormError(getErrorMessage(error, "Không thể tải ảnh hoặc thêm tỉnh/thành. Vui lòng thử lại."));
    } finally {
      setIsUploadingProvinceBackground(false);
    }
  };

  const replaceProvinceBackground = async (provinceId: string, provinceName: string, file?: File) => {
    if (!file) return;
    setUploadingProvinceId(provinceId);
    setProvinceCardUploadError("");
    try {
      const backgroundImageUrl = await uploadProvinceBackgroundToCloudinary(file, provinceName);
      await updateProvinceBackground({ provinceId, backgroundImageUrl }).unwrap();
    } catch (error) {
      setProvinceCardUploadError(getErrorMessage(error, `Không thể cập nhật ảnh nền cho ${provinceName}.`));
    } finally {
      setUploadingProvinceId(null);
    }
  };

  const submitAmenity = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAmenityError("");
    const price = Number(amenityPrice);
    if (!amenityName.trim() || !Number.isFinite(price) || price < 0) {
      setAmenityError("Vui lòng nhập tên tiện nghi và giá hợp lệ.");
      return;
    }
    try {
      const imported = await createAmenity({
        amenities: [{ row: 1, name: amenityName.trim(), price }],
      }).unwrap();
      if (imported.length === 0) {
        setAmenityError("Tiện nghi cùng tên đã có trong danh mục dùng chung.");
        return;
      }
      setAmenityName("");
      setAmenityPrice("");
    } catch (error) {
      setAmenityError(getErrorMessage(error, "Không thể thêm tiện nghi dùng chung."));
    }
  };

  const navItems: { id: AdminSection; label: string; icon: typeof LayoutDashboard }[] = [
    { id: "overview", label: "Tổng quan", icon: LayoutDashboard },
    { id: "branches", label: "Quản lý chi nhánh", icon: Building2 },
    { id: "provinces", label: "Quản lý tỉnh/thành", icon: MapPin },
    { id: "amenities", label: "Tiện nghi dùng chung", icon: ShieldCheck },
    { id: "permissions", label: "Role và phân quyền", icon: ShieldCheck },
  ];
  const isAccountSection =
    section === "accounts-overview" || section === "staff-accounts" || section === "customer-accounts";

  const handleAccountMenuSelect = () => {
    setSection("accounts-overview");
    setIsAccountMenuOpen((isOpen) => !isOpen);
    setIsBranchMenuOpen(false);
    setSelectedBranchId(null);
  };

  const selectProvince = (provinceId: string) => {
    setSelectedProvinceId(provinceId);
    setSection("branches");
    setIsBranchMenuOpen(true);
  };

  const toggleProvinceGroup = (provinceId: string) => {
    selectProvince(provinceId);
    setExpandedBranchGroup((current) => current === provinceId ? null : provinceId);
  };

  const openBranchDetails = (branch: SuperAdminBranch) => {
    setSelectedProvinceId(provinces.find((province) => province.name === branch.provinceName)?.id ?? "");
    setSection("branches");
    setIsBranchMenuOpen(true);
    setSelectedBranchId(branch.id);
  };

  const openBranchDetailsById = (branchId: number) => {
    const branch = branches.find((item) => item.id === branchId);
    if (branch) openBranchDetails(branch);
  };

  const getBranchesForProvince = (provinceId: string) => {
    if (!provinceId) return branches;
    const province = provinces.find((item) => item.id === provinceId);
    return branches.filter((branch) => branch.provinceName === province?.name);
  };

  const getProvinceTheme = (provinceId: string) => {
    const provinceIndex = provinces.findIndex((province) => province.id === provinceId);
    return provinceColorThemes[(provinceIndex < 0 ? 0 : provinceIndex) % provinceColorThemes.length];
  };

  const getProvinceCoverImage = (provinceId: string) => {
    const province = provinces.find((item) => item.id === provinceId);
    return province?.backgroundImageUrl || DEFAULT_PROVINCE_COVER;
  };

  const handleSectionSelect = (id: AdminSection) => {
    if (id === "branches") {
      setIsAccountMenuOpen(false);
      if (section === "branches") {
        setIsBranchMenuOpen((isOpen) => !isOpen);
      } else {
        setSelectedProvinceId("");
        setSection("branches");
        setIsBranchMenuOpen(true);
      }
      return;
    }
    if (id === "staff-accounts" || id === "customer-accounts" || id === "accounts-overview") {
      setIsAccountMenuOpen(true);
    } else {
      setIsAccountMenuOpen(false);
    }
    setSection(id);
    setIsBranchMenuOpen(false);
    setSelectedBranchId(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <aside className="fixed inset-y-0 left-0 hidden w-72 flex-col bg-slate-950 px-5 py-6 text-white lg:flex">
        <div className="flex items-center gap-3 px-2">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-500 text-white shadow-lg shadow-blue-950/40">
            <ShieldCheck size={22} />
          </span>
          <div>
            <p className="font-bold tracking-wide">SEN VIET</p>
            <p className="mt-0.5 text-xs text-slate-400">Quản trị hệ thống</p>
          </div>
        </div>

        <nav className="mt-12 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1" aria-label="Điều hướng quản trị">
          {navItems.map(({ id, label, icon: Icon }) => (
            <div key={id}>
              <button
                type="button"
                onClick={() => handleSectionSelect(id)}
                aria-expanded={id === "branches" ? section === "branches" && isBranchMenuOpen : undefined}
                className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold transition ${
                  section === id ? "bg-blue-600 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon size={18} />
                <span className="flex-1">{label}</span>
                {id === "branches" && (section === "branches" && isBranchMenuOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />)}
              </button>
              {id === "branches" && section === "branches" && isBranchMenuOpen && (
                <div className="ml-6 mt-1 space-y-1 border-l border-slate-700 pl-3">
                  <button
                    type="button"
                    onClick={() => toggleProvinceGroup("")}
                    aria-expanded={expandedBranchGroup === ""}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                      selectedProvinceId === "" ? "bg-blue-500/15 font-semibold text-blue-300" : "text-slate-400 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    {expandedBranchGroup === "" ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    <span className="flex-1">Tổng chi nhánh</span>
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs">{branches.length}</span>
                  </button>
                  {expandedBranchGroup === "" && (
                    <div className="ml-3 space-y-1 border-l border-slate-700/80 py-1 pl-3">
                      {isBranchesLoading ? (
                        <p className="px-2 py-1.5 text-xs text-slate-500">Đang tải chi nhánh...</p>
                      ) : isBranchesError ? (
                        <p className="px-2 py-1.5 text-xs text-rose-300">Không thể tải chi nhánh.</p>
                      ) : branches.length === 0 ? (
                        <p className="px-2 py-1.5 text-xs text-slate-500">Chưa có chi nhánh.</p>
                      ) : branches.map((branch) => (
                        <button
                          type="button"
                          key={branch.id}
                          onClick={() => openBranchDetails(branch)}
                          className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs text-slate-400 transition hover:bg-white/5 hover:text-white"
                          title={branch.name}
                        >
                          <Building2 size={13} className="shrink-0 text-blue-300" />
                          <span className="min-w-0 flex-1 truncate">{branch.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {isProvincesLoading ? (
                    <p className="px-3 py-2 text-xs text-slate-500">Đang tải tỉnh/thành...</p>
                  ) : isProvincesError ? (
                    <p className="px-3 py-2 text-xs text-rose-300">Không thể tải tỉnh/thành.</p>
                  ) : provinces.map((province) => {
                    const theme = getProvinceTheme(province.id);
                    return (
                    <div key={province.id}>
                      <button
                        type="button"
                        onClick={() => toggleProvinceGroup(province.id)}
                        aria-expanded={expandedBranchGroup === province.id}
                        className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                          selectedProvinceId === province.id ? `${theme.sidebarActive} font-semibold` : `text-slate-400 ${theme.sidebarHover}`
                        }`}
                      >
                        {expandedBranchGroup === province.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        <MapPin size={14} className={`shrink-0 ${selectedProvinceId === province.id ? "" : "text-slate-500"}`} />
                        <span className="min-w-0 flex-1 truncate">{province.name}</span>
                        <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs">{getBranchesForProvince(province.id).length}</span>
                      </button>
                      {expandedBranchGroup === province.id && (
                        <div className="ml-3 space-y-1 border-l border-slate-700/80 py-1 pl-3">
                          {isBranchesLoading ? (
                            <p className="px-2 py-1.5 text-xs text-slate-500">Đang tải chi nhánh...</p>
                          ) : isBranchesError ? (
                            <p className="px-2 py-1.5 text-xs text-rose-300">Không thể tải chi nhánh.</p>
                          ) : getBranchesForProvince(province.id).length === 0 ? (
                            <p className="px-2 py-1.5 text-xs text-slate-500">Chưa có chi nhánh.</p>
                          ) : getBranchesForProvince(province.id).map((branch) => (
                            <button
                              type="button"
                              key={branch.id}
                              onClick={() => openBranchDetails(branch)}
                              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs text-slate-400 transition hover:bg-white/5 hover:text-white"
                              title={branch.name}
                            >
                              <Building2 size={13} className="shrink-0 text-blue-300" />
                              <span className="min-w-0 flex-1 truncate">{branch.name}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
          <div>
            <button
              type="button"
              onClick={handleAccountMenuSelect}
              aria-expanded={isAccountMenuOpen}
              className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold transition ${
                isAccountSection ? "bg-blue-600 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              <CircleUserRound size={18} />
              <span className="flex-1">Quản lý tài khoản</span>
              {isAccountMenuOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
            {isAccountMenuOpen && (
              <div className="ml-6 mt-1 space-y-1 border-l border-slate-700 pl-3">
                {([
                  { id: "staff-accounts", label: "Tài khoản nhân sự", icon: Users },
                  { id: "customer-accounts", label: "Tài khoản khách hàng", icon: CircleUserRound },
                ] as const).map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => handleSectionSelect(id)}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                      section === id ? "bg-blue-500/15 font-semibold text-blue-300" : "text-slate-400 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <Icon size={15} />
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </nav>

        <button type="button" onClick={onLogout} className="mt-4 flex shrink-0 items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-slate-400 transition hover:bg-white/5 hover:text-white">
          <LogOut size={18} />
          Đăng xuất
        </button>
      </aside>

      <main className="min-h-screen lg:pl-72">
        <header className="flex min-h-20 items-center justify-between border-b border-slate-200 bg-white px-5 sm:px-8">
          <div className="flex items-center gap-3 lg:hidden">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-600 text-white"><ShieldCheck size={20} /></span>
            <div>
              <p className="text-sm font-bold text-slate-900">SEN VIET</p>
              <p className="text-xs text-slate-500">Quản trị hệ thống</p>
            </div>
          </div>
          <p className="hidden text-sm font-semibold text-slate-500 lg:block">Cổng quản trị toàn hệ thống</p>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-slate-800">{fullName || "Quản trị viên"}</p>
              <p className="text-xs text-slate-500">{email || "ROLE_SUPER_ADMIN"}</p>
            </div>
            <span className="grid h-10 w-10 place-items-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
              {(fullName || email || "A").slice(0, 1).toLocaleUpperCase()}
            </span>
            <button type="button" onClick={onLogout} aria-label="Đăng xuất" title="Đăng xuất" className="grid h-10 w-10 place-items-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 lg:hidden">
              <LogOut size={18} />
            </button>
          </div>
        </header>
        <nav className="flex gap-2 overflow-x-auto border-b border-slate-200 bg-white px-4 py-2 lg:hidden" aria-label="Điều hướng quản trị">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button
              type="button"
              key={id}
              onClick={() => handleSectionSelect(id)}
              className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold ${
                section === id ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
          <button
            type="button"
            onClick={handleAccountMenuSelect}
            aria-expanded={isAccountMenuOpen}
            className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold ${
              isAccountSection ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <CircleUserRound size={15} />
            Quản lý tài khoản
            {isAccountMenuOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        </nav>
        {isAccountMenuOpen && (
          <nav className="flex gap-2 overflow-x-auto border-b border-slate-200 bg-slate-50 px-4 py-2 lg:hidden" aria-label="Quản lý tài khoản">
            {([
              { id: "staff-accounts", label: "Tài khoản nhân sự", icon: Users },
              { id: "customer-accounts", label: "Tài khoản khách hàng", icon: CircleUserRound },
            ] as const).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => handleSectionSelect(id)}
                className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold ${
                  section === id ? "bg-blue-100 text-blue-700" : "text-slate-600 hover:bg-white"
                }`}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </nav>
        )}
        {section === "branches" && isBranchMenuOpen && (
          <nav className="flex gap-2 overflow-x-auto border-b border-slate-200 bg-white px-4 py-2 lg:hidden" aria-label="Lọc chi nhánh theo tỉnh/thành">
            <button
              type="button"
              onClick={() => selectProvince("")}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${
                selectedProvinceId === "" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"
              }`}
            >
              Tổng chi nhánh
            </button>
            {provinces.map((province) => {
              const theme = getProvinceTheme(province.id);
              return (
              <button
                type="button"
                key={province.id}
                onClick={() => toggleProvinceGroup(province.id)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${selectedProvinceId === province.id ? theme.pillActive : theme.pillIdle}`}
              >
                {province.name} · {getBranchesForProvince(province.id).length}
              </button>
              );
            })}
          </nav>
        )}
        {section === "branches" && expandedBranchGroup !== null && (
          <nav className="flex gap-2 overflow-x-auto border-b border-slate-200 bg-slate-50 px-4 py-2 lg:hidden" aria-label="Chi nhánh">
            {getBranchesForProvince(expandedBranchGroup).map((branch) => (
              <button
                type="button"
                key={branch.id}
                onClick={() => openBranchDetails(branch)}
                className="flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
              >
                <Building2 size={12} className="text-blue-600" />
                {branch.name}
              </button>
            ))}
          </nav>
        )}

        <div className="relative isolate min-h-[calc(100vh-5rem)]">
          {section === "branches" && selectedProvinceId && selectedBranchId === null && (
            <>
              <img
                src={getProvinceCoverImage(selectedProvinceId)}
                alt=""
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 z-0 h-full w-full object-cover opacity-50"
                onError={(event) => {
                  if (!event.currentTarget.src.endsWith(DEFAULT_PROVINCE_COVER)) {
                    event.currentTarget.src = DEFAULT_PROVINCE_COVER;
                  }
                }}
              />
              <div className="pointer-events-none absolute inset-0 z-0 bg-white/30" />
            </>
          )}
          <div className="relative z-10 mx-auto max-w-7xl px-5 pt-4 pb-8 sm:px-8 sm:pt-5 sm:pb-10">
          {section !== "amenities" &&
            section !== "provinces" &&
            section !== "permissions" &&
            section !== "accounts-overview" &&
            section !== "staff-accounts" &&
            section !== "customer-accounts" && (
            <>
              {isBranchesError && (
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  <span>Không thể tải dữ liệu tổng quan. Hãy kiểm tra kết nối BE và quyền ROLE_SUPER_ADMIN.</span>
                  <button type="button" onClick={() => void refetchBranches()} className="font-semibold underline">Thử tải lại</button>
                </div>
              )}
              <section className="mt-0 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <SummaryCard label={selectedProvinceId && section === "branches" ? "Chi nhánh tại tỉnh/thành" : "Chi nhánh"} value={isProvinceDashboardLoading ? "..." : provinceDashboardBranches.length} icon={Building2} />
                <SummaryCard label={selectedProvinceId && section === "branches" ? "Nhân sự tại tỉnh/thành" : "Nhân sự toàn hệ thống"} value={isProvinceDashboardLoading ? "..." : selectedProvinceId && section === "branches" ? dashboardEmployees : totalEmployees} icon={Users} />
                <SummaryCard label={selectedProvinceId && section === "branches" ? "Lượt đặt phòng tại tỉnh/thành" : "Tổng lượt đặt phòng"} value={isProvinceDashboardLoading ? "..." : selectedProvinceId && section === "branches" ? dashboardBookings : totalBookings} icon={CalendarDays} />
                <SummaryCard label={selectedProvinceId && section === "branches" ? "Doanh thu tại tỉnh/thành" : "Tổng doanh thu đã thu"} value={isProvinceDashboardLoading ? "..." : formatMoney(selectedProvinceId && section === "branches" ? dashboardRevenue : totalRevenue)} icon={Wallet} />
              </section>
            </>
          )}

          {section === "overview" && (
            <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Chi nhánh</h2>
                  <p className="mt-1 text-sm text-slate-500">Tổng doanh thu tính theo số tiền đã thanh toán ở tất cả booking.</p>
                </div>
                <button type="button" onClick={() => handleSectionSelect("branches")} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Xem danh sách</button>
              </div>
              <BranchList branches={branches.slice(0, 5)} isLoading={isBranchesLoading} onSelect={openBranchDetailsById} />
            </section>
          )}

          {section === "branches" && selectedBranchId !== null && (
            <BranchDetailsPanel
              key={selectedBranchId}
              details={branchDetails}
              isLoading={isBranchDetailsLoading}
              isError={isBranchDetailsError}
              onBack={() => setSelectedBranchId(null)}
            />
          )}

          {section === "branches" && selectedBranchId === null && (
            <section
              className={`relative isolate mt-4 overflow-hidden rounded-2xl border border-white/70 shadow-sm ${
                selectedProvinceId ? "bg-white/55 backdrop-blur-[1px]" : "bg-white"
              }`}
            >
              <div className="relative z-10 p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">{selectedProvinceId ? `Chi nhánh tại ${provinces.find((province) => province.id === selectedProvinceId)?.name ?? "tỉnh/thành đã chọn"}` : "Tổng chi nhánh"}</h2>
                  <p className="mt-1 text-sm text-slate-500">Xem doanh thu, nhân viên, booking hoặc tạo chi nhánh mới.</p>
                </div>
                <button type="button" onClick={() => { setBranchFormError(""); setIsBranchFormOpen(true); }} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700">
                  <Plus size={16} /> Thêm chi nhánh
                </button>
              </div>
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-slate-500">
                  Đang xem: <span className="font-semibold text-slate-700">{selectedProvinceId ? provinces.find((province) => province.id === selectedProvinceId)?.name ?? "Tỉnh/thành đã chọn" : "Tất cả tỉnh/thành"}</span>
                </p>
                <button type="button" onClick={() => { setProvinceFormError(""); setIsProvinceFormOpen(true); }} className="inline-flex h-10 items-center gap-2 rounded-lg border border-blue-200 px-3 text-sm font-semibold text-blue-700 hover:bg-blue-50">
                  <Plus size={16} /> Thêm tỉnh/thành
                </button>
              </div>
              {isProvinceBranchesError && selectedProvinceId && <p role="alert" className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">Không thể tải khách sạn theo tỉnh/thành đã chọn.</p>}
              <BranchList
                branches={selectedProvinceId ? branchesByProvince : branches}
                isLoading={selectedProvinceId ? isProvinceBranchesLoading : isBranchesLoading}
                onSelect={openBranchDetailsById}
              />
              </div>
            </section>
          )}

          {section === "provinces" && (
            <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Danh sách tỉnh/thành</h2>
                  <p className="mt-1 text-sm text-slate-500">Có {provinces.length} tỉnh/thành trong hệ thống.</p>
                </div>
                <button
                  type="button"
                  onClick={() => { setProvinceFormError(""); setIsProvinceFormOpen(true); }}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
                >
                  <Plus size={16} /> Thêm tỉnh/thành
                </button>
              </div>
              {isProvincesLoading ? (
                <p className="py-10 text-center text-sm text-slate-500">Đang tải danh sách tỉnh/thành...</p>
              ) : isProvincesError ? (
                <p role="alert" className="py-10 text-center text-sm text-rose-600">Không thể tải danh sách tỉnh/thành.</p>
              ) : provinces.length === 0 ? (
                <p className="py-10 text-center text-sm text-slate-500">Chưa có tỉnh/thành nào.</p>
              ) : (
                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {provinces.map((province) => {
                    const provinceBranches = getBranchesForProvince(province.id);
                    const theme = getProvinceTheme(province.id);
                    const coverImage = getProvinceCoverImage(province.id);
                    return (
                      <article key={province.id} className={`overflow-hidden rounded-xl border transition hover:shadow-sm ${theme.card}`}>
                        <div className="relative h-28 overflow-hidden">
                          <img src={coverImage} alt={`Ảnh nền ${province.name}`} className="h-full w-full object-cover" />
                          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/35 via-transparent to-white/10" />
                          <span className="absolute bottom-3 left-4 inline-flex items-center gap-1.5 rounded-full bg-white/85 px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-sm backdrop-blur">
                            <MapPin size={13} className="text-blue-600" />
                            {province.name}
                          </span>
                          <label
                            htmlFor={`province-cover-${province.id}`}
                            className="absolute right-3 top-3 cursor-pointer rounded-lg bg-white/90 px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-white"
                          >
                            {uploadingProvinceId === province.id ? "Đang tải..." : "Đổi ảnh"}
                          </label>
                          <input
                            id={`province-cover-${province.id}`}
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            className="sr-only"
                            disabled={uploadingProvinceId === province.id}
                            onChange={(event) => {
                              const file = event.target.files?.[0];
                              void replaceProvinceBackground(province.id, province.name, file);
                              event.currentTarget.value = "";
                            }}
                          />
                        </div>
                        <div className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-start gap-3">
                              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${theme.icon}`}>
                                <MapPin size={18} />
                              </span>
                              <div className="min-w-0">
                                <h3 className="truncate font-semibold text-slate-900">{province.name}</h3>
                                <p className="mt-1 truncate text-xs text-slate-500">{province.id}</p>
                              </div>
                            </div>
                            <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${theme.badge}`}>
                              {provinceBranches.length} chi nhánh
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => selectProvince(province.id)}
                            className={`mt-4 w-full rounded-lg border px-3 py-2 text-sm font-semibold transition ${theme.button}`}
                          >
                            Xem chi nhánh
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
              {provinceCardUploadError && <p role="alert" className="mt-4 text-sm text-rose-600">{provinceCardUploadError}</p>}
            </section>
          )}

          {section === "amenities" && (
            <section className="mt-4 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <h2 className="text-lg font-bold text-slate-900">Danh mục tiện nghi dùng chung</h2>
                <p className="mt-1 text-sm text-slate-500">Danh sách này được các chi nhánh sử dụng chung.</p>
                {isAmenitiesLoading ? <p className="py-8 text-center text-sm text-slate-500">Đang tải danh sách...</p>
                  : isAmenitiesError ? <p className="py-8 text-center text-sm text-rose-600">Không thể tải danh sách tiện nghi.</p>
                    : amenities.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">Chưa có tiện nghi nào.</p>
                      : <div className="mt-4 divide-y divide-slate-100">
                        {amenities.map((amenity) => (
                          <div key={amenity.id} className="flex items-center justify-between gap-3 py-3">
                            <span className="font-medium text-slate-800">{amenity.name}</span>
                            <span className="text-sm font-semibold text-blue-700">{formatMoney(amenity.price)}</span>
                          </div>
                        ))}
                      </div>}
              </div>
              <form onSubmit={(event) => void submitAmenity(event)} className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <h2 className="text-lg font-bold text-slate-900">Thêm tiện nghi chung</h2>
                <label className="mt-4 block text-sm font-semibold text-slate-700">
                  Tên tiện nghi
                  <input required value={amenityName} onChange={(event) => setAmenityName(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none focus:border-blue-400" placeholder="Ví dụ: Hồ bơi" />
                </label>
                <label className="mt-3 block text-sm font-semibold text-slate-700">
                  Giá
                  <input required type="number" min="0" value={amenityPrice} onChange={(event) => setAmenityPrice(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none focus:border-blue-400" placeholder="0" />
                </label>
                {amenityError && <p role="alert" className="mt-3 text-sm text-rose-600">{amenityError}</p>}
                <button type="submit" disabled={isCreatingAmenity} className="mt-4 w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                  {isCreatingAmenity ? "Đang lưu..." : "Thêm vào danh mục chung"}
                </button>
              </form>
            </section>
          )}

          {(section === "accounts-overview" || section === "staff-accounts" || section === "customer-accounts") && (
            <SuperAdminAccountManagementPanel
              view={section === "staff-accounts" ? "staff" : section === "customer-accounts" ? "customers" : "all"}
            />
          )}

          {section === "permissions" && <SuperAdminRolePermissionsPanel />}

          <footer className="mt-10 flex items-center gap-2 border-t border-slate-200 pt-5 text-xs text-slate-400">
            <CircleUserRound size={14} />
            Chỉ tài khoản có role ROLE_SUPER_ADMIN mới truy cập được cổng này.
          </footer>
          </div>
        </div>
      </main>

      {isBranchFormOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/50 p-4" onMouseDown={() => setIsBranchFormOpen(false)}>
          <form onSubmit={(event) => void submitBranch(event)} onMouseDown={(event) => event.stopPropagation()} className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div><p className="text-xs font-bold uppercase tracking-wider text-blue-600">Quản lý chi nhánh</p><h2 className="mt-1 text-xl font-bold text-slate-900">Thêm chi nhánh mới</h2></div>
              <button type="button" onClick={() => setIsBranchFormOpen(false)} aria-label="Đóng" className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
            </div>
            <section className="mt-5 rounded-xl border border-slate-200 p-4">
              <h3 className="font-semibold text-slate-900">Thông tin chi nhánh</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-semibold text-slate-700">Tên chi nhánh<span className="text-rose-500" aria-hidden="true"> *</span><input required value={branchForm.name} onChange={(event) => setBranchForm({ ...branchForm, name: event.target.value })} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none focus:border-blue-400" /></label>
                <label className="text-sm font-semibold text-slate-700">Số điện thoại chi nhánh<span className="text-rose-500" aria-hidden="true"> *</span><input required type="tel" value={branchForm.phone} onChange={(event) => setBranchForm({ ...branchForm, phone: event.target.value })} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none focus:border-blue-400" /></label>
                <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Địa chỉ<span className="text-rose-500" aria-hidden="true"> *</span><input required value={branchForm.address} onChange={(event) => setBranchForm({ ...branchForm, address: event.target.value })} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none focus:border-blue-400" /></label>
                <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Tỉnh/thành<span className="text-rose-500" aria-hidden="true"> *</span>
                  <select required value={branchForm.provinceName} onChange={(event) => setBranchForm({ ...branchForm, provinceName: event.target.value })} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 font-normal outline-none focus:border-blue-400">
                    <option value="">Chọn tỉnh/thành</option>
                    {provinces.map((province) => <option key={province.id} value={province.name}>{province.name}</option>)}
                  </select>
                </label>
              </div>
            </section>
            <section className="mt-4 rounded-xl border border-slate-200 p-4">
              <h3 className="font-semibold text-slate-900">Tài khoản admin chi nhánh <span className="font-mono text-xs font-medium text-slate-500">(ROLE_ADMIN)</span></h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {branchAdminAccountFields.map((field) => (
                  <label key={field.key} className="text-sm font-semibold text-slate-700">
                    {field.label}<span className="text-rose-500" aria-hidden="true"> *</span>
                    <input
                      required
                      type={field.type}
                      autoComplete={field.autoComplete}
                      value={branchForm.adminAccount[field.key]}
                      onChange={(event) => setBranchForm((current) => ({
                        ...current,
                        adminAccount: { ...current.adminAccount, [field.key]: event.target.value },
                      }))}
                      className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none focus:border-blue-400"
                    />
                  </label>
                ))}
              </div>
            </section>
            {branchAccountSections.map(({ key, title }) => (
              <section key={key} className="mt-4 rounded-xl border border-slate-200 p-4">
                <h3 className="font-semibold text-slate-900">{title} <span className="font-mono text-xs font-medium text-slate-500">(ROLE_MANAGER)</span></h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {branchAccountFields.map((field) => (
                    <label key={field.key} className="text-sm font-semibold text-slate-700">
                      {field.label}<span className="text-rose-500" aria-hidden="true"> *</span>
                      <input
                        required
                        type={field.type}
                        autoComplete={field.autoComplete}
                        value={branchForm[key][field.key]}
                        onChange={(event) => setBranchForm((current) => ({
                          ...current,
                          [key]: { ...current[key], [field.key]: event.target.value },
                        }))}
                        className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none focus:border-blue-400"
                      />
                    </label>
                  ))}
                </div>
              </section>
            ))}
            {branchFormError && <p role="alert" className="mt-3 text-sm text-rose-600">{branchFormError}</p>}
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setIsBranchFormOpen(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Hủy</button>
              <button type="submit" disabled={isCreatingBranch || provinces.length === 0} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">{isCreatingBranch ? "Đang tạo..." : "Tạo chi nhánh"}</button>
            </div>
          </form>
        </div>
      )}

      {isProvinceFormOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4" onMouseDown={() => setIsProvinceFormOpen(false)}>
          <form onSubmit={(event) => void submitProvince(event)} onMouseDown={(event) => event.stopPropagation()} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div><p className="text-xs font-bold uppercase tracking-wider text-blue-600">Quản lý địa điểm</p><h2 className="mt-1 text-xl font-bold text-slate-900">Thêm tỉnh/thành</h2></div>
              <button type="button" onClick={() => setIsProvinceFormOpen(false)} aria-label="Đóng" className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
            </div>
            <label className="mt-5 block text-sm font-semibold text-slate-700">
              Tên tỉnh/thành
              <input required value={provinceName} onChange={(event) => setProvinceName(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none focus:border-blue-400" placeholder="Ví dụ: Hồ Chí Minh" />
            </label>
            <label className="mt-4 block text-sm font-semibold text-slate-700">
              Ảnh nền tỉnh/thành
              <input
                required
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => {
                  setProvinceBackgroundFile(event.target.files?.[0] ?? null);
                  setProvinceFormError("");
                }}
                className="mt-1.5 block w-full rounded-lg border border-slate-200 p-2 text-sm font-normal text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:font-semibold file:text-blue-700"
              />
              <span className="mt-1 block text-xs font-normal text-slate-500">JPG, PNG hoặc WebP, tối đa 5 MB. Ảnh sẽ được lưu trong thư mục riêng của tỉnh/thành trên Cloudinary.</span>
            </label>
            {provinceBackgroundFile && (
              <p className="mt-2 truncate text-xs text-slate-500">Đã chọn: {provinceBackgroundFile.name}</p>
            )}
            {isUploadingProvinceBackground && (
              <p role="status" className="mt-3 text-sm text-blue-700">Đang tải ảnh lên Cloudinary và lưu tỉnh/thành...</p>
            )}
            {provinceFormError && <p role="alert" className="mt-3 text-sm text-rose-600">{provinceFormError}</p>}
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setIsProvinceFormOpen(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Hủy</button>
              <button type="submit" disabled={isCreatingProvince || isUploadingProvinceBackground || !provinceName.trim() || !provinceBackgroundFile} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">{isUploadingProvinceBackground ? "Đang tải ảnh..." : isCreatingProvince ? "Đang tạo..." : "Thêm tỉnh/thành"}</button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}

function SummaryCard({ label, value, icon: Icon }: { label: string; value: number | string; icon: typeof Building2 }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-50 text-blue-700"><Icon size={18} /></span>
      </div>
      <p className="mt-3 text-2xl font-bold text-slate-900">{value}</p>
    </article>
  );
}

function BranchList({ branches, isLoading, onSelect }: { branches: SuperAdminBranch[]; isLoading: boolean; onSelect: (id: number) => void }) {
  if (isLoading) return <p className="py-8 text-center text-sm text-slate-500">Đang tải danh sách chi nhánh...</p>;
  if (branches.length === 0) return <p className="py-8 text-center text-sm text-slate-500">Chưa có chi nhánh.</p>;
  return (
    <div className="mt-4 divide-y divide-slate-100">
      {branches.map((branch) => (
        <article key={branch.id} className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h3 className="font-bold text-slate-900">{branch.name}</h3>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500"><MapPin size={14} />{[branch.address, branch.provinceName].filter(Boolean).join(", ")}</p>
            <p className="mt-2 text-xs text-slate-500">{branch.employeeCount} nhân sự · {branch.bookingCount} booking · {branch.phone}</p>
          </div>
          <div className="flex shrink-0 items-center gap-4">
            <p className="text-sm font-bold text-emerald-700">{formatMoney(Number(branch.totalRevenue) || 0)}</p>
            <button type="button" onClick={() => onSelect(branch.id)} className="rounded-lg border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50">Chi tiết</button>
          </div>
        </article>
      ))}
    </div>
  );
}

function BranchDetailsPanel({
  details,
  isLoading,
  isError,
  onBack,
}: {
  details?: SuperAdminBranchDetails;
  isLoading: boolean;
  isError: boolean;
  onBack: () => void;
}) {
  const [saveRoomPolicies, { isLoading: isSavingRoomPolicies }] = useSaveSuperAdminBranchRoomPoliciesMutation();
  const [roomPolicyMessage, setRoomPolicyMessage] = useState("");
  const [roomPolicyError, setRoomPolicyError] = useState("");
  const [activeCategory, setActiveCategory] = useState<BranchDetailCategory>("employees");

  const categories: { id: BranchDetailCategory; label: string; count: number; icon: typeof LayoutDashboard }[] = [
    { id: "employees", label: "Nhân viên", count: details?.employees.length ?? 0, icon: Users },
    { id: "buildings", label: "Tòa nhà", count: details?.buildings.length ?? 0, icon: Building2 },
    { id: "floors", label: "Tầng", count: details?.floors.length ?? 0, icon: LayoutDashboard },
    { id: "rooms", label: "Phòng", count: details?.rooms.length ?? 0, icon: Building2 },
    { id: "bookings", label: "Booking", count: details?.bookings.length ?? 0, icon: CalendarDays },
    { id: "services", label: "Dịch vụ", count: details?.services.length ?? 0, icon: ShieldCheck },
    { id: "promotions", label: "Khuyến mãi", count: details?.promotions.length ?? 0, icon: Wallet },
    { id: "roomPolicies", label: "Cấu hình loại phòng", count: details?.roomPolicies.length ?? 0, icon: ShieldCheck },
  ];

  const activeCategoryInfo = categories.find((category) => category.id === activeCategory) ?? categories[0];

  return (
    <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
          <h2 className="text-xl font-bold text-slate-900">{details?.branch.name ?? "Chi tiết chi nhánh"}</h2>
          {details && (
            <p className="flex items-start gap-1.5 text-sm text-slate-500">
              <MapPin size={16} className="mt-0.5 shrink-0 text-blue-600" />
              <span>{[details.branch.address, details.branch.provinceName].filter(Boolean).join(", ")}</span>
            </p>
          )}
        </div>
        <button type="button" onClick={onBack} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
          Quay lại danh sách
        </button>
      </div>
        {isLoading ? <p className="py-12 text-center text-sm text-slate-500">Đang tải chi tiết chi nhánh...</p>
          : isError || !details ? <p role="alert" className="py-12 text-center text-sm text-rose-600">Không thể tải hồ sơ chi nhánh.</p>
            : <>
              <div className="mt-6 grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
                <nav className="flex gap-2 overflow-x-auto rounded-xl bg-slate-50 p-1 md:flex-col md:gap-1" aria-label="Danh mục chi tiết chi nhánh">
                  {categories.map(({ id, label, count, icon: Icon }) => (
                    <button
                      type="button"
                      key={id}
                      onClick={() => setActiveCategory(id)}
                      aria-current={activeCategory === id ? "page" : undefined}
                      className={`flex shrink-0 items-center gap-2 rounded-lg px-2 py-2.5 text-left text-xs font-semibold transition md:grid md:w-full md:grid-cols-[17px_minmax(0,1fr)_28px] md:gap-2 md:px-1 ${
                        activeCategory === id
                          ? "bg-blue-600 text-white shadow-sm shadow-blue-900/15"
                          : "text-slate-600 hover:bg-white hover:text-slate-900"
                      }`}
                    >
                      <Icon size={17} className="shrink-0" />
                      <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{label}</span>
                      <span className={`flex h-5 w-7 shrink-0 items-center justify-center rounded-full text-xs md:justify-self-end ${
                        activeCategory === id ? "bg-white/20 text-white" : "bg-slate-200/70 text-slate-500"
                      }`}>{count}</span>
                    </button>
                  ))}
                </nav>
                <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
                  <div className="mb-4 border-b border-slate-100 pb-4">
                    <h3 className="mt-1 text-lg font-bold text-slate-900">{activeCategoryInfo.label}</h3>
                    <p className="mt-1 text-sm text-slate-500">{activeCategoryInfo.count} mục</p>
                  </div>
                  {activeCategory === "employees" && (
                    <DetailList count={details.employees.length}>
                      {details.employees.map((employee) => <DetailRow key={employee.id} title={employee.fullName} subtitle={`${employee.position || "Nhân viên"} · ${employee.email} · ${employee.phone || "Chưa có SĐT"}`} />)}
                    </DetailList>
                  )}
                  {activeCategory === "buildings" && (
                    <DetailList count={details.buildings.length}>
                      {details.buildings.map((building) => <DetailRow key={building.id} title={building.name} subtitle={`${building.floorCount} tầng · Mã ${building.id}`} />)}
                    </DetailList>
                  )}
                  {activeCategory === "floors" && (
                    <DetailList count={details.floors.length}>
                      {details.floors.map((floor) => <DetailRow key={floor.id} title={`Tầng ${floor.floorNumber}`} subtitle={`${floor.buildingName} · ${floor.roomCount} phòng · ${floor.id}`} />)}
                    </DetailList>
                  )}
                  {activeCategory === "rooms" && (
                    <DetailList count={details.rooms.length}>
                      {details.rooms.map((room) => <DetailRow key={room.id} title={`Phòng ${room.roomNumber}`} subtitle={`${room.buildingName} · Tầng ${room.floorNumber} · ${room.roomType || "Chưa phân loại"} · ${room.roomStatus || "Chưa có trạng thái"}`} />)}
                    </DetailList>
                  )}
                  {activeCategory === "bookings" && (
                    <DetailList count={details.bookings.length}>
                      {details.bookings.map((booking, index) => <DetailRow key={booking.bookingId ?? index} title={`${booking.bookingId || "Booking"} · ${booking.customerName || "Khách"}`} subtitle={`${booking.bookingStatus || "N/A"} · ${booking.createdAt ? new Date(booking.createdAt).toLocaleString("vi-VN") : "Không có ngày tạo"} · Đã thu ${formatMoney(Number(booking.paidAmount) || 0)}`} />)}
                    </DetailList>
                  )}
                  {activeCategory === "services" && (
                    <DetailList count={details.services.length}>
                      {details.services.map((service) => <DetailRow key={service.id} title={service.name} subtitle={`${service.category || "Chưa phân loại"} · ${service.price == null ? "Chưa có giá" : formatMoney(service.price)}${service.unit ? `/${service.unit}` : ""} · ${service.shared ? "Dùng chung" : "Riêng chi nhánh"}`} />)}
                    </DetailList>
                  )}
                  {activeCategory === "promotions" && (
                    <DetailList count={details.promotions.length}>
                      {details.promotions.map((promotion) => <DetailRow key={promotion.id} title={`${promotion.name} · ${promotion.code}`} subtitle={`${promotion.status || "N/A"} · ${promotion.startDate ? new Date(promotion.startDate).toLocaleDateString("vi-VN") : "?"} – ${promotion.endDate ? new Date(promotion.endDate).toLocaleDateString("vi-VN") : "?"}`} />)}
                    </DetailList>
                  )}
                  {activeCategory === "roomPolicies" && (
                    <RoomPolicyEditor
                      hotelId={details.branch.id}
                      policies={details.roomPolicies ?? []}
                      isSaving={isSavingRoomPolicies}
                      message={roomPolicyMessage}
                      error={roomPolicyError}
                      onSave={async (policy) => {
                        setRoomPolicyMessage("");
                        setRoomPolicyError("");
                        try {
                          await saveRoomPolicies({ hotelId: details.branch.id, policies: [policy] }).unwrap();
                          setRoomPolicyMessage(`${roomTypeNames[policy.roomType]} đã được lưu cho chi nhánh.`);
                        } catch (error) {
                          setRoomPolicyError(getErrorMessage(error, "Không thể lưu cấu hình loại phòng."));
                        }
                      }}
                    />
                  )}
                </div>
              </div>
            </>}
    </section>
  );
}

const roomTypeNames: Record<SuperAdminRoomPolicy["roomType"], string> = {
  STANDARD: "Phòng tiêu chuẩn",
  DELUXE: "Phòng cao cấp",
  SUITE: "Phòng thượng hạng",
  FAMILY: "Phòng gia đình",
};

const roomTypes = Object.keys(roomTypeNames) as SuperAdminRoomPolicy["roomType"][];

function RoomPolicyEditor({
  hotelId,
  policies,
  isSaving,
  message,
  error,
  onSave,
}: {
  hotelId: number;
  policies: SuperAdminRoomPolicy[];
  isSaving: boolean;
  message: string;
  error: string;
  onSave: (policy: SuperAdminRoomPolicy) => Promise<void>;
}) {
  const [drafts, setDrafts] = useState<Record<SuperAdminRoomPolicy["roomType"], SuperAdminRoomPolicy>>(() =>
    Object.fromEntries(roomTypes.map((roomType) => {
      const current = policies.find((item) => item.roomType === roomType);
      return [roomType, current ?? {
        roomType,
        area: 0,
        basePrice: 0,
        extraAdultFee: 0,
        extraChildFee: 0,
        standardCapacity: 2,
        maxExtraGuests: 0,
      }];
    })) as Record<SuperAdminRoomPolicy["roomType"], SuperAdminRoomPolicy>,
  );

  useEffect(() => {
    setDrafts(Object.fromEntries(roomTypes.map((roomType) => {
      const current = policies.find((item) => item.roomType === roomType);
      return [roomType, current ?? {
        roomType,
        area: 0,
        basePrice: 0,
        extraAdultFee: 0,
        extraChildFee: 0,
        standardCapacity: 2,
        maxExtraGuests: 0,
      }];
    })) as Record<SuperAdminRoomPolicy["roomType"], SuperAdminRoomPolicy>);
  }, [hotelId, policies]);

  const change = (roomType: SuperAdminRoomPolicy["roomType"], field: keyof Omit<SuperAdminRoomPolicy, "id" | "roomType">, value: string) => {
    setDrafts((current) => ({
      ...current,
      [roomType]: { ...current[roomType], [field]: Number(value) },
    }));
  };

  return (
    <section className="rounded-xl border border-blue-100 bg-blue-50/40 p-4 md:col-span-2">
      <p className="mt-1 text-xs leading-5 text-slate-500">Super Admin thiết lập ban đầu. Quản lý chi nhánh có thể điều chỉnh lại trong phần cấu hình giá.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {roomTypes.map((roomType) => {
          const policy = drafts[roomType];
          const exists = policies.some((item) => item.roomType === roomType);
          return (
            <div key={roomType} className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-sm font-bold text-slate-800">{roomTypeNames[roomType]}</p>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${exists ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{exists ? "Đã cấu hình" : "Chưa cấu hình"}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <PolicyInput label="Giá cơ bản" value={policy.basePrice} onChange={(value) => change(roomType, "basePrice", value)} />
                <PolicyInput label="Diện tích (m²)" value={policy.area} onChange={(value) => change(roomType, "area", value)} />
                <PolicyInput label="Sức chứa chuẩn" value={policy.standardCapacity} min={1} onChange={(value) => change(roomType, "standardCapacity", value)} />
                <PolicyInput label="Khách thêm tối đa" value={policy.maxExtraGuests} onChange={(value) => change(roomType, "maxExtraGuests", value)} />
                <PolicyInput label="Phụ thu người lớn" value={policy.extraAdultFee} onChange={(value) => change(roomType, "extraAdultFee", value)} />
                <PolicyInput label="Phụ thu trẻ em" value={policy.extraChildFee} onChange={(value) => change(roomType, "extraChildFee", value)} />
              </div>
              <button
                type="button"
                disabled={isSaving || policy.area <= 0 || policy.basePrice < 0 || policy.standardCapacity < 1}
                onClick={() => void onSave(policy)}
                className="mt-3 w-full rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSaving ? "Đang lưu..." : exists ? "Cập nhật cấu hình" : "Thêm cấu hình"}
              </button>
            </div>
          );
        })}
      </div>
      {message && <p role="status" className="mt-3 text-sm font-medium text-emerald-700">{message}</p>}
      {error && <p role="alert" className="mt-3 text-sm font-medium text-rose-700">{error}</p>}
    </section>
  );
}

function PolicyInput({ label, value, min = 0, onChange }: { label: string; value: number; min?: number; onChange: (value: string) => void }) {
  return (
    <label className="block text-[11px] font-medium text-slate-500">
      {label}
      <input type="number" min={min} step="any" value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 h-9 w-full rounded-md border border-slate-200 px-2 text-xs text-slate-800 outline-none focus:border-blue-400" />
    </label>
  );
}

type BranchDetailCategory = "employees" | "buildings" | "floors" | "rooms" | "bookings" | "services" | "promotions" | "roomPolicies";

function DetailList({ count, children }: { count: number; children: React.ReactNode }) {
  return (
    <section className="min-w-0">
      <div className="max-h-[32rem] overflow-y-auto pr-1">
        {count === 0 ? <p className="py-8 text-center text-sm text-slate-500">Chưa có dữ liệu trong danh mục này.</p> : children}
      </div>
    </section>
  );
}

function DetailRow({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="border-b border-slate-100 py-2.5 last:border-0">
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      <p className="mt-1 break-words text-xs leading-5 text-slate-500">{subtitle}</p>
    </div>
  );
}
