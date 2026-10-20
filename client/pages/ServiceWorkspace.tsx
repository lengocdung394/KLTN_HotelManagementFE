import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Banknote, CalendarDays, CheckCircle2, Clock3, ConciergeBell, Eye, ImagePlus, Pencil, Plus, Upload, X, ChevronLeft, ChevronRight, Search } from "lucide-react";
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
import type { SuperAdminBranch } from "../services/superAdminApi";
import { useConfirmServiceUsedMutation, useGetBookingsByHotelQuery, type BookingListItem } from "../services/bookingApi";
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

type ServiceUsageRow = {
  bookingId: string;
  bookingDetailId: string;
  serviceDetailId: string;
  serviceName: string;
  quantity: number;
  customerName: string;
  roomNumber: string;
  bookingCreatedAt: string;
  checkInTime: string;
  usedAt: string | null;
  usedBy: string | null;
};

type BookingServiceUsageGroup = {
  bookingId: string;
  customerName: string;
  bookingCreatedAt: string;
  services: ServiceUsageRow[];
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" ? value as Record<string, unknown> : null;

const getServiceUsageRows = (bookings: BookingListItem[]): ServiceUsageRow[] => {
  return bookings.flatMap((bookingItem) => {
    const booking = asRecord(bookingItem);
    if (!booking || String(booking.bookingStatus ?? "").toUpperCase() === "CANCELLED") return [];
    const bookingId = String(booking.bookingId ?? booking.id ?? "");
    if (!bookingId) return [];
    const bookingDetails = Array.isArray(booking.bookingDetails) ? booking.bookingDetails : [];
    return bookingDetails.flatMap((detailValue) => {
      const detail = asRecord(detailValue);
      if (!detail || String(detail.bookingStatusType ?? detail.status ?? "").toUpperCase() === "CANCELLED") return [];
      const services = [
        detail.bookingServiceResponsForHotels,
        detail.bookingServiceResponseForHotel,
        detail.bookingServiceResponsesForHotels,
        detail.bookingServiceDetails,
        detail.services,
      ].find(Array.isArray);
      if (!Array.isArray(services)) return [];
      return services.flatMap((serviceValue) => {
        const service = asRecord(serviceValue);
        const serviceDetailId = service?.bookingServiceDetailId ?? service?.id;
        if (
          !service
          || !serviceDetailId
          || service.cancelled === true
          || Boolean(service.cancelledAt)
          || service.used === true
        ) return [];
        return [{
          bookingId,
          bookingDetailId: String(detail.bookingDetailId ?? detail.id ?? ""),
          serviceDetailId: String(serviceDetailId),
          serviceName: String(service.name ?? service.serviceName ?? "Dịch vụ"),
          quantity: Number(service.quantity ?? 1),
          customerName: String(booking.customerName ?? detail.customerName ?? detail.nameCustomer ?? "Khách lưu trú"),
          roomNumber: String(detail.roomNumber ?? detail.roomName ?? "—"),
          bookingCreatedAt: String(booking.createdAt ?? ""),
          checkInTime: String(detail.checkInTime ?? ""),
          usedAt: typeof service.usedAt === "string" ? service.usedAt : null,
          usedBy: typeof service.usedBy === "string" ? service.usedBy : null,
        }];
      });
    });
  });
};

const formatUsageDateTime = (value: string | null | undefined) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("vi-VN");
};

const toLocalDateInputValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getBookingDateValue = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : toLocalDateInputValue(date);
};

