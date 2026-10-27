import { useState } from "react";
import { FileSpreadsheet, LoaderCircle, Plus, Upload } from "lucide-react";
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
    } catch (error) {
      const message = errorMessage(error);
      setImportMessage(message);
      toast({ variant: "destructive", title: "Không thể nhập tiện ích", description: message });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <section className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/60 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Danh mục tiện ích toàn hệ thống</h2>
          <p className="mt-1 text-sm text-slate-500">Chỉ Super Admin được thêm, chỉnh sửa hoặc nhập tiện ích. Danh mục này dùng chung cho các chi nhánh.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setIsCreatingFormOpen(true)} className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white hover:bg-blue-700">
            <Plus size={16} /> Thêm tiện ích
          </button>
          <button type="button" onClick={downloadAmenityTemplate} className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            <FileSpreadsheet size={16} /> Tải mẫu Excel
          </button>
          <label className={`inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg bg-emerald-600 px-3 text-sm font-semibold text-white hover:bg-emerald-700 ${isImporting ? "pointer-events-none opacity-50" : ""}`}>
            {isImporting ? <LoaderCircle size={16} className="animate-spin" /> : <Upload size={16} />}
            {isImporting ? "Đang nhập..." : "Import CSV / Excel"}
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
        </div>
      </header>
      {importMessage && <p role="status" className={`border-b px-5 py-2 text-sm ${isImporting ? "border-blue-100 bg-blue-50 text-blue-700" : "border-slate-100 bg-slate-50 text-slate-600"}`}>{importMessage}</p>}
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
    </section>
  );
}
