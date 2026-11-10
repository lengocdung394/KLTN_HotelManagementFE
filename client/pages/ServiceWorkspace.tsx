import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { createPortal } from "react-dom";
import { Banknote, CalendarDays, CheckCircle2, Clock3, Columns3, ConciergeBell, Eye, ImagePlus, Pencil, Plus, RefreshCw, RotateCcw, Upload, X, Search } from "lucide-react";
import ListPagination from "../components/ListPagination";
import DatePickerPopover from "../components/DatePickerPopover";
import { localizedText } from "../i18n";
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
import ClearSearchButton from "../components/ClearSearchButton";
import FilterSelect from "../components/FilterSelect";
import FilterResultStatus from "../components/FilterResultStatus";
import { FilterResetButton } from "../components/SearchableFilter";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";

const SERVICE_TABLE_COLUMNS = [
  { id: "name", labelKey: "serviceWorkspace.serviceName", width: 240 },
  { id: "category", labelKey: "serviceWorkspace.category", width: 190 },
  { id: "description", labelKey: "serviceWorkspace.serviceDescription", width: 420 },
  { id: "price", labelKey: "serviceWorkspace.price", width: 220 },
  { id: "status", labelKey: "serviceWorkspace.status", width: 190 },
  { id: "actions", labelKey: "serviceWorkspace.actions", width: 260 },
] as const;
type ServiceTableColumnId = (typeof SERVICE_TABLE_COLUMNS)[number]["id"];

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
  price: number | null;
  quantity: number;
  usedQuantity: number;
  customerName: string;
  roomNumber: string;
  bookingCreatedAt: string;
  actualCheckInTime: string;
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

type ServiceFormField = "name" | "detail" | "price" | "unit" | "category" | "image";
type ServiceFormErrors = Partial<Record<ServiceFormField, string>>;

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" ? value as Record<string, unknown> : null;

const getServiceUsedQuantity = (service: Record<string, unknown>) => {
  const totalQuantity = Number(service.quantity ?? 1);
  const rawUsedQuantity = service.usedQuantity ?? service.quantityUsed;
  if (rawUsedQuantity !== undefined && rawUsedQuantity !== null && rawUsedQuantity !== "") {
    const usedQuantity = Number(rawUsedQuantity);
    if (Number.isFinite(usedQuantity) && usedQuantity > 0) {
      return Math.min(usedQuantity, Math.max(totalQuantity, 0));
    }
  }
  return service.used === true || typeof service.usedAt === "string" ? Math.max(totalQuantity, 0) : 0;
};

const getServicePrice = (service: Record<string, unknown>) => {
  const nestedService = asRecord(service.service);
  const value = Number(service.price ?? service.unitPrice ?? service.servicePrice ?? nestedService?.price);
  return Number.isFinite(value) && value >= 0 ? value : null;
};

const getServiceUsageRows = (bookings: BookingListItem[]): ServiceUsageRow[] => {
  return bookings.flatMap((bookingItem) => {
    const booking = asRecord(bookingItem);
    if (!booking || String(booking.bookingStatus ?? "").toUpperCase().startsWith("CANCELLED")) return [];
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
        const totalQuantity = Number(service?.quantity ?? 1);
        const usedQuantity = service ? getServiceUsedQuantity(service) : 0;
        const remainingQuantity = totalQuantity - usedQuantity;
        if (
          !service
          || !serviceDetailId
          || service.cancelled === true
          || Boolean(service.cancelledAt)
          || remainingQuantity <= 0
        ) return [];
        return [{
          bookingId,
          bookingDetailId: String(detail.bookingDetailId ?? detail.id ?? ""),
          serviceDetailId: String(serviceDetailId),
          serviceName: String(service.name ?? service.serviceName ?? "Dịch vụ"),
          price: getServicePrice(service),
          quantity: remainingQuantity,
          usedQuantity,
          customerName: String(booking.customerName ?? detail.customerName ?? detail.nameCustomer ?? "Khách lưu trú"),
          roomNumber: String(detail.roomNumber ?? detail.roomName ?? "—"),
          bookingCreatedAt: String(booking.createdAt ?? ""),
          actualCheckInTime: String(detail.actualCheckInTime ?? ""),
          checkInTime: String(detail.checkInTime ?? ""),
          usedAt: typeof service.usedAt === "string" ? service.usedAt : null,
          usedBy: typeof service.usedBy === "string" ? service.usedBy : null,
        }];
      });
    });
  });
};

const formatUsageDateTime = (value: string | null | undefined, locale: string) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(locale);
};

