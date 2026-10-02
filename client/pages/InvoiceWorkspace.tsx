import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Clock3,
  Download,
  Search,
  WalletCards,
  Receipt,
  X,
  CreditCard,
  User,
  Phone,
} from "lucide-react";
import {
  useGetOrdersQuery,
  useCloseOrderMutation,
  type OrderResponse,
} from "../services/orderApi";
import { useGetEmployeesByHotelQuery } from "../services/employeeApi";

type InvoiceItem = {
  id: string;
  guest: string;
  phone: string;
  room: string;
  dates: string;
  amount: number;
  method: string;
  status: string;
  stay: string;
  rawOrder?: OrderResponse;
};

const initialInvoices: InvoiceItem[] = [
  { id: "INV-2026-00842", guest: "Nguyễn Minh Anh", phone: "090 123 4567", room: "101 · Deluxe King", dates: "08/09/2026 – 10/09/2026", amount: 2750000, method: "creditCard", status: "paid", stay: "upcoming" },
  { id: "INV-2026-00841", guest: "Phạm Gia Huy", phone: "091 234 5678", room: "103 · Executive", dates: "06/09/2026 – 09/09/2026", amount: 5550000, method: "bankTransfer", status: "paid", stay: "current" },
  { id: "INV-2026-00840", guest: "Trần Thùy Dương", phone: "098 765 4321", room: "102 · Deluxe Twin", dates: "08/09/2026 – 12/09/2026", amount: 5000000, method: "atCounter", status: "pending", stay: "upcoming" },
  { id: "INV-2026-00839", guest: "Công ty VinaTech", phone: "028 3322 1100", room: "201 · Suite Garden", dates: "05/09/2026 – 07/09/2026", amount: 4900000, method: "bankTransfer", status: "paid", stay: "checkedOut" },
  { id: "INV-2026-00838", guest: "Đỗ Khánh Linh", phone: "093 456 7890", room: "202 · Suite Garden", dates: "04/09/2026 – 06/09/2026", amount: 4900000, method: "creditCard", status: "refunded", stay: "checkedOut" },
];

const cleaningStaff = ["Nguyễn Thị Mai", "Lê Thị Hương", "Phạm Ngọc Anh", "Trần Minh Tú"];
const money = (value: number) => Number(value || 0).toLocaleString("vi-VN") + "đ";
const paymentStyle: Record<string, string> = {
  paid: "bg-emerald-50 text-emerald-700",
  pending: "bg-amber-50 text-amber-700",
  refunded: "bg-slate-100 text-slate-500",
};
const stayStyle: Record<string, string> = {
  upcoming: "bg-blue-50 text-blue-700",
  current: "bg-blue-50 text-blue-700",
  checkedOut: "bg-slate-100 text-slate-500",
};

