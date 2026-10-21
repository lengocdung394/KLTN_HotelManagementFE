import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type RoomEditDraft = {
  roomNumber: string;
  roomType: string;
  floorId: string;
  roomStatus: string;
  area: string;
  basePrice?: string;
  standardCapacity: string;
  maxExtraGuests: string;
  extraAdultFee: string;
  extraChildFee: string;
  images: string[];
  defaultImageIndex: number;
  amenityIds: number[];
  beds: Array<{ bedTypeId: number; quantity: number }>;
};

export type RoomEditChoice = { value: string; label: string };
export type RoomEditAmenity = { id: number; name: string; price?: number };
export type RoomEditBedType = { id: number; name: string; isExtraBed?: boolean };

type RoomEditFormProps = {
  draft: RoomEditDraft;
  onDraftChange: (draft: RoomEditDraft) => void;
  buildings: RoomEditChoice[];
  floors: Array<RoomEditChoice & { buildingId: string }>;
  roomTypes: RoomEditChoice[];
  roomStatuses: RoomEditChoice[];
  amenities: RoomEditAmenity[];
  bedTypes: RoomEditBedType[];
  imageFiles: File[];
  onImageFilesChange: (files: File[]) => void;
  isSaving: boolean;
  error: string;
  onSave: () => void;
  onCancel: () => void;
};

