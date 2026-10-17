import { useMemo, useState } from "react";
import { BarChart3, Building2, CalendarDays, ConciergeBell, Search, Tag, Wallet, XCircle } from "lucide-react";
import type { SuperAdminBranch } from "../services/superAdminApi";

type Props = {
  branches: SuperAdminBranch[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
};

const StatCard = ({
  label,
  value,
  detail,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: typeof Building2;
  color: string;
}) => (
  <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">{value}</p>
        <p className="mt-1 text-xs text-slate-400">{detail}</p>
      </div>
      <span className={`grid h-11 w-11 place-items-center rounded-xl ${color}`}>
        <Icon size={20} />
      </span>
    </div>
  </article>
);

export default function SuperAdminResourceStatsPanel({ branches, isLoading, isError, onRetry }: Props) {
  const [search, setSearch] = useState("");
  const normalizedSearch = search.trim().toLocaleLowerCase("vi-VN");
  const visibleBranches = useMemo(
    () => branches.filter((branch) =>
      `${branch.name} ${branch.address} ${branch.provinceName ?? ""}`.toLocaleLowerCase("vi-VN").includes(normalizedSearch),
    ),
    [branches, normalizedSearch],
  );
  const totalBookings = branches.reduce((total, branch) => total + (Number(branch.bookingCount) || 0), 0);
  const totalRevenue = branches.reduce((total, branch) => total + (Number(branch.totalRevenue) || 0), 0);
  const formatCount = (value: number) => new Intl.NumberFormat("vi-VN").format(value);
  const formatMoney = (value: number) => `${new Intl.NumberFormat("vi-VN").format(value)}đ`;

  return (
    <section className="mt-2 space-y-5" aria-labelledby="resource-stats-title">
      <header className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700">
            <BarChart3 size={21} />
          </span>
          <div>
            <h2 id="resource-stats-title" className="text-lg font-bold text-slate-900">Thống kê toàn hệ thống</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
              Theo dõi booking, doanh thu và số lượng dịch vụ, khuyến mãi theo từng chi nhánh.
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800">
          <span className="h-2 w-2 rounded-full bg-amber-500" />
          Một số chỉ số đang chờ API BE
        </span>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Chi nhánh"
          value={isLoading ? "…" : isError ? "—" : branches.length}
          detail="Trong hệ thống"
          icon={Building2}
          color="bg-blue-50 text-blue-700"
        />
        <StatCard
          label="Số lượt đặt phòng"
          value={isLoading || isError ? "—" : formatCount(totalBookings)}
          detail="Tổng booking tại các chi nhánh"
          icon={CalendarDays}
          color="bg-cyan-50 text-cyan-700"
        />
        <StatCard
          label="Tiền booking đã thu"
          value={isLoading || isError ? "—" : formatMoney(totalRevenue)}
          detail="Tổng doanh thu đã thanh toán"
          icon={Wallet}
          color="bg-amber-50 text-amber-700"
        />
        <StatCard
          label="Booking đã hủy"
          value="—"
          detail="Chờ dữ liệu trạng thái hủy từ API"
          icon={XCircle}
          color="bg-rose-50 text-rose-700"
        />
        <StatCard
          label="Tổng dịch vụ"
          value="—"
          detail="Chờ dữ liệu từ API"
          icon={ConciergeBell}
          color="bg-violet-50 text-violet-700"
        />
        <StatCard
          label="Tổng khuyến mãi"
          value="—"
          detail="Chờ dữ liệu từ API"
          icon={Tag}
          color="bg-emerald-50 text-emerald-700"
        />
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-bold text-slate-900">Thống kê theo chi nhánh</h3>
            <p className="mt-1 text-sm text-slate-500">Booking và doanh thu đã lấy từ dữ liệu chi nhánh; các chỉ số còn lại sẽ nối API BE.</p>
          </div>
          <label className="relative block w-full sm:w-72">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm chi nhánh..."
              aria-label="Tìm chi nhánh trong thống kê"
              className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </label>
        </div>

        {isLoading ? (
          <p className="p-10 text-center text-sm text-slate-500">Đang tải danh sách chi nhánh...</p>
        ) : isError ? (
          <div className="p-10 text-center">
            <p role="alert" className="text-sm text-rose-600">Không thể tải danh sách chi nhánh.</p>
            <button type="button" onClick={onRetry} className="mt-3 text-sm font-semibold text-blue-700 hover:underline">Thử tải lại</button>
          </div>
        ) : branches.length === 0 ? (
          <p className="p-10 text-center text-sm text-slate-500">Chưa có chi nhánh trong hệ thống.</p>
        ) : visibleBranches.length === 0 ? (
          <p className="p-10 text-center text-sm text-slate-500">Không tìm thấy chi nhánh phù hợp.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] text-left">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="px-5 py-3">Chi nhánh</th>
                  <th scope="col" className="px-5 py-3">Tỉnh / thành</th>
                  <th scope="col" className="px-5 py-3 text-right">Lượt đặt phòng</th>
                  <th scope="col" className="px-5 py-3 text-right">Booking đã hủy</th>
                  <th scope="col" className="px-5 py-3 text-right">Tiền đã thu</th>
                  <th scope="col" className="px-5 py-3 text-center">Dịch vụ</th>
                  <th scope="col" className="px-5 py-3 text-center">Khuyến mãi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleBranches.map((branch) => (
                  <tr key={branch.id} className="transition hover:bg-slate-50/70">
                    <th scope="row" className="px-5 py-4 font-semibold text-slate-800">
                      <div className="flex items-center gap-3">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-700">
                          <Building2 size={16} />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate">{branch.name}</p>
                          <p className="mt-0.5 max-w-64 truncate text-xs font-normal text-slate-400">{branch.address || "Chưa có địa chỉ"}</p>
                        </div>
                      </div>
                    </th>
                    <td className="px-5 py-4 text-sm text-slate-600">{branch.provinceName || "—"}</td>
                    <td className="px-5 py-4 text-right text-sm font-semibold tabular-nums text-slate-700">{formatCount(Number(branch.bookingCount) || 0)}</td>
                    <td className="px-5 py-4 text-right text-sm font-semibold tabular-nums text-rose-700">—</td>
                    <td className="whitespace-nowrap px-5 py-4 text-right text-sm font-semibold tabular-nums text-slate-800">{formatMoney(Number(branch.totalRevenue) || 0)}</td>
                    <td className="px-5 py-4 text-center">
                      <span className="inline-flex min-w-12 justify-center rounded-lg bg-violet-50 px-3 py-1.5 text-sm font-bold text-violet-700">—</span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className="inline-flex min-w-12 justify-center rounded-lg bg-emerald-50 px-3 py-1.5 text-sm font-bold text-emerald-700">—</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!isLoading && !isError && branches.length > 0 && (
          <div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-400">
            Hiển thị {visibleBranches.length} / {branches.length} chi nhánh
          </div>
        )}
      </section>
    </section>
  );
}