export default function InvoiceWorkspace() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // API Backend kết nối thực tế
  const { data: realOrders = [], isLoading: isOrdersLoading, refetch } = useGetOrdersQuery();
  const { data: apiEmployees = [] } = useGetEmployeesByHotelQuery(1);
  const [closeOrder] = useCloseOrderMutation();

  const cleaningStaffList = useMemo(() => {
    if (apiEmployees && apiEmployees.length > 0) {
      const hk = apiEmployees
        .filter((e) => {
          const pos = (e.position || "").toLowerCase();
          return pos.includes("buồng") || pos.includes("phòng") || pos.includes("housekeeping");
        })
        .map((e) => e.fullName);
      return hk.length > 0 ? hk : apiEmployees.map((e) => e.fullName);
    }
    return cleaningStaff;
  }, [apiEmployees]);

  const [invoices, setInvoices] = useState<InvoiceItem[]>(initialInvoices);
  const [query, setQuery] = useState("");
  const [payment, setPayment] = useState("all");
  const [checkoutInvoice, setCheckoutInvoice] = useState<InvoiceItem | null>(null);
  const [detailInvoice, setDetailInvoice] = useState<InvoiceItem | null>(null);
  const [cleaner, setCleaner] = useState(cleaningStaffList[0] || "Đặng Thị Cẩm Tú");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    if (cleaningStaffList.length > 0 && !cleaningStaffList.includes(cleaner)) {
      setCleaner(cleaningStaffList[0]);
    }
  }, [cleaningStaffList]);

  const label = (key: string) => t(`invoice.${key}`);

  // Đồng bộ hóa đơn từ Backend vào bảng
  useEffect(() => {
    if (realOrders && realOrders.length > 0) {
      const mapped: InvoiceItem[] = realOrders.map((ord) => {
        const isPaid = ord.orderStatus === "CLOSED" || ((ord.paidAmount ?? 0) >= (ord.totalAmount ?? 0));
        const isPending = !isPaid && ord.orderStatus === "OPEN";
        const status = isPaid ? "paid" : isPending ? "pending" : "refunded";
        const stay = ord.orderStatus === "CLOSED" ? "checkedOut" : "current";
        const txMethod = ord.paymentTransactions?.[0]?.paymentType;
        const method = txMethod === "BANK_TRANSFER"
          ? "bankTransfer"
          : txMethod === "PAYOS"
          ? "creditCard"
          : "atCounter";

        const issueDateStr = ord.issueDate ? new Date(ord.issueDate).toLocaleDateString("vi-VN") : "Hôm nay";
        const closeDateStr = ord.closeDate ? new Date(ord.closeDate).toLocaleDateString("vi-VN") : "";

        return {
          id: ord.id,
          guest: ord.customerName || "Khách đặt phòng",
          phone: ord.customerPhone || "N/A",
          room: ord.bookingId ? `Booking #${ord.bookingId}` : "Phòng tiêu chuẩn",
          dates: closeDateStr ? `${issueDateStr} – ${closeDateStr}` : issueDateStr,
          amount: ord.totalAmount ?? 0,
          method,
          status,
          stay,
          rawOrder: ord,
        };
      });

      // Kết hợp dữ liệu thật từ Backend và các hóa đơn mẫu bổ trợ nếu ít hơn 5 dòng
      if (mapped.length >= 5) {
        setInvoices(mapped);
      } else {
        const existingIds = new Set(mapped.map((m) => m.id));
        const extra = initialInvoices.filter((item) => !existingIds.has(item.id));
        setInvoices([...mapped, ...extra]);
      }
    }
  }, [realOrders]);

  const filtered = useMemo(
    () =>
      invoices
        .filter((invoice) =>
          `${invoice.id} ${invoice.guest} ${invoice.room}`
            .toLowerCase()
            .includes(query.toLowerCase())
        )
        .filter((invoice) => payment === "all" || invoice.status === payment),
    [invoices, query, payment]
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedInvoices = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  useEffect(() => {
    setPage(1);
  }, [query, payment, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const updateStay = (id: string, next: string) =>
    setInvoices((current) =>
      current.map((invoice) => (invoice.id === id ? { ...invoice, stay: next } : invoice))
    );

  const completeCheckout = async () => {
    if (!checkoutInvoice) return;

    if (checkoutInvoice.rawOrder?.id) {
      try {
        await closeOrder(checkoutInvoice.rawOrder.id).unwrap();
        refetch();
      } catch (err) {
        console.warn("Không thể quyết toán hóa đơn trên BE:", err);
      }
    }

    const roomId = checkoutInvoice.room.split(" · ")[0];
    const stored = window.localStorage.getItem("staywise-cleaning-rooms");
    const assignments = stored ? JSON.parse(stored) : {};
    assignments[roomId] = { status: "Đang dọn", cleaner };
    window.localStorage.setItem("staywise-cleaning-rooms", JSON.stringify(assignments));
    updateStay(checkoutInvoice.id, "checkedOut");
    setCheckoutInvoice(null);
    navigate("/rooms");
  };

  return (
    <section className="mt-6 rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-100 p-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-slate-900">{label("listTitle")}</h3>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
              Đồng bộ dữ liệu thời gian thực
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">{label("listDescription")}</p>
        </div>
        <button className="flex w-fit items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white">
          <Download size={16} />
          {t("common.exportReport")}
        </button>
      </div>

      <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/60 p-4 sm:flex-row">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-3 text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={label("searchPlaceholder")}
            className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
        </div>
        <div className="relative">
          <WalletCards size={15} className="absolute left-3 top-3 text-slate-400" />
          <select
            value={payment}
            onChange={(event) => setPayment(event.target.value)}
            className="h-10 w-full appearance-none rounded-lg border border-slate-200 bg-white pl-9 pr-9 text-sm text-slate-600 sm:w-48"
          >
            <option value="all">{label("allPayments")}</option>
            <option value="paid">{label("paidStatus")}</option>
            <option value="pending">{label("pendingStatus")}</option>
            <option value="refunded">{label("refundedStatus")}</option>
          </select>
          <ChevronDown size={14} className="pointer-events-none absolute right-3 top-3 text-slate-400" />
        </div>
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-245 text-left">
          <thead className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            <tr>
              {["invoice", "guest", "roomAndTime", "total", "payment", "stay", "actions"].map((key) => (
                <th key={key} className="px-4 py-3">
                  {label(key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginatedInvoices.map((invoice) => (
              <tr key={invoice.id} className="hover:bg-slate-50/70 transition">
                <td className="px-5 py-4">
                  <p className="text-xs font-bold text-slate-800">{invoice.id}</p>
                  <p className="mt-1 text-[10px] text-slate-400">{label("createdOn")}</p>
                </td>
                <td className="px-4 py-4">
                  <p className="text-xs font-semibold text-slate-800">{invoice.guest}</p>
                  <p className="mt-1 text-[11px] text-slate-400">{invoice.phone}</p>
                </td>
                <td className="px-4 py-4">
                  <p className="text-xs font-semibold text-slate-700">{invoice.room}</p>
                  <p className="mt-1 flex items-center gap-1 text-[11px] text-slate-400">
                    <CalendarDays size={12} />
                    {invoice.dates}
                  </p>
                </td>
                <td className="px-4 py-4 text-xs font-bold text-slate-900">
                  {money(invoice.amount)}
                  <p className="mt-1 text-[10px] font-normal text-slate-400">{label(invoice.method)}</p>
                </td>
                <td className="px-4 py-4">
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${paymentStyle[invoice.status]}`}>
                    {label(`${invoice.status}Status`)}
                  </span>
                </td>
                <td className="px-4 py-4">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ${stayStyle[invoice.stay]}`}
                  >
                    {invoice.stay === "current" ? (
                      <CircleCheck size={11} />
                    ) : invoice.stay === "upcoming" ? (
                      <Clock3 size={11} />
                    ) : (
                      <Check size={11} />
                    )}
                    {label(`${invoice.stay}Stay`)}
                  </span>
                </td>
                <td className="px-4 py-4 text-right">
                  <button
                    onClick={() => setDetailInvoice(invoice)}
                    className="rounded-md border border-slate-200 px-2.5 py-1.5 text-[10px] font-semibold text-blue-600 hover:bg-blue-50"
                  >
                    {label("view")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 p-4 md:hidden">
        {paginatedInvoices.map((invoice) => (
          <article key={invoice.id} className="rounded-xl border border-slate-200 p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-bold text-slate-800">{invoice.id}</p>
                <p className="mt-1 text-sm font-semibold text-slate-700">{invoice.guest}</p>
              </div>
              <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${paymentStyle[invoice.status]}`}>
                {label(`${invoice.status}Status`)}
              </span>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              {invoice.room} · {invoice.dates}
            </p>
            <div className="mt-3 flex items-center justify-between">
              <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${stayStyle[invoice.stay]}`}>
                {label(`${invoice.stay}Stay`)}
              </span>
              <strong className="text-sm text-slate-900">{money(invoice.amount)}</strong>
            </div>
            <div className="mt-3 flex gap-2">
              {invoice.stay === "upcoming" && (
                <button
                  onClick={() => updateStay(invoice.id, "current")}
                  className="flex-1 rounded-md bg-blue-50 py-2 text-xs font-bold text-blue-700"
                >
                  {label("checkIn")}
                </button>
              )}
              {invoice.stay === "current" && (
                <button
                  onClick={() => setCheckoutInvoice(invoice)}
                  className="flex-1 rounded-md bg-blue-50 py-2 text-xs font-bold text-blue-700"
                >
                  {label("checkOut")}
                </button>
              )}
              <button
                onClick={() => setDetailInvoice(invoice)}
                className="flex-1 rounded-md border border-slate-200 py-2 text-xs font-semibold text-slate-500"
              >
                {label("viewDetails")}
              </button>
            </div>
          </article>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="p-12 text-center">
          <p className="text-sm font-semibold text-slate-700">{label("noResults")}</p>
          <p className="mt-1 text-xs text-slate-400">{label("changeFilters")}</p>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="flex flex-col gap-3 border-t border-slate-100 p-4 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span>
            Hiển thị {(safePage - 1) * pageSize + 1}-{Math.min(safePage * pageSize, filtered.length)} trên{" "}
            {filtered.length} hóa đơn
          </span>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2">
              Số dòng
              <select
                value={pageSize}
                onChange={(event) => setPageSize(Number(event.target.value))}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </label>
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={safePage === 1}
              className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Trang trước"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="min-w-16 text-center font-semibold text-slate-700">
              {safePage} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              disabled={safePage === totalPages}
              className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Trang sau"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Modal Check-out & Phân công dọn phòng */}
      {checkoutInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <p className="text-xs font-bold uppercase tracking-wider text-blue-600">
              {label("checkoutComplete")}
            </p>
            <h3 className="mt-2 text-xl font-bold text-slate-900">{label("assignCleaning")}</h3>
            <p className="mt-1 text-sm text-slate-500">
              {t("invoice.checkoutDescription", { room: checkoutInvoice.room })}
            </p>
            <label className="mt-5 block text-sm font-semibold text-slate-700">
              {label("cleaner")}
              <select
                value={cleaner}
                onChange={(event) => setCleaner(event.target.value)}
                className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal"
              >
                {cleaningStaffList.map((person) => (
                  <option key={person} value={person}>{person}</option>
                ))}
              </select>
            </label>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setCheckoutInvoice(null)}
                className="rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-600"
              >
                {label("cancel")}
              </button>
              <button
                onClick={completeCheckout}
                className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white"
              >
                {label("confirmAndGoRooms")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Xem chi tiết hóa đơn thực tế */}
      {detailInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-600">
                  <Receipt size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Chi tiết hóa đơn {detailInvoice.id}</h3>
                  <p className="text-xs text-slate-500">Thông tin quyết toán đặt phòng & dịch vụ</p>
                </div>
              </div>
              <button
                onClick={() => setDetailInvoice(null)}
                className="text-2xl leading-none text-slate-400 hover:text-slate-700"
              >
                ×
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 text-xs">
                <div>
                  <p className="text-slate-400">Khách hàng</p>
                  <p className="mt-0.5 font-bold text-slate-800">{detailInvoice.guest}</p>
                </div>
                <div>
                  <p className="text-slate-400">Số điện thoại</p>
                  <p className="mt-0.5 font-bold text-slate-800">{detailInvoice.phone}</p>
                </div>
                <div>
                  <p className="text-slate-400">Phòng / Booking</p>
                  <p className="mt-0.5 font-bold text-slate-800">{detailInvoice.room}</p>
                </div>
                <div>
                  <p className="text-slate-400">Thời gian lưu trú</p>
                  <p className="mt-0.5 font-bold text-slate-800">{detailInvoice.dates}</p>
                </div>
              </div>

              <div className="divide-y divide-slate-100 rounded-xl border border-slate-100 px-4 py-2 text-xs">
                <div className="flex justify-between py-2">
                  <span className="text-slate-500">Tiền phòng cơ bản</span>
                  <span className="font-semibold text-slate-800">
                    {money(detailInvoice.rawOrder?.roomTotalAmount || detailInvoice.amount)}
                  </span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-slate-500">Tiền dịch vụ phát sinh</span>
                  <span className="font-semibold text-slate-800">
                    {money(detailInvoice.rawOrder?.serviceTotalAmount || 0)}
                  </span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-slate-500">Giảm giá / Ưu đãi</span>
                  <span className="font-semibold text-emerald-600">
                    -{money(detailInvoice.rawOrder?.discountAmountTotal || 0)}
                  </span>
                </div>
                <div className="flex justify-between py-2 text-sm font-bold">
                  <span className="text-slate-900">Tổng cộng</span>
                  <span className="text-blue-600">{money(detailInvoice.amount)}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-slate-500">Đã thanh toán</span>
                  <span className="font-semibold text-slate-800">
                    {money(detailInvoice.rawOrder?.paidAmount ?? detailInvoice.amount)}
                  </span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-slate-500">Còn lại cần thu</span>
                  <span className="font-bold text-amber-600">
                    {money(detailInvoice.rawOrder?.remainingAmount || 0)}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setDetailInvoice(null)}
                className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Đóng
              </button>
              <button
                onClick={() => {
                  window.print();
                }}
                className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
              >
                In hóa đơn
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
