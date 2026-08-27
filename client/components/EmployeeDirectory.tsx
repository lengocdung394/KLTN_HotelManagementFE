import { FormEvent, useState } from "react";
import { Plus, UserRound, X } from "lucide-react";

type Employee = { name: string; role: string; initials: string; color: string };

const initialEmployees: Employee[] = [
  { name: "Nguyễn Thị Mai", role: "Housekeeping", initials: "MM", color: "bg-rose-100 text-rose-700" },
  { name: "Lê Thị Hương", role: "Housekeeping", initials: "HH", color: "bg-amber-100 text-amber-700" },
  { name: "Phạm Ngọc Anh", role: "Lễ tân", initials: "AA", color: "bg-blue-100 text-blue-700" },
  { name: "Trần Minh Tú", role: "Lễ tân", initials: "TT", color: "bg-sky-100 text-sky-700" },
];

export default function EmployeeDirectory() {
  const [employees, setEmployees] = useState(initialEmployees);
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState("Lễ tân");
  const [email, setEmail] = useState("");
  const [identityNumber, setIdentityNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  const addEmployee = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;
    const initials = trimmedName.split(" ").map((part) => part[0]).slice(-2).join("").toUpperCase();
    setEmployees((current) => [...current, { name: trimmedName, role, initials, color: role === "Lễ tân" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700" }]);
    setName("");
    setRole("Lễ tân");
    setEmail("");
    setIdentityNumber("");
    setPhone("");
    setAddress("");
    setAddOpen(false);
  };

  return <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
    <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2"><UserRound size={18} className="text-blue-600" /><h3 className="font-bold text-slate-900">Danh sách nhân viên</h3></div><p className="mt-1 text-sm text-slate-500">{employees.length} nhân viên đang làm việc tại chi nhánh.</p></div><button type="button" onClick={() => setAddOpen((open) => !open)} className="flex w-fit items-center gap-2 rounded-lg bg-blue-600 px-3.5 py-2.5 text-xs font-semibold text-white hover:bg-blue-700"><Plus size={15} />Thêm nhân viên</button></div>
    {addOpen && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4" onMouseDown={() => setAddOpen(false)}><form onSubmit={addEmployee} onMouseDown={(event) => event.stopPropagation()} className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-6"><div className="flex items-start justify-between border-b border-slate-100 pb-4"><div><p className="text-xs font-semibold uppercase tracking-wider text-blue-600">Nhân viên</p><h3 className="mt-1 text-xl font-bold text-slate-900">Thêm nhân viên</h3><p className="mt-1 text-sm text-slate-500">Cập nhật đầy đủ thông tin hồ sơ nhân viên.</p></div><button type="button" onClick={() => setAddOpen(false)} className="text-2xl leading-none text-slate-400" aria-label="Đóng"><X size={20} /></button></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold text-slate-700 sm:col-span-2">Ảnh nhân viên <span className="text-red-500">*</span><input type="file" accept="image/*" required className="mt-1.5 block h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal file:mr-3 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-blue-700" /></label><label className="text-sm font-semibold text-slate-700">Họ và tên <span className="text-red-500">*</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nhập họ và tên" required autoFocus className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none focus:border-blue-400" /></label><label className="text-sm font-semibold text-slate-700">Chức vụ <span className="text-red-500">*</span><select value={role} onChange={(event) => setRole(event.target.value)} required className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal"><option>Lễ tân</option><option>Housekeeping</option></select></label><label className="text-sm font-semibold text-slate-700">Email <span className="text-red-500">*</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="email@senviet.vn" required className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none focus:border-blue-400" /></label><label className="text-sm font-semibold text-slate-700">CCCD <span className="text-red-500">*</span><input value={identityNumber} onChange={(event) => setIdentityNumber(event.target.value)} placeholder="Nhập số CCCD" required className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none focus:border-blue-400" /></label><label className="text-sm font-semibold text-slate-700">Số điện thoại <span className="text-red-500">*</span><input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="090 123 4567" required className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none focus:border-blue-400" /></label><label className="text-sm font-semibold text-slate-700 sm:col-span-2">Địa chỉ <span className="text-red-500">*</span><textarea value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Nhập địa chỉ hiện tại" required rows={3} className="mt-1.5 w-full resize-none rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal outline-none focus:border-blue-400" /></label></div><div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4"><button type="button" onClick={() => setAddOpen(false)} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600">Hủy</button><button type="submit" className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">Lưu nhân viên</button></div></form></div>}
    <div className="divide-y divide-slate-100 px-5">{employees.map((employee) => <article key={`${employee.name}-${employee.role}`} className="flex items-center gap-3 py-3"><div className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-bold ${employee.color}`}>{employee.initials}</div><div className="min-w-0"><p className="truncate text-sm font-bold text-slate-900">{employee.name}</p><p className="mt-1 text-xs text-slate-500">{employee.role}</p></div></article>)}</div>
  </section>;
}
