import { createXlsxWorkbook, downloadFile, readXlsxRows } from "./bulkImportFiles";
import type { AmenityImportRequest } from "../services/amenityApi";

const normalizeHeader = (value: string) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/đ/g, "d").replace(/[^a-z0-9]/g, "");

const aliases = {
  name: ["tentienich", "tentiennghi", "tienich", "tiennghi", "amenity", "name"],
  price: ["giatien", "gia", "price"],
} as const;

export const downloadAmenityTemplate = () => {
  const workbook = createXlsxWorkbook([
    {
      name: "Tiện ích",
      rows: [
        ["Tên tiện ích", "Giá tiền"],
        ["Wifi tốc độ cao (Ví dụ)", 0],
      ],
    },
    {
      name: "Hướng dẫn",
      rows: [
        ["HƯỚNG DẪN NHẬP TIỆN ÍCH"],
        ["Mỗi dòng trong sheet Tiện ích là một tiện ích mới."],
        ["Nhập tên tiện ích và giá tiền không âm; không đổi tên hai cột Tên tiện ích, Giá tiền."],
        ["Giá tiền nhập bằng số, không thêm ký hiệu tiền tệ. Ví dụ: 50000."],
        ["Các tiện ích trùng tên với danh sách hiện có sẽ được bỏ qua."],
        ["Dữ liệu tiện nghi hợp lệ sẽ được lưu vào cơ sở dữ liệu của hệ thống."],
      ],
    },
  ]);
  downloadFile("mau-nhap-tien-ich.xlsx", workbook);
};

export const parseAmenityImportFile = async (file: File): Promise<AmenityImportRequest> => {
  const rows = file.name.toLocaleLowerCase().endsWith(".csv")
    ? parseCsvRows(await file.text())
    : await readXlsxRows(await file.arrayBuffer());
  if (rows.length < 2) throw new Error("File chưa có dữ liệu tiện ích.");

  const indexes = new Map<string, number>();
  rows[0].forEach((header, index) => {
    const normalized = normalizeHeader(header);
    Object.entries(aliases).forEach(([field, values]) => {
      if ((values as readonly string[]).includes(normalized)) indexes.set(field, index);
    });
  });
  if (!indexes.has("name") || !indexes.has("price")) {
    throw new Error("File cần có cột Tên tiện ích và Giá tiền.");
  }

  const amenities: AmenityImportRequest["amenities"] = [];
  rows.slice(1).forEach((row, index) => {
    if (row.every((cell) => !cell.trim())) return;
    const rowNumber = index + 2;
    const name = row[indexes.get("name")!]?.trim() ?? "";
    const priceText = row[indexes.get("price")!]?.trim() ?? "";
    const price = Number(priceText.replace(/\./g, "").replace(/,/g, "."));
    if (!name || !priceText || !Number.isFinite(price) || price < 0) {
      throw new Error(`Dòng ${rowNumber}: tên tiện ích hoặc giá không hợp lệ.`);
    }
    amenities.push({ row: rowNumber, name, price });
  });
  if (amenities.length === 0) throw new Error("File không có tiện ích hợp lệ để nhập.");
  return { amenities };
};

const parseCsvRows = (text: string) => {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const nextCharacter = text[index + 1];
    if (character === '"' && quoted && nextCharacter === '"') {
      cell += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && nextCharacter === "\n") index += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }
  if (cell || row.length > 0) {
    row.push(cell.trim());
    if (row.some(Boolean)) rows.push(row);
  }
  return rows;
};
