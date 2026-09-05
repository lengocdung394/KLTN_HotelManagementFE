import { useState } from "react";
import { Check, ConciergeBell, Plus } from "lucide-react";

const services = [
  { name: "Minibar", detail: "Nước uống và đồ ăn nhẹ trong phòng", price: 80000, category: "Trong phòng" },
  { name: "Giặt ủi", detail: "Giặt và ủi quần áo trong ngày", price: 50000, category: "Tiện ích" },
  { name: "Bữa sáng", detail: "Suất ăn sáng tại nhà hàng", price: 120000, category: "Ẩm thực" },
  { name: "Đưa đón sân bay", detail: "Xe riêng một chiều đến sân bay", price: 350000, category: "Di chuyển" },
  { name: "Massage thư giãn", detail: "Liệu trình thư giãn 60 phút", price: 450000, category: "Chăm sóc" },
  { name: "Late check-out", detail: "Gia hạn thời gian trả phòng", price: 300000, category: "Lưu trú" },
];

export default function ServiceWorkspace() {
  const [selected, setSelected] = useState<string[]>([]);
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
