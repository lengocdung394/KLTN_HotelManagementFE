import { useState } from "react";
import { Check, ConciergeBell, Plus } from "lucide-react";
import { useGetAllServicesQuery } from "../services/serviceApi";
import { useAppSelector } from "../store/hooks";

export default function ServiceWorkspace() {
  const [selected, setSelected] = useState<string[]>([]);
  const hotelId = useAppSelector((state) => state.auth.hotelId);
  const hasHotelId = Boolean(hotelId) && !Number.isNaN(Number(hotelId));
  const { data: services = [], isLoading, isError } = useGetAllServicesQuery(hasHotelId ? { hotelId: Number(hotelId), activeOnly: true } : undefined, { skip: !hasHotelId });
  const total = services.filter((service) => selected.includes(service.name)).reduce((sum, service) => sum + service.price, 0);

  return (
    <section className="mt-6 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <div className="flex items-center gap-2 text-blue-600"><ConciergeBell size={18} /><p className="text-xs font-bold uppercase tracking-wider">Dịch vụ lưu trú</p></div>
          <h3 className="mt-2 text-xl font-bold text-slate-900">Danh sách dịch vụ</h3>
          <p className="mt-1 text-sm text-slate-500">Chọn dịch vụ để thêm vào hóa đơn của khách.</p>
        </div>
        <div className="rounded-xl bg-blue-50 px-4 py-3 text-right">
          <p className="text-xs font-semibold text-blue-600">Đã chọn</p>
          <p className="mt-1 text-lg font-bold text-blue-800">{selected.length} dịch vụ · {total.toLocaleString("vi-VN")}đ</p>
        </div>
      </div>
      {isLoading && <p className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">Đang tải danh sách dịch vụ...</p>}
      {isError && <p className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-6 text-center text-sm text-rose-600">Không thể tải danh sách dịch vụ.</p>}
      {!isLoading && !isError && !hasHotelId && <p className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">Chưa xác định được chi nhánh hiện tại.</p>}
      {!isLoading && !isError && hasHotelId && services.length === 0 && <p className="mt-5 rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">Chi nhánh chưa có dịch vụ khả dụng.</p>}
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {services.map((service) => {
          const isSelected = selected.includes(service.name);
          return <button type="button" key={service.name} onClick={() => setSelected((current) => isSelected ? current.filter((name) => name !== service.name) : [...current, service.name])} className={`rounded-xl border p-4 text-left transition ${isSelected ? "border-blue-500 bg-blue-50 ring-2 ring-blue-100" : "border-slate-200 hover:border-blue-300 hover:bg-slate-50"}`}>
            <div className="flex items-start justify-between gap-3"><span className="text-sm font-bold text-slate-900">{service.name}</span><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-500">{service.category}</span></div>
            <p className="mt-2 text-xs text-slate-500">{service.detail}</p>
            <div className="mt-4 flex items-center justify-between"><span className="text-sm font-bold text-blue-700">{service.price.toLocaleString("vi-VN")}đ</span><span className={`grid h-7 w-7 place-items-center rounded-full ${isSelected ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-400"}`}>{isSelected ? <Check size={15} /> : <Plus size={15} />}</span></div>
          </button>;
        })}
      </div>
    </section>
  );
}
