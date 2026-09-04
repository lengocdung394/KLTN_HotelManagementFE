import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { BedDouble, Check, ImagePlus, MoreHorizontal, Pencil, Search, SlidersHorizontal, Sparkles, Star, Upload, Users, X } from "lucide-react";
import BuildingManagementPanel from "../components/BuildingManagementPanel";
import FloorManagementPanel from "../components/FloorManagementPanel";
import { Label } from "@radix-ui/react-label";

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

const roomImages = [
  "https://images.pexels.com/photos/6876834/pexels-photo-6876834.jpeg",
  "https://images.pexels.com/photos/20666872/pexels-photo-20666872.jpeg",
  "https://images.pexels.com/photos/5774037/pexels-photo-5774037.jpeg",
  "https://images.pexels.com/photos/6394574/pexels-photo-6394574.jpeg",
];
const legacyRooms = [
  { id: "A-1-1", name: "Standard Room", images: roomImages, floor: "Tầng 1", size: "25 m²", beds: "1 giường đơn (1m x 1,2m)", capacity: 1, guestPolicy: "1 người lớn + 1 trẻ nhỏ + 1 em bé", price: 1000000, status: "Sẵn sàng", cleaner: "", services: ["Điều hòa", "TV", "Phòng tắm riêng", "Wifi"] },
  { id: "A-1-2", name: "Standard Room", images: roomImages, floor: "Tầng 1", size: "25 m²", beds: "1 giường đơn (1m x 1,2m)", capacity: 1, guestPolicy: "1 người lớn + 1 trẻ nhỏ + 1 em bé", price: 1000000, status: "Đang dọn", cleaner: "Nguyễn Thị Mai", services: ["Điều hòa", "TV", "Minibar", "Baby Cot"] },
  { id: "A-1-3", name: "Standard Room", images: roomImages, floor: "Tầng 1", size: "25 m²", beds: "1 giường đơn (1m x 1,2m)", capacity: 1, guestPolicy: "1 người lớn + 1 trẻ nhỏ + 1 em bé", price: 1000000, status: "Sẵn sàng", cleaner: "", services: ["Điều hòa", "TV", "Phòng tắm riêng", "Ấm đun nước"] },
  { id: "A-1-4", name: "Standard Room", images: roomImages, floor: "Tầng 1", size: "25 m²", beds: "1 giường đơn (1m x 1,2m)", capacity: 1, guestPolicy: "1 người lớn + 1 trẻ nhỏ + 1 em bé", price: 1000000, status: "Sẵn sàng", cleaner: "", services: ["Điều hòa", "TV", "Phòng tắm riêng", "Wifi"] },
  { id: "A-1-5", name: "Standard Room", images: roomImages, floor: "Tầng 1", size: "25 m²", beds: "1 giường đơn (1m x 1,2m)", capacity: 1, guestPolicy: "1 người lớn + 1 trẻ nhỏ + 1 em bé", price: 1000000, status: "Bảo trì", cleaner: "", services: ["Điều hòa", "TV", "Ấm đun nước", "Baby Cot"] },
  { id: "A-2-1", name: "Superior Room", images: [roomImages[1], roomImages[0], roomImages[2], roomImages[3]], floor: "Tầng 2", size: "30 m²", beds: "2 giường đơn (1m x 1,2m)", capacity: 2, guestPolicy: "2 người lớn + 2 trẻ nhỏ + 1 em bé", price: 1500000, status: "Sẵn sàng", cleaner: "", services: ["Điều hòa", "TV", "Bồn tắm", "Wifi"] },
  { id: "A-2-2", name: "Superior Room", images: [roomImages[1], roomImages[0], roomImages[2], roomImages[3]], floor: "Tầng 2", size: "30 m²", beds: "2 giường đơn (1m x 1,2m)", capacity: 2, guestPolicy: "2 người lớn + 2 trẻ nhỏ + 1 em bé", price: 1500000, status: "Đang ở", cleaner: "", services: ["Điều hòa", "TV", "Minibar", "Baby Cot"] },
  { id: "A-2-3", name: "Superior Room", images: [roomImages[1], roomImages[0], roomImages[2], roomImages[3]], floor: "Tầng 2", size: "30 m²", beds: "2 giường đơn (1m x 1,2m)", capacity: 2, guestPolicy: "2 người lớn + 2 trẻ nhỏ + 1 em bé", price: 1500000, status: "Sẵn sàng", cleaner: "", services: ["Điều hòa", "TV", "Bàn làm việc", "Wifi"] },
  { id: "A-2-4", name: "Superior Room", images: [roomImages[1], roomImages[0], roomImages[2], roomImages[3]], floor: "Tầng 2", size: "30 m²", beds: "2 giường đơn (1m x 1,2m)", capacity: 2, guestPolicy: "2 người lớn + 2 trẻ nhỏ + 1 em bé", price: 1500000, status: "Sẵn sàng", cleaner: "", services: ["Điều hòa", "TV", "Bồn tắm", "Wifi"] },
  { id: "A-2-5", name: "Superior Room", images: [roomImages[1], roomImages[0], roomImages[2], roomImages[3]], floor: "Tầng 2", size: "30 m²", beds: "2 giường đơn (1m x 1,2m)", capacity: 2, guestPolicy: "2 người lớn + 2 trẻ nhỏ + 1 em bé", price: 1500000, status: "Đang dọn", cleaner: "", services: ["Điều hòa", "TV", "Minibar", "Baby Cot"] },
  { id: "B-3-1", name: "Deluxe Room", images: [roomImages[2], roomImages[3], roomImages[0], roomImages[1]], floor: "Tầng 3", size: "45 m²", beds: "1 giường King Size (1,8m x 2m)", capacity: 2, guestPolicy: "2 người lớn + 1 trẻ nhỏ + 1 em bé", price: 2000000, status: "Sẵn sàng", cleaner: "", services: ["Điều hòa", "TV màn hình lớn", "Minibar", "Vòi sen massage"] },
  { id: "B-3-2", name: "Deluxe Room", images: [roomImages[2], roomImages[3], roomImages[0], roomImages[1]], floor: "Tầng 3", size: "45 m²", beds: "1 giường King Size (1,8m x 2m)", capacity: 2, guestPolicy: "2 người lớn + 1 trẻ nhỏ + 1 em bé", price: 2000000, status: "Đang dọn", cleaner: "Lê Thị Hương", services: ["Điều hòa", "Khu vực tiếp khách", "Bồn tắm", "Wifi"] },
  { id: "B-3-3", name: "Deluxe Room", images: [roomImages[2], roomImages[3], roomImages[0], roomImages[1]], floor: "Tầng 3", size: "45 m²", beds: "1 giường King Size (1,8m x 2m)", capacity: 2, guestPolicy: "2 người lớn + 1 trẻ nhỏ + 1 em bé", price: 2000000, status: "Sẵn sàng", cleaner: "", services: ["Điều hòa", "TV màn hình lớn", "Minibar", "Phòng tắm cao cấp"] },
  { id: "B-3-4", name: "Deluxe Room", images: [roomImages[2], roomImages[3], roomImages[0], roomImages[1]], floor: "Tầng 3", size: "45 m²", beds: "1 giường King Size (1,8m x 2m)", capacity: 2, guestPolicy: "2 người lớn + 1 trẻ nhỏ + 1 em bé", price: 2000000, status: "Sẵn sàng", cleaner: "", services: ["Điều hòa", "TV màn hình lớn", "Minibar", "Vòi sen massage"] },
  { id: "B-3-5", name: "Deluxe Room", images: [roomImages[2], roomImages[3], roomImages[0], roomImages[1]], floor: "Tầng 3", size: "45 m²", beds: "1 giường King Size (1,8m x 2m)", capacity: 2, guestPolicy: "2 người lớn + 1 trẻ nhỏ + 1 em bé", price: 2000000, status: "Bảo trì", cleaner: "", services: ["Điều hòa", "Khu vực tiếp khách", "Bồn tắm", "Wifi"] },
  { id: "C-4-1", name: "Suite Room", images: [roomImages[3], roomImages[2], roomImages[1], roomImages[0]], floor: "Tầng 4", size: "60 m²", beds: "1 giường King Size + 1 giường đơn", capacity: 3, guestPolicy: "3 người lớn + 1 trẻ nhỏ + 1 em bé", price: 2500000, status: "Sẵn sàng", cleaner: "", services: ["Phòng khách riêng", "Khu vực làm việc", "Bồn tắm", "Baby Cot"] },
  { id: "C-4-2", name: "Suite Room", images: [roomImages[3], roomImages[2], roomImages[1], roomImages[0]], floor: "Tầng 4", size: "60 m²", beds: "1 giường King Size + 1 giường đơn", capacity: 3, guestPolicy: "3 người lớn + 1 trẻ nhỏ + 1 em bé", price: 2500000, status: "Đang ở", cleaner: "", services: ["Phòng khách riêng", "Ban công riêng", "Bồn tắm", "Wifi"] },
  { id: "C-4-3", name: "Suite Room", images: [roomImages[3], roomImages[2], roomImages[1], roomImages[0]], floor: "Tầng 4", size: "60 m²", beds: "1 giường King Size + 1 giường đơn", capacity: 3, guestPolicy: "3 người lớn + 1 trẻ nhỏ + 1 em bé", price: 2500000, status: "Sẵn sàng", cleaner: "", services: ["Phòng khách riêng", "Khu vực làm việc", "Minibar", "Baby Cot"] },
  { id: "C-4-4", name: "Suite Room", images: [roomImages[3], roomImages[2], roomImages[1], roomImages[0]], floor: "Tầng 4", size: "60 m²", beds: "1 giường King Size + 1 giường đơn", capacity: 3, guestPolicy: "3 người lớn + 1 trẻ nhỏ + 1 em bé", price: 2500000, status: "Sẵn sàng", cleaner: "", services: ["Phòng khách riêng", "Khu vực làm việc", "Bồn tắm", "Baby Cot"] },
  { id: "C-4-5", name: "Suite Room", images: [roomImages[3], roomImages[2], roomImages[1], roomImages[0]], floor: "Tầng 4", size: "60 m²", beds: "1 giường King Size + 1 giường đơn", capacity: 3, guestPolicy: "3 người lớn + 1 trẻ nhỏ + 1 em bé", price: 2500000, status: "Đang ở", cleaner: "", services: ["Phòng khách riêng", "Ban công riêng", "Minibar", "Wifi"] },
];

