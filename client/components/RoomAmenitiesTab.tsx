import { useMemo, useState } from "react";
import { Pencil, Plus, Search, Save, X } from "lucide-react";
import type { AmenityResponse } from "../services/amenityApi";

type RoomAmenitiesTabProps = {
  amenities: AmenityResponse[];
  isLoading: boolean;
  isError: boolean;
  isCreating: boolean;
  onCreateOpenChange: (open: boolean) => void;
  onSave: (amenity: AmenityResponse, changes: Pick<AmenityResponse, "name" | "price">) => void;
  onAdd: (amenity: Pick<AmenityResponse, "name" | "price">) => void;
};

const normalizeText = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
const money = (value: number) => `${value.toLocaleString("vi-VN")}đ`;

export default function RoomAmenitiesTab({ amenities, isLoading, isError, isCreating, onCreateOpenChange, onSave, onAdd }: RoomAmenitiesTabProps) {
  const [search, setSearch] = useState("");
  const [editingAmenity, setEditingAmenity] = useState<AmenityResponse | null>(null);
  const [editForm, setEditForm] = useState({ name: "", price: "" });
  const [createForm, setCreateForm] = useState({ name: "", price: "" });
  const normalizedSearch = normalizeText(search);
  const filteredAmenities = useMemo(
    () => amenities.filter((amenity) => !normalizedSearch || normalizeText(amenity.name).includes(normalizedSearch)),
    [amenities, normalizedSearch],
  );

  const closeEditor = () => setEditingAmenity(null);
  const closeCreateForm = () => {
    onCreateOpenChange(false);
    setCreateForm({ name: "", price: "" });
  };
  const saveNewAmenity = () => {
    const name = createForm.name.trim();
    const price = Number(createForm.price);
    if (!name || !createForm.price || !Number.isFinite(price) || price < 0) return;
    onAdd({ name, price });
    closeCreateForm();
  };
  const saveEdit = () => {
    if (!editingAmenity) return;
    const name = editForm.name.trim();
    const price = Number(editForm.price);
    if (!name || !editForm.price || !Number.isFinite(price) || price < 0) return;
    onSave(editingAmenity, { name, price });
    closeEditor();
  };

  return (
    <div className="p-5">
      <div className="flex flex-col gap-4 border-b border-slate-100 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="font-bold text-slate-900">Danh sách tiện nghi</h3>
          <p className="mt-1 text-sm text-slate-500">{filteredAmenities.length} tiện nghi</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <label className="relative block w-full sm:w-64">
            <Search size={15} className="absolute left-3 top-3 text-slate-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm tiện nghi..." className="h-10 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-sm outline-none transition focus:border-blue-400" />
          </label>
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-500">File CSV/Excel cần có hai cột <strong>Tên tiện ích</strong> và <strong>Giá</strong>.</p>
      {isLoading ? (
        <p className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">Đang tải danh sách tiện nghi...</p>
      ) : isError ? (
        <p className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-6 text-center text-sm text-rose-600">Không thể tải danh sách tiện nghi.</p>
      ) : filteredAmenities.length === 0 ? (
        <p className="mt-5 rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">Không tìm thấy tiện nghi phù hợp.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-105 text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-500">
              <tr className="border-b border-slate-100">
                <th className="px-3 py-3 font-semibold">Tên tiện nghi</th>
                <th className="px-3 py-3 text-right font-semibold">Giá</th>
                <th className="px-3 py-3 text-right font-semibold">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAmenities.map((amenity) => (
                <tr key={amenity.id} className="hover:bg-slate-50">
                  <td className="px-3 py-3 font-medium text-slate-800">{amenity.name}</td>
                  <td className="px-3 py-3 text-right font-semibold text-blue-700">{money(amenity.price)}</td>
                  <td className="px-3 py-3 text-right">
                    <button type="button" onClick={() => { setEditingAmenity(amenity); setEditForm({ name: amenity.name, price: String(amenity.price) }); }} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700">
                      <Pencil size={13} />Chỉnh sửa
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editingAmenity && (
        <div className="fixed inset-0 z-70 grid place-items-center bg-slate-950/45 p-4" onMouseDown={closeEditor}>
          <form onSubmit={(event) => { event.preventDefault(); saveEdit(); }} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div><p className="text-xs font-bold uppercase tracking-wider text-blue-600">Danh sách tiện nghi</p><h4 className="mt-1 text-xl font-bold text-slate-900">Chỉnh sửa tiện nghi</h4></div>
              <button type="button" onClick={closeEditor} aria-label="Đóng" className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X size={18} /></button>
            </div>
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Lưu tạm trên giao diện; API cập nhật sẽ được kết nối sau.</p>
            <label className="mt-4 block text-sm font-semibold text-slate-700">Tên tiện nghi<input required autoFocus value={editForm.name} onChange={(event) => setEditForm((current) => ({ ...current, name: event.target.value }))} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none focus:border-blue-400" /></label>
            <label className="mt-4 block text-sm font-semibold text-slate-700">Giá<input required type="number" min="0" value={editForm.price} onChange={(event) => setEditForm((current) => ({ ...current, price: event.target.value }))} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none focus:border-blue-400" /></label>
            <div className="mt-6 flex justify-end gap-2"><button type="button" onClick={closeEditor} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Hủy</button><button type="submit" disabled={!editForm.name.trim() || !editForm.price || !Number.isFinite(Number(editForm.price)) || Number(editForm.price) < 0} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"><Save size={15} />Lưu</button></div>
          </form>
        </div>
      )}

      {isCreating && (
        <div className="fixed inset-0 z-70 grid place-items-center bg-slate-950/45 p-4" onMouseDown={closeCreateForm}>
          <form
            onSubmit={(event) => { event.preventDefault(); saveNewAmenity(); }}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-blue-600">Danh sách tiện nghi</p>
                <h4 className="mt-1 text-xl font-bold text-slate-900">Thêm tiện nghi</h4>
              </div>
              <button type="button" onClick={closeCreateForm} aria-label="Đóng" className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X size={18} /></button>
            </div>
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Tiện nghi mới được thêm tạm trên giao diện.</p>
            <label className="mt-4 block text-sm font-semibold text-slate-700">
              Tên tiện nghi
              <input required autoFocus value={createForm.name} onChange={(event) => setCreateForm((current) => ({ ...current, name: event.target.value }))} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none focus:border-blue-400" />
            </label>
            <label className="mt-4 block text-sm font-semibold text-slate-700">
              Giá
              <input required type="number" min="0" value={createForm.price} onChange={(event) => setCreateForm((current) => ({ ...current, price: event.target.value }))} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none focus:border-blue-400" />
            </label>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={closeCreateForm} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Hủy</button>
              <button type="submit" disabled={!createForm.name.trim() || !createForm.price || !Number.isFinite(Number(createForm.price)) || Number(createForm.price) < 0} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"><Plus size={15} />Thêm tiện nghi</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}