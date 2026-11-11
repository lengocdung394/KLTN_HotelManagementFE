import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FileSpreadsheet, LoaderCircle, Plus, Save, Sparkles, Upload } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import RoomAmenitiesTab from "./RoomAmenitiesTab";
import CatalogEntryDialog, { type CatalogEntryMode } from "./CatalogEntryDialog";
import { downloadAmenityTemplate, parseAmenityImportFile } from "../lib/amenityBulkImport";
import {
  getAmenityImportStatus,
  isAmenityImportFinished,
  useCreateAmenityMutation,
  useGetAllAmenitiesQuery,
  useImportAmenitiesFromFileMutation,
  useUpdateAmenityMutation,
} from "../services/amenityApi";
import { localizedText } from "../i18n";

const errorMessage = (error: unknown) => {
  if (!error || typeof error !== "object") return localizedText("Đã xảy ra lỗi. Vui lòng thử lại.", "An error occurred. Please try again.");
  const apiError = error as { data?: { message?: string }; message?: string; error?: string };
  return apiError.data?.message ?? apiError.message ?? apiError.error ?? localizedText("Đã xảy ra lỗi. Vui lòng thử lại.", "An error occurred. Please try again.");
};

export default function SuperAdminAmenitiesPanel() {
  useTranslation();
  const { data: amenities = [], isLoading, isError, refetch } = useGetAllAmenitiesQuery();
  const [createAmenity, { isLoading: isCreating }] = useCreateAmenityMutation();
  const [updateAmenity] = useUpdateAmenityMutation();
  const [importAmenities] = useImportAmenitiesFromFileMutation();
  const [isEntryDialogOpen, setIsEntryDialogOpen] = useState(false);
  const [entryMode, setEntryMode] = useState<CatalogEntryMode>("manual");
  const [newAmenity, setNewAmenity] = useState({ name: "", price: "" });
  const [createFieldErrors, setCreateFieldErrors] = useState<Partial<Record<"name" | "price", string>>>({});
  const [createError, setCreateError] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [importMessage, setImportMessage] = useState("");

  const saveAmenity = async (id: number, amenity: { name: string; price: number }) => {
    try {
      await updateAmenity({ id, amenity }).unwrap();
      toast({ variant: "success", title: localizedText("Cập nhật tiện ích thành công", "Amenity updated"), description: localizedText(`Đã cập nhật “${amenity.name}”.`, `Updated “${amenity.name}”.`) });
    } catch (error) {
      throw new Error(errorMessage(error));
    }
  };

  const addAmenity = async (amenity: { name: string; price: number }) => {
    try {
      await createAmenity(amenity).unwrap();
      toast({ variant: "success", title: localizedText("Thêm tiện ích thành công", "Amenity added"), description: localizedText(`Đã thêm “${amenity.name}”.`, `Added “${amenity.name}”.`) });
    } catch (error) {
      throw new Error(errorMessage(error));
    }
  };

  const submitNewAmenity = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = newAmenity.name.trim();
    const price = Number(newAmenity.price);
    const errors: Partial<Record<"name" | "price", string>> = {};
    if (!name) errors.name = localizedText("Vui lòng nhập tên tiện ích.", "Enter an amenity name.");
    if (!newAmenity.price.trim() || !Number.isFinite(price) || price < 0) {
      errors.price = localizedText("Vui lòng nhập mức giá hợp lệ không âm.", "Enter a valid non-negative price.");
    }
    setCreateFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }
    setCreateError("");
    try {
      await addAmenity({ name, price });
      setNewAmenity({ name: "", price: "" });
      setIsEntryDialogOpen(false);
    } catch (error) {
      setCreateError(errorMessage(error));
    }
  };

  const importFile = async (file?: File) => {
    if (!file) return;
    setIsImporting(true);
    setImportMessage(localizedText("Đang kiểm tra dữ liệu tiện ích...", "Validating amenity data..."));
    try {
      const request = await parseAmenityImportFile(file);
      const { taskId } = await importAmenities(request).unwrap();
      if (!taskId) throw new Error(localizedText("Máy chủ không trả về mã tiến trình nhập.", "The server did not return an import task ID."));
      let status = await getAmenityImportStatus(taskId);
      while (!isAmenityImportFinished(status)) {
        setImportMessage(status.message || localizedText("Đang nhập tiện ích...", "Importing amenities..."));
        await new Promise((resolve) => window.setTimeout(resolve, 750));
        status = await getAmenityImportStatus(taskId);
      }
      if (status.status.trim().toUpperCase() !== "SUCCESS") {
        throw new Error(status.message || localizedText("Không thể nhập tiện ích.", "Could not import amenities."));
      }
      const savedCount = status.details?.length ?? 0;
      setImportMessage(localizedText(`Đã nhập ${savedCount} tiện ích.`, `Imported ${savedCount} amenities.`));
      await refetch();
      toast({
        variant: savedCount > 0 ? "success" : "default",
        title: savedCount > 0 ? localizedText("Nhập tiện ích thành công", "Amenities imported") : localizedText("Không có tiện ích mới", "No new amenities"),
        description: savedCount > 0 ? localizedText(`Đã thêm ${savedCount} tiện ích.`, `Added ${savedCount} amenities.`) : localizedText("Các tiện ích trong file đã tồn tại.", "The amenities in this file already exist."),
      });
      setIsEntryDialogOpen(false);
    } catch (error) {
      const message = errorMessage(error);
      setImportMessage(message);
      toast({ variant: "destructive", title: localizedText("Không thể nhập tiện ích", "Could not import amenities"), description: message });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="border-b border-slate-100 bg-gradient-to-br from-blue-50/80 via-white to-white p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-blue-100 text-blue-700">
            <Sparkles size={20} />
          </span>
          <div className="flex min-w-0 flex-1 flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">{localizedText("Danh mục tiện ích toàn hệ thống", "System-wide amenity catalog")}</h2>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
                {localizedText("Quản lý danh mục tiện ích dùng chung cho các chi nhánh. Chỉ Super Admin được thêm, chỉnh sửa hoặc nhập dữ liệu.", "Manage the amenity catalog shared by all branches. Only Super Admins can add, edit, or import items.")}
              </p>
            </div>
            <button type="button" onClick={() => { setEntryMode("manual"); setCreateError(""); setCreateFieldErrors({}); setIsEntryDialogOpen(true); }} className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700">
              <Plus size={16} /> {localizedText("Thêm tiện ích", "Add amenity")}
            </button>
          </div>
        </div>
      </header>
      <RoomAmenitiesTab
        amenities={amenities}
        isLoading={isLoading}
        isError={isError}
        canManage
        onSave={(amenity, changes) => saveAmenity(amenity.id, changes)}
      />
      {isEntryDialogOpen && (
        <CatalogEntryDialog
          title={localizedText("Thêm tiện ích vào danh mục", "Add amenities to the catalog")}
          description={localizedText("Thêm thủ công một tiện ích hoặc nhập nhiều tiện ích từ file Excel.", "Add an amenity manually or import multiple amenities from an Excel file.")}
          mode={entryMode}
          onModeChange={(mode) => { setEntryMode(mode); setImportMessage(""); setCreateError(""); setCreateFieldErrors({}); }}
          onClose={() => { if (!isImporting && !isCreating) setIsEntryDialogOpen(false); }}
          manualContent={
            <form noValidate onSubmit={(event) => void submitNewAmenity(event)} className="space-y-4">
              {createError && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{createError}</p>}
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm font-semibold text-slate-700">
                  {localizedText("Tên tiện ích", "Amenity name")} <span className="text-rose-600">*</span>
                  <input required autoFocus value={newAmenity.name} onChange={(event) => {
                    setNewAmenity((current) => ({ ...current, name: event.target.value }));
                    setCreateFieldErrors((current) => ({ ...current, name: undefined }));
                    setCreateError("");
                  }} aria-invalid={Boolean(createFieldErrors.name)} aria-describedby={createFieldErrors.name ? "amenity-name-error" : undefined} placeholder={localizedText("Ví dụ: Minibar", "e.g. Minibar")} className={`mt-1.5 h-10 w-full rounded-lg border px-3 text-sm font-normal outline-none focus:border-blue-400 ${createFieldErrors.name ? "border-rose-400" : "border-slate-200"}`} />
                  {createFieldErrors.name && <span id="amenity-name-error" role="alert" className="mt-1 block text-xs font-normal text-rose-600">{createFieldErrors.name}</span>}
                </label>
                <label className="block text-sm font-semibold text-slate-700">
                  {localizedText("Giá", "Price")} <span className="text-rose-600">*</span>
                  <input required type="number" min="0" value={newAmenity.price} onChange={(event) => {
                    setNewAmenity((current) => ({ ...current, price: event.target.value }));
                    setCreateFieldErrors((current) => ({ ...current, price: undefined }));
                    setCreateError("");
                  }} aria-invalid={Boolean(createFieldErrors.price)} aria-describedby={createFieldErrors.price ? "amenity-price-error" : undefined} placeholder={localizedText("Nhập giá", "Enter price")} className={`mt-1.5 h-10 w-full rounded-lg border px-3 text-sm font-normal outline-none focus:border-blue-400 ${createFieldErrors.price ? "border-rose-400" : "border-slate-200"}`} />
                  {createFieldErrors.price && <span id="amenity-price-error" role="alert" className="mt-1 block text-xs font-normal text-rose-600">{createFieldErrors.price}</span>}
                </label>
              </div>
              <button type="submit" disabled={isCreating} className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
                <Save size={15} /> {isCreating ? localizedText("Đang lưu...", "Saving...") : localizedText("Thêm tiện ích", "Add amenity")}
              </button>
            </form>
          }
          fileContent={
            <div className="space-y-4">
              <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4">
                <div className="flex items-start gap-3">
                  <FileSpreadsheet size={19} className="mt-0.5 shrink-0 text-blue-700" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-800">{localizedText("Bước 1: Chuẩn bị file theo mẫu", "Step 1: Prepare a file using the template")}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-600">
                      {localizedText("File cần có hai cột", "The file must contain two columns")} <strong>{localizedText("Tên tiện ích", "Amenity name")}</strong> {localizedText("và", "and")} <strong>{localizedText("Giá", "Price")}</strong>. {localizedText("Hỗ trợ định dạng CSV hoặc Excel.", "CSV and Excel formats are supported.")}
                    </p>
                    <button
                      type="button"
                      onClick={downloadAmenityTemplate}
                      className="mt-3 inline-flex h-9 items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
                    >
                      <FileSpreadsheet size={15} /> {localizedText("Tải file mẫu Excel", "Download Excel template")}
                    </button>
                  </div>
                </div>
              </div>
              <label className={`flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-center transition hover:border-emerald-400 hover:bg-emerald-50/50 ${isImporting ? "pointer-events-none opacity-60" : ""}`}>
                {isImporting ? (
                  <LoaderCircle size={22} className="animate-spin text-emerald-700" />
                ) : (
                  <Upload size={22} className="text-emerald-700" />
                )}
                <span className="mt-2 text-sm font-semibold text-slate-800">
                  {isImporting ? localizedText("Đang xử lý file...", "Processing file...") : localizedText("Bước 2: Chọn file CSV hoặc Excel", "Step 2: Choose a CSV or Excel file")}
                </span>
                <span className="mt-1 text-xs text-slate-500">
                  {isImporting ? localizedText("Vui lòng đợi trong giây lát", "Please wait a moment") : localizedText("Nhấn vào đây để duyệt file từ thiết bị", "Click here to browse files on your device")}
                </span>
                <input
                  type="file"
                  accept=".csv,.xlsx"
                  className="sr-only"
                  disabled={isImporting}
                  onChange={(event) => {
                    void importFile(event.target.files?.[0]);
                    event.currentTarget.value = "";
                  }}
                />
              </label>
              {isImporting && (
                <p role="status" className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700">
                  {importMessage || localizedText("Đang nhập tiện ích...", "Importing amenities...")}
                </p>
              )}
              {!isImporting && importMessage && (
                <p role="status" className={`rounded-lg px-3 py-2 text-sm ${importMessage.startsWith("Đã nhập") || importMessage.startsWith("Imported") ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                  {importMessage}
                </p>
              )}
            </div>
          }
        />
      )}
    </section>
  );
}
