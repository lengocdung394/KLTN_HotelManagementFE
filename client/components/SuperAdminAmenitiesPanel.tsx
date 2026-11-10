import { useState } from "react";
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

const errorMessage = (error: unknown) => {
  if (!error || typeof error !== "object") return "Đã xảy ra lỗi. Vui lòng thử lại.";
  const apiError = error as { data?: { message?: string }; message?: string; error?: string };
  return apiError.data?.message ?? apiError.message ?? apiError.error ?? "Đã xảy ra lỗi. Vui lòng thử lại.";
};

export default function SuperAdminAmenitiesPanel() {
  const { data: amenities = [], isLoading, isError, refetch } = useGetAllAmenitiesQuery();
  const [createAmenity, { isLoading: isCreating }] = useCreateAmenityMutation();
  const [updateAmenity] = useUpdateAmenityMutation();
  const [importAmenities] = useImportAmenitiesFromFileMutation();
  const [isEntryDialogOpen, setIsEntryDialogOpen] = useState(false);
  const [entryMode, setEntryMode] = useState<CatalogEntryMode>("manual");
  const [newAmenity, setNewAmenity] = useState({ name: "", price: "" });
  const [createError, setCreateError] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [importMessage, setImportMessage] = useState("");

  const saveAmenity = async (id: number, amenity: { name: string; price: number }) => {
    try {
      await updateAmenity({ id, amenity }).unwrap();
      toast({ variant: "success", title: "Cập nhật tiện ích thành công", description: `Đã cập nhật “${amenity.name}”.` });
    } catch (error) {
      throw new Error(errorMessage(error));
    }
  };

  const addAmenity = async (amenity: { name: string; price: number }) => {
    try {
      await createAmenity(amenity).unwrap();
      toast({ variant: "success", title: "Thêm tiện ích thành công", description: `Đã thêm “${amenity.name}”.` });
    } catch (error) {
      throw new Error(errorMessage(error));
    }
  };

  const submitNewAmenity = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = newAmenity.name.trim();
    const price = Number(newAmenity.price);
    if (!name || !newAmenity.price || !Number.isFinite(price) || price < 0) {
      setCreateError(!name ? "Vui lòng nhập tên tiện ích." : "Vui lòng nhập mức giá hợp lệ không âm.");
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
    setImportMessage("Đang kiểm tra dữ liệu tiện ích...");
    try {
      const request = await parseAmenityImportFile(file);
      const { taskId } = await importAmenities(request).unwrap();
      if (!taskId) throw new Error("Máy chủ không trả về mã tiến trình nhập.");
      let status = await getAmenityImportStatus(taskId);
      while (!isAmenityImportFinished(status)) {
        setImportMessage(status.message || "Đang nhập tiện ích...");
        await new Promise((resolve) => window.setTimeout(resolve, 750));
        status = await getAmenityImportStatus(taskId);
      }
      if (status.status.trim().toUpperCase() !== "SUCCESS") {
        throw new Error(status.message || "Không thể nhập tiện ích.");
      }
      const savedCount = status.details?.length ?? 0;
      setImportMessage(`Đã nhập ${savedCount} tiện ích.`);
      await refetch();
      toast({
        variant: savedCount > 0 ? "success" : "default",
        title: savedCount > 0 ? "Nhập tiện ích thành công" : "Không có tiện ích mới",
        description: savedCount > 0 ? `Đã thêm ${savedCount} tiện ích.` : "Các tiện ích trong file đã tồn tại.",
      });
      setIsEntryDialogOpen(false);
    } catch (error) {
      const message = errorMessage(error);
      setImportMessage(message);
      toast({ variant: "destructive", title: "Không thể nhập tiện ích", description: message });
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
              <h2 className="text-lg font-bold text-slate-900">Danh mục tiện ích toàn hệ thống</h2>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
                Quản lý danh mục tiện ích dùng chung cho các chi nhánh. Chỉ Super Admin được thêm, chỉnh sửa hoặc nhập dữ liệu.
              </p>
            </div>
            <button type="button" onClick={() => { setEntryMode("manual"); setCreateError(""); setIsEntryDialogOpen(true); }} className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700">
              <Plus size={16} /> Thêm tiện ích
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
          title="Thêm tiện ích vào danh mục"
          description="Thêm thủ công một tiện ích hoặc nhập nhiều tiện ích từ file Excel."
          mode={entryMode}
          onModeChange={(mode) => { setEntryMode(mode); setImportMessage(""); setCreateError(""); }}
          onClose={() => { if (!isImporting && !isCreating) setIsEntryDialogOpen(false); }}
          manualContent={
            <form onSubmit={(event) => void submitNewAmenity(event)} className="space-y-4">
              {createError && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{createError}</p>}
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm font-semibold text-slate-700">
                  Tên tiện ích <span className="text-rose-600">*</span>
                  <input required autoFocus value={newAmenity.name} onChange={(event) => setNewAmenity((current) => ({ ...current, name: event.target.value }))} placeholder="Ví dụ: Minibar" className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none focus:border-blue-400" />
                </label>
                <label className="block text-sm font-semibold text-slate-700">
                  Giá <span className="text-rose-600">*</span>
                  <input required type="number" min="0" value={newAmenity.price} onChange={(event) => setNewAmenity((current) => ({ ...current, price: event.target.value }))} placeholder="Nhập giá" className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none focus:border-blue-400" />
                </label>
              </div>
              <button type="submit" disabled={isCreating || !newAmenity.name.trim() || !newAmenity.price || !Number.isFinite(Number(newAmenity.price)) || Number(newAmenity.price) < 0} className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
                <Save size={15} /> {isCreating ? "Đang lưu..." : "Thêm tiện ích"}
              </button>
            </form>
          }
          fileContent={
            <div className="space-y-4">
              <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4">
                <div className="flex items-start gap-3">
                  <FileSpreadsheet size={19} className="mt-0.5 shrink-0 text-blue-700" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-800">Bước 1: Chuẩn bị file theo mẫu</p>
                    <p className="mt-1 text-xs leading-5 text-slate-600">
                      File cần có hai cột <strong>Tên tiện ích</strong> và <strong>Giá</strong>. Hỗ trợ định dạng CSV hoặc Excel.
                    </p>
                    <button
                      type="button"
                      onClick={downloadAmenityTemplate}
                      className="mt-3 inline-flex h-9 items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
                    >
                      <FileSpreadsheet size={15} /> Tải file mẫu Excel
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
                  {isImporting ? "Đang xử lý file..." : "Bước 2: Chọn file CSV hoặc Excel"}
                </span>
                <span className="mt-1 text-xs text-slate-500">
                  {isImporting ? "Vui lòng đợi trong giây lát" : "Nhấn vào đây để duyệt file từ thiết bị"}
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
                  {importMessage || "Đang nhập tiện ích..."}
                </p>
              )}
              {!isImporting && importMessage && (
                <p role="status" className={`rounded-lg px-3 py-2 text-sm ${importMessage.startsWith("Đã nhập") ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
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
