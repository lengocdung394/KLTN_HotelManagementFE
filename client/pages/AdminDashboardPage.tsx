import { Children, cloneElement, isValidElement, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Bell,
  BarChart3,
  Building2,
  CalendarDays,
  CheckCheck,
  Check,
  ClipboardCheck,
  Columns3,
  ConciergeBell,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  CircleUserRound,
  Eye,
  LayoutDashboard,
  Layers,
  LoaderCircle,
  LogOut,
  MapPin,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Plus,
  Pencil,
  FileSpreadsheet,
  ShieldCheck,
  Tag,
  Upload,
  Users,
  Volume2,
  VolumeX,
  Wallet,
  X,
} from "lucide-react";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import i18n, { localizedText } from "../i18n";
import { toast } from "@/components/ui/use-toast";
import { baseApi } from "../services/baseApi";
import { bindSuperAdminSocketEvents, joinSuperAdminAccountsRoom } from "../lib/socket";
import {
  formatEntityUpdateNotification,
  isCheckoutCompletionUpdate,
  isHousekeepingCompletionUpdate,
  formatRoomUpdateNotification,
} from "../lib/roomUpdateNotification";
import {
  useGetNotificationsQuery,
  useGetNotificationSummaryQuery,
  useMarkAllNotificationsReadMutation,
  useMarkNotificationReadMutation,
  type NotificationRecord,
} from "../services/notificationApi";
import {
  useCreateSuperAdminBranchMutation,
  useGetSuperAdminBranchDetailsQuery,
  useGetSuperAdminBranchesQuery,
  useSaveSuperAdminBranchRoomPoliciesMutation,
  type SuperAdminRoomPolicy,
  type SuperAdminBranch,
  type SuperAdminBranchDetails,
  type CreateBranchAccountRequest,
  type CreateBranchAdminAccountRequest,
} from "../services/superAdminApi";
import { useUpdateBranchRoomPolicyMutation } from "../services/branchRoomPolicyApi";
import { useUpdateBuildingMutation } from "../services/buildingApi";
import { useUpdateFloorMutation } from "../services/floorApi";
import { useGetAllAmenitiesQuery } from "../services/amenityApi";
import {
  useGetBookingCancellationsQuery,
  useGetCheckoutRefundsQuery,
} from "../services/managementBookingApi";
import RoomEditForm, { type RoomEditDraft } from "../components/RoomEditForm";
import {
  useLazyGetRoomByIdQuery,
  useGetRoomStatusesQuery,
  useGetRoomTypesQuery,
  useUpdateRoomMutation,
  type RoomResponse,
} from "../services/roomApi";
import {
  useCreateBedTypeMutation,
  useGetAllBedTypesQuery,
  useImportBedTypesMutation,
  useUpdateBedTypeMutation,
  type BedTypeRequest,
} from "../services/roomApi";
import { downloadBedTypeTemplate, parseBedTypeFile } from "../lib/bedTypeImport";
import { downloadSuperAdminRoomPolicyTemplate, parseSuperAdminRoomPolicyFile } from "../lib/superAdminRoomPolicyImport";
import SuperAdminRolePermissionsPanel from "../components/SuperAdminRolePermissionsPanel";
import SuperAdminAccountManagementPanel from "../components/SuperAdminAccountManagementPanel";
import SuperAdminResourceStatsPanel from "../components/SuperAdminResourceStatsPanel";
import SuperAdminProvinceMapPanel from "../components/SuperAdminProvinceMapPanel";
import SuperAdminAmenitiesPanel from "../components/SuperAdminAmenitiesPanel";
import RefundApprovalWorkspace from "./RefundApprovalWorkspace";
import ListPagination from "../components/ListPagination";
import CatalogEntryDialog, { type CatalogEntryMode } from "../components/CatalogEntryDialog";
import PromotionWorkspace from "./PromotionWorkspace";
import ServiceWorkspace from "./ServiceWorkspace";
import SuperAdminProfileSettings from "../components/SuperAdminProfileSettings";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { VIETNAM_PROVINCES } from "../lib/vietnamProvinces";

type AdminSection =
  | "overview"
  | "profile"
  | "notifications"
  | "refund-approvals"
  | "branches"
  | "amenities"
  | "bed-types"
  | "permissions"
  | "roles"
  | "resource-stats"
  | "promotions"
  | "services"
  | "accounts-overview"
  | "staff-accounts"
  | "customer-accounts";

type AdminNotification = {
  id: number;
  title: string;
  description: string;
  occurredAt: Date;
  read: boolean;
  category: "booking" | "room" | "floor" | "service" | "staff" | "promotion" | "other";
  type: NotificationRecord["type"];
  hotelId: number | null;
  referenceType: string | null;
  referenceId: string | null;
};

type NotificationCategoryFilter = "all" | AdminNotification["category"];

const formatMoney = (amount: number) =>
  `${amount.toLocaleString(i18n.language.startsWith("en") ? "en-US" : "vi-VN")} ${i18n.language.startsWith("en") ? "VND" : "đ"}`;

const getNotificationCategory = (type: NotificationRecord["type"]): AdminNotification["category"] => {
  if (type.startsWith("BOOKING_") || type === "PAYMENT_RECEIVED") return "booking";
  if (type.startsWith("FLOOR_")) return "floor";
  if (
    type.startsWith("ROOM_")
    || type.startsWith("BUILDING_")
    || type.startsWith("ROOM_POLICY_")
    || type.startsWith("HOUSEKEEPING_TASK_")
  ) return "room";
  if (type.startsWith("SERVICE_")) return "service";
  if (type.startsWith("EMPLOYEE_")) return "staff";
  if (type.startsWith("PROMOTION_")) return "promotion";
  return "other";
};

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "data" in error) {
    const data = (error as { data?: unknown }).data;
    if (data && typeof data === "object") {
      const payload = data as { message?: unknown; detail?: unknown };
      if (typeof payload.message === "string") return payload.message;
      if (typeof payload.detail === "string") return payload.detail;
    }
  }
  return fallback;
};

const notifyBuildingFloorChange = (entity: "building" | "floor", payload: unknown) => {
  const event = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  const data = event.data && typeof event.data === "object" ? event.data as Record<string, unknown> : {};
  const action = event.action === "UPDATED" ? "được chỉnh sửa" : "được thêm mới";
  const name = entity === "building"
    ? String(data.name ?? "Tòa nhà")
    : `Tầng ${String(data.floorNumber ?? "")}`.trim();
  const description = formatEntityUpdateNotification(
    event,
    name || (entity === "building" ? "Tòa nhà" : "Tầng"),
  );
  toast({
    title: `${entity === "building" ? "Tòa nhà" : "Tầng"} ${action}`,
    description,
  });
};

const getSocketPayload = (payload: unknown): Record<string, unknown> =>
  payload && typeof payload === "object" ? payload as Record<string, unknown> : {};

const getSocketText = (payload: Record<string, unknown>, key: string, fallback: string) => {
  const value = payload[key];
  return value === null || value === undefined || value === "" ? fallback : String(value);
};

const initialBranchForm = {
  name: "",
  address: "",
  phone: "",
  provinceName: "",
  adminAccount: { username: "", password: "" },
  managerAccount: { fullName: "", email: "", phone: "", password: "" },
};

type BranchFormField =
  | "name"
  | "phone"
  | "address"
  | "provinceName"
  | "adminUsername"
  | "adminPassword"
  | "managerFullName"
  | "managerEmail"
  | "managerPhone"
  | "managerPassword";

const branchAdminErrorKeys: Record<keyof CreateBranchAdminAccountRequest, BranchFormField> = {
  username: "adminUsername",
  password: "adminPassword",
};

const branchManagerErrorKeys: Record<keyof CreateBranchAccountRequest, BranchFormField> = {
  fullName: "managerFullName",
  email: "managerEmail",
  phone: "managerPhone",
  password: "managerPassword",
};

const branchFieldErrorIds: Record<BranchFormField, string> = {
  name: "branch-name-error",
  phone: "branch-phone-error",
  address: "branch-address-error",
  provinceName: "branch-province-error",
  adminUsername: "admin-username-error",
  adminPassword: "admin-password-error",
  managerFullName: "manager-fullname-error",
  managerEmail: "manager-email-error",
  managerPhone: "manager-phone-error",
  managerPassword: "manager-password-error",
};

const initialBedTypeForm: BedTypeRequest = {
  name: "",
  description: "",
  capacity: 1,
  isExtraBed: false,
};

const branchAccountSections = [
  { key: "managerAccount", title: "Tài khoản quản lý chi nhánh" },
] as const;

const branchAccountFields: {
  key: keyof CreateBranchAccountRequest;
  label: string;
  type: string;
  autoComplete: string;
}[] = [
  { key: "fullName", label: "Họ và tên", type: "text", autoComplete: "name" },
  { key: "email", label: "Email", type: "email", autoComplete: "email" },
  { key: "phone", label: "Số điện thoại", type: "tel", autoComplete: "tel" },
  { key: "password", label: "Mật khẩu", type: "password", autoComplete: "new-password" },
];

const branchAdminAccountFields: {
  key: keyof CreateBranchAdminAccountRequest;
  label: string;
  type: string;
  autoComplete: string;
}[] = [
  { key: "username", label: "Tên tài khoản", type: "text", autoComplete: "username" },
  { key: "password", label: "Mật khẩu", type: "password", autoComplete: "new-password" },
];

type AdminDashboardPageProps = {
  onLogout: () => void;
};

