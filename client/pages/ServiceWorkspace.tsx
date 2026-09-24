import { useMemo, useState } from "react";
import { ConciergeBell, Eye, ImagePlus, Plus, X } from "lucide-react";
import { useGetAllServicesQuery, type HotelService } from "../services/serviceApi";
import { useAppSelector } from "../store/hooks";

export default function ServiceWorkspace() {
  const [localServices, setLocalServices] = useState<HotelService[]>([]);
  const [statusOverrides, setStatusOverrides] = useState<Record<string, boolean>>({});
  const [detailService, setDetailService] = useState<HotelService | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newService, setNewService] = useState({ name: "", detail: "", price: "", unit: "lần", category: "Khác", imageUrl: "" });
  const hotelId = useAppSelector((state) => state.auth.hotelId);
  const hasHotelId = Boolean(hotelId) && !Number.isNaN(Number(hotelId));
  const { data: services = [], isLoading, isError } = useGetAllServicesQuery(hasHotelId ? { hotelId: Number(hotelId), activeOnly: true } : undefined, { skip: !hasHotelId });
  const allServices = useMemo(() => [...services, ...localServices], [services, localServices]);

  const toggleServiceStatus = (serviceId: string) => {
    const currentService = allServices.find((service) => service.id === serviceId);
    if (!currentService) return;
    const currentStatus = statusOverrides[serviceId] ?? currentService.active;
    setStatusOverrides((current) => ({ ...current, [serviceId]: !currentStatus }));
    setLocalServices((current) => current.map((service) => service.id === serviceId ? { ...service, active: !service.active } : service));
  };

  const createService = () => {
    const name = newService.name.trim();
    const detail = newService.detail.trim();
    const category = newService.category.trim();
    const imageUrl = newService.imageUrl.trim();
    const price = Number(newService.price);
    if (!name || !detail || !category || !Number.isFinite(price) || price < 0) return;
    const service: HotelService = {
      id: `local-service-${Date.now()}`,
      name,
      detail,
      price,
      unit: newService.unit,
      category,
      active: true,
      imageUrl: imageUrl || undefined,
    };
    setLocalServices((current) => [...current, service]);
    setNewService({ name: "", detail: "", price: "", unit: "lần", category: "Khác", imageUrl: "" });
    setShowCreate(false);
  };

  return (
    <section className="mt-6 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <div className="flex items-center gap-2 text-blue-600"><ConciergeBell size={18} /><p className="text-xs font-bold uppercase tracking-wider">Dịch vụ lưu trú</p></div>
          <h3 className="mt-2 text-xl font-bold text-slate-900">Danh sách dịch vụ</h3>
          <p className="mt-1 text-sm text-slate-500">Quản lý thông tin và trạng thái dịch vụ của khách sạn.</p>
        </div>
        <button type="button" onClick={() => setShowCreate(true)} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"><Plus size={16} />Thêm dịch vụ</button>
      </div>
      {isLoading && <p className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">Đang tải danh sách dịch vụ...</p>}
      {isError && <p className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-6 text-center text-sm text-rose-600">Không thể tải danh sách dịch vụ.</p>}
      {!isLoading && !isError && !hasHotelId && <p className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">Chưa xác định được chi nhánh hiện tại.</p>}
      {!isLoading && !isError && hasHotelId && services.length === 0 && <p className="mt-5 rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">Chi nhánh chưa có dịch vụ khả dụng.</p>}
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {allServices.map((service) => {
          const isActive = statusOverrides[service.id] ?? service.active;
          return <article key={service.id} className="rounded-xl border border-blue-200 bg-blue-100/55 p-4 text-left transition hover:border-blue-400 hover:bg-blue-100/80 hover:shadow-sm">
            {service.imageUrl && <img src={service.imageUrl} alt={service.name} className="mb-4 h-32 w-full rounded-lg object-cover" />}
            <div className="flex items-start justify-between gap-3"><span className="text-sm font-bold text-slate-900">{service.name}</span><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-500">{service.category}</span></div>
            <p className="mt-2 min-h-10 text-xs leading-5 text-slate-500">{service.detail}</p>
            <div className="mt-4"><span className="text-sm font-bold text-blue-700">{service.price.toLocaleString("vi-VN")}đ <span className="font-normal text-slate-400">/ {service.unit}</span></span></div>
            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3"><button type="button" onClick={() => setDetailService(service)} className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-blue-600"><Eye size={14} />Xem chi tiết</button><button type="button" onClick={() => toggleServiceStatus(service.id)} className={`flex items-center gap-1.5 text-xs font-semibold ${isActive ? "text-emerald-600" : "text-slate-400"}`}><span className={`h-2 w-2 rounded-full ${isActive ? "bg-emerald-500" : "bg-slate-300"}`} />{isActive ? "Đang hoạt động" : "Tạm ngưng"}</button></div>
          </article>;
        })}
      </div>
      {detailService && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4" onMouseDown={() => setDetailService(null)}><div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wider text-blue-600">Chi tiết dịch vụ</p><h4 className="mt-1 text-xl font-bold text-slate-900">{detailService.name}</h4></div><button type="button" onClick={() => setDetailService(null)} aria-label="Đóng" className="text-slate-400 hover:text-slate-700"><X size={20} /></button></div><dl className="mt-5 space-y-3 text-sm"><div className="flex justify-between gap-4"><dt className="text-slate-500">Mã dịch vụ</dt><dd className="font-semibold text-slate-800">{detailService.id}</dd></div><div className="flex justify-between gap-4"><dt className="text-slate-500">Danh mục</dt><dd className="font-semibold text-slate-800">{detailService.category}</dd></div><div className="flex justify-between gap-4"><dt className="text-slate-500">Đơn giá</dt><dd className="font-semibold text-blue-700">{detailService.price.toLocaleString("vi-VN")}đ / {detailService.unit}</dd></div><div className="border-t border-slate-100 pt-3"><dt className="text-slate-500">Mô tả</dt><dd className="mt-1 text-slate-700">{detailService.detail}</dd></div></dl></div></div>}
      {showCreate && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4" onMouseDown={() => setShowCreate(false)}><form className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl" onSubmit={(event) => { event.preventDefault(); createService(); }} onMouseDown={(event) => event.stopPropagation()}><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wider text-blue-600">Dịch vụ lưu trú</p><h4 className="mt-1 text-xl font-bold text-slate-900">Thêm dịch vụ</h4></div><button type="button" onClick={() => setShowCreate(false)} aria-label="Đóng" className="text-slate-400 hover:text-slate-700"><X size={20} /></button></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold text-slate-700 sm:col-span-2">Tên dịch vụ<input required value={newService.name} onChange={(event) => setNewService((current) => ({ ...current, name: event.target.value }))} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal" /></label><label className="text-sm font-semibold text-slate-700">Giá<input required type="number" min="0" value={newService.price} onChange={(event) => setNewService((current) => ({ ...current, price: event.target.value }))} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal" /></label><label className="text-sm font-semibold text-slate-700">Đơn vị<select value={newService.unit} onChange={(event) => setNewService((current) => ({ ...current, unit: event.target.value }))} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal"><option>lần</option><option>người</option><option>giờ</option><option>ngày</option></select></label><label className="text-sm font-semibold text-slate-700 sm:col-span-2">Danh mục<input value={newService.category} onChange={(event) => setNewService((current) => ({ ...current, category: event.target.value }))} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal" /></label><label className="text-sm font-semibold text-slate-700 sm:col-span-2">Mô tả<textarea value={newService.detail} onChange={(event) => setNewService((current) => ({ ...current, detail: event.target.value }))} rows={3} className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal" /></label></div><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setShowCreate(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600">Hủy</button><button type="submit" className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white"><Plus size={15} />Thêm dịch vụ</button></div></form></div>}
    </section>
  );
}
