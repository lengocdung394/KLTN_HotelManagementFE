import { useEffect, useMemo, useState } from "react";
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
import { Label } from "@radix-ui/react-label";
import { useCreateRoomMutation, useGetAllBedTypesQuery, useGetRoomStatusesQuery, useGetRoomTypeDetailQuery, useGetRoomTypesQuery, useGetRoomsByCurrentHotelQuery, useUpdateRoomMutation } from "../services/roomApi";
import { useGetAllAmenitiesQuery, type AmenityResponse } from "../services/amenityApi.ts";
import { useGetBuildingsByCurrentHotelQuery } from "../services/buildingApi";
import { useGetFloorsByBuildingIdQuery, useGetFloorsByHotelIdQuery } from "../services/floorApi";
import { useGetBranchRoomPoliciesQuery, useUpdateBranchRoomPolicyMutation } from "../services/branchRoomPolicyApi";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { baseApi } from "../services/baseApi";
import { bindHotelSocketEvents } from "../lib/socket";

type ImportedRoomRow = Record<string, string>;

const normalizeImportedValue = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "").trim();
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
const employees = ["Nguyễn Thị Mai", "Lê Thị Hương", "Phạm Ngọc Anh", "Trần Minh Tú"];
const statuses = ["Sẵn sàng", "Đang dọn", "Đang ở", "Bảo trì"];
const statusStyle: Record<string, string> = { "Sẵn sàng": "bg-emerald-50 text-emerald-700", "Đang dọn": "bg-amber-50 text-amber-700", "Đang ở": "bg-blue-50 text-blue-700", "Bảo trì": "bg-rose-50 text-rose-700" };
const roomTypeLabels: Record<string, string> = { STANDARD: "Standard Room", DELUXE: "Deluxe Room", SUITE: "Suite Room", FAMILY: "Family Room" };
const roomTypeValues: Record<string, string> = Object.fromEntries(Object.entries(roomTypeLabels).map(([value, label]) => [label, value]));
const statusLabels: Record<string, string> = { READY: "Sẵn sàng", MAINTENANCE: "Bảo trì", IN_USE: "Đang ở", CLEANING: "Đang dọn" };
const statusValues: Record<string, string> = Object.fromEntries(Object.entries(statusLabels).map(([value, label]) => [label, value]));
const roomTypeLabel = (value: string) => roomTypeLabels[value] ?? value;
const statusLabel = (value: string) => statusLabels[value] ?? value;
const money = (value: number) => value.toLocaleString("vi-VN") + "đ";
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
const roomFormDefaults = (roomType: string) => {
  const details = roomTypeDetails[roomType] ?? roomTypeDetails["Standard Room"];
  return {
    area: details.area.replace(/[^\d.,]/g, ""),
    standardCapacity: String(details.capacity),
    maxExtraGuests: "",
    extraAdultFee: "",
    extraChildFee: "",
    bedType: details.beds,
  };
};