type RoomDefinition = { name: string; size: string; beds: string; capacity: number; price: number; services: string[] };
const roomDefinitions: Record<1 | 2 | 3 | 4, RoomDefinition> = {
  1: { name: "Standard Room", size: "25 m²", beds: "1 giường đơn (1m x 1,2m)", capacity: 1, price: 1000000, services: ["Điều hòa", "TV", "Phòng tắm riêng", "Wifi"] },
  2: { name: "Superior Room", size: "30 m²", beds: "2 giường đơn (1m x 1,2m)", capacity: 2, price: 1500000, services: ["Điều hòa", "TV", "Bồn tắm", "Wifi"] },
  3: { name: "Deluxe Room", size: "45 m²", beds: "1 giường King Size (1,8m x 2m)", capacity: 2, price: 2000000, services: ["Điều hòa", "TV màn hình lớn", "Minibar", "Vòi sen massage"] },
  4: { name: "Suite Room", size: "60 m²", beds: "1 giường King Size + 1 giường đơn", capacity: 3, price: 2500000, services: ["Phòng khách riêng", "Khu vực làm việc", "Bồn tắm", "Baby Cot"] },
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
type RoomRecord = {
  id: string;
  name: string;
  images: string[];
  floor: string;
  size: string;
  beds: string;
  capacity: number;
  guestPolicy: string;
  price: number;
  status: string;
  cleaner: string;
  services: string[];
};
const initialRooms: RoomRecord[] = buildingCodes.flatMap((building, buildingIndex) => [1, 2, 3, 4].flatMap((floor) => Array.from({ length: 5 }, (_, index) => {
  const details = roomDefinitions[floor as keyof typeof roomDefinitions];
  const roomNumber = index + 1;
  return {
    id: `${building}-${floor}-${roomNumber}`,
    name: details.name,
    images: roomImages.map((_, imageIndex) => roomImages[(imageIndex + floor + buildingIndex) % roomImages.length]),
    floor: `Tầng ${floor}`,
    size: details.size,
    beds: details.beds,
    capacity: details.capacity,
    guestPolicy: `${details.capacity} người lớn + ${floor === 1 ? 1 : floor === 2 ? 2 : 1} trẻ nhỏ + 1 em bé`,
    price: details.price,
    status: building === "A" && floor === 1 && roomNumber === 2 ? "Đang dọn" : building === "B" && floor === 3 && roomNumber === 2 ? "Đang ở" : "Sẵn sàng",
    cleaner: building === "A" && floor === 1 && roomNumber === 2 ? "Nguyễn Thị Mai" : "",
    services: details.services,
  };
})));

const employees = ["Nguyễn Thị Mai", "Lê Thị Hương", "Phạm Ngọc Anh", "Trần Minh Tú"];
const statuses = ["Sẵn sàng", "Đang dọn", "Đang ở", "Bảo trì"];
const initialFloors = ["Tầng 1", "Tầng 2", "Tầng 3", "Tầng 4"];
const statusStyle: Record<string, string> = { "Sẵn sàng": "bg-emerald-50 text-emerald-700", "Đang dọn": "bg-amber-50 text-amber-700", "Đang ở": "bg-blue-50 text-blue-700", "Bảo trì": "bg-rose-50 text-rose-700" };
const money = (value: number) => value.toLocaleString("vi-VN") + "đ";
type Room = RoomRecord & { description?: string };

type CreateRoomFormState = {
  roomType: string;
  building: string;
  floor: string;
  area: string;
  price: string;
  adults: string;
  children: string;
  infants: string;
  bedType: string;
  description: string;
  amenities: string[];
  images: string[];
  defaultImage: string | null;
  status: string;
};

const amenityOptions = [
  "Điều hòa",
  "Két an toàn",
  "Tủ lạnh nhỏ",
  "Truyền hình cáp/Vệ tinh",
  "Khăn tắm",
  "Phòng tắm - vòi sen",
  "Truy cập Internet qua WiFi",
  "Không có cửa sổ",
  "Đèn bàn",
  "Dụng cụ pha cafe/trà",
  "Bàn là/ủi",
  "Phòng không hút thuốc",
  "Điện thoại",
  "Máy sấy tóc",
  "Ra trải giường, gối",
  "Cho phép vật nuôi",
  "Đồ phòng tắm",
];

const roomTypeOptions = ["Standard Room", "Superior Room", "Deluxe Room", "Suite Room"];
const roomTypeDetails: Record<string, { area: string; beds: string; capacity: number; guestPolicy: string; price: number; description: string }> = {
  "Standard Room": { area: "25 m²", beds: "1 giường đơn (1m x 1,2m)", capacity: 1, guestPolicy: "Người lớn: 1 · Trẻ nhỏ dưới 11 tuổi: 1 · Em bé dưới 12 tháng: 1", price: 1000000, description: "Phòng tiêu chuẩn có giường ngủ, bàn làm việc, TV, điều hòa và phòng tắm riêng. Có thể trang bị thêm minibar và ấm đun nước." },
  "Superior Room": { area: "30 m²", beds: "2 giường đơn (1m x 1,2m)", capacity: 2, guestPolicy: "Người lớn: 2 · Trẻ nhỏ dưới 11 tuổi: 2 · Em bé dưới 12 tháng: 1", price: 1500000, description: "Phòng cao cấp có không gian thoải mái, nội thất hiện đại, bàn làm việc rộng hơn, tầm nhìn đẹp và có thể có bồn tắm." },
  "Deluxe Room": { area: "45 m²", beds: "1 giường King Size (1,8m x 2m)", capacity: 2, guestPolicy: "Người lớn: 2 · Trẻ nhỏ dưới 11 tuổi: 1 · Em bé dưới 12 tháng: 1", price: 2000000, description: "Phòng hạng sang rộng rãi với giường King Size, TV màn hình lớn, minibar, khu vực tiếp khách và phòng tắm cao cấp." },
  "Suite Room": { area: "60 m²", beds: "1 giường King Size + 1 giường đơn", capacity: 3, guestPolicy: "Người lớn: 3 · Trẻ nhỏ dưới 11 tuổi: 1 · Em bé dưới 12 tháng: 1", price: 2500000, description: "Phòng Suite cao cấp gồm phòng khách riêng, phòng ngủ, khu vực làm việc và phòng tắm hiện đại; phù hợp cho gia đình, khách VIP hoặc doanh nhân." },
};
const bedTypeOptions = [
  "1 giường đơn (1m x 1,2m)",
  "2 giường đơn (1m x 1,2m)",
  "1 giường King Size (1,8m x 2m)",
  "1 giường King Size + 1 giường đơn",
];
initialRooms.forEach((room) => {
  const details = roomTypeDetails[room.name];
  if (details) Object.assign(room, { guestPolicy: details.guestPolicy, description: `Mô tả phòng:\n${details.description}\n\nQuy định sức chứa:\n• Người lớn: ${details.guestPolicy.match(/Người lớn:\s*(\d+)/)?.[1] ?? details.capacity}\n• Trẻ nhỏ dưới 11 tuổi: ${details.guestPolicy.match(/Trẻ nhỏ dưới 11 tuổi:\s*(\d+)/)?.[1] ?? 0}\n• Em bé dưới 12 tháng: ${details.guestPolicy.match(/Em bé dưới 12 tháng:\s*(\d+)/)?.[1] ?? 0}\n\nPhụ thu:\n• 500.000đ mỗi người vượt quy định\n• Miễn phí cho em bé` });
});
const normalizeText = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
const roomFormDefaults = (roomType: string) => {
  const details = roomTypeDetails[roomType] ?? roomTypeDetails["Standard Room"];
  return {
    area: details.area.replace(/[^\d.,]/g, ""),
    price: String(details.price),
    adults: String(details.capacity),
    children: details.guestPolicy.match(/Trẻ nhỏ dưới 11 tuổi:\s*(\d+)/)?.[1] ?? "0",
    infants: details.guestPolicy.match(/Em bé dưới 12 tháng:\s*(\d+)/)?.[1] ?? "0",
    bedType: details.beds,
  };
};

const emptyCreateRoomForm: CreateRoomFormState = {
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
  const translateBed = (bed: string) => bed.startsWith("2 giường đơn") ? `${t("room.doubleSingleBeds")} (1m x 1.2m)` : bed.startsWith("1 giường đơn") ? `${t("room.singleBed")} (1m x 1.2m)` : bed.startsWith("1 giường King Size") ? `${t("room.kingBed")} (1.8m x 2m)` : bed;
  const [activeTab, setActiveTab] = useState<"rooms" | "buildings" | "floors">("rooms");
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
  const [floors, setFloors] = useState<string[]>(() => {
    if (typeof window === "undefined") return initialFloors;
    const stored = window.localStorage.getItem("staywise-floors");
    if (!stored) return initialFloors;
    try {
      const saved = JSON.parse(stored) as string[];
      return saved.length > 0 ? saved : initialFloors;
    } catch {
      return initialFloors;
    }
  });
  const [rooms, setRooms] = useState<Room[]>(() => {
    if (typeof window === "undefined") return initialRooms;
    const stored = window.localStorage.getItem("staywise-cleaning-rooms");
    if (!stored) return initialRooms;
    const assignments = JSON.parse(stored) as Record<string, { status: string; cleaner: string }>;
    return initialRooms.map((room) => assignments[room.id] ? { ...room, ...assignments[room.id] } : room);
  });
  const [query, setQuery] = useState("");
  const [building, setBuilding] = useState("Tất cả các tòa");
  const [floor, setFloor] = useState("Tất cả các tầng");
  const [status, setStatus] = useState("Tất cả trạng thái");
  const [assignmentRoom, setAssignmentRoom] = useState<Room | null>(null);
  const [statusMenuRoom, setStatusMenuRoom] = useState<string | null>(null);
  const [galleryRoom, setGalleryRoom] = useState<Room | null>(null);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [showCreateBuilding, setShowCreateBuilding] = useState(false);
  const [editingBuildingId, setEditingBuildingId] = useState<string | null>(null);
  const [buildingQuery, setBuildingQuery] = useState("");
  const [importingRooms, setImportingRooms] = useState(false);
  const [detailRoom, setDetailRoom] = useState<Room | null>(null);
  const [createRoomForm, setCreateRoomForm] = useState<CreateRoomFormState>(emptyCreateRoomForm);
  const [amenitySearch, setAmenitySearch] = useState("");
  const [showAmenityMenu, setShowAmenityMenu] = useState(false);
  const [buildingForm, setBuildingForm] = useState(emptyBuildingForm);
  const [showCreateFloor, setShowCreateFloor] = useState(false);
  const [editingFloor, setEditingFloor] = useState<string | null>(null);
  const [floorForm, setFloorForm] = useState(emptyFloorForm);
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
  const generatedRoomCode = useMemo(() => {
    const prefix = `${createRoomForm.building}-${createRoomForm.floor}-`;
    const usedSequence = rooms
      .map((room) => room.id)
      .filter((id) => id.startsWith(prefix))
      .map((id) => Number(id.slice(prefix.length)))
      .filter((value) => Number.isInteger(value) && value > 0);

    let nextSequence = 1;
    while (usedSequence.includes(nextSequence)) nextSequence += 1;
    return `${prefix}${nextSequence}`;
  }, [rooms, createRoomForm.building, createRoomForm.floor]);
  const filtered = useMemo(() => rooms
    .filter((room) => `${room.id} ${room.name}`.toLowerCase().includes(query.toLowerCase()))
    .filter((room) => building === "Tất cả các tòa" || room.id.startsWith(`${building}-`))
    .filter((room) => floor === "Tất cả các tầng" || room.floor === floor)
    .filter((room) => status === "Tất cả trạng thái" || room.status === status), [rooms, query, building, floor, status]);
  const filteredAmenityOptions = useMemo(() => {
    const normalizedQuery = normalizeText(amenitySearch);

    return amenityOptions.filter((amenity) => {
      if (createRoomForm.amenities.includes(amenity)) return false;
      if (!normalizedQuery) return true;
      return normalizeText(amenity).includes(normalizedQuery);
    });
  }, [amenitySearch, createRoomForm.amenities]);
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
    setCreateRoomForm(emptyCreateRoomForm);
    setAmenitySearch("");
    setShowAmenityMenu(false);
  };
  const openEditRoomModal = (room: Room) => {
    const details = roomFormDefaults(room.name);
    const area = room.size.match(/[\d.,]+/)?.[0] ?? details.area;
    const adults = room.guestPolicy.match(/Người lớn:\s*(\d+)/)?.[1] ?? room.guestPolicy.match(/(\d+)\s*người lớn/)?.[1] ?? String(room.capacity);
    const children = room.guestPolicy.match(/Trẻ em:\s*(\d+)/)?.[1] ?? room.guestPolicy.match(/Trẻ nhỏ dưới 11 tuổi:\s*(\d+)/)?.[1] ?? "0";
    const infants = room.guestPolicy.match(/Trẻ nhỏ:\s*(\d+)/)?.[1] ?? room.guestPolicy.match(/Em bé(?: dưới 12 tháng)?:\s*(\d+)/)?.[1] ?? "0";
    setEditingRoomId(room.id);
    setCreateRoomForm({ roomType: room.name, building: room.id.split("-")[0], floor: room.id.split("-")[1] ?? "1", area, price: String(room.price), adults, children, infants, bedType: room.beds || roomTypeDetails[room.name]?.beds || "1 giường đơn (1m x 1,2m)", description: room.description ?? "", amenities: room.services, images: room.images, defaultImage: room.images[0] ?? null, status: room.status || "Sẵn sàng" });
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
    window.localStorage.setItem("staywise-floors", JSON.stringify(nextFloors));
    closeCreateFloorModal();
  };
  const appendAmenity = (value?: string) => {
    const nextAmenity = (value ?? amenitySearch).trim();
    if (!nextAmenity) return;
    const normalized = normalizeText(nextAmenity);
    const matchedAmenity = amenityOptions.find((item) => normalizeText(item) === normalized) ?? nextAmenity;

    if (createRoomForm.amenities.some((item) => normalizeText(item) === normalized)) {
      setAmenitySearch("");
      setShowAmenityMenu(false);
      return;
    }

    setCreateRoomForm((current) => ({ ...current, amenities: [...current.amenities, matchedAmenity] }));
    setAmenitySearch("");
    setShowAmenityMenu(false);
  };
  const removeAmenity = (value: string) => setCreateRoomForm((current) => ({ ...current, amenities: current.amenities.filter((item) => item !== value) }));
  const clearAllAmenities = () => setCreateRoomForm((current) => ({ ...current, amenities: [] }));
  const addImages = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const nextImages = Array.from(files).map((file) => URL.createObjectURL(file));
    setCreateRoomForm((current) => {
      const mergedImages = [...current.images, ...nextImages].slice(0, 8);
      const nextDefault = current.defaultImage ?? mergedImages[0] ?? null;
      return { ...current, images: mergedImages, defaultImage: nextDefault };
    });
  };
  const removeImage = (image: string) => setCreateRoomForm((current) => {
    const remaining = current.images.filter((item) => item !== image);
    const nextDefault = current.defaultImage === image ? (remaining[0] ?? null) : current.defaultImage;
    return { ...current, images: remaining, defaultImage: nextDefault };
  });
  const saveRoom = () => {
    const roomCode = editingRoomId ?? generatedRoomCode;
    const roomType = createRoomForm.roomType.trim();
    const roomDetails = roomTypeDetails[roomType] ?? roomTypeDetails["Standard Room"];
    const location = `Tòa ${createRoomForm.building} - Tầng ${createRoomForm.floor}`;
    const description = createRoomForm.description.trim();
    const area = Number(createRoomForm.area.replace(/,/g, "."));
    const price = Number(createRoomForm.price.replace(/[^\d]/g, ""));
    const adults = Number(createRoomForm.adults);
    const children = Number(createRoomForm.children);
    const infants = Number(createRoomForm.infants);
    const bedType = createRoomForm.bedType || roomDetails.beds;
    if (!roomType || !area || !price || !adults || children < 0 || infants < 0) {
      window.alert("Vui lòng nhập đầy đủ các trường bắt buộc.");
      return;
    }
    if (!editingRoomId && rooms.some((room) => room.id.toLowerCase() === roomCode.toLowerCase())) {
      window.alert("Mã phòng tự tạo bị trùng, vui lòng thử lại.");
      return;
    }
    const orderedImages = createRoomForm.defaultImage
      ? [createRoomForm.defaultImage, ...createRoomForm.images.filter((image) => image !== createRoomForm.defaultImage)]
      : createRoomForm.images;
    const room: Room = {
      id: roomCode,
      name: roomType,
      images: orderedImages.length > 0 ? orderedImages : ["https://images.pexels.com/photos/6876834/pexels-photo-6876834.jpeg"],
      floor: location,
      size: `${area} m²`,
      beds: bedType,
      capacity: adults + children,
      guestPolicy: `Người lớn: ${adults} · Trẻ em: ${children} · Trẻ nhỏ: ${infants}`,
      price,
      status: createRoomForm.status || "Sẵn sàng",
      cleaner: editingRoomId ? rooms.find((item) => item.id === editingRoomId)?.cleaner ?? "" : "",
      description,
      services: createRoomForm.amenities.length > 0 ? createRoomForm.amenities : ["Wifi tốc độ cao", ...(description ? [description] : [])],
    };
    setRooms((current) => editingRoomId ? current.map((item) => item.id === editingRoomId ? room : item) : [room, ...current]);
    closeCreateRoomModal();
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
          images: roomImages,
          floor: `Tầng ${floorNumber}`,
          size: area.toLowerCase().includes("m") ? area : `${area} m²`,
          beds: getValue(row, ["giường", "giuong", "beds"]) || "1 giường",
          capacity,
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
    <div className="flex flex-col gap-4 border-b border-slate-100 p-5 lg:flex-row lg:items-center lg:justify-between">
      <div><h3 className="font-bold text-slate-900">{t("room.roomList")}</h3><p className="mt-1 text-sm text-slate-500">{filtered.length} {t("room.roomsAtBranch")} · {t("room.realTimeUpdate")}</p></div>
      <div className="flex flex-wrap gap-2">{activeTab === "buildings" ? <button type="button" onClick={openCreateBuildingModal} className="flex w-fit items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-200 hover:bg-blue-700"><span className="text-lg leading-none">+</span>{t("room.addBuilding")}</button> : activeTab === "floors" ? <button type="button" onClick={openCreateFloorModal} className="flex w-fit items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-200 hover:bg-blue-700"><span className="text-lg leading-none">+</span>{t("room.addFloor")}</button> : activeTab === "rooms" ? <button type="button" onClick={() => setShowCreateRoom(true)} className="flex w-fit items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-200 hover:bg-blue-700"><span className="text-lg leading-none">+</span>{t("room.addRoom")}</button> : null}</div>
    </div>
    <div className="flex border-b border-slate-100 bg-slate-50/60 p-2"><button type="button" onClick={() => setActiveTab("rooms")} className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${activeTab === "rooms" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:bg-white/70"}`}>{t("navigation.rooms")}</button><button type="button" onClick={() => setActiveTab("buildings")} className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${activeTab === "buildings" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:bg-white/70"}`}>{t("room.buildings")}</button><button type="button" onClick={() => setActiveTab("floors")} className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${activeTab === "floors" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:bg-white/70"}`}>{t("room.floors")}</button></div>
    {activeTab === "buildings" && <BuildingManagementPanel buildings={buildings} query={buildingQuery} filteredBuildings={filteredBuildings} onQueryChange={setBuildingQuery} onEdit={openEditBuildingModal} />}
    {activeTab === "floors" && <FloorManagementPanel floors={floors} rooms={rooms} onEdit={openEditFloorModal} />}
    {activeTab === "rooms" && <>
    <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/60 p-4 sm:flex-row">
      <div className="relative flex-1"><Search size={16} className="absolute left-3 top-3 text-slate-400" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("room.searchRooms")} className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></div>
      <div className="relative"><SlidersHorizontal size={15} className="absolute left-3 top-3 text-slate-400" /><select value={building} onChange={(e) => setBuilding(e.target.value)} className="h-10 w-full appearance-none rounded-lg border border-slate-200 bg-white pl-9 pr-9 text-sm text-slate-600 outline-none focus:border-blue-400 sm:w-44"><option value="Tất cả các tòa">{t("room.allBuildings")}</option>{buildings.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
      <div className="relative"><SlidersHorizontal size={15} className="absolute left-3 top-3 text-slate-400" /><select value={floor} onChange={(e) => setFloor(e.target.value)} className="h-10 w-full appearance-none rounded-lg border border-slate-200 bg-white pl-9 pr-9 text-sm text-slate-600 outline-none focus:border-blue-400 sm:w-44"><option value="Tất cả các tầng">{t("room.allFloors")}</option>{floors.map((item) => <option key={item}>{item}</option>)}</select></div>
      <div className="relative"><SlidersHorizontal size={15} className="absolute left-3 top-3 text-slate-400" /><select value={status} onChange={(e) => setStatus(e.target.value)} className="h-10 w-full appearance-none rounded-lg border border-slate-200 bg-white pl-9 pr-9 text-sm text-slate-600 outline-none focus:border-blue-400 sm:w-52"><option value="Tất cả trạng thái">{t("room.allStatuses")}</option>{statuses.map((item) => <option key={item}>{item}</option>)}</select></div>
    </div>
    <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
      {filtered.map((room) => <article key={room.id} className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg hover:shadow-blue-100/50">
        <button type="button" onClick={() => { setGalleryRoom(room); setGalleryIndex(0); }} className="group relative block h-36 w-full overflow-hidden text-left"><img src={room.images[0]} alt={`${room.name} · ${t("room.roomLabel", "Room")} ${room.id}`} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /><div className="absolute inset-0 bg-gradient-to-t from-slate-950/55 via-transparent to-transparent" /><span className="absolute bottom-3 left-3 rounded-md bg-white/90 px-2 py-1 text-[10px] font-bold text-slate-800 shadow-sm">{t("room.roomLabel", "Room")} {room.id}</span><span className="absolute bottom-3 right-3 rounded-md bg-slate-950/60 px-2 py-1 text-[10px] font-semibold text-white">{t("room.photoCount", "{{count}} photos", { count: room.images.length })}</span></button>
        <div className="flex items-start justify-between bg-gradient-to-br from-blue-50 to-slate-50 p-4"><div className="flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-xl bg-blue-950 text-sm font-bold text-white shadow-sm">{room.id}</div><div><p className="font-bold text-slate-900">{room.name}</p><p className="mt-0.5 text-xs text-slate-500">{t("room.floorLabel", "Floor {{floor}}", { floor: room.floor.match(/\d+/)?.[0] ?? room.floor })} · {room.size}</p></div></div><div className="relative"><button type="button" onClick={() => setStatusMenuRoom((current) => current === room.id ? null : room.id)} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white hover:text-slate-700"><MoreHorizontal size={18} /></button>{statusMenuRoom === room.id && <div className="absolute right-0 top-9 z-20 w-44 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl"><p className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">{t("room.roomStatus")}</p>{statuses.map((nextStatus) => <button type="button" key={nextStatus} onClick={() => { updateRoom(room.id, { status: nextStatus, cleaner: nextStatus === "Đang dọn" ? room.cleaner : "" }); setStatusMenuRoom(null); }} className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs font-semibold transition hover:bg-slate-50 ${room.status === nextStatus ? "text-blue-700" : "text-slate-600"}`}><span>{nextStatus === "Sẵn sàng" ? t("room.ready") : nextStatus === "Đang dọn" ? t("room.cleaning") : nextStatus === "Đang ở" ? t("room.staying") : t("room.maintenance")}</span>{room.status === nextStatus && <Check size={14} />}</button>)}</div>}</div></div>
        <div className="p-4"><div className="flex items-start justify-between gap-2"><div><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusStyle[room.status]}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{room.status === "Sẵn sàng" ? t("room.ready") : room.status === "Đang dọn" ? t("room.cleaning") : room.status === "Đang ở" ? t("room.staying") : t("room.maintenance")}</span></div><p className="text-sm font-bold text-slate-900">{money(room.price)}<span className="text-xs font-normal text-slate-400"> {t("room.perNight")}</span></p></div>
          <div className="mt-4 grid grid-cols-2 gap-2 border-y border-slate-100 py-3"><p className="flex items-center gap-2 text-xs text-slate-600"><BedDouble size={15} className="text-slate-400" />{translateBed(room.beds)}</p><p className="flex items-center gap-2 text-xs text-slate-600"><Users size={15} className="text-slate-400" />{t("room.maxGuestsLabel", "Up to {{count}} guests", { count: room.capacity })}</p></div>
          <div className="mt-3 flex flex-wrap gap-1.5">{room.services.map((service) => <span key={service} className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-2 py-1 text-[10px] font-medium text-slate-600"><Check size={11} className="text-emerald-500" />{service === "Điều hòa" ? t("room.airConditioning") : service === "Phòng tắm riêng" ? t("room.privateBathroom") : service === "Wifi" ? t("room.wifi") : service}</span>)}</div>
          {room.status === "Đang dọn" && <button type="button" onClick={() => completeCleaning(room)} className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 py-2 text-[11px] font-bold text-white transition hover:bg-emerald-700"><Check size={14} />{t("room.confirmCleaning")}</button>}
          <div className="mt-4 border-t border-slate-100 pt-3"><div className="flex flex-wrap items-center justify-between gap-2"><div className="min-w-0">{room.cleaner ? <p className="truncate text-[11px] text-slate-500"><Sparkles size={13} className="mr-1 inline text-amber-500" />{room.cleaner}</p> : <p className="text-[11px] text-slate-400">{t("room.unassignedCleaning")}</p>}</div><div className="flex shrink-0 items-center gap-2"><button type="button" onClick={() => openEditRoomModal(room)} className="flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50"><Pencil size={12} />{t("room.edit")}</button><button type="button" onClick={() => setDetailRoom(room)} className="rounded-md border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50">{t("room.details")}</button>{!room.cleaner && <button type="button" onClick={() => setAssignmentRoom(room)} className="rounded-md bg-amber-50 px-2.5 py-1.5 text-[11px] font-semibold text-amber-700 transition hover:bg-amber-100">{t("room.assign")}</button>}</div></div></div>
        </div>
      </article>)}
    </div>
    {filtered.length === 0 && <div className="p-10 text-center"><p className="font-semibold text-slate-700">Không tìm thấy phòng</p><p className="mt-1 text-xs text-slate-400">Thử thay đổi từ khoá hoặc bộ lọc trạng thái.</p></div>}
    </>}
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
              <button type="button" onClick={saveRoom} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-200 transition hover:bg-blue-700">{editingRoomId ? "Lưu thay đổi" : "Lưu phòng"}</button>
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
                    Tên phòng <span className="text-rose-500">*</span>
                    <select value={createRoomForm.roomType} onChange={(event) => setCreateRoomForm((current) => ({ ...current, roomType: event.target.value, ...roomFormDefaults(event.target.value) }))} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100">
                      {roomTypeOptions.map((roomType) => <option key={roomType} value={roomType}>{roomType}</option>)}
                    </select>
                  </label>

                  <label className="block text-sm font-semibold text-slate-700">
                    Tòa nhà <span className="text-rose-500">*</span>
                    <select value={createRoomForm.building} onChange={(event) => setCreateRoomForm((current) => ({ ...current, building: event.target.value }))} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100">
                      {buildings.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </select>
                  </label>
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className="block text-sm font-semibold text-slate-700">
                    Tầng <span className="text-rose-500">*</span>
                    <select value={createRoomForm.floor} onChange={(event) => setCreateRoomForm((current) => ({ ...current, floor: event.target.value }))} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100">
                      {Array.from(new Set(["1", "2", "3", "4", ...floors.map((floor) => floor.match(/\d+/)?.[0] ?? "1")])).map((value) => (
                        <option key={value} value={value}>{`Tầng ${value}`}</option>
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
                    <input type="number" min="1" step="0.1" value={createRoomForm.area} onChange={(event) => setCreateRoomForm((current) => ({ ...current, area: event.target.value }))} placeholder="25" className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-normal outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
                  </label>

                  <label className="block text-sm font-semibold text-slate-700">
                    Giá phòng / đêm <span className="text-rose-500">*</span>
                    <input type="number" min="1" step="1000" value={createRoomForm.price} onChange={(event) => setCreateRoomForm((current) => ({ ...current, price: event.target.value }))} placeholder="1000000" className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-normal outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
                  </label>
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                  <label className="block text-sm font-semibold text-slate-700">
                    Người lớn <span className="text-rose-500">*</span>
                    <input type="number" min="1" value={createRoomForm.adults} onChange={(event) => setCreateRoomForm((current) => ({ ...current, adults: event.target.value }))} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
                  </label>
                  <label className="block text-sm font-semibold text-slate-700">
                    Trẻ em <span className="text-rose-500">*</span>
                    <input type="number" min="0" value={createRoomForm.children} onChange={(event) => setCreateRoomForm((current) => ({ ...current, children: event.target.value }))} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
                  </label>
                  <label className="block text-sm font-semibold text-slate-700">
                    Em bé <span className="text-rose-500">*</span>
                    <input type="number" min="0" value={createRoomForm.infants} onChange={(event) => setCreateRoomForm((current) => ({ ...current, infants: event.target.value }))} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
                  </label>
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-semibold text-slate-700">
                    Loại giường <span className="text-rose-500">*</span>
                    <select
                      value={createRoomForm.bedType}
                      onChange={(event) => setCreateRoomForm((current) => ({ ...current, bedType: event.target.value }))}
                      className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    >
                      {bedTypeOptions.map((bedType) => (
                        <option key={bedType} value={bedType}>{bedType}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="mt-4">
                  <p className="text-sm font-semibold text-slate-700">Trạng thái phòng <span className="text-rose-500">*</span></p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {statuses.map((status) => {
                      const active = createRoomForm.status === status;
                      const badge = status === "Sẵn sàng" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : status === "Đang dọn" ? "bg-amber-50 text-amber-700 border-amber-200" : status === "Đang ở" ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-rose-50 text-rose-700 border-rose-200";
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

                {showAmenityMenu && (
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
                      <Search size={15} className="text-slate-400" />
                      <input
                        value={amenitySearch}
                        onChange={(event) => setAmenitySearch(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            appendAmenity();
                          }
                        }}
                        placeholder="Nhập tiện nghi mới hoặc tìm kiếm..."
                        className="w-full border-0 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
                      />
                    </div>

                    <div className="mt-3 flex items-center justify-end">
                      <button
                        type="button"
                        onClick={() => appendAmenity()}
                        className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700"
                      >
                        Thêm
                      </button>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {filteredAmenityOptions.slice(0, 8).map((item) => (
                        <button
                          key={item}
                          type="button"
                          onClick={() => appendAmenity(item)}
                          className="rounded-full border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                        >
                          {item}
                        </button>
                      ))}
                    </div>

                    
                  </div>
                )}

                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {amenityOptions.map((item) => {
                    const checked = createRoomForm.amenities.includes(item);
                    return (
                      <label key={item} className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 transition hover:border-blue-200 hover:bg-blue-50/40">
                        <input type="checkbox" checked={checked} onChange={() => (checked ? removeAmenity(item) : setCreateRoomForm((current) => ({ ...current, amenities: [...current.amenities, item] }))) } className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                        <span>{item}</span>
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
                    <span>Giá</span>
                    <strong className="font-semibold text-slate-800">{Number(createRoomForm.price || 0).toLocaleString("vi-VN")}đ</strong>
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
                      <span>{item}</span>
                      <Check size={15} className="text-emerald-600" />
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
    {detailRoom && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4" onMouseDown={() => setDetailRoom(null)}><div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}><div className="flex items-start justify-between border-b border-slate-100 px-5 py-4"><div><p className="text-xs font-semibold uppercase tracking-wider text-blue-600">{t("room.roomInformation")}</p><h3 className="mt-1 text-xl font-bold text-slate-900">{t("room.roomLabel")} {detailRoom.id} · {detailRoom.name}</h3><p className="mt-1 text-sm text-slate-500">{t("room.floorLabel", { floor: detailRoom.floor.match(/\d+/)?.[0] ?? detailRoom.floor })} · {detailRoom.size} · {translateBed(detailRoom.beds)}</p></div><button type="button" onClick={() => setDetailRoom(null)} className="text-2xl leading-none text-slate-400 hover:text-slate-700">×</button></div><div className="grid gap-4 p-5 lg:grid-cols-[1.1fr_1fr]"><div><div className="overflow-hidden rounded-xl"><img src={detailRoom.images[0]} alt={`${detailRoom.name} · ${t("room.roomLabel")} ${detailRoom.id}`} className="h-52 w-full object-cover" /></div><div className="mt-3 grid grid-cols-3 gap-2">{detailRoom.images.slice(1, 4).map((image, index) => <img key={image} src={image} alt={`${t("room.roomLabel")} ${detailRoom.id} · ${t("room.photoCount", { count: index + 2 })}`} className="h-16 w-full rounded-lg object-cover" />)}</div></div><div className="space-y-3"><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-semibold text-slate-500">{t("room.currentStatus")}</p><div className="mt-2 flex items-center justify-between"><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusStyle[detailRoom.status]}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{detailRoom.status === "Sẵn sàng" ? t("room.ready") : detailRoom.status === "Đang dọn" ? t("room.cleaning") : detailRoom.status === "Đang ở" ? t("room.staying") : t("room.maintenance")}</span><p className="text-sm font-bold text-slate-900">{money(detailRoom.price)}<span className="text-xs font-normal text-slate-500"> {t("room.perNight")}</span></p></div>{detailRoom.cleaner ? <p className="mt-2 text-xs text-slate-500">{t("room.housekeepingStaff")} <span className="font-semibold text-slate-700">{detailRoom.cleaner}</span></p> : <p className="mt-2 text-xs text-slate-400">{t("room.unassignedCleaning")}</p>}</div><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-semibold text-slate-500">{t("room.roomSpecifications")}</p><div className="mt-2 space-y-1.5 text-sm text-slate-700"><p><span className="font-semibold">{t("room.maximumGuests")}</span> {t("room.maxGuestsLabel", { count: detailRoom.capacity })}</p><p><span className="font-semibold">{t("room.bedLabel")}</span> {translateBed(detailRoom.beds)}</p><p><span className="font-semibold">{t("room.areaLabel")}</span> {detailRoom.size}</p><p><span className="font-semibold">{t("room.locationLabel")}</span> {t("room.floorLabel", { floor: detailRoom.floor.match(/\d+/)?.[0] ?? detailRoom.floor })}</p></div></div></div></div><div className="border-t border-slate-100 px-5 py-4"><p className="text-xs font-semibold text-slate-500">{t("room.amenitiesLabel")}</p><div className="mt-2 flex flex-wrap gap-2">{detailRoom.services.map((service) => <span key={service} className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">{service}</span>)}</div>{detailRoom.description && <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">{detailRoom.description}</p>}<div className="mt-4 flex flex-wrap justify-end gap-2"><button type="button" onClick={() => { setGalleryRoom(detailRoom); setGalleryIndex(0); }} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">{t("room.viewAllPhotos")}</button><button type="button" onClick={() => setDetailRoom(null)} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">{t("common.close")}</button></div></div></div></div>}
    {galleryRoom && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/75 p-4" onMouseDown={() => setGalleryRoom(null)}><div className="w-full max-w-4xl rounded-2xl bg-white p-4 shadow-2xl sm:p-5" onMouseDown={(event) => event.stopPropagation()}><div className="flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-wider text-blue-600">Thư viện ảnh</p><h3 className="mt-1 text-lg font-bold text-slate-900">Phòng {galleryRoom.id} · {galleryRoom.name}</h3></div><button type="button" onClick={() => setGalleryRoom(null)} className="text-2xl leading-none text-slate-400 hover:text-slate-700">×</button></div><div className="relative mt-4 overflow-hidden rounded-xl bg-slate-100"><img src={galleryRoom.images[galleryIndex]} alt={`${galleryRoom.name} · ảnh ${galleryIndex + 1}`} className="h-[min(52vh,420px)] w-full object-cover" /><button type="button" onClick={() => setGalleryIndex((galleryIndex - 1 + galleryRoom.images.length) % galleryRoom.images.length)} className="absolute left-3 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-xl text-slate-700 shadow-md">‹</button><button type="button" onClick={() => setGalleryIndex((galleryIndex + 1) % galleryRoom.images.length)} className="absolute right-3 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-xl text-slate-700 shadow-md">›</button></div><div className="mt-3 grid grid-cols-4 gap-2">{galleryRoom.images.map((image, index) => <button type="button" key={image} onClick={() => setGalleryIndex(index)} className={`overflow-hidden rounded-lg border-2 ${galleryIndex === index ? "border-blue-600" : "border-transparent"}`}><img src={image} alt={`Ảnh thu nhỏ ${index + 1}`} className="h-16 w-full object-cover" /></button>)}</div></div></div>}
    {assignmentRoom && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/30 p-4" onMouseDown={() => setAssignmentRoom(null)}><div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}><div className="flex items-start justify-between"><div><p className="text-xs font-semibold uppercase tracking-wider text-amber-600">{t("frontDesk.cleaningAssignment")}</p><h3 className="mt-1 text-lg font-bold text-slate-900">{t("room.roomLabel")} {assignmentRoom.id} · {assignmentRoom.name}</h3><p className="mt-1 text-sm text-slate-500">{t("frontDesk.cleaningDescription")}</p></div><button type="button" onClick={() => setAssignmentRoom(null)} className="text-2xl leading-none text-slate-400 hover:text-slate-700">×</button></div><div className="mt-5 space-y-2">{employees.map((employee) => <button type="button" key={employee} onClick={() => { updateRoom(assignmentRoom.id, { cleaner: employee, status: "Đang dọn" }); setAssignmentRoom(null); }} className="flex w-full items-center gap-3 rounded-xl border border-slate-200 p-3 text-left transition hover:border-amber-300 hover:bg-amber-50"><span className="grid h-9 w-9 place-items-center rounded-full bg-amber-100 text-xs font-bold text-amber-700">{employee.split(" ").map((part) => part[0]).slice(-2).join("")}</span><span><span className="block text-sm font-semibold text-slate-800">{employee}</span><span className="mt-0.5 block text-xs text-slate-500">Housekeeping · {t("room.housekeepingReady")}</span></span></button>)}</div><button type="button" onClick={() => setAssignmentRoom(null)} className="mt-5 w-full rounded-lg border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">{t("common.cancel")}</button></div></div>}
  </section>;
}
