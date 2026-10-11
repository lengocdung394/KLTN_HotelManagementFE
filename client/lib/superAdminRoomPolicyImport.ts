import { createXlsxWorkbook, downloadFile, readXlsxRows } from "./bulkImportFiles";
import type { SuperAdminRoomPolicy } from "../services/superAdminApi";

const roomTypes: SuperAdminRoomPolicy["roomType"][] = ["STANDARD", "DELUXE", "SUITE", "FAMILY"];

const roomTypeLabels: Record<SuperAdminRoomPolicy["roomType"], string> = {
  STANDARD: "Phòng tiêu chuẩn",
  DELUXE: "Phòng cao cấp",
  SUITE: "Phòng thượng hạng",
  FAMILY: "Phòng gia đình",
};

const normalizeHeader = (value: string) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/đ/g, "d").replace(/[^a-z0-9]/g, "");

const columnAliases = {
  roomType: ["loaiphong", "roomtype"],
  area: ["dientichm2", "dientich", "area"],
  basePrice: ["giacoban", "baseprice", "price"],
  standardCapacity: ["succhuachuan", "standardcapacity"],
  maxExtraGuests: ["khachthemtoida", "maxextraguests"],
  extraAdultFee: ["phuthunguoilon", "extraadultfee"],
  extraChildFee: ["phuthutreem", "extrachildfee"],
} as const;

export const downloadSuperAdminRoomPolicyTemplate = () => {
  const workbook = createXlsxWorkbook([{
    name: "Chinh sach phong",
    rows: [
      ["Loại phòng", "Diện tích (m2)", "Giá cơ bản", "Sức chứa chuẩn", "Khách thêm tối đa", "Phụ thu người lớn", "Phụ thu trẻ em"],
      ...roomTypes.map((roomType) => [roomType, "", "", "", "", "", ""]),
    ],
  }]);
  downloadFile("mau-chinh-sach-gia-phong.xlsx", workbook);
};

export const parseSuperAdminRoomPolicyFile = async (file: File): Promise<SuperAdminRoomPolicy[]> => {
  if (!file.name.toLocaleLowerCase().endsWith(".xlsx")) {
    throw new Error("Vui lòng chọn file Excel định dạng .xlsx.");
  }

  const rows = await readXlsxRows(await file.arrayBuffer());
  if (rows.length < 2) throw new Error("File Excel chưa có dữ liệu chính sách phòng.");

  const headerIndexes = new Map<string, number>();
  rows[0].forEach((header, index) => {
    const normalized = normalizeHeader(header);
    Object.entries(columnAliases).forEach(([field, aliases]) => {
      if ((aliases as readonly string[]).includes(normalized)) headerIndexes.set(field, index);
    });
  });

  const missingHeaders = Object.keys(columnAliases).filter((field) => !headerIndexes.has(field));
  if (missingHeaders.length > 0) {
    const labels: Record<string, string> = {
      roomType: "Loại phòng",
      area: "Diện tích",
      basePrice: "Giá cơ bản",
      standardCapacity: "Sức chứa chuẩn",
      maxExtraGuests: "Khách thêm tối đa",
      extraAdultFee: "Phụ thu người lớn",
      extraChildFee: "Phụ thu trẻ em",
    };
    throw new Error(`File thiếu các cột bắt buộc: ${missingHeaders.map((field) => labels[field]).join(", ")}.`);
  }

  const typeAliases = new Map<string, SuperAdminRoomPolicy["roomType"]>();
  roomTypes.forEach((roomType) => {
    typeAliases.set(normalizeHeader(roomType), roomType);
    typeAliases.set(normalizeHeader(roomTypeLabels[roomType]), roomType);
  });
  const seenTypes = new Set<SuperAdminRoomPolicy["roomType"]>();
  const parsed: SuperAdminRoomPolicy[] = [];

  rows.slice(1).forEach((row, index) => {
    if (row.every((cell) => !cell.trim())) return;
    const rowNumber = index + 2;
    const read = (field: keyof typeof columnAliases) => row[headerIndexes.get(field)!]?.trim() ?? "";
    const roomType = typeAliases.get(normalizeHeader(read("roomType")));
    if (!roomType) throw new Error(`Dòng ${rowNumber}: loại phòng không hợp lệ. Dùng STANDARD, DELUXE, SUITE hoặc FAMILY.`);
    if (seenTypes.has(roomType)) throw new Error(`Dòng ${rowNumber}: loại phòng ${roomType} bị trùng.`);

    const parseNumber = (field: Exclude<keyof typeof columnAliases, "roomType">, label: string) => {
      const raw = read(field).replace(",", ".");
      const value = Number(raw);
      if (!raw || !Number.isFinite(value)) throw new Error(`Dòng ${rowNumber}: "${label}" phải là số hợp lệ.`);
      return value;
    };
    const area = parseNumber("area", "Diện tích");
    const basePrice = parseNumber("basePrice", "Giá cơ bản");
    const standardCapacity = parseNumber("standardCapacity", "Sức chứa chuẩn");
    const maxExtraGuests = parseNumber("maxExtraGuests", "Khách thêm tối đa");
    const extraAdultFee = parseNumber("extraAdultFee", "Phụ thu người lớn");
    const extraChildFee = parseNumber("extraChildFee", "Phụ thu trẻ em");

    if (area <= 0 || basePrice < 0 || !Number.isInteger(standardCapacity) || standardCapacity < 1
      || !Number.isInteger(maxExtraGuests) || maxExtraGuests < 0 || extraAdultFee < 0 || extraChildFee < 0) {
      throw new Error(`Dòng ${rowNumber}: diện tích phải lớn hơn 0; giá/phụ thu không âm; sức chứa phải là số nguyên hợp lệ.`);
    }

    seenTypes.add(roomType);
    parsed.push({ roomType, area, basePrice, standardCapacity, maxExtraGuests, extraAdultFee, extraChildFee });
  });

  const missingTypes = roomTypes.filter((roomType) => !seenTypes.has(roomType));
  if (missingTypes.length > 0) {
    throw new Error(`File cần có đủ 4 loại phòng. Thiếu: ${missingTypes.join(", ")}.`);
  }
  return parsed;
};