const getTodayServiceStats = (bookings: BookingListItem[]) => {
  const today = new Date().toDateString();
  let bookedToday = 0;
  let usedToday = 0;
  let estimatedRevenue = 0;

  bookings.forEach((bookingItem) => {
    const booking = asRecord(bookingItem);
    if (!booking || String(booking.bookingStatus ?? "").toUpperCase() === "CANCELLED") return;
    const isBookingToday = typeof booking.createdAt === "string"
      && !Number.isNaN(new Date(booking.createdAt).getTime())
      && new Date(booking.createdAt).toDateString() === today;
    const details = Array.isArray(booking.bookingDetails) ? booking.bookingDetails : [];

    details.forEach((detailValue) => {
      const detail = asRecord(detailValue);
      if (!detail || String(detail.bookingStatusType ?? detail.status ?? "").toUpperCase() === "CANCELLED") return;
      const serviceDetails = [
        detail.bookingServiceResponsForHotels,
        detail.bookingServiceResponseForHotel,
        detail.bookingServiceResponsesForHotels,
        detail.bookingServiceDetails,
        detail.services,
      ].find(Array.isArray);
      if (!Array.isArray(serviceDetails)) return;

      serviceDetails.forEach((serviceValue) => {
        const service = asRecord(serviceValue);
        if (!service || service.cancelled === true || Boolean(service.cancelledAt)) return;
        const quantity = Number(service.quantity ?? 1);
        const validQuantity = Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
        if (isBookingToday) bookedToday += validQuantity;

        if (service.used !== true || typeof service.usedAt !== "string") return;
        const usedAt = new Date(service.usedAt);
        if (Number.isNaN(usedAt.getTime()) || usedAt.toDateString() !== today) return;

        usedToday += validQuantity;
        const nestedService = asRecord(service.service);
        const price = Number(service.price ?? service.unitPrice ?? service.servicePrice ?? nestedService?.price ?? 0);
        if (Number.isFinite(price) && price > 0) estimatedRevenue += price * validQuantity;
      });
    });
  });

  return { bookedToday, usedToday, estimatedRevenue };
};