export default function RoomEditForm({
  draft,
  onDraftChange,
  buildings,
  floors,
  roomTypes,
  amenities,
  bedTypes,
  imageFiles,
  onImageFilesChange,
  isSaving,
  error,
  onSave,
  onCancel,
}: RoomEditFormProps) {
  const [imageFilesByUrl, setImageFilesByUrl] = useState<Record<string, File>>({});
  const objectUrls = useRef<string[]>([]);
  useEffect(() => () => {
    objectUrls.current.forEach((url) => URL.revokeObjectURL(url));
  }, []);
  const selectedFloor = floors.find((floor) => floor.value === draft.floorId);
  const availableFloors = floors.filter((floor) =>
    !selectedFloor || floor.buildingId === selectedFloor.buildingId);
  const patch = (changes: Partial<RoomEditDraft>) =>
    onDraftChange({ ...draft, ...changes });

  const addImages = (fileList: FileList | null) => {
    if (!fileList) return;
    const files = Array.from(fileList).slice(0, Math.max(0, 8 - draft.images.length));
    const additions = files.map((file) => ({ url: URL.createObjectURL(file), file }));
    objectUrls.current.push(...additions.map((item) => item.url));
    const nextFilesByUrl = { ...imageFilesByUrl };
    additions.forEach(({ url, file }) => { nextFilesByUrl[url] = file; });
    setImageFilesByUrl(nextFilesByUrl);
    onImageFilesChange([...imageFiles, ...files]);
    patch({
      images: [...draft.images, ...additions.map((item) => item.url)],
      defaultImageIndex: draft.images.length === 0 ? 0 : draft.defaultImageIndex,
    });
  };

  const removeImage = (index: number) => {
    const removedUrl = draft.images[index];
    const removedFile = imageFilesByUrl[removedUrl];
    if (removedFile) {
      URL.revokeObjectURL(removedUrl);
      objectUrls.current = objectUrls.current.filter((url) => url !== removedUrl);
      const fileIndex = imageFiles.indexOf(removedFile);
      onImageFilesChange(imageFiles.filter((_, currentIndex) => currentIndex !== fileIndex));
      setImageFilesByUrl((current) => {
        const next = { ...current };
        delete next[removedUrl];
        return next;
      });
    }
    const images = draft.images.filter((_, currentIndex) => currentIndex !== index);
    const defaultImageIndex = index === draft.defaultImageIndex
      ? Math.max(0, index - 1)
      : index < draft.defaultImageIndex ? draft.defaultImageIndex - 1 : draft.defaultImageIndex;
    patch({ images, defaultImageIndex });
  };

  const toggleAmenity = (amenityId: number, checked: boolean) => {
    patch({
      amenityIds: checked
        ? [...draft.amenityIds, amenityId]
        : draft.amenityIds.filter((id) => id !== amenityId),
    });
  };

  const toggleBedType = (bedTypeId: number, checked: boolean) => {
    patch({
      beds: checked
        ? [...draft.beds, { bedTypeId, quantity: 1 }]
        : draft.beds.filter((bed) => bed.bedTypeId !== bedTypeId),
    });
  };

  return createPortal(
    <div className="fixed inset-0 z-[1000] grid place-items-center overflow-y-auto bg-slate-950/50 p-4" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !isSaving) onCancel();
    }}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="room-edit-title"
        onSubmit={(event) => { event.preventDefault(); onSave(); }}
        className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-slate-50 shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-blue-600">Phòng</p>
            <h2 id="room-edit-title" className="mt-1 text-xl font-bold text-slate-900">Chỉnh sửa phòng</h2>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onCancel} disabled={isSaving} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 disabled:opacity-50">Hủy</button>
            <button type="submit" disabled={isSaving || draft.images.length < 4 || draft.images.length > 8 || draft.beds.length === 0} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{isSaving ? "Đang lưu..." : "Lưu thay đổi"}</button>
          </div>
        </header>

        <div className="grid gap-4 overflow-y-auto p-5 lg:grid-cols-2">
          <section className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="text-sm font-bold text-slate-800">Thông tin cơ bản</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-semibold text-slate-700">
                  Số phòng
                  <input required value={draft.roomNumber} onChange={(event) => patch({ roomNumber: event.target.value })} className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 font-normal" />
                </label>
                <label className="text-sm font-semibold text-slate-700">
                  Loại phòng
                  <select value={draft.roomType} onChange={(event) => patch({ roomType: event.target.value })} className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 font-normal">
                    {roomTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                  </select>
                </label>
                <label className="text-sm font-semibold text-slate-700">
                  Tòa nhà
                  <select value={selectedFloor?.buildingId ?? ""} onChange={(event) => {
                    const nextFloor = floors.find((floor) => floor.buildingId === event.target.value);
                    patch({ floorId: nextFloor?.value ?? "" });
                  }} className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 font-normal">
                    {buildings.map((building) => <option key={building.value} value={building.value}>{building.label}</option>)}
                  </select>
                </label>
                <label className="text-sm font-semibold text-slate-700">
                  Tầng
                  <select value={draft.floorId} onChange={(event) => patch({ floorId: event.target.value })} className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 font-normal">
                    {availableFloors.map((floor) => <option key={floor.value} value={floor.value}>{floor.label}</option>)}
                  </select>
                </label>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="text-sm font-bold text-slate-800">Sức chứa và phụ thu theo chính sách</h3>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <ReadOnlyValue label="Diện tích (m²)" value={draft.area} />
                <ReadOnlyValue
                  label="Giá cơ bản / đêm"
                  value={draft.basePrice != null && draft.basePrice !== "" && Number.isFinite(Number(draft.basePrice))
                    ? `${Number(draft.basePrice).toLocaleString("vi-VN")} đ`
                    : ""}
                />
                <ReadOnlyValue label="Sức chứa tiêu chuẩn" value={draft.standardCapacity} />
                <ReadOnlyValue label="Khách thêm tối đa" value={draft.maxExtraGuests} />
                <ReadOnlyValue label="Phụ thu người lớn" value={draft.extraAdultFee} />
                <ReadOnlyValue label="Phụ thu trẻ em" value={draft.extraChildFee} />
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="text-sm font-bold text-slate-800">Loại giường</h3>
              <div className="mt-3 space-y-2">
                {bedTypes.map((bedType) => {
                  const selected = draft.beds.find((bed) => bed.bedTypeId === bedType.id);
                  return (
                    <div key={bedType.id} className="flex items-center gap-3 rounded-lg border border-slate-200 p-2.5">
                      <label className="flex min-w-0 flex-1 items-center gap-2 text-sm text-slate-700">
                        <input type="checkbox" checked={Boolean(selected)} onChange={(event) => toggleBedType(bedType.id, event.target.checked)} />
                        <span className="truncate">{bedType.name}</span>
                        {bedType.isExtraBed && <span className="text-xs text-amber-700">Giường phụ</span>}
                      </label>
                      {selected && <label className="flex items-center gap-2 text-xs text-slate-500">SL
                        <input type="number" min="1" step="1" value={selected.quantity} onChange={(event) => patch({
                          beds: draft.beds.map((bed) => bed.bedTypeId === bedType.id
                            ? { ...bed, quantity: Number(event.target.value) }
                            : bed),
                        })} className="h-9 w-20 rounded border border-slate-200 px-2 text-sm" />
                      </label>}
                    </div>
                  );
                })}
                {bedTypes.length === 0 && <p className="text-sm text-amber-700">Chưa có loại giường để chọn.</p>}
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-slate-800">Ảnh phòng <span className="font-normal text-slate-500">(4–8 ảnh)</span></h3>
                <label className="cursor-pointer rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-blue-700">
                  Thêm ảnh
                  <input type="file" accept="image/*" multiple className="hidden" onChange={(event) => {
                    addImages(event.target.files);
                    event.currentTarget.value = "";
                  }} />
                </label>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {draft.images.map((image, index) => (
                  <div key={`${image}-${index}`} className="relative overflow-hidden rounded-lg border border-slate-200">
                    <img src={image} alt={`Ảnh phòng ${index + 1}`} className="h-24 w-full object-cover" />
                    <button type="button" onClick={() => patch({ defaultImageIndex: index })} className={`absolute right-1 top-1 rounded-full px-2 py-1 text-[10px] font-bold ${draft.defaultImageIndex === index ? "bg-amber-400 text-white" : "bg-black/60 text-white"}`}>
                      {draft.defaultImageIndex === index ? "Ảnh chính" : "Chọn ảnh chính"}
                    </button>
                    <button type="button" onClick={() => removeImage(index)} className="absolute left-1 top-1 rounded-full bg-black/60 px-2 py-1 text-[10px] font-bold text-white">Xóa</button>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="text-sm font-bold text-slate-800">Tiện nghi</h3>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {amenities.map((amenity) => (
                  <label key={amenity.id} className="flex items-start gap-2 rounded-lg border border-slate-200 p-2.5 text-sm text-slate-700">
                    <input type="checkbox" checked={draft.amenityIds.includes(amenity.id)} onChange={(event) => toggleAmenity(amenity.id, event.target.checked)} className="mt-0.5" />
                    <span>{amenity.name}{amenity.price != null ? <span className="ml-1 text-xs text-slate-500">({amenity.price.toLocaleString("vi-VN")}đ)</span> : null}</span>
                  </label>
                ))}
                {amenities.length === 0 && <p className="text-sm text-amber-700">Chưa tải được danh sách tiện nghi.</p>}
              </div>
            </div>
            {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
          </section>
        </div>
      </form>
    </div>,
    document.body,
  );
}

function ReadOnlyValue({ label, value }: { label: string; value: string }) {
  return <label className="text-xs font-medium text-slate-500">{label}<input readOnly value={value || "—"} className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-2 text-sm text-slate-600" /></label>;
}