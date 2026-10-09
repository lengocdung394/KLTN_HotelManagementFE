import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "@/components/ui/use-toast";
import { Baby, BedDouble, Building2, CalendarDays, Check, ChevronLeft, ChevronRight, Coins, ImagePlus, Info, MoreHorizontal, Pencil, Save, Search, SlidersHorizontal, Sparkles, Star, Upload, Users, X } from "lucide-react";
import BuildingManagementPanel from "../components/BuildingManagementPanel";
import FloorManagementPanel from "../components/FloorManagementPanel";
import EventPricingCalendar from "../components/EventPricingCalendar";
import RoomAmenitiesTab from "../components/RoomAmenitiesTab";
import RoomListTab from "../components/RoomListTab";
import RoomDetailModal, { type RoomDetailsData } from "../components/RoomDetailModal";
import BulkImportDialog from "../components/BulkImportDialog";
import RoomImportProgressCard from "../components/RoomImportProgressCard";
import { Label } from "@radix-ui/react-label";
import { useCreateRoomMutation, useGetAllBedTypesQuery, useGetRoomStatusesQuery, useGetRoomTypeDetailQuery, useGetRoomTypesQuery, useGetRoomsByCurrentHotelQuery, useUpdateRoomMutation } from "../services/roomApi";
import { getAmenityImportStatus, isAmenityImportFinished, useGetAllAmenitiesQuery, useImportAmenitiesFromFileMutation, type AmenityResponse } from "../services/amenityApi.ts";
import { useCreateBuildingMutation, useGetBuildingsByCurrentHotelQuery, useUpdateBuildingMutation } from "../services/buildingApi";
import { useCreateFloorMutation, useGetFloorsByBuildingIdQuery, useGetFloorsByHotelIdQuery, useUpdateFloorMutation } from "../services/floorApi";
import { useGetBranchRoomPoliciesQuery, useUpdateBranchRoomPolicyMutation } from "../services/branchRoomPolicyApi";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { baseApi } from "../services/baseApi";
import { bindHotelSocketEvents } from "../lib/socket";
import { downloadRoomTemplate, parseRoomImportArchive, type RoomImportOptions, type RoomImportRowResult } from "../lib/roomBulkImport";
import { downloadAmenityTemplate } from "../lib/amenityBulkImport";
import { getRoomImportErrorMessage, getRoomImportStatus, isRoomImportFinished, startRoomImport } from "../services/roomImportApi";
import { uploadRoomImagesToCloudinary } from "../services/cloudinaryUploadApi";

type ImportedRoomRow = Record<string, string>;
type ImportTarget = "rooms" | "buildings" | "floors" | "amenities";
type RoomSocketImportProgress = {
  taskId: string;
  percent: number | null;
  message: string;
  completed: boolean;
  rows: RoomImportRowResult[];
};

const parseRoomSocketImportProgress = (data: unknown): RoomSocketImportProgress => {
  const payload = data && typeof data === "object" ? data as Record<string, unknown> : {};
  const detailItems = Array.isArray(payload.data) ? payload.data : Array.isArray(payload.details) ? payload.details : [];
  const rows = detailItems.map((item, index): RoomImportRowResult => {
    const detail = item && typeof item === "object" ? item as Record<string, unknown> : {};
    const readString = (...keys: string[]) => {
      const value = keys.map((key) => detail[key]).find((candidate) => candidate !== undefined && candidate !== null);
      return typeof value === "string" || typeof value === "number" ? String(value) : "";
    };
    const rowNumber = Number(readString("rowNumber", "row", "lineNumber", "excelRow")) || index + 1;
    const roomNumber = readString("roomNumber", "roomNo", "roomCode", "roomId", "number");
    const rawStatus = readString("status", "result", "state").trim().toLocaleLowerCase();
    const explicitResult = [detail.passed, detail.success, detail.isSuccess, detail.valid, detail.isValid, detail.imported]
      .find((value) => typeof value === "boolean");
    const passed = typeof explicitResult === "boolean"
      ? explicitResult
      : ["success", "succeeded", "completed", "pass", "passed", "valid", "imported"].includes(rawStatus);
    const message = readString("message", "error", "reason", "detail", "description");
    return {
      rowNumber: Number.isFinite(rowNumber) ? rowNumber : index + 1,
      roomNumber,
      passed,
      ...(!passed ? { message: message || (rawStatus ? `Trạng thái xử lý: ${rawStatus}` : "Dòng chưa được đánh dấu thành công từ máy chủ.") } : {}),
    };
  });
  const percentValue = payload.percent ?? payload.percentage ?? payload.progress;
  const percent = typeof percentValue === "number" && Number.isFinite(percentValue)
    ? Math.min(100, Math.max(0, percentValue))
    : null;
  const rawTaskStatus = String(payload.status ?? "").trim().toUpperCase();
  return {
    taskId: typeof payload.taskId === "string" || typeof payload.taskId === "number" ? String(payload.taskId) : "",
    percent,
    message: typeof payload.message === "string" ? payload.message : "Đang nhận tiến trình nhập phòng.",
    completed: payload.completed === true ||
      (percent !== null && percent >= 100) ||
      ["COMPLETED", "COMPLETE", "SUCCESS", "SUCCEEDED", "FAILED", "ERROR", "DONE"].includes(rawTaskStatus),
    rows,
  };
};

const normalizeImportedValue = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "").trim();
const getImportedValue = (row: ImportedRoomRow, names: string[]) =>
  names.map(normalizeImportedValue).map((name) => row[name]).find((value) => value?.trim())?.trim() ?? "";

const parseCsv = (text: string): ImportedRoomRow[] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const nextCharacter = text[index + 1];
    if (character === '"' && quoted && nextCharacter === '"') { cell += '"'; index += 1; continue; }
    if (character === '"') { quoted = !quoted; continue; }
    if (character === "," && !quoted) { row.push(cell.trim()); cell = ""; continue; }
    if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && nextCharacter === "\n") index += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = []; cell = ""; continue;
    }
    cell += character;
  }
  if (cell || row.length > 0) { row.push(cell.trim()); rows.push(row); }
  const headers = (rows.shift() ?? []).map(normalizeImportedValue);
  return rows.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
};

const readImportRows = async (file: File) => file.name.toLowerCase().endsWith(".csv")
  ? parseCsv(await file.text())
  : parseXlsx(await file.arrayBuffer());