export default function ServiceWorkspace({ branches = [], mode = "catalog" }: { branches?: SuperAdminBranch[]; mode?: "usage" | "catalog" }) {
  const dispatch = useAppDispatch();
  const [detailService, setDetailService] = useState<HotelService | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editingService, setEditingService] = useState<HotelService | null>(null);
  const [targetHotelId, setTargetHotelId] = useState("");
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
  const [expandedUsageBookingIds, setExpandedUsageBookingIds] = useState<Set<string>>(() => new Set());
  const [activeUsageTab, setActiveUsageTab] = useState<"pending" | "used-today">("pending");
  const [usageDateFrom, setUsageDateFrom] = useState("");
  const [usageDateTo, setUsageDateTo] = useState("");
  const [usedDateFrom, setUsedDateFrom] = useState(() => toLocalDateInputValue(new Date()));
  const [usedDateTo, setUsedDateTo] = useState(() => toLocalDateInputValue(new Date()));

  const { hotelId, roles } = useAppSelector((state) => state.auth);
  const isSystemAdmin = roles.includes("ROLE_SUPER_ADMIN");
  const canManageServices = roles.includes("ROLE_MANAGER") || roles.includes("ROLE_SUPER_ADMIN");
  const hotelName = useAppSelector((state) => state.auth.hotelName);
  const hasHotelId = Boolean(hotelId) && !Number.isNaN(Number(hotelId));
  const canConfirmServiceUsage = !isSystemAdmin && hasHotelId && roles.some((role) =>
    ["ROLE_EMPLOYEE", "ROLE_MANAGER", "ROLE_ADMIN"].includes(role),
  );
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const {
    data: bookings = [],
    isLoading: isLoadingUsage,
    isError: isUsageError,
  } = useGetBookingsByHotelQuery(Number(hotelId), { skip: mode !== "usage" || !hasHotelId || isSystemAdmin });
  const [confirmServiceUsed, { isLoading: isConfirmingService }] = useConfirmServiceUsedMutation();
  const { data: services = [], isLoading, isError } = useGetAllServicesQuery(
    isSystemAdmin ? (selectedBranchId ? { hotelId: Number(selectedBranchId) } : undefined) : hasHotelId ? { hotelId: Number(hotelId) } : undefined,
    { skip: mode !== "catalog" || (!hasHotelId && !isSystemAdmin) },
  );
  const allServices = services;
  const todayServiceStats = useMemo(() => getTodayServiceStats(bookings), [bookings]);
  const pendingUsageRows = useMemo(() => getServiceUsageRows(bookings), [bookings]);
  const pendingUsageGroups = useMemo(() => {
    const groups = new Map<string, BookingServiceUsageGroup>();
    pendingUsageRows.forEach((row) => {
      const group = groups.get(row.bookingId);
      if (group) {
        group.services.push(row);
      } else {
        groups.set(row.bookingId, {
          bookingId: row.bookingId,
          customerName: row.customerName,
          bookingCreatedAt: row.bookingCreatedAt,
          services: [row],
        });
      }
    });
    return [...groups.values()];
  }, [pendingUsageRows]);
  const filteredPendingUsageGroups = useMemo(() => pendingUsageGroups.filter((group) => {
    if (!usageDateFrom && !usageDateTo) return true;
    const bookingDate = getBookingDateValue(group.bookingCreatedAt);
    if (!bookingDate) return false;
    return (!usageDateFrom || bookingDate >= usageDateFrom)
      && (!usageDateTo || bookingDate <= usageDateTo);
  }), [pendingUsageGroups, usageDateFrom, usageDateTo]);
  const usedServiceRows = useMemo(() => bookings.flatMap((bookingItem) => {
      const booking = asRecord(bookingItem);
      if (!booking || String(booking.bookingStatus ?? "").toUpperCase() === "CANCELLED") return [];
      const details = Array.isArray(booking.bookingDetails) ? booking.bookingDetails : [];
      return details.flatMap((detailValue) => {
        const detail = asRecord(detailValue);
        if (!detail || String(detail.bookingStatusType ?? detail.status ?? "").toUpperCase() === "CANCELLED") return [];
        const services = detail && [
          detail.bookingServiceResponsForHotels,
          detail.bookingServiceResponseForHotel,
          detail.bookingServiceResponsesForHotels,
          detail.bookingServiceDetails,
          detail.services,
        ].find(Array.isArray);
        if (!Array.isArray(services)) return [];
        return services.flatMap((serviceValue) => {
          const service = asRecord(serviceValue);
          if (!service || service.used !== true || typeof service.usedAt !== "string" || service.cancelled === true || Boolean(service.cancelledAt)) return [];
          if (Number.isNaN(new Date(service.usedAt).getTime())) return [];
          return [{
            bookingId: String(booking.bookingId ?? booking.id ?? ""),
            bookingDetailId: String(detail?.bookingDetailId ?? detail?.id ?? ""),
            serviceDetailId: String(service.bookingServiceDetailId ?? service.id ?? ""),
            serviceName: String(service.name ?? service.serviceName ?? "Dịch vụ"),
            quantity: Number(service.quantity ?? 1),
            customerName: String(booking.customerName ?? detail?.customerName ?? detail?.nameCustomer ?? "Khách lưu trú"),
            roomNumber: String(detail?.roomNumber ?? detail?.roomName ?? "—"),
            bookingCreatedAt: String(booking.createdAt ?? ""),
            checkInTime: String(detail?.checkInTime ?? ""),
            usedAt: service.usedAt,
            usedBy: typeof service.usedBy === "string" ? service.usedBy : null,
          } satisfies ServiceUsageRow];
        });
      });
    }), [bookings]);
  const filteredUsedServiceRows = useMemo(() => usedServiceRows.filter((row) => {
    const usedDate = getBookingDateValue(row.usedAt ?? "");
    if (!usedDate) return false;
    return (!usedDateFrom || usedDate >= usedDateFrom)
      && (!usedDateTo || usedDate <= usedDateTo);
  }), [usedServiceRows, usedDateFrom, usedDateTo]);
  const filteredServices = useMemo(() => {
    const normalizedQuery = searchQuery.trim().normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase();
    return allServices.filter((service) => {
      const isActive = service.active;
      const matchesStatus = statusFilter === "all" || (statusFilter === "active" ? isActive : !isActive);
      const searchableText = [service.name, service.detail, service.category, service.unit]
        .join(" ")
        .normalize("NFD")
        .replace(/\p{M}/gu, "")
        .toLocaleLowerCase();
      return matchesStatus && (!normalizedQuery || searchableText.includes(normalizedQuery));
    });
  }, [allServices, searchQuery, statusFilter]);
  const isSaving = isCreating || isUpdating;

  const handleConfirmServiceUsed = async (row: ServiceUsageRow) => {
    try {
      await confirmServiceUsed({ bookingId: row.bookingId, serviceDetailId: row.serviceDetailId }).unwrap();
      toast({
        variant: "checkin",
        title: "Đã xác nhận sử dụng dịch vụ",
        description: `${row.serviceName} · Phòng ${row.roomNumber}`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Không thể xác nhận dịch vụ",
        description: getSaveErrorMessage(error),
      });
    }
  };

  useEffect(() => {
    if (!hasHotelId && !isSystemAdmin) return;
    return bindHotelSocketEvents({
      onServiceChanged: () => {
        dispatch(baseApi.util.invalidateTags(["Service", "Notification"]));
      },
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
  }, [dispatch, hasHotelId, isSystemAdmin]);

  const totalPages = Math.max(1, Math.ceil(filteredServices.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedServices = filteredServices.slice((safePage - 1) * pageSize, safePage * pageSize);

  useEffect(() => {
    setPage(1);
  }, [allServices.length, pageSize, searchQuery, statusFilter]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const toggleServiceStatus = async (serviceId: string) => {
    const currentService = allServices.find((service) => service.id === serviceId);
    if (!currentService) return;
    if (!isSystemAdmin && currentService.hotelId == null) {
      toast({
        variant: "destructive",
        title: "Không thể chỉnh sửa dịch vụ hệ thống",
        description: "Dịch vụ toàn hệ thống chỉ do Super Admin quản lý.",
      });
      return;
    }
    const active = !currentService.active;
    try {
      await updateServiceRequest({
        id: currentService.id,
        service: {
          name: currentService.name,
          description: currentService.detail,
          price: currentService.price,
          unit: currentService.unit,
          category: currentService.category,
          active,
        },
      }).unwrap();
      setDetailService((current) => current?.id === currentService.id ? { ...current, active } : current);
      toast({
        variant: "checkin",
        title: active ? "Đã bật dịch vụ" : "Đã tạm ngưng dịch vụ",
        description: currentService.name,
      });
    } catch (error) {
      toast({ variant: "destructive", title: "Không thể cập nhật trạng thái dịch vụ", description: getSaveErrorMessage(error) });
    }
  };

  const openCreateForm = () => {
    setEditingService(null);
    setTargetHotelId("");
    setSelectedImage(null);
    setSaveError("");
    setNewService({ name: "", detail: "", price: "", unit: "lần", category: "Khác", imageUrl: "", active: true });
    setShowCreate(true);
  };

  const openEditForm = (service: HotelService) => {
    if (!isSystemAdmin && service.hotelId == null) {
      toast({
        variant: "destructive",
        title: "Không thể chỉnh sửa dịch vụ hệ thống",
        description: "Dịch vụ toàn hệ thống chỉ do Super Admin quản lý.",
      });
      return;
    }
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
        await createServiceRequest({
          service,
          imageFile: selectedImage,
          ...(isSystemAdmin && targetHotelId ? { hotelId: Number(targetHotelId) } : {}),
        }).unwrap();
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
      if (!hotelName) throw new Error("Không xác định được tên chi nhánh để nhập dịch vụ hàng loạt.");

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
    <>
      {mode === "usage" && (
        <div className="mt-2 mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-slate-500"><CalendarDays size={16} /><p className="text-xs font-semibold">Dịch vụ đặt hôm nay</p></div>
            <p className="mt-2 text-2xl font-bold text-slate-900">{isLoadingUsage || isUsageError ? "—" : todayServiceStats.bookedToday}</p>
            <p className="mt-1 text-xs text-slate-500">Lượt dịch vụ trong booking tạo hôm nay</p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-emerald-600"><CheckCircle2 size={16} /><p className="text-xs font-semibold">Dịch vụ đã dùng hôm nay</p></div>
            <p className="mt-2 text-2xl font-bold text-slate-900">{isLoadingUsage || isUsageError ? "—" : todayServiceStats.usedToday}</p>
            <p className="mt-1 text-xs text-slate-500">Lượt đã được nhân viên xác nhận</p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-blue-600"><Banknote size={16} /><p className="text-xs font-semibold">Tiền dịch vụ ước tính hôm nay</p></div>
            <p className="mt-2 text-2xl font-bold text-slate-900">{isLoadingUsage || isUsageError ? "—" : `${todayServiceStats.estimatedRevenue.toLocaleString("vi-VN")}đ`}</p>
            <p className="mt-1 text-xs text-slate-500">Tính theo dịch vụ đã xác nhận sử dụng</p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-amber-600"><ConciergeBell size={16} /><p className="text-xs font-semibold">Dịch vụ chờ xác nhận</p></div>
            <p className="mt-2 text-2xl font-bold text-slate-900">{isLoadingUsage || isUsageError ? "—" : pendingUsageRows.reduce((total, row) => total + row.quantity, 0)}</p>
            <p className="mt-1 text-xs text-slate-500">Lượt dịch vụ đang chờ nhân viên xử lý</p>
          </article>
        </div>
      )}
    <section className={`${mode === "usage" ? "" : "mt-2"} rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm`}>
      {mode === "catalog" && <div className="flex justify-end gap-3">
        <div className="flex flex-wrap gap-2">
          {canManageServices && !isSystemAdmin && <button
            type="button"
            onClick={() => setIsBulkImportOpen(true)}
            className="flex items-center gap-2 rounded-lg border border-blue-200 bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 shadow-sm transition hover:bg-blue-50"
          >
            <Upload size={16} />Tải dữ liệu bằng file
          </button>}
          {canManageServices && <button type="button" onClick={openCreateForm} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"><Plus size={16} />Thêm dịch vụ</button>}
        </div>
      </div>}
      {mode === "usage" && canConfirmServiceUsage && (
        <section aria-label="Thao tác dịch vụ khách hàng" className="mt-6 rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between">
            <div role="tablist" aria-label="Danh sách thao tác dịch vụ" className="flex w-fit flex-wrap gap-5 border-b border-slate-200 lg:shrink-0">
              <button
                type="button"
                role="tab"
                id="service-usage-pending-tab"
                aria-selected={activeUsageTab === "pending"}
                aria-controls="service-usage-pending-panel"
                onClick={() => setActiveUsageTab("pending")}
                className={`flex items-center gap-2 border-b-2 px-2 py-3 text-sm font-semibold transition ${activeUsageTab === "pending" ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}
              >
                <ConciergeBell size={15} />
                Booking có dịch vụ chờ
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">{pendingUsageGroups.length}</span>
              </button>
              <button
                type="button"
                role="tab"
                id="service-usage-used-tab"
                aria-selected={activeUsageTab === "used-today"}
                aria-controls="service-usage-used-panel"
                onClick={() => setActiveUsageTab("used-today")}
                className={`flex items-center gap-2 border-b-2 px-2 py-3 text-sm font-semibold transition ${activeUsageTab === "used-today" ? "border-emerald-600 text-emerald-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}
              >
                <CheckCircle2 size={15} />
                Đã thao tác
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">{filteredUsedServiceRows.length}</span>
              </button>
            </div>
            <div className="flex flex-wrap items-end gap-3 lg:justify-end">
                <label className="block text-xs font-semibold text-slate-500">
                  {activeUsageTab === "pending" ? "Đặt từ ngày" : "Đã dùng từ ngày"}
                  <input
                    type="date"
                    value={activeUsageTab === "pending" ? usageDateFrom : usedDateFrom}
                    max={(activeUsageTab === "pending" ? usageDateTo : usedDateTo) || undefined}
                    onChange={(event) => activeUsageTab === "pending" ? setUsageDateFrom(event.target.value) : setUsedDateFrom(event.target.value)}
                    className="mt-1 h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal text-slate-700 outline-none transition hover:border-blue-300 focus:border-blue-400"
                  />
                </label>
                <label className="block text-xs font-semibold text-slate-500">
                  {activeUsageTab === "pending" ? "Đặt đến ngày" : "Đã dùng đến ngày"}
                  <input
                    type="date"
                    value={activeUsageTab === "pending" ? usageDateTo : usedDateTo}
                    min={(activeUsageTab === "pending" ? usageDateFrom : usedDateFrom) || undefined}
                    onChange={(event) => activeUsageTab === "pending" ? setUsageDateTo(event.target.value) : setUsedDateTo(event.target.value)}
                    className="mt-1 h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal text-slate-700 outline-none transition hover:border-blue-300 focus:border-blue-400"
                  />
                </label>
                {(activeUsageTab === "pending" ? usageDateFrom || usageDateTo : usedDateFrom || usedDateTo) && (
                  <button
                    type="button"
                    onClick={() => {
                      if (activeUsageTab === "pending") {
                        setUsageDateFrom("");
                        setUsageDateTo("");
                      } else {
                        setUsedDateFrom("");
                        setUsedDateTo("");
                      }
                    }}
                    className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:bg-blue-50 hover:text-blue-600"
                  >
                    Xóa lọc
                  </button>
                )}
              </div>
          </div>
          {activeUsageTab === "pending" && (
            <div id="service-usage-pending-panel" role="tabpanel" aria-labelledby="service-usage-pending-tab">
              <div className="p-4">
              {isLoadingUsage && <p className="rounded-lg bg-white p-4 text-center text-sm text-slate-500">Đang tải dịch vụ trong các booking...</p>}
              {isUsageError && <p role="alert" className="rounded-lg border border-rose-200 bg-white p-4 text-sm text-rose-700">Không thể tải danh sách dịch vụ cần xác nhận. Vui lòng tải lại trang.</p>}
              {!isLoadingUsage && !isUsageError && pendingUsageRows.length === 0 && (
                <p className="rounded-lg bg-white p-4 text-center text-sm text-slate-500">Hiện không có dịch vụ nào đang chờ xác nhận.</p>
              )}
              {!isLoadingUsage && !isUsageError && pendingUsageRows.length > 0 && filteredPendingUsageGroups.length === 0 && (
                <p className="rounded-lg bg-white p-4 text-center text-sm text-slate-500">Không có booking nào có dịch vụ chờ trong khoảng ngày đã chọn.</p>
              )}
              {!isLoadingUsage && !isUsageError && filteredPendingUsageGroups.length > 0 && (
                <div className="grid gap-3 lg:grid-cols-2">
                  {filteredPendingUsageGroups.map((group) => (
                    <article key={group.bookingId} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                      <header className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/60 px-3 py-2.5">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900">Booking {group.bookingId}</p>
                            <p className="mt-0.5 text-xs text-slate-600">{group.customerName}</p>
                          </div>
                          <span className="rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-blue-700">{group.services.length} dịch vụ chờ</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setExpandedUsageBookingIds((current) => {
                            const next = new Set(current);
                            if (next.has(group.bookingId)) next.delete(group.bookingId);
                            else next.add(group.bookingId);
                            return next;
                          })}
                          aria-expanded={expandedUsageBookingIds.has(group.bookingId)}
                          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
                        >
                          {expandedUsageBookingIds.has(group.bookingId) ? "Thu gọn" : "Thao tác"}
                        </button>
                      </header>
                      {expandedUsageBookingIds.has(group.bookingId) && <div className="px-3">
                        <p className="inline-flex items-center gap-1 border-b border-slate-100 py-2 text-[11px] text-slate-500"><Clock3 size={12} />Đặt: {formatUsageDateTime(group.bookingCreatedAt)}</p>
                        <div className="divide-y divide-slate-100">
                          {group.services.map((row) => (
                            <div key={`${row.bookingDetailId}-${row.serviceDetailId}`} className="flex flex-wrap items-center justify-between gap-3 py-3">
                              <div className="min-w-0">
                                <p className="font-semibold text-slate-900">{row.serviceName} <span className="font-normal text-slate-500">× {row.quantity}</span></p>
                                <p className="mt-1 text-xs text-slate-600">Phòng {row.roomNumber}</p>
                                {row.checkInTime && <p className="mt-1 text-[11px] text-slate-500">Nhận phòng: {formatUsageDateTime(row.checkInTime)}</p>}
                              </div>
                              <button
                                type="button"
                                onClick={() => void handleConfirmServiceUsed(row)}
                                disabled={isConfirmingService}
                                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60"
                              >
                                <CheckCircle2 size={14} />Xác nhận đã dùng
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>}
                    </article>
                  ))}
                </div>
              )}
              </div>
            </div>
          )}
          {activeUsageTab === "used-today" && (
            <div id="service-usage-used-panel" role="tabpanel" aria-labelledby="service-usage-used-tab" className="p-4">
              {isLoadingUsage && <p className="rounded-lg bg-white p-4 text-center text-sm text-slate-500">Đang tải lịch sử thao tác dịch vụ...</p>}
              {isUsageError && <p role="alert" className="rounded-lg border border-rose-200 bg-white p-4 text-sm text-rose-700">Không thể tải lịch sử thao tác dịch vụ. Vui lòng tải lại trang.</p>}
              {!isLoadingUsage && !isUsageError && filteredUsedServiceRows.length === 0 && (
                <p className="rounded-lg bg-white p-4 text-center text-sm text-slate-500">Không có dịch vụ nào được xác nhận sử dụng trong khoảng ngày đã chọn.</p>
              )}
              {!isLoadingUsage && !isUsageError && filteredUsedServiceRows.length > 0 && (
                <div className="grid gap-2 lg:grid-cols-2">
                  {filteredUsedServiceRows.map((row) => (
                    <p key={`${row.bookingId}-${row.serviceDetailId}`} className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-xs text-slate-600 shadow-sm">
                      <span className="font-semibold text-slate-800">{row.serviceName} × {row.quantity}</span> · {row.customerName} · Phòng {row.roomNumber}
                      <span className="block mt-1 text-[11px] text-slate-500">{formatUsageDateTime(row.usedAt)}{row.usedBy ? ` · Xác nhận bởi ${row.usedBy}` : ""}</span>
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      )}
      {mode === "catalog" && <>
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
        {isSystemAdmin && (
          <label className="flex items-center gap-2 text-sm font-medium text-slate-600">
            <span>Chi nhánh</span>
            <select
              value={selectedBranchId}
              onChange={(event) => setSelectedBranchId(event.target.value)}
              aria-label="Lọc dịch vụ theo chi nhánh"
              className="h-10 min-w-48 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            >
              <option value="">Tất cả chi nhánh</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>{branch.name}</option>
              ))}
            </select>
          </label>
        )}
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
      {!isLoading && !isError && !hasHotelId && !isSystemAdmin && <p className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">Chưa xác định được chi nhánh hiện tại.</p>}
      {!isLoading && !isError && (hasHotelId || isSystemAdmin) && allServices.length === 0 && <p className="mt-5 rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">Chưa có dịch vụ nào.</p>}
      {!isLoading && !isError && allServices.length > 0 && filteredServices.length === 0 && <p className="mt-5 rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">Không tìm thấy dịch vụ phù hợp với từ khóa hoặc trạng thái đã chọn.</p>}
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {paginatedServices.map((service) => {
          const isActive = service.active;
          return <article key={service.id} className="rounded-xl border border-blue-200 bg-blue-100/55 p-4 text-left transition hover:border-blue-400 hover:bg-blue-100/80 hover:shadow-sm">
            <div className="flex items-start justify-between gap-3"><span className="text-sm font-bold text-slate-900">{service.name}</span><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-500">{service.category}</span></div>
            <p className="mt-2 min-h-10 text-xs leading-5 text-slate-500">{service.detail}</p>
            <div className="mt-4"><span className="text-sm font-bold text-blue-700">{service.price.toLocaleString("vi-VN")}đ <span className="font-normal text-slate-400">/ {service.unit}</span></span></div>
            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3"><div className="flex items-center gap-3"><button type="button" onClick={() => setDetailService(service)} className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-blue-600"><Eye size={14} />Xem chi tiết</button>{canManageServices && <button type="button" onClick={() => openEditForm(service)} className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 hover:text-amber-800"><Pencil size={14} />Chỉnh sửa</button>}</div>{canManageServices ? <button type="button" onClick={() => void toggleServiceStatus(service.id)} disabled={isUpdating} className={`flex items-center gap-1.5 text-xs font-semibold disabled:cursor-wait disabled:opacity-60 ${isActive ? "text-emerald-600" : "text-slate-400"}`}><span className={`h-2 w-2 rounded-full ${isActive ? "bg-emerald-500" : "bg-slate-300"}`} />{isActive ? "Đang hoạt động" : "Tạm ngưng"}</button> : <span className={`flex items-center gap-1.5 text-xs font-semibold ${isActive ? "text-emerald-600" : "text-slate-400"}`}><span className={`h-2 w-2 rounded-full ${isActive ? "bg-emerald-500" : "bg-slate-300"}`} />{isActive ? "Đang hoạt động" : "Tạm ngưng"}</span>}</div>
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
      {showCreate && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-900/45 p-4" onMouseDown={() => setShowCreate(false)}>
          <form
            className="my-auto max-h-[calc(100dvh-2rem)] w-full max-w-2xl shrink-0 overflow-y-auto rounded-2xl bg-white p-6 shadow-[0_25px_80px_rgba(15,23,42,0.18)]"
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
              {isSystemAdmin && !editingService && (
                <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
                  Phạm vi dịch vụ
                  <select
                    value={targetHotelId}
                    onChange={(event) => setTargetHotelId(event.target.value)}
                    className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-normal text-slate-800"
                  >
                    <option value="">Toàn hệ thống</option>
                    {branches.map((branch) => (
                      <option key={branch.id} value={String(branch.id)}>{branch.name}</option>
                    ))}
                  </select>
                  <span className="mt-1 block text-xs font-normal text-slate-500">
                    {targetHotelId ? "Dịch vụ chỉ áp dụng cho chi nhánh đã chọn." : "Dịch vụ sẽ áp dụng cho toàn bộ chi nhánh."}
                  </span>
                </label>
              )}
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
        </div>,
        document.body,
      )}
      </>}
    </section>
    </>
  );
}
   