import { useState } from "react";
import { createPortal } from "react-dom";
import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getRoomAmenityTranslationKey } from "@/lib/roomLocalization";

export type RoomDetailsData = {
  id: string;
  databaseId?: string;
  buildingName?: string;
  buildingId?: string;
  floorId?: string;
  name: string;
  images: string[];
  floor: string;
  size: string;
  beds: string;
  bedConfigurations?: Array<{ bedTypeId: number; name?: string; quantity: number }>;
  capacity: number;
  standardCapacity: number;
  maxExtraGuests: number;
  extraAdultFee: number;
  extraChildFee: number;
  guestPolicy: string;
  price: number;
  status: string;
  cleaner: string;
  services: string[];
  description?: string;
};

const statusStyle: Record<string, string> = {
  "Sẵn sàng": "bg-emerald-50 text-emerald-700",
  "Đang dọn": "bg-amber-50 text-amber-700",
  "Đang ở": "bg-blue-50 text-blue-700",
  "Bảo trì": "bg-rose-50 text-rose-700",
};
export default function RoomDetailModal({ room, onClose }: { room: RoomDetailsData; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [showGallery, setShowGallery] = useState(false);
  const galleryImages = room.images.length > 0 ? room.images : ["https://images.pexels.com/photos/6876834/pexels-photo-6876834.jpeg"];
  const money = (value: number) =>
    `${value.toLocaleString(i18n.resolvedLanguage?.startsWith("en") ? "en-US" : "vi-VN")}${i18n.resolvedLanguage?.startsWith("en") ? " VND" : "đ"}`;
  const roomTypeName = (value: string) => {
    const normalized = value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (normalized.includes("standard") || normalized.includes("phong tieu chuan")) return t("calendar.standardRoom");
    if (normalized.includes("deluxe") || normalized.includes("superior") || normalized.includes("phong cao cap")) return t("calendar.deluxeRoom");
    if (normalized.includes("suite") || normalized.includes("phong thuong hang")) return t("calendar.suiteRoom");
    if (normalized.includes("family") || normalized.includes("phong gia dinh")) return t("room.createForm.familyRoom");
    return value;
  };
  const statusName = (value: string) => {
    const normalized = value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (normalized.includes("san sang") || normalized === "ready") return t("room.ready");
    if (normalized.includes("dang don") || normalized === "cleaning") return t("room.cleaning");
    if (normalized.includes("dang o") || normalized === "in_use") return t("room.staying");
    if (normalized.includes("bao tri") || normalized === "maintenance") return t("room.maintenance");
    return value;
  };
  const bedName = (value: string) => value.split(" · ").map((item) => {
    const quantity = item.match(/\s*[×x]\s*(\d+)$/i)?.[1];
    const name = quantity ? item.replace(/\s*[×x]\s*\d+$/i, "") : item;
    const normalized = name.toLowerCase();
    const translated = normalized.includes("2 giường đơn") || normalized.includes("2 single beds")
      ? t("room.doubleSingleBeds")
      : normalized.includes("giường đơn") || normalized.includes("single bed")
        ? t("room.singleBed")
        : normalized.includes("giường king") || normalized.includes("king-size") || normalized.includes("king size")
          ? t("room.kingBed")
          : normalized.includes("chưa cập nhật loại giường")
            ? t("room.bedNotUpdated")
            : name;
    return `${translated}${quantity ? ` × ${quantity}` : ""}`;
  }).join(" · ");
  const amenityName = (value: string) => {
    const translationKey = getRoomAmenityTranslationKey(value);
    return translationKey ? t(translationKey) : value;
  };
  const floorName = room.floor.match(/\d+/)?.[0]
    ? t("room.floorOption", { floor: room.floor.match(/\d+/)?.[0] })
    : room.floor;
  const localizedRoomName = roomTypeName(room.name);

  return createPortal(<div className="fixed inset-0 z-60 grid place-items-center bg-slate-950/50 p-3 sm:p-4" onMouseDown={onClose}>
    <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-blue-600">{t("room.roomInformation")}</p>
          <h3 className="text-lg font-bold text-slate-900">{t("room.roomLabel")} {room.id} · {localizedRoomName}</h3>
          <p className="text-xs text-slate-500">{floorName} · {room.size === "Chưa cập nhật" ? t("room.areaNotUpdated") : room.size} · {bedName(room.beds)}</p>
        </div>
        <button type="button" onClick={onClose} className="text-2xl leading-none text-slate-400 hover:text-slate-700" aria-label={t("common.close")}>×</button>
      </div>

      <div className="space-y-3.5 overflow-y-auto p-4 text-xs sm:text-sm">
        <div className="space-y-3">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
            <img src={galleryImages[0]} alt={`${localizedRoomName} · ${t("room.roomLabel")} ${room.id}`} className="h-44 w-full object-cover" />
          </div>
          <div className="rounded-xl border border-slate-200 p-3.5">
            <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">{t("room.roomSpecifications")}</h4>
            <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
              <div><p className="text-[11px] text-slate-400">{t("room.roomType")}</p><p className="font-semibold text-slate-800">{localizedRoomName}</p></div>
              <div><p className="text-[11px] text-slate-400">{t("room.beds")}</p><p className="font-semibold text-slate-800">{bedName(room.beds)}</p></div>
              <div><p className="text-[11px] text-slate-400">{t("room.area")}</p><p className="font-semibold text-slate-800">{room.size === "Chưa cập nhật" ? t("room.areaNotUpdated") : room.size}</p></div>
              <div><p className="text-[11px] text-slate-400">{t("room.locationLabel")}</p><p className="font-semibold text-slate-800">{floorName}</p></div>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-slate-50 p-3.5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold text-slate-700">{t("room.currentStatus")}</p>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusStyle[room.status] ?? "bg-slate-100 text-slate-600"}`}>
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />{statusName(room.status)}
                </span>
              </div>
            </div>
            <div className="mt-3 flex items-end justify-between border-t border-slate-200 pt-3">
              <span className="text-xs text-slate-500">{t("room.pricePerNight")}</span>
              <strong className="text-lg text-slate-900">{money(room.price)}</strong>
            </div>
          </div>

          <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-3.5">
            <h4 className="text-xs font-bold uppercase tracking-wide text-amber-800">{t("room.guestCapacity")}</h4>
            <div className="mt-2 space-y-1.5 text-xs">
              <div className="flex justify-between gap-2"><span className="text-slate-600">{t("room.createForm.standardCapacity")}</span><strong className="text-slate-900">{room.standardCapacity} {t("room.capacityUnit")}</strong></div>
              <div className="flex justify-between gap-2"><span className="text-slate-600">{t("room.editForm.maxExtraGuests")}</span><strong className="text-slate-900">{room.maxExtraGuests} {t("room.capacityUnit")}</strong></div>
              <div className="flex justify-between gap-2 border-t border-amber-200 pt-1.5"><span className="text-slate-600">{t("room.adultSurcharge")}</span><strong className="text-amber-800">{money(room.extraAdultFee)}</strong></div>
              <div className="flex justify-between gap-2"><span className="text-slate-600">{t("room.childSurcharge")}</span><strong className="text-amber-800">{money(room.extraChildFee)}</strong></div>
              <p className="border-t border-amber-200 pt-1 text-[11px] text-slate-500">{t("room.infantFreeNotice")}</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 p-3.5">
          <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">{t("room.amenitiesLabel")}</h4>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {room.services.length > 0 ? room.services.map((service) => (
              <span key={service} className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                <Check size={12} />{amenityName(service)}
              </span>
            )) : <p className="text-xs text-slate-400">{t("room.noAmenitiesUpdated")}</p>}
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">
        <button type="button" onClick={() => setShowGallery(true)} className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">{t("room.viewAllPhotos")}</button>
        <button type="button" onClick={onClose} className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700">{t("common.close")}</button>
      </div>

      {showGallery && <div className="fixed inset-0 z-70 grid place-items-center bg-slate-950/80 p-4" onMouseDown={() => setShowGallery(false)}>
        <div className="w-full max-w-4xl" onMouseDown={(event) => event.stopPropagation()}>
          <div className="flex items-center justify-between text-white">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-300">{t("room.gallery")}</p>
              <h4 className="mt-0.5 text-lg font-bold">{t("room.roomLabel")} {room.id} · {localizedRoomName}</h4>
            </div>
            <button type="button" onClick={() => setShowGallery(false)} className="text-2xl leading-none text-white/70 hover:text-white" aria-label={t("common.close")}>×</button>
          </div>
          <div className="relative mt-3 overflow-hidden rounded-xl bg-black">
            <img src={galleryImages[galleryIndex]} alt={t("room.editForm.roomImageAlt", { count: galleryIndex + 1 })} className="h-[min(60vh,500px)] w-full object-contain" />
            <button type="button" onClick={() => setGalleryIndex((galleryIndex - 1 + galleryImages.length) % galleryImages.length)} className="absolute left-3 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-xl text-slate-700">‹</button>
            <button type="button" onClick={() => setGalleryIndex((galleryIndex + 1) % galleryImages.length)} className="absolute right-3 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-xl text-slate-700">›</button>
          </div>
          <div className="mt-2.5 grid grid-cols-4 gap-2 sm:grid-cols-8">
            {galleryImages.map((image, index) => <button type="button" key={`${image}-full-${index}`} onClick={() => setGalleryIndex(index)} className={`overflow-hidden rounded-lg border-2 ${galleryIndex === index ? "border-blue-400" : "border-transparent"}`}>
              <img src={image} alt={`Ảnh thu nhỏ ${index + 1}`} className="h-14 w-full object-cover" />
            </button>)}
          </div>
        </div>
      </div>}
    </div>
  </div>, document.body);
}