const emptyCreateRoomForm: CreateRoomFormState = {
  roomNumber: "",
  roomType: "Standard Room",
  building: "A",
  floor: "1",
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
  const hotelId = useAppSelector((state) => state.auth.hotelId);
  const { data: apiRoomTypes, isLoading: isRoomTypesLoading, isError: isRoomTypesError } = useGetRoomTypesQuery();
  const { data: apiBedTypes, isLoading: isBedTypesLoading, isError: isBedTypesError } = useGetAllBedTypesQuery();
  const { data: apiRoomStatuses, isLoading: isRoomStatusesLoading, isError: isRoomStatusesError } = useGetRoomStatusesQuery();
  const { data: apiAmenities, isLoading: isAmenitiesLoading, isError: isAmenitiesError } = useGetAllAmenitiesQuery();
  const [createRoom, { isLoading: isCreatingRoom }] = useCreateRoomMutation();
  const [updateRoomApi, { isLoading: isUpdatingRoom }] = useUpdateRoomMutation(); // Added updateRoomApi
  const [amenityOverrides, setAmenityOverrides] = useState<Record<number, AmenityResponse>>({});
  const amenityCatalog = useMemo(() => (apiAmenities ?? []).map((amenity) => amenityOverrides[amenity.id] ?? amenity), [apiAmenities, amenityOverrides]);
  const availableRoomTypes = useMemo(() => (apiRoomTypes ?? []).map((value) => roomTypeLabel(String(value))), [apiRoomTypes]);
  const availableRoomStatuses = useMemo(() => (apiRoomStatuses ?? []).map((value) => statusLabel(String(value))), [apiRoomStatuses]);
  const amenityOptions = useMemo(() => (apiAmenities ?? []).map((amenity) => amenity.name).filter(Boolean), [apiAmenities]);
  const bedTypeOptions = useMemo(() => (apiBedTypes ?? []).map((item) => String(item.bedTypeName ?? item.name ?? item.description ?? "")).filter(Boolean), [apiBedTypes]);
  const translateBed = (bed: string) => bed.startsWith("2 giường đơn") ? `${t("room.doubleSingleBeds")} (1m x 1.2m)` : bed.startsWith("1 giường đơn") ? `${t("room.singleBed")} (1m x 1.2m)` : bed.startsWith("1 giường King Size") ? `${t("room.kingBed")} (1.8m x 2m)` : bed;
  const requestedTab = new URLSearchParams(location.search).get("tab");
  const defaultRoomTab: "rooms" | "pricing" | "amenities" = requestedTab === "pricing" || requestedTab === "amenities" ? requestedTab : "rooms";
  const [activeTab, setActiveTab] = useState<"rooms" | "buildings" | "floors" | "pricing" | "amenities">(defaultRoomTab);
  const [pricingMode, setPricingMode] = useState<"branch" | "event">("branch");
  const [editingPricingType, setEditingPricingType] = useState<string | null>(null);
  const [pricingSaveError, setPricingSaveError] = useState<string | null>(null);
  const { data: branchRoomPolicies = [], isLoading: isBranchPoliciesLoading, isError: isBranchPoliciesError } = useGetBranchRoomPoliciesQuery();
  const [updateBranchRoomPolicy, { isLoading: isUpdatingPolicy }] = useUpdateBranchRoomPolicyMutation();
  useEffect(() => {
    if (!hotelId || Number.isNaN(Number(hotelId))) return;

    bindHotelSocketEvents({
      onRoomCreated: () => {
        dispatch(baseApi.util.invalidateTags(["Room", "Booking"]));
      },
      onRoomUpdated: () => {
        dispatch(baseApi.util.invalidateTags(["Room", "Booking"]));
      },
      onRoomPolicyUpdated: () => {
        dispatch(baseApi.util.invalidateTags(["Room", "Booking", "BranchRoomPolicy"]));
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
  const { data: apiBuildings } = useGetBuildingsByCurrentHotelQuery(undefined, { skip: !hotelId || Number.isNaN(Number(hotelId)) });
  const { currentData: apiFloorsByBuilding, isLoading: isFloorsLoading, isFetching: isFloorsFetching, isError: isFloorsError } = useGetFloorsByBuildingIdQuery(Number(selectedBuildingId), { skip: !selectedBuildingId || Number.isNaN(Number(selectedBuildingId)) });
  const [rooms, setRooms] = useState<Room[]>([]);
  const [query, setQuery] = useState("");
  const [building, setBuilding] = useState("Tất cả các tòa");
  const [floor, setFloor] = useState("Tất cả các tầng");
  const [roomType, setRoomType] = useState("Tất cả loại phòng");
  const [status, setStatus] = useState("Tất cả trạng thái");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
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
  const [detailRoom, setDetailRoom] = useState<Room | null>(null);
  const [createRoomForm, setCreateRoomForm] = useState<CreateRoomFormState>(emptyCreateRoomForm);
  const [roomImageFiles, setRoomImageFiles] = useState<File[]>([]);
  const [amenitySearch, setAmenitySearch] = useState("");
  const [newAmenityName, setNewAmenityName] = useState("");
  const [amenityPrice, setAmenityPrice] = useState("");
  const [customAmenityPrices, setCustomAmenityPrices] = useState<Record<string, number>>({});
  const [showAmenityMenu, setShowAmenityMenu] = useState(false);
  const [buildingForm, setBuildingForm] = useState(emptyBuildingForm);
  const [showCreateFloor, setShowCreateFloor] = useState(false);
  const [editingFloor, setEditingFloor] = useState<string | null>(null);
  const [floorForm, setFloorForm] = useState(emptyFloorForm);
  const selectedRoomTypeValue = roomTypeValues[createRoomForm.roomType] ?? createRoomForm.roomType;
  const { currentData: roomTypeDetail, isLoading: isRoomTypeDetailLoading, isError: isRoomTypeDetailError } = useGetRoomTypeDetailQuery(
    { hotelId: Number(hotelId), roomType: selectedRoomTypeValue },
    { skip: !hotelId || !createRoomForm.roomType },
  );
  const getApiValue = (item: Record<string, unknown>, keys: string[]) => keys.map((key) => item[key]).find((value) => value !== undefined && value !== null && value !== "");
  const { data: apiFloorsByHotel = [] } = useGetFloorsByHotelIdQuery(undefined, { skip: !hotelId || Number.isNaN(Number(hotelId)) });
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
    const floorNumber = getApiValue(item, ["floorNumber", "floorLevel", "number"]);
    const name = getApiValue(item, ["name", "floorName"]);
    const displayName = String(floorNumber ?? name ?? "");
    const buildingValue = getApiValue(item, ["building"]);
    const buildingRecord = buildingValue && typeof buildingValue === "object" ? buildingValue as Record<string, unknown> : {};
    const buildingId = getApiValue(item, ["buildingId", "buildingID"]) ?? getApiValue(buildingRecord, ["id", "buildingId", "buildingID"]);
    return {
      id: String(id ?? ""),
      name: displayName,
      buildingId: String(buildingId ?? ""),
    };
  }).filter((item) => item.id && item.name), [apiFloorsByHotel]);
  const hotelFloorNames = useMemo(() => [...new Set(hotelFloorOptions.map((item) => item.name))], [hotelFloorOptions]);
  const hotelFloorsForSelectedBuilding = useMemo(
    () => hotelFloorOptions.filter((item) => !selectedBuildingId || !item.buildingId || item.buildingId === selectedBuildingId),
    [hotelFloorOptions, selectedBuildingId],
  );
  const selectedBuildingFloorOptions = apiFloorsByBuilding !== undefined ? apiFloorOptions : hotelFloorsForSelectedBuilding;
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
      const bedNames = bedItems.map((bed) => {
        const bedRecord = bed as Record<string, unknown>;
        const name = String(bedRecord.bedTypeName ?? bedRecord.name ?? "").trim();
        const quantity = Number(bedRecord.quantity ?? 1);
        return name ? `${quantity > 1 ? `${quantity} ` : ""}${name}` : "";
      }).filter(Boolean);
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
        size: String(getApiValue(item, ["roomSize", "size", "area", "roomArea", "acreage"]) ?? "Chưa cập nhật"),
        beds: bedNames.join(" · ") || String(getApiValue(item, ["bedType", "bedTypeName"]) ?? details.beds),
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

    setRooms((current) => nextRooms.map((room) => {
      const previous = current.find((item) => item.id === room.id);
      return previous ? { ...room, status: previous.status, cleaner: previous.cleaner } : room;
    }));
  }, [apiRooms, apiAmenities, hotelFloorOptions]);
  useEffect(() => {
    if (!apiBuildings) return;
    const nextBuildings = apiBuildings.map((item) => {
      const id = getApiValue(item, ["id", "buildingId", "buildingID"]);
      const name = getApiValue(item, ["name", "buildingName", "buildingCode", "code"]);
      return { id: String(id ?? ""), name: String(name ?? id ?? "Tòa nhà") };
    }).filter((item) => item.id);

    setBuildings((current) => (current.length === nextBuildings.length && current.every((building, index) => building.id === nextBuildings[index]?.id && building.name === nextBuildings[index]?.name) ? current : nextBuildings));
    setSelectedBuildingId((current) => {
      const nextSelected = nextBuildings.some((item) => item.id === current) ? current : (nextBuildings[0]?.id ?? "");
      return nextSelected === current ? current : nextSelected;
    });
    setCreateRoomForm((current) => {
      const nextBuilding = nextBuildings.some((item) => item.id === current.building) ? current.building : (nextBuildings[0]?.id ?? current.building);
      return nextBuilding === current.building ? current : { ...current, building: nextBuilding };
    });
  }, [apiBuildings]);
  useEffect(() => {
    const nextFloors = selectedBuildingFloorOptions.map((item) => item.name);

    setFloors((current) => (current.length === nextFloors.length && current.every((floorName, index) => floorName === nextFloors[index]) ? current : nextFloors));
    setCreateRoomForm((current) => {
      const nextFloor = selectedBuildingFloorOptions.some((item) => item.id === current.floor) ? current.floor : (selectedBuildingFloorOptions[0]?.id ?? current.floor);
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
    if (!roomTypeDetail || editingRoomId !== null) return;

    const getDetailValue = (keys: string[]) => keys.map((key) => roomTypeDetail[key]).find((value) => value !== undefined && value !== null && value !== "");
    const rawBeds = getDetailValue(["beds", "bedTypes", "roomBeds"]);
    const bedItems = Array.isArray(rawBeds) ? rawBeds : rawBeds && typeof rawBeds === "object" ? [rawBeds] : [];
    const bedNames = bedItems.map((bed) => {
      const bedRecord = bed as Record<string, unknown>;
      const name = String(bedRecord.bedTypeName ?? bedRecord.name ?? bedRecord.description ?? "").trim();
      const quantity = Number(bedRecord.quantity ?? 1);
      return name ? `${quantity > 1 ? `${quantity} ` : ""}${name}` : "";
    }).filter(Boolean);
    const standardCapacity = getDetailValue(["standardCapacity", "standardAdults", "capacity", "maxAdults", "adults", "adultCapacity", "numberOfAdults"]);
    const roomTypePolicy = branchRoomPolicies.find((policy) => {
      const policyRoomType = getApiValue(policy, ["roomType", "roomTypeName", "type", "name"]);
      return roomTypeLabel(String(policyRoomType ?? "")) === createRoomForm.roomType;
    });
    const maxExtraGuests = getDetailValue(["maxExtraGuests", "maxExtraGuest", "extraGuestCapacity"])
      ?? getApiValue(roomTypePolicy ?? {}, ["maxExtraGuests", "max_extra_guests", "extraGuestCapacity"]);
    const extraAdultFee = getDetailValue(["extraAdultFee"]);
    const extraChildFee = getDetailValue(["extraChildFee"]);

    setCreateRoomForm((current) => {
      const nextStandardCapacity = standardCapacity !== undefined ? String(standardCapacity) : current.standardCapacity;
      const nextMaxExtraGuests = maxExtraGuests !== undefined ? String(maxExtraGuests) : current.maxExtraGuests;
      const nextExtraAdultFee = extraAdultFee !== undefined ? String(extraAdultFee) : current.extraAdultFee;
      const nextExtraChildFee = extraChildFee !== undefined ? String(extraChildFee) : current.extraChildFee;
      const nextBedType = bedNames.length > 0 ? bedNames.join(" · ") : current.bedType;

      if (current.standardCapacity === nextStandardCapacity && current.maxExtraGuests === nextMaxExtraGuests && current.extraAdultFee === nextExtraAdultFee && current.extraChildFee === nextExtraChildFee && current.bedType === nextBedType) {
        return current;
      }

      return { ...current, standardCapacity: nextStandardCapacity, maxExtraGuests: nextMaxExtraGuests, extraAdultFee: nextExtraAdultFee, extraChildFee: nextExtraChildFee, bedType: nextBedType };
    });
  }, [roomTypeDetail, branchRoomPolicies, createRoomForm.roomType, editingRoomId]);
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
    setCreateRoomForm({ roomNumber: /^\d+$/.test(room.id) ? room.id : "", roomType: room.name, building: buildingId, floor: floorId, area, standardCapacity: String(room.standardCapacity || room.capacity), maxExtraGuests: String(room.maxExtraGuests), extraAdultFee: String(room.extraAdultFee || ""), extraChildFee: String(room.extraChildFee || ""), bedType: room.beds || roomTypeDetails[room.name]?.beds || "1 giường đơn (1m x 1,2m)", description: room.description ?? "", amenities: room.services, images: room.images, defaultImage: room.images[0] ?? null, status: room.status || "Sẵn sàng" }); // Updated to use buildingId and floorId
    setShowCreateRoom(true);
  };
  const openCreateBuildingModal = () => {
    setEditingBuildingId(null);
    setBuildingForm({ name: "", code: createBuildingCode(buildings) });
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
  const saveBuilding = () => {
    const name = buildingForm.name.trim();
    if (!name) return;
    const nextBuildings = editingBuildingId
      ? buildings.map((building) => building.id === editingBuildingId ? { ...building, name } : building)
      : [{ id: buildingForm.code, name }, ...buildings];
    setBuildings(nextBuildings);
    window.localStorage.setItem("staywise-buildings", JSON.stringify(nextBuildings));
    closeCreateBuildingModal();
  };
  const openCreateFloorModal = () => {
    setEditingFloor(null);
    setFloorForm(emptyFloorForm);
    setShowCreateFloor(true);
  };
  const openEditFloorModal = (floor: string) => {
    setEditingFloor(floor);
    setFloorForm({ name: floor });
    setShowCreateFloor(true);
  };
  const closeCreateFloorModal = () => {
    setShowCreateFloor(false);
    setEditingFloor(null);
    setFloorForm(emptyFloorForm);
  };
  const saveFloor = () => {
    const name = floorForm.name.trim();
    if (!name || (!editingFloor && floors.includes(name))) return;
    const nextFloors = editingFloor ? floors.map((floor) => floor === editingFloor ? name : floor) : [...floors, name];
    setFloors(nextFloors);
    setRooms((current) => editingFloor ? current.map((room) => room.floor === editingFloor ? { ...room, floor: name } : room) : current);
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
    const bedType = createRoomForm.bedType || roomDetails.beds;
    const showRoomSaveError = (title: string, description: string) => toast({
      variant: "destructive",
      title,
      description,
    });

    if (!roomCode || !roomType || !area || !price || !standardCapacity || maxExtraGuests < 0 || extraAdultFee < 0 || extraChildFee < 0) {
      showRoomSaveError(isEditingRoom ? "Không thể cập nhật phòng" : "Không thể thêm phòng", "Vui lòng nhập đầy đủ các trường bắt buộc.");
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
            roomInfo: { roomNumber: roomCode, floorId, roomStatus: statusValues[createRoomForm.status] ?? createRoomForm.status, roomType: roomTypeValues[roomType] ?? roomType, defaultImageIndex: Math.max(defaultImageIndex, 0), amenityIds },
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
  const importRoomsFromFile = async (file: File | null) => {
    if (!file) return;
    setImportingRooms(true);
    try {
      const rows = file.name.toLowerCase().endsWith(".csv")
        ? parseCsv(await file.text())
        : await parseXlsx(await file.arrayBuffer());
      const getValue = (row: ImportedRoomRow, names: string[]) => names.map(normalizeImportedValue).map((name) => row[name]).find((value) => value?.trim())?.trim() ?? "";
      const nextRooms = [...rooms];
      let importedCount = 0;
      rows.forEach((row) => {
        const building = getValue(row, ["tòa", "toa", "building"]).toUpperCase() || "A";
        const floorNumber = getValue(row, ["tầng", "tang", "floor"]).replace(/[^1-4]/g, "") || "1";
        const prefix = `${building}-${floorNumber}-`;
        const usedSequences = nextRooms.filter((room) => room.id.startsWith(prefix)).map((room) => Number(room.id.slice(prefix.length))).filter(Number.isInteger);
        let sequence = 1;
        while (usedSequences.includes(sequence)) sequence += 1;
        const roomCode = getValue(row, ["mã phòng", "ma phong", "room code", "id"]) || `${prefix}${sequence}`;
        if (nextRooms.some((room) => room.id.toLowerCase() === roomCode.toLowerCase())) return;
        const roomType = getValue(row, ["loại phòng", "loai phong", "room type"]) || "Standard Room";
        const area = getValue(row, ["diện tích", "dien tich", "area"]) || "25 m²";
        const price = Number(getValue(row, ["giá", "gia", "giá tiền", "gia tien", "price"]).replace(/[^\d]/g, ""));
        const capacity = Number(getValue(row, ["sức chứa", "suc chua", "capacity"]).replace(/[^\d]/g, "")) || 1;
        const services = getValue(row, ["tiện nghi", "tien nghi", "amenities", "services"]).split(/[;,|]/).map((item) => item.trim()).filter(Boolean);
        if (!roomType || !price) return;
        nextRooms.unshift({
          id: roomCode,
          name: roomType,
          images: [],
          floor: floorNumber,
          size: area.toLowerCase().includes("m") ? area : `${area} m²`,
          beds: getValue(row, ["giường", "giuong", "beds"]) || "1 giường",
          capacity,
          standardCapacity: capacity,
          maxExtraGuests: 0,
          extraAdultFee: 0,
          extraChildFee: 0,
          guestPolicy: getValue(row, ["số người tối đa", "so nguoi toi da", "guest policy"]) || `Tối đa ${capacity} khách`,
          price,
          status: statuses.includes(getValue(row, ["trạng thái", "trang thai", "status"])) ? getValue(row, ["trạng thái", "trang thai", "status"]) : "Sẵn sàng",
          cleaner: "",
          services: services.length > 0 ? services : ["Wifi", "Điều hòa"],
        });
        importedCount += 1;
      });
      setRooms(nextRooms);
      window.alert(importedCount > 0 ? `Đã nhập ${importedCount} phòng.` : "Không có dòng phòng hợp lệ để nhập.");
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Không thể đọc file phòng.");
    } finally {
      setImportingRooms(false);
    }
  };

  return <section className="mt-6 rounded-2xl border border-slate-200/80 bg-white shadow-sm">
    {detailRoom && <RoomDetailModal room={detailRoom} onClose={() => setDetailRoom(null)} />}
    {activeTab !== "pricing" && <>
      {activeTab !== "amenities" && <div className="flex flex-col gap-4 border-b border-slate-100 p-5 lg:flex-row lg:items-center lg:justify-between">
        <div><h3 className="font-bold text-slate-900">{t("room.roomList")}</h3><p className="mt-1 text-sm text-slate-500">{filtered.length} {t("room.roomsAtBranch")} · {t("room.realTimeUpdate")}</p></div>
        <div className="flex flex-wrap gap-2">{activeTab === "buildings" ? <button type="button" onClick={openCreateBuildingModal} className="flex w-fit items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-200 hover:bg-blue-700"><span className="text-lg leading-none">+</span>{t("room.addBuilding")}</button> : activeTab === "floors" ? <button type="button" onClick={openCreateFloorModal} className="flex w-fit items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-200 hover:bg-blue-700"><span className="text-lg leading-none">+</span>{t("room.addFloor")}</button> : activeTab === "rooms" ? <button type="button" onClick={() => setShowCreateRoom(true)} className="flex w-fit items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-200 hover:bg-blue-700"><span className="text-lg leading-none">+</span>{t("room.addRoom")}</button> : null}</div>
      </div>}
      <div className="flex flex-wrap border-b border-slate-100 bg-slate-50/60 p-2">
        <button type="button" onClick={() => setActiveTab("rooms")} className={`min-w-36 flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${activeTab === "rooms" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:bg-white/70"}`}>{t("navigation.rooms")}</button>
        <button type="button" onClick={() => setActiveTab("buildings")} className={`min-w-36 flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${activeTab === "buildings" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:bg-white/70"}`}>{t("room.buildings")}</button>
        <button type="button" onClick={() => setActiveTab("floors")} className={`min-w-36 flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${activeTab === "floors" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:bg-white/70"}`}>{t("room.floors")}</button>
        <button type="button" onClick={() => setActiveTab("amenities")} className={`min-w-36 flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${activeTab === "amenities" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:bg-white/70"}`}>Danh sách tiện nghi</button>
      </div>
    </>}
    {activeTab === "buildings" && <BuildingManagementPanel buildings={buildings} query={buildingQuery} filteredBuildings={filteredBuildings} onQueryChange={setBuildingQuery} onEdit={openEditBuildingModal} />}
    {activeTab === "floors" && <>
      {isFloorsError && <p className="border-b border-rose-100 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-700">Không thể tải danh sách tầng của tòa nhà này.</p>}
      {(isFloorsLoading || isFloorsFetching) && <p className="border-b border-blue-100 bg-blue-50 px-4 py-3 text-xs font-medium text-blue-700">Đang tải danh sách tầng...</p>}
      <FloorManagementPanel floors={floors} rooms={rooms} buildings={buildings} selectedBuildingId={selectedBuildingId} onBuildingChange={setSelectedBuildingId} onEdit={openEditFloorModal} />
    </>}
    {activeTab === "amenities" && <RoomAmenitiesTab amenities={amenityCatalog} isLoading={isAmenitiesLoading} isError={isAmenitiesError} onSave={saveAmenityEdit} />}
    {activeTab === "rooms" && <RoomListTab
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
    {showCreateBuilding && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4" onMouseDown={closeCreateBuildingModal}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div><p className="text-xs font-bold uppercase tracking-wider text-blue-600">Quản lý cơ sở vật chất</p><h3 className="mt-2 text-xl font-bold text-slate-900">{editingBuildingId ? "Sửa tòa nhà" : "Tạo tòa nhà mới"}</h3><p className="mt-1 text-sm text-slate-500">{editingBuildingId ? "Cập nhật tên tòa nhà. Mã tòa được giữ nguyên." : "Nhập tên tòa nhà, mã sẽ được hệ thống tạo tự động."}</p></div>
          <button type="button" onClick={closeCreateBuildingModal} className="text-slate-400 hover:text-slate-700"><X size={19} /></button>
        </div>
        <div className="mt-5 space-y-4">
          <label className="block text-sm font-semibold text-slate-700">Tên tòa nhà <span className="text-rose-500">*</span><input autoFocus value={buildingForm.name} onChange={(event) => setBuildingForm((current) => ({ ...current, name: event.target.value }))} onKeyDown={(event) => { if (event.key === "Enter" && buildingForm.name.trim()) saveBuilding(); }} placeholder="Ví dụ: Tòa Sunrise" className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></label>
          <label className="block text-sm font-semibold text-slate-700">Mã tòa nhà<input value={buildingForm.code} readOnly className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-semibold tracking-wider text-slate-700 outline-none" /></label>
        </div>
        <div className="mt-6 flex justify-end gap-2"><button type="button" onClick={closeCreateBuildingModal} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">Hủy</button><button type="button" onClick={saveBuilding} disabled={!buildingForm.name.trim()} className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-200">{editingBuildingId ? "Lưu thay đổi" : "Tạo tòa nhà"}</button></div>
      </div>
    </div>}
    {showCreateFloor && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4" onMouseDown={closeCreateFloorModal}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div><p className="text-xs font-bold uppercase tracking-wider text-blue-600">{t("room.floorManagement")}</p><h3 className="mt-2 text-xl font-bold text-slate-900">{editingFloor ? t("room.editFloor") : t("room.createFloor")}</h3><p className="mt-1 text-sm text-slate-500">{editingFloor ? t("room.editFloorDescription") : t("room.createFloorDescription")}</p></div>
          <button type="button" onClick={closeCreateFloorModal} className="text-slate-400 hover:text-slate-700"><X size={19} /></button>
        </div>
        <label className="mt-5 block text-sm font-semibold text-slate-700">{t("room.floorName")} <span className="text-rose-500">*</span><input autoFocus value={floorForm.name} onChange={(event) => setFloorForm({ name: event.target.value })} onKeyDown={(event) => { if (event.key === "Enter") saveFloor(); }} placeholder={t("room.floorNamePlaceholder")} className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></label>
        <div className="mt-6 flex justify-end gap-2"><button type="button" onClick={closeCreateFloorModal} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">{t("common.cancel")}</button><button type="button" onClick={saveFloor} disabled={!floorForm.name.trim()} className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-200">{t("common.save")}</button></div>
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
                  <label className="block text-sm font-semibold text-slate-700">
                    Loại giường <span className="text-rose-500">*</span>
                    {isBedTypesLoading && <span className="ml-2 text-xs font-normal text-blue-600">Đang tải...</span>}
                    {isBedTypesError && <p className="mt-1 text-xs font-normal text-rose-600">Không tải được danh sách loại giường.</p>}
                    <select
                      value={createRoomForm.bedType}
                      onChange={(event) => setCreateRoomForm((current) => ({ ...current, bedType: event.target.value }))}
                      className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    >
                      {[createRoomForm.bedType, ...bedTypeOptions].filter((bedType, index, options) => bedType && options.indexOf(bedType) === index).map((bedType) => (
                        <option key={bedType} value={bedType}>{bedType}</option>
                      ))}
                    </select>
                  </label>
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
                    <strong className="font-semibold text-slate-800">{createRoomForm.building}</strong>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                    <span>Tầng</span>
                    <strong className="font-semibold text-slate-800">{createRoomForm.floor}</strong>
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
