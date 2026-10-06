import { useCallback, useEffect, useMemo, useState } from "react";
import { ConciergeBell, Eye, ImagePlus, Pencil, Plus, Upload, X, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { useCreateServiceMutation, useGetAllServicesQuery, useUpdateServiceMutation, type HotelService } from "../services/serviceApi";
import { downloadServiceTemplate, parseServiceImportArchive, validateServiceImportArchive, type ServiceImportRowResult } from "../lib/serviceBulkImport";
import {
  getServiceImportErrorMessage,
  isServiceImportFailed,
  startServiceImport,
  type ServiceImportTaskStatus,
} from "../services/serviceImportApi";
import { baseApi } from "../services/baseApi";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { uploadServiceImagesToCloudinary } from "../services/cloudinaryUploadApi";
import { bindHotelSocketEvents } from "../lib/socket";
import BulkImportDialog from "../components/BulkImportDialog";
import ServiceImportProgressCard from "../components/ServiceImportProgressCard";

const getSaveErrorMessage = (error: unknown) => {
  if (typeof error === "object" && error !== null && "data" in error) {
    const data = error.data;
    if (typeof data === "object" && data !== null && "message" in data && typeof data.message === "string") {
      return data.message;
    }
  }
  return "Không thể lưu dịch vụ. Vui lòng kiểm tra thông tin hoặc thử lại.";
};

export default function ServiceWorkspace() {
  const dispatch = useAppDispatch();
  const [localServices, setLocalServices] = useState<HotelService[]>([]);
  const [statusOverrides, setStatusOverrides] = useState<Record<string, boolean>>({});
  const [detailService, setDetailService] = useState<HotelService | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editingService, setEditingService] = useState<HotelService | null>(null);
  const [newService, setNewService] = useState({ name: "", detail: "", price: "", unit: "lần", category: "Khác", imageUrl: "", active: true });
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [saveError, setSaveError] = useState("");
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [serviceImportTaskId, setServiceImportTaskId] = useState("");
  const [serviceImportRows, setServiceImportRows] = useState<ServiceImportRowResult[]>([]);
  const [serviceImportArchiveError, setServiceImportArchiveError] = useState("");
  const [serviceImportValidationOnly, setServiceImportValidationOnly] = useState(false);
  const [serviceImportUploadProgress, setServiceImportUploadProgress] = useState("");
  const [serviceImportSocketStatus, setServiceImportSocketStatus] = useState<ServiceImportTaskStatus | undefined>();
  const [createServiceRequest, { isLoading: isCreating }] = useCreateServiceMutation();
  const [updateServiceRequest, { isLoading: isUpdating }] = useUpdateServiceMutation();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  const hotelId = useAppSelector((state) => state.auth.hotelId);
  const hotelName = useAppSelector((state) => state.auth.hotelName);
  const hasHotelId = Boolean(hotelId) && !Number.isNaN(Number(hotelId));
  const { data: services = [], isLoading, isError } = useGetAllServicesQuery(hasHotelId ? { hotelId: Number(hotelId) } : undefined, { skip: !hasHotelId });
  const allServices = useMemo(() => [...services, ...localServices], [services, localServices]);
  const filteredServices = useMemo(() => {
    const normalizedQuery = searchQuery.trim().normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase();
    return allServices.filter((service) => {
      const isActive = statusOverrides[service.id] ?? service.active;
      const matchesStatus = statusFilter === "all" || (statusFilter === "active" ? isActive : !isActive);
      const searchableText = [service.name, service.detail, service.category, service.unit]
        .join(" ")
        .normalize("NFD")
        .replace(/\p{M}/gu, "")
        .toLocaleLowerCase();
      return matchesStatus && (!normalizedQuery || searchableText.includes(normalizedQuery));
    });
  }, [allServices, searchQuery, statusFilter, statusOverrides]);
  const isSaving = isCreating || isUpdating;

  useEffect(() => {
    if (!hasHotelId) return;
    bindHotelSocketEvents({
      onServiceImportProgress: (data) => {
        if (!data || typeof data !== "object") return;
        const payload = data as Record<string, unknown>;
        const taskId = payload.taskId;
        if (typeof taskId !== "string" && typeof taskId !== "number") return;
        const status = typeof payload.status === "string" ? payload.status : "PROCESSING";
        const percent = typeof payload.percent === "number" ? payload.percent : undefined;
        const message = typeof payload.message === "string" ? payload.message : undefined;
        const socketStatus: ServiceImportTaskStatus = {
          taskId: String(taskId),
          status,
          ...(percent === undefined ? {} : { percent }),
          ...(message === undefined ? {} : { message }),
          completed: payload.completed === true,
        };
        setServiceImportSocketStatus(socketStatus);
        if (socketStatus.completed) {
          dispatch(baseApi.util.invalidateTags(["Service"]));
        }
      },
    });
  }, [dispatch, hasHotelId]);

  const totalPages = Math.max(1, Math.ceil(filteredServices.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedServices = filteredServices.slice((safePage - 1) * pageSize, safePage * pageSize);

  useEffect(() => {
    setPage(1);
  }, [allServices.length, pageSize, searchQuery, statusFilter]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const toggleServiceStatus = (serviceId: string) => {
    const currentService = allServices.find((service) => service.id === serviceId);
    if (!currentService) return;
    const currentStatus = statusOverrides[serviceId] ?? currentService.active;
    setStatusOverrides((current) => ({ ...current, [serviceId]: !currentStatus }));
    setLocalServices((current) => current.map((service) => service.id === serviceId ? { ...service, active: !service.active } : service));
  };

  const openCreateForm = () => {
    setEditingService(null);
    setSelectedImage(null);
    setSaveError("");
    setNewService({ name: "", detail: "", price: "", unit: "lần", category: "Khác", imageUrl: "", active: true });
    setShowCreate(true);
  };

  const openEditForm = (service: HotelService) => {
    setEditingService(service);
    setSelectedImage(null);
    setSaveError("");
    setNewService({
      name: service.name,
      detail: service.detail,
      price: String(service.price),
      unit: service.unit,
      category: service.category,
      imageUrl: service.imageUrl ?? "",
      active: service.active,
    });
    setShowCreate(true);
  };

  const saveService = async () => {
    const name = newService.name.trim();
    const detail = newService.detail.trim();
    const category = newService.category.trim();
    const price = Number(newService.price);
    if (!name || !detail || !category || !newService.unit || !Number.isFinite(price) || price < 0) {
      const message = "Vui lòng kiểm tra và điền đầy đủ thông tin hợp lệ.";
      setSaveError(message);
      toast({ variant: "destructive", title: "Thông tin chưa hợp lệ", description: message });
      return;
    }
    if (!editingService && !selectedImage) {
      const message = "Vui lòng tải ảnh dịch vụ lên.";
      setSaveError(message);
      toast({ variant: "destructive", title: "Thiếu ảnh dịch vụ", description: message });
      return;
    }

    setSaveError("");
    const service = { name, description: detail, price, unit: newService.unit, category, active: newService.active };
    const wasEditing = Boolean(editingService);
    try {
      if (editingService) {
        await updateServiceRequest({ id: editingService.id, service, imageFile: selectedImage }).unwrap();
      } else {
        await createServiceRequest({ service, imageFile: selectedImage }).unwrap();
      }
      setShowCreate(false);
      setEditingService(null);
      setSelectedImage(null);
      setNewService({ name: "", detail: "", price: "", unit: "lần", category: "Khác", imageUrl: "", active: true });
      toast({
        variant: wasEditing ? "default" : "checkin",
        title: wasEditing ? "Cập nhật dịch vụ thành công" : "Thêm dịch vụ thành công",
        description: wasEditing ? "Thông tin dịch vụ đã được cập nhật." : "Dịch vụ mới đã được thêm vào danh sách.",
      });
    } catch (error) {
      const message = getSaveErrorMessage(error);
      setSaveError(message);
      toast({ variant: "destructive", title: wasEditing ? "Cập nhật dịch vụ thất bại" : "Thêm dịch vụ thất bại", description: message });
    }
  };

  const importServicesFromFile = async (archiveFile: File) => {
    try {
      const validation = await validateServiceImportArchive(archiveFile, allServices.map((service) => service.name));
      setServiceImportRows(validation.rows);
      setServiceImportArchiveError("");
      if (validation.validCount === 0) {
        setServiceImportTaskId("");
        setServiceImportValidationOnly(true);
        return true;
      }
      if (!hotelName) throw new Error("Không xác định được tên chi nhánh từ tài khoản đang đăng nhập.");

      setServiceImportUploadProgress("Đang đọc ảnh dịch vụ trong file ZIP...");
      const parsed = await parseServiceImportArchive(archiveFile);
      const validRowNumbers = new Set(validation.rows.filter((row) => row.passed).map((row) => row.rowNumber));
      const validServices = parsed.rows.filter((row) => validRowNumbers.has(row.rowNumber));
      const filesByName = new Map<string, File>();
      validServices.forEach((service) => {
        const matches = parsed.images.get(service.imageFileName.toLocaleLowerCase()) ?? [];
        if (matches.length !== 1) {
          throw new Error(`Không thể xác định duy nhất ảnh "${service.imageFileName}" ở dòng ${service.rowNumber}.`);
        }
        filesByName.set(service.imageFileName.toLocaleLowerCase(), matches[0]);
      });

      const imageFiles = [...filesByName.values()];
      setServiceImportUploadProgress(`Đang tải ${imageFiles.length} ảnh dịch vụ lên Cloudinary...`);
      const imageUrls = await uploadServiceImagesToCloudinary(imageFiles, hotelName, (uploaded, total) => {
        setServiceImportUploadProgress(`Đang tải ảnh dịch vụ lên Cloudinary: ${uploaded}/${total}...`);
      });
      const request = {
        services: validServices.map((service) => {
          const imageUrl = imageUrls.get(service.imageFileName.toLocaleLowerCase());
          if (!imageUrl) throw new Error(`Không tìm thấy URL Cloudinary cho ảnh "${service.imageFileName}".`);
          return { ...service, imageUrl };
        }),
      };

      setServiceImportUploadProgress("Đã tải ảnh xong. Đang gửi dữ liệu dịch vụ lên máy chủ...");
      const taskId = await startServiceImport(request);
      setServiceImportTaskId(taskId);
      setServiceImportSocketStatus(undefined);
      setServiceImportValidationOnly(false);
      setServiceImportUploadProgress("");
      return true;
    } catch (error) {
      const message = getServiceImportErrorMessage(error);
      setServiceImportTaskId("");
      setServiceImportRows([]);
      setServiceImportArchiveError(message);
      setServiceImportValidationOnly(true);
      setServiceImportUploadProgress("");
      return true;
    }
  };

  const handleServiceImportFinished = useCallback((status: ServiceImportTaskStatus) => {
    setServiceImportUploadProgress("");
    dispatch(baseApi.util.invalidateTags(["Service"]));
    const failed = isServiceImportFailed(status);
    const addedCount = status.successCount
      ?? status.importedCount
      ?? status.totalCount
      ?? status.total
      ?? status.processedCount
      ?? status.processed;
    toast({
      variant: failed ? "destructive" : "checkin",
      title: failed ? "Nhập dịch vụ thất bại" : "Nhập dịch vụ thành công",
      description: failed
        ? status.message || "Tiến trình nhập dịch vụ đã thất bại."
        : serviceImportRows.some((row) => !row.passed)
          ? `Tiến trình máy chủ hoàn tất. Có ${serviceImportRows.filter((row) => row.passed).length} dòng đạt kiểm tra và ${serviceImportRows.filter((row) => !row.passed).length} dòng cần xem lại trong thông báo góc phải dưới.`
          : `Đã thêm tất cả${addedCount === undefined ? "" : ` ${addedCount}`} dịch vụ cho bạn thành công!`,
    });
  }, [dispatch, serviceImportRows]);

  return (
    <section className="mt-6 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <div className="flex items-center gap-2 text-blue-600"><ConciergeBell size={18} /><p className="text-xs font-bold uppercase tracking-wider">Dịch vụ lưu trú</p></div>
          <h3 className="mt-2 text-xl font-bold text-slate-900">Danh sách dịch vụ</h3>
          <p className="mt-1 text-sm text-slate-500">Quản lý thông tin và trạng thái dịch vụ của khách sạn.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setIsBulkImportOpen(true)}
            className="flex items-center gap-2 rounded-lg border border-blue-200 bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 shadow-sm transition hover:bg-blue-50"
          >
            <Upload size={16} />Tải dữ liệu bằng file
          </button>
          <button type="button" onClick={openCreateForm} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"><Plus size={16} />Thêm dịch vụ</button>
        </div>
      </div>
      {(serviceImportTaskId || serviceImportRows.length > 0 || serviceImportArchiveError) && (
        <ServiceImportProgressCard
          taskId={serviceImportTaskId}
          liveStatus={serviceImportSocketStatus}
          onDismiss={() => {
            setServiceImportTaskId("");
            setServiceImportRows([]);
            setServiceImportArchiveError("");
            setServiceImportValidationOnly(false);
            setServiceImportUploadProgress("");
            setServiceImportSocketStatus(undefined);
          }}
          onFinished={handleServiceImportFinished}
          validationRows={serviceImportRows}
          archiveError={serviceImportArchiveError}
          validationOnly={serviceImportValidationOnly}
        />
      )}
      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <label className="relative min-w-0 flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Tìm theo tên, mô tả hoặc danh mục dịch vụ..."
            aria-label="Tìm kiếm dịch vụ"
            className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
        </label>
        <label className="flex items-center">
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
            aria-label="Lọc dịch vụ theo trạng thái"
            className="h-10 min-w-44 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="active">Đang hoạt động</option>
            <option value="inactive">Tạm ngưng</option>
          </select>
        </label>
      </div>
      {isLoading && <p className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">Đang tải danh sách dịch vụ...</p>}
      {isError && <p className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-6 text-center text-sm text-rose-600">Không thể tải danh sách dịch vụ.</p>}
      {!isLoading && !isError && !hasHotelId && <p className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">Chưa xác định được chi nhánh hiện tại.</p>}
      {!isLoading && !isError && hasHotelId && allServices.length === 0 && <p className="mt-5 rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">Chi nhánh chưa có dịch vụ nào.</p>}
      {!isLoading && !isError && allServices.length > 0 && filteredServices.length === 0 && <p className="mt-5 rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">Không tìm thấy dịch vụ phù hợp với từ khóa hoặc trạng thái đã chọn.</p>}
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {paginatedServices.map((service) => {
          const isActive = statusOverrides[service.id] ?? service.active;
          return <article key={service.id} className="rounded-xl border border-blue-200 bg-blue-100/55 p-4 text-left transition hover:border-blue-400 hover:bg-blue-100/80 hover:shadow-sm">
            <div className="flex items-start justify-between gap-3"><span className="text-sm font-bold text-slate-900">{service.name}</span><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-500">{service.category}</span></div>
            <p className="mt-2 min-h-10 text-xs leading-5 text-slate-500">{service.detail}</p>
            <div className="mt-4"><span className="text-sm font-bold text-blue-700">{service.price.toLocaleString("vi-VN")}đ <span className="font-normal text-slate-400">/ {service.unit}</span></span></div>
            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3"><div className="flex items-center gap-3"><button type="button" onClick={() => setDetailService(service)} className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-blue-600"><Eye size={14} />Xem chi tiết</button><button type="button" onClick={() => openEditForm(service)} className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 hover:text-amber-800"><Pencil size={14} />Chỉnh sửa</button></div><button type="button" onClick={() => toggleServiceStatus(service.id)} className={`flex items-center gap-1.5 text-xs font-semibold ${isActive ? "text-emerald-600" : "text-slate-400"}`}><span className={`h-2 w-2 rounded-full ${isActive ? "bg-emerald-500" : "bg-slate-300"}`} />{isActive ? "Đang hoạt động" : "Tạm ngưng"}</button></div>
          </article>;
        })}
      </div>
      {filteredServices.length > 0 && (
        <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-4 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span>
            Hiển thị {(safePage - 1) * pageSize + 1}-{Math.min(safePage * pageSize, filteredServices.length)} trên {filteredServices.length} dịch vụ
          </span>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2">
              Số dòng
              <select
                value={pageSize}
                onChange={(event) => setPageSize(Number(event.target.value))}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700"
              >
                <option value={12}>12</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </label>
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={safePage === 1}
              className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Trang trước"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="min-w-16 text-center font-semibold text-slate-700">
              {safePage} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              disabled={safePage === totalPages}
              className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Trang sau"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
      {detailService && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm"
          onMouseDown={() => setDetailService(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="service-detail-title"
            className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl bg-white shadow-[0_25px_80px_rgba(15,23,42,0.3)]"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="relative">
              {detailService.imageUrl ? (
                <img
                  src={detailService.imageUrl}
                  alt={detailService.name}
                  className="h-56 w-full object-cover"
                />
              ) : (
                <div className="grid h-44 w-full place-items-center bg-gradient-to-br from-blue-50 via-slate-50 to-indigo-100 text-blue-300">
                  <ConciergeBell size={52} strokeWidth={1.25} />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/55 via-transparent to-transparent" />
              <button
                type="button"
                onClick={() => setDetailService(null)}
                aria-label="Đóng chi tiết dịch vụ"
                className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-white/90 text-slate-600 shadow-sm backdrop-blur transition hover:bg-white hover:text-slate-900"
              >
                <X size={18} />
              </button>
              <div className="absolute bottom-4 left-5 right-5">
                <span className="inline-flex rounded-full border border-white/30 bg-white/20 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
                  {detailService.category}
                </span>
                <h4 id="service-detail-title" className="mt-2 text-2xl font-bold text-white">
                  {detailService.name}
                </h4>
              </div>
            </div>

            <div className="p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-blue-50 px-4 py-3">
                <div>
                  <p className="text-xs font-medium text-slate-500">Đơn giá</p>
                  <p className="mt-1 text-xl font-bold text-blue-700">
                    {detailService.price.toLocaleString("vi-VN")}đ
                    <span className="ml-1 text-sm font-medium text-slate-500">/ {detailService.unit}</span>
                  </p>
                </div>
                <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${detailService.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                  <span className={`h-2 w-2 rounded-full ${detailService.active ? "bg-emerald-500" : "bg-slate-400"}`} />
                  {detailService.active ? "Đang hoạt động" : "Tạm ngưng"}
                </span>
              </div>

              <dl className="mt-5 space-y-4">
                <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3 text-sm">
                  <dt className="text-slate-500">Mã dịch vụ</dt>
                  <dd className="font-semibold text-slate-800">{detailService.id}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Mô tả dịch vụ</dt>
                  <dd className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                    {detailService.detail || "Chưa có mô tả cho dịch vụ này."}
                  </dd>
                </div>
              </dl>

              <div className="mt-6 flex justify-end border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setDetailService(null)}
                  className="rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <BulkImportDialog
        open={isBulkImportOpen}
        onOpenChange={setIsBulkImportOpen}
        eyebrow="Nhập hàng loạt"
        title="Tải dữ liệu dịch vụ"
        description="Ảnh được tải trực tiếp từ FE lên Cloudinary theo thư mục chi nhánh; BE chỉ nhận URL ảnh và lưu thông tin dịch vụ."
        templateLabel="Tải file Excel mẫu"
        onDownloadTemplate={downloadServiceTemplate}
        acceptedFileTypes=".zip,application/zip"
        fileLabel="File ZIP bộ dữ liệu (.zip)"
        validateFile={(file) =>
          file.name.toLocaleLowerCase() === "dichvu.zip"
            ? null
            : "Vui lòng chọn đúng file dichvu.zip."
        }
        instructions={
          <>
            <p className="font-bold">Cấu trúc file ZIP</p>
            <pre className="my-2 overflow-x-auto rounded-lg bg-amber-100/70 p-3 font-mono text-[11px] leading-5 text-amber-950">{`dichvu.zip
└── dich-vu/
    ├── mau-nhap-dich-vu.xlsx
    └── images/
        ├── massage.jpg
        └── buffet.png`}</pre>
            <p>Hãy đặt file Excel mẫu <strong>mau-nhap-dich-vu.xlsx</strong> và thư mục <strong>images</strong> cùng cấp trong một thư mục, rồi nén thư mục đó thành file <strong>dichvu.zip</strong>. ZIP có thể chứa thêm một thư mục bao bên ngoài.</p>
            <p className="mt-2">Trong Excel, cột “Tên file ảnh” phải khớp với tên ảnh trong thư mục <strong>images</strong>, gồm cả phần đuôi, ví dụ <strong>massage.jpg</strong>. Không đổi tên các cột: Tên dịch vụ, Mô tả, Giá, Đơn vị, Danh mục, Tên file ảnh.</p>
          </>
        }
        uploadLabel="Nhập dịch vụ"
        progress={serviceImportUploadProgress || undefined}
        onUpload={importServicesFromFile}
      />
      {showCreate && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/45 p-4" onMouseDown={() => setShowCreate(false)}>
          <form
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-[0_25px_80px_rgba(15,23,42,0.18)]"
            onSubmit={(event) => {
              event.preventDefault();
              void saveService();
            }}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-blue-600">Dịch vụ lưu trú</p>
                <h4 className="mt-2 text-[28px] font-bold leading-tight text-slate-900">{editingService ? "Chỉnh sửa dịch vụ" : "Thêm dịch vụ"}</h4>
              </div>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                aria-label="Đóng"
                className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={20} />
              </button>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
                Tên dịch vụ <span className="text-rose-500">*</span>
                <input
                  required
                  value={newService.name}
                  onChange={(event) => setNewService((current) => ({ ...current, name: event.target.value }))}
                  className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-normal text-slate-800 shadow-sm transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
                  placeholder="Nhập tên dịch vụ"
                />
              </label>

              <label className="text-sm font-semibold text-slate-700">
                Giá <span className="text-rose-500">*</span>
                <input
                  required
                  type="number"
                  min="0"
                  value={newService.price}
                  onChange={(event) => setNewService((current) => ({ ...current, price: event.target.value }))}
                  className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-normal text-slate-800 shadow-sm transition focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
                  placeholder="0"
                />
              </label>

              <label className="text-sm font-semibold text-slate-700">
                Đơn vị <span className="text-rose-500">*</span>
                <select
                  required
                  value={newService.unit}
                  onChange={(event) => setNewService((current) => ({ ...current, unit: event.target.value }))}
                  className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-normal text-slate-800 shadow-sm transition focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
                >
                  <option value="lần">lần</option>
                  <option value="người">người</option>
                  <option value="giờ">giờ</option>
                  <option value="ngày">ngày</option>
                </select>
              </label>

              <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
                Danh mục <span className="text-rose-500">*</span>
                <select
                  required
                  value={newService.category}
                  onChange={(event) => setNewService((current) => ({ ...current, category: event.target.value }))}
                  className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-normal text-slate-800 shadow-sm transition focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
                >
                  <option value="Khác">Khác</option>
                  <option value="Dịch vụ phòng">Dịch vụ phòng</option>
                  <option value="Thể thao">Thể thao</option>
                  <option value="Spa">Spa</option>
                  <option value="Nhà hàng">Nhà hàng</option>
                  <option value="Điện tử">Điện tử</option>
                </select>
              </label>

              <div className="text-sm font-semibold text-slate-700 sm:col-span-2">
                Hình ảnh {!editingService && <span className="text-rose-500">*</span>}

                <div className="mt-2 flex flex-col gap-3">
                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700 transition hover:border-blue-300 hover:bg-blue-100">
                    <ImagePlus size={16} />
                    Tải ảnh lên
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;
                        setSelectedImage(file);
                        setNewService((current) => ({
                          ...current,
                          imageUrl: URL.createObjectURL(file),
                        }));
                      }}
                    />
                  </label>

                  {newService.imageUrl && (
                    <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-2">
                      <img src={newService.imageUrl} alt="Preview dịch vụ" className="h-28 w-full rounded-lg object-cover" />
                    </div>
                  )}
                </div>
              </div>

              <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
                Mô tả
                <textarea
                  required
                  value={newService.detail}
                  onChange={(event) => setNewService((current) => ({ ...current, detail: event.target.value }))}
                  rows={3}
                  placeholder="Nhập mô tả dịch vụ"
                  className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-normal text-slate-800 shadow-sm transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </label>

              <div className="sm:col-span-2">
                <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300">
                  Đang hoạt động
                  <input
                    type="checkbox"
                    checked={newService.active}
                    onChange={(event) => setNewService((current) => ({ ...current, active: event.target.checked }))}
                    className="h-5 w-5 rounded border-slate-300 text-blue-600 shadow-sm focus:ring-blue-500"
                  />
                </label>
              </div>
            </div>

            {saveError && <p role="alert" className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{saveError}</p>}

            <div className="mt-7 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowCreate(false);
                  setEditingService(null);
                  setSelectedImage(null);
                }}
                disabled={isSaving}
                className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {editingService ? <Pencil size={16} /> : <Plus size={16} />}
                {isSaving ? "Đang lưu..." : editingService ? "Lưu thay đổi" : "Thêm dịch vụ"}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
   