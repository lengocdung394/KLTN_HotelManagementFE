import { useEffect, useState } from "react";
import { Images } from "lucide-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useGetPublicBranchImagesQuery } from "../services/branchHotelApi";
import { optimizeCloudinaryImage } from "../lib/cloudinaryImage";

export default function BranchHotelPhotoPanel({
  hotelId,
  hotelName,
}: {
  hotelId: string | null;
  hotelName: string | null;
}) {
  const {
    currentData: images = [],
    isLoading,
    isError,
  } = useGetPublicBranchImagesQuery(hotelId ?? "", { skip: !hotelId });
  const photos = images;
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex(0);
  }, [hotelId]);

  useEffect(() => {
    if (photos.length < 2) return;
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % photos.length);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [photos.length, hotelId]);

  const showPhoto = (index: number) => {
    setActiveIndex((index + photos.length) % photos.length);
  };

  return (
    <section className="mb-7 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="flex items-center gap-3 px-5 pt-5">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-600">
          <Images size={19} />
        </span>
        <div>
          <h3 className="font-bold text-slate-900">{hotelName || "Khách sạn"} · Hình ảnh</h3>
          <p className="mt-0.5 text-xs text-slate-500">Ảnh đại diện chi nhánh</p>
        </div>
      </div>
      {isLoading ? (
        <p className="px-5 py-7 text-sm text-slate-500">Đang tải hình ảnh khách sạn...</p>
      ) : isError ? (
        <p role="alert" className="px-5 py-7 text-sm text-rose-700">Không tải được hình ảnh khách sạn.</p>
      ) : photos.length === 0 ? (
        <p className="px-5 py-7 text-sm text-slate-500">Chi nhánh chưa có ảnh đại diện.</p>
      ) : (
        <div className="p-4">
          <div className="group relative h-56 overflow-hidden rounded-xl bg-slate-100 sm:h-72">
            {photos.map((image, index) => (
              <img
                key={`${image}-${index}`}
                src={optimizeCloudinaryImage(image, 1920)}
                alt={`${hotelName || "Khách sạn"} - ảnh ${index + 1}`}
                loading={index === activeIndex ? "eager" : "lazy"}
                className={`absolute inset-0 h-full w-full bg-slate-100 object-contain transition-opacity duration-700 ${
                  index === activeIndex ? "opacity-100" : "opacity-0"
                }`}
                aria-hidden={index !== activeIndex}
              />
            ))}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-transparent" />
            <div className="absolute inset-x-4 bottom-4 flex items-end justify-between text-white sm:inset-x-6 sm:bottom-5">
              <div>
                <p className="text-lg font-semibold">{hotelName || "Khách sạn"}</p>
                <p className="mt-1 text-xs text-white/80">Ảnh {activeIndex + 1} / {photos.length}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => showPhoto(activeIndex - 1)}
                  aria-label="Ảnh trước"
                  className="grid h-9 w-9 place-items-center rounded-full bg-white/20 backdrop-blur transition hover:bg-white/35"
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  type="button"
                  onClick={() => showPhoto(activeIndex + 1)}
                  aria-label="Ảnh tiếp theo"
                  className="grid h-9 w-9 place-items-center rounded-full bg-white/20 backdrop-blur transition hover:bg-white/35"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
