import { useMemo, useState } from "react";
import {
  Building2,
  CalendarDays,
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
import { useAppSelector } from "../store/hooks";
import {
  useCreateSuperAdminBranchMutation,
  useGetSuperAdminBranchDetailsQuery,
  useGetSuperAdminBranchesQuery,
  useGetSuperAdminProvincesQuery,
  type SuperAdminBranch,
} from "../services/superAdminApi";
import { useCreateSharedAmenityMutation, useGetAllAmenitiesQuery } from "../services/amenityApi";

type AdminSection = "overview" | "branches" | "amenities";

const formatMoney = (amount: number) => `${amount.toLocaleString("vi-VN")} đ`;

const getErrorMessage = (error: unknown, fallback: string) => {
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

const initialBranchForm = { name: "", address: "", phone: "", provinceName: "" };

type AdminDashboardPageProps = {
  onLogout: () => void;
};

export default function AdminDashboardPage({ onLogout }: AdminDashboardPageProps) {
  const { fullName, email } = useAppSelector((state) => state.auth);
  const [section, setSection] = useState<AdminSection>("overview");
  const [isBranchFormOpen, setIsBranchFormOpen] = useState(false);
  const [branchForm, setBranchForm] = useState(initialBranchForm);
  const [branchFormError, setBranchFormError] = useState("");
  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null);
  const [amenityName, setAmenityName] = useState("");
  const [amenityPrice, setAmenityPrice] = useState("");
  const [amenityError, setAmenityError] = useState("");
  const {
    data: branches = [],
    isLoading: isBranchesLoading,
    isError: isBranchesError,
    refetch: refetchBranches,
  } = useGetSuperAdminBranchesQuery();
  const { data: provinces = [] } = useGetSuperAdminProvincesQuery();
  const [createBranch, { isLoading: isCreatingBranch }] = useCreateSuperAdminBranchMutation();
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
    { id: "amenities", label: "Tiện nghi dùng chung", icon: ShieldCheck },
  ];

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

        <nav className="mt-12 space-y-2" aria-label="Điều hướng quản trị">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button
              type="button"
              key={id}
              onClick={() => setSection(id)}
              className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold transition ${
                section === id ? "bg-blue-600 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </nav>

        <button type="button" onClick={onLogout} className="mt-auto flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-slate-400 transition hover:bg-white/5 hover:text-white">
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
              onClick={() => setSection(id)}
              className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold ${
                section === id ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </nav>

        <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-10">
          <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-blue-950 to-blue-800 p-7 text-white shadow-xl shadow-blue-950/10 sm:p-9">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-blue-100">
              <ShieldCheck size={14} /> ADMIN TỔNG
            </span>
            <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
              {section === "branches" ? "Quản lý chi nhánh" : section === "amenities" ? "Tiện nghi dùng chung" : "Tổng quan hệ thống"}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100/80">
              {section === "amenities"
                ? "Danh mục tiện nghi được sử dụng chung trong toàn bộ hệ thống khách sạn."
                : "Theo dõi hoạt động, nhân sự, đặt phòng và doanh thu của tất cả chi nhánh."}
            </p>
          </section>

          {section !== "amenities" && (
            <>
              {isBranchesError && (
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  <span>Không thể tải dữ liệu tổng quan. Hãy kiểm tra kết nối BE và quyền ROLE_SUPER_ADMIN.</span>
                  <button type="button" onClick={() => void refetchBranches()} className="font-semibold underline">Thử tải lại</button>
                </div>
              )}
              <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <SummaryCard label="Chi nhánh" value={isBranchesLoading ? "..." : branches.length} icon={Building2} />
                <SummaryCard label="Nhân sự toàn hệ thống" value={isBranchesLoading ? "..." : totalEmployees} icon={Users} />
                <SummaryCard label="Tổng lượt đặt phòng" value={isBranchesLoading ? "..." : totalBookings} icon={CalendarDays} />
                <SummaryCard label="Tổng doanh thu đã thu" value={isBranchesLoading ? "..." : formatMoney(totalRevenue)} icon={Wallet} />
              </section>
            </>
          )}

          {section === "overview" && (
            <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Chi nhánh</h2>
                  <p className="mt-1 text-sm text-slate-500">Tổng doanh thu tính theo số tiền đã thanh toán ở tất cả booking.</p>
                </div>
                <button type="button" onClick={() => setSection("branches")} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Xem danh sách</button>
              </div>
              <BranchList branches={branches.slice(0, 5)} isLoading={isBranchesLoading} onSelect={setSelectedBranchId} />
            </section>
          )}

          {section === "branches" && (
            <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Danh sách chi nhánh</h2>
                  <p className="mt-1 text-sm text-slate-500">Xem doanh thu, nhân viên, booking hoặc tạo chi nhánh mới.</p>
                </div>
                <button type="button" onClick={() => { setBranchFormError(""); setIsBranchFormOpen(true); }} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700">
                  <Plus size={16} /> Thêm chi nhánh
                </button>
              </div>
              <BranchList branches={branches} isLoading={isBranchesLoading} onSelect={setSelectedBranchId} />
            </section>
          )}

          {section === "amenities" && (
            <section className="mt-8 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
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

          <footer className="mt-10 flex items-center gap-2 border-t border-slate-200 pt-5 text-xs text-slate-400">
            <CircleUserRound size={14} />
            Chỉ tài khoản có role ROLE_SUPER_ADMIN mới truy cập được cổng này.
          </footer>
        </div>
      </main>

      {isBranchFormOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/50 p-4" onMouseDown={() => setIsBranchFormOpen(false)}>
          <form onSubmit={(event) => void submitBranch(event)} onMouseDown={(event) => event.stopPropagation()} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div><p className="text-xs font-bold uppercase tracking-wider text-blue-600">Quản lý chi nhánh</p><h2 className="mt-1 text-xl font-bold text-slate-900">Thêm chi nhánh mới</h2></div>
              <button type="button" onClick={() => setIsBranchFormOpen(false)} aria-label="Đóng" className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
            </div>
            <label className="mt-5 block text-sm font-semibold text-slate-700">Tên chi nhánh<input required value={branchForm.name} onChange={(event) => setBranchForm({ ...branchForm, name: event.target.value })} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none focus:border-blue-400" /></label>
            <label className="mt-3 block text-sm font-semibold text-slate-700">Địa chỉ<input required value={branchForm.address} onChange={(event) => setBranchForm({ ...branchForm, address: event.target.value })} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none focus:border-blue-400" /></label>
            <label className="mt-3 block text-sm font-semibold text-slate-700">Số điện thoại<input required value={branchForm.phone} onChange={(event) => setBranchForm({ ...branchForm, phone: event.target.value })} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none focus:border-blue-400" /></label>
            <label className="mt-3 block text-sm font-semibold text-slate-700">Tỉnh/thành
              <select required value={branchForm.provinceName} onChange={(event) => setBranchForm({ ...branchForm, provinceName: event.target.value })} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 font-normal outline-none focus:border-blue-400">
                <option value="">Chọn tỉnh/thành</option>
                {provinces.map((province) => <option key={province.id} value={province.name}>{province.name}</option>)}
              </select>
            </label>
            {branchFormError && <p role="alert" className="mt-3 text-sm text-rose-600">{branchFormError}</p>}
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setIsBranchFormOpen(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Hủy</button>
              <button type="submit" disabled={isCreatingBranch || provinces.length === 0} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">{isCreatingBranch ? "Đang tạo..." : "Tạo chi nhánh"}</button>
            </div>
          </form>
        </div>
      )}

      {selectedBranchId !== null && (
        <BranchDetailsModal
          details={branchDetails}
          isLoading={isBranchDetailsLoading}
          isError={isBranchDetailsError}
          onClose={() => setSelectedBranchId(null)}
        />
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

function BranchDetailsModal({
  details,
  isLoading,
  isError,
  onClose,
}: {
  details?: { branch: SuperAdminBranch; employees: { id: string; fullName: string; email: string; phone?: string; position?: string }[]; bookings: { bookingId?: string; bookingStatus?: string; bookingChannel?: string; customerName?: string; createdAt?: string; paidAmount?: number; remainingAmount?: number }[] };
  isLoading: boolean;
  isError: boolean;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/50 p-4" onMouseDown={onClose}>
      <section onMouseDown={(event) => event.stopPropagation()} className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-blue-600">Hồ sơ chi nhánh</p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">{details?.branch.name ?? "Chi tiết chi nhánh"}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Đóng" className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
        </div>
        {isLoading ? <p className="py-12 text-center text-sm text-slate-500">Đang tải chi tiết chi nhánh...</p>
          : isError || !details ? <p role="alert" className="py-12 text-center text-sm text-rose-600">Không thể tải hồ sơ chi nhánh.</p>
            : <>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Địa chỉ</p><p className="mt-1 text-sm font-semibold">{details.branch.address}, {details.branch.provinceName}</p></div>
                <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Nhân sự</p><p className="mt-1 text-sm font-semibold">{details.employees.length}</p></div>
                <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Doanh thu đã thu</p><p className="mt-1 text-sm font-semibold text-emerald-700">{formatMoney(Number(details.branch.totalRevenue) || 0)}</p></div>
              </div>
              <div className="mt-6 grid gap-6 lg:grid-cols-2">
                <div>
                  <h3 className="font-bold text-slate-900">Nhân viên ({details.employees.length})</h3>
                  {details.employees.length === 0 ? <p className="py-5 text-sm text-slate-500">Chưa có nhân viên.</p> : <div className="mt-2 max-h-72 overflow-auto rounded-xl border border-slate-100">
                    {details.employees.map((employee) => <div key={employee.id} className="border-b border-slate-100 px-3 py-3 last:border-0"><p className="text-sm font-semibold text-slate-800">{employee.fullName}</p><p className="mt-1 text-xs text-slate-500">{employee.position || "Nhân viên"} · {employee.email} · {employee.phone || "Chưa có SĐT"}</p></div>)}
                  </div>}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">Booking ({details.bookings.length})</h3>
                  {details.bookings.length === 0 ? <p className="py-5 text-sm text-slate-500">Chưa có booking.</p> : <div className="mt-2 max-h-72 overflow-auto rounded-xl border border-slate-100">
                    {details.bookings.map((booking, index) => <div key={booking.bookingId ?? index} className="border-b border-slate-100 px-3 py-3 last:border-0"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold text-slate-800">{booking.bookingId || "Booking"} · {booking.customerName || "Khách"}</p><span className="text-xs font-semibold text-blue-700">{booking.bookingStatus || "N/A"}</span></div><p className="mt-1 text-xs text-slate-500">{booking.createdAt ? new Date(booking.createdAt).toLocaleString("vi-VN") : "Không có ngày tạo"} · Đã thu {formatMoney(Number(booking.paidAmount) || 0)}</p></div>)}
                  </div>}
                </div>
              </div>
            </>}
      </section>
    </div>
  );
}
