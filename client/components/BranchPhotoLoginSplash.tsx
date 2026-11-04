import { useEffect } from "react";
import { useGetPublicBranchImagesQuery } from "../services/branchHotelApi";
import { optimizeCloudinaryImage } from "../lib/cloudinaryImage";

export default function BranchPhotoLoginSplash({
  hotelId,
  hotelName,
  onComplete,
}: {
  hotelId: string | null;
  hotelName: string | null;
  onComplete: () => void;
}) {
  const { currentData: images = [] } = useGetPublicBranchImagesQuery(hotelId ?? "", {
    skip: !hotelId,
  });

  useEffect(() => {
    const timer = window.setTimeout(onComplete, 5000);
    return () => window.clearTimeout(timer);
  }, [onComplete]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950 p-4 sm:p-8"
      role="status"
      aria-live="polite"
      aria-label="Đang tải trang quản lý khách sạn"
    >
      <div className="relative h-full max-h-[820px] w-full max-w-6xl overflow-hidden rounded-3xl bg-slate-900 shadow-2xl">
        <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-1.5 opacity-70">
          {images.slice(0, 4).map((image, index) => (
            <img
              key={`${image}-${index}`}
              src={optimizeCloudinaryImage(image, 960)}
              alt=""
              className="h-full w-full object-cover"
            />
          ))}
        </div>
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-950/65 to-slate-950/35" />
        <div className="relative flex h-full flex-col justify-end p-7 text-white sm:p-12">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-300">
            Sen Việt Hotels
          </p>
          <h1 className="mt-3 text-3xl font-bold sm:text-5xl">
            {hotelName || "Cổng quản lý khách sạn"}
          </h1>
          <p className="mt-3 text-sm text-slate-200 sm:text-base">
            Đang chuẩn bị không gian quản lý chi nhánh của bạn...
          </p>
          <div
            className="mt-8 h-1.5 w-full overflow-hidden rounded-full bg-white/25"
            aria-label="Đang tải"
          >
            <div className="h-full w-full origin-left rounded-full bg-blue-400 animate-[branch-photo-progress_5s_linear_forwards]" />
          </div>
        </div>
      </div>
    </div>
  );
}