export default function AdminDashboardPage({ onLogout }: AdminDashboardPageProps) {
  const { i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const { fullName, email } = useAppSelector((state) => state.auth);
  const [section, setSection] = useState<AdminSection>("overview");
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [isCatalogMenuOpen, setIsCatalogMenuOpen] = useState(false);
  const [isSalesMenuOpen, setIsSalesMenuOpen] = useState(false);
  const [isRoleMenuOpen, setIsRoleMenuOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isBranchFormOpen, setIsBranchFormOpen] = useState(false);
  const [branchForm, setBranchForm] = useState(initialBranchForm);
  const [branchFieldErrors, setBranchFieldErrors] = useState<Partial<Record<BranchFormField, string>>>({});
  const [branchFormError, setBranchFormError] = useState("");
  const [isProvincePickerOpen, setIsProvincePickerOpen] = useState(false);
  const [provinceSearch, setProvinceSearch] = useState("");
  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null);
  const [branchDetailsReturnSection, setBranchDetailsReturnSection] = useState<AdminSection>("branches");
  const [branchDetailInitialCategory, setBranchDetailInitialCategory] = useState<BranchDetailCategory>("employees");
  const [highlightedDetailReference, setHighlightedDetailReference] = useState<{
    category: BranchDetailCategory;
    id: string;
  } | null>(null);
  const [branchRoomPolicies, setBranchRoomPolicies] = useState<SuperAdminRoomPolicy[]>([]);
  const [branchPolicyFileName, setBranchPolicyFileName] = useState("");
  const [branchPolicyError, setBranchPolicyError] = useState("");
  const [isParsingBranchPolicy, setIsParsingBranchPolicy] = useState(false);
  const [notificationCategoryFilter, setNotificationCategoryFilter] = useState<NotificationCategoryFilter>("all");
  const [notificationBranchFilter, setNotificationBranchFilter] = useState("all");
  const [notificationListPage, setNotificationListPage] = useState(1);
  const [notificationPageSize, setNotificationPageSize] = useState(10);
  const [isNotificationSoundEnabled, setIsNotificationSoundEnabled] = useState(false);
  const recentRoomCreateEventsRef = useRef(new Map<string, number>());
  const notificationSoundEnabledRef = useRef(false);
  const notificationAudioContextRef = useRef<AudioContext | null>(null);
  const playNotificationSoundRef = useRef<() => void>(() => undefined);
  const [bedTypeForm, setBedTypeForm] = useState<BedTypeRequest>(initialBedTypeForm);
  const [editingBedTypeId, setEditingBedTypeId] = useState<number | null>(null);
  const [bedTypeError, setBedTypeError] = useState("");
  const [bedTypeNameError, setBedTypeNameError] = useState("");
  const [bedTypeMessage, setBedTypeMessage] = useState("");
  const [isBedTypeDialogOpen, setIsBedTypeDialogOpen] = useState(false);
  const [bedTypeDialogMode, setBedTypeDialogMode] = useState<CatalogEntryMode>("manual");
  const [isParsingBedTypeFile, setIsParsingBedTypeFile] = useState(false);
  const notificationHotelId = notificationBranchFilter === "all" ? undefined : Number(notificationBranchFilter);
  const {
    data: notificationPageResponse,
    isLoading: isNotificationsLoading,
    isError: isNotificationsError,
  } = useGetNotificationsQuery({
    hotelId: notificationHotelId,
    page: 0,
    size: 100,
  });
  const { data: notificationSummaryResponse } = useGetNotificationSummaryQuery(
    notificationHotelId === undefined ? undefined : { hotelId: notificationHotelId },
  );
  const { data: allNotificationsSummaryResponse } = useGetNotificationSummaryQuery();
  const [markNotificationRead] = useMarkNotificationReadMutation();
  const [markAllNotificationsRead] = useMarkAllNotificationsReadMutation();
  const notifications = useMemo(
    () => (notificationPageResponse?.result.content ?? []).map((notification) => ({
      id: notification.id,
      title: notification.title,
      description: notification.description,
      occurredAt: new Date(notification.createdAt),
      read: notification.read,
      category: getNotificationCategory(notification.type),
      type: notification.type,
      hotelId: notification.hotelId,
      referenceType: notification.referenceType,
      referenceId: notification.referenceId,
    })),
    [notificationPageResponse],
  );

  const playNotificationSound = async () => {
    try {
      const AudioContextConstructor = window.AudioContext;
      if (!AudioContextConstructor) {
        throw new Error("Trình duyệt không hỗ trợ phát âm thanh thông báo.");
      }
      const audioContext = notificationAudioContextRef.current ?? new AudioContextConstructor();
      notificationAudioContextRef.current = audioContext;
      if (audioContext.state === "suspended") await audioContext.resume();

      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.16, audioContext.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.22);
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.23);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Không thể phát âm thanh thông báo.";
      toast({ variant: "destructive", title: "Không bật được âm thanh", description: message });
      return false;
    }
  };
  playNotificationSoundRef.current = () => {
    if (!notificationSoundEnabledRef.current) return;
    void playNotificationSound().then((played) => {
      if (played) return;
      notificationSoundEnabledRef.current = false;
      setIsNotificationSoundEnabled(false);
    });
  };

  const toggleNotificationSound = async () => {
    if (notificationSoundEnabledRef.current) {
      notificationSoundEnabledRef.current = false;
      setIsNotificationSoundEnabled(false);
      return;
    }
    if (await playNotificationSound()) {
      notificationSoundEnabledRef.current = true;
      setIsNotificationSoundEnabled(true);
    }
  };

  useEffect(() => {
    const addNotification = (
      _title: string,
      _description: string,
      _options: { category?: AdminNotification["category"]; hotelId?: number | null } = {},
    ) => dispatch(baseApi.util.invalidateTags(["Notification"]));
    const getHotelId = (payload: Record<string, unknown>) => {
      const hotel = getSocketPayload(payload.hotel);
      const hotelId = payload.hotelId ?? payload.hotelID ?? hotel.id ?? hotel.hotelId;
      const parsedHotelId = Number(hotelId);
      return Number.isInteger(parsedHotelId) && parsedHotelId > 0 ? parsedHotelId : null;
    };
    const unbindSuperAdminEvents = bindSuperAdminSocketEvents({
      onEmployeeChanged: () => {
        dispatch(baseApi.util.invalidateTags(["SuperAdminAccounts", "SuperAdminBranch"]));
      },
      onNotificationCreated: () => {
        playNotificationSoundRef.current();
        dispatch(baseApi.util.invalidateTags(["Notification"]));
      },
      onServiceChanged: () => {
        dispatch(baseApi.util.invalidateTags(["Notification", "Service"]));
      },
      onPromotionCreate: () => {
        dispatch(baseApi.util.invalidateTags(["Notification", "Promotion"]));
      },
      onPromotionUpdate: () => {
        dispatch(baseApi.util.invalidateTags(["Notification", "Promotion"]));
      },
      onCustomerCreated: (payload) => {
        const data = getSocketPayload(payload);
        addNotification(
          "Khách hàng mới",
          `Mã khách hàng ${getSocketText(data, "customerId", "mới")}${data.hotelId == null ? "" : ` tại khách sạn #${data.hotelId}`}.`,
          { hotelId: getHotelId(data) },
        );
        dispatch(baseApi.util.invalidateTags(["SuperAdminAccounts", "SuperAdminBranch"]));
      },
      onAccountCreated: (payload) => {
        const data = getSocketPayload(payload);
        const hotelLabel = data.hotelId == null ? "" : ` tại khách sạn #${data.hotelId}`;
        addNotification(
          "Tài khoản mới",
          `Tài khoản loại ${getSocketText(data, "accountType", "mới")}${hotelLabel} vừa được tạo.`,
          { category: String(data.accountType ?? "").toUpperCase() === "STAFF" ? "staff" : "other", hotelId: getHotelId(data) },
        );
        dispatch(baseApi.util.invalidateTags(["SuperAdminAccounts", "SuperAdminBranch"]));
      },
      onBranchCreated: (payload) => {
        const data = getSocketPayload(payload);
        const hotelLabel = data.hotelId == null ? "" : ` (khách sạn #${data.hotelId})`;
        addNotification(
          "Chi nhánh mới",
          `${getSocketText(data, "name", "Chi nhánh")}${hotelLabel} vừa được tạo.`,
          { hotelId: getHotelId(data) },
        );
        dispatch(baseApi.util.invalidateTags(["SuperAdminAccounts", "SuperAdminBranch"]));
      },
      onRoomCreated: (payload) => {
        const event = getSocketPayload(payload);
        const data = getSocketPayload(event.data);
        const hotelLabel = event.hotelId == null ? "" : ` tại khách sạn #${event.hotelId}`;
        if (event.action === "IMPORTED") {
          dispatch(baseApi.util.invalidateTags(["Room", "Booking", "SuperAdminBranch"]));
          return;
        }
        if (["CREATE", "CREATED"].includes(String(event.action ?? "").toUpperCase())) {
          const roomIdentity = data.roomId ?? data.id ?? data.roomNumber;
          if (roomIdentity !== undefined && roomIdentity !== null) {
            const now = Date.now();
            const dedupeKey = `${event.hotelId ?? ""}:${String(roomIdentity)}`;
            for (const [key, timestamp] of recentRoomCreateEventsRef.current) {
              if (now - timestamp > 5000) recentRoomCreateEventsRef.current.delete(key);
            }
            const previousEventAt = recentRoomCreateEventsRef.current.get(dedupeKey);
            if (previousEventAt !== undefined && now - previousEventAt <= 5000) {
              console.warn("[SuperAdminSocket] Ignored duplicate room_create event:", dedupeKey);
              return;
            }
            recentRoomCreateEventsRef.current.set(dedupeKey, now);
          }
        }
        const description = `Phòng ${getSocketText(data, "roomNumber", "mới")}${hotelLabel} vừa được thêm.`;
        addNotification("Phòng mới", description, { category: "room", hotelId: getHotelId(event) });
        toast({ title: "Danh sách phòng đã cập nhật", description });
        dispatch(baseApi.util.invalidateTags(["Room", "Booking", "SuperAdminBranch"]));
      },
      onRoomImportProgress: (payload) => {
        const event = getSocketPayload(payload);
        if (event.completed !== true) return;

        const hotelLabel = event.hotelId == null ? "" : ` tại khách sạn #${event.hotelId}`;
        const status = String(event.status ?? "").trim().toUpperCase();
        const failed = status !== "SUCCESS";
        const description = `${getSocketText(event, "message", failed ? "Nhập phòng thất bại." : "Nhập phòng hoàn tất.")}${hotelLabel}.`;
        addNotification(failed ? "Nhập phòng thất bại" : "Nhập phòng hoàn tất", description, { category: "room", hotelId: getHotelId(event) });
        toast({
          variant: failed ? "destructive" : "default",
          title: failed ? "Nhập phòng thất bại" : "Nhập phòng hoàn tất",
          description,
        });
        dispatch(baseApi.util.invalidateTags(["Room", "Booking", "SuperAdminBranch"]));
      },
      onServiceImportProgress: (payload) => {
        const event = getSocketPayload(payload);
        if (event.completed !== true) return;

        const hotelId = getHotelId(event);
        const status = String(event.status ?? "").trim().toUpperCase();
        const failed = status !== "SUCCESS";
        const hotelLabel = hotelId === null ? "" : ` tại khách sạn #${hotelId}`;
        const description = `${getSocketText(event, "message", failed ? "Nhập dịch vụ thất bại." : "Nhập dịch vụ hoàn tất.")}${hotelLabel}.`;
        addNotification(
          failed ? "Nhập dịch vụ thất bại" : "Nhập dịch vụ hoàn tất",
          description,
          { category: "service", hotelId },
        );
        toast({
          variant: failed ? "destructive" : "default",
          title: failed ? "Nhập dịch vụ thất bại" : "Nhập dịch vụ hoàn tất",
          description,
        });
        dispatch(baseApi.util.invalidateTags(["SuperAdminBranch"]));
      },
      onRoomUpdated: (payload) => {
        const event = getSocketPayload(payload);
        const description = formatRoomUpdateNotification(event);
        const title = isHousekeepingCompletionUpdate(event)
          ? "Phòng đã dọn xong"
          : isCheckoutCompletionUpdate(event)
            ? localizedText("Phòng vừa check-out", "Room checked out")
            : "Phòng được cập nhật";
        addNotification(title, description, { category: "room", hotelId: getHotelId(event) });
        if (!isHousekeepingCompletionUpdate(event)) {
          toast({ title, description });
        }
        dispatch(baseApi.util.invalidateTags(["Room", "Booking", "SuperAdminBranch"]));
      },
      onRoomPolicyUpdated: (payload) => {
        const event = getSocketPayload(payload);
        const data = getSocketPayload(event.data);
        const action = event.action === "CREATED" ? "được thêm mới" : "được cập nhật";
        const description = formatEntityUpdateNotification(
          event,
          `Cấu hình ${getSocketText(data, "roomType", "loại phòng")}`,
        );
        addNotification(
          `Cấu hình giá ${action}`,
          description,
          { category: "room", hotelId: getHotelId(event) },
        );
        toast({
          title: `Cấu hình giá ${action}`,
          description,
        });
        dispatch(baseApi.util.invalidateTags(["Notification", "BranchRoomPolicy", "SuperAdminBranch"]));
      },
      onBuildingChanged: (payload) => {
        const event = getSocketPayload(payload);
        const data = getSocketPayload(event.data);
        const action = event.action === "UPDATED" ? "được chỉnh sửa" : "được thêm mới";
        const description = formatEntityUpdateNotification(
          event,
          getSocketText(data, "name", "Tòa nhà"),
        );
        addNotification(
          `Tòa nhà ${action}`,
          description,
          { category: "room", hotelId: getHotelId(event) },
        );
        dispatch(baseApi.util.invalidateTags(["SuperAdminBranch"]));
        notifyBuildingFloorChange("building", payload);
      },
      onFloorChanged: (payload) => {
        const event = getSocketPayload(payload);
        const data = getSocketPayload(event.data);
        const building = getSocketPayload(data.building);
        const buildingLabel = building.name ? ` thuộc ${building.name}` : "";
        const action = event.action === "UPDATED" ? "được chỉnh sửa" : "được thêm mới";
        const floorNumber = getSocketText(data, "floorNumber", "");
        const description = formatEntityUpdateNotification(
          event,
          `Tầng ${floorNumber}${buildingLabel}`,
        );
        addNotification(
          `Tầng ${action}`,
          description,
          { category: "room", hotelId: getHotelId(event) },
        );
        dispatch(baseApi.util.invalidateTags(["SuperAdminBranch"]));
        notifyBuildingFloorChange("floor", payload);
      },
      onNewBookingNotification: (payload) => {
        const event = getSocketPayload(payload);
        const data = getSocketPayload(event.data ?? event);
        const hotelId = getHotelId(event) ?? getHotelId(data);
        const bookingId = getSocketText(data, "bookingId", getSocketText(data, "id", "mới"));
        const customerName = getSocketText(data, "customerName", "Chưa cập nhật");
        const customerPhone = getSocketText(data, "customerPhone", "Chưa cập nhật");
        const totalAmount = Number(data.totalAmount);
        const updated = String(event.action ?? data.action ?? "").toUpperCase() === "UPDATED";
        const hotelLabel = hotelId == null ? "" : ` tại khách sạn #${hotelId}`;
        const amountLabel = Number.isFinite(totalAmount) ? ` · Tổng tiền: ${formatMoney(totalAmount)}` : "";
        const updateDescription = getSocketText(data, "description", "");
        const description = updated && updateDescription
          ? updateDescription
          : `Mã booking: #${bookingId}${hotelLabel} · Khách hàng: ${customerName} · SĐT: ${customerPhone}${amountLabel}.`;
        addNotification(updated ? "Booking đã được chỉnh sửa" : "Booking mới", description, { category: "booking", hotelId });
        dispatch(baseApi.util.invalidateTags(["Booking", "Notification", "SuperAdminBranch"]));
      },
    });
    joinSuperAdminAccountsRoom();
    return unbindSuperAdminEvents;
  }, [dispatch]);
  const {
    data: branches = [],
    isLoading: isBranchesLoading,
    isError: isBranchesError,
    refetch: refetchBranches,
  } = useGetSuperAdminBranchesQuery();
  const {
    data: refundCancellations,
    isSuccess: hasLoadedRefundCancellations,
    isError: refundCancellationsError,
  } = useGetBookingCancellationsQuery(undefined);
  const {
    data: checkoutRefunds,
    isSuccess: hasLoadedCheckoutRefunds,
    isError: checkoutRefundsError,
  } = useGetCheckoutRefundsQuery(undefined);
  const pendingRefundCount = hasLoadedRefundCancellations && hasLoadedCheckoutRefunds
    ? (refundCancellations ?? []).filter((refund) =>
        refund.status === "REFUND_REVIEW_PENDING" || refund.status === "REFUND_BANK_DETAILS_REQUIRED",
      ).length + (checkoutRefunds ?? []).filter((refund) =>
        refund.status === "PENDING" || refund.status === "PAYOUT_FAILED",
      ).length
    : undefined;
  const showRefundCount = !refundCancellationsError && !checkoutRefundsError && (pendingRefundCount ?? 0) > 0;
  const [createBranch, { isLoading: isCreatingBranch }] = useCreateSuperAdminBranchMutation();
  const { data: bedTypes = [], isLoading: isBedTypesLoading, isError: isBedTypesError } = useGetAllBedTypesQuery();
  const [createBedType, { isLoading: isCreatingBedType }] = useCreateBedTypeMutation();
  const [updateBedType, { isLoading: isUpdatingBedType }] = useUpdateBedTypeMutation();
  const [importBedTypes, { isLoading: isImportingBedTypes }] = useImportBedTypesMutation();
  const {
    data: branchDetails,
    isLoading: isBranchDetailsLoading,
    isError: isBranchDetailsError,
  } = useGetSuperAdminBranchDetailsQuery(selectedBranchId ?? 0, { skip: selectedBranchId === null });

  const totalRevenue = useMemo(
    () => branches.reduce((sum, branch) => sum + (Number(branch.totalRevenue) || 0), 0),
    [branches],
  );
  const totalEmployees = useMemo(
    () => branches.reduce((sum, branch) => sum + (Number(branch.employeeCount) || 0), 0),
    [branches],
  );
  const totalBookings = useMemo(
    () => branches.reduce((sum, branch) => sum + (Number(branch.bookingCount) || 0), 0),
    [branches],
  );
  const dashboardRevenue = useMemo(
    () => branches.reduce((sum, branch) => sum + (Number(branch.totalRevenue) || 0), 0),
    [branches],
  );
  const dashboardEmployees = useMemo(
    () => branches.reduce((sum, branch) => sum + (Number(branch.employeeCount) || 0), 0),
    [branches],
  );
  const dashboardBookings = useMemo(
    () => branches.reduce((sum, branch) => sum + (Number(branch.bookingCount) || 0), 0),
    [branches],
  );
  const selectedBranchSummary = selectedBranchId === null
    ? null
    : branchDetails?.branch ?? branches.find((branch) => branch.id === selectedBranchId) ?? null;
  const summaryCards = selectedBranchSummary
    ? [
        {
          label: localizedText("Nhân sự chi nhánh", "Branch staff"),
          value: selectedBranchSummary.employeeCount.toLocaleString(i18n.language.startsWith("en") ? "en-US" : "vi-VN"),
          icon: Users,
          cardClass: "border-indigo-200",
          headerClass: "border-indigo-200 bg-indigo-100 text-indigo-800",
        },
        {
          label: localizedText("Booking chi nhánh", "Branch bookings"),
          value: selectedBranchSummary.bookingCount.toLocaleString(i18n.language.startsWith("en") ? "en-US" : "vi-VN"),
          icon: CalendarDays,
          cardClass: "border-violet-200",
          headerClass: "border-violet-200 bg-violet-100 text-violet-800",
        },
        {
          label: localizedText("Doanh thu chi nhánh", "Branch revenue"),
          value: formatMoney(Number(selectedBranchSummary.totalRevenue) || 0),
          icon: Wallet,
          cardClass: "border-emerald-200",
          headerClass: "border-emerald-200 bg-emerald-100 text-emerald-800",
        },
        {
          label: localizedText("Phòng chi nhánh", "Branch rooms"),
          value: isBranchDetailsLoading
            ? "..."
            : isBranchDetailsError
              ? "—"
              : (branchDetails?.rooms.length ?? 0).toLocaleString(i18n.language.startsWith("en") ? "en-US" : "vi-VN"),
          icon: Building2,
          cardClass: "border-blue-200",
          headerClass: "border-blue-200 bg-blue-100 text-blue-800",
        },
      ]
    : [
        {
          label: localizedText("Chi nhánh", "Branches"),
          value: isBranchesLoading ? "..." : branches.length.toLocaleString(i18n.language.startsWith("en") ? "en-US" : "vi-VN"),
          icon: Building2,
          cardClass: "border-blue-200",
          headerClass: "border-blue-200 bg-blue-100 text-blue-800",
        },
        {
          label: localizedText("Nhân sự toàn hệ thống", "Total staff"),
          value: isBranchesLoading ? "..." : totalEmployees.toLocaleString(i18n.language.startsWith("en") ? "en-US" : "vi-VN"),
          icon: Users,
          cardClass: "border-indigo-200",
          headerClass: "border-indigo-200 bg-indigo-100 text-indigo-800",
        },
        {
          label: localizedText("Tổng lượt đặt phòng", "Total bookings"),
          value: isBranchesLoading ? "..." : totalBookings.toLocaleString(i18n.language.startsWith("en") ? "en-US" : "vi-VN"),
          icon: CalendarDays,
          cardClass: "border-violet-200",
          headerClass: "border-violet-200 bg-violet-100 text-violet-800",
        },
        {
          label: localizedText("Tổng doanh thu đã thu", "Total revenue received"),
          value: isBranchesLoading ? "..." : formatMoney(totalRevenue),
          icon: Wallet,
          cardClass: "border-emerald-200",
          headerClass: "border-emerald-200 bg-emerald-100 text-emerald-800",
        },
      ];

  const submitBranch = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBranchFormError("");
    const errors: Partial<Record<BranchFormField, string>> = {};
    if (!branchForm.name.trim()) errors.name = localizedText("Vui lòng nhập tên chi nhánh.", "Enter a branch name.");
    if (!branchForm.phone.trim()) errors.phone = localizedText("Vui lòng nhập số điện thoại chi nhánh.", "Enter the branch phone number.");
    else if (!/^(0\d{9}|\+84\d{9})$/.test(branchForm.phone.trim().replace(/[\s().-]/g, ""))) {
      errors.phone = localizedText("Số điện thoại phải có 10 số và bắt đầu bằng 0 hoặc mã +84.", "The phone number must contain 10 digits and start with 0 or the +84 country code.");
    }
    if (!branchForm.address.trim()) errors.address = localizedText("Vui lòng nhập địa chỉ.", "Enter an address.");
    if (!branchForm.provinceName) errors.provinceName = localizedText("Vui lòng chọn tỉnh/thành.", "Select a province/city.");
    if (!branchForm.adminAccount.username.trim()) errors.adminUsername = localizedText("Vui lòng nhập tên tài khoản admin.", "Enter the admin account username.");
    if (!branchForm.adminAccount.password) errors.adminPassword = localizedText("Vui lòng nhập mật khẩu admin.", "Enter the admin password.");
    if (!branchForm.managerAccount.fullName.trim()) errors.managerFullName = localizedText("Vui lòng nhập họ tên quản lý.", "Enter the manager's full name.");
    if (!branchForm.managerAccount.email.trim()) errors.managerEmail = localizedText("Vui lòng nhập email quản lý.", "Enter the manager's email.");
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(branchForm.managerAccount.email.trim())) {
      errors.managerEmail = localizedText("Email không đúng định dạng.", "The email address is invalid.");
    }
    if (!branchForm.managerAccount.phone.trim()) errors.managerPhone = localizedText("Vui lòng nhập số điện thoại quản lý.", "Enter the manager's phone number.");
    else if (!/^(0\d{9}|\+84\d{9})$/.test(branchForm.managerAccount.phone.trim().replace(/[\s().-]/g, ""))) {
      errors.managerPhone = localizedText("Số điện thoại phải có 10 số và bắt đầu bằng 0 hoặc mã +84.", "The phone number must contain 10 digits and start with 0 or the +84 country code.");
    }
    if (!branchForm.managerAccount.password) errors.managerPassword = localizedText("Vui lòng nhập mật khẩu quản lý.", "Enter the manager's password.");
    setBranchFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    if (isParsingBranchPolicy) {
      setBranchPolicyError(localizedText("Đang đọc file Excel, vui lòng đợi đọc xong rồi tạo chi nhánh.", "The Excel file is still being processed. Wait for it to finish before creating the branch."));
      return;
    }
    if (branchRoomPolicies.length !== roomTypes.length) {
      setBranchPolicyError(branchPolicyFileName
        ? localizedText("File chưa được đọc đủ chính sách cho 4 loại phòng. Vui lòng kiểm tra lỗi bên trên hoặc tải lại file.", "The file does not contain policies for all 4 room types. Check the error above or upload the file again.")
        : localizedText("Vui lòng chọn file Excel có đủ chính sách cho 4 loại phòng.", "Select an Excel file containing policies for all 4 room types."));
      return;
    }
    try {
      await createBranch({ ...branchForm, roomPolicies: branchRoomPolicies }).unwrap();
      setBranchForm(initialBranchForm);
      setBranchFieldErrors({});
      setBranchRoomPolicies([]);
      setBranchPolicyFileName("");
      setBranchPolicyError("");
      setIsParsingBranchPolicy(false);
      setIsBranchFormOpen(false);
    } catch (error) {
      setBranchFormError(getErrorMessage(error, localizedText("Không thể tạo chi nhánh. Vui lòng thử lại.", "Could not create the branch. Please try again.")));
    }
  };

  const submitBedType = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBedTypeError("");
    const name = bedTypeForm.name.trim();
    if (!name) {
      setBedTypeNameError(localizedText("Vui lòng nhập tên loại giường.", "Enter a bed type name."));
      return;
    }
    setBedTypeNameError("");
    setBedTypeMessage("");
    try {
      const payload = { ...bedTypeForm, name, description: bedTypeForm.description.trim() };
      if (editingBedTypeId !== null) {
        await updateBedType({ id: editingBedTypeId, bedType: payload }).unwrap();
        setBedTypeMessage("Đã cập nhật loại giường.");
      } else {
        await createBedType(payload).unwrap();
        setBedTypeMessage("Đã thêm loại giường.");
      }
      setBedTypeForm(initialBedTypeForm);
      setEditingBedTypeId(null);
      setIsBedTypeDialogOpen(false);
    } catch (error) {
      setBedTypeError(getErrorMessage(error, localizedText("Không thể lưu loại giường.", "Could not save the bed type.")));
    }
  };

  const importBedTypeFile = async (file?: File) => {
    if (!file) return;
    setBedTypeError("");
    setBedTypeMessage("");
    setIsParsingBedTypeFile(true);
    try {
      const parsed = await parseBedTypeFile(file);
      const imported = await importBedTypes(parsed).unwrap();
      setBedTypeMessage(`Đã nhập ${imported.length} loại giường.`);
    } catch (error) {
      setBedTypeError(getErrorMessage(error, localizedText("Không thể nhập danh sách loại giường.", "Could not import the bed types.")));
    } finally {
      setIsParsingBedTypeFile(false);
    }
  };

  const navItems: { id: AdminSection; label: string; icon: typeof LayoutDashboard }[] = [
    { id: "overview", label: localizedText("Tổng quan", "Overview"), icon: LayoutDashboard },
    { id: "notifications", label: localizedText("Thông báo", "Notifications"), icon: Bell },
    { id: "refund-approvals", label: localizedText("Phê duyệt hoàn tiền", "Refund approvals"), icon: ClipboardCheck },
    { id: "branches", label: localizedText("Quản lý chi nhánh", "Branch management"), icon: Building2 },
    { id: "permissions", label: localizedText("Quản lý Role và quyền", "Roles and permissions"), icon: ShieldCheck },
    { id: "resource-stats", label: localizedText("Thống kê", "Statistics"), icon: BarChart3 },
    { id: "profile", label: localizedText("Cá nhân", "Profile"), icon: CircleUserRound },
  ];
  const isAccountSection =
    section === "accounts-overview" || section === "staff-accounts" || section === "customer-accounts";
  const isRoleSection = section === "roles" || section === "permissions";
  const isCatalogSection = section === "amenities" || section === "bed-types";
  const isSalesSection = section === "promotions" || section === "services";

  const handleAccountMenuSelect = () => {
    setSection("staff-accounts");
    setIsAccountMenuOpen(true);
    setIsRoleMenuOpen(false);
    setIsCatalogMenuOpen(false);
    setIsSalesMenuOpen(false);
    setSelectedBranchId(null);
  };

  const handleRoleMenuSelect = () => {
    setSection("roles");
    setIsRoleMenuOpen(true);
    setIsAccountMenuOpen(false);
    setIsCatalogMenuOpen(false);
    setIsSalesMenuOpen(false);
    setSelectedBranchId(null);
  };

  const handleCatalogMenuSelect = () => {
    setSection("amenities");
    setIsCatalogMenuOpen(true);
    setIsAccountMenuOpen(false);
    setIsRoleMenuOpen(false);
    setIsSalesMenuOpen(false);
    setSelectedBranchId(null);
  };

  const openBranchDetails = (branch: SuperAdminBranch) => {
    setSection("branches");
    setBranchDetailsReturnSection("branches");
    setSelectedBranchId(branch.id);
    setHighlightedDetailReference(null);
    setBranchDetailInitialCategory("employees");
  };

  const openBranchDetailsById = (
    branchId: number,
    initialCategory: BranchDetailCategory = "employees",
    returnSection: AdminSection = "branches",
  ) => {
    if (returnSection !== "notifications") setHighlightedDetailReference(null);
    const branch = branches.find((item) => item.id === branchId);
    if (branch) {
      openBranchDetails(branch);
      setBranchDetailsReturnSection(returnSection);
      setBranchDetailInitialCategory(initialCategory);
      return;
    }
    setSection("branches");
    setBranchDetailsReturnSection(returnSection);
    setSelectedBranchId(branchId);
    setBranchDetailInitialCategory(initialCategory);
  };
  const getNotificationDetailCategory = (notification: AdminNotification): BranchDetailCategory | null => {
    if (notification.type.startsWith("BOOKING_") || notification.type === "PAYMENT_RECEIVED") return "bookings";
    if (notification.type.startsWith("SERVICE_")) return "services";
    if (notification.type.startsWith("PROMOTION_")) return "promotions";
    if (notification.type.startsWith("EMPLOYEE_")) return "employees";
    if (notification.type.startsWith("ROOM_POLICY_")) return "roomPolicies";
    if (notification.type.startsWith("BUILDING_")) return "buildings";
    if (notification.type.startsWith("FLOOR_")) return "floors";
    if (notification.type.startsWith("ROOM_")) return "rooms";

    const referenceType = notification.referenceType?.trim().toLocaleUpperCase().replace(/[\s-]+/g, "_");
    const referenceCategories: Record<string, BranchDetailCategory> = {
      BOOKING: "bookings",
      BUILDING: "buildings",
      EMPLOYEE: "employees",
      FLOOR: "floors",
      PROMOTION: "promotions",
      ROOM: "rooms",
      ROOM_POLICY: "roomPolicies",
      SERVICE: "services",
    };
    return referenceType ? referenceCategories[referenceType] ?? null : null;
  };
  const openNotificationDetails = (notification: AdminNotification) => {
    const category = getNotificationDetailCategory(notification);
    if (notification.hotelId === null || category === null) return;
    openBranchDetailsById(notification.hotelId, category, "notifications");
    setHighlightedDetailReference(notification.referenceId ? { category, id: notification.referenceId } : null);
  };

  const handleMarkNotificationRead = (notificationId: number) => {
    void markNotificationRead(notificationId).unwrap().catch(() => {
      toast({ variant: "destructive", title: "Không thể cập nhật thông báo", description: "Vui lòng thử lại." });
    });
  };

  const handleMarkAllNotificationsRead = () => {
    const scope = notificationHotelId === undefined ? undefined : { hotelId: notificationHotelId };
    void markAllNotificationsRead(scope).unwrap().catch(() => {
      toast({ variant: "destructive", title: "Không thể cập nhật thông báo", description: "Vui lòng thử lại." });
    });
  };

  const notificationCategoryLabels: Record<NotificationCategoryFilter, string> = {
    all: localizedText("Tất cả", "All"),
    booking: "Booking",
    room: localizedText("Phòng", "Rooms"),
    floor: localizedText("Tầng", "Floors"),
    service: localizedText("Dịch vụ", "Services"),
    staff: localizedText("Nhân viên", "Staff"),
    promotion: localizedText("Khuyến mãi", "Promotions"),
    other: localizedText("Khác", "Other"),
  };
  const notificationCategoryStyles: Record<AdminNotification["category"], {
    card: string;
    icon: string;
    badge: string;
    tabActive: string;
    tabIdle: string;
  }> = {
    booking: {
      card: "border-violet-600 bg-violet-50/50",
      icon: "bg-violet-600 text-white",
      badge: "bg-violet-600 text-white",
      tabActive: "bg-violet-600 text-white ring-violet-200",
      tabIdle: "bg-violet-50 text-violet-700 hover:bg-violet-100",
    },
    room: {
      card: "border-sky-600 bg-sky-50/50",
      icon: "bg-sky-600 text-white",
      badge: "bg-sky-600 text-white",
      tabActive: "bg-sky-600 text-white ring-sky-200",
      tabIdle: "bg-sky-50 text-sky-700 hover:bg-sky-100",
    },
    floor: {
      card: "border-indigo-600 bg-indigo-50/50",
      icon: "bg-indigo-600 text-white",
      badge: "bg-indigo-600 text-white",
      tabActive: "bg-indigo-600 text-white ring-indigo-200",
      tabIdle: "bg-indigo-50 text-indigo-700 hover:bg-indigo-100",
    },
    service: {
      card: "border-amber-500 bg-amber-50/50",
      icon: "bg-amber-500 text-white",
      badge: "bg-amber-500 text-white",
      tabActive: "bg-amber-500 text-white ring-amber-200",
      tabIdle: "bg-amber-50 text-amber-800 hover:bg-amber-100",
    },
    staff: {
      card: "border-emerald-600 bg-emerald-50/50",
      icon: "bg-emerald-600 text-white",
      badge: "bg-emerald-600 text-white",
      tabActive: "bg-emerald-600 text-white ring-emerald-200",
      tabIdle: "bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
    },
    promotion: {
      card: "border-rose-600 bg-rose-50/50",
      icon: "bg-rose-600 text-white",
      badge: "bg-rose-600 text-white",
      tabActive: "bg-rose-600 text-white ring-rose-200",
      tabIdle: "bg-rose-50 text-rose-700 hover:bg-rose-100",
    },
    other: {
      card: "border-slate-600 bg-slate-50/50",
      icon: "bg-slate-600 text-white",
      badge: "bg-slate-600 text-white",
      tabActive: "bg-slate-600 text-white ring-slate-200",
      tabIdle: "bg-slate-100 text-slate-700 hover:bg-slate-200",
    },
  };
  const allNotificationFilterStyle = {
    active: "bg-blue-600 text-white ring-blue-200",
    idle: "bg-blue-50 text-blue-700 hover:bg-blue-100",
  };
  const notificationCountForCategory = (category: NotificationCategoryFilter) => {
    const summary = notificationSummaryResponse?.result;
    if (!summary) return 0;
    if (category === "all") return summary.totalCount;
    return Object.entries(summary.totalByType).reduce((count, [type, total]) =>
      getNotificationCategory(type as NotificationRecord["type"]) === category ? count + total : count, 0);
  };
  const selectedNotificationBranch = branches.find((branch) => String(branch.id) === notificationBranchFilter);
  const selectedNotificationBranchCounts = selectedNotificationBranch
    ? allNotificationsSummaryResponse?.result.branches.find((item) => item.hotelId === selectedNotificationBranch.id)
    : undefined;
  const selectedNotificationBranchLabel = selectedNotificationBranch
    ? `${selectedNotificationBranch.name} (${selectedNotificationBranchCounts?.readCount ?? 0} đã đọc / ${selectedNotificationBranchCounts?.unreadCount ?? 0} chưa đọc)`
    : "Tất cả chi nhánh";
  const filteredNotifications = notifications.filter((notification) =>
    (notificationCategoryFilter === "all" || notification.category === notificationCategoryFilter)
    && (notificationBranchFilter === "all" || String(notification.hotelId ?? "") === notificationBranchFilter),
  );
  const notificationTotalPages = Math.max(1, Math.ceil(filteredNotifications.length / notificationPageSize));
  const safeNotificationPage = Math.min(notificationListPage, notificationTotalPages);
  const paginatedNotifications = filteredNotifications.slice(
    (safeNotificationPage - 1) * notificationPageSize,
    safeNotificationPage * notificationPageSize,
  );
  useEffect(() => {
    setNotificationListPage(1);
  }, [notificationCategoryFilter, notificationBranchFilter]);
  useEffect(() => {
    if (notificationListPage > notificationTotalPages) setNotificationListPage(notificationTotalPages);
  }, [notificationListPage, notificationTotalPages]);
  const getNotificationBranch = (notification: AdminNotification) =>
    notification.hotelId === null
      ? undefined
      : branches.find((branch) => branch.id === notification.hotelId);
  const getNotificationDescription = (notification: AdminNotification) => {
    const branch = getNotificationBranch(notification);
    return branch
      ? notification.description.split(`khách sạn #${notification.hotelId}`).join(`khách sạn ${branch.name}`)
      : notification.description;
  };

  const handleSectionSelect = (id: AdminSection) => {
    if (id === "branches") {
      setIsAccountMenuOpen(false);
      setIsRoleMenuOpen(false);
      setIsCatalogMenuOpen(false);
      setIsSalesMenuOpen(false);
      setSection("branches");
      setSelectedBranchId(null);
      return;
    }
    if (id === "staff-accounts" || id === "customer-accounts" || id === "accounts-overview") {
      setIsAccountMenuOpen(true);
    } else {
      setIsAccountMenuOpen(false);
    }
    if (id === "roles" || id === "permissions") {
      setIsRoleMenuOpen(true);
    } else {
      setIsRoleMenuOpen(false);
    }
    if (id === "amenities" || id === "bed-types") {
      setIsCatalogMenuOpen(true);
    } else {
      setIsCatalogMenuOpen(false);
    }
    if (id === "promotions" || id === "services") {
      setIsSalesMenuOpen(true);
    } else {
      setIsSalesMenuOpen(false);
    }
    setSection(id);
    setSelectedBranchId(null);
  };

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [section]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      {isSidebarOpen && <aside className="fixed inset-y-0 left-0 z-30 hidden w-80 flex-col bg-slate-950 px-4 py-6 text-white lg:flex">
        <div className="flex items-center justify-between gap-3 px-2">
          <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-500 text-white shadow-lg shadow-blue-950/40">
            <ShieldCheck size={22} />
          </span>
          <div>
            <p className="font-bold tracking-wide">SEN VIET</p>
            <p className="mt-0.5 text-xs text-slate-400">{localizedText("Quản trị hệ thống", "System administration")}</p>
          </div>
          </div>
          <button
            type="button"
            onClick={() => setIsSidebarOpen(false)}
            aria-label={localizedText("Thu gọn menu", "Collapse menu")}
            title={localizedText("Thu gọn menu", "Collapse menu")}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-white/10 hover:text-white"
          >
            <PanelLeftClose size={18} />
          </button>
        </div>

        <nav className="mt-12 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1" aria-label={localizedText("Điều hướng quản trị", "Admin navigation")}>
          {navItems.map(({ id, label, icon: Icon }) => (
            <div key={id}>
              {id === "permissions" && (
                <div className="mb-1">
                  <div className={`flex w-full items-center rounded-xl text-sm font-semibold transition ${
                    isCatalogSection ? "bg-blue-600 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"
                  }`}>
                    <button
                      type="button"
                      onClick={handleCatalogMenuSelect}
                      className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left"
                    >
                      <Layers size={18} />
                      <span className="flex-1 whitespace-nowrap">{localizedText("Quản lý danh mục", "Catalog management")}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsCatalogMenuOpen((isOpen) => !isOpen)}
                      aria-label={isCatalogMenuOpen ? localizedText("Thu gọn menu danh mục", "Collapse catalog menu") : localizedText("Mở menu danh mục", "Open catalog menu")}
                      aria-expanded={isCatalogMenuOpen}
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-lg hover:bg-white/10"
                    >
                      {isCatalogMenuOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>
                  </div>
                  {isCatalogMenuOpen && (
                    <div className="ml-6 mt-1 space-y-1 border-l border-slate-700 pl-3">
                      {([
                        { id: "amenities", label: localizedText("Tiện ích", "Amenities") },
                        { id: "bed-types", label: localizedText("Loại giường", "Bed types") },
                      ] as const).map(({ id: childId, label: childLabel }) => (
                        <button
                          key={childId}
                          type="button"
                          onClick={() => handleSectionSelect(childId)}
                          className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                            section === childId ? "bg-blue-500/15 font-semibold text-blue-300" : "text-slate-400 hover:bg-white/5 hover:text-white"
                          }`}
                        >
                          {childLabel}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {id === "permissions" && (
                <div className="mb-1">
                  <div className={`flex w-full items-center rounded-xl text-sm font-semibold transition ${
                    isRoleSection ? "bg-blue-600 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"
                  }`}>
                    <button
                      type="button"
                      onClick={handleRoleMenuSelect}
                      className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left"
                    >
                      <ShieldCheck size={18} />
                      <span className="flex-1 whitespace-nowrap">{localizedText("Quản lý Role và quyền", "Roles and permissions")}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsRoleMenuOpen((isOpen) => !isOpen)}
                      aria-label={isRoleMenuOpen ? localizedText("Thu gọn menu vai trò và quyền", "Collapse roles and permissions menu") : localizedText("Mở menu vai trò và quyền", "Open roles and permissions menu")}
                      aria-expanded={isRoleMenuOpen}
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-lg hover:bg-white/10"
                    >
                      {isRoleMenuOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>
                  </div>
                  {isRoleMenuOpen && (
                    <div className="ml-6 mt-1 space-y-1 border-l border-slate-700 pl-3">
                      {([
                        { id: "roles", label: localizedText("Quản lý vai trò", "Manage roles") },
                        { id: "permissions", label: localizedText("Quản lý quyền", "Manage permissions") },
                      ] as const).map(({ id: childId, label: childLabel }) => (
                        <button
                          key={childId}
                          type="button"
                          onClick={() => handleSectionSelect(childId)}
                          className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                            section === childId ? "bg-blue-500/15 font-semibold text-blue-300" : "text-slate-400 hover:bg-white/5 hover:text-white"
                          }`}
                        >
                          {childLabel}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {id === "resource-stats" && (
                <div className="mb-1">
                  <button
                    type="button"
                    onClick={() => setIsSalesMenuOpen((isOpen) => !isOpen)}
                    aria-expanded={isSalesMenuOpen}
                    className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold transition ${
                      isSalesSection ? "bg-blue-600 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <ConciergeBell size={18} />
                    <span className="flex-1 whitespace-nowrap">{localizedText("Quản lý kinh doanh", "Business management")}</span>
                    {isSalesMenuOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>
                  {isSalesMenuOpen && (
                    <div className="ml-6 mt-1 space-y-1 border-l border-slate-700 pl-3">
                      {([
                        { id: "promotions", label: localizedText("Khuyến mãi", "Promotions") },
                        { id: "services", label: localizedText("Dịch vụ", "Services") },
                      ] as const).map(({ id: childId, label: childLabel }) => (
                        <button
                          key={childId}
                          type="button"
                          onClick={() => handleSectionSelect(childId)}
                          className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                            section === childId ? "bg-blue-500/15 font-semibold text-blue-300" : "text-slate-400 hover:bg-white/5 hover:text-white"
                          }`}
                        >
                          {childLabel}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {id !== "permissions" && <button
                type="button"
                onClick={() => handleSectionSelect(id)}
                className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold transition ${
                  section === id ? "bg-blue-600 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon size={18} />
                <span className="flex-1 whitespace-nowrap">{label}</span>
                {id === "notifications" && (allNotificationsSummaryResponse?.result.unreadCount ?? 0) > 0 && (
                  <span className="rounded-full bg-rose-500 px-2 py-0.5 text-xs text-white">
                    {allNotificationsSummaryResponse?.result.unreadCount}
                  </span>
                )}
                {id === "refund-approvals" && showRefundCount && (
                  <span className="rounded-full bg-amber-400 px-2 py-0.5 text-xs font-bold text-amber-950">
                    {pendingRefundCount}
                  </span>
                )}
              </button>}
            </div>
          ))}
          <div>
            <div className={`flex w-full items-center rounded-xl text-sm font-semibold transition ${
              isAccountSection ? "bg-blue-600 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"
            }`}>
              <button
                type="button"
                onClick={handleAccountMenuSelect}
                className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left"
              >
                <CircleUserRound size={18} />
                <span className="flex-1 whitespace-nowrap">{localizedText("Quản lý tài khoản", "Account management")}</span>
              </button>
              <button
                type="button"
                onClick={() => setIsAccountMenuOpen((isOpen) => !isOpen)}
                aria-label={isAccountMenuOpen ? "Thu gọn menu tài khoản" : "Mở menu tài khoản"}
                aria-expanded={isAccountMenuOpen}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-lg hover:bg-white/10"
              >
                {isAccountMenuOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
            </div>
            {isAccountMenuOpen && (
              <div className="ml-6 mt-1 space-y-1 border-l border-slate-700 pl-3">
                {([
                  { id: "staff-accounts", label: localizedText("Tài khoản nhân sự", "Staff accounts") },
                  { id: "customer-accounts", label: localizedText("Tài khoản khách hàng", "Customer accounts") },
                ] as const).map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => handleSectionSelect(id)}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                      section === id ? "bg-blue-500/15 font-semibold text-blue-300" : "text-slate-400 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </nav>

        <button type="button" onClick={onLogout} className="mt-4 flex shrink-0 items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-slate-400 transition hover:bg-white/5 hover:text-white">
          <LogOut size={18} />
          {localizedText("Đăng xuất", "Sign out")}
        </button>
      </aside>}

      <main className={`min-h-screen ${isSidebarOpen ? "lg:pl-80" : ""}`}>
        <header className="flex min-h-20 items-center justify-between border-b border-slate-200 bg-white px-5 sm:px-8">
          <div className="flex items-center gap-3 lg:hidden">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-600 text-white"><ShieldCheck size={20} /></span>
            <div>
              <p className="text-sm font-bold text-slate-900">SEN VIET</p>
              <p className="text-xs text-slate-500">{localizedText("Quản trị hệ thống", "System administration")}</p>
            </div>
          </div>
          <div className="hidden items-center gap-3 lg:flex">
            {!isSidebarOpen && (
              <button
                type="button"
                onClick={() => setIsSidebarOpen(true)}
                aria-label={localizedText("Mở menu", "Open menu")}
                title={localizedText("Mở menu", "Open menu")}
                className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
              >
                <PanelLeftOpen size={18} />
              </button>
            )}
            <p className="text-sm font-semibold text-slate-500">{localizedText("Cổng quản trị toàn hệ thống", "System administration portal")}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-1" aria-label={localizedText("Chọn ngôn ngữ", "Choose language")}>
              {(["vi", "en"] as const).map((language) => (
                <button
                  key={language}
                  type="button"
                  aria-pressed={i18n.language.startsWith(language)}
                  onClick={() => {
                    void i18n.changeLanguage(language);
                    localStorage.setItem("language", language);
                  }}
                  className={`rounded-md px-2.5 py-1.5 text-xs font-bold transition ${
                    i18n.language.startsWith(language)
                      ? "bg-white text-blue-700 shadow-sm"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  {language === "vi" ? "VI" : "EN"}
                </button>
              ))}
            </div>
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-slate-800">{fullName || localizedText("Quản trị viên", "Administrator")}</p>
              <p className="text-xs text-slate-500">{email || "ROLE_SUPER_ADMIN"}</p>
            </div>
            <span className="grid h-10 w-10 place-items-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
              {(fullName || email || "A").slice(0, 1).toLocaleUpperCase()}
            </span>
            <button type="button" onClick={onLogout} aria-label={localizedText("Đăng xuất", "Sign out")} title={localizedText("Đăng xuất", "Sign out")} className="grid h-10 w-10 place-items-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 lg:hidden">
              <LogOut size={18} />
            </button>
          </div>
        </header>
        <nav className="flex gap-2 overflow-x-auto border-b border-slate-200 bg-white px-4 py-2 lg:hidden" aria-label={localizedText("Điều hướng quản trị", "Admin navigation")}>
          {navItems.map(({ id, label, icon: Icon }) => id === "permissions" ? (
            <div key={id} className={`flex shrink-0 items-center rounded-lg text-xs font-semibold ${
              isRoleSection ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"
            }`}>
              <button type="button" onClick={handleRoleMenuSelect} className="flex items-center gap-2 py-2 pl-3">
                <Icon size={15} />
                {localizedText("Quản lý Role và quyền", "Roles and permissions")}
              </button>
              <button
                type="button"
                onClick={() => setIsRoleMenuOpen((isOpen) => !isOpen)}
                aria-label={isRoleMenuOpen ? localizedText("Thu gọn menu vai trò và quyền", "Collapse roles and permissions menu") : localizedText("Mở menu vai trò và quyền", "Open roles and permissions menu")}
                aria-expanded={isRoleMenuOpen}
                className="grid h-9 w-8 place-items-center rounded-r-lg"
              >
                {isRoleMenuOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
            </div>
          ) : (
            <button
              type="button"
              key={id}
              onClick={() => handleSectionSelect(id)}
              className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold ${
                section === id ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Icon size={15} />
              {label}
              {id === "notifications" && notifications.some((notification) => !notification.read) && (
                <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] text-white">
                  {notifications.filter((notification) => !notification.read).length}
                </span>
              )}
              {id === "refund-approvals" && showRefundCount && (
                <span className="rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold text-amber-950">
                  {pendingRefundCount}
                </span>
              )}
            </button>
          ))}
          <div className={`flex shrink-0 items-center rounded-lg text-xs font-semibold ${
            isCatalogSection ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"
          }`}>
            <button type="button" onClick={handleCatalogMenuSelect} className="flex items-center gap-2 py-2 pl-3">
              <Layers size={15} />
              {localizedText("Quản lý danh mục", "Catalog management")}
            </button>
            <button
              type="button"
              onClick={() => setIsCatalogMenuOpen((isOpen) => !isOpen)}
              aria-label={isCatalogMenuOpen ? "Thu gọn menu danh mục" : "Mở menu danh mục"}
              aria-expanded={isCatalogMenuOpen}
              className="grid h-9 w-8 place-items-center rounded-r-lg"
            >
              {isCatalogMenuOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          </div>
          <button
            type="button"
            onClick={() => setIsSalesMenuOpen((isOpen) => !isOpen)}
            aria-expanded={isSalesMenuOpen}
            className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold ${
              isSalesSection ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <ConciergeBell size={15} />
            {localizedText("Quản lý kinh doanh", "Business management")}
            {isSalesMenuOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
          <div className={`flex shrink-0 items-center rounded-lg text-xs font-semibold ${
            isAccountSection ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"
          }`}>
            <button type="button" onClick={handleAccountMenuSelect} className="flex items-center gap-2 py-2 pl-3">
              <CircleUserRound size={15} />
              {localizedText("Quản lý tài khoản", "Account management")}
            </button>
            <button
              type="button"
              onClick={() => setIsAccountMenuOpen((isOpen) => !isOpen)}
              aria-label={isAccountMenuOpen ? "Thu gọn menu tài khoản" : "Mở menu tài khoản"}
              aria-expanded={isAccountMenuOpen}
              className="grid h-9 w-8 place-items-center rounded-r-lg"
            >
              {isAccountMenuOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          </div>
        </nav>
        {isCatalogMenuOpen && (
          <nav className="flex gap-2 overflow-x-auto border-b border-slate-200 bg-slate-50 px-4 py-2 lg:hidden" aria-label={localizedText("Quản lý danh mục", "Catalog management")}>
            {([
              { id: "amenities", label: localizedText("Tiện ích", "Amenities") },
              { id: "bed-types", label: localizedText("Loại giường", "Bed types") },
            ] as const).map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => handleSectionSelect(id)}
                className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold ${
                  section === id ? "bg-blue-100 text-blue-700" : "text-slate-600 hover:bg-white"
                }`}
              >
                {label}
              </button>
            ))}
          </nav>
        )}
        {isRoleMenuOpen && (
          <nav className="flex gap-2 overflow-x-auto border-b border-slate-200 bg-slate-50 px-4 py-2 lg:hidden" aria-label={localizedText("Quản lý Role và quyền", "Roles and permissions")}>
            {([
              { id: "roles", label: localizedText("Quản lý vai trò", "Manage roles") },
              { id: "permissions", label: localizedText("Quản lý quyền", "Manage permissions") },
            ] as const).map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => handleSectionSelect(id)}
                className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold ${
                  section === id ? "bg-blue-100 text-blue-700" : "text-slate-600 hover:bg-white"
                }`}
              >
                {label}
              </button>
            ))}
          </nav>
        )}
        {isSalesMenuOpen && (
          <nav className="flex gap-2 overflow-x-auto border-b border-slate-200 bg-slate-50 px-4 py-2 lg:hidden" aria-label={localizedText("Quản lý kinh doanh", "Business management")}>
            {([
              { id: "promotions", label: localizedText("Khuyến mãi", "Promotions") },
              { id: "services", label: localizedText("Dịch vụ", "Services") },
            ] as const).map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => handleSectionSelect(id)}
                className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold ${
                  section === id ? "bg-blue-100 text-blue-700" : "text-slate-600 hover:bg-white"
                }`}
              >
                {label}
              </button>
            ))}
          </nav>
        )}
        {isAccountMenuOpen && (
          <nav className="flex gap-2 overflow-x-auto border-b border-slate-200 bg-slate-50 px-4 py-2 lg:hidden" aria-label={localizedText("Quản lý tài khoản", "Account management")}>
            {([
              { id: "staff-accounts", label: localizedText("Tài khoản nhân sự", "Staff accounts") },
              { id: "customer-accounts", label: localizedText("Tài khoản khách hàng", "Customer accounts") },
            ] as const).map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => handleSectionSelect(id)}
                className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold ${
                  section === id ? "bg-blue-100 text-blue-700" : "text-slate-600 hover:bg-white"
                }`}
              >
                {label}
              </button>
            ))}
          </nav>
        )}
        <div className="relative isolate min-h-[calc(100vh-5rem)]">
          <div className={`relative z-10 pt-4 pb-8 sm:pt-5 sm:pb-10 ${
            section === "resource-stats" && !isSidebarOpen
              ? "w-full max-w-none px-3 sm:px-5"
              : "mx-auto max-w-7xl px-5 sm:px-8"
          }`}>
          {section === "profile" && <SuperAdminProfileSettings onLogout={onLogout} />}
          {section === "notifications" && (
            <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold tracking-tight text-slate-900">{localizedText("Thông báo hệ thống", "System notifications")}</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {localizedText("Thông báo được lưu lại và đồng bộ realtime giữa các phiên đăng nhập.", "Notifications are saved and synchronized in real time across login sessions.")}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                      <CheckCheck size={13} />
                      {notificationSummaryResponse?.result.readCount ?? 0} {localizedText("đã đọc", "read")}
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                      {notificationSummaryResponse?.result.unreadCount ?? 0} {localizedText("chưa đọc", "unread")}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void toggleNotificationSound()}
                  aria-pressed={isNotificationSoundEnabled}
                  className={`inline-flex h-10 items-center gap-2 rounded-xl border px-3.5 text-sm font-semibold transition ${
                    isNotificationSoundEnabled
                      ? "border-blue-200 bg-blue-50 text-blue-700"
                      : "border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {isNotificationSoundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                  {localizedText("Âm thanh", "Sound")} {isNotificationSoundEnabled ? localizedText("đang bật", "on") : localizedText("đang tắt", "off")}
                </button>
              </div>

              <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50/70 p-3 sm:p-4">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5">
                  <span className="mr-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">{localizedText("Loại thông báo", "Notification type")}</span>
                  {(Object.keys(notificationCategoryLabels) as NotificationCategoryFilter[]).map((category) => (
                    <button
                      key={category}
                      type="button"
                      aria-pressed={notificationCategoryFilter === category}
                      onClick={() => setNotificationCategoryFilter(category)}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-inset transition ${
                        category === "all"
                          ? notificationCategoryFilter === category
                            ? `${allNotificationFilterStyle.active} ring-current/20`
                            : `${allNotificationFilterStyle.idle} ring-transparent`
                          : notificationCategoryFilter === category
                            ? `${notificationCategoryStyles[category].tabActive} ring-current/20`
                            : `${notificationCategoryStyles[category].tabIdle} ring-transparent`
                      }`}
                    >
                      {notificationCategoryLabels[category]}
                      <span className={`ml-1.5 inline-flex min-w-5 justify-center rounded-full px-1.5 py-0.5 text-[10px] leading-none ${
                        notificationCategoryFilter === category ? "bg-white/20" : "bg-black/5"
                      }`}>
                        {notificationCountForCategory(category)}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="mt-3 flex flex-col gap-2 border-t border-slate-200/80 pt-3 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={handleMarkAllNotificationsRead}
                  disabled={(notificationSummaryResponse?.result.unreadCount ?? 0) === 0}
                  className="inline-flex h-9 w-fit items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-slate-200 disabled:hover:bg-white disabled:hover:text-slate-700"
                >
                  <CheckCheck size={15} />
                  {localizedText("Đánh dấu tất cả đã đọc", "Mark all as read")}
                </button>
                <label className="flex w-full items-center gap-2 text-xs font-semibold text-slate-500 sm:w-auto">
                  <span className="shrink-0">{localizedText("Chi nhánh", "Branch")}</span>
                  <select
                    value={notificationBranchFilter}
                    onChange={(event) => setNotificationBranchFilter(event.target.value)}
                    title={selectedNotificationBranchLabel}
                    className="h-9 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 sm:w-[27rem] sm:flex-none"
                  >
                    <option value="all">{localizedText("Tất cả chi nhánh", "All branches")}</option>
                    {branches.map((branch) => {
                      const counts = allNotificationsSummaryResponse?.result.branches.find(
                        (item) => item.hotelId === branch.id,
                      );
                      return (
                        <option key={branch.id} value={String(branch.id)}>
                          {branch.name} ({counts?.readCount ?? 0} {localizedText("đã đọc", "read")} / {counts?.unreadCount ?? 0} {localizedText("chưa đọc", "unread")})
                        </option>
                      );
                    })}
                  </select>
                </label>
                </div>
              </div>

              {isNotificationsError ? (
                <div role="alert" className="mt-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-12 text-center text-sm text-rose-700">
                  {localizedText("Không thể tải thông báo. Vui lòng thử lại sau.", "Unable to load notifications. Please try again later.")}
                </div>
              ) : isNotificationsLoading ? (
                <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 px-4 py-12 text-center text-sm text-slate-500">
                  {localizedText("Đang tải thông báo...", "Loading notifications...")}
                </div>
              ) : filteredNotifications.length === 0 ? (
                <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-12 text-center">
                  <Bell size={24} className="mx-auto text-slate-400" />
                  <p className="mt-3 text-sm font-semibold text-slate-700">{notifications.length === 0 ? localizedText("Chưa có thông báo", "No notifications yet") : localizedText("Không có thông báo phù hợp", "No matching notifications")}</p>
                  <p className="mt-1 text-sm text-slate-500">{notifications.length === 0 ? localizedText("Thông báo sẽ xuất hiện tại đây khi có sự kiện mới.", "Notifications will appear here when new events occur.") : localizedText("Thử chọn loại thông báo hoặc chi nhánh khác.", "Try selecting another notification type or branch.")}</p>
                </div>
              ) : (
                <div className="mt-5 flex flex-col gap-3">
                  {paginatedNotifications.map((notification) => (
                    <article
                      key={notification.id}
                      className={`grid grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-xl border border-l-4 p-4 shadow-sm transition-shadow hover:shadow-md sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:gap-4 ${notificationCategoryStyles[notification.category].card}`}
                    >
                      <span className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full ${notificationCategoryStyles[notification.category].icon}`}>
                        <Bell size={16} />
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className={`break-words text-sm text-slate-900 ${notification.read ? "font-medium" : "font-bold"}`}>{notification.title}</h3>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${notificationCategoryStyles[notification.category].badge}`}>
                            {notificationCategoryLabels[notification.category]}
                          </span>
                          {!notification.read && <span className="h-2 w-2 rounded-full bg-blue-600" aria-label="Chưa đọc" />}
                        </div>
                        <p className="mt-1 break-words text-sm leading-6 text-slate-700">{getNotificationDescription(notification)}</p>
                        {notification.hotelId !== null && getNotificationDetailCategory(notification) !== null && (
                          <p className="mt-2 text-xs text-slate-500">
                            Chi nhánh: <span className="font-semibold text-slate-700">{getNotificationBranch(notification)?.name ?? `#${notification.hotelId}`}</span>
                          </p>
                        )}
                        <time className="mt-2 block text-xs text-slate-500 sm:hidden" dateTime={notification.occurredAt.toISOString()}>
                          {notification.occurredAt.toLocaleString("vi-VN")}
                        </time>
                      </div>
                      <div className="col-start-2 flex flex-wrap items-center gap-2 sm:col-start-auto sm:flex-col sm:items-end sm:justify-between">
                        <time className="hidden text-xs text-slate-500 sm:block" dateTime={notification.occurredAt.toISOString()}>
                          {notification.occurredAt.toLocaleString("vi-VN")}
                        </time>
                        {notification.hotelId !== null && (
                          <button
                            type="button"
                            onClick={() => openNotificationDetails(notification)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white/80 px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:border-blue-200 hover:bg-blue-50"
                          >
                            <Eye size={14} />
                            Chi tiết
                          </button>
                        )}
                        {!notification.read && (
                          <button
                            type="button"
                            onClick={() => handleMarkNotificationRead(notification.id)}
                            className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50"
                          >
                            Đánh dấu đã đọc
                          </button>
                        )}
                      </div>
                    </article>
                  ))}
                  <ListPagination
                    totalItems={filteredNotifications.length}
                    page={safeNotificationPage}
                    pageSize={notificationPageSize}
                    mode="table"
                    onPageChange={setNotificationListPage}
                    onPageSizeChange={setNotificationPageSize}
                  />
                </div>
              )}
            </section>
          )}

          {section !== "amenities" &&
            section !== "bed-types" &&
            section !== "roles" &&
            section !== "permissions" &&
            section !== "resource-stats" &&
            section !== "notifications" &&
            section !== "refund-approvals" &&
            section !== "profile" &&
            section !== "promotions" &&
            section !== "services" &&
            section !== "accounts-overview" &&
            section !== "staff-accounts" &&
            section !== "customer-accounts" && (
            <>
              {isBranchesError && (
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  <span>Không thể tải dữ liệu tổng quan. Hãy kiểm tra kết nối BE và quyền ROLE_SUPER_ADMIN.</span>
                  <button type="button" onClick={() => void refetchBranches()} className="font-semibold underline">Thử tải lại</button>
                </div>
              )}
              <section
                className="mt-0 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
                aria-label={selectedBranchSummary ? `Thống kê ${selectedBranchSummary.name}` : "Thống kê toàn hệ thống"}
              >
                {summaryCards.map(({ label, value, icon: Icon, cardClass, headerClass }) => (
                  <article key={label} className={`overflow-hidden rounded-xl border ${cardClass} bg-white shadow-sm`}>
                    <h2 className={`flex min-h-12 items-center gap-2 border-b px-5 py-3 text-xs font-semibold ${headerClass}`}>
                      <Icon size={15} />
                      {label}
                    </h2>
                    <p className="px-5 py-4 text-xl font-bold tracking-tight text-slate-900">{value}</p>
                  </article>
                ))}
              </section>
            </>
          )}

          {section === "refund-approvals" && <RefundApprovalWorkspace branches={branches} />}

          {section === "overview" && (
            <>
              <SuperAdminProvinceMapPanel branches={branches} isLoading={isBranchesLoading} />
              <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">{localizedText("Chi nhánh", "Branches")}</h2>
                    <p className="mt-1 text-sm text-slate-500">{localizedText("Tổng doanh thu tính theo số tiền đã thanh toán ở tất cả booking.", "Total revenue is calculated from amounts paid across all bookings.")}</p>
                  </div>
                  <button type="button" onClick={() => handleSectionSelect("branches")} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">{localizedText("Xem danh sách", "View list")}</button>
                </div>
                <BranchList branches={branches.slice(0, 5)} isLoading={isBranchesLoading} onSelect={openBranchDetailsById} />
              </section>
            </>
          )}

          {section === "branches" && selectedBranchId !== null && (
            <BranchDetailsPanel
              key={`${selectedBranchId}:${branchDetailInitialCategory}`}
              details={branchDetails}
              isLoading={isBranchDetailsLoading}
              isError={isBranchDetailsError}
              initialCategory={branchDetailInitialCategory}
              highlightedDetailReference={highlightedDetailReference}
              backLabel={branchDetailsReturnSection === "notifications" ? localizedText("Quay lại trang thông báo", "Back to notifications") : localizedText("Quay lại danh sách chi nhánh", "Back to branch list")}
              onBack={() => {
                setSelectedBranchId(null);
                setSection(branchDetailsReturnSection);
              }}
            />
          )}

          {section === "branches" && selectedBranchId === null && (
            <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">{localizedText("Danh sách chi nhánh", "Branch list")}</h2>
                  <p className="mt-1 text-sm text-slate-500">{localizedText("Xem doanh thu, nhân viên, booking hoặc tạo chi nhánh mới.", "View revenue, staff, bookings, or create a new branch.")}</p>
                </div>
                <button type="button" onClick={() => { setBranchFormError(""); setBranchFieldErrors({}); setIsBranchFormOpen(true); }} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700">
                  <Plus size={16} /> {localizedText("Thêm chi nhánh", "Add branch")}
                </button>
              </div>
              <BranchList
                branches={branches}
                isLoading={isBranchesLoading}
                onSelect={openBranchDetailsById}
              />
            </section>
          )}

          {section === "amenities" && <SuperAdminAmenitiesPanel />}

          {section === "bed-types" && (
            <section className="mt-4 space-y-5">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">{localizedText("Danh sách loại giường", "Bed type list")}</h2>
                    <p className="mt-1 text-sm text-slate-500">{localizedText("Danh mục loại giường dùng chung để chọn khi cấu hình phòng.", "Shared bed types available when configuring rooms.")}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">{bedTypes.length} {localizedText("loại", "types")}</span>
                    <button type="button" onClick={() => { setBedTypeDialogMode("manual"); setBedTypeError(""); setBedTypeNameError(""); setBedTypeMessage(""); setIsBedTypeDialogOpen(true); }} className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-blue-700">
                      <Plus size={16} /> {localizedText("Thêm loại giường", "Add bed type")}
                    </button>
                  </div>
                </div>
                {isBedTypesLoading ? <p className="py-8 text-center text-sm text-slate-500">{localizedText("Đang tải danh sách...", "Loading list...")}</p>
                  : isBedTypesError ? <p className="py-8 text-center text-sm text-rose-600">{localizedText("Không thể tải danh sách loại giường.", "Could not load bed types.")}</p>
                    : bedTypes.length === 0 ? <p className="mt-4 rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">{localizedText("Chưa có loại giường nào.", "No bed types yet.")}</p>
                      : <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
                        <table className="w-full min-w-[560px] text-left text-sm">
                          <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                            <tr>
                              <th scope="col" className="px-4 py-3">STT</th>
                              <th className="px-4 py-3">{localizedText("Tên loại giường", "Bed type name")}</th>
                              <th className="px-4 py-3">{localizedText("Mô tả", "Description")}</th>
                              <th className="px-4 py-3">{localizedText("Phân loại", "Category")}</th>
                              <th className="px-4 py-3 text-right">{localizedText("Thao tác", "Actions")}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {bedTypes.map((bedType, index) => (
                              <tr key={bedType.id} className="text-slate-700 transition hover:bg-slate-50/70">
                                <td className="px-4 py-3.5 tabular-nums text-slate-500">{index + 1}</td>
                                <td className="px-4 py-3.5 font-semibold text-slate-900">{bedType.name}</td>
                                <td className="px-4 py-3.5 text-slate-500">{bedType.description || localizedText("Không có mô tả", "No description")}</td>
                                <td className="px-4 py-3.5">
                                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${bedType.isExtraBed ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-700"}`}>
                                    {bedType.isExtraBed ? localizedText("Giường phụ", "Extra bed") : localizedText("Giường thường", "Standard bed")}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <button
                                    type="button"
                                    aria-label={localizedText(`Chỉnh sửa ${bedType.name}`, `Edit ${bedType.name}`)}
                                    disabled={bedType.id == null}
                                    onClick={() => {
                                      if (bedType.id == null) return;
                                      setEditingBedTypeId(bedType.id);
                                      setBedTypeForm({
                                        name: bedType.name ?? "",
                                        description: bedType.description ?? "",
                                        capacity: bedType.capacity ?? 1,
                                        isExtraBed: bedType.isExtraBed ?? false,
                                      });
                                      setBedTypeError("");
                                      setBedTypeNameError("");
                                      setBedTypeMessage("");
                                      setBedTypeDialogMode("manual");
                                      setIsBedTypeDialogOpen(true);
                                    }}
                                    className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                                  >
                                    <Pencil size={14} /> {localizedText("Chỉnh sửa", "Edit")}
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>}
              </div>
              {isBedTypeDialogOpen && (
                <CatalogEntryDialog
                  title={editingBedTypeId !== null ? localizedText("Chỉnh sửa loại giường", "Edit bed type") : localizedText("Thêm loại giường vào danh mục", "Add bed types to the catalog")}
                  description={localizedText("Tạo một loại giường mới hoặc nhập nhiều loại giường từ Excel.", "Create a bed type or import multiple bed types from Excel.")}
                  mode={bedTypeDialogMode}
                  onModeChange={(mode) => { setBedTypeDialogMode(mode); setBedTypeError(""); setBedTypeNameError(""); setBedTypeMessage(""); }}
                  onClose={() => {
                    if (!isParsingBedTypeFile && !isImportingBedTypes && !isCreatingBedType && !isUpdatingBedType) {
                      setIsBedTypeDialogOpen(false);
                      setEditingBedTypeId(null);
                      setBedTypeForm(initialBedTypeForm);
                      setBedTypeNameError("");
                    }
                  }}
                  manualContent={
                    <form noValidate onSubmit={(event) => void submitBedType(event)} className="space-y-4">
                      <label className="block text-sm font-semibold text-slate-700">
                        {localizedText("Tên loại giường", "Bed type name")} <span className="text-rose-600">*</span>
                        <input required autoFocus value={bedTypeForm.name} onChange={(event) => {
                          setBedTypeForm({ ...bedTypeForm, name: event.target.value });
                          setBedTypeNameError("");
                        }} aria-invalid={Boolean(bedTypeNameError)} aria-describedby={bedTypeNameError ? "bed-type-name-error" : undefined} className={`mt-1.5 h-10 w-full rounded-lg border px-3 text-sm font-normal outline-none focus:border-blue-400 ${bedTypeNameError ? "border-rose-400" : "border-slate-200"}`} placeholder={localizedText("Ví dụ: Giường Queen", "e.g. Queen bed")} />
                        {bedTypeNameError && <span id="bed-type-name-error" role="alert" className="mt-1 block text-xs font-normal text-rose-600">{bedTypeNameError}</span>}
                      </label>
                      <label className="block text-sm font-semibold text-slate-700">
                        {localizedText("Mô tả", "Description")}
                        <input value={bedTypeForm.description} onChange={(event) => setBedTypeForm({ ...bedTypeForm, description: event.target.value })} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none focus:border-blue-400" placeholder={localizedText("Mô tả ngắn (không bắt buộc)", "Short description (optional)")} />
                      </label>
                      <label className="block text-sm font-semibold text-slate-700">
                        {localizedText("Loại giường", "Bed type")}
                        <select value={String(bedTypeForm.isExtraBed)} onChange={(event) => setBedTypeForm({ ...bedTypeForm, isExtraBed: event.target.value === "true" })} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal outline-none focus:border-blue-400">
                          <option value="false">{localizedText("Giường thường", "Standard bed")}</option>
                          <option value="true">{localizedText("Giường phụ", "Extra bed")}</option>
                        </select>
                      </label>
                      {bedTypeError && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{bedTypeError}</p>}
                      {bedTypeMessage && <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{bedTypeMessage}</p>}
                      <button type="submit" disabled={isCreatingBedType || isUpdatingBedType} className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                        <Plus size={15} /> {isCreatingBedType || isUpdatingBedType ? localizedText("Đang lưu...", "Saving...") : editingBedTypeId !== null ? localizedText("Lưu thay đổi", "Save changes") : localizedText("Thêm loại giường", "Add bed type")}
                      </button>
                    </form>
                  }
                  fileContent={
                    <div className="space-y-4">
                      <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4">
                        <div className="flex items-start gap-3">
                          <FileSpreadsheet size={19} className="mt-0.5 shrink-0 text-blue-700" />
                          <div>
                            <p className="text-sm font-semibold text-slate-800">{localizedText("Bước 1: Chuẩn bị file theo mẫu", "Step 1: Prepare a file using the template")}</p>
                            <p className="mt-1 text-xs leading-5 text-slate-600">
                              {localizedText("Tải mẫu Excel để xem đúng cấu trúc cột, điền thông tin loại giường rồi chọn file để nhập.", "Download the Excel template to view the column structure, enter bed type details, and select the file to import.")}
                            </p>
                            <button
                              type="button"
                              onClick={downloadBedTypeTemplate}
                              className="mt-3 inline-flex h-9 items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
                            >
                              <FileSpreadsheet size={15} /> {localizedText("Tải file mẫu Excel", "Download Excel template")}
                            </button>
                          </div>
                        </div>
                      </div>
                      <label className={`flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-center transition hover:border-emerald-400 hover:bg-emerald-50/50 ${isParsingBedTypeFile || isImportingBedTypes ? "pointer-events-none opacity-60" : ""}`}>
                        {isParsingBedTypeFile || isImportingBedTypes ? (
                          <LoaderCircle size={22} className="animate-spin text-emerald-700" />
                        ) : (
                          <Upload size={22} className="text-emerald-700" />
                        )}
                        <span className="mt-2 text-sm font-semibold text-slate-800">
                          {isParsingBedTypeFile || isImportingBedTypes ? localizedText("Đang xử lý file...", "Processing file...") : localizedText("Bước 2: Chọn file Excel", "Step 2: Choose an Excel file")}
                        </span>
                        <span className="mt-1 text-xs text-slate-500">
                          {isParsingBedTypeFile || isImportingBedTypes ? localizedText("Vui lòng đợi trong giây lát", "Please wait a moment") : localizedText("Nhấn vào đây để chọn file .xlsx", "Click here to choose an .xlsx file")}
                        </span>
                        <input
                          type="file"
                          accept=".xlsx"
                          className="sr-only"
                          disabled={isParsingBedTypeFile || isImportingBedTypes}
                          onChange={(event) => {
                            void importBedTypeFile(event.target.files?.[0]);
                            event.currentTarget.value = "";
                          }}
                        />
                      </label>
                      {(isParsingBedTypeFile || isImportingBedTypes) && (
                        <p role="status" className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700">
                          Đang đọc và nhập danh sách loại giường...
                        </p>
                      )}
                      {bedTypeError && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{bedTypeError}</p>}
                      {!isParsingBedTypeFile && !isImportingBedTypes && bedTypeMessage && (
                        <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{bedTypeMessage}</p>
                      )}
                    </div>
                  }
                />
              )}
            </section>
          )}

          {(section === "accounts-overview" || section === "staff-accounts" || section === "customer-accounts") && (
            <SuperAdminAccountManagementPanel
              view={section === "staff-accounts" ? "staff" : section === "customer-accounts" ? "customers" : "all"}
            />
          )}

          {(section === "roles" || section === "permissions") && (
            <SuperAdminRolePermissionsPanel
              key={section}
              view={section === "roles" ? "roles" : "permissions"}
            />
          )}

          {section === "resource-stats" && (
            <SuperAdminResourceStatsPanel
              branches={branches}
              isLoading={isBranchesLoading}
              isError={isBranchesError}
              onRetry={() => void refetchBranches()}
            />
          )}

          {section === "promotions" && <PromotionWorkspace branches={branches} />}

          {section === "services" && <ServiceWorkspace branches={branches} />}

          <footer className="mt-10 flex items-center gap-2 border-t border-slate-200 pt-5 text-xs text-slate-400">
            <CircleUserRound size={14} />
            Chỉ tài khoản có role ROLE_SUPER_ADMIN mới truy cập được cổng này.
          </footer>
          </div>
        </div>
      </main>

      {isBranchFormOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/50 p-4" onMouseDown={() => setIsBranchFormOpen(false)}>
          <form noValidate onSubmit={(event) => void submitBranch(event)} onMouseDown={(event) => event.stopPropagation()} className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>              <p className="text-xs font-bold uppercase tracking-wider text-blue-600">{localizedText("Quản lý chi nhánh", "Branch management")}</p><h2 className="mt-1 text-xl font-bold text-slate-900">{localizedText("Thêm chi nhánh mới", "Add a new branch")}</h2></div>
              <button type="button" onClick={() => setIsBranchFormOpen(false)} aria-label={localizedText("Đóng", "Close")} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
            </div>
            <section className="mt-5 rounded-xl border border-slate-200 p-4">
              <h3 className="font-semibold text-slate-900">{localizedText("Thông tin chi nhánh", "Branch information")}</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-semibold text-slate-700">
                  {localizedText("Tên chi nhánh", "Branch name")}<span className="text-rose-500" aria-hidden="true"> *</span>
                  <input value={branchForm.name} onChange={(event) => {
                    setBranchForm({ ...branchForm, name: event.target.value });
                    setBranchFieldErrors((current) => ({ ...current, name: undefined }));
                  }} aria-invalid={Boolean(branchFieldErrors.name)} aria-describedby={branchFieldErrors.name ? "branch-name-error" : undefined} className={`mt-1.5 h-10 w-full rounded-lg border px-3 font-normal outline-none focus:border-blue-400 ${branchFieldErrors.name ? "border-rose-400" : "border-slate-200"}`} />
                  {branchFieldErrors.name && <span id="branch-name-error" role="alert" className="mt-1 block text-xs font-normal text-rose-600">{branchFieldErrors.name}</span>}
                </label>
                <label className="text-sm font-semibold text-slate-700">
                  {localizedText("Số điện thoại chi nhánh", "Branch phone number")}<span className="text-rose-500" aria-hidden="true"> *</span>
                  <input type="tel" value={branchForm.phone} onChange={(event) => {
                    setBranchForm({ ...branchForm, phone: event.target.value });
                    setBranchFieldErrors((current) => ({ ...current, phone: undefined }));
                  }} aria-invalid={Boolean(branchFieldErrors.phone)} aria-describedby={branchFieldErrors.phone ? "branch-phone-error" : undefined} className={`mt-1.5 h-10 w-full rounded-lg border px-3 font-normal outline-none focus:border-blue-400 ${branchFieldErrors.phone ? "border-rose-400" : "border-slate-200"}`} />
                  {branchFieldErrors.phone && <span id="branch-phone-error" role="alert" className="mt-1 block text-xs font-normal text-rose-600">{branchFieldErrors.phone}</span>}
                </label>
                <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
                  {localizedText("Địa chỉ", "Address")}<span className="text-rose-500" aria-hidden="true"> *</span>
                  <input value={branchForm.address} onChange={(event) => {
                    setBranchForm({ ...branchForm, address: event.target.value });
                    setBranchFieldErrors((current) => ({ ...current, address: undefined }));
                  }} aria-invalid={Boolean(branchFieldErrors.address)} aria-describedby={branchFieldErrors.address ? "branch-address-error" : undefined} className={`mt-1.5 h-10 w-full rounded-lg border px-3 font-normal outline-none focus:border-blue-400 ${branchFieldErrors.address ? "border-rose-400" : "border-slate-200"}`} />
                  {branchFieldErrors.address && <span id="branch-address-error" role="alert" className="mt-1 block text-xs font-normal text-rose-600">{branchFieldErrors.address}</span>}
                </label>
                <div className="text-sm font-semibold text-slate-700 sm:col-span-2">
                  <span>{localizedText("Tỉnh/thành", "Province/city")}<span className="text-rose-500" aria-hidden="true"> *</span></span>
                  <Popover
                    open={isProvincePickerOpen}
                    onOpenChange={(open) => {
                      setIsProvincePickerOpen(open);
                      if (!open) setProvinceSearch("");
                    }}
                  >
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        role="combobox"
                        aria-expanded={isProvincePickerOpen}
                        aria-required="true"
                        aria-invalid={Boolean(branchFieldErrors.provinceName)}
                        aria-describedby={branchFieldErrors.provinceName ? "branch-province-error" : undefined}
                        aria-label={localizedText("Chọn tỉnh/thành", "Select province/city")}
                        className={`mt-1.5 flex h-10 w-full items-center justify-between gap-3 rounded-lg border bg-white px-3 text-left text-sm font-normal text-slate-700 outline-none hover:border-blue-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 ${branchFieldErrors.provinceName ? "border-rose-400" : "border-slate-200"}`}
                      >
                        <span className={branchForm.provinceName ? "truncate" : "truncate text-slate-500"}>
                          {branchForm.provinceName || localizedText("Chọn tỉnh/thành", "Select province/city")}
                        </span>
                        <ChevronsUpDown size={16} className="shrink-0 text-slate-400" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
                      <Command shouldFilter>
                        <CommandInput
                          value={provinceSearch}
                          onValueChange={setProvinceSearch}
                          placeholder={localizedText("Tìm tỉnh/thành...", "Search provinces/cities...")}
                          aria-label={localizedText("Tìm tỉnh/thành", "Search provinces/cities")}
                        />
                        <CommandList>
                          <CommandEmpty>{localizedText("Không tìm thấy tỉnh/thành.", "No provinces/cities found.")}</CommandEmpty>
                          <CommandGroup>
                            {VIETNAM_PROVINCES.map((province) => {
                              const searchableName = province
                                .normalize("NFD")
                                .replace(/[\u0300-\u036f]/g, "")
                                .toLocaleLowerCase("vi");
                              return (
                                <CommandItem
                                  key={province}
                                  value={`${province} ${searchableName}`}
                                  onSelect={() => {
                                    setBranchForm((current) => ({ ...current, provinceName: province }));
                                    setBranchFieldErrors((current) => ({ ...current, provinceName: undefined }));
                                    setIsProvincePickerOpen(false);
                                    setProvinceSearch("");
                                  }}
                                >
                                  <Check className={`mr-2 h-4 w-4 ${branchForm.provinceName === province ? "opacity-100" : "opacity-0"}`} />
                                  {province}
                                </CommandItem>
                              );
                            })}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {branchFieldErrors.provinceName && <span id="branch-province-error" role="alert" className="mt-1 block text-xs font-normal text-rose-600">{branchFieldErrors.provinceName}</span>}
                </div>
              </div>
            </section>
            <section className="mt-4 rounded-xl border border-blue-100 bg-blue-50/40 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-slate-900">{localizedText("Chính sách giá các loại phòng", "Room type pricing policies")}</h3>
                  <p className="mt-1 text-xs leading-5 text-slate-600">
                    {localizedText("Tải mẫu, điền đủ 4 loại phòng rồi tải file lên. Quản lý chi nhánh có thể điều chỉnh giá sau khi tạo.", "Download the template, fill in all 4 room types, and upload it. Branch managers can adjust prices after creation.")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={downloadSuperAdminRoomPolicyTemplate}
                  className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                >
                  <FileSpreadsheet size={15} />
                  {localizedText("Tải file mẫu", "Download template")}
                </button>
              </div>
              <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-blue-300 bg-white px-3 py-3 text-sm font-semibold text-blue-700 transition hover:bg-blue-50">
                <Upload size={16} />
                {branchPolicyFileName || localizedText("Chọn file chính sách phòng (.xlsx)", "Choose room policy file (.xlsx)")}
                <input
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="sr-only"
                  disabled={isParsingBranchPolicy}
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0];
                    event.currentTarget.value = "";
                    if (!file) return;
                    setBranchPolicyError("");
                    setBranchRoomPolicies([]);
                    setBranchPolicyFileName(file.name);
                    setIsParsingBranchPolicy(true);
                    void parseSuperAdminRoomPolicyFile(file).then((policies) => {
                      setBranchRoomPolicies(policies);
                      setBranchPolicyError("");
                    }).catch((error: unknown) => {
                      setBranchPolicyError(error instanceof Error ? error.message : localizedText("Không thể đọc file chính sách phòng.", "Could not read the room policy file."));
                    }).finally(() => {
                      setIsParsingBranchPolicy(false);
                    });
                  }}
                />
              </label>
              {isParsingBranchPolicy && (
                <p role="status" className="mt-2 text-xs font-medium text-blue-700">{localizedText("Đang đọc file Excel...", "Reading Excel file...")}</p>
              )}
              {branchPolicyFileName && branchRoomPolicies.length > 0 && (
                <p role="status" className="mt-2 text-xs font-medium text-emerald-700">
                  {localizedText(`Đã đọc ${branchRoomPolicies.length} loại phòng: ${branchRoomPolicies.map((policy) => roomTypeName(policy.roomType)).join(", ")}.`, `Read ${branchRoomPolicies.length} room types: ${branchRoomPolicies.map((policy) => roomTypeName(policy.roomType)).join(", ")}.`)}
                </p>
              )}
              {branchPolicyError && <p role="alert" className="mt-2 text-xs text-rose-600">{branchPolicyError}</p>}
            </section>
            <section className="mt-4 rounded-xl border border-slate-200 p-4">
              <h3 className="font-semibold text-slate-900">{localizedText("Tài khoản admin chi nhánh", "Branch admin account")} <span className="font-mono text-xs font-medium text-slate-500">(ROLE_ADMIN)</span></h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {branchAdminAccountFields.map((field) => {
                  const errorKey = branchAdminErrorKeys[field.key];
                  const error = branchFieldErrors[errorKey];
                  return (
                    <label key={field.key} className="text-sm font-semibold text-slate-700">
                      {field.key === "username" ? localizedText("Tên tài khoản", "Username") : localizedText("Mật khẩu", "Password")}<span className="text-rose-500" aria-hidden="true"> *</span>
                      <input
                        type={field.type}
                        autoComplete={field.autoComplete}
                        value={branchForm.adminAccount[field.key]}
                        onChange={(event) => {
                          setBranchForm((current) => ({
                            ...current,
                            adminAccount: { ...current.adminAccount, [field.key]: event.target.value },
                          }));
                          setBranchFieldErrors((current) => ({ ...current, [errorKey]: undefined }));
                        }}
                        aria-invalid={Boolean(error)}
                        aria-describedby={error ? branchFieldErrorIds[errorKey] : undefined}
                        className={`mt-1.5 h-10 w-full rounded-lg border px-3 font-normal outline-none focus:border-blue-400 ${error ? "border-rose-400" : "border-slate-200"}`}
                      />
                      {error && <span id={branchFieldErrorIds[errorKey]} role="alert" className="mt-1 block text-xs font-normal text-rose-600">{error}</span>}
                    </label>
                  );
                })}
              </div>
            </section>
            {branchAccountSections.map(({ key, title }) => (
              <section key={key} className="mt-4 rounded-xl border border-slate-200 p-4">
                <h3 className="font-semibold text-slate-900">{localizedText(title, "Branch manager account")} <span className="font-mono text-xs font-medium text-slate-500">(ROLE_MANAGER)</span></h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {branchAccountFields.map((field) => {
                    const errorKey = branchManagerErrorKeys[field.key];
                    const error = branchFieldErrors[errorKey];
                    return (
                      <label key={field.key} className="text-sm font-semibold text-slate-700">
                        {field.key === "fullName" ? localizedText("Họ và tên", "Full name") : field.key === "email" ? "Email" : field.key === "phone" ? localizedText("Số điện thoại", "Phone number") : localizedText("Mật khẩu", "Password")}<span className="text-rose-500" aria-hidden="true"> *</span>
                        <input
                          type={field.type}
                          autoComplete={field.autoComplete}
                          value={branchForm[key][field.key]}
                          onChange={(event) => {
                            setBranchForm((current) => ({
                              ...current,
                              [key]: { ...current[key], [field.key]: event.target.value },
                            }));
                            setBranchFieldErrors((current) => ({ ...current, [errorKey]: undefined }));
                          }}
                          aria-invalid={Boolean(error)}
                          aria-describedby={error ? branchFieldErrorIds[errorKey] : undefined}
                          className={`mt-1.5 h-10 w-full rounded-lg border px-3 font-normal outline-none focus:border-blue-400 ${error ? "border-rose-400" : "border-slate-200"}`}
                        />
                        {error && <span id={branchFieldErrorIds[errorKey]} role="alert" className="mt-1 block text-xs font-normal text-rose-600">{error}</span>}
                      </label>
                    );
                  })}
                </div>
              </section>
            ))}
            {branchFormError && <p role="alert" className="mt-3 text-sm text-rose-600">{branchFormError}</p>}
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setIsBranchFormOpen(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">{localizedText("Hủy", "Cancel")}</button>
              <button type="submit" disabled={isCreatingBranch || isParsingBranchPolicy} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">{isParsingBranchPolicy ? localizedText("Đang đọc file...", "Reading file...") : isCreatingBranch ? localizedText("Đang tạo...", "Creating...") : localizedText("Tạo chi nhánh", "Create branch")}</button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}

function BranchList({ branches, isLoading, onSelect }: { branches: SuperAdminBranch[]; isLoading: boolean; onSelect: (id: number) => void }) {
  if (isLoading) return <p className="py-8 text-center text-sm text-slate-500">{localizedText("Đang tải danh sách chi nhánh...", "Loading branches...")}</p>;
  if (branches.length === 0) return <p className="py-8 text-center text-sm text-slate-500">{localizedText("Chưa có chi nhánh.", "No branches yet.")}</p>;
  return (
    <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full min-w-[1250px] table-fixed text-left text-sm">
        <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            <th scope="col" className="w-16 whitespace-nowrap px-4 py-3">STT</th>
            <th scope="col" className="w-48 whitespace-nowrap px-4 py-3">{localizedText("Tên chi nhánh", "Branch name")}</th>
            <th scope="col" className="w-64 whitespace-nowrap px-4 py-3">{localizedText("Địa chỉ", "Address")}</th>
            <th scope="col" className="w-40 whitespace-nowrap px-4 py-3">{localizedText("Tỉnh/thành", "Province/city")}</th>
            <th scope="col" className="w-36 whitespace-nowrap px-4 py-3">{localizedText("Số điện thoại", "Phone number")}</th>
            <th scope="col" className="w-28 whitespace-nowrap px-4 py-3 text-center">{localizedText("Nhân sự", "Staff")}</th>
            <th scope="col" className="w-28 whitespace-nowrap px-4 py-3 text-center">Booking</th>
            <th scope="col" className="w-40 whitespace-nowrap px-4 py-3 text-right">{localizedText("Doanh thu", "Revenue")}</th>
            <th scope="col" className="w-32 whitespace-nowrap px-4 py-3 text-center">{localizedText("Thao tác", "Actions")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {branches.map((branch, index) => (
            <tr key={branch.id} className="text-slate-700 transition hover:bg-slate-50/70">
              <td className="px-4 py-3.5 tabular-nums text-slate-500">{index + 1}</td>
              <td className="truncate px-4 py-3.5 font-semibold text-slate-900" title={branch.name}>{branch.name}</td>
              <td className="truncate px-4 py-3.5 text-slate-600" title={branch.address}>{branch.address || "—"}</td>
              <td className="whitespace-nowrap px-4 py-3.5">{branch.provinceName || "—"}</td>
              <td className="whitespace-nowrap px-4 py-3.5">{branch.phone || "—"}</td>
              <td className="px-4 py-3.5 text-center tabular-nums">{branch.employeeCount}</td>
              <td className="px-4 py-3.5 text-center tabular-nums">{branch.bookingCount}</td>
              <td className="whitespace-nowrap px-4 py-3.5 text-right font-semibold text-emerald-700">{formatMoney(Number(branch.totalRevenue) || 0)}</td>
              <td className="px-4 py-3 text-center">
                <button
                  type="button"
                  onClick={() => onSelect(branch.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                >
                  <Eye size={14} />
                  {localizedText("Chi tiết", "Details")}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BranchDetailsPanel({
  details,
  isLoading,
  isError,
  initialCategory,
  highlightedDetailReference,
  backLabel,
  onBack,
}: {
  details?: SuperAdminBranchDetails;
  isLoading: boolean;
  isError: boolean;
  initialCategory: BranchDetailCategory;
  highlightedDetailReference: { category: BranchDetailCategory; id: string } | null;
  backLabel: string;
  onBack: () => void;
}) {
  const [saveRoomPolicies, { isLoading: isSavingRoomPolicies }] = useSaveSuperAdminBranchRoomPoliciesMutation();
  const [updateBranchRoomPolicy, { isLoading: isUpdatingRoomPolicy }] = useUpdateBranchRoomPolicyMutation();
  const [updateBuilding, { isLoading: isUpdatingBuilding }] = useUpdateBuildingMutation();
  const [updateFloor, { isLoading: isUpdatingFloor }] = useUpdateFloorMutation();
  const [getRoomById] = useLazyGetRoomByIdQuery();
  const [updateRoom, { isLoading: isUpdatingRoom }] = useUpdateRoomMutation();
  const { data: editRoomTypes = [] } = useGetRoomTypesQuery();
  const { data: editRoomStatuses = [] } = useGetRoomStatusesQuery();
  const { data: editAmenities = [] } = useGetAllAmenitiesQuery();
  const { data: editBedTypes = [] } = useGetAllBedTypesQuery();
  const isSavingRoomPolicy = isSavingRoomPolicies || isUpdatingRoomPolicy;
  const [roomPolicyMessage, setRoomPolicyMessage] = useState("");
  const [roomPolicyError, setRoomPolicyError] = useState("");
  const [editingBuilding, setEditingBuilding] = useState<{ id: string; name: string } | null>(null);
  const [buildingName, setBuildingName] = useState("");
  const [buildingError, setBuildingError] = useState("");
  const [editingFloor, setEditingFloor] = useState<{ id: string; floorNumber: number } | null>(null);
  const [floorNumber, setFloorNumber] = useState("");
  const [floorError, setFloorError] = useState("");
  const [editingRoom, setEditingRoom] = useState<{
    id: string;
    roomNumber: string;
    floorId: string;
    roomType: string;
    roomStatus: string;
    area: string;
    basePrice: string;
    standardCapacity: string;
    maxExtraGuests: string;
    extraAdultFee: string;
    extraChildFee: string;
    images: string[];
    defaultImageIndex: number;
    amenityIds: number[];
    beds: Array<{ bedTypeId: number; quantity: number }>;
  } | null>(null);
  const [roomEditImageFiles, setRoomEditImageFiles] = useState<File[]>([]);
  const [roomEditError, setRoomEditError] = useState("");
  const [loadingRoomId, setLoadingRoomId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<BranchDetailCategory>(initialCategory);
  const [viewingItem, setViewingItem] = useState<{ title: string; fields: DetailField[] } | null>(null);
  const viewItem = (title: string, fields: DetailField[]) => setViewingItem({ title, fields });
  const highlightedItemIndex = (() => {
    if (!details || !highlightedDetailReference || highlightedDetailReference.category !== activeCategory) return -1;
    switch (activeCategory) {
      case "employees":
        return details.employees.findIndex((employee) => employee.id === highlightedDetailReference.id);
      case "buildings": {
        const referenceId = highlightedDetailReference.id.trim();
        const normalizedReferenceId = referenceId.replace(/^BUILDING[:#/_-]*/i, "").trim().toLocaleLowerCase();
        const buildingById = details.buildings.findIndex((building) => {
          const buildingId = building.id.trim();
          return buildingId.toLocaleLowerCase() === referenceId.toLocaleLowerCase()
            || buildingId.toLocaleLowerCase() === normalizedReferenceId;
        });
        if (buildingById >= 0) return buildingById;
        const buildingNumber = Number(normalizedReferenceId);
        return normalizedReferenceId !== "" && Number.isFinite(buildingNumber)
          ? details.buildings.findIndex((building) => Number(building.id) === buildingNumber)
          : -1;
      }
      case "floors": {
        const referenceId = highlightedDetailReference.id.trim();
        const normalizedReferenceId = referenceId.replace(/^FLOOR[:#/_-]*/i, "").trim();
        const floorById = details.floors.findIndex((floor) =>
          floor.id.trim().toLocaleLowerCase() === referenceId.toLocaleLowerCase()
          || floor.id.trim().toLocaleLowerCase() === normalizedReferenceId.toLocaleLowerCase(),
        );
        if (floorById >= 0) return floorById;
        const floorNumber = Number(normalizedReferenceId);
        return Number.isInteger(floorNumber)
          ? details.floors.findIndex((floor) => floor.floorNumber === floorNumber)
          : -1;
      }
      case "rooms":
        return details.rooms.findIndex((room) =>
          room.id === highlightedDetailReference.id || room.roomNumber === highlightedDetailReference.id);
      case "bookings":
        return details.bookings.findIndex((booking) => booking.bookingId === highlightedDetailReference.id);
      case "services":
        return details.services.findIndex((service) => service.id === highlightedDetailReference.id);
      case "promotions":
        return details.promotions.findIndex((promotion) =>
          promotion.id === highlightedDetailReference.id || promotion.code === highlightedDetailReference.id);
      case "roomPolicies":
        return -1;
    }
  })();
  const categories: { id: BranchDetailCategory; label: string; count: number; icon: typeof LayoutDashboard }[] = [
    { id: "employees", label: localizedText("Nhân viên", "Staff"), count: details?.employees.length ?? 0, icon: Users },
    { id: "buildings", label: localizedText("Tòa nhà", "Buildings"), count: details?.buildings.length ?? 0, icon: Building2 },
    { id: "floors", label: localizedText("Tầng", "Floors"), count: details?.floors.length ?? 0, icon: LayoutDashboard },
    { id: "rooms", label: localizedText("Phòng", "Rooms"), count: details?.rooms.length ?? 0, icon: Building2 },
    { id: "bookings", label: "Booking", count: details?.bookings.length ?? 0, icon: CalendarDays },
    { id: "services", label: localizedText("Dịch vụ", "Services"), count: details?.services.length ?? 0, icon: ShieldCheck },
    { id: "promotions", label: localizedText("Khuyến mãi", "Promotions"), count: details?.promotions.length ?? 0, icon: Wallet },
    { id: "roomPolicies", label: localizedText("Cấu hình loại phòng", "Room type policies"), count: details?.roomPolicies.length ?? 0, icon: ShieldCheck },
  ];

  const activeCategoryInfo = categories.find((category) => category.id === activeCategory) ?? categories[0];

  return (
    <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
          <h2 className="text-lg font-bold text-slate-900">{details?.branch.name ?? localizedText("Chi tiết chi nhánh", "Branch details")}</h2>
          {details && (
            <p className="flex items-start gap-1.5 text-xs text-slate-500">
              <MapPin size={14} className="mt-0.5 shrink-0 text-blue-600" />
              <span>{[details.branch.address, details.branch.provinceName].filter(Boolean).join(", ")}</span>
            </p>
          )}
        </div>
        <button type="button" onClick={onBack} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50">
          {backLabel}
        </button>
      </div>
        {isLoading ? <p className="py-12 text-center text-sm text-slate-500">{localizedText("Đang tải chi tiết chi nhánh...", "Loading branch details...")}</p>
          : isError || !details ? <p role="alert" className="py-12 text-center text-sm text-rose-600">{localizedText("Không thể tải hồ sơ chi nhánh.", "Could not load branch details.")}</p>
            : <>
              <div className="mt-4 space-y-3">
                <nav className="flex flex-wrap gap-2 rounded-xl bg-slate-50 p-2" aria-label={localizedText("Danh mục chi tiết chi nhánh", "Branch detail categories")}>
                  {categories.map(({ id, label, count, icon: Icon }) => (
                    <button
                      type="button"
                      key={id}
                      onClick={() => setActiveCategory(id)}
                      aria-current={activeCategory === id ? "page" : undefined}
                      className={`inline-flex items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs font-semibold transition ${
                        activeCategory === id
                          ? "bg-blue-600 text-white shadow-sm shadow-blue-900/15"
                          : "text-slate-600 hover:bg-white hover:text-slate-900"
                      }`}
                    >
                      <Icon size={17} className="shrink-0" />
                      <span className="whitespace-nowrap">{label}</span>
                      <span className={`flex h-5 min-w-7 items-center justify-center rounded-full px-1 text-xs ${
                        activeCategory === id ? "bg-white/20 text-white" : "bg-slate-200/70 text-slate-500"
                      }`}>{count}</span>
                    </button>
                  ))}
                </nav>
                <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-4">
                  <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-slate-100 pb-3">
                    <h3 className="text-base font-bold text-slate-900">{activeCategoryInfo.label}</h3>
                    <p className="text-xs text-slate-500">{activeCategoryInfo.count} {localizedText("mục", "items")}</p>
                  </div>
                  {activeCategory === "employees" && (
                    <DetailList count={details.employees.length} columns={[localizedText("Họ tên", "Full name"), localizedText("Chức vụ", "Position"), "Email", localizedText("Số điện thoại", "Phone number")]} minWidth={950} showEdit={false}>
                      {details.employees.map((employee, index) => <DetailRow
                        key={employee.id}
                        highlighted={index === highlightedItemIndex}
                        cells={[employee.fullName, employee.position || "Nhân viên", employee.email, employee.phone || "Chưa có SĐT"]}
                        showEdit={false}
                        onView={() => viewItem(employee.fullName, [
                          { label: "Mã nhân viên", value: employee.id },
                          { label: "Chức vụ", value: employee.position || "Nhân viên" },
                          { label: "Email", value: employee.email },
                          { label: "Số điện thoại", value: employee.phone || "Chưa có" },
                          { label: "Vai trò", value: employee.roles?.join(", ") || "Chưa có thông tin" },
                        ])}
                      />)}
                    </DetailList>
                  )}
                  {activeCategory === "buildings" && (
                    <DetailList count={details.buildings.length} columns={[localizedText("Tên tòa nhà", "Building name"), localizedText("Số tầng", "Floors")]} minWidth={700}>
                      {details.buildings.map((building, index) => <DetailRow
                        key={building.id}
                        highlighted={index === highlightedItemIndex}
                        cells={[building.name, `${building.floorCount}`]}
                        onEdit={() => {
                          setEditingBuilding({ id: building.id, name: building.name });
                          setBuildingName(building.name);
                          setBuildingError("");
                        }}
                        onView={() => viewItem(building.name, [
                          { label: "Mã tòa nhà", value: building.id },
                          { label: "Tên tòa nhà", value: building.name },
                          { label: "Số tầng", value: String(building.floorCount) },
                        ])}
                      />)}
                    </DetailList>
                  )}
                  {activeCategory === "floors" && (
                    <DetailList count={details.floors.length} columns={[localizedText("Tầng", "Floor"), localizedText("Tòa nhà", "Building"), localizedText("Số phòng", "Rooms")]} minWidth={800}>
                      {details.floors.map((floor, index) => <DetailRow
                        key={floor.id}
                        highlighted={index === highlightedItemIndex}
                        cells={[String(floor.floorNumber), floor.buildingName, String(floor.roomCount)]}
                        onEdit={() => {
                          setEditingFloor({ id: floor.id, floorNumber: floor.floorNumber });
                          setFloorNumber(String(floor.floorNumber));
                          setFloorError("");
                        }}
                        onView={() => viewItem(`Tầng ${floor.floorNumber}`, [
                          { label: "Mã tầng", value: floor.id },
                          { label: "Số tầng", value: String(floor.floorNumber) },
                          { label: "Tòa nhà", value: floor.buildingName },
                          { label: "Số phòng", value: String(floor.roomCount) },
                        ])}
                      />)}
                    </DetailList>
                  )}
                  {activeCategory === "rooms" && (
                    <DetailList count={details.rooms.length} columns={[
                      localizedText("Phòng", "Room"),
                      localizedText("Tòa nhà", "Building"),
                      localizedText("Tầng", "Floor"),
                      localizedText("Loại phòng", "Room type"),
                      localizedText("Trạng thái", "Status"),
                    ]} minWidth={1100}>
                      {details.rooms.map((room, index) => <DetailRow
                        key={room.id}
                        highlighted={index === highlightedItemIndex}
                        cells={[room.roomNumber, room.buildingName, String(room.floorNumber), room.roomType || "Chưa phân loại", room.roomStatus || "Chưa có trạng thái"]}
                        editLoading={loadingRoomId === room.id}
                        onEdit={() => {
                          setRoomEditError("");
                          setLoadingRoomId(room.id);
                          void getRoomById({
                            roomId: room.id,
                            hotelId: details?.branch.id,
                          }).unwrap()
                            .then((roomRecord) => {
                              const record = roomRecord as Record<string, unknown>;
                              const roomType = String(roomRecord.roomType ?? room.roomType ?? "STANDARD");
                              const policy = details?.roomPolicies?.find((item) =>
                                item.roomType.toUpperCase() === roomType.toUpperCase());
                              const branchPolicy = record.branchRoomPolicy && typeof record.branchRoomPolicy === "object"
                                ? record.branchRoomPolicy as Record<string, unknown>
                                : {};
                              const imageValue = record.avatarUrl ?? record.imageUrls ?? record.images;
                              const imageItems = Array.isArray(imageValue) ? imageValue : [];
                              const imageUrls = imageItems.map((image) => {
                                if (typeof image === "string") return image;
                                if (image && typeof image === "object" && "url" in image) {
                                  return String((image as { url: unknown }).url ?? "");
                                }
                                return "";
                              }).filter(Boolean);

                              if (imageUrls.length < 4 || imageUrls.length > 8) {
                                throw new Error("Không thể chỉnh sửa vì API chưa trả về đủ 4–8 ảnh hiện có của phòng.");
                              }

                              const amenityValue = record.amenities ?? record.amenityIds ?? record.roomAmenities;
                              if (!Array.isArray(amenityValue)) {
                                throw new Error("Không thể chỉnh sửa vì API chưa trả về tiện nghi hiện có của phòng.");
                              }
                              const amenityItems = amenityValue;
                              const amenityIds = amenityItems.map((item) => {
                                if (typeof item === "number" || typeof item === "string") return Number(item);
                                if (!item || typeof item !== "object") return Number.NaN;
                                const value = item as Record<string, unknown>;
                                const nested = value.amenity && typeof value.amenity === "object"
                                  ? value.amenity as Record<string, unknown>
                                  : {};
                                return Number(value.amenityId ?? value.id ?? nested.id);
                              }).filter((id) => Number.isSafeInteger(id) && id > 0);

                              const bedValue = record.beds
                                ?? record.roomBeds
                                ?? record.bedConfigurations
                                ?? record.bedTypes
                                ?? record.roomTypeBeds
                                ?? record.bedType
                                ?? record.bedTypeName;
                              const bedItems = Array.isArray(bedValue)
                                ? bedValue
                                : bedValue == null ? [] : [bedValue];
                              const normalizeBedTypeName = (value: unknown) =>
                                typeof value === "string"
                                  ? value.trim().toLocaleLowerCase().replace(/[_\s-]+/g, "")
                                  : "";
                              const beds = bedItems.map((item) => {
                                if (typeof item !== "string" && (!item || typeof item !== "object")) return null;
                                const value = typeof item === "string"
                                  ? { bedTypeName: item }
                                  : item as Record<string, unknown>;
                                const nested = value.bedType && typeof value.bedType === "object"
                                  ? value.bedType as Record<string, unknown>
                                  : {};
                                const bedTypeName = value.bedTypeName
                                  ?? value.name
                                  ?? (typeof value.bedType === "string" ? value.bedType : undefined)
                                  ?? nested.name
                                  ?? nested.bedTypeName;
                                const normalizedBedName = normalizeBedTypeName(bedTypeName);
                                const matchedBedType = editBedTypes.find((bedType) =>
                                  Number(bedType.id) === Number(value.bedTypeId ?? value.bedTypeID ?? nested.id)
                                  || (normalizedBedName !== ""
                                    && normalizeBedTypeName(bedType.name ?? bedType.bedTypeName) === normalizedBedName));
                                const bedTypeId = Number(
                                  value.bedTypeId
                                  ?? value.bedTypeID
                                  ?? nested.id
                                  ?? matchedBedType?.id,
                                );
                                const quantity = Number(value.quantity ?? value.bedQuantity ?? 1);
                                return Number.isSafeInteger(bedTypeId) && bedTypeId > 0
                                  && Number.isSafeInteger(quantity) && quantity > 0
                                  ? { bedTypeId, quantity }
                                  : null;
                              }).filter((bed): bed is { bedTypeId: number; quantity: number } => bed !== null);
                              if (beds.length === 0) {
                                throw new Error("Không thể chỉnh sửa vì API chưa trả về loại giường hiện có của phòng.");
                              }

                              setEditingRoom({
                                id: room.id,
                                roomNumber: String(roomRecord.roomNumber ?? room.roomNumber),
                                floorId: String(roomRecord.floorId ?? room.floorId),
                                roomType,
                                roomStatus: String(roomRecord.roomStatus ?? room.roomStatus ?? "READY"),
                                area: String(record.area ?? branchPolicy.area ?? policy?.area ?? ""),
                                basePrice: String(record.basePrice ?? record.price ?? branchPolicy.basePrice ?? policy?.basePrice ?? ""),
                                standardCapacity: String(record.standardCapacity ?? branchPolicy.standardCapacity ?? policy?.standardCapacity ?? ""),
                                maxExtraGuests: String(record.maxExtraGuests ?? branchPolicy.maxExtraGuests ?? policy?.maxExtraGuests ?? ""),
                                extraAdultFee: String(record.extraAdultFee ?? branchPolicy.extraAdultFee ?? policy?.extraAdultFee ?? ""),
                                extraChildFee: String(record.extraChildFee ?? branchPolicy.extraChildFee ?? policy?.extraChildFee ?? ""),
                                images: imageUrls,
                                defaultImageIndex: Math.max(0, imageItems.findIndex((image) =>
                                  Boolean(image && typeof image === "object"
                                    && "isDefault" in image
                                    && (image as { isDefault?: unknown }).isDefault))),
                                amenityIds,
                                beds,
                              });
                              setRoomEditImageFiles([]);
                            })
                            .catch((error: unknown) => {
                              setRoomEditError(getErrorMessage(error, localizedText("Không thể tải dữ liệu phòng để chỉnh sửa.", "Could not load the room details for editing.")));
                            })
                            .finally(() => setLoadingRoomId(null));
                        }}
                        onView={() => viewItem(`Phòng ${room.roomNumber}`, [
                          { label: "Mã phòng", value: room.id },
                          { label: "Tòa nhà", value: room.buildingName },
                          { label: "Tầng", value: String(room.floorNumber) },
                          { label: "Loại phòng", value: room.roomType || "Chưa phân loại" },
                          { label: "Trạng thái", value: room.roomStatus || "Chưa có trạng thái" },
                          ...(() => {
                            const policy = details.roomPolicies?.find((item) =>
                              item.roomType.toUpperCase() === String(room.roomType ?? "").toUpperCase());
                            return policy ? [
                              { label: "Giá cơ bản / đêm", value: formatMoney(policy.basePrice) },
                              { label: "Diện tích", value: `${policy.area} m²` },
                              { label: "Sức chứa tiêu chuẩn", value: String(policy.standardCapacity) },
                              { label: "Khách thêm tối đa", value: String(policy.maxExtraGuests) },
                              { label: "Phụ thu người lớn", value: formatMoney(policy.extraAdultFee) },
                              { label: "Phụ thu trẻ em", value: formatMoney(policy.extraChildFee) },
                            ] : [{ label: "Chính sách phòng", value: "Chưa cấu hình cho loại phòng này" }];
                          })(),
                        ])}
                      />)}
                    </DetailList>
                  )}
                  {activeCategory === "bookings" && (
                    <DetailList
                      count={details.bookings.length}
                      columns={[
                        localizedText("Mã booking", "Booking ID"),
                        localizedText("Khách hàng", "Guest"),
                        localizedText("Trạng thái", "Status"),
                        localizedText("Kênh đặt", "Booking channel"),
                        localizedText("Ngày tạo", "Created"),
                        localizedText("Tổng tiền", "Total"),
                        localizedText("Đã thu", "Paid"),
                        localizedText("Còn lại", "Balance"),
                      ]}
                      minWidth={1550}
                      showEdit={false}
                    >
                      {details.bookings.map((booking, index) => <DetailRow
                        key={booking.bookingId ?? index}
                        showEdit={false}
                        highlighted={index === highlightedItemIndex}
                        cells={[
                          booking.bookingId || "—",
                          booking.customerName || "Chưa có",
                          booking.bookingStatus || "Chưa có",
                          booking.bookingChannel || "Chưa có",
                          booking.createdAt ? new Date(booking.createdAt).toLocaleString("vi-VN") : "Chưa có",
                          formatMoney(Number(booking.finalAmount) || 0),
                          formatMoney(Number(booking.paidAmount) || 0),
                          formatMoney(Number(booking.remainingAmount) || 0),
                        ]}
                        onView={() => viewItem(booking.bookingId || "Chi tiết booking", [
                          { label: "Mã booking", value: booking.bookingId || "Chưa có" },
                          { label: "Khách hàng", value: booking.customerName || "Chưa có" },
                          { label: "Trạng thái", value: booking.bookingStatus || "Chưa có" },
                          { label: "Kênh đặt", value: booking.bookingChannel || "Chưa có" },
                          { label: "Ngày tạo", value: booking.createdAt ? new Date(booking.createdAt).toLocaleString("vi-VN") : "Chưa có" },
                          { label: "Tổng tiền", value: formatMoney(Number(booking.finalAmount) || 0) },
                          { label: "Đã thu", value: formatMoney(Number(booking.paidAmount) || 0) },
                          { label: "Còn lại", value: formatMoney(Number(booking.remainingAmount) || 0) },
                        ])}
                      />)}
                    </DetailList>
                  )}
                  {activeCategory === "services" && (
                    <DetailList count={details.services.length} columns={[
                      localizedText("Tên dịch vụ", "Service"),
                      localizedText("Danh mục", "Category"),
                      localizedText("Giá", "Price"),
                      localizedText("Đơn vị", "Unit"),
                      localizedText("Phạm vi", "Scope"),
                    ]} minWidth={1100} showEdit={false}>
                      {details.services.map((service, index) => <DetailRow
                        key={service.id}
                        showEdit={false}
                        highlighted={index === highlightedItemIndex}
                        cells={[
                          service.name,
                          service.category || "Chưa phân loại",
                          service.price == null ? "Chưa có giá" : formatMoney(service.price),
                          service.unit || "—",
                          service.shared ? "Dùng chung" : "Riêng chi nhánh",
                        ]}
                        onView={() => viewItem(service.name, [
                          { label: "Mã dịch vụ", value: service.id },
                          { label: "Tên dịch vụ", value: service.name },
                          { label: "Danh mục", value: service.category || "Chưa phân loại" },
                          { label: "Giá", value: service.price == null ? "Chưa có giá" : `${formatMoney(service.price)}${service.unit ? `/${service.unit}` : ""}` },
                          { label: "Phạm vi", value: service.shared ? "Dùng chung" : "Riêng chi nhánh" },
                        ])}
                      />)}
                    </DetailList>
                  )}
                  {activeCategory === "promotions" && (
                    <DetailList count={details.promotions.length} columns={[
                      localizedText("Tên khuyến mãi", "Promotion"),
                      localizedText("Mã", "Code"),
                      localizedText("Trạng thái", "Status"),
                      localizedText("Ngày bắt đầu", "Start date"),
                      localizedText("Ngày kết thúc", "End date"),
                    ]} minWidth={1200} showEdit={false}>
                      {details.promotions.map((promotion, index) => <DetailRow
                        key={promotion.id}
                        showEdit={false}
                        highlighted={index === highlightedItemIndex}
                        cells={[
                          promotion.name,
                          promotion.code,
                          promotion.status || "Chưa có",
                          promotion.startDate ? new Date(promotion.startDate).toLocaleDateString(i18n.language.startsWith("en") ? "en-US" : "vi-VN") : localizedText("Chưa có", "Not available"),
                          promotion.endDate ? new Date(promotion.endDate).toLocaleDateString(i18n.language.startsWith("en") ? "en-US" : "vi-VN") : localizedText("Chưa có", "Not available"),
                        ]}
                        onView={() => viewItem(promotion.name, [
                          { label: "Mã khuyến mãi", value: promotion.code },
                          { label: "Tên", value: promotion.name },
                          { label: "Trạng thái", value: promotion.status || "Chưa có" },
                          { label: localizedText("Ngày bắt đầu", "Start date"), value: promotion.startDate ? new Date(promotion.startDate).toLocaleDateString(i18n.language.startsWith("en") ? "en-US" : "vi-VN") : localizedText("Chưa có", "Not available") },
                          { label: localizedText("Ngày kết thúc", "End date"), value: promotion.endDate ? new Date(promotion.endDate).toLocaleDateString(i18n.language.startsWith("en") ? "en-US" : "vi-VN") : localizedText("Chưa có", "Not available") },
                        ])}
                      />)}
                    </DetailList>
                  )}
                  {activeCategory === "roomPolicies" && (
                    <RoomPolicyEditor
                      hotelId={details.branch.id}
                      policies={details.roomPolicies ?? []}
                      highlightedReference={highlightedDetailReference?.category === "roomPolicies" ? highlightedDetailReference.id : null}
                      isSaving={isSavingRoomPolicy}
                      message={roomPolicyMessage}
                      error={roomPolicyError}
                      onSave={async (policy) => {
                        setRoomPolicyMessage("");
                        setRoomPolicyError("");
                        try {
                          if (policy.id) {
                            await updateBranchRoomPolicy({
                              policyId: policy.id,
                              request: {
                                basePrice: policy.basePrice,
                                extraAdultFee: policy.extraAdultFee,
                                extraChildFee: policy.extraChildFee,
                                area: policy.area,
                                standardCapacity: policy.standardCapacity,
                                maxExtraGuests: policy.maxExtraGuests,
                              },
                            }).unwrap();
                          } else {
                            await saveRoomPolicies({
                              hotelId: details.branch.id,
                              policies: [policy],
                            }).unwrap();
                          }
                          setRoomPolicyMessage(localizedText(`${roomTypeName(policy.roomType)} đã được lưu cho chi nhánh.`, `${roomTypeName(policy.roomType)} saved for the branch.`));
                        } catch (error) {
                          setRoomPolicyError(getErrorMessage(error, localizedText("Không thể lưu cấu hình loại phòng.", "Could not save the room type configuration.")));
                        }
                      }}
                    />
                  )}
                </div>
              </div>
            </>}
      {viewingItem && (
        <div
          className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/50 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setViewingItem(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="branch-record-detail-title"
            className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">{activeCategoryInfo.label}</p>
                <h3 id="branch-record-detail-title" className="mt-1 break-words text-lg font-bold text-slate-900">{viewingItem.title}</h3>
              </div>
              <button type="button" onClick={() => setViewingItem(null)} aria-label="Đóng" className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
                <X size={18} />
              </button>
            </div>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              {viewingItem.fields.map((field) => (
                <div key={field.label} className="min-w-0 rounded-lg bg-slate-50 p-3">
                  <dt className="text-xs font-medium text-slate-500">{field.label}</dt>
                  <dd className="mt-1 break-words text-sm font-semibold text-slate-800">{field.value}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-5 flex justify-end">
              <button type="button" onClick={() => setViewingItem(null)} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700">
                Đóng
              </button>
            </div>
          </section>
        </div>
      )}
      {editingBuilding && (
        <div
          className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/50 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isUpdatingBuilding) {
              setEditingBuilding(null);
            }
          }}
        >
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-building-title"
            onSubmit={(event) => {
              event.preventDefault();
              const name = buildingName.trim().replace(/\s+/g, " ");
              if (!name) {
                setBuildingError(localizedText("Vui lòng nhập tên tòa nhà.", "Enter a building name."));
                return;
              }

              setBuildingError("");
              void updateBuilding({
                buildingId: editingBuilding.id,
                body: { name },
              }).unwrap()
                .then(() => {
                  setEditingBuilding(null);
                })
                .catch((error: unknown) => {
                  setBuildingError(getErrorMessage(error, localizedText("Không thể cập nhật tòa nhà.", "Could not update the building.")));
                });
            }}
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Tòa nhà</p>
                <h3 id="edit-building-title" className="mt-1 text-lg font-bold text-slate-900">
                  Chỉnh sửa tòa nhà
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingBuilding(null)}
                disabled={isUpdatingBuilding}
                aria-label="Đóng"
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
              >
                <X size={18} />
              </button>
            </div>
            <label className="mt-4 block text-sm font-semibold text-slate-700">
              Tên tòa nhà
              <input
                autoFocus
                required
                value={buildingName}
                onChange={(event) => setBuildingName(event.target.value)}
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none focus:border-blue-400"
              />
            </label>
            {buildingError && <p role="alert" className="mt-3 text-sm text-rose-600">{buildingError}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingBuilding(null)}
                disabled={isUpdatingBuilding}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isUpdatingBuilding || !buildingName.trim()}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isUpdatingBuilding ? "Đang lưu..." : "Lưu thay đổi"}
              </button>
            </div>
          </form>
        </div>
      )}
      {editingFloor && (
        <div
          className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/50 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isUpdatingFloor) {
              setEditingFloor(null);
            }
          }}
        >
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-floor-title"
            onSubmit={(event) => {
              event.preventDefault();
              const nextFloorNumber = Number(floorNumber);
              if (!Number.isSafeInteger(nextFloorNumber)) {
                setFloorError(localizedText("Số tầng phải là số nguyên hợp lệ.", "The floor number must be a valid whole number."));
                return;
              }

              setFloorError("");
              void updateFloor({
                floorId: editingFloor.id,
                floorNumber: nextFloorNumber,
              }).unwrap()
                .then(() => setEditingFloor(null))
                .catch((error: unknown) => {
                  setFloorError(getErrorMessage(error, localizedText("Không thể cập nhật tầng.", "Could not update the floor.")));
                });
            }}
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Tầng</p>
                <h3 id="edit-floor-title" className="mt-1 text-lg font-bold text-slate-900">
                  Chỉnh sửa tầng
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingFloor(null)}
                disabled={isUpdatingFloor}
                aria-label="Đóng"
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
              >
                <X size={18} />
              </button>
            </div>
            <label className="mt-4 block text-sm font-semibold text-slate-700">
              Số tầng
              <input
                autoFocus
                required
                type="number"
                step="1"
                value={floorNumber}
                onChange={(event) => setFloorNumber(event.target.value)}
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none focus:border-blue-400"
              />
            </label>
            {floorError && <p role="alert" className="mt-3 text-sm text-rose-600">{floorError}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingFloor(null)}
                disabled={isUpdatingFloor}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isUpdatingFloor || floorNumber.trim() === ""}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isUpdatingFloor ? "Đang lưu..." : "Lưu thay đổi"}
              </button>
            </div>
          </form>
        </div>
      )}
      {roomEditError && !editingRoom && (
        <div role="alert" className="fixed bottom-5 right-5 z-[70] max-w-md rounded-xl border border-rose-200 bg-white p-4 text-sm text-rose-700 shadow-lg">
          {roomEditError}
          <button type="button" onClick={() => setRoomEditError("")} className="ml-3 font-semibold underline">Đóng</button>
        </div>
      )}
      {editingRoom && (
        <RoomEditForm
          draft={{
            roomNumber: editingRoom.roomNumber,
            roomType: editingRoom.roomType,
            floorId: editingRoom.floorId,
            roomStatus: editingRoom.roomStatus,
            area: editingRoom.area,
            basePrice: editingRoom.basePrice,
            standardCapacity: editingRoom.standardCapacity,
            maxExtraGuests: editingRoom.maxExtraGuests,
            extraAdultFee: editingRoom.extraAdultFee,
            extraChildFee: editingRoom.extraChildFee,
            images: editingRoom.images,
            defaultImageIndex: editingRoom.defaultImageIndex,
            amenityIds: editingRoom.amenityIds,
            beds: editingRoom.beds,
          }}
          onDraftChange={(draft: RoomEditDraft) => setEditingRoom((current) => current ? {
            ...current,
            ...draft,
          } : current)}
          buildings={(details?.buildings ?? []).map((building) => ({
            value: building.id,
            label: building.name,
          }))}
          floors={(details?.floors ?? []).map((floor) => ({
            value: floor.id,
            label: `${floor.buildingName} · Tầng ${floor.floorNumber}`,
            buildingId: floor.buildingId,
          }))}
          roomTypes={editRoomTypes.map((value) => ({ value, label: value }))}
          roomStatuses={editRoomStatuses.map((value) => ({ value, label: value }))}
          amenities={editAmenities}
          bedTypes={editBedTypes
            .filter((bedType) => bedType.id != null)
            .map((bedType) => ({
              id: Number(bedType.id),
              name: String(bedType.name ?? bedType.bedTypeName ?? `Loại giường ${bedType.id}`),
              isExtraBed: bedType.isExtraBed,
            }))}
          imageFiles={roomEditImageFiles}
          onImageFilesChange={setRoomEditImageFiles}
          isSaving={isUpdatingRoom}
          error={roomEditError}
          onCancel={() => {
            if (!isUpdatingRoom) {
              setEditingRoom(null);
              setRoomEditImageFiles([]);
            }
          }}
          onSave={() => {
            if (!editingRoom) return;
            setRoomEditError("");
            void updateRoom({
              roomId: editingRoom.id,
              room: {
                roomNumber: editingRoom.roomNumber.trim(),
                floorId: editingRoom.floorId,
                roomType: editingRoom.roomType,
                roomStatus: editingRoom.roomStatus,
                defaultImageIndex: editingRoom.defaultImageIndex,
                amenityIds: editingRoom.amenityIds,
                beds: editingRoom.beds,
                keptImageUrls: editingRoom.images.filter((image) => !image.startsWith("blob:")),
              },
              images: roomEditImageFiles,
            }).unwrap()
              .then(() => {
                setEditingRoom(null);
                setRoomEditImageFiles([]);
              })
              .catch((error: unknown) => {
                setRoomEditError(getErrorMessage(error, localizedText("Không thể cập nhật phòng.", "Could not update the room.")));
              });
          }}
        />
      )}
    </section>
  );
}

const roomTypes: SuperAdminRoomPolicy["roomType"][] = ["STANDARD", "DELUXE", "SUITE", "FAMILY"];
const roomTypeName = (roomType: SuperAdminRoomPolicy["roomType"]) => ({
  STANDARD: localizedText("Phòng tiêu chuẩn", "Standard room"),
  DELUXE: localizedText("Phòng cao cấp", "Deluxe room"),
  SUITE: localizedText("Phòng thượng hạng", "Suite"),
  FAMILY: localizedText("Phòng gia đình", "Family room"),
}[roomType]);

function RoomPolicyEditor({
  hotelId,
  policies,
  highlightedReference,
  isSaving,
  message,
  error,
  onSave,
}: {
  hotelId: number;
  policies: SuperAdminRoomPolicy[];
  highlightedReference: string | null;
  isSaving: boolean;
  message: string;
  error: string;
  onSave: (policy: SuperAdminRoomPolicy) => Promise<void>;
}) {
  const [drafts, setDrafts] = useState<Record<SuperAdminRoomPolicy["roomType"], SuperAdminRoomPolicy>>(() =>
    Object.fromEntries(roomTypes.map((roomType) => {
      const current = policies.find((item) => item.roomType === roomType);
      return [roomType, current ?? {
        roomType,
        area: 0,
        basePrice: 0,
        extraAdultFee: 0,
        extraChildFee: 0,
        standardCapacity: 2,
        maxExtraGuests: 0,
      }];
    })) as Record<SuperAdminRoomPolicy["roomType"], SuperAdminRoomPolicy>,
  );

  useEffect(() => {
    setDrafts(Object.fromEntries(roomTypes.map((roomType) => {
      const current = policies.find((item) => item.roomType === roomType);
      return [roomType, current ?? {
        roomType,
        area: 0,
        basePrice: 0,
        extraAdultFee: 0,
        extraChildFee: 0,
        standardCapacity: 2,
        maxExtraGuests: 0,
      }];
    })) as Record<SuperAdminRoomPolicy["roomType"], SuperAdminRoomPolicy>);
  }, [hotelId, policies]);

  const highlightedRoomType = highlightedReference
    ? policies.find((policy) => policy.id === highlightedReference)?.roomType
      ?? roomTypes.find((roomType) => roomType === highlightedReference.toLocaleUpperCase())
    : undefined;

  useLayoutEffect(() => {
    if (highlightedRoomType) {
      document.getElementById("highlighted-branch-detail-row")?.scrollIntoView({ block: "center" });
    }
  }, [highlightedRoomType]);

  const change = (roomType: SuperAdminRoomPolicy["roomType"], field: keyof Omit<SuperAdminRoomPolicy, "id" | "roomType">, value: string) => {
    setDrafts((current) => ({
      ...current,
      [roomType]: { ...current[roomType], [field]: Number(value) },
    }));
  };

  return (
    <section className="rounded-xl border border-blue-100 bg-blue-50/40 p-4 md:col-span-2">
      <p className="mt-1 text-xs leading-5 text-slate-500">
        {localizedText(
          "Super Admin thiết lập ban đầu. Quản lý chi nhánh có thể điều chỉnh lại trong phần cấu hình giá.",
          "Configured initially by the Super Admin. Branch managers can adjust these settings in pricing configuration.",
        )}
      </p>
      <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full min-w-[1250px] text-left text-xs">
          <thead className="bg-slate-50 font-semibold text-slate-500">
            <tr>
              <th scope="col" className="px-3 py-3">STT</th>
              <th scope="col" className="px-3 py-3">{localizedText("Loại phòng", "Room type")}</th>
              <th scope="col" className="px-3 py-3">{localizedText("Trạng thái", "Status")}</th>
              <th scope="col" className="px-3 py-3">{localizedText("Giá cơ bản", "Base price")}</th>
              <th scope="col" className="px-3 py-3">{localizedText("Diện tích (m²)", "Area (m²)")}</th>
              <th scope="col" className="px-3 py-3">{localizedText("Sức chứa chuẩn", "Standard capacity")}</th>
              <th scope="col" className="px-3 py-3">{localizedText("Khách thêm tối đa", "Max. extra guests")}</th>
              <th scope="col" className="px-3 py-3">{localizedText("Phụ thu người lớn", "Extra adult fee")}</th>
              <th scope="col" className="px-3 py-3">{localizedText("Phụ thu trẻ em", "Extra child fee")}</th>
              <th scope="col" className="px-3 py-3 text-center">{localizedText("Thao tác", "Actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {roomTypes.map((roomType, index) => {
              const policy = drafts[roomType];
              const exists = policies.some((item) => item.roomType === roomType);
              return (
                <tr
                  key={roomType}
                  id={highlightedRoomType === roomType ? "highlighted-branch-detail-row" : undefined}
                  className={`align-middle text-slate-700 ${highlightedRoomType === roomType ? "bg-amber-100 outline outline-2 outline-amber-400" : ""}`}
                >
                  <td className="px-3 py-3 tabular-nums text-slate-500">{index + 1}</td>
                  <td className="whitespace-nowrap px-3 py-3 font-semibold text-slate-900">{roomTypeName(roomType)}</td>
                  <td className="px-3 py-3">
                    <span className={`whitespace-nowrap rounded-full px-2 py-1 text-[10px] font-semibold ${exists ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                      {exists ? localizedText("Đã cấu hình", "Configured") : localizedText("Chưa cấu hình", "Not configured")}
                    </span>
                  </td>
                  <td className="min-w-32 px-3 py-2"><PolicyInput label={localizedText("Giá cơ bản", "Base price")} value={policy.basePrice} onChange={(value) => change(roomType, "basePrice", value)} /></td>
                  <td className="min-w-28 px-3 py-2"><PolicyInput label={localizedText("Diện tích (m²)", "Area (m²)")} value={policy.area} onChange={(value) => change(roomType, "area", value)} /></td>
                  <td className="min-w-28 px-3 py-2"><PolicyInput label={localizedText("Sức chứa chuẩn", "Standard capacity")} value={policy.standardCapacity} min={1} onChange={(value) => change(roomType, "standardCapacity", value)} /></td>
                  <td className="min-w-32 px-3 py-2"><PolicyInput label={localizedText("Khách thêm tối đa", "Max. extra guests")} value={policy.maxExtraGuests} onChange={(value) => change(roomType, "maxExtraGuests", value)} /></td>
                  <td className="min-w-32 px-3 py-2"><PolicyInput label={localizedText("Phụ thu người lớn", "Extra adult fee")} value={policy.extraAdultFee} onChange={(value) => change(roomType, "extraAdultFee", value)} /></td>
                  <td className="min-w-32 px-3 py-2"><PolicyInput label={localizedText("Phụ thu trẻ em", "Extra child fee")} value={policy.extraChildFee} onChange={(value) => change(roomType, "extraChildFee", value)} /></td>
                  <td className="whitespace-nowrap px-3 py-2 text-center">
                    <button
                      type="button"
                      disabled={isSaving || policy.area <= 0 || policy.basePrice < 0 || policy.standardCapacity < 1}
                      onClick={() => void onSave(policy)}
                      className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isSaving
                        ? localizedText("Đang lưu...", "Saving...")
                        : exists
                          ? localizedText("Cập nhật", "Update")
                          : localizedText("Thêm", "Add")}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {message && <p role="status" className="mt-3 text-sm font-medium text-emerald-700">{message}</p>}
      {error && <p role="alert" className="mt-3 text-sm font-medium text-rose-700">{error}</p>}
    </section>
  );
}

function PolicyInput({ label, value, min = 0, onChange }: { label: string; value: number; min?: number; onChange: (value: string) => void }) {
  return (
    <label className="block text-[11px] font-medium text-slate-500">
      {label}
      <input type="number" min={min} step="any" value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 h-9 w-full rounded-md border border-slate-200 px-2 text-xs text-slate-800 outline-none focus:border-blue-400" />
    </label>
  );
}

type BranchDetailCategory = "employees" | "buildings" | "floors" | "rooms" | "bookings" | "services" | "promotions" | "roomPolicies";
type DetailField = { label: string; value: string };

function DetailList({
  count,
  columns,
  minWidth = 900,
  showEdit = true,
  emptyMessage = localizedText("Chưa có dữ liệu trong danh mục này.", "No data is available in this category."),
  children,
}: {
  count: number;
  columns: string[];
  minWidth?: number;
  showEdit?: boolean;
  emptyMessage?: string;
  children: React.ReactNode;
}) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [visibleColumns, setVisibleColumns] = useState<boolean[]>(() => columns.map(() => true));
  const pageSize = 20;
  const rows = Children.toArray(children);
  const normalizedSearch = search.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("vi");
  const filteredRows = normalizedSearch
    ? rows.filter((row) => {
      if (!isValidElement<{ cells?: React.ReactNode[] }>(row)) return false;
      return (row.props.cells ?? []).some((cell) =>
        getDetailCellText(cell).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("vi").includes(normalizedSearch),
      );
    })
    : rows;
  const filteredHighlightedIndex = filteredRows.findIndex((row) =>
    isValidElement<{ highlighted?: boolean }>(row) && row.props.highlighted,
  );
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const visibleRows = filteredRows.slice((safePage - 1) * pageSize, safePage * pageSize);
  const visibleCellIndexes = columns
    .map((_, index) => index)
    .filter((index) => visibleColumns[index] !== false);
  const shownColumns = visibleCellIndexes.length > 0 ? visibleCellIndexes : [0];

  useLayoutEffect(() => {
    setPage(filteredHighlightedIndex >= 0 ? Math.floor(filteredHighlightedIndex / pageSize) + 1 : 1);
  }, [columns.join("|"), filteredHighlightedIndex, normalizedSearch]);

  useLayoutEffect(() => {
    if (filteredHighlightedIndex >= 0 && Math.floor(filteredHighlightedIndex / pageSize) + 1 === safePage) {
      const animationFrame = window.requestAnimationFrame(() => {
        document.getElementById("highlighted-branch-detail-row")?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      });
      return () => window.cancelAnimationFrame(animationFrame);
    }
  }, [filteredHighlightedIndex, safePage]);

  return (
    <section className="min-w-0">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="relative min-w-56 flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={localizedText("Tìm kiếm...", "Search...")}
            aria-label={localizedText("Tìm kiếm trong danh sách", "Search this list")}
            className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
        </label>
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={localizedText("Tùy chỉnh cột hiển thị", "Customize visible columns")}
              className="flex h-10 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Columns3 size={16} />
              {localizedText("Cột", "Columns")}
              <ChevronDown size={16} />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-56 p-2">
            <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              {localizedText("Hiển thị cột", "Show columns")}
            </p>
            {columns.map((column, index) => {
              const isVisible = visibleColumns[index] !== false;
              const isLastVisibleColumn = shownColumns.length === 1 && isVisible;
              return (
                <label key={column} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm text-slate-700 hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={isVisible}
                    disabled={isLastVisibleColumn}
                    onChange={(event) => {
                      setVisibleColumns((current) => columns.map((_, columnIndex) =>
                        columnIndex === index ? event.target.checked : current[columnIndex] !== false,
                      ));
                    }}
                    className="h-4 w-4 rounded border-slate-300 accent-blue-600"
                  />
                  {column}
                </label>
              );
            })}
          </PopoverContent>
        </Popover>
        <span className="ml-auto text-xs text-slate-500">
          {normalizedSearch
            ? `${filteredRows.length}/${count} ${localizedText("kết quả", "results")}`
            : `${count} ${localizedText("mục", "items")}`}
        </span>
      </div>
      <div className="max-h-[32rem] overflow-auto rounded-lg border border-slate-200">
        {filteredRows.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">
            {normalizedSearch ? localizedText("Không tìm thấy kết quả phù hợp.", "No matching results found.") : emptyMessage}
          </p>
        ) : (
          <table className="w-full text-left text-sm" style={{ minWidth }}>
            <thead className="sticky top-0 z-10 bg-slate-50 text-xs font-semibold text-slate-500">
              <tr>
                <th scope="col" className="w-16 whitespace-nowrap px-4 py-3">STT</th>
                {shownColumns.map((index) => (
                  <th scope="col" key={columns[index]} className="whitespace-nowrap px-4 py-3">{columns[index]}</th>
                ))}
                <th scope="col" className="px-4 py-3 text-right">
                  {showEdit ? localizedText("Thao tác", "Actions") : localizedText("Chi tiết", "Details")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleRows.map((row, index) => isValidElement<{ serialNumber?: number; visibleCellIndexes?: number[] }>(row)
                ? cloneElement(row, { serialNumber: (safePage - 1) * pageSize + index + 1, visibleCellIndexes: shownColumns })
                : row)}
            </tbody>
          </table>
        )}
      </div>
      {filteredRows.length > pageSize && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
          <span>
            {localizedText("Hiển thị", "Showing")} {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, filteredRows.length)} / {filteredRows.length} {localizedText("mục", "items")}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={safePage === 1}
              className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {localizedText("Trước", "Previous")}
            </button>
            <span className="tabular-nums">{localizedText("Trang", "Page")} {safePage} / {totalPages}</span>
            <button
              type="button"
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              disabled={safePage === totalPages}
              className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {localizedText("Sau", "Next")}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function DetailRow({
  cells,
  onView,
  onEdit,
  editLoading = false,
  showEdit = true,
  highlighted = false,
  serialNumber = 0,
  visibleCellIndexes,
}: {
  cells: React.ReactNode[];
  onView: () => void;
  onEdit?: () => void;
  editLoading?: boolean;
  showEdit?: boolean;
  highlighted?: boolean;
  serialNumber?: number;
  visibleCellIndexes?: number[];
}) {
  return (
    <tr
      id={highlighted ? "highlighted-branch-detail-row" : undefined}
      className={`text-slate-700 transition ${highlighted ? "bg-amber-100 outline outline-2 outline-amber-400" : "hover:bg-slate-50/70"}`}
    >
      <td className="w-16 whitespace-nowrap px-4 py-3.5 text-xs font-semibold tabular-nums text-slate-500">
        {serialNumber}
      </td>
      {cells.map((cell, index) => (
        visibleCellIndexes && !visibleCellIndexes.includes(index) ? null :
        <td
          key={index}
          className={`max-w-72 px-4 py-3.5 ${index === 0 ? "font-semibold text-slate-900" : "text-xs text-slate-600"} ${index > 0 ? "break-words" : ""}`}
        >
          {cell}
        </td>
      ))}
      <td className="px-4 py-3 text-right">
        <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onView}
          className="inline-flex items-center gap-1.5 rounded-md border border-blue-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-50"
        >
          <Eye size={14} />
          {localizedText("Xem chi tiết", "View details")}
        </button>
        {showEdit && <button
          type="button"
          disabled={!onEdit || editLoading}
          title={onEdit
            ? localizedText("Chỉnh sửa", "Edit")
            : localizedText("Chưa kết nối API chỉnh sửa", "Edit API is not connected")}
          onClick={onEdit}
          className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-semibold ${
            onEdit
              ? "border-amber-200 bg-white text-amber-700 transition hover:border-amber-300 hover:bg-amber-50 hover:text-amber-800"
              : "cursor-not-allowed border-slate-300 bg-slate-100 text-slate-400"
          }`}
        >
          <Pencil size={14} />
          {editLoading
            ? localizedText("Đang tải...", "Loading...")
            : localizedText("Chỉnh sửa", "Edit")}
        </button>}
        </div>
      </td>
    </tr>
  );
}

function getDetailCellText(value: React.ReactNode): string {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(getDetailCellText).join(" ");
  if (isValidElement<{ children?: React.ReactNode }>(value)) return getDetailCellText(value.props.children);
  return "";
}