const readZipEntry = async (data: ArrayBuffer, entryName: string) => {
  const bytes = new Uint8Array(data);
  const view = new DataView(data);
  let endOffset = -1;
  for (let index = bytes.length - 22; index >= Math.max(0, bytes.length - 65557); index -= 1) {
    if (view.getUint32(index, true) === 0x06054b50) { endOffset = index; break; }
  }
  if (endOffset < 0) throw new Error("File Excel không hợp lệ.");
  const entryCount = view.getUint16(endOffset + 10, true);
  const directoryOffset = view.getUint32(endOffset + 16, true);
  let cursor = directoryOffset;
  for (let entry = 0; entry < entryCount; entry += 1) {
    if (view.getUint32(cursor, true) !== 0x02014b50) break;
    const compression = view.getUint16(cursor + 10, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const localOffset = view.getUint32(cursor + 42, true);
    const name = new TextDecoder().decode(bytes.slice(cursor + 46, cursor + 46 + nameLength));
    cursor += 46 + nameLength + extraLength + commentLength;
    if (name !== entryName) continue;
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const compressed = bytes.slice(localOffset + 30 + localNameLength + localExtraLength, localOffset + 30 + localNameLength + localExtraLength + compressedSize);
    if (compression === 0) return compressed;
    if (compression === 8) return new Uint8Array(await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer());
    throw new Error("Định dạng nén Excel không được hỗ trợ.");
  }
  return null;
};

const parseXlsx = async (data: ArrayBuffer): Promise<ImportedRoomRow[]> => {
  const sharedXml = await readZipEntry(data, "xl/sharedStrings.xml");
  const sheetXml = await readZipEntry(data, "xl/worksheets/sheet1.xml");
  if (!sheetXml) throw new Error("Không tìm thấy bảng dữ liệu trong file Excel.");
  const parser = new DOMParser();
  const sharedStrings = sharedXml ? Array.from(parser.parseFromString(new TextDecoder().decode(sharedXml), "application/xml").querySelectorAll("si")).map((item) => item.textContent?.trim() ?? "") : [];
  const sheet = parser.parseFromString(new TextDecoder().decode(sheetXml), "application/xml");
  const rows = Array.from(sheet.querySelectorAll("row")).map((row) => {
    const values: string[] = [];
    Array.from(row.querySelectorAll(":scope > c")).forEach((cell) => {
      const reference = cell.getAttribute("r") ?? "";
      const column = reference.replace(/\d/g, "");
      const columnIndex = [...column].reduce((total, character) => total * 26 + character.charCodeAt(0) - 64, 0) - 1;
      const raw = cell.querySelector("v")?.textContent ?? cell.querySelector("t")?.textContent ?? "";
      values[columnIndex] = cell.getAttribute("t") === "s" ? sharedStrings[Number(raw)] ?? "" : raw;
    });
    return values;
  });
  const headers = (rows.shift() ?? []).map(normalizeImportedValue);
  return rows.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
};

const buildingCodes = ["A", "B", "C", "D"] as const;
type Building = { id: string; name: string };
const initialBuildings: Building[] = buildingCodes.map((id) => ({ id, name: `Tòa ${id}` }));
const createBuildingCode = (currentBuildings: Building[]) => {
  let code = "";
  do {
    code = `TN-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  } while (currentBuildings.some((building) => building.id === code));
  return code;
};
type Room = RoomDetailsData;
type RoomBedConfiguration = { bedTypeId: number; name?: string; quantity: number };

const parseRoomBedConfiguration = (
  value: unknown,
  bedTypes: Array<{ id?: number; name?: string; bedTypeName?: string }> = [],
): RoomBedConfiguration | null => {
  if (!value || typeof value !== "object") return null;

  const bed = value as Record<string, unknown>;
  const bedType = bed.bedType && typeof bed.bedType === "object"
    ? bed.bedType as Record<string, unknown>
    : {};
  const nameValue = bed.bedTypeName ?? bedType.name ?? bed.name;
  const name = typeof nameValue === "string" ? nameValue.trim() : "";
  const matchingBedType = bedTypes.find((item) =>
    Number(item.id) === Number(bed.bedTypeId ?? bedType.id ?? bed.id)
    || normalizeText(item.name ?? item.bedTypeName ?? "") === normalizeText(name),
  );
  const bedTypeId = Number(bed.bedTypeId ?? bedType.id ?? bed.id ?? matchingBedType?.id);
  const quantity = Number(bed.quantity ?? bed.bedQuantity ?? 1);

  if (!Number.isSafeInteger(bedTypeId) || bedTypeId <= 0 || !Number.isSafeInteger(quantity) || quantity <= 0) {
    return null;
  }

  const resolvedName = name || matchingBedType?.name || matchingBedType?.bedTypeName;
  return { bedTypeId, quantity, ...(resolvedName ? { name: resolvedName } : {}) };
};

const deduplicateRoomBedConfigurations = (beds: RoomBedConfiguration[]) => {
  const uniqueBeds = new Map<string, RoomBedConfiguration>();
  beds.forEach((bed) => {
    const key = normalizeText(bed.name ?? "") || `id:${bed.bedTypeId}`;
    const existing = uniqueBeds.get(key);
    if (!existing || bed.quantity > existing.quantity) {
      uniqueBeds.set(key, bed);
    }
  });
  return [...uniqueBeds.values()];
};

const employees = ["Nguyễn Thị Mai", "Lê Thị Hương", "Phạm Ngọc Anh", "Trần Minh Tú"];
const statuses = ["Sẵn sàng", "Đang dọn", "Đang ở", "Bảo trì"];
const statusStyle: Record<string, string> = { "Sẵn sàng": "bg-emerald-50 text-emerald-700", "Đang dọn": "bg-amber-50 text-amber-700", "Đang ở": "bg-blue-50 text-blue-700", "Bảo trì": "bg-rose-50 text-rose-700" };
const roomTypeLabels: Record<string, string> = {
  STANDARD: "Phòng Tiêu Chuẩn",
  DELUXE: "Phòng Cao Cấp",
  SUITE: "Phòng Thượng Hạng",
  FAMILY: "Phòng Gia Đình",
};
const roomTypeAliases: Record<string, string> = {
  "Standard Room": "STANDARD",
  "Deluxe Room": "DELUXE",
  "Superior Room": "DELUXE",
  "Suite Room": "SUITE",
  "Family Room": "FAMILY",
};
const roomTypeValues: Record<string, string> = {
  ...Object.fromEntries(Object.entries(roomTypeLabels).map(([value, label]) => [label, value])),
  ...roomTypeAliases,
};
const statusLabels: Record<string, string> = { READY: "Sẵn sàng", MAINTENANCE: "Bảo trì", IN_USE: "Đang ở", CLEANING: "Đang dọn" };
const statusValues: Record<string, string> = Object.fromEntries(Object.entries(statusLabels).map(([value, label]) => [label, value]));
const roomTypeLabel = (value: string) => roomTypeLabels[value] ?? value;
const statusLabel = (value: string) => statusLabels[value] ?? value;
const money = (value: number) => value.toLocaleString("vi-VN") + "đ";
const formatRoomArea = (value: unknown) => {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? `${value} m²` : "Chưa cập nhật";
  }
  if (typeof value !== "string" || !value.trim()) return "Chưa cập nhật";
  const area = value.trim();
  if (/m(?:²|2)(?:\s|$)/i.test(area)) return area;
  const numericArea = Number(area.replace(",", "."));
  return Number.isFinite(numericArea) && numericArea > 0 ? `${numericArea} m²` : area;
};
type CreateRoomFormState = {
  roomNumber: string;
  roomType: string;
  building: string;
  floor: string;
  area: string;
  standardCapacity: string;
  maxExtraGuests: string;
  extraAdultFee: string;
  extraChildFee: string;
  bedType: string;
  bedConfigurations: Array<{ bedTypeId: number; quantity: number }>;
  description: string;
  amenities: string[];
  images: string[];
  defaultImage: string | null;
  status: string;
};

const roomTypeDetails: Record<string, { area: string; beds: string; capacity: number; guestPolicy: string; price: number; description: string }> = {
  "Standard Room": { area: "25 m²", beds: "1 giường đơn (1m x 1,2m)", capacity: 1, guestPolicy: "Người lớn: 1 · Trẻ nhỏ dưới 11 tuổi: 1 · Em bé dưới 12 tháng: 1", price: 1000000, description: "Phòng tiêu chuẩn có giường ngủ, bàn làm việc, TV, điều hòa và phòng tắm riêng. Có thể trang bị thêm minibar và ấm đun nước." },
  "Deluxe Room": { area: "45 m²", beds: "1 giường King Size (1,8m x 2m)", capacity: 2, guestPolicy: "Người lớn: 2 · Trẻ nhỏ dưới 11 tuổi: 1 · Em bé dưới 12 tháng: 1", price: 2000000, description: "Phòng hạng sang rộng rãi với giường King Size, TV màn hình lớn, minibar, khu vực tiếp khách và phòng tắm cao cấp." },
  "Suite Room": { area: "60 m²", beds: "1 giường King Size + 1 giường đơn", capacity: 3, guestPolicy: "Người lớn: 3 · Trẻ nhỏ dưới 11 tuổi: 1 · Em bé dưới 12 tháng: 1", price: 2500000, description: "Phòng Suite cao cấp gồm phòng khách riêng, phòng ngủ, khu vực làm việc và phòng tắm hiện đại; phù hợp cho gia đình, khách VIP hoặc doanh nhân." },
  "Family Room": { area: "45 m²", beds: "1 giường King Size + 1 giường đơn", capacity: 4, guestPolicy: "Người lớn: 4 · Trẻ nhỏ dưới 11 tuổi: 2 · Em bé dưới 12 tháng: 1", price: 2200000, description: "Phòng gia đình rộng rãi, phù hợp cho nhóm khách hoặc gia đình." },
};
const normalizeText = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
const getApiErrorMessage = (error: unknown, fallback: string) => {
  const errorRecord = error && typeof error === "object" ? error as { data?: unknown; message?: unknown } : {};
  const responseData = errorRecord.data && typeof errorRecord.data === "object"
    ? errorRecord.data as { message?: unknown }
    : undefined;
  if (typeof errorRecord.data === "string") return errorRecord.data;
  if (typeof responseData?.message === "string") return responseData.message;
  if (typeof errorRecord.message === "string") return errorRecord.message;
  return fallback;
};
const roomFormDefaults = (roomType: string) => {
  const details = roomTypeDetails[roomType] ?? roomTypeDetails["Standard Room"];
  return {
    area: details.area.replace(/[^\d.,]/g, ""),
    standardCapacity: String(details.capacity),
    maxExtraGuests: "",
    extraAdultFee: "",
    extraChildFee: "",
    bedType: details.beds,
    bedConfigurations: [],
  };
};

const emptyCreateRoomForm: CreateRoomFormState = {
  roomNumber: "",
  roomType: "Standard Room",
  building: "",
  floor: "",
  ...roomFormDefaults("Standard Room"),
  description: "",
  amenities: [],
  images: [],
  defaultImage: null,
  status: "Sẵn sàng",
};
const emptyBuildingForm = { name: "", code: "" };
const emptyFloorForm = { name: "" };

export default function RoomWorkspace() {
  const { t } = useTranslation();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const { hotelId, hotelName, roles } = useAppSelector((state) => state.auth);
  const canManageRooms = roles.includes("ROLE_MANAGER") || roles.includes("ROLE_SUPER_ADMIN");
  const canViewRoomStructure = canManageRooms || roles.includes("ROLE_EMPLOYEE");
  const { data: apiRoomTypes, isLoading: isRoomTypesLoading, isError: isRoomTypesError } = useGetRoomTypesQuery();
  const { data: apiBedTypes, isLoading: isBedTypesLoading, isError: isBedTypesError } = useGetAllBedTypesQuery();
  const { data: apiRoomStatuses, isLoading: isRoomStatusesLoading, isError: isRoomStatusesError } = useGetRoomStatusesQuery();
  const { data: apiAmenities, isLoading: isAmenitiesLoading, isError: isAmenitiesError } = useGetAllAmenitiesQuery();
  const [createRoom, { isLoading: isCreatingRoom }] = useCreateRoomMutation();
  const [updateRoomApi, { isLoading: isUpdatingRoom }] = useUpdateRoomMutation(); // Added updateRoomApi
  const [createBuildingApi, { isLoading: isCreatingBuilding }] = useCreateBuildingMutation();
  const [updateBuildingApi, { isLoading: isUpdatingBuilding }] = useUpdateBuildingMutation();
  const [createFloorApi, { isLoading: isCreatingFloor }] = useCreateFloorMutation();
  const [updateFloorApi, { isLoading: isUpdatingFloor }] = useUpdateFloorMutation();
  const [importAmenitiesFromFile] = useImportAmenitiesFromFileMutation();
  const [amenityOverrides, setAmenityOverrides] = useState<Record<number, AmenityResponse>>({});
  const [localAmenities, setLocalAmenities] = useState<AmenityResponse[]>([]);
  const amenityCatalog = useMemo(() => {
    const catalog = [...(apiAmenities ?? [])];
    localAmenities.forEach((amenity) => {
      if (!catalog.some((item) => normalizeText(item.name) === normalizeText(amenity.name))) catalog.push(amenity);
    });
    return catalog.map((amenity) => amenityOverrides[amenity.id] ?? amenity);
  }, [apiAmenities, amenityOverrides, localAmenities]);
  const availableRoomTypes = useMemo(() => (apiRoomTypes ?? []).map((value) => roomTypeLabel(String(value))), [apiRoomTypes]);
  const availableRoomStatuses = useMemo(() => (apiRoomStatuses ?? []).map((value) => statusLabel(String(value))), [apiRoomStatuses]);
  const amenityOptions = useMemo(() => amenityCatalog.map((amenity) => amenity.name).filter(Boolean), [amenityCatalog]);
  const translateBed = (bed: string) => bed.startsWith("2 giường đơn") ? `${t("room.doubleSingleBeds")} (1m x 1.2m)` : bed.startsWith("1 giường đơn") ? `${t("room.singleBed")} (1m x 1.2m)` : bed.startsWith("1 giường King Size") ? `${t("room.kingBed")} (1.8m x 2m)` : bed;
  const requestedTab = new URLSearchParams(location.search).get("tab");
  const defaultRoomTab: "rooms" | "pricing" | "amenities" = canManageRooms && (requestedTab === "pricing" || requestedTab === "amenities") ? requestedTab : "rooms";
  const [activeTab, setActiveTab] = useState<"rooms" | "buildings" | "floors" | "pricing" | "amenities">(defaultRoomTab);
  const [pricingMode, setPricingMode] = useState<"branch" | "event">("branch");
  const [editingPricingType, setEditingPricingType] = useState<string | null>(null);
  const [pricingSaveError, setPricingSaveError] = useState<string | null>(null);
  const { data: branchRoomPolicies = [], isLoading: isBranchPoliciesLoading, isError: isBranchPoliciesError } = useGetBranchRoomPoliciesQuery();
  const [updateBranchRoomPolicy, { isLoading: isUpdatingPolicy }] = useUpdateBranchRoomPolicyMutation();
  useEffect(() => {
    if (!hotelId || Number.isNaN(Number(hotelId))) return;

    bindHotelSocketEvents({
      onRoomCreated: (payload) => {
        dispatch(baseApi.util.invalidateTags(["Room", "Booking"]));
        const event = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
        const data = event.data && typeof event.data === "object" ? event.data as Record<string, unknown> : {};
        const count = Number(data.count);
        toast({
          title: "Phòng mới được thêm",
          description: event.action === "IMPORTED" && Number.isFinite(count)
            ? `Đã nhập ${count} phòng.`
            : `Phòng ${String(data.roomNumber ?? "")} đã được thêm vào danh sách.`,
        });
      },
      onRoomUpdated: (payload) => {
        dispatch(baseApi.util.invalidateTags(["Room", "Booking"]));
        const event = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
        const data = event.data && typeof event.data === "object" ? event.data as Record<string, unknown> : {};
        toast({
          title: "Phòng được cập nhật",
          description: `Thông tin phòng ${String(data.roomNumber ?? "")} đã được làm mới.`,
        });
      },
      onRoomPolicyUpdated: () => {
        dispatch(baseApi.util.invalidateTags(["Room", "Booking", "BranchRoomPolicy"]));
      },
      onBuildingChanged: () => {
        dispatch(baseApi.util.invalidateTags(["Building", "Floor", "Room"]));
      },
      onFloorChanged: () => {
        dispatch(baseApi.util.invalidateTags(["Floor", "Room"]));
      },
      onRoomImportProgress: (data) => {
        const progress = parseRoomSocketImportProgress(data);
        const activeTaskId = activeRoomImportTaskIdRef.current;
        if (progress.completed) {
          const completedTaskId = progress.taskId || activeTaskId;
          if (!completedTaskId || !refreshedRoomImportTasksRef.current.has(completedTaskId)) {
            if (completedTaskId) refreshedRoomImportTasksRef.current.add(completedTaskId);
            dispatch(baseApi.util.invalidateTags(["Room", "Booking"]));
          }
        }
        if (!activeTaskId || (progress.taskId && progress.taskId !== activeTaskId)) return;
        setRoomSocketImportProgress(progress);
      },
    });
  }, [dispatch, hotelId]);
  useEffect(() => {
    setActiveTab((current) => (current === defaultRoomTab ? current : defaultRoomTab));
  }, [defaultRoomTab]);
  const [buildings, setBuildings] = useState<Building[]>(() => {
    if (typeof window === "undefined") return initialBuildings;
    const stored = window.localStorage.getItem("staywise-buildings");
    if (!stored) return initialBuildings;
    try {
      const saved = JSON.parse(stored) as Building[];
      return saved.length > 0 ? saved : initialBuildings;
    } catch {
      return initialBuildings;
    }
  });
  const [pricingDrafts, setPricingDrafts] = useState<Record<string, { price: string; extraAdultFee: string; extraChildFee: string; standardCapacity: string; maxExtraGuests: string }>>({});
  const [floors, setFloors] = useState<string[]>([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState("");
  const { data: apiBuildings, isLoading: isBuildingsLoading, isError: isBuildingsError } = useGetBuildingsByCurrentHotelQuery();
  const { currentData: apiFloorsByBuilding, isLoading: isFloorsLoading, isFetching: isFloorsFetching, isError: isFloorsError } = useGetFloorsByBuildingIdQuery(selectedBuildingId, { skip: !selectedBuildingId });
  const [rooms, setRooms] = useState<Room[]>([]);
  const [query, setQuery] = useState("");
  const [building, setBuilding] = useState("Tất cả các tòa");
  const [floor, setFloor] = useState("Tất cả các tầng");
  const [roomType, setRoomType] = useState("Tất cả loại phòng");
  const [status, setStatus] = useState("Tất cả trạng thái");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [assignmentRoom, setAssignmentRoom] = useState<Room | null>(null);
  const [statusMenuRoom, setStatusMenuRoom] = useState<string | null>(null);
  const [galleryRoom, setGalleryRoom] = useState<Room | null>(null);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [editingRoomDatabaseId, setEditingRoomDatabaseId] = useState<string | null>(null);
  const [showCreateBuilding, setShowCreateBuilding] = useState(false);
  const [editingBuildingId, setEditingBuildingId] = useState<string | null>(null);
  const [buildingQuery, setBuildingQuery] = useState("");
  const [importingRooms, setImportingRooms] = useState(false);
  const [roomImportUploadProgress, setRoomImportUploadProgress] = useState("");
  const [isRoomImportDialogOpen, setIsRoomImportDialogOpen] = useState(false);
  const [isAmenityImportDialogOpen, setIsAmenityImportDialogOpen] = useState(false);
  const [amenityImportProgress, setAmenityImportProgress] = useState("");
  const [amenityImportProgressPercent, setAmenityImportProgressPercent] = useState<number>();
  const [roomImportReport, setRoomImportReport] = useState<{
    processing: boolean;
    rows: RoomImportRowResult[];
    archiveError?: string;
  } | null>(null);
  const [roomSocketImportProgress, setRoomSocketImportProgress] = useState<RoomSocketImportProgress | null>(null);
  const [roomImportTaskId, setRoomImportTaskId] = useState("");
  const importFileInputRef = useRef<HTMLInputElement>(null);
  const importTargetRef = useRef<ImportTarget>("rooms");
  const activeRoomImportTaskIdRef = useRef("");
  const finishedRoomImportTasksRef = useRef(new Set<string>());
  const refreshedRoomImportTasksRef = useRef(new Set<string>());
  useEffect(() => {
    if (!roomImportTaskId) return;
    const controller = new AbortController();
    let timer: number | undefined;

    const pollStatus = async () => {
      try {
        const status = await getRoomImportStatus(roomImportTaskId, controller.signal);
        if (controller.signal.aborted) return;
        const nextProgress = parseRoomSocketImportProgress({ ...status, taskId: status.taskId ?? roomImportTaskId });
        setRoomSocketImportProgress((current) => ({
          ...nextProgress,
          rows: nextProgress.rows.length > 0
            ? [
              ...(current?.rows ?? []).filter((row) => !nextProgress.rows.some((nextRow) => nextRow.rowNumber === row.rowNumber)),
              ...nextProgress.rows,
            ].sort((left, right) => left.rowNumber - right.rowNumber)
            : current?.rows ?? [],
        }));

        if (isRoomImportFinished(status)) {
          if (!finishedRoomImportTasksRef.current.has(roomImportTaskId)) {
            finishedRoomImportTasksRef.current.add(roomImportTaskId);
            if (!refreshedRoomImportTasksRef.current.has(roomImportTaskId)) {
              refreshedRoomImportTasksRef.current.add(roomImportTaskId);
              dispatch(baseApi.util.invalidateTags(["Room", "Booking"]));
            }
            const failed = ["FAILED", "ERROR"].includes(String(status.status ?? "").trim().toUpperCase());
            toast({
              variant: failed ? "destructive" : "success",
              title: failed ? "Nhập phòng thất bại" : "Nhập phòng hoàn tất",
              description: status.message || (failed ? "Backend báo tiến trình nhập phòng thất bại." : "Danh sách phòng đã được cập nhật từ máy chủ."),
            });
          }
          return;
        }

        timer = window.setTimeout(() => void pollStatus(), 1500);
      } catch (error) {
        if (controller.signal.aborted) return;
        const message = getRoomImportErrorMessage(error);
        setRoomSocketImportProgress((current) => current
          ? { ...current, message: `Đang thử lại trạng thái từ máy chủ: ${message}` }
          : {
            taskId: roomImportTaskId,
            percent: null,
            message: `Đang thử lại trạng thái từ máy chủ: ${message}`,
            completed: false,
            rows: [],
          });
        timer = window.setTimeout(() => void pollStatus(), 3000);
      }
    };

    void pollStatus();
    return () => {
      controller.abort();
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [dispatch, roomImportTaskId]);
  const [detailRoom, setDetailRoom] = useState<Room | null>(null);
  const [createRoomForm, setCreateRoomForm] = useState<CreateRoomFormState>(emptyCreateRoomForm);
  const [roomImageFiles, setRoomImageFiles] = useState<File[]>([]);
  const [amenitySearch, setAmenitySearch] = useState("");
  const [newAmenityName, setNewAmenityName] = useState("");
  const [amenityPrice, setAmenityPrice] = useState("");
  const [isCreatingAmenity, setIsCreatingAmenity] = useState(false);
  const [customAmenityPrices, setCustomAmenityPrices] = useState<Record<string, number>>({});
  const [showAmenityMenu, setShowAmenityMenu] = useState(false);
  const [buildingForm, setBuildingForm] = useState(emptyBuildingForm);
  const [showCreateFloor, setShowCreateFloor] = useState(false);
  const [editingFloor, setEditingFloor] = useState<string | null>(null);
  const [editingFloorId, setEditingFloorId] = useState<string | null>(null);
  const [floorForm, setFloorForm] = useState(emptyFloorForm);
  const selectedRoomTypeValue = roomTypeValues[createRoomForm.roomType] ?? createRoomForm.roomType;
  const { currentData: roomTypeDetail, isLoading: isRoomTypeDetailLoading, isError: isRoomTypeDetailError } = useGetRoomTypeDetailQuery(
    { hotelId: Number(hotelId), roomType: selectedRoomTypeValue },
    { skip: !hotelId || !createRoomForm.roomType },
  );
  const getApiValue = (item: Record<string, unknown>, keys: string[]) => keys.map((key) => item[key]).find((value) => value !== undefined && value !== null && value !== "");
  const { data: apiFloorsByHotel = [], isLoading: isHotelFloorsLoading, isError: isHotelFloorsError } = useGetFloorsByHotelIdQuery();
  const getRoomAmenityNames = (item: Record<string, unknown>) => {
    const amenityKeys = ["amenities", "roomAmenities", "amenityList", "amenityResponses", "roomAmenityResponses", "services", "amenityIds", "amenityNames"];
    const nestedRoom = getApiValue(item, ["roomInfo", "roomDetails", "room"]);
    const nestedRoomRecord = nestedRoom && typeof nestedRoom === "object" ? nestedRoom as Record<string, unknown> : undefined;
    const rawAmenities = getApiValue(item, amenityKeys) ?? (nestedRoomRecord ? getApiValue(nestedRoomRecord, amenityKeys) : undefined);
    const entries = Array.isArray(rawAmenities)
      ? rawAmenities
      : typeof rawAmenities === "string"
        ? rawAmenities.split(/[;,|]/).map((name) => name.trim()).filter(Boolean)
        : rawAmenities == null ? [] : [rawAmenities];
    const resolveAmenityName = (value: string) => {
      const amenityName = value.trim();
      return apiAmenities?.find((option) => String(option.id) === amenityName || normalizeText(option.name) === normalizeText(amenityName))?.name ?? amenityName;
    };

    return entries.map((value) => {
      if (typeof value === "string") return resolveAmenityName(value);

      const amenity = (value && typeof value === "object" ? value : { id: value }) as Record<string, unknown>;
      const nestedAmenity = amenity.amenity ?? amenity.service;
      if (typeof nestedAmenity === "string" && nestedAmenity.trim()) return resolveAmenityName(nestedAmenity);
      const details: Record<string, unknown> = nestedAmenity && typeof nestedAmenity === "object" ? nestedAmenity as Record<string, unknown> : amenity;
      const name = details.name ?? details.amenityName ?? details.serviceName ?? details.title;
      if (name != null && String(name).trim()) return resolveAmenityName(String(name));

      const id = details.id ?? details.amenityId ?? details.serviceId ?? amenity.amenityId ?? amenity.serviceId;
      return id == null ? "" : resolveAmenityName(String(id));
    }).filter(Boolean);
  };
  const { data: apiRooms, error: roomsError, isLoading: isRoomsLoading, isFetching: isRoomsFetching, isError: isRoomsError } = useGetRoomsByCurrentHotelQuery();
  const apiFloorOptions = useMemo(() => (apiFloorsByBuilding ?? []).map((item) => {
    const id = getApiValue(item, ["id", "floorId", "floorID"]);
    const floorNumber = getApiValue(item, ["floorNumber", "floorLevel", "number"]);
    const name = getApiValue(item, ["name", "floorName"]);
    const displayName = String(floorNumber ?? name ?? "");
    return { id: String(id ?? ""), name: displayName };
  }).filter((item) => item.id && item.name), [apiFloorsByBuilding]);
  const hotelFloorOptions = useMemo(() => apiFloorsByHotel.map((item) => {
    const id = getApiValue(item, ["id", "floorId", "floorID"]);
    const floorNumber = getApiValue(item, ["floorNumber", "floorLevel", "floorNo", "number"]);
    const name = getApiValue(item, ["name", "floorName"]);
    const displayName = String(floorNumber ?? name ?? "");
    const directBuildingId = getApiValue(item, ["buildingId", "buildingID", "towerId", "towerID"]);
    const buildingValue = getApiValue(item, ["building", "buildingInfo", "buildingResponse", "tower", "towerInfo"]);
    const buildingRecord = buildingValue && typeof buildingValue === "object" ? buildingValue as Record<string, unknown> : {};
    const nestedBuildingId = getApiValue(buildingRecord, ["id", "buildingId", "buildingID", "towerId", "towerID"]);
    const buildingName = getApiValue(item, ["buildingName", "towerName"]) ?? getApiValue(buildingRecord, ["name", "buildingName", "towerName"]);
    const buildingId = directBuildingId ?? nestedBuildingId ?? buildings.find((building) =>
      buildingName != null && normalizeText(building.name) === normalizeText(String(buildingName)),
    )?.id;
    return {
      id: String(id ?? ""),
      name: displayName,
      buildingId: String(buildingId ?? ""),
    };
  }).filter((item) => item.id && item.name), [apiFloorsByHotel, buildings]);
  const hotelFloorNames = useMemo(() => [...new Set(hotelFloorOptions.map((item) => item.name))], [hotelFloorOptions]);
  const hotelFloorsForSelectedBuilding = useMemo(
    () => hotelFloorOptions.filter((item) => !selectedBuildingId || !item.buildingId || item.buildingId === selectedBuildingId),
    [hotelFloorOptions, selectedBuildingId],
  );
  const selectedBuildingFloorOptions = apiFloorsByBuilding !== undefined ? apiFloorOptions : hotelFloorsForSelectedBuilding;
  const defaultBuildingOption = (options: Building[]) =>
    options.find((item) =>
      normalizeText(item.name) === normalizeText("Tòa A")
      || item.id.trim().toLocaleUpperCase() === "A"
      || item.id.trim().toLocaleUpperCase().endsWith("_TOA_A"),
    ) ?? options[0];
  const defaultFloorOption = (options: Array<{ id: string; name: string }>) =>
    options.find((item) => Number(item.name.replace(/[^\d-]/g, "")) === 1) ?? options[0];
  const roomImportOptions = useMemo<RoomImportOptions>(() => ({
    roomTypes: Object.keys(roomTypeLabels),
    statuses: [...new Set((availableRoomStatuses.length > 0 ? availableRoomStatuses : statuses).map((value) => value.trim()).filter(Boolean))],
    amenities: [...new Map(amenityCatalog
      .filter((item) => Number.isInteger(item.id) && item.name.trim())
      .map((item) => [String(item.id), { id: String(item.id), name: item.name.trim() }])).values()],
    bedTypes: [...new Map((apiBedTypes ?? [])
      .filter((item) => Number.isInteger(item.id) && item.name?.trim())
      .map((item) => [item.id!, { id: item.id!, name: item.name!.trim() }])).values()],
    buildings: [...new Map(buildings.filter((item) => item.id && item.name.trim()).map((item) => [normalizeText(item.name), item])).values()],
    floors: [...new Map(hotelFloorOptions
      .filter((item) => buildings.some((building) => building.id === item.buildingId))
      .map((item) => [`${item.buildingId}:${normalizeText(item.name)}`, item])).values()],
  }), [availableRoomTypes, availableRoomStatuses, amenityCatalog, apiBedTypes, buildings, hotelFloorOptions]);
  const selectedBuildingName = buildings.find((item) => item.id === createRoomForm.building)?.name ?? "Chưa chọn";
  const selectedFloorName = selectedBuildingFloorOptions.find((item) => item.id === createRoomForm.floor)?.name;
  const selectedFloorLabel = selectedFloorName
    ? selectedFloorName.startsWith("Tầng") ? selectedFloorName : `Tầng ${selectedFloorName}`
    : "Chưa chọn";
  useEffect(() => {
    console.log("[RoomWorkspace] rooms by current hotel", { rooms: apiRooms, error: roomsError, isLoading: isRoomsLoading, isFetching: isRoomsFetching, isError: isRoomsError });
  }, [apiRooms, roomsError, isRoomsLoading, isRoomsFetching, isRoomsError]);
  useEffect(() => {
    if (!apiRooms) return;

    const nextRooms: Room[] = apiRooms.map((item, index) => {
      const roomType = roomTypeLabel(String(getApiValue(item, ["roomType", "roomName", "type", "name"]) ?? "STANDARD"));
      const details = roomTypeDetails[roomType] ?? roomTypeDetails["Standard Room"];
      const roomId = String(getApiValue(item, ["roomNumber", "roomCode", "code", "id"]) ?? `room-${index + 1}`);
      const databaseIdValue = getApiValue(item, ["id", "roomId"]);
      const databaseId = databaseIdValue == null ? undefined : String(databaseIdValue);
      const floorId = getApiValue(item, ["floorId", "floorID"]);
      const floorNumber = getApiValue(item, ["floorNumber", "floorLevel"]);
      const buildingId = hotelFloorOptions.find((floorOption) => floorOption.id === String(floorId ?? ""))?.buildingId; // Added buildingId
      const buildingName = String(getApiValue(item, ["nameBuilding", "buildingName"]) ?? "").trim();
      const avatarValue = getApiValue(item, ["avatarUrl", "imageUrls", "images"]);
      const avatarUrls = Array.isArray(avatarValue)
        ? avatarValue.map((image, imageIndex) => {
          if (typeof image === "string") return { url: image, isDefault: false, imageIndex };
          const imageRecord = image as Record<string, unknown>;
          return { url: String(imageRecord.url ?? ""), isDefault: imageRecord.isDefault === true, imageIndex };
        }).filter((image) => image.url).sort((left, right) => Number(right.isDefault) - Number(left.isDefault) || left.imageIndex - right.imageIndex)
        : [];
      const defaultImageUrl = getApiValue(item, ["defaultImageUrl", "imageUrl"]);
      const images = [
        ...(typeof defaultImageUrl === "string" ? [defaultImageUrl] : []),
        ...avatarUrls.map((image) => image.url),
      ].filter((image, imageIndex, values) => values.indexOf(image) === imageIndex);
      const services = getRoomAmenityNames(item);
      const rawBeds = getApiValue(item, ["beds", "bedTypes"]);
      const bedItems = Array.isArray(rawBeds) ? rawBeds : rawBeds && typeof rawBeds === "object" ? [rawBeds] : [];
      const bedConfigurations = deduplicateRoomBedConfigurations(bedItems
        .map((bed) => parseRoomBedConfiguration(bed, apiBedTypes ?? []))
        .filter((bed): bed is RoomBedConfiguration => bed !== null)
        .map((bed) => ({
          ...bed,
          name: bed.name ?? apiBedTypes?.find((bedType) => Number(bedType.id) === bed.bedTypeId)?.name,
        })));
      const bedNames = bedConfigurations.map((bed) => {
        const name = bed.name ?? `Loại giường #${bed.bedTypeId}`;
        return `${name} × ${bed.quantity}`;
      });
      const bedCapacity = bedItems.reduce((total, bed) => {
        const bedRecord = bed as Record<string, unknown>;
        const capacity = Number(bedRecord.capacity ?? 0);
        const quantity = Number(bedRecord.quantity ?? 1);
        return total + (Number.isFinite(capacity) ? capacity : 0) * (Number.isFinite(quantity) ? quantity : 1);
      }, 0);
      const status = statusLabel(String(getApiValue(item, ["roomStatus", "status"]) ?? "READY"));
      const standardCapacity = Number(getApiValue(item, ["standardCapacity", "capacity", "maxGuests", "guestCapacity"]) ?? details.capacity);
      const maxExtraGuests = Number(getApiValue(item, ["maxExtraGuests"]) ?? 0);
      const extraAdultFee = Number(getApiValue(item, ["extraAdultFee"]) ?? 0);
      const extraChildFee = Number(getApiValue(item, ["extraChildFee"]) ?? 0);
      const price = Number(getApiValue(item, ["totalPrice", "basePrice", "price"]) ?? details.price);

      return {
        id: roomId,
        databaseId,
        buildingName: buildingName || undefined,
        buildingId, // Added buildingId to the object being returned
        floorId: floorId == null ? undefined : String(floorId), // Ensured floorId is correctly formatted
        name: roomType,
        images,
        floor: String(floorNumber ?? ""),
        size: formatRoomArea(getApiValue(item, ["area", "roomArea", "roomSize", "room_area", "squareMeters", "size", "acreage"])),
        beds: bedNames.join(" · ") || String(getApiValue(item, ["bedType", "bedTypeName"]) ?? "Chưa cập nhật loại giường"),
        bedConfigurations,
        capacity: Number.isFinite(standardCapacity) ? standardCapacity : details.capacity,
        standardCapacity: Number.isFinite(standardCapacity) ? standardCapacity : details.capacity,
        maxExtraGuests: Number.isFinite(maxExtraGuests) ? maxExtraGuests : 0,
        extraAdultFee: Number.isFinite(extraAdultFee) ? extraAdultFee : 0,
        extraChildFee: Number.isFinite(extraChildFee) ? extraChildFee : 0,
        guestPolicy: String(getApiValue(item, ["guestPolicy", "policy"]) ?? `Tiêu chuẩn ${standardCapacity} người · Ghép thêm tối đa ${maxExtraGuests} người`),
        price: Number.isFinite(price) ? price : details.price,
        status,
        cleaner: "",
        services,
      };
    });

    setRooms((current) => {
      const refreshedRooms = nextRooms.map((room) => {
        const previous = current.find((item) => item.id === room.id);
        return previous ? { ...room, status: previous.status, cleaner: previous.cleaner } : room;
      });
      return refreshedRooms;
    });
  }, [apiRooms, apiAmenities, apiBedTypes, hotelFloorOptions]);
  useEffect(() => {
    if (!apiBuildings) return;
    const nextBuildings = apiBuildings.map((item) => {
      const id = getApiValue(item, ["id", "buildingId", "buildingID"]);
      const name = getApiValue(item, ["name", "buildingName", "buildingCode", "code"]);
      return { id: String(id ?? ""), name: String(name ?? id ?? "Tòa nhà") };
    }).filter((item) => item.id);

    setBuildings((current) => (current.length === nextBuildings.length && current.every((building, index) => building.id === nextBuildings[index]?.id && building.name === nextBuildings[index]?.name) ? current : nextBuildings));
    setSelectedBuildingId((current) => {
      const nextSelected = nextBuildings.some((item) => item.id === current)
        ? current
        : (defaultBuildingOption(nextBuildings)?.id ?? "");
      return nextSelected === current ? current : nextSelected;
    });
    setCreateRoomForm((current) => {
      const nextBuilding = nextBuildings.some((item) => item.id === current.building)
        ? current.building
        : (defaultBuildingOption(nextBuildings)?.id ?? "");
      return nextBuilding === current.building ? current : { ...current, building: nextBuilding };
    });
  }, [apiBuildings]);
  useEffect(() => {
    const nextFloors = selectedBuildingFloorOptions.map((item) => item.name);

    setFloors((current) => (current.length === nextFloors.length && current.every((floorName, index) => floorName === nextFloors[index]) ? current : nextFloors));
    setCreateRoomForm((current) => {
      const nextFloor = selectedBuildingFloorOptions.some((item) => item.id === current.floor)
        ? current.floor
        : (defaultFloorOption(selectedBuildingFloorOptions)?.id ?? "");
      return nextFloor === current.floor ? current : { ...current, floor: nextFloor };
    });
  }, [selectedBuildingFloorOptions]);
  useEffect(() => {
    setCreateRoomForm((current) => {
      const nextRoomType = availableRoomTypes.some((type) => String(type) === current.roomType) ? current.roomType : (availableRoomTypes[0] ?? current.roomType);
      const nextStatus = availableRoomStatuses.some((status) => String(status) === current.status) ? current.status : (availableRoomStatuses[0] ?? current.status);
      return nextRoomType === current.roomType && nextStatus === current.status ? current : { ...current, roomType: nextRoomType, status: nextStatus };
    });
  }, [apiRoomTypes, apiRoomStatuses, availableRoomTypes, availableRoomStatuses]);
  useEffect(() => {
    if (editingRoomId !== null || (!roomTypeDetail && branchRoomPolicies.length === 0)) return;

    const getDetailValue = (keys: string[]) => keys.map((key) => roomTypeDetail?.[key]).find((value) => value !== undefined && value !== null && value !== "");
    const rawBeds = getDetailValue(["beds", "bedTypes", "roomBeds"]);
    const bedItems = Array.isArray(rawBeds) ? rawBeds : rawBeds && typeof rawBeds === "object" ? [rawBeds] : [];
    const bedConfigurations = deduplicateRoomBedConfigurations(bedItems
      .map((bed) => parseRoomBedConfiguration(bed, apiBedTypes ?? []))
      .filter((bed): bed is RoomBedConfiguration => bed !== null)
      .map((bed) => ({
        ...bed,
        name: bed.name ?? apiBedTypes?.find((bedType) => Number(bedType.id) === bed.bedTypeId)?.name,
      })));
    const bedNames = bedConfigurations.map((bed) => `${bed.name ?? `Loại giường #${bed.bedTypeId}`} × ${bed.quantity}`);
    const standardCapacity = getDetailValue(["standardCapacity", "standardAdults", "capacity", "maxAdults", "adults", "adultCapacity", "numberOfAdults"]);
    const roomTypePolicy = branchRoomPolicies.find((policy) => {
      const policyRoomType = getApiValue(policy, ["roomType", "roomTypeName", "type", "name"]);
      return roomTypeLabel(String(policyRoomType ?? "")) === createRoomForm.roomType;
    });
    const maxExtraGuests = getDetailValue(["maxExtraGuests", "maxExtraGuest", "extraGuestCapacity"])
      ?? getApiValue(roomTypePolicy ?? {}, ["maxExtraGuests", "max_extra_guests", "extraGuestCapacity"]);
    const extraAdultFee = getApiValue(roomTypePolicy ?? {}, ["extraAdultFee", "extra_adult_fee", "adultSurcharge"])
      ?? getDetailValue(["extraAdultFee"]);
    const extraChildFee = getApiValue(roomTypePolicy ?? {}, ["extraChildFee", "extra_child_fee", "childSurcharge"])
      ?? getDetailValue(["extraChildFee"]);

    setCreateRoomForm((current) => {
      const nextStandardCapacity = standardCapacity !== undefined ? String(standardCapacity) : current.standardCapacity;
      const nextMaxExtraGuests = maxExtraGuests !== undefined ? String(maxExtraGuests) : current.maxExtraGuests;
      const nextExtraAdultFee = extraAdultFee !== undefined ? String(extraAdultFee) : current.extraAdultFee;
      const nextExtraChildFee = extraChildFee !== undefined ? String(extraChildFee) : current.extraChildFee;
      const nextBedType = bedNames.length > 0 ? bedNames.join(" · ") : current.bedType;
      const nextBedConfigurations = bedConfigurations.map(({ bedTypeId, quantity }) => ({ bedTypeId, quantity }));

      if (current.standardCapacity === nextStandardCapacity && current.maxExtraGuests === nextMaxExtraGuests && current.extraAdultFee === nextExtraAdultFee && current.extraChildFee === nextExtraChildFee && current.bedType === nextBedType && current.bedConfigurations.length > 0) {
        return current;
      }

      return { ...current, standardCapacity: nextStandardCapacity, maxExtraGuests: nextMaxExtraGuests, extraAdultFee: nextExtraAdultFee, extraChildFee: nextExtraChildFee, bedType: nextBedType, bedConfigurations: current.bedConfigurations.length > 0 ? current.bedConfigurations : nextBedConfigurations };
    });
  }, [roomTypeDetail, branchRoomPolicies, createRoomForm.roomType, editingRoomId, apiBedTypes]);
  const isAnyModalOpen = showCreateRoom || Boolean(detailRoom) || Boolean(galleryRoom) || Boolean(assignmentRoom);
  useEffect(() => {
    if (typeof document === "undefined") return;
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverscroll = document.body.style.overscrollBehaviorY;

    if (isAnyModalOpen) {
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
      document.body.style.overscrollBehaviorY = "none";
      return () => {
        document.body.style.overflow = previousBodyOverflow;
        document.documentElement.style.overflow = previousHtmlOverflow;
        document.body.style.overscrollBehaviorY = previousBodyOverscroll;
      };
    }

    document.body.style.overflow = previousBodyOverflow;
    document.documentElement.style.overflow = previousHtmlOverflow;
    document.body.style.overscrollBehaviorY = previousBodyOverscroll;

    return undefined;
  }, [isAnyModalOpen]);
  const filtered = useMemo(() => rooms
    .filter((room) => `${room.id} ${room.name}`.toLowerCase().includes(query.toLowerCase()))
    .filter((room) => building === "Tất cả các tòa" || room.id.startsWith(`${building}-`) || room.buildingName?.includes(building))
    .filter((room) => floor === "Tất cả các tầng" || room.floor === floor)
    .filter((room) => roomType === "Tất cả loại phòng" || room.name === roomType)
    .filter((room) => status === "Tất cả trạng thái" || room.status === status), [rooms, query, building, floor, roomType, status]);
  const roomTypePricing = useMemo(() => {
    const pricingMap = new Map<string, { roomType: string; policyId?: string; price: number; extraAdultFee: number; extraChildFee: number; standardCapacity: number; maxExtraGuests: number; area?: number; capacity?: number; count: number }>();
    rooms.forEach((room) => {
      const existing = pricingMap.get(room.name) ?? {
        roomType: room.name,
        price: room.price,
        extraAdultFee: room.extraAdultFee,
        extraChildFee: room.extraChildFee,
        standardCapacity: room.standardCapacity,
        maxExtraGuests: room.maxExtraGuests,
        area: undefined,
        capacity: room.standardCapacity,
        count: 0,
      };
      pricingMap.set(room.name, {
        ...existing,
        price: room.price || existing.price,
        extraAdultFee: room.extraAdultFee || existing.extraAdultFee,
        extraChildFee: room.extraChildFee || existing.extraChildFee,
        standardCapacity: room.standardCapacity || existing.standardCapacity,
        maxExtraGuests: room.maxExtraGuests || existing.maxExtraGuests,
        capacity: room.standardCapacity || existing.capacity || room.standardCapacity,
        count: existing.count + 1,
      });
    });
    branchRoomPolicies.forEach((policy) => {
      const rawRoomType = getApiValue(policy, ["roomType", "roomTypeName", "type", "name"]);
      const roomType = roomTypeLabel(String(rawRoomType ?? ""));
      if (!roomType) return;

      const existing = pricingMap.get(roomType);
      const policyId = getApiValue(policy, ["id", "policyId", "branchRoomPolicyId", "branchRoomPolicyID"]);
      const policyNumber = (keys: string[], fallback: number) => {
        const value = getApiValue(policy, keys);
        const parsed = Number(value);
        return value !== undefined && Number.isFinite(parsed) ? parsed : fallback;
      };

      pricingMap.set(roomType, {
        roomType,
        policyId: policyId == null ? existing?.policyId : String(policyId),
        price: policyNumber(["basePrice", "base_price", "price", "roomPrice", "pricePerNight", "listedPrice"], existing?.price ?? 0),
        extraAdultFee: policyNumber(["extraAdultFee", "extra_adult_fee", "adultSurcharge"], existing?.extraAdultFee ?? 0),
        extraChildFee: policyNumber(["extraChildFee", "extra_child_fee", "childSurcharge"], existing?.extraChildFee ?? 0),
        standardCapacity: policyNumber(["standardCapacity", "standard_capacity", "capacity", "maxAdults"], existing?.standardCapacity ?? 1),
        maxExtraGuests: policyNumber(["maxExtraGuests", "max_extra_guests", "extraGuestCapacity"], existing?.maxExtraGuests ?? 0),
        area: policyNumber(["area", "roomArea", "squareMeters", "size"], existing?.area ?? 0),
        capacity: policyNumber(["maxCapacity", "capacity", "maxAdults", "standardCapacity"], existing?.capacity ?? 0),
        count: existing?.count ?? rooms.filter((room) => room.name === roomType).length,
      });
    });
    return Array.from(pricingMap.values()).sort((left, right) => left.roomType.localeCompare(right.roomType));
  }, [rooms, branchRoomPolicies]);
  const selectedRoomTypePolicy = branchRoomPolicies.find((policy) => {
    const policyRoomType = getApiValue(policy, ["roomType", "roomTypeName", "type", "name"]);
    return roomTypeLabel(String(policyRoomType ?? "")) === createRoomForm.roomType;
  });
  const standardRoomPrice = Number(
    getApiValue(selectedRoomTypePolicy ?? {}, ["basePrice", "base_price", "price", "roomPrice", "pricePerNight", "listedPrice"]) ??
    getApiValue(roomTypeDetail ?? {}, ["basePrice", "base_price", "price", "roomPrice", "pricePerNight", "listedPrice"]) ??
    roomTypeDetails[createRoomForm.roomType]?.price ??
    roomTypeDetails["Standard Room"].price
  );
  const officialRoomPrice = standardRoomPrice;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedRooms = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  useEffect(() => {
    setPage(1);
  }, [query, building, floor, roomType, status, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    const nextDrafts: Record<string, { price: string; extraAdultFee: string; extraChildFee: string; standardCapacity: string; maxExtraGuests: string }> = {};
    roomTypePricing.forEach((entry) => {
      nextDrafts[entry.roomType] = {
        price: String(entry.price),
        extraAdultFee: String(entry.extraAdultFee),
        extraChildFee: String(entry.extraChildFee),
        standardCapacity: String(entry.standardCapacity),
        maxExtraGuests: String(entry.maxExtraGuests),
      };
    });

    setPricingDrafts((current) => {
      const hasDifferentEntry = Object.keys(nextDrafts).some((roomType) => {
        const nextDraft = nextDrafts[roomType];
        const currentDraft = current[roomType];
        return !currentDraft || currentDraft.price !== nextDraft.price || currentDraft.extraAdultFee !== nextDraft.extraAdultFee || currentDraft.extraChildFee !== nextDraft.extraChildFee || currentDraft.standardCapacity !== nextDraft.standardCapacity || currentDraft.maxExtraGuests !== nextDraft.maxExtraGuests;
      });

      const hasRemovedEntry = Object.keys(current).some((roomType) => !(roomType in nextDrafts));
      if (!hasDifferentEntry && !hasRemovedEntry) return current;
      return { ...current, ...nextDrafts };
    });
  }, [roomTypePricing]);

  const filteredAmenityOptions = useMemo(() => {
    const normalizedQuery = normalizeText(amenitySearch);

    return (apiAmenities ?? []).filter((amenity) => !normalizedQuery || normalizeText(amenity.name).includes(normalizedQuery));
  }, [apiAmenities, amenitySearch]);
  const saveAmenityEdit = (amenity: AmenityResponse, changes: Pick<AmenityResponse, "name" | "price">) => {
    setAmenityOverrides((current) => ({ ...current, [amenity.id]: { ...amenity, ...changes } }));
  };
  const addLocalAmenity = (amenity: Pick<AmenityResponse, "name" | "price">) => {
    if (amenityCatalog.some((item) => normalizeText(item.name) === normalizeText(amenity.name))) {
      toast({ variant: "destructive", title: "Tiện nghi đã tồn tại", description: `“${amenity.name}” đã có trong danh sách.` });
      return;
    }
    setLocalAmenities((current) => [...current, { ...amenity, id: -(Date.now() + current.length) }]);
    toast({ variant: "success", title: "Thêm tiện nghi thành công", description: `Đã thêm “${amenity.name}” vào giao diện.` });
  };
  const filteredBuildings = useMemo(() => {
    const normalizedQuery = normalizeText(buildingQuery);
    const matchingBuildings = buildings.filter((item) => normalizeText(`${item.name} ${item.id}`).includes(normalizedQuery));
    return normalizedQuery ? matchingBuildings : matchingBuildings.slice(0, 4);
  }, [buildings, buildingQuery]);
  const updateRoom = (id: string, changes: Partial<Room>) => setRooms((current) => current.map((room) => room.id === id ? { ...room, ...changes } : room));
  const completeCleaning = (room: Room) => {
    updateRoom(room.id, { status: "Sẵn sàng", cleaner: "" });
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem("staywise-cleaning-rooms");
      const assignments = stored ? JSON.parse(stored) : {};
      delete assignments[room.id];
      window.localStorage.setItem("staywise-cleaning-rooms", JSON.stringify(assignments));
    }
  };
  const closeCreateRoomModal = () => {
    setShowCreateRoom(false);
    setEditingRoomId(null);
    setEditingRoomDatabaseId(null);
    setCreateRoomForm(emptyCreateRoomForm);
    setAmenitySearch("");
    setShowAmenityMenu(false);
    setRoomImageFiles([]);
  };
  const openCreateRoomModal = () => {
    const building = defaultBuildingOption(buildings);
    const floorsForBuilding = hotelFloorOptions.filter((item) => item.buildingId === building?.id);
    const floor = defaultFloorOption(floorsForBuilding);
    const standardRoomType = availableRoomTypes.find((item) => normalizeText(item) === normalizeText("Standard Room"))
      ?? availableRoomTypes[0]
      ?? "Standard Room";

    setSelectedBuildingId(building?.id ?? "");
    setEditingRoomId(null);
    setEditingRoomDatabaseId(null);
    setCreateRoomForm({
      ...emptyCreateRoomForm,
      roomType: standardRoomType,
      ...roomFormDefaults(standardRoomType),
      building: building?.id ?? "",
      floor: floor?.id ?? "",
    });
    setRoomImageFiles([]);
    setShowCreateRoom(true);
  };
  const handlePricingDraftChange = (roomType: string, field: "price" | "extraAdultFee" | "extraChildFee" | "standardCapacity" | "maxExtraGuests", value: string) => {
    setPricingDrafts((current) => ({
      ...current,
      [roomType]: {
        price: current[roomType]?.price ?? "0",
        extraAdultFee: current[roomType]?.extraAdultFee ?? "0",
        extraChildFee: current[roomType]?.extraChildFee ?? "0",
        standardCapacity: current[roomType]?.standardCapacity ?? "1",
        maxExtraGuests: current[roomType]?.maxExtraGuests ?? "0",
        [field]: value,
      },
    }));
  };
  const saveRoomTypePricing = async (roomType: string) => {
    const draft = pricingDrafts[roomType];
    const entry = roomTypePricing.find((item) => item.roomType === roomType);
    if (!draft || !entry?.policyId) return false;
    const nextPrice = Number(draft.price) || 0;
    const nextExtraAdultFee = Number(draft.extraAdultFee) || 0;
    const nextExtraChildFee = Number(draft.extraChildFee) || 0;
    const nextStandardCapacity = Number(draft.standardCapacity) || 1;
    const nextMaxExtraGuests = Number(draft.maxExtraGuests) || 0;

    setPricingSaveError(null);
    try {
      await updateBranchRoomPolicy({
        policyId: entry.policyId,
        request: {
          price: nextPrice,
          extraAdultFee: nextExtraAdultFee,
          extraChildFee: nextExtraChildFee,
          standardCapacity: nextStandardCapacity,
          maxExtraGuests: nextMaxExtraGuests,
        },
      }).unwrap();
      setRooms((current) => current.map((room) => room.name === roomType ? {
        ...room,
        price: nextPrice,
        extraAdultFee: nextExtraAdultFee,
        extraChildFee: nextExtraChildFee,
        standardCapacity: nextStandardCapacity,
        maxExtraGuests: nextMaxExtraGuests,
        capacity: nextStandardCapacity,
        guestPolicy: `Tiêu chuẩn ${nextStandardCapacity} người · Ghép thêm tối đa ${nextMaxExtraGuests} người`,
      } : room));
      toast({
        variant: "success",
        title: "Cập nhật giá thành công!",
        description: `Giá cho ${roomType} đã được cập nhật và đồng bộ cho chi nhánh.`,
      });
      return true;
    } catch {
      setPricingSaveError("Không thể cập nhật cấu hình giá. Vui lòng thử lại.");
      return false;
    }
  };
  const openEditRoomModal = (room: Room) => {
    const details = roomFormDefaults(room.name);
    const area = room.size.match(/[\d.,]+/)?.[0] ?? details.area;
    const floorOption = hotelFloorOptions.find((item) => item.id === room.floorId || item.name === room.floor); // Added floorOption
    const buildingId = room.buildingId ?? floorOption?.buildingId ?? selectedBuildingId; // Corrected buildingId assignment
    const floorId = room.floorId ?? floorOption?.id ?? ""; // Corrected floorId assignment
    if (buildingId) setSelectedBuildingId(buildingId); // Set selectedBuildingId if buildingId is available
    setEditingRoomId(room.id);
    setEditingRoomDatabaseId(room.databaseId ?? null);
    setCreateRoomForm({ roomNumber: /^\d+$/.test(room.id) ? room.id : "", roomType: room.name, building: buildingId, floor: floorId, area, standardCapacity: String(room.standardCapacity || room.capacity), maxExtraGuests: String(room.maxExtraGuests), extraAdultFee: String(room.extraAdultFee || ""), extraChildFee: String(room.extraChildFee || ""), bedType: room.beds || roomTypeDetails[room.name]?.beds || "1 giường đơn (1m x 1,2m)", bedConfigurations: (room.bedConfigurations ?? []).map(({ bedTypeId, quantity }) => ({ bedTypeId, quantity })), description: room.description ?? "", amenities: room.services, images: room.images, defaultImage: room.images[0] ?? null, status: room.status || "Sẵn sàng" }); // Updated to use buildingId and floorId
    setShowCreateRoom(true);
  };
  const openCreateBuildingModal = () => {
    setEditingBuildingId(null);
    setBuildingForm(emptyBuildingForm);
    setShowCreateBuilding(true);
  };
  const openEditBuildingModal = (building: Building) => {
    setEditingBuildingId(building.id);
    setBuildingForm({ name: building.name, code: building.id });
    setShowCreateBuilding(true);
  };
  const closeCreateBuildingModal = () => {
    setShowCreateBuilding(false);
    setEditingBuildingId(null);
    setBuildingForm(emptyBuildingForm);
  };
  const saveBuilding = async () => {
    const name = buildingForm.name.trim();
    if (!name) return;
    if (editingBuildingId) {
      try {
        await updateBuildingApi({ buildingId: editingBuildingId, body: { name } }).unwrap();
        toast({
          variant: "success",
          title: "Cập nhật tòa nhà thành công",
          description: `Đã cập nhật tên thành ${name}.`,
        });
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Không thể cập nhật tòa nhà",
          description: getApiErrorMessage(error, "Vui lòng thử lại."),
        });
        return;
      }
      closeCreateBuildingModal();
      return;
    }

    try {
      await createBuildingApi({ name }).unwrap();
      toast({
        variant: "success",
        title: "Tạo tòa nhà thành công",
        description: `Đã thêm ${name} vào khách sạn.`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Không thể tạo tòa nhà",
        description: getApiErrorMessage(error, "Vui lòng thử lại."),
      });
      return;
    }
    closeCreateBuildingModal();
  };
  const openCreateFloorModal = () => {
    if (!selectedBuildingId) {
      toast({
        variant: "destructive",
        title: "Chưa chọn tòa nhà",
        description: "Hãy tạo hoặc chọn một tòa nhà trước khi thêm tầng.",
      });
      return;
    }
    setEditingFloor(null);
    setFloorForm(emptyFloorForm);
    setShowCreateFloor(true);
  };
  const openEditFloorModal = (floor: string) => {
    const floorId = apiFloorOptions.find((option) => option.name === floor)?.id;
    if (!floorId) {
      toast({
        variant: "destructive",
        title: "Không thể sửa tầng",
        description: "Không tìm thấy ID tầng từ máy chủ. Vui lòng tải lại danh sách.",
      });
      return;
    }
    setEditingFloor(floor);
    setEditingFloorId(floorId);
    setFloorForm({ name: floor });
    setShowCreateFloor(true);
  };
  const closeCreateFloorModal = () => {
    setShowCreateFloor(false);
    setEditingFloor(null);
    setEditingFloorId(null);
    setFloorForm(emptyFloorForm);
  };
  const saveFloor = async () => {
    const name = floorForm.name.trim();
    if (!name || (!editingFloor && floors.includes(name))) return;
    if (editingFloor) {
      const floorNumber = Number(name);
      if (!Number.isInteger(floorNumber) || !editingFloorId) {
        toast({
          variant: "destructive",
          title: "Số tầng không hợp lệ",
          description: "Nhập số nguyên hợp lệ và tải lại danh sách tầng trước khi sửa.",
        });
        return;
      }
      try {
        await updateFloorApi({ floorId: editingFloorId, floorNumber }).unwrap();
        toast({
          variant: "success",
          title: "Cập nhật tầng thành công",
          description: `Đã cập nhật thành tầng ${floorNumber}.`,
        });
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Không thể cập nhật tầng",
          description: getApiErrorMessage(error, "Vui lòng thử lại."),
        });
        return;
      }
      closeCreateFloorModal();
      return;
    }

    const floorNumber = Number(name);
    if (!Number.isInteger(floorNumber)) {
      toast({
        variant: "destructive",
        title: "Số tầng không hợp lệ",
        description: "Vui lòng nhập số nguyên, ví dụ 1 hoặc -1.",
      });
      return;
    }
    if (!selectedBuildingId) {
      toast({
        variant: "destructive",
        title: "Chưa chọn tòa nhà",
        description: "Hãy tạo hoặc chọn một tòa nhà trước khi thêm tầng.",
      });
      return;
    }

    try {
      await createFloorApi({ buildingId: selectedBuildingId, floorNumber }).unwrap();
      toast({
        variant: "success",
        title: "Tạo tầng thành công",
        description: `Đã thêm tầng ${floorNumber}.`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Không thể tạo tầng",
        description: getApiErrorMessage(error, "Vui lòng thử lại."),
      });
      return;
    }
    closeCreateFloorModal();
  };
  const appendAmenity = (value?: string) => {
    const nextAmenity = (value ?? newAmenityName).trim();
    if (!nextAmenity) return;
    const normalized = normalizeText(nextAmenity);
    const matchedAmenity = amenityOptions.find((item) => normalizeText(item) === normalized) ?? nextAmenity;

    if (createRoomForm.amenities.some((item) => normalizeText(item) === normalized)) {
      setAmenitySearch("");
      setShowAmenityMenu(false);
      return;
    }

    if (!apiAmenities?.some((amenity) => amenity.name === matchedAmenity)) {
      const price = Number(amenityPrice);
      if (!Number.isFinite(price) || price < 0) return;
      setCustomAmenityPrices((current) => ({ ...current, [matchedAmenity]: price }));
    }

    setCreateRoomForm((current) => ({ ...current, amenities: [...current.amenities, matchedAmenity] }));
    setNewAmenityName("");
    setAmenityPrice("");
    setShowAmenityMenu(false);
  };
  const removeAmenity = (value: string) => setCreateRoomForm((current) => ({ ...current, amenities: current.amenities.filter((item) => normalizeText(item) !== normalizeText(value)) }));
  const clearAllAmenities = () => setCreateRoomForm((current) => ({ ...current, amenities: [] }));
  const addImages = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const availableSlots = Math.max(0, 8 - createRoomForm.images.length);
    const selectedFiles = Array.from(files).slice(0, availableSlots);
    if (selectedFiles.length === 0) return;
    const nextImages = selectedFiles.map((file) => URL.createObjectURL(file));
    setRoomImageFiles((current) => [...current, ...selectedFiles]);
    setCreateRoomForm((current) => {
      const mergedImages = [...current.images, ...nextImages];
      const nextDefault = current.defaultImage ?? mergedImages[0] ?? null;
      return { ...current, images: mergedImages, defaultImage: nextDefault };
    });
  };
  const removeImage = (image: string) => {
    const removedUploadIndex = image.startsWith("blob:")
      ? createRoomForm.images.filter((item) => item.startsWith("blob:")).indexOf(image)
      : -1;
    if (removedUploadIndex >= 0) {
      setRoomImageFiles((files) => files.filter((_, index) => index !== removedUploadIndex));
    }
    setCreateRoomForm((current) => {
      const remaining = current.images.filter((item) => item !== image);
      const nextDefault = current.defaultImage === image ? (remaining[0] ?? null) : current.defaultImage;
      return { ...current, images: remaining, defaultImage: nextDefault };
    });
  };
  const saveRoom = async () => {
    const isEditingRoom = editingRoomId !== null;
    const roomCode = createRoomForm.roomNumber.trim();
    const roomType = createRoomForm.roomType.trim();
    const roomDetails = roomTypeDetails[roomType] ?? roomTypeDetails["Standard Room"];
    const location = `Tòa ${createRoomForm.building} - Tầng ${createRoomForm.floor}`;
    const description = createRoomForm.description.trim();
    const area = Number(createRoomForm.area.replace(/,/g, "."));
    const price = officialRoomPrice;
    const standardCapacity = Number(createRoomForm.standardCapacity);
    const maxExtraGuests = Number(createRoomForm.maxExtraGuests);
    const extraAdultFee = Number(createRoomForm.extraAdultFee || 0);
    const extraChildFee = Number(createRoomForm.extraChildFee || 0);
    const selectedBeds = createRoomForm.bedConfigurations
      .map((bed) => ({ bedTypeId: Number(bed.bedTypeId), quantity: Number(bed.quantity) }))
      .filter((bed) => Number.isSafeInteger(bed.bedTypeId) && bed.bedTypeId > 0 && Number.isSafeInteger(bed.quantity) && bed.quantity > 0);
    const bedType = selectedBeds.map((bed) => {
      const definition = apiBedTypes?.find((item) => item.id === bed.bedTypeId);
      return definition ? `${definition.name ?? definition.bedTypeName} × ${bed.quantity}` : `Loại giường #${bed.bedTypeId} × ${bed.quantity}`;
    }).join(" · ");
    const showRoomSaveError = (title: string, description: string) => toast({
      variant: "destructive",
      title,
      description,
    });

    if (!roomCode || !roomType || !area || !price || !standardCapacity || maxExtraGuests < 0 || extraAdultFee < 0 || extraChildFee < 0) {
      showRoomSaveError(isEditingRoom ? "Không thể cập nhật phòng" : "Không thể thêm phòng", "Vui lòng nhập đầy đủ các trường bắt buộc.");
      return;
    }
    if (selectedBeds.length === 0) {
      showRoomSaveError(isEditingRoom ? "Không thể cập nhật phòng" : "Không thể thêm phòng", "Vui lòng chọn ít nhất một loại giường và nhập số lượng hợp lệ.");
      return;
    }
    if (rooms.some((room) => room.id.toLowerCase() === roomCode.toLowerCase() && room.id !== editingRoomId)) {
      showRoomSaveError(isEditingRoom ? "Không thể cập nhật phòng" : "Không thể thêm phòng", "Số phòng đã tồn tại, vui lòng nhập số khác.");
      return;
    }
    if (!editingRoomId) {
      if (roomImageFiles.length === 0) {
        showRoomSaveError("Không thể thêm phòng", "Vui lòng tải lên ít nhất một ảnh phòng.");
        return;
      }
      const selectedFloor = selectedBuildingFloorOptions.find((item) => item.id === createRoomForm.floor || item.name === createRoomForm.floor);
      const floorId = selectedFloor?.id;
      if (!floorId) {
        showRoomSaveError("Không thể thêm phòng", "Vui lòng chọn tầng hợp lệ.");
        return;
      }
      const defaultImageIndex = createRoomForm.defaultImage ? createRoomForm.images.indexOf(createRoomForm.defaultImage) : 0;
      const amenityIds = createRoomForm.amenities
        .map((name) => apiAmenities?.find((amenity) => amenity.name === name)?.id)
        .filter((id): id is number => id !== undefined);
      try {
        await createRoom({
            roomInfo: { roomNumber: roomCode, floorId, roomStatus: statusValues[createRoomForm.status] ?? createRoomForm.status, roomType: roomTypeValues[roomType] ?? roomType, defaultImageIndex: Math.max(defaultImageIndex, 0), amenityIds, beds: selectedBeds },
          imageFiles: roomImageFiles,
        }).unwrap();
        closeCreateRoomModal();
        toast({
          variant: "success",
          title: "Thêm phòng thành công",
          description: "Phòng mới đã được thêm vào danh sách.",
        });
      } catch (error) {
        const errorRecord = error && typeof error === "object" ? error as { data?: unknown; message?: unknown } : {};
        const responseData = errorRecord.data && typeof errorRecord.data === "object" ? errorRecord.data as { message?: unknown } : undefined;
        const message = typeof errorRecord.data === "string"
          ? errorRecord.data
          : typeof responseData?.message === "string"
            ? responseData.message
            : typeof errorRecord.message === "string"
              ? errorRecord.message
              : "Không thể thêm phòng. Vui lòng thử lại.";
        showRoomSaveError("Không thể thêm phòng", message);
      }
      return;
    }
    if (!createRoomForm.floor) {
      showRoomSaveError("Không thể cập nhật phòng", "Vui lòng chọn tầng hợp lệ.");
      return;
    }
    if (!editingRoomDatabaseId) {
      showRoomSaveError("Không thể cập nhật phòng", "Không tìm thấy ID phòng từ máy chủ. Vui lòng tải lại danh sách phòng.");
      return;
    }
    const updateDefaultImageIndex = createRoomForm.defaultImage ? createRoomForm.images.indexOf(createRoomForm.defaultImage) : 0;
    const updateAmenityIds = createRoomForm.amenities
      .map((name) => amenityCatalog.find((amenity) => amenity.name === name)?.id)
      .filter((id): id is number => id !== undefined);
    try {
      await updateRoomApi({
        roomId: editingRoomDatabaseId,
        room: {
          roomNumber: roomCode,
          floorId: createRoomForm.floor,
          roomStatus: statusValues[createRoomForm.status] ?? createRoomForm.status,
          roomType: roomTypeValues[roomType] ?? roomType,
          defaultImageIndex: Math.max(updateDefaultImageIndex, 0),
          amenityIds: updateAmenityIds,
          beds: selectedBeds,
          keptImageUrls: createRoomForm.images.filter((image) => !image.startsWith("blob:")),
        },
        images: roomImageFiles,
      }).unwrap();
    } catch (error) {
      const errorRecord = error && typeof error === "object" ? error as { data?: unknown; message?: unknown } : {};
      const responseData = errorRecord.data && typeof errorRecord.data === "object" ? errorRecord.data as { message?: unknown } : undefined;
      const message = typeof errorRecord.data === "string"
        ? errorRecord.data
        : typeof responseData?.message === "string"
          ? responseData.message
          : typeof errorRecord.message === "string"
            ? errorRecord.message
            : "Không thể cập nhật phòng. Vui lòng thử lại.";
      showRoomSaveError("Không thể cập nhật phòng", message);
      return;
    }
    const orderedImages = createRoomForm.defaultImage
      ? [createRoomForm.defaultImage, ...createRoomForm.images.filter((image) => image !== createRoomForm.defaultImage)]
      : createRoomForm.images;
    const room: Room = {
      id: roomCode,
      name: roomType,
      images: orderedImages.length > 0 ? orderedImages : ["https://images.pexels.com/photos/6876834/pexels-photo-6876834.jpeg"],
      floor: selectedBuildingFloorOptions.find((item) => item.id === createRoomForm.floor)?.name ?? location,
      size: `${area} m²`,
      beds: bedType,
      bedConfigurations: selectedBeds.map((bed) => ({
        ...bed,
        name: apiBedTypes?.find((item) => Number(item.id) === bed.bedTypeId)?.name
          ?? apiBedTypes?.find((item) => Number(item.id) === bed.bedTypeId)?.bedTypeName
          ?? `Loại giường #${bed.bedTypeId}`,
      })),
      capacity: standardCapacity,
      standardCapacity,
      maxExtraGuests,
      extraAdultFee,
      extraChildFee,
      guestPolicy: `Tiêu chuẩn: ${standardCapacity} người · Ghép thêm tối đa: ${maxExtraGuests} người`,
      price,
      status: createRoomForm.status || "Sẵn sàng",
      cleaner: isEditingRoom ? rooms.find((item) => item.id === editingRoomId)?.cleaner ?? "" : "",
      description,
      services: createRoomForm.amenities.length > 0 ? createRoomForm.amenities : ["Wifi tốc độ cao", ...(description ? [description] : [])],
    };
    setRooms((current) => editingRoomId ? current.map((item) => item.id === editingRoomId ? room : item) : [room, ...current]);
    closeCreateRoomModal();
    if (isEditingRoom) {
      toast({
        variant: "booking",
        title: "Cập nhật phòng thành công",
        description: `Thông tin phòng ${roomCode} đã được cập nhật.`,
      });
    }
  };
  const importRoomsFromFile = async (file: File): Promise<boolean> => {
    setImportingRooms(true);
    setRoomImportReport(null);
    setRoomSocketImportProgress(null);
    setRoomImportTaskId("");
    setRoomImportUploadProgress("Đang đọc ZIP và kiểm tra dữ liệu phòng...");
    activeRoomImportTaskIdRef.current = "";
    try {
      const parsed = await parseRoomImportArchive(file, roomImportOptions, rooms.map((room) => room.id));
      setRoomImportReport({ processing: true, rows: parsed.rows });
      if (parsed.rooms.length === 0) {
        setRoomImportReport({
          processing: false,
          rows: parsed.rows,
          archiveError: "Không có dòng phòng hợp lệ để nhập. Hãy xem chi tiết các dòng cần sửa.",
        });
        return true;
      }
      const roomWithLocalFloor = parsed.rooms.find((room) => room.floor.id.startsWith("local-"));
      if (roomWithLocalFloor) {
        throw new Error(`Không tìm thấy ID tầng trên máy chủ cho phòng ${roomWithLocalFloor.roomNumber}. Hãy tải lại danh sách tầng rồi thử lại.`);
      }

      const files = [...new Map(parsed.rooms.flatMap((room) => room.imageFiles)
        .map((image) => [image.name.toLocaleLowerCase(), image])).values()];
      setRoomImportUploadProgress(`Đang tải ${files.length} ảnh lên Cloudinary...`);
      if (!hotelName) {
        throw new Error("Không xác định được tên chi nhánh từ tài khoản đang đăng nhập.");
      }
      const imageUrls = await uploadRoomImagesToCloudinary(files, hotelName, (uploaded, total) => {
        setRoomImportUploadProgress(`Đang tải ảnh lên Cloudinary: ${uploaded}/${total}...`);
      });
      const request = {
        rooms: parsed.rooms.map((room) => ({
          rowNumber: room.rowNumber,
          roomNumber: room.roomNumber,
          floorId: room.floor.id,
          roomType: roomTypeValues[room.roomType] ?? room.roomType,
          roomStatus: statusValues[room.status] ?? room.status,
          beds: room.beds.map((bed) => ({ bedTypeId: bed.bedTypeId, quantity: bed.quantity })),
          amenityIds: room.amenities.map((name) => {
            const id = roomImportOptions.amenities.find((amenity) => normalizeText(amenity.name) === normalizeText(name))?.id;
            if (!id || !/^\d+$/.test(id)) throw new Error(`Không tìm thấy ID hợp lệ cho tiện ích "${name}".`);
            return Number(id);
          }),
          imageUrls: room.imageFiles.map((image) => {
            const url = imageUrls.get(image.name.toLocaleLowerCase());
            if (!url) throw new Error(`Không tìm thấy URL Cloudinary cho ảnh "${image.name}".`);
            return url;
          }),
        })),
      };
      setRoomImportUploadProgress("Đã tải ảnh xong. Đang gửi dữ liệu phòng lên máy chủ...");
      const { taskId, message } = await startRoomImport(request);
      activeRoomImportTaskIdRef.current = taskId;
      setRoomImportTaskId(taskId);
      setRoomSocketImportProgress({
        taskId,
        percent: 0,
        message: message || "Máy chủ đã tiếp nhận file và đang xử lý.",
        completed: false,
        rows: parsed.rows.filter((row) => !row.passed),
      });
      setIsRoomImportDialogOpen(false);
      return true;
    } catch (error) {
      setRoomImportReport({
        processing: false,
        rows: [],
        archiveError: getRoomImportErrorMessage(error),
      });
      return true;
    } finally {
      setImportingRooms(false);
      setRoomImportUploadProgress("");
    }
  };

  const openImportPicker = (target: ImportTarget) => {
    importTargetRef.current = target;
    if (importFileInputRef.current) {
      importFileInputRef.current.value = "";
      importFileInputRef.current.accept = target === "rooms" ? ".zip,application/zip" : ".csv,.xlsx";
      importFileInputRef.current.click();
    }
  };

  const importLocalDataFromFile = async (file: File, target = importTargetRef.current): Promise<boolean> => {
    if (target === "rooms") {
      await importRoomsFromFile(file);
      return true;
    }

    try {
      if (target === "amenities") {
        setAmenityImportProgress("Đang đọc file tiện nghi...");
        setAmenityImportProgressPercent(10);
      }
      const rows = await readImportRows(file);
      if (rows.length === 0) throw new Error("File không có dòng dữ liệu.");

      if (target === "buildings") {
        const nextBuildings = [...buildings];
        let importedCount = 0;
        rows.forEach((row) => {
          const name = getImportedValue(row, ["tên tòa", "ten toa", "tên tòa nhà", "ten toa nha", "building name", "name"]);
          if (!name || nextBuildings.some((item) => normalizeText(item.name) === normalizeText(name))) return;
          const requestedCode = getImportedValue(row, ["mã tòa", "ma toa", "mã tòa nhà", "ma toa nha", "building code", "code"]);
          const id = requestedCode || createBuildingCode(nextBuildings);
          if (nextBuildings.some((item) => item.id.toLocaleLowerCase() === id.toLocaleLowerCase())) return;
          nextBuildings.push({ id, name });
          importedCount += 1;
        });
        if (importedCount === 0) throw new Error("Không có tòa nhà hợp lệ mới trong file. Cần cột Tên tòa; có thể thêm cột Mã tòa.");
        setBuildings(nextBuildings);
        window.localStorage.setItem("staywise-buildings", JSON.stringify(nextBuildings));
        toast({ variant: "success", title: "Nhập tòa nhà thành công", description: `Đã thêm ${importedCount} tòa nhà vào giao diện.` });
        return true;
      }

      if (target === "floors") {
        if (!selectedBuildingId) throw new Error("Vui lòng chọn tòa nhà trước khi nhập tầng.");
        const nextFloors = [...floors];
        let importedCount = 0;
        rows.forEach((row) => {
          const name = getImportedValue(row, ["tên tầng", "ten tang", "tầng", "tang", "floor name", "floor"]);
          const buildingNameOrCode = getImportedValue(row, ["tên tòa", "ten toa", "tòa", "toa", "building", "building code"]);
          if (!name || nextFloors.some((item) => normalizeText(item) === normalizeText(name))) return;
          if (buildingNameOrCode) {
            const selectedBuilding = buildings.find((item) => item.id === selectedBuildingId);
            if (!selectedBuilding || normalizeText(buildingNameOrCode) !== normalizeText(selectedBuilding.name) &&
              buildingNameOrCode.toLocaleLowerCase() !== selectedBuilding.id.toLocaleLowerCase()) return;
          }
          nextFloors.push(name);
          importedCount += 1;
        });
        if (importedCount === 0) throw new Error("Không có tầng mới hợp lệ. Cần cột Tên tầng cho tòa nhà đang chọn.");
        setFloors(nextFloors);
        toast({ variant: "success", title: "Nhập tầng thành công", description: `Đã thêm ${importedCount} tầng vào giao diện.` });
        return true;
      }

      const importedAmenities = rows.map((row, index) => {
        const name = getImportedValue(row, ["tên tiện ích", "ten tien ich", "tên tiện nghi", "ten tien nghi", "tiện ích", "tien ich", "amenity", "name"]);
        const priceText = getImportedValue(row, ["giá tiền", "gia tien", "giá", "gia", "price"]);
        const price = Number(priceText.replace(/\./g, "").replace(/,/g, "."));
        if (!name || !priceText || !Number.isFinite(price) || price < 0) {
          throw new Error(`Dòng ${index + 2} cần có tên tiện ích và giá không âm hợp lệ.`);
        }
        return { row: index + 2, name, price };
      });
      if (importedAmenities.length === 0) throw new Error("File không có tiện ích hợp lệ để nhập.");
      setAmenityImportProgress(`Đã kiểm tra ${importedAmenities.length} dòng. Đang gửi dữ liệu lên máy chủ...`);
      setAmenityImportProgressPercent(5);
      const { taskId } = await importAmenitiesFromFile({ amenities: importedAmenities }).unwrap();
      if (!taskId) throw new Error("Máy chủ không trả về mã tiến trình nhập tiện nghi.");

      let importStatus = await getAmenityImportStatus(taskId);
      while (!isAmenityImportFinished(importStatus)) {
        if (typeof importStatus.percent === "number") {
          setAmenityImportProgressPercent(importStatus.percent);
        }
        setAmenityImportProgress(importStatus.message || "Máy chủ đang xử lý dữ liệu tiện nghi...");
        await new Promise((resolve) => window.setTimeout(resolve, 500));
        importStatus = await getAmenityImportStatus(taskId);
      }

      if (importStatus.status.trim().toUpperCase() !== "SUCCESS") {
        throw new Error(importStatus.message || "Máy chủ không thể lưu tiện nghi.");
      }
      const savedAmenities = Array.isArray(importStatus.details) ? importStatus.details : [];
      dispatch(baseApi.util.invalidateTags(["Amenity", "Room"]));
      const skippedCount = importedAmenities.length - savedAmenities.length;
      setAmenityImportProgress(
        savedAmenities.length > 0
          ? `Hoàn tất: đã lưu ${savedAmenities.length} tiện nghi${skippedCount > 0 ? `, bỏ qua ${skippedCount} dòng trùng tên` : ""}.`
          : `Hoàn tất: không có tiện nghi mới; đã bỏ qua ${skippedCount} dòng trùng tên.`,
      );
      setAmenityImportProgressPercent(100);
      toast({
        variant: savedAmenities.length > 0 ? "success" : "default",
        title: savedAmenities.length > 0 ? "Nhập tiện nghi thành công" : "Không có tiện nghi mới",
        description: savedAmenities.length > 0
          ? `Đã lưu ${savedAmenities.length} tiện nghi vào cơ sở dữ liệu.${skippedCount > 0 ? ` Đã bỏ qua ${skippedCount} dòng bị trùng tên.` : ""}`
          : `Tất cả ${skippedCount} tiện nghi đã tồn tại nên không có dữ liệu mới được lưu.`,
      });
      return true;
    } catch (error) {
      if (target === "amenities") {
        setAmenityImportProgress("");
        setAmenityImportProgressPercent(undefined);
        if (typeof error === "object" && error !== null && "data" in error) {
          const response = error.data;
          if (typeof response === "object" && response !== null && "message" in response && typeof response.message === "string") {
            throw new Error(response.message);
          }
        }
        throw error;
      }
      toast({
        variant: "destructive",
        title: "Không thể nhập dữ liệu",
        description: error instanceof Error ? error.message : "Không thể đọc file.",
      });
      return true;
    }
  };

  return <section className="mt-6 rounded-2xl border border-slate-200/80 bg-white shadow-sm">
    <input
      ref={importFileInputRef}
      type="file"
      className="hidden"
      onChange={(event) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (file) void importLocalDataFromFile(file);
      }}
    />
    {detailRoom && <RoomDetailModal room={detailRoom} onClose={() => setDetailRoom(null)} />}
    {activeTab !== "pricing" && <>
      <div className="flex flex-col gap-4 border-b border-slate-100 p-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="font-bold text-slate-900">
            {activeTab === "rooms" ? t("room.roomList") : activeTab === "buildings" ? t("room.buildingList", "Danh sách tòa nhà") : activeTab === "floors" ? t("room.floorManagement") : "Danh sách tiện nghi"}
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            {activeTab === "rooms" ? `${filtered.length} ${t("room.roomsAtBranch")} · ${t("room.realTimeUpdate")}` : activeTab === "buildings" ? `${filteredBuildings.length} tòa nhà` : activeTab === "floors" ? `${floors.length} tầng · ${buildings.find((item) => item.id === selectedBuildingId)?.name ?? ""}` : `${amenityCatalog.length} tiện nghi`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canManageRooms && (activeTab === "rooms" || activeTab === "amenities") && <button
            type="button"
            onClick={() => {
              if (activeTab === "rooms") setIsRoomImportDialogOpen(true);
              else if (activeTab === "amenities") setIsAmenityImportDialogOpen(true);
              else openImportPicker(activeTab);
            }}
            disabled={importingRooms}
            className="flex w-fit items-center gap-2 rounded-lg border border-blue-200 bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 shadow-sm transition hover:bg-blue-50 disabled:opacity-50"
          >
            <Upload size={16} />{importingRooms && activeTab === "rooms" ? "Đang đọc file..." : "Tải dữ liệu bằng file"}
          </button>}
          {canManageRooms && activeTab !== "amenities" && (
            <button
              type="button"
              onClick={() => activeTab === "rooms" ? openCreateRoomModal() : activeTab === "buildings" ? openCreateBuildingModal() : openCreateFloorModal()}
              className="flex w-fit items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-200 transition hover:bg-blue-700"
            >
              <span className="text-lg leading-none">+</span>{activeTab === "rooms" ? t("room.addRoom") : activeTab === "buildings" ? t("room.addBuilding") : t("room.addFloor")}
            </button>
          )}
          {canManageRooms && activeTab === "amenities" && (
            <button
              type="button"
              onClick={() => setIsCreatingAmenity(true)}
              className="flex w-fit items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-200 transition hover:bg-blue-700"
            >
              <span className="text-lg leading-none">+</span>Thêm tiện nghi
            </button>
          )}
        </div>
      </div>
      <div className="flex flex-wrap border-b border-slate-100 bg-slate-50/60 p-2">
        <button type="button" onClick={() => setActiveTab("rooms")} className={`min-w-36 flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${activeTab === "rooms" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:bg-white/70"}`}>{t("navigation.rooms")}</button>
        {canViewRoomStructure && <button type="button" onClick={() => setActiveTab("buildings")} className={`min-w-36 flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${activeTab === "buildings" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:bg-white/70"}`}>{t("room.buildings")}</button>}
        {canViewRoomStructure && <button type="button" onClick={() => setActiveTab("floors")} className={`min-w-36 flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${activeTab === "floors" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:bg-white/70"}`}>{t("room.floors")}</button>}
        {canViewRoomStructure && <button type="button" onClick={() => setActiveTab("amenities")} className={`min-w-36 flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${activeTab === "amenities" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:bg-white/70"}`}>Danh sách tiện nghi</button>}
      </div>
    </>}
    {canViewRoomStructure && activeTab === "buildings" && <>
      {isBuildingsError && <p className="border-b border-rose-100 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-700">Không thể tải danh sách tòa nhà.</p>}
      {isBuildingsLoading && <p className="border-b border-blue-100 bg-blue-50 px-4 py-3 text-xs font-medium text-blue-700">Đang tải danh sách tòa nhà...</p>}
      <BuildingManagementPanel buildings={buildings} query={buildingQuery} filteredBuildings={filteredBuildings} onQueryChange={setBuildingQuery} onEdit={openEditBuildingModal} canManage={canManageRooms} />
    </>}
    {canViewRoomStructure && activeTab === "floors" && <>
      {isBuildingsError && <p className="border-b border-rose-100 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-700">Không thể tải danh sách tòa nhà.</p>}
      {isBuildingsLoading && <p className="border-b border-blue-100 bg-blue-50 px-4 py-3 text-xs font-medium text-blue-700">Đang tải danh sách tòa nhà...</p>}
      {isFloorsError && <p className="border-b border-rose-100 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-700">Không thể tải danh sách tầng của tòa nhà này.</p>}
      {(isFloorsLoading || isFloorsFetching) && <p className="border-b border-blue-100 bg-blue-50 px-4 py-3 text-xs font-medium text-blue-700">Đang tải danh sách tầng...</p>}
      <FloorManagementPanel floors={floors} rooms={rooms} buildings={buildings} selectedBuildingId={selectedBuildingId} onBuildingChange={setSelectedBuildingId} onEdit={openEditFloorModal} canManage={canManageRooms} />
    </>}
    {canViewRoomStructure && activeTab === "amenities" && <RoomAmenitiesTab amenities={amenityCatalog} isLoading={isAmenitiesLoading} isError={isAmenitiesError} canManage={canManageRooms} isCreating={isCreatingAmenity} onCreateOpenChange={setIsCreatingAmenity} onSave={saveAmenityEdit} onAdd={addLocalAmenity} />}
    <BulkImportDialog
      open={isRoomImportDialogOpen}
      onOpenChange={setIsRoomImportDialogOpen}
      eyebrow="Nhập hàng loạt"
      title="Tải dữ liệu phòng"
      description="Đặt file Excel mẫu và ảnh trong thư mục dulieuphong rồi nén thành dulieuphong.zip. Ảnh được tải trực tiếp lên Cloudinary trước khi gửi dữ liệu phòng cho máy chủ."
      templateLabel="Tải file Excel mẫu"
      onDownloadTemplate={() => {
        if (isBedTypesLoading) {
          toast({ title: "Đang tải danh sách loại giường", description: "Vui lòng đợi danh sách giường tải xong rồi tạo mẫu." });
          return;
        }
        if (isBedTypesError) {
          toast({ variant: "destructive", title: "Không thể tải danh sách loại giường", description: "Hãy kiểm tra kết nối máy chủ rồi thử lại." });
          return;
        }
        if (isBuildingsLoading || isHotelFloorsLoading) {
          toast({ title: "Đang tải danh sách tòa và tầng", description: "Vui lòng đợi trong giây lát rồi tải mẫu Excel." });
          return;
        }
        if (isBuildingsError || isHotelFloorsError) {
          toast({ variant: "destructive", title: "Không thể tải danh sách tòa và tầng", description: "Hãy kiểm tra kết nối máy chủ rồi thử lại." });
          return;
        }
        try {
          downloadRoomTemplate(roomImportOptions);
        } catch (error) {
          toast({
            variant: "destructive",
            title: "Không thể tạo file Excel mẫu",
            description: error instanceof Error ? error.message : "Đã xảy ra lỗi không xác định.",
          });
        }
      }}
      acceptedFileTypes=".zip,application/zip"
      fileLabel="File ZIP bộ dữ liệu (.zip)"
      validateFile={(file) => file.name.toLocaleLowerCase() === "dulieuphong.zip" ? null : "Vui lòng chọn đúng file dulieuphong.zip."}
      instructions={
        <>
          <p className="font-bold">Cấu trúc file ZIP</p>
          <pre className="my-2 overflow-x-auto rounded-lg bg-amber-100/70 p-3 font-mono text-[11px] leading-5 text-amber-950">{`dulieuphong.zip
└── dulieuphong/
    ├── phong.xlsx
    └── images/
        ├── 101-1.jpg
        ├── 101-2.jpg
        ├── 101-3.jpg
        └── 101-4.jpg`}</pre>
          <p>Trong Excel, các ô Loại phòng, Tòa và Trạng thái có danh sách xổ xuống để chọn. Cột Tầng nhập số nguyên floorNumber; hệ thống ghép số tầng với Tòa để tìm đúng tầng. Tiện ích nhập trong một ô bằng ID, ngăn cách nhiều ID bằng dấu chấm phẩy (;); tra ID và tên ở sheet Danh mục. Chỉ ID có trong danh mục mới được chấp nhận. Số phòng phải là số nguyên dương.</p>
          <p className="mt-2">Tại sheet <strong>Giường phòng</strong>, mỗi dòng chọn Số phòng và Loại giường từ danh sách xổ xuống rồi nhập số lượng (từ 1 trở lên). Một phòng có thể có nhiều loại giường bằng cách thêm nhiều dòng cho cùng số phòng; mỗi phòng cần ít nhất một dòng cấu hình giường.</p>
          <p className="mt-2">Mỗi phòng cần từ 4 đến 8 ảnh, tối đa 5 MB mỗi ảnh. Nhập tên file ảnh bằng tay vào các cột Ảnh 1–Ảnh 8; tên phải khớp ảnh trong thư mục <strong>images</strong>, gồm phần đuôi, ví dụ <strong>101-1.jpg</strong>. Mỗi dòng là một phòng, không đổi tên cột.</p>
          <p className="mt-2">Trong thư mục <strong>dulieuphong</strong>, đặt <strong>phong.xlsx</strong> và thư mục <strong>images</strong> cùng cấp. Sau đó nén thư mục <strong>dulieuphong</strong> thành <strong>dulieuphong.zip</strong>. FE tải ảnh trực tiếp lên Cloudinary bằng unsigned upload preset; máy chủ chỉ nhận URL ảnh và lưu phòng.</p>
        </>
      }
      uploadLabel="Nhập phòng"
      progress={roomImportUploadProgress || undefined}
      onUpload={importRoomsFromFile}
    />
    <BulkImportDialog
      open={isAmenityImportDialogOpen}
      onOpenChange={(open) => {
        setIsAmenityImportDialogOpen(open);
        if (open) {
          setAmenityImportProgress("");
          setAmenityImportProgressPercent(undefined);
        }
      }}
      eyebrow="Nhập hàng loạt"
      title="Tải dữ liệu tiện nghi"
      description="Tải file Excel mẫu ngay tại đây, điền danh sách tiện nghi và giữ nguyên tên file khi tải lên."
      templateLabel="Tải file Excel mẫu tiện nghi"
      onDownloadTemplate={downloadAmenityTemplate}
      acceptedFileTypes=".xlsx"
      fileLabel="File Excel tiện nghi (mau-nhap-tien-ich.xlsx)"
      validateFile={(file) => file.name.toLocaleLowerCase() === "mau-nhap-tien-ich.xlsx"
        ? null
        : 'Vui lòng chọn đúng file "mau-nhap-tien-ich.xlsx". Không đổi tên file mẫu.'}
      instructions={
        <>
          <p>File cần có hai cột <strong>Tên tiện ích</strong> và <strong>Giá tiền</strong>. Giá nhập bằng số không âm, không thêm ký hiệu tiền tệ.</p>
          <p className="mt-2">Các tiện ích trùng tên (không phân biệt hoa thường hoặc dấu tiếng Việt) sẽ được bỏ qua; các tiện nghi mới được lưu vào cơ sở dữ liệu.</p>
        </>
      }
      uploadLabel="Nhập tiện nghi"
      progress={amenityImportProgress || undefined}
      progressPercent={amenityImportProgress ? amenityImportProgressPercent : undefined}
      onUpload={(file) => importLocalDataFromFile(file, "amenities")}
    />
    {(roomImportReport || roomSocketImportProgress) && (
      <RoomImportProgressCard
        processing={roomImportReport?.processing ?? false}
        rows={roomSocketImportProgress?.rows ?? roomImportReport?.rows ?? []}
        archiveError={roomImportReport?.archiveError}
        liveProgress={roomSocketImportProgress ?? undefined}
        onDismiss={() => {
          setRoomImportReport(null);
          setRoomSocketImportProgress(null);
          activeRoomImportTaskIdRef.current = "";
          setRoomImportTaskId("");
        }}
      />
    )}
    {activeTab === "rooms" && <RoomListTab
       canManageRooms={canManageRooms}
      filtered={filtered}
      paginatedRooms={paginatedRooms}
      buildings={buildings}
      floors={hotelFloorNames}
      roomTypes={availableRoomTypes}
      statuses={availableRoomStatuses}
      statusStyle={statusStyle}
      query={query}
      onQueryChange={setQuery}
      building={building}
      onBuildingChange={setBuilding}
      floor={floor}
      onFloorChange={setFloor}
      roomType={roomType}
      onRoomTypeChange={setRoomType}
      status={status}
      onStatusChange={setStatus}
      statusMenuRoom={statusMenuRoom}
      setStatusMenuRoom={setStatusMenuRoom}
      safePage={safePage}
      pageSize={pageSize}
      onPageChange={setPage}
      onPageSizeChange={setPageSize}
      onUpdateRoom={updateRoom}
      onCompleteCleaning={completeCleaning}
      onEditRoom={openEditRoomModal}
      onShowGallery={(room) => { setGalleryRoom(room); setGalleryIndex(0); }}
      onShowDetails={setDetailRoom}
      onAssign={setAssignmentRoom}
    />}
    {activeTab === "pricing" && (
      <div className="p-6 space-y-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h4 className="text-xl font-bold text-slate-900">Cấu hình giá niêm yết</h4>
            <p className="mt-1 text-xs text-slate-500">Thiết lập mức giá cơ bản và phụ thu theo loại phòng hoặc theo lịch sự kiện đặc biệt.</p>
          </div>
        </div>
        {pricingMode === "branch" && isBranchPoliciesLoading && <p className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700">Đang tải cấu hình giá chi nhánh...</p>}
        {pricingMode === "branch" && isBranchPoliciesError && <p className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">Không thể tải cấu hình giá chi nhánh.</p>}
        {pricingMode === "branch" && pricingSaveError && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">{pricingSaveError}</p>}
        <div className="flex rounded-xl border border-slate-200 bg-slate-100 p-1">
          <button type="button" onClick={() => setPricingMode("branch")} className={`flex-1 flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-xs font-bold transition ${pricingMode === "branch" ? "bg-white text-blue-700 shadow-xs" : "text-slate-500 hover:text-slate-800"}`}>
            <Building2 size={16} />Cấu hình giá theo loại phòng
          </button>
          <button
            type="button"
            onClick={() => setPricingMode("event")}
            className={`flex-1 flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-xs font-bold transition ${
              pricingMode === "event" ? "bg-white text-blue-700 shadow-xs" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <CalendarDays size={16} />
            Cấu hình giá theo sự kiện
          </button>
        </div>

        {pricingMode === "branch" ? (
          <div className="space-y-6">
            {editingPricingType && (() => {
              const entry = roomTypePricing.find((item) => item.roomType === editingPricingType);
              if (!entry) return null;
              const draft = pricingDrafts[entry.roomType] || {
                price: String(entry.price),
                extraAdultFee: String(entry.extraAdultFee),
                extraChildFee: String(entry.extraChildFee),
                standardCapacity: String(entry.standardCapacity),
                maxExtraGuests: String(entry.maxExtraGuests),
              };
              const currentPriceNum = Number(draft.price) || 0;
              const currentAdultFeeNum = Number(draft.extraAdultFee) || 0;
              const currentChildFeeNum = Number(draft.extraChildFee) || 0;
              const currentStandardCapacity = Number(draft.standardCapacity) || entry.standardCapacity || 1;
              const currentMaxExtraGuests = Number(draft.maxExtraGuests) || entry.maxExtraGuests || 0;
              const isModified = String(draft.price) !== String(entry.price) || String(draft.extraAdultFee) !== String(entry.extraAdultFee) || String(draft.extraChildFee) !== String(entry.extraChildFee) || String(draft.standardCapacity) !== String(entry.standardCapacity) || String(draft.maxExtraGuests) !== String(entry.maxExtraGuests);

              return (
                <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4" onMouseDown={() => setEditingPricingType(null)}>
                  <div className="w-full max-w-lg rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.12)]" onMouseDown={(event) => event.stopPropagation()}>
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div>
                        <h3 className="mt-2 text-[18px] font-bold leading-none tracking-[-0.02em] text-slate-600">Cập nhật cho loại phòng</h3>
                        <h3 className="mt-2 text-[16px] font-black leading-none tracking-[-0.03em] text-slate-900">{entry.roomType}</h3>
                      </div>
                      <button type="button" onClick={() => setEditingPricingType(null)} className="grid h-11 w-11 place-items-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700">
                        <X size={20} />
                      </button>
                    </div>

                    <div className="space-y-3 text-sm">
                      <div>
                        <label className="mb-1.5 block text-[13px] font-semibold text-slate-700">
                          Số lượng người tiêu chuẩn
                          <span className="ml-1 text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={draft.standardCapacity}
                          onChange={(event) => handlePricingDraftChange(entry.roomType, "standardCapacity", event.target.value)}
                          className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[15px] font-semibold text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                        />
                      </div>

                      <div>
                        <label className="mb-1.5 block text-[13px] font-semibold text-slate-700">
                          Số người cho phép ở ghép
                          <span className="ml-1 text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={draft.maxExtraGuests}
                          onChange={(event) => handlePricingDraftChange(entry.roomType, "maxExtraGuests", event.target.value)}
                          className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[15px] font-semibold text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                        />
                      </div>

                      <div>
                        <label className="mb-1.5 block text-[13px] font-semibold text-slate-700">
                          Giá phòng / đêm
                          <span className="ml-1 text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            step="1000"
                            value={draft.price}
                            onChange={(event) => handlePricingDraftChange(entry.roomType, "price", event.target.value)}
                            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 pr-12 text-[15px] font-semibold text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-400">VNĐ</span>
                        </div>
                      </div>

                      <div>
                        <label className="mb-1.5 block text-[13px] font-semibold text-slate-700">
                          Phụ thu người lớn
                          <span className="ml-1 text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            step="1000"
                            value={draft.extraAdultFee}
                            onChange={(event) => handlePricingDraftChange(entry.roomType, "extraAdultFee", event.target.value)}
                            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 pr-12 text-[15px] font-semibold text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-400">VNĐ</span>
                        </div>
                      </div>

                      <div>
                        <label className="mb-1.5 block text-[13px] font-semibold text-slate-700">
                          Phụ thu trẻ em
                          <span className="ml-1 text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            step="1000"
                            value={draft.extraChildFee}
                            onChange={(event) => handlePricingDraftChange(entry.roomType, "extraChildFee", event.target.value)}
                            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 pr-12 text-[15px] font-semibold text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-400">VNĐ</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 flex items-center justify-between gap-2 border-t border-slate-100 pt-4">
                      <span className="text-[11px] font-semibold text-slate-500">{currentStandardCapacity} người · {currentMaxExtraGuests} ghép thêm · {money(currentPriceNum)} / {money(currentAdultFeeNum)} / {money(currentChildFeeNum)}</span>
                      <div className="flex gap-2.5">
                        <button type="button" onClick={() => setEditingPricingType(null)} className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-600 transition hover:bg-slate-100">Hủy</button>
                        <button
                          type="button"
                          onClick={async () => {
                            if (await saveRoomTypePricing(entry.roomType)) setEditingPricingType(null);
                          }}
                          className={`h-10 rounded-xl px-4 text-sm font-bold text-white transition ${isModified ? "bg-blue-600 hover:bg-blue-700" : "bg-slate-300"}`}
                          disabled={!isModified || !entry.policyId || isUpdatingPolicy}
                        >
                          {isUpdatingPolicy ? "Đang lưu..." : "Lưu"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-4">
              {roomTypePricing.map((entry) => {
                const fallbackDetails = roomTypeDetails[entry.roomType] ?? {
                  area: entry.area ? `${entry.area} m²` : "N/A",
                  beds: "",
                  capacity: entry.capacity || entry.standardCapacity || 1,
                  guestPolicy: "",
                  price: entry.price,
                  description: "",
                };
                const details = roomTypeDetails[entry.roomType] ? roomTypeDetails[entry.roomType] : fallbackDetails;
                const displayArea = entry.area ? `${entry.area} m²` : details.area;
                const displayCapacity = entry.capacity || details.capacity || entry.standardCapacity;
                const draft = pricingDrafts[entry.roomType] || {
                  price: String(entry.price),
                  extraAdultFee: String(entry.extraAdultFee),
                  extraChildFee: String(entry.extraChildFee),
                  standardCapacity: String(entry.standardCapacity),
                  maxExtraGuests: String(entry.maxExtraGuests),
                };

                const currentPriceNum = Number(draft.price) || 0;
                const currentAdultFeeNum = Number(draft.extraAdultFee) || 0;
                const currentChildFeeNum = Number(draft.extraChildFee) || 0;
                const currentStandardCapacity = Number(draft.standardCapacity) || entry.standardCapacity || 1;
                const currentMaxExtraGuests = Number(draft.maxExtraGuests) || entry.maxExtraGuests || 0;

                const isModified =
                  String(draft.price) !== String(entry.price) ||
                  String(draft.extraAdultFee) !== String(entry.extraAdultFee) ||
                  String(draft.extraChildFee) !== String(entry.extraChildFee) ||
                  String(draft.standardCapacity) !== String(entry.standardCapacity) ||
                  String(draft.maxExtraGuests) !== String(entry.maxExtraGuests);

                const theme =
                  entry.roomType === "Suite Room"
                    ? { iconBg: "bg-amber-500/15 text-amber-700", accent: "bg-amber-500" }
                    : entry.roomType === "Deluxe Room"
                    ? { iconBg: "bg-violet-500/15 text-violet-700", accent: "bg-violet-500" }
                    : entry.roomType === "Family Room"
                    ? { iconBg: "bg-emerald-500/15 text-emerald-700", accent: "bg-emerald-500" }
                    : { iconBg: "bg-blue-500/15 text-blue-700", accent: "bg-blue-500" };

                return (
                  <div
                    key={entry.roomType}
                    className="flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${theme.iconBg}`}>
                            <BedDouble size={20} />
                          </div>
                          <div className="w-full">
                            <h5 className="text-base font-bold text-slate-900">{entry.roomType}</h5>
                            <div className={`mt-1 h-1 w-20 rounded-full ${theme.accent}`} />
                            {details && (
                              <p className="mt-2 text-xs text-slate-500">
                                {displayArea} · {displayCapacity} người
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">
                            {entry.count} phòng
                          </span>
                          <button
                            type="button"
                            onClick={() => setEditingPricingType(entry.roomType)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600 transition hover:bg-slate-100 hover:text-slate-800"
                            title="Chỉnh sửa"
                          >
                            <Pencil size={14} />
                          </button>
                        </div>
                      </div>

                      <div className="grid gap-2 border-t border-slate-100 pt-3">
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span>Tiêu chuẩn</span>
                          <strong className="text-sm font-bold text-slate-900">{currentStandardCapacity} người</strong>
                        </div>
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span>Cho phép ghép</span>
                          <strong className="text-sm font-bold text-slate-900">{currentMaxExtraGuests} người</strong>
                        </div>
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span>Giá phòng / đêm</span>
                          <strong className="text-sm font-bold text-slate-900">{money(currentPriceNum)}</strong>
                        </div>
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span>Phụ thu người lớn</span>
                          <strong className="font-semibold text-slate-700">+{money(currentAdultFeeNum)}/người</strong>
                        </div>
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span>Phụ thu trẻ em</span>
                          <strong className="font-semibold text-slate-700">+{money(currentChildFeeNum)}/trẻ</strong>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <EventPricingCalendar />
          </div>
        )}
      </div>
    )}
    {showCreateBuilding && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4" onMouseDown={() => { if (!isCreatingBuilding) closeCreateBuildingModal(); }}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div><p className="text-xs font-bold uppercase tracking-wider text-blue-600">Quản lý cơ sở vật chất</p><h3 className="mt-2 text-xl font-bold text-slate-900">{editingBuildingId ? "Sửa tòa nhà" : "Tạo tòa nhà mới"}</h3><p className="mt-1 text-sm text-slate-500">{editingBuildingId ? "Cập nhật tên tòa nhà. Mã tòa được giữ nguyên." : "Nhập tên tòa nhà; mã sẽ được tạo sau khi lưu."}</p></div>
          <button type="button" onClick={closeCreateBuildingModal} disabled={isCreatingBuilding || isUpdatingBuilding} className="text-slate-400 hover:text-slate-700 disabled:opacity-50"><X size={19} /></button>
        </div>
        <div className="mt-5 space-y-4">
          <label className="block text-sm font-semibold text-slate-700">Tên tòa nhà <span className="text-rose-500">*</span><input autoFocus value={buildingForm.name} onChange={(event) => setBuildingForm((current) => ({ ...current, name: event.target.value }))} onKeyDown={(event) => { if (event.key === "Enter" && buildingForm.name.trim()) void saveBuilding(); }} placeholder="Ví dụ: Tòa Sunrise" className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></label>
          {editingBuildingId && <label className="block text-sm font-semibold text-slate-700">Mã tòa nhà<input value={buildingForm.code} readOnly className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-semibold tracking-wider text-slate-700 outline-none" /></label>}
        </div>
        <div className="mt-6 flex justify-end gap-2"><button type="button" onClick={closeCreateBuildingModal} disabled={isCreatingBuilding || isUpdatingBuilding} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">Hủy</button><button type="button" onClick={() => void saveBuilding()} disabled={!buildingForm.name.trim() || isCreatingBuilding || isUpdatingBuilding} className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-200">{isCreatingBuilding || isUpdatingBuilding ? "Đang lưu..." : editingBuildingId ? "Lưu thay đổi" : "Tạo tòa nhà"}</button></div>
      </div>
    </div>}
    {showCreateFloor && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4" onMouseDown={() => { if (!isCreatingFloor && !isUpdatingFloor) closeCreateFloorModal(); }}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div><p className="text-xs font-bold uppercase tracking-wider text-blue-600">{t("room.floorManagement")}</p><h3 className="mt-2 text-xl font-bold text-slate-900">{editingFloor ? t("room.editFloor") : t("room.createFloor")}</h3><p className="mt-1 text-sm text-slate-500">{editingFloor ? t("room.editFloorDescription") : t("room.createFloorDescription")}</p></div>
          <button type="button" onClick={closeCreateFloorModal} disabled={isCreatingFloor || isUpdatingFloor} className="text-slate-400 hover:text-slate-700 disabled:opacity-50"><X size={19} /></button>
        </div>
        <label className="mt-5 block text-sm font-semibold text-slate-700">Tòa nhà <span className="text-rose-500">*</span><select value={selectedBuildingId} onChange={(event) => setSelectedBuildingId(event.target.value)} disabled={Boolean(editingFloor) || buildings.length === 0 || isCreatingFloor || isUpdatingFloor} className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50">{buildings.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label className="mt-4 block text-sm font-semibold text-slate-700">Số tầng <span className="text-rose-500">*</span><input autoFocus type="number" step="1" value={floorForm.name} onChange={(event) => setFloorForm({ name: event.target.value })} onKeyDown={(event) => { if (event.key === "Enter") void saveFloor(); }} placeholder="Ví dụ: 1 hoặc -1" className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></label>
        <div className="mt-6 flex justify-end gap-2"><button type="button" onClick={closeCreateFloorModal} disabled={isCreatingFloor || isUpdatingFloor} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">{t("common.cancel")}</button><button type="button" onClick={() => void saveFloor()} disabled={!floorForm.name.trim() || !selectedBuildingId || isCreatingFloor || isUpdatingFloor} className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-200">{isCreatingFloor || isUpdatingFloor ? "Đang lưu..." : t("common.save")}</button></div>
      </div>
    </div>}
    {showCreateRoom && (
      <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4" onMouseDown={closeCreateRoomModal}>
        <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-[26px] border border-slate-200 bg-[#f3f4f6] shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
          <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
            <div>
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-blue-600">
                <span className="inline-flex h-2 w-2 rounded-full bg-blue-500" />
                <span>{t(editingRoomId ? "room.editRoomBadge" : "room.createRoomBadge")}</span>
              </div>
              <h3 className="mt-2 text-[28px] font-bold tracking-tight text-slate-900">{editingRoomId ? "Sửa phòng" : "Tạo phòng mới"}</h3>
            </div>

            <div className="flex items-center gap-2">
              <button type="button" onClick={closeCreateRoomModal} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">Hủy</button>
              <button type="button" onClick={() => void saveRoom()} disabled={isCreatingRoom || isUpdatingRoom} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-200 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">{isCreatingRoom || isUpdatingRoom ? "Đang lưu..." : editingRoomId ? "Lưu thay đổi" : "Lưu phòng"}</button>
            </div>
          </div>

          <div className="grid gap-5 overflow-y-auto p-5 lg:grid-cols-[1.4fr_0.8fr]">
            <div className="space-y-5">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-600">1</span>
                  Thông tin cơ bản
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className="block text-sm font-semibold text-slate-700">
                    Loại phòng <span className="text-rose-500">*</span>
                    {isRoomTypesError && <p className="mt-1 text-xs font-normal text-rose-600">Không tải được loại phòng từ API.</p>}
                    {isRoomTypeDetailLoading && <p className="mt-1 text-xs font-normal text-blue-600">Đang tải thông tin chi tiết loại phòng...</p>}
                    {isRoomTypeDetailError && <p className="mt-1 text-xs font-normal text-rose-600">Không tải được chi tiết loại phòng.</p>}
                    <select disabled={isRoomTypesLoading || isRoomTypesError || availableRoomTypes.length === 0} value={createRoomForm.roomType} onChange={(event) => setCreateRoomForm((current) => ({ ...current, roomType: event.target.value, ...roomFormDefaults(event.target.value) }))} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-50">
                      {availableRoomTypes.map((roomType) => <option key={roomType} value={roomType}>{roomType}</option>)}
                    </select>
                  </label>

                  <label className="block text-sm font-semibold text-slate-700">
                    Tòa nhà <span className="text-rose-500">*</span>
                    <select value={createRoomForm.building} onChange={(event) => { const buildingId = event.target.value; setSelectedBuildingId(buildingId); setCreateRoomForm((current) => ({ ...current, building: buildingId, floor: "" })); }} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100">
                      {buildings.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </select>
                  </label>
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className="block text-sm font-semibold text-slate-700">
                    Số phòng <span className="text-rose-500">*</span>
                    <input type="text" inputMode="numeric" pattern="[0-9]*" required value={createRoomForm.roomNumber} onChange={(event) => setCreateRoomForm((current) => ({ ...current, roomNumber: event.target.value.replace(/\D/g, "") }))} placeholder="Ví dụ: 101" className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-normal outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
                  </label>
                  <label className="block text-sm font-semibold text-slate-700">
                    Tầng <span className="text-rose-500">*</span>
                    <select value={createRoomForm.floor} onChange={(event) => setCreateRoomForm((current) => ({ ...current, floor: event.target.value }))} disabled={isFloorsLoading || isFloorsFetching || selectedBuildingFloorOptions.length === 0} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-50">
                      {isFloorsLoading || isFloorsFetching ? <option value="">Đang tải tầng...</option> : selectedBuildingFloorOptions.length === 0 ? <option value="">Chưa có tầng</option> : selectedBuildingFloorOptions.map((item) => (
                        <option key={item.id} value={item.id}>{item.name.startsWith("Tầng") ? item.name : `Tầng ${item.name}`}</option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-600">2</span>
                  Chi tiết phòng
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className="block text-sm font-semibold text-slate-700">
                    Diện tích <span className="text-rose-500">*</span>
                    <input type="number" min="1" step="0.1" value={createRoomForm.area} disabled className="mt-1.5 h-11 w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-100 px-3 text-sm font-normal text-slate-500 outline-none" />
                  </label>

                  <label className="block text-sm font-semibold text-slate-700">
                    Giá tiêu chuẩn
                    <input type="number" min="1" step="1000" value={standardRoomPrice} disabled className="mt-1.5 h-11 w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-100 px-3 text-sm font-normal text-slate-500 outline-none" />
                    <span className="mt-1 block text-xs font-normal text-slate-500">Giá chính thức / đêm: {money(officialRoomPrice)} (tiện ích tính riêng)</span>
                  </label>
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                  <label className="block text-sm font-semibold text-slate-700">
                    Sức chứa tiêu chuẩn <span className="text-rose-500">*</span>
                    <input type="number" min="1" value={createRoomForm.standardCapacity} disabled className="mt-1.5 h-11 w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-100 px-3 text-sm text-slate-500 outline-none" />
                    <span className="mt-1 block text-xs font-normal text-slate-400">Số khách đã bao gồm trong giá phòng</span>
                  </label>
                  <label className="block text-sm font-semibold text-slate-700">
                    Số người ghép tối đa<span className="text-rose-500">*</span>
                    <input type="number" min="0" value={createRoomForm.maxExtraGuests} disabled className="mt-1.5 h-11 w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-100 px-3 text-sm text-slate-500 outline-none" />
                    <span className="mt-1 block text-xs font-normal text-slate-400">Số khách thêm ngoài tiêu chuẩn</span>
                  </label>
                </div>

                <div className="mt-4 grid gap-4 rounded-xl border border-amber-100 bg-amber-50/60 p-3 sm:grid-cols-2">
                  <label className="block text-sm font-semibold text-amber-900">
                    Phụ thu người lớn / người
                    <input type="number" min="0" step="1000" value={createRoomForm.extraAdultFee} disabled className="mt-1.5 h-11 w-full cursor-not-allowed rounded-xl border border-amber-200 bg-amber-100 px-3 text-sm font-normal text-slate-500 outline-none" />
                  </label>
                  <label className="block text-sm font-semibold text-amber-900">
                    Phụ thu trẻ em / người
                    <input type="number" min="0" step="1000" value={createRoomForm.extraChildFee} disabled className="mt-1.5 h-11 w-full cursor-not-allowed rounded-xl border border-amber-200 bg-amber-100 px-3 text-sm font-normal text-slate-500 outline-none" />
                  </label>
                </div>

                <div className="mt-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-700">Loại giường <span className="text-rose-500">*</span></p>
                    {isBedTypesLoading && <span className="text-xs font-normal text-blue-600">Đang tải...</span>}
                  </div>
                  {isBedTypesError ? (
                    <p className="mt-1 text-xs text-rose-600">Không tải được danh sách loại giường.</p>
                  ) : apiBedTypes?.length ? (
                    <div className="mt-2 space-y-2">
                      {apiBedTypes.map((bedType) => {
                        if (bedType.id == null) return null;
                        const selected = createRoomForm.bedConfigurations.find((bed) => Number(bed.bedTypeId) === Number(bedType.id));
                        return (
                          <div key={bedType.id} className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5">
                            <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
                              <input
                                type="checkbox"
                                checked={Boolean(selected)}
                                onChange={(event) => setCreateRoomForm((current) => ({
                                  ...current,
                                  bedConfigurations: event.target.checked
                                    ? [...current.bedConfigurations, { bedTypeId: bedType.id!, quantity: 1 }]
                                    : current.bedConfigurations.filter((bed) => Number(bed.bedTypeId) !== Number(bedType.id)),
                                }))}
                                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="truncate">{bedType.name ?? bedType.bedTypeName}</span>
                              {bedType.isExtraBed && <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">Giường phụ</span>}
                            </label>
                            {selected && (
                              <label className="flex shrink-0 items-center gap-2 text-xs text-slate-500">
                                SL
                                <input
                                  type="number"
                                  min="1"
                                  step="1"
                                  value={selected.quantity}
                                  aria-label={`Số lượng ${bedType.name ?? bedType.bedTypeName}`}
                                  onChange={(event) => {
                                    const quantity = Number(event.target.value);
                                    setCreateRoomForm((current) => ({
                                      ...current,
                                      bedConfigurations: current.bedConfigurations.map((bed) =>
                                        Number(bed.bedTypeId) === Number(bedType.id) ? { ...bed, quantity } : bed,
                                      ),
                                    }));
                                  }}
                                  className="h-9 w-20 rounded-lg border border-slate-200 px-2 text-sm text-slate-800 outline-none focus:border-blue-400"
                                />
                              </label>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="mt-1 text-xs text-amber-700">Chưa có loại giường. Hãy thêm loại giường trước khi tạo phòng.</p>
                  )}
                </div>

                <div className="mt-4">
                  <p className="text-sm font-semibold text-slate-700">Trạng thái phòng <span className="text-rose-500">*</span></p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {isRoomStatusesLoading && <p className="col-span-2 text-xs font-normal text-slate-400">Đang tải trạng thái phòng...</p>}
                    {isRoomStatusesError && <p className="col-span-2 text-xs font-normal text-rose-600">Không tải được trạng thái phòng từ API.</p>}
                    {availableRoomStatuses.map((status) => {
                      const active = createRoomForm.status === status;
                      const badge = "bg-blue-50 text-blue-700 border-blue-200";
                      return (
                        <button
                          key={status}
                          type="button"
                          onClick={() => setCreateRoomForm((current) => ({ ...current, status }))}
                          className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${active ? badge : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"}`}
                        >
                          {status}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-600">3</span>
                    Tiện nghi & dịch vụ <span className="text-rose-500">*</span>
                  </div>

                  <div className="flex items-center gap-2">

                    
                      <button
                        type="button"
                        onClick={clearAllAmenities}
                        className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100"
                      >
                        Bỏ chọn tất cả
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowAmenityMenu(false)}
                        className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100"
                      >
                        Dùng Mặc định
                      </button>
                    
  
                    <button
                      type="button"
                      onClick={() => setShowAmenityMenu((current) => !current)}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100"
                    >
                      + Thêm
                    </button>
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <Search size={15} className="text-slate-400" />
                  <input
                    value={amenitySearch}
                    onChange={(event) => setAmenitySearch(event.target.value)}
                    placeholder="Tìm kiếm tiện nghi..."
                    className="w-full border-0 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
                  />
                </div>

                {showAmenityMenu && (
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_180px]">
                      <input
                        value={newAmenityName}
                        onChange={(event) => setNewAmenityName(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            appendAmenity();
                          }
                        }}
                        placeholder="Tên tiện nghi mới"
                        className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                      />
                      <input
                        type="number"
                        min="0"
                        value={amenityPrice}
                        onChange={(event) => setAmenityPrice(event.target.value)}
                        placeholder="Giá tiện nghi"
                        className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                      />
                    </div>

                    <div className="mt-3 flex items-center justify-end">
                      <button
                        type="button"
                        onClick={() => appendAmenity(newAmenityName)}
                        className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700"
                      >
                        Thêm
                      </button>
                    </div>

                  </div>
                )}

                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {filteredAmenityOptions.map((item) => {
                    const checked = createRoomForm.amenities.some((amenity) => normalizeText(amenity) === normalizeText(item.name));
                    return (
                      <label key={item.id} className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 transition hover:border-blue-200 hover:bg-blue-50/40">
                        <input type="checkbox" checked={checked} onChange={() => (checked ? removeAmenity(item.name) : setCreateRoomForm((current) => ({ ...current, amenities: [...current.amenities, item.name] }))) } className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                        <span title={item.name} className="min-w-0 flex-1 truncate">{item.name}</span>
                        <span className="shrink-0 text-xs font-semibold text-blue-600">{money(item.price)}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-600">4</span>
                  Mô tả & hình ảnh <span className="text-rose-500">*</span>
                </div>

                <textarea value={createRoomForm.description} onChange={(event) => setCreateRoomForm((current) => ({ ...current, description: event.target.value }))} rows={4} placeholder="Nhập mô tả chi tiết phòng, phong cách, vị trí và trải nghiệm khách hàng..." className="mt-4 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />

                <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
                  <label className="flex cursor-pointer items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">
                    <Upload size={18} />
                    Tải ảnh lên
                    <input type="file" multiple accept="image/*" onChange={(event) => addImages(event.target.files)} className="hidden" />
                  </label>

                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {createRoomForm.images.length > 0 ? createRoomForm.images.slice(0, 6).map((image, index) => {
                      const isDefault = createRoomForm.defaultImage ? image === createRoomForm.defaultImage : index === 0;
                      return (
                        <div key={`${image}-${index}`} className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white">
                          <img src={image} alt="Ảnh phòng" className="h-24 w-full object-cover" />
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setCreateRoomForm((current) => ({ ...current, defaultImage: image }));
                            }}
                            className={`absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full border transition ${
                              isDefault ? "border-amber-300 bg-amber-400 text-white" : "border-white/80 bg-slate-900/65 text-slate-100"
                            }`}
                            aria-label="Đặt ảnh làm ảnh mặc định"
                          >
                            <Star size={13} fill={isDefault ? "currentColor" : "none"} />
                          </button>
                          <button type="button" onClick={(event) => { event.stopPropagation(); removeImage(image); }} className="absolute left-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-slate-900/70 text-white opacity-0 transition group-hover:opacity-100">
                            <X size={12} />
                          </button>
                        </div>
                      );
                    }) : (
                      <div className="col-span-full rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-400">
                        Chưa có ảnh nào được tải lên.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-5">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Xem trước</p>
                    <h4 className="mt-2 text-xl font-bold text-slate-900">{createRoomForm.roomType}</h4>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusStyle[createRoomForm.status] ?? "bg-emerald-50 text-emerald-700"}`}>
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    {createRoomForm.status}
                  </span>
                </div>

                <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                  {createRoomForm.images.length > 0 ? (
                    <img src={createRoomForm.defaultImage ?? createRoomForm.images[0]} alt="Preview room" className="h-44 w-full object-cover" />
                  ) : (
                    <div className="grid h-44 place-items-center bg-slate-100 text-sm text-slate-400">
                      Chưa có ảnh preview
                    </div>
                  )}
                </div>

                <div className="mt-4 space-y-3 text-sm text-slate-600">
                  <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                    <span>Tòa</span>
                    <strong className="font-semibold text-slate-800">{selectedBuildingName}</strong>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                    <span>Tầng</span>
                    <strong className="font-semibold text-slate-800">{selectedFloorLabel}</strong>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                    <span>Diện tích</span>
                    <strong className="font-semibold text-slate-800">{createRoomForm.area || 25} m²</strong>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                    <span>Giá chính thức</span>
                    <strong className="font-semibold text-slate-800">{money(officialRoomPrice)}</strong>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                    <ImagePlus size={16} />
                  </span>
                  Tính năng nổi bật
                </div>

                <div className="mt-4 space-y-2 text-sm text-slate-600">
                  {createRoomForm.amenities.slice(0, 5).map((item) => (
                    <div key={item} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2">
                      <span className="min-w-0 truncate">{item}</span>
                      <span className="ml-3 flex shrink-0 items-center gap-2"><span className="text-xs font-semibold text-blue-600">{money(apiAmenities?.find((amenity) => amenity.name === item)?.price ?? customAmenityPrices[item] ?? 0)}</span><Check size={15} className="text-emerald-600" /></span>
                    </div>
                  ))}
                  {createRoomForm.amenities.length === 0 && (
                    <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-center text-sm text-slate-400">Chưa có tiện nghi nào được chọn</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )}
    {galleryRoom && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/75 p-4" onMouseDown={() => setGalleryRoom(null)}><div className="w-full max-w-4xl rounded-2xl bg-white p-4 shadow-2xl sm:p-5" onMouseDown={(event) => event.stopPropagation()}><div className="flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-wider text-blue-600">Thư viện ảnh</p><h3 className="mt-1 text-lg font-bold text-slate-900">Phòng {galleryRoom.id} · {galleryRoom.name}</h3></div><button type="button" onClick={() => setGalleryRoom(null)} className="text-2xl leading-none text-slate-400 hover:text-slate-700">×</button></div><div className="relative mt-4 overflow-hidden rounded-xl bg-slate-100"><img src={galleryRoom.images[galleryIndex]} alt={`${galleryRoom.name} · ảnh ${galleryIndex + 1}`} className="h-[min(52vh,420px)] w-full object-cover" /><button type="button" onClick={() => setGalleryIndex((galleryIndex - 1 + galleryRoom.images.length) % galleryRoom.images.length)} className="absolute left-3 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-xl text-slate-700 shadow-md">‹</button><button type="button" onClick={() => setGalleryIndex((galleryIndex + 1) % galleryRoom.images.length)} className="absolute right-3 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-xl text-slate-700 shadow-md">›</button></div><div className="mt-3 grid grid-cols-4 gap-2">{galleryRoom.images.map((image, index) => <button type="button" key={image} onClick={() => setGalleryIndex(index)} className={`overflow-hidden rounded-lg border-2 ${galleryIndex === index ? "border-blue-600" : "border-transparent"}`}><img src={image} alt={`Ảnh thu nhỏ ${index + 1}`} className="h-16 w-full object-cover" /></button>)}</div></div></div>}
    {assignmentRoom && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/30 p-4" onMouseDown={() => setAssignmentRoom(null)}><div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}><div className="flex items-start justify-between"><div><p className="text-xs font-semibold uppercase tracking-wider text-amber-600">{t("frontDesk.cleaningAssignment")}</p><h3 className="mt-1 text-lg font-bold text-slate-900">{t("room.roomLabel")} {assignmentRoom.id} · {assignmentRoom.name}</h3><p className="mt-1 text-sm text-slate-500">{t("frontDesk.cleaningDescription")}</p></div><button type="button" onClick={() => setAssignmentRoom(null)} className="text-2xl leading-none text-slate-400 hover:text-slate-700">×</button></div><div className="mt-5 space-y-2">{employees.map((employee) => <button type="button" key={employee} onClick={() => { updateRoom(assignmentRoom.id, { cleaner: employee, status: "Đang dọn" }); setAssignmentRoom(null); }} className="flex w-full items-center gap-3 rounded-xl border border-slate-200 p-3 text-left transition hover:border-amber-300 hover:bg-amber-50"><span className="grid h-9 w-9 place-items-center rounded-full bg-amber-100 text-xs font-bold text-amber-700">{employee.split(" ").map((part) => part[0]).slice(-2).join("")}</span><span><span className="block text-sm font-semibold text-slate-800">{employee}</span><span className="mt-0.5 block text-xs text-slate-500">Housekeeping · {t("room.housekeepingReady")}</span></span></button>)}</div><button type="button" onClick={() => setAssignmentRoom(null)} className="mt-5 w-full rounded-lg border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">{t("common.cancel")}</button></div></div>}
  </section>;
}
