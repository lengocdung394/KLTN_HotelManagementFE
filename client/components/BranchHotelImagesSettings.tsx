import { useEffect, useRef, useState } from "react";
import { ImagePlus, LoaderCircle, Save, Trash2 } from "lucide-react";
import { uploadBranchImagesToCloudinary } from "../services/cloudinaryUploadApi";
import {
  useGetCurrentBranchImagesQuery,
  useUpdateCurrentBranchImagesMutation,
} from "../services/branchHotelApi";
import { useAppSelector } from "../store/hooks";
import { localizedText } from "../i18n";

const MAX_BRANCH_IMAGES = 10;

const errorMessage = (error: unknown) => {
  if (!error || typeof error !== "object") {
    return localizedText("Không thể cập nhật ảnh chi nhánh.", "Could not update branch photos.");
  }
  const value = error as {
    data?: { message?: string; error?: string } | string;
    message?: string;
  };
  if (typeof value.data === "string") return value.data;
  return value.data?.message
    ?? value.data?.error
    ?? value.message
    ?? localizedText("Không thể cập nhật ảnh chi nhánh.", "Could not update branch photos.");
};

export default function BranchHotelImagesSettings() {
  const { hotelId, hotelName, roles } = useAppSelector((state) => state.auth);
  const canEditImages = roles.includes("ROLE_ADMIN") || roles.includes("ROLE_MANAGER");
  const inputRef = useRef<HTMLInputElement>(null);
  const {
    data: savedImages = [],
    isLoading,
    isError,
  } = useGetCurrentBranchImagesQuery(undefined, { skip: !hotelId });
  const [updateImages, { isLoading: isSaving }] = useUpdateCurrentBranchImagesMutation();
  const [images, setImages] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setImages(savedImages);
  }, [savedImages]);

  const addImages = async (files: FileList | null) => {
    if (!files?.length) return;
    setError("");
    setSaved(false);
    const remainingSlots = MAX_BRANCH_IMAGES - images.length;
    if (files.length > remainingSlots) {
      setError(localizedText(
        `Chỉ có thể thêm tối đa ${remainingSlots} ảnh nữa.`,
        `You can add at most ${remainingSlots} more photos.`,
      ));
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    setIsUploading(true);
    let uploadedImages: string[] = [];
    try {
      const uploaded = await uploadBranchImagesToCloudinary(
        Array.from(files),
        hotelName || `branch-${hotelId}`,
      );
      const nextImages = [...new Set([...images, ...uploaded.values()])]
        .slice(0, MAX_BRANCH_IMAGES);
      uploadedImages = nextImages;
      setImages(nextImages);
      const savedUrls = await updateImages(nextImages).unwrap();
      setImages(savedUrls);
      setSaved(true);
    } catch (uploadError: unknown) {
      if (uploadedImages.length > 0) setImages(uploadedImages);
      setError(errorMessage(uploadError));
    } finally {
      setIsUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const save = async () => {
    setError("");
    setSaved(false);
    try {
      await updateImages(images).unwrap();
      setSaved(true);
    } catch (saveError: unknown) {
      setError(errorMessage(saveError));
    }
  };

  if (!hotelId) {
    return (
      <section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
        {localizedText(
          "Tài khoản chưa được gán với chi nhánh nên không thể cấu hình ảnh.",
          "This account is not assigned to a branch and cannot configure its photos.",
        )}
      </section>
    );
  }

  return (
    <section className="mt-6 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-bold text-slate-900">
            {localizedText("Hình ảnh chi nhánh", "Branch photos")}
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            {localizedText(
              "Thêm tối đa 10 ảnh để hiển thị trong trang chi tiết khách sạn.",
              "Add up to 10 photos to show on the customer hotel details page.",
            )}
          </p>
        </div>
        {canEditImages && <div className="flex gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={(event) => void addImages(event.currentTarget.files)}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={isLoading || isError || isUploading || images.length >= MAX_BRANCH_IMAGES}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {isUploading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
            {isUploading
              ? localizedText("Đang tải ảnh...", "Uploading...")
              : localizedText("Thêm ảnh", "Add photos")}
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={isLoading || isError || isSaving || isUploading || images.length === 0 && savedImages.length === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isSaving
              ? localizedText("Đang lưu...", "Saving...")
              : localizedText("Lưu thay đổi", "Save changes")}
          </button>
        </div>}
      </div>

      {isLoading && <p className="mt-5 text-sm text-slate-500">{localizedText("Đang tải ảnh...", "Loading photos...")}</p>}
      {isError && (
        <p role="alert" className="mt-5 text-sm text-red-600">
          {localizedText("Không tải được ảnh chi nhánh.", "Could not load branch photos.")}
        </p>
      )}
      {!isLoading && images.length === 0 && (
        <div className="mt-5 rounded-xl border border-dashed border-slate-300 py-10 text-center text-sm text-slate-500">
          {canEditImages
            ? localizedText("Chi nhánh chưa có ảnh. Hãy thêm ảnh để bắt đầu.", "No branch photos yet. Add photos to get started.")
            : localizedText("Chi nhánh hiện chưa có ảnh.", "This branch does not have any photos yet.")}
        </div>
      )}
      {images.length > 0 && (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {images.map((url, index) => (
            <figure key={`${url}-${index}`} className="group relative overflow-hidden rounded-xl border border-slate-200">
              <img src={url} alt={`${hotelName || "Chi nhánh"} ${index + 1}`} className="h-40 w-full object-cover" />
              {canEditImages && <button
                type="button"
                onClick={() => {
                  setImages((current) => current.filter((_, itemIndex) => itemIndex !== index));
                  setSaved(false);
                }}
                aria-label={localizedText(`Xóa ảnh ${index + 1}`, `Remove photo ${index + 1}`)}
                className="absolute right-2 top-2 rounded-lg bg-white/95 p-2 text-red-600 shadow hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
              </button>}
              <figcaption className="px-3 py-2 text-xs text-slate-500">
                {index + 1} / {images.length}
              </figcaption>
            </figure>
          ))}
        </div>
      )}
      {canEditImages && error && <p role="alert" className="mt-4 text-sm text-red-600">{error}</p>}
      {saved && <p role="status" className="mt-4 text-sm font-medium text-emerald-600">{localizedText("Đã lưu hình ảnh chi nhánh.", "Branch photos saved.")}</p>}
    </section>
  );
}