const formatServicePrice = (price: number | null, locale: string) => {
  if (price === null) return "—";
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(price)}${locale.startsWith("en") ? " VND" : "đ"}`;
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

const parseLocalDateValue = (value: string) => {
  if (!value) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
};

const normalizeUsageSearch = (value: string) =>
  value.trim().normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase();

const getTodayServiceStats = (bookings: BookingListItem[]) => {
  const today = new Date().toDateString();
  let bookedToday = 0;
  let usedToday = 0;
  let estimatedRevenue = 0;

  bookings.forEach((bookingItem) => {
    const booking = asRecord(bookingItem);
    if (!booking || String(booking.bookingStatus ?? "").toUpperCase().startsWith("CANCELLED")) return;
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

        const usedQuantity = getServiceUsedQuantity(service);
        if (usedQuantity <= 0 || typeof service.usedAt !== "string") return;
        const usedAt = new Date(service.usedAt);
        if (Number.isNaN(usedAt.getTime()) || usedAt.toDateString() !== today) return;

        usedToday += usedQuantity;
        const nestedService = asRecord(service.service);
        const price = Number(service.price ?? service.unitPrice ?? service.servicePrice ?? nestedService?.price ?? 0);
        if (Number.isFinite(price) && price > 0) estimatedRevenue += price * usedQuantity;
      });
    });
  });

  return { bookedToday, usedToday, estimatedRevenue };
};

export default function ServiceWorkspace({ branches = [], mode = "catalog" }: { branches?: SuperAdminBranch[]; mode?: "usage" | "catalog" }) {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const [detailService, setDetailService] = useState<HotelService | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editingService, setEditingService] = useState<HotelService | null>(null);
  const [targetHotelId, setTargetHotelId] = useState("");
  const [newService, setNewService] = useState({ name: "", detail: "", price: "", unit: "lần", category: "Khác", imageUrl: "", active: true });
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [saveError, setSaveError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<ServiceFormErrors>({});
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
  const [pageSize, setPageSize] = useState(10);
  const [isManuallyRefreshingServices, setIsManuallyRefreshingServices] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [visibleServiceColumns, setVisibleServiceColumns] = useState<Record<ServiceTableColumnId, boolean>>({
    name: true,
    category: true,
    description: true,
    price: true,
    status: true,
    actions: true,
  });
  const [expandedUsageBookingIds, setExpandedUsageBookingIds] = useState<Set<string>>(() => new Set());
  const [usageQuantities, setUsageQuantities] = useState<Record<string, string>>({});
  const [activeUsageTab, setActiveUsageTab] = useState<"pending" | "used-today">("pending");
  const [usageDateFrom, setUsageDateFrom] = useState(() => toLocalDateInputValue(new Date()));
  const [usageDateTo, setUsageDateTo] = useState(() => toLocalDateInputValue(new Date()));
  const [usedDateFrom, setUsedDateFrom] = useState(() => toLocalDateInputValue(new Date()));
  const [usedDateTo, setUsedDateTo] = useState(() => toLocalDateInputValue(new Date()));
  const [usageSearchQuery, setUsageSearchQuery] = useState("");

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
  const { data: services = [], isLoading, isFetching, isError, refetch } = useGetAllServicesQuery(
    isSystemAdmin ? (selectedBranchId ? { hotelId: Number(selectedBranchId) } : undefined) : hasHotelId ? { hotelId: Number(hotelId) } : undefined,
    { skip: mode !== "catalog" || (!hasHotelId && !isSystemAdmin) },
  );
  const allServices = services;
  const serviceCatalogStats = useMemo(() => {
    const activeCount = allServices.filter((service) => service.active).length;
    const categories = new Set(
      allServices
        .map((service) => service.category.trim().toLocaleLowerCase(i18n.language))
        .filter(Boolean),
    );
    return {
      total: allServices.length,
      active: activeCount,
      inactive: allServices.length - activeCount,
      categories: categories.size,
    };
  }, [allServices, i18n.language]);
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
    return [...groups.values()].sort((left, right) => {
      const leftCreatedAt = new Date(left.bookingCreatedAt).getTime();
      const rightCreatedAt = new Date(right.bookingCreatedAt).getTime();
      const leftTimestamp = Number.isFinite(leftCreatedAt) ? leftCreatedAt : Number.NEGATIVE_INFINITY;
      const rightTimestamp = Number.isFinite(rightCreatedAt) ? rightCreatedAt : Number.NEGATIVE_INFINITY;
      return rightTimestamp - leftTimestamp;
    });
  }, [pendingUsageRows]);
  const filteredPendingUsageGroups = useMemo(() => {
    const normalizedQuery = normalizeUsageSearch(usageSearchQuery);
    return pendingUsageGroups.filter((group) => {
      const bookingDate = getBookingDateValue(group.bookingCreatedAt);
      const matchesDate = (!usageDateFrom && !usageDateTo)
        || (Boolean(bookingDate)
          && (!usageDateFrom || bookingDate >= usageDateFrom)
          && (!usageDateTo || bookingDate <= usageDateTo));
      const searchableText = [
        group.bookingId,
        group.customerName,
        ...group.services.flatMap((service) => [service.serviceName, service.roomNumber]),
      ].join(" ");
      const matchesSearch = !normalizedQuery || normalizeUsageSearch(searchableText).includes(normalizedQuery);
      return matchesDate && matchesSearch;
    });
  }, [pendingUsageGroups, usageDateFrom, usageDateTo, usageSearchQuery]);
  const usedServiceRows = useMemo(() => bookings.flatMap((bookingItem) => {
      const booking = asRecord(bookingItem);
      if (!booking || String(booking.bookingStatus ?? "").toUpperCase().startsWith("CANCELLED")) return [];
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
          const usedQuantity = service ? getServiceUsedQuantity(service) : 0;
          if (!service || usedQuantity <= 0 || typeof service.usedAt !== "string" || service.cancelled === true || Boolean(service.cancelledAt)) return [];
          if (Number.isNaN(new Date(service.usedAt).getTime())) return [];
          return [{
            bookingId: String(booking.bookingId ?? booking.id ?? ""),
            bookingDetailId: String(detail?.bookingDetailId ?? detail?.id ?? ""),
            serviceDetailId: String(service.bookingServiceDetailId ?? service.id ?? ""),
            serviceName: String(service.name ?? service.serviceName ?? "Dịch vụ"),
            price: getServicePrice(service),
            quantity: usedQuantity,
            usedQuantity,
            customerName: String(booking.customerName ?? detail?.customerName ?? detail?.nameCustomer ?? "Khách lưu trú"),
            roomNumber: String(detail?.roomNumber ?? detail?.roomName ?? "—"),
            bookingCreatedAt: String(booking.createdAt ?? ""),
            actualCheckInTime: String(detail?.actualCheckInTime ?? ""),
            checkInTime: String(detail?.checkInTime ?? ""),
            usedAt: service.usedAt,
            usedBy: typeof service.usedBy === "string" ? service.usedBy : null,
          } satisfies ServiceUsageRow];
        });
      });
    }), [bookings]);
  const filteredUsedServiceRows = useMemo(() => {
    const normalizedQuery = normalizeUsageSearch(usageSearchQuery);
    return usedServiceRows.filter((row) => {
      const usedDate = getBookingDateValue(row.usedAt ?? "");
      const matchesDate = Boolean(usedDate)
        && (!usedDateFrom || usedDate >= usedDateFrom)
        && (!usedDateTo || usedDate <= usedDateTo);
      const searchableText = [row.bookingId, row.customerName, row.serviceName, row.roomNumber, row.usedBy ?? ""].join(" ");
      const matchesSearch = !normalizedQuery || normalizeUsageSearch(searchableText).includes(normalizedQuery);
      return matchesDate && matchesSearch;
    });
  }, [usedServiceRows, usedDateFrom, usedDateTo, usageSearchQuery]);
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
  const shownServiceColumns = SERVICE_TABLE_COLUMNS.filter((column) => visibleServiceColumns[column.id]);
  const serviceTableWidth = shownServiceColumns.reduce((total, column) => total + column.width, 0);
  const hasServiceFilters = Boolean(searchQuery.trim() || selectedBranchId || statusFilter !== "all");
  const isServiceListLoading = isLoading || isFetching || isManuallyRefreshingServices;
  const isSaving = isCreating || isUpdating;

  const handleConfirmServiceUsed = async (row: ServiceUsageRow, quantity: number) => {
    try {
      await confirmServiceUsed({ bookingId: row.bookingId, serviceDetailId: row.serviceDetailId, quantity }).unwrap();
      toast({
        variant: "checkin",
        title: "Đã xác nhận sử dụng dịch vụ",
        description: `${row.serviceName} × ${quantity} · Phòng ${row.roomNumber}`,
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
    setFieldErrors({});
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
    setFieldErrors({});
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
    const errors: ServiceFormErrors = {};
    if (!name) errors.name = t("serviceWorkspace.nameRequired");
    if (!detail) errors.detail = t("serviceWorkspace.descriptionRequired");
    if (!newService.category.trim()) errors.category = t("serviceWorkspace.categoryRequired");
    if (!newService.unit.trim()) errors.unit = t("serviceWorkspace.unitRequired");
    if (!newService.price.trim() || !Number.isFinite(price)) errors.price = t("serviceWorkspace.priceRequired");
    else if (price < 0) errors.price = t("serviceWorkspace.priceInvalid");
    if (!editingService && !selectedImage) errors.image = t("serviceWorkspace.imageRequired");
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
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
      setFieldErrors({});
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
            <div className="flex items-center gap-2 text-slate-500"><CalendarDays size={16} /><p className="text-xs font-semibold">{t("serviceWorkspace.bookedToday")}</p></div>
            <p className="mt-2 text-2xl font-bold text-slate-900">{isLoadingUsage || isUsageError ? "—" : todayServiceStats.bookedToday}</p>
            <p className="mt-1 text-xs text-slate-500">{t("serviceWorkspace.bookedTodayHelp")}</p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-emerald-600"><CheckCircle2 size={16} /><p className="text-xs font-semibold">{t("serviceWorkspace.usedToday")}</p></div>
            <p className="mt-2 text-2xl font-bold text-slate-900">{isLoadingUsage || isUsageError ? "—" : todayServiceStats.usedToday}</p>
            <p className="mt-1 text-xs text-slate-500">{t("serviceWorkspace.usedTodayHelp")}</p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-blue-600"><Banknote size={16} /><p className="text-xs font-semibold">{t("serviceWorkspace.estimatedRevenueToday")}</p></div>
            <p className="mt-2 text-2xl font-bold text-slate-900">{isLoadingUsage || isUsageError ? "—" : `${todayServiceStats.estimatedRevenue.toLocaleString("vi-VN")}đ`}</p>
            <p className="mt-1 text-xs text-slate-500">{t("serviceWorkspace.revenueHelp")}</p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-amber-600"><ConciergeBell size={16} /><p className="text-xs font-semibold">{t("serviceWorkspace.pendingConfirmation")}</p></div>
            <p className="mt-2 text-2xl font-bold text-slate-900">{isLoadingUsage || isUsageError ? "—" : pendingUsageRows.reduce((total, row) => total + row.quantity, 0)}</p>
            <p className="mt-1 text-xs text-slate-500">{t("serviceWorkspace.pendingHelp")}</p>
          </article>
        </div>
      )}
      {mode === "catalog" && isSystemAdmin && (
        <section className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Thống kê danh mục dịch vụ">
          {([
            { label: "Tổng dịch vụ", value: serviceCatalogStats.total },
            { label: "Đang hoạt động", value: serviceCatalogStats.active },
            { label: "Tạm ngưng", value: serviceCatalogStats.inactive },
            { label: "Danh mục", value: serviceCatalogStats.categories },
          ]).map((stat) => (
            <article key={stat.label} className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm">
              <h3 className="border-b border-blue-100 bg-blue-50 px-5 py-3.5 text-xs font-semibold text-blue-800">{stat.label}</h3>
              <div className="px-5 py-4">
                <p className="text-xl font-bold tracking-tight text-slate-900">
                  {isLoading || isError ? "—" : stat.value.toLocaleString(i18n.language)}
                </p>
              </div>
            </article>
          ))}
        </section>
      )}
    <section className={`${mode === "usage" ? "p-5" : "mt-2"} rounded-2xl border border-slate-200/80 bg-white shadow-sm`}>
      {mode === "usage" && canConfirmServiceUsage && (
        <section aria-label={t("serviceWorkspace.usageSection")} className="mt-6 rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-4">
            <div role="tablist" aria-label={t("serviceWorkspace.usageTabs")} className="flex w-fit flex-wrap gap-5 border-b border-slate-200 lg:shrink-0">
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
                {t("serviceWorkspace.pendingBookings")}
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">{filteredPendingUsageGroups.length}</span>
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
                {t("serviceWorkspace.processed")}
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">{filteredUsedServiceRows.length}</span>
              </button>
            </div>
            <div className="flex min-w-0 flex-1 flex-wrap items-end gap-3 lg:flex-nowrap">
              <div className="relative min-w-[220px] flex-1 lg:min-w-[320px] lg:max-w-xl">
                <Search size={15} className="pointer-events-none absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  value={usageSearchQuery}
                  onChange={(event) => setUsageSearchQuery(event.target.value)}
                  placeholder={localizedText("Tìm mã booking, tên khách, dịch vụ hoặc phòng...", "Search booking ID, guest, service, or room...")}
                  aria-label={localizedText("Tìm dịch vụ khách hàng", "Search customer services")}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-10 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
                <ClearSearchButton value={usageSearchQuery} onClear={() => setUsageSearchQuery("")} label={t("common.clearSearch")} />
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <p className="whitespace-nowrap text-xs font-semibold text-slate-500">
                  {activeUsageTab === "pending" ? t("serviceWorkspace.bookedFrom") : t("serviceWorkspace.usedFrom")}
                </p>
                <DatePickerPopover
                  value={parseLocalDateValue(activeUsageTab === "pending" ? usageDateFrom : usedDateFrom)}
                  maxDate={parseLocalDateValue(activeUsageTab === "pending" ? usageDateTo : usedDateTo)}
                  onChange={(date) => {
                    const value = date ? toLocalDateInputValue(date) : "";
                    if (activeUsageTab === "pending") setUsageDateFrom(value);
                    else setUsedDateFrom(value);
                  }}
                  placeholder={localizedText("Chọn ngày", "Select date")}
                  buttonClassName="flex h-9 min-w-[145px] items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:border-blue-300 hover:text-blue-600"
                  align="start"
                />
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <p className="whitespace-nowrap text-xs font-semibold text-slate-500">
                  {activeUsageTab === "pending" ? t("serviceWorkspace.bookedTo") : t("serviceWorkspace.usedTo")}
                </p>
                <DatePickerPopover
                  value={parseLocalDateValue(activeUsageTab === "pending" ? usageDateTo : usedDateTo)}
                  minDate={parseLocalDateValue(activeUsageTab === "pending" ? usageDateFrom : usedDateFrom)}
                  onChange={(date) => {
                    const value = date ? toLocalDateInputValue(date) : "";
                    if (activeUsageTab === "pending") setUsageDateTo(value);
                    else setUsedDateTo(value);
                  }}
                  placeholder={localizedText("Chọn ngày", "Select date")}
                  buttonClassName="flex h-9 min-w-[145px] items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:border-blue-300 hover:text-blue-600"
                  align="start"
                />
              </div>
                {(activeUsageTab === "pending"
                  ? usageDateFrom || usageDateTo || usageSearchQuery
                  : usedDateFrom || usedDateTo || usageSearchQuery) && (
                  <FilterResetButton
                    label={t("serviceWorkspace.clearFilter")}
                    onClick={() => {
                      if (activeUsageTab === "pending") {
                        setUsageDateFrom("");
                        setUsageDateTo("");
                      } else {
                        setUsedDateFrom("");
                        setUsedDateTo("");
                      }
                      setUsageSearchQuery("");
                    }}
                  />
                )}
            </div>
          </div>
          {activeUsageTab === "pending" && (
            <div id="service-usage-pending-panel" role="tabpanel" aria-labelledby="service-usage-pending-tab">
              <div className="p-4">
              {isLoadingUsage && <p className="rounded-lg bg-white p-4 text-center text-sm text-slate-500">{t("serviceWorkspace.loadingBookings")}</p>}
              {isUsageError && <p role="alert" className="rounded-lg border border-rose-200 bg-white p-4 text-sm text-rose-700">{t("serviceWorkspace.pendingLoadError")}</p>}
              {!isLoadingUsage && !isUsageError && pendingUsageRows.length === 0 && (
                <p className="rounded-lg bg-white p-4 text-center text-sm text-slate-500">{t("serviceWorkspace.noPendingServices")}</p>
              )}
              {!isLoadingUsage && !isUsageError && pendingUsageRows.length > 0 && filteredPendingUsageGroups.length === 0 && (
                <p className="rounded-lg bg-white p-4 text-center text-sm text-slate-500">{localizedText("Không tìm thấy kết quả phù hợp với bộ lọc.", "No results match the selected filters.")}</p>
              )}
              {!isLoadingUsage && !isUsageError && filteredPendingUsageGroups.length > 0 && (
                <div className="flex flex-col gap-2">
                  {filteredPendingUsageGroups.map((group) => (
                    <article key={group.bookingId} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                      <header className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1">
                          <p className="font-semibold text-slate-900">Booking {group.bookingId}</p>
                          <p className="text-xs text-slate-600">{group.customerName}</p>
                          <span className="rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-blue-700">{t("serviceWorkspace.pendingCount", { count: group.services.length })}</span>
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
                          className="inline-flex shrink-0 items-center justify-center gap-1.5 self-start rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-100 sm:self-auto"
                        >
                          {expandedUsageBookingIds.has(group.bookingId) ? t("serviceWorkspace.collapse") : t("serviceWorkspace.actions")}
                        </button>
                      </header>
                      {expandedUsageBookingIds.has(group.bookingId) && <div className="px-3">
                        <p className="inline-flex items-center gap-1 border-b border-slate-100 py-2 text-[11px] text-slate-500"><Clock3 size={12} />{t("serviceWorkspace.bookedAt")} {formatUsageDateTime(group.bookingCreatedAt, i18n.language.startsWith("en") ? "en-US" : "vi-VN")}</p>
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[760px] text-left text-sm">
                            <thead>
                              <tr className="border-b border-slate-100 text-xs font-semibold text-slate-500">
                                <th scope="col" className="px-3 py-2.5">{t("serviceWorkspace.serviceName")}</th>
                                <th scope="col" className="px-3 py-2.5">{t("serviceWorkspace.unitPrice")}</th>
                                <th scope="col" className="px-3 py-2.5">{t("serviceWorkspace.confirmQuantity")}</th>
                                <th scope="col" className="px-3 py-2.5">{t("serviceWorkspace.roomDetails")}</th>
                                <th scope="col" className="px-3 py-2.5 text-right">{t("serviceWorkspace.actions")}</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {group.services.map((row) => (
                                <tr key={`${row.bookingDetailId}-${row.serviceDetailId}`} className="text-slate-700">
                                  <td className="px-3 py-3 font-semibold text-slate-900">{row.serviceName}</td>
                                  <td className="px-3 py-3 whitespace-nowrap">{formatServicePrice(row.price, i18n.language.startsWith("en") ? "en-US" : "vi-VN")}</td>
                                  <td className="px-3 py-3">
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="number"
                                        min={1}
                                        max={row.quantity}
                                        step={1}
                                        required
                                        value={usageQuantities[row.serviceDetailId] ?? "1"}
                                        onChange={(event) => setUsageQuantities((current) => ({ ...current, [row.serviceDetailId]: event.target.value }))}
                                        aria-label={t("serviceWorkspace.confirmQuantity")}
                                        className="h-9 w-20 rounded-lg border border-slate-200 px-2 text-sm outline-none focus:border-blue-400"
                                      />
                                      <span className="text-xs text-slate-500">{t("serviceWorkspace.remainingQuantity", { count: row.quantity })}</span>
                                    </div>
                                  </td>
                                  <td className="px-3 py-3">
                                    <p>{t("serviceWorkspace.room", { room: row.roomNumber })}</p>
                                    <p className="mt-1 text-xs text-slate-500">
                                      {row.actualCheckInTime
                                        ? `${t("serviceWorkspace.actualCheckIn")} ${formatUsageDateTime(row.actualCheckInTime, i18n.language.startsWith("en") ? "en-US" : "vi-VN")}`
                                        : row.checkInTime
                                          ? `${t("serviceWorkspace.expectedCheckIn")} ${formatUsageDateTime(row.checkInTime, i18n.language.startsWith("en") ? "en-US" : "vi-VN")}`
                                          : t("serviceWorkspace.notCheckedIn")}
                                    </p>
                                  </td>
                                  <td className="px-3 py-3 text-right">
                                    <button
                                      type="button"
                                      onClick={() => void handleConfirmServiceUsed(row, Number(usageQuantities[row.serviceDetailId] ?? 1))}
                                      disabled={isConfirmingService || !Number.isInteger(Number(usageQuantities[row.serviceDetailId] ?? 1)) || Number(usageQuantities[row.serviceDetailId] ?? 1) < 1 || Number(usageQuantities[row.serviceDetailId] ?? 1) > row.quantity}
                                      className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60"
                                    >
                                      <CheckCircle2 size={14} />{t("serviceWorkspace.confirmUsed")}
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
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
              {isLoadingUsage && <p className="rounded-lg bg-white p-4 text-center text-sm text-slate-500">{t("serviceWorkspace.loadingHistory")}</p>}
              {isUsageError && <p role="alert" className="rounded-lg border border-rose-200 bg-white p-4 text-sm text-rose-700">{t("serviceWorkspace.historyLoadError")}</p>}
              {!isLoadingUsage && !isUsageError && filteredUsedServiceRows.length === 0 && (
                <FilterResultStatus filterKey={JSON.stringify([usedDateFrom, usedDateTo, usageSearchQuery])}><p className="rounded-lg bg-white p-4 text-center text-sm text-slate-500">{localizedText("Không tìm thấy kết quả phù hợp với bộ lọc.", "No results match the selected filters.")}</p></FilterResultStatus>
              )}
              {!isLoadingUsage && !isUsageError && filteredUsedServiceRows.length > 0 && (
                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                  <table className="w-full min-w-[900px] text-left text-sm">
                    <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
                      <tr>
                        <th scope="col" className="px-4 py-3">{t("serviceWorkspace.serviceName")}</th>
                        <th scope="col" className="px-4 py-3">{t("serviceWorkspace.unitPrice")}</th>
                        <th scope="col" className="px-4 py-3">{t("serviceWorkspace.quantity")}</th>
                        <th scope="col" className="px-4 py-3">{t("serviceWorkspace.booking")}</th>
                        <th scope="col" className="px-4 py-3">{t("serviceWorkspace.roomDetails")}</th>
                        <th scope="col" className="px-4 py-3">{t("serviceWorkspace.usedAt")}</th>
                        <th scope="col" className="px-4 py-3">{t("serviceWorkspace.confirmedByLabel")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredUsedServiceRows.map((row) => (
                        <tr key={`${row.bookingId}-${row.serviceDetailId}`} className="text-slate-700">
                          <td className="px-4 py-3 font-semibold text-slate-900">{row.serviceName}</td>
                          <td className="px-4 py-3 whitespace-nowrap">{formatServicePrice(row.price, i18n.language.startsWith("en") ? "en-US" : "vi-VN")}</td>
                          <td className="px-4 py-3">{row.quantity}</td>
                          <td className="px-4 py-3">
                            <p className="font-medium text-slate-800">{row.bookingId}</p>
                            <p className="mt-1 text-xs text-slate-500">{row.customerName}</p>
                          </td>
                          <td className="px-4 py-3">{t("serviceWorkspace.room", { room: row.roomNumber })}</td>
                          <td className="px-4 py-3">{formatUsageDateTime(row.usedAt, i18n.language.startsWith("en") ? "en-US" : "vi-VN")}</td>
                          <td className="px-4 py-3">{row.usedBy || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
      <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-bold text-slate-900">{t("serviceWorkspace.catalogList")}</h3>
          <p className="mt-1 text-sm text-slate-500">{t("serviceWorkspace.catalogListDescription")}</p>
        </div>
        {canManageServices && (
          <div className="flex shrink-0 flex-nowrap gap-2">
            {!isSystemAdmin && (
              <button
                type="button"
                onClick={() => setIsBulkImportOpen(true)}
                className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border border-blue-200 bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 shadow-sm transition hover:bg-blue-50"
              >
                <Upload size={16} />{t("serviceWorkspace.uploadFromFile")}
              </button>
            )}
            <button type="button" onClick={openCreateForm} className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"><Plus size={16} />{t("serviceWorkspace.addService")}</button>
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-4">
        <div className="relative w-full sm:w-64 sm:flex-none lg:w-72">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={t("serviceWorkspace.searchPlaceholder")}
            aria-label={t("serviceWorkspace.searchServices")}
            className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-10 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
          <ClearSearchButton value={searchQuery} onClear={() => setSearchQuery("")} label={t("common.clearSearch")} />
        </div>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-3">
          {isSystemAdmin && (
            <label className="flex items-center gap-2 text-sm font-medium text-slate-600">
              <span>{t("serviceWorkspace.branch")}</span>
              <FilterSelect
                value={selectedBranchId}
                onChange={(event) => setSelectedBranchId(event.target.value)}
                aria-label={t("serviceWorkspace.filterByBranch")}
                className="h-10 min-w-48 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              >
                <option value="">{t("serviceWorkspace.allBranches")}</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>{branch.name}</option>
                ))}
              </FilterSelect>
            </label>
          )}
          <label className="flex items-center">
            <FilterSelect
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
              aria-label={t("serviceWorkspace.filterByStatus")}
              className="h-10 min-w-44 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            >
              <option value="all">{t("serviceWorkspace.allStatuses")}</option>
              <option value="active">{t("serviceWorkspace.active")}</option>
              <option value="inactive">{t("serviceWorkspace.inactive")}</option>
            </FilterSelect>
          </label>
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label={t("serviceWorkspace.customizeColumns", "Tùy chỉnh cột")}
                className="flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Columns3 size={16} />
                {t("common.columns", "Cột")}
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-60 p-2">
              <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {t("serviceWorkspace.showColumns", "Hiển thị cột")}
              </p>
              {SERVICE_TABLE_COLUMNS.map((column) => {
                const isLastVisibleColumn = shownServiceColumns.length === 1 && visibleServiceColumns[column.id];
                return (
                  <label
                    key={column.id}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={visibleServiceColumns[column.id]}
                      disabled={isLastVisibleColumn}
                      onChange={(event) => {
                        setVisibleServiceColumns((current) => ({
                          ...current,
                          [column.id]: event.target.checked,
                        }));
                      }}
                      className="h-4 w-4 rounded border-slate-300 accent-blue-600"
                    />
                    {t(column.labelKey)}
                  </label>
                );
              })}
              <button
                type="button"
                onClick={() => setVisibleServiceColumns({
                  name: true,
                  category: true,
                  description: true,
                  price: true,
                  status: true,
                  actions: true,
                })}
                className="mt-1 w-full rounded-md border-t border-slate-100 px-2 pt-2 text-left text-xs font-semibold text-blue-700 hover:text-blue-800"
              >
                {t("serviceWorkspace.showAllColumns", "Hiện tất cả cột")}
              </button>
            </PopoverContent>
          </Popover>
          <button
            type="button"
            onClick={async () => {
              if (isFetching || isManuallyRefreshingServices) return;
              const refreshStartedAt = Date.now();
              setIsManuallyRefreshingServices(true);
              await new Promise<void>((resolve) => {
                window.requestAnimationFrame(() => resolve());
              });
              if (hasServiceFilters) {
                setSearchQuery("");
                setSelectedBranchId("");
                setStatusFilter("all");
              }
              try {
                await refetch().unwrap();
              } catch {
                toast({
                  variant: "destructive",
                  title: t("serviceWorkspace.servicesLoadError"),
                });
              } finally {
                const remainingLoadingTime = 2000 - (Date.now() - refreshStartedAt);
                if (remainingLoadingTime > 0) {
                  await new Promise<void>((resolve) => window.setTimeout(resolve, remainingLoadingTime));
                }
                setIsManuallyRefreshingServices(false);
              }
            }}
            aria-label={hasServiceFilters
              ? t("common.resetFilter")
              : localizedText("Tải lại danh sách dịch vụ", "Reload services")}
            title={hasServiceFilters
              ? t("common.resetFilter")
              : localizedText("Tải lại danh sách dịch vụ", "Reload services")}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            aria-busy={isFetching || isManuallyRefreshingServices}
          >
            {isFetching || isManuallyRefreshingServices
              ? <RefreshCw size={16} className="animate-spin" />
              : hasServiceFilters
              ? <RotateCcw size={15} />
              : <RefreshCw size={16} />}
          </button>
        </div>
      </div>
      {isServiceListLoading && (
        <div role="status" aria-live="polite" className="flex min-h-48 items-center justify-center gap-2 border-b border-slate-100 px-4 py-8 text-sm text-blue-700">
          <RefreshCw size={17} className="animate-spin" />
          <span>{localizedText("Đang tải danh sách dịch vụ...", "Loading services...")}</span>
        </div>
      )}
      {!isServiceListLoading && isError && <p className="m-5 rounded-xl border border-rose-200 bg-rose-50 p-6 text-center text-sm text-rose-600">{t("serviceWorkspace.servicesLoadError")}</p>}
      {!isServiceListLoading && !isError && !hasHotelId && !isSystemAdmin && <p className="m-5 rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">{t("serviceWorkspace.branchUnknown")}</p>}
      {!isServiceListLoading && !isError && (hasHotelId || isSystemAdmin) && allServices.length === 0 && <p className="m-5 rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">{t("serviceWorkspace.noServices")}</p>}
      {!isServiceListLoading && !isError && allServices.length > 0 && filteredServices.length === 0 && <FilterResultStatus filterKey={JSON.stringify([searchQuery, statusFilter])}><p className="m-5 rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">{t("serviceWorkspace.noMatchingServices")}</p></FilterResultStatus>}
      {!isServiceListLoading && filteredServices.length > 0 && (
        <div className="overflow-x-auto">
          <table
            className="min-w-full table-fixed border-collapse text-left text-sm"
            style={{ width: `${serviceTableWidth + (isSystemAdmin ? 64 : 0)}px` }}
          >
            <colgroup>
              {isSystemAdmin && <col style={{ width: "64px" }} />}
              {shownServiceColumns.map((column) => (
                <col key={column.id} style={{ width: `${column.width}px` }} />
              ))}
            </colgroup>
            <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
              <tr>
                {isSystemAdmin && <th scope="col" className="whitespace-nowrap px-5 py-3">STT</th>}
                {shownServiceColumns.map((column) => (
                  <th
                    key={column.id}
                    scope="col"
                    className={`whitespace-nowrap px-5 py-3 ${column.id === "price" || column.id === "actions" ? "text-right" : ""}`}
                  >
                    {t(column.labelKey)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedServices.map((service, index) => {
                const isActive = service.active;
                return (
                  <tr key={service.id} className="text-slate-700 transition hover:bg-slate-50/70">
                    {isSystemAdmin && <td className="px-5 py-3 tabular-nums text-slate-500">{(safePage - 1) * pageSize + index + 1}</td>}
                    {visibleServiceColumns.name && <td className="max-w-56 px-5 py-3 font-semibold text-slate-900">
                      <p className="truncate" title={service.name}>{service.name}</p>
                    </td>}
                    {visibleServiceColumns.category && <td className="whitespace-nowrap px-5 py-3 text-slate-600">{service.category}</td>}
                    {visibleServiceColumns.description && <td className="max-w-80 px-5 py-3 text-slate-600">
                      <p className="truncate" title={service.detail}>{service.detail || "—"}</p>
                    </td>}
                    {visibleServiceColumns.price && <td className="whitespace-nowrap px-5 py-3 text-right font-semibold text-slate-800">
                      {service.price.toLocaleString(i18n.resolvedLanguage?.startsWith("en") ? "en-US" : "vi-VN")}
                      {i18n.resolvedLanguage?.startsWith("en") ? " VND" : "đ"}
                      <span className="font-normal text-slate-400"> / {service.unit}</span>
                    </td>}
                    {visibleServiceColumns.status && <td className="whitespace-nowrap px-5 py-3">
                      {canManageServices ? (
                        <button
                          type="button"
                          onClick={() => void toggleServiceStatus(service.id)}
                          disabled={isUpdating}
                          className={`inline-flex items-center gap-1.5 text-xs font-semibold transition disabled:cursor-wait disabled:opacity-60 ${isActive ? "text-emerald-700 hover:text-emerald-800" : "text-slate-500 hover:text-slate-700"}`}
                        >
                          <span className={`h-2 w-2 rounded-full ${isActive ? "bg-emerald-500" : "bg-slate-300"}`} />
                          {isActive ? t("serviceWorkspace.active") : t("serviceWorkspace.inactive")}
                        </button>
                      ) : (
                        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${isActive ? "text-emerald-700" : "text-slate-500"}`}>
                          <span className={`h-2 w-2 rounded-full ${isActive ? "bg-emerald-500" : "bg-slate-300"}`} />
                          {isActive ? t("serviceWorkspace.active") : t("serviceWorkspace.inactive")}
                        </span>
                      )}
                    </td>}
                    {visibleServiceColumns.actions && <td className="whitespace-nowrap px-5 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setDetailService(service)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-800"
                        >
                          <Eye size={14} />
                          {t("serviceWorkspace.viewDetails")}
                        </button>
                        {canManageServices && (
                          <button
                            type="button"
                            onClick={() => openEditForm(service)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 px-3 py-2 text-xs font-semibold text-amber-700 transition hover:border-amber-300 hover:bg-amber-50 hover:text-amber-800"
                          >
                            <Pencil size={14} />
                            {t("serviceWorkspace.edit")}
                          </button>
                        )}
                      </div>
                    </td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {!isServiceListLoading && !isError && filteredServices.length > 0 && (
        <ListPagination totalItems={filteredServices.length} page={safePage} pageSize={pageSize} mode="table" onPageChange={setPage} onPageSizeChange={setPageSize} />
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
                aria-label={t("serviceWorkspace.close")}
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
                  <p className="text-xs font-medium text-slate-500">{t("serviceWorkspace.unitPrice")}</p>
                  <p className="mt-1 text-xl font-bold text-blue-700">
                    {detailService.price.toLocaleString("vi-VN")}đ
                    <span className="ml-1 text-sm font-medium text-slate-500">/ {detailService.unit}</span>
                  </p>
                </div>
                <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${detailService.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                  <span className={`h-2 w-2 rounded-full ${detailService.active ? "bg-emerald-500" : "bg-slate-400"}`} />
                  {detailService.active ? t("serviceWorkspace.active") : t("serviceWorkspace.inactive")}
                </span>
              </div>

              <dl className="mt-5 space-y-4">
                <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3 text-sm">
                  <dt className="text-slate-500">{t("serviceWorkspace.serviceId")}</dt>
                  <dd className="font-semibold text-slate-800">{detailService.id}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t("serviceWorkspace.serviceDescription")}</dt>
                  <dd className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                    {detailService.detail || t("serviceWorkspace.noDescription")}
                  </dd>
                </div>
              </dl>

              <div className="mt-6 flex justify-end border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setDetailService(null)}
                  className="rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
                >
                  {t("serviceWorkspace.close")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <BulkImportDialog
        open={isBulkImportOpen}
        onOpenChange={setIsBulkImportOpen}
        eyebrow={t("serviceWorkspace.importServices")}
        title={t("serviceWorkspace.importServices")}
        description={t("serviceWorkspace.bulkImportDescription")}
        templateLabel={t("serviceWorkspace.downloadTemplate")}
        onDownloadTemplate={downloadServiceTemplate}
        acceptedFileTypes=".zip,application/zip"
        fileLabel={t("serviceWorkspace.zipFileLabel")}
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
        uploadLabel={t("serviceWorkspace.importServices")}
        progress={serviceImportUploadProgress || undefined}
        onUpload={importServicesFromFile}
      />
      {showCreate && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-950/70 p-4 backdrop-blur-[1px]" onMouseDown={() => setShowCreate(false)}>
          <form
            noValidate
            className="my-auto max-h-[calc(100dvh-2rem)] w-full max-w-2xl shrink-0 overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-6"
            onSubmit={(event) => {
              event.preventDefault();
              void saveService();
            }}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-blue-600">{t("serviceWorkspace.serviceType")}</p>
                <h4 className="mt-1 font-serif text-lg font-bold leading-tight text-slate-900">{editingService ? t("serviceWorkspace.editService") : t("serviceWorkspace.addService")}</h4>
              </div>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                aria-label={t("serviceWorkspace.close")}
                className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={20} />
              </button>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {isSystemAdmin && !editingService && (
                <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
                  {t("serviceWorkspace.serviceScope")}
                  <select
                    value={targetHotelId}
                    onChange={(event) => setTargetHotelId(event.target.value)}
                    className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="">{t("serviceWorkspace.entireSystem")}</option>
                    {branches.map((branch) => (
                      <option key={branch.id} value={String(branch.id)}>{branch.name}</option>
                    ))}
                  </select>
                  <span className="mt-1 block text-xs font-normal text-slate-500">
                    {targetHotelId ? t("serviceWorkspace.branchOnly") : t("serviceWorkspace.allBranchesApply")}
                  </span>
                </label>
              )}
              <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
                {t("serviceWorkspace.serviceName")} <span className="text-rose-500">*</span>
                <input
                  required
                  value={newService.name}
                  onChange={(event) => { setNewService((current) => ({ ...current, name: event.target.value })); setFieldErrors((current) => ({ ...current, name: undefined })); }}
                  aria-invalid={Boolean(fieldErrors.name)}
                  aria-describedby={fieldErrors.name ? "service-name-error" : undefined}
                  className={`mt-1.5 h-10 w-full rounded-lg border bg-white px-3 text-sm font-normal text-slate-800 transition placeholder:text-slate-400 focus:outline-none focus:ring-2 ${fieldErrors.name ? "border-rose-400 focus:border-rose-500 focus:ring-rose-100" : "border-slate-200 focus:border-blue-500 focus:ring-blue-100"}`}
                  placeholder={t("serviceWorkspace.enterServiceName")}
                />
                {fieldErrors.name && <span id="service-name-error" className="mt-1 block text-xs font-normal text-rose-600">{fieldErrors.name}</span>}
              </label>

              <label className="text-sm font-semibold text-slate-700">
                {t("serviceWorkspace.price")} <span className="text-rose-500">*</span>
                <input
                  required
                  type="number"
                  min="0"
                  value={newService.price}
                  onChange={(event) => { setNewService((current) => ({ ...current, price: event.target.value })); setFieldErrors((current) => ({ ...current, price: undefined })); }}
                  aria-invalid={Boolean(fieldErrors.price)}
                  aria-describedby={fieldErrors.price ? "service-price-error" : undefined}
                  className={`mt-1.5 h-10 w-full rounded-lg border bg-white px-3 text-sm font-normal text-slate-800 transition focus:outline-none focus:ring-2 ${fieldErrors.price ? "border-rose-400 focus:border-rose-500 focus:ring-rose-100" : "border-slate-200 focus:border-blue-500 focus:ring-blue-100"}`}
                  placeholder="0"
                />
                {fieldErrors.price && <span id="service-price-error" className="mt-1 block text-xs font-normal text-rose-600">{fieldErrors.price}</span>}
              </label>

              <label className="text-sm font-semibold text-slate-700">
                {t("serviceWorkspace.unit")} <span className="text-rose-500">*</span>
                <select
                  required
                  value={newService.unit}
                  onChange={(event) => { setNewService((current) => ({ ...current, unit: event.target.value })); setFieldErrors((current) => ({ ...current, unit: undefined })); }}
                  aria-invalid={Boolean(fieldErrors.unit)}
                  aria-describedby={fieldErrors.unit ? "service-unit-error" : undefined}
                  className={`mt-1.5 h-10 w-full rounded-lg border bg-white px-3 text-sm font-normal text-slate-800 transition focus:outline-none focus:ring-2 ${fieldErrors.unit ? "border-rose-400 focus:border-rose-500 focus:ring-rose-100" : "border-slate-200 focus:border-blue-500 focus:ring-blue-100"}`}
                >
                  <option value="lần">{t("serviceWorkspace.unitOnce")}</option>
                  <option value="người">{t("booking.people")}</option>
                  <option value="giờ">{t("serviceWorkspace.unitHour")}</option>
                  <option value="ngày">{t("serviceWorkspace.unitDay")}</option>
                </select>
                {fieldErrors.unit && <span id="service-unit-error" className="mt-1 block text-xs font-normal text-rose-600">{fieldErrors.unit}</span>}
              </label>

              <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
                {t("serviceWorkspace.category")} <span className="text-rose-500">*</span>
                <select
                  required
                  value={newService.category}
                  onChange={(event) => { setNewService((current) => ({ ...current, category: event.target.value })); setFieldErrors((current) => ({ ...current, category: undefined })); }}
                  aria-invalid={Boolean(fieldErrors.category)}
                  aria-describedby={fieldErrors.category ? "service-category-error" : undefined}
                  className={`mt-1.5 h-10 w-full rounded-lg border bg-white px-3 text-sm font-normal text-slate-800 transition focus:outline-none focus:ring-2 ${fieldErrors.category ? "border-rose-400 focus:border-rose-500 focus:ring-rose-100" : "border-slate-200 focus:border-blue-500 focus:ring-blue-100"}`}
                >
                  <option value="Khác">{t("serviceWorkspace.other")}</option>
                  <option value="Dịch vụ phòng">{t("serviceWorkspace.roomService")}</option>
                  <option value="Thể thao">{t("serviceWorkspace.sports")}</option>
                  <option value="Spa">{t("serviceWorkspace.spa")}</option>
                  <option value="Nhà hàng">{t("serviceWorkspace.restaurant")}</option>
                  <option value="Điện tử">{t("serviceWorkspace.electronics")}</option>
                </select>
                {fieldErrors.category && <span id="service-category-error" className="mt-1 block text-xs font-normal text-rose-600">{fieldErrors.category}</span>}
              </label>

              <div className="text-sm font-semibold text-slate-700 sm:col-span-2">
                {t("serviceWorkspace.image")} {!editingService && <span className="text-rose-500">*</span>}

                <div className="mt-2 flex flex-col gap-3">
                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700 transition hover:border-blue-300 hover:bg-blue-100">
                    <ImagePlus size={16} />
                    {t("serviceWorkspace.uploadImage")}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;
                        setSelectedImage(file);
                        setFieldErrors((current) => ({ ...current, image: undefined }));
                        setNewService((current) => ({
                          ...current,
                          imageUrl: URL.createObjectURL(file),
                        }));
                      }}
                    />
                  </label>
                  {fieldErrors.image && <p id="service-image-error" className="text-xs font-normal text-rose-600" role="alert">{fieldErrors.image}</p>}

                  {newService.imageUrl && (
                    <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50 p-2">
                      <img src={newService.imageUrl} alt={t("serviceWorkspace.servicePreview")} className="h-28 w-full rounded-lg object-cover" />
                    </div>
                  )}
                </div>
              </div>

              <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
                {t("serviceWorkspace.description")} <span className="text-rose-500">*</span>
                <textarea
                  required
                  value={newService.detail}
                  onChange={(event) => { setNewService((current) => ({ ...current, detail: event.target.value })); setFieldErrors((current) => ({ ...current, detail: undefined })); }}
                  aria-invalid={Boolean(fieldErrors.detail)}
                  aria-describedby={fieldErrors.detail ? "service-description-error" : undefined}
                  rows={3}
                  placeholder={t("serviceWorkspace.enterDescription")}
                  className={`mt-1.5 w-full resize-none rounded-lg border bg-white px-3 py-2.5 text-sm font-normal text-slate-800 transition placeholder:text-slate-400 focus:outline-none focus:ring-2 ${fieldErrors.detail ? "border-rose-400 focus:border-rose-500 focus:ring-rose-100" : "border-slate-200 focus:border-blue-500 focus:ring-blue-100"}`}
                />
                {fieldErrors.detail && <span id="service-description-error" className="mt-1 block text-xs font-normal text-rose-600">{fieldErrors.detail}</span>}
              </label>

              <div className="sm:col-span-2">
                <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300">
                  {t("serviceWorkspace.active")}
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

            <div className="mt-6 flex items-center justify-start gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowCreate(false);
                  setEditingService(null);
                  setSelectedImage(null);
                }}
                disabled={isSaving}
                className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                {t("serviceWorkspace.cancel")}
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {editingService ? <Pencil size={16} /> : <Plus size={16} />}
                {isSaving ? t("serviceWorkspace.saving") : editingService ? t("serviceWorkspace.saveChanges") : t("serviceWorkspace.addService")}
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
   