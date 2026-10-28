import { useState } from "react";
import { FileSpreadsheet, LoaderCircle, Plus, Sparkles, Upload, X } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import RoomAmenitiesTab from "./RoomAmenitiesTab";
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
  const [isCreatingFormOpen, setIsCreatingFormOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
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
      setIsImportDialogOpen(false);
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
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-slate-900">Danh mục tiện ích toàn hệ thống</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
              Quản lý danh mục tiện ích dùng chung cho các chi nhánh. Chỉ Super Admin được thêm, chỉnh sửa hoặc nhập dữ liệu.
            </p>
          </div>
        </div>
        <div className="mt-5 flex flex-col gap-2 border-t border-blue-100/80 pt-4 sm:flex-row sm:flex-wrap sm:justify-end">
          <button type="button" onClick={() => setIsCreatingFormOpen(true)} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700">
            <Plus size={16} /> Thêm tiện ích
          </button>
          <button
            type="button"
            onClick={() => {
              setImportMessage("");
              setIsImportDialogOpen(true);
            }}
            disabled={isImporting}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 text-sm font-semibold text-emerald-800 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Upload size={16} /> Nhập từ file
          </button>
        </div>
      </header>
      <RoomAmenitiesTab
        amenities={amenities}
        isLoading={isLoading || isCreating}
        isError={isError}
        canManage
        isCreating={isCreatingFormOpen}
        onCreateOpenChange={setIsCreatingFormOpen}
        onSave={(amenity, changes) => saveAmenity(amenity.id, changes)}
        onAdd={addAmenity}
      />
      {isImportDialogOpen && (
        <div
          className="fixed inset-0 z-70 grid place-items-center bg-slate-950/50 p-4 backdrop-blur-sm"
          onMouseDown={() => {
            if (!isImporting) setIsImportDialogOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="amenity-import-title"
            className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="flex items-start justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
                  <Upload size={19} />
                </span>
                <div>
                  <h3 id="amenity-import-title" className="font-bold text-slate-900">Nhập tiện ích từ file</h3>
                  <p className="mt-1 text-xs text-slate-500">Tải file mẫu hoặc chọn file dữ liệu của bạn</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsImportDialogOpen(false)}
                disabled={isImporting}
                aria-label="Đóng"
                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <X size={18} />
              </button>
            </header>
            <div className="space-y-4 p-5 sm:p-6">
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
          </section>
        </div>
      )}
    </section>
  );
}
