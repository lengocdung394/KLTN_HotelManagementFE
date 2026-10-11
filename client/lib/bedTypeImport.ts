import { createXlsxWorkbook, downloadFile, readXlsxRows } from "./bulkImportFiles";
import type { BedTypeRequest } from "../services/roomApi";

const normalizeHeader = (value: string) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/đ/g, "d").replace(/[^a-z0-9]/g, "");

const aliases = {
  name: ["tenloaigiuong", "loaigiuong", "name"],
  description: ["mota", "description"],
  capacity: ["succhua", "succhuanguoi", "capacity"],
  isExtraBed: ["lagiuongphu", "giuongphu", "isextrabed"],
} as const;

export const downloadBedTypeTemplate = () => {
  const workbook = createXlsxWorkbook([{
    name: "Danh sach giuong",
    rows: [
      ["Tên loại giường", "Mô tả", "Sức chứa", "Là giường phụ"],
      ["Giường đơn (Single)", "Giường dành cho một người", 1, "Không"],
      ["Giường đôi (Queen)", "Giường đôi cỡ Queen", 2, "Không"],
      ["Giường King", "Giường đôi cỡ King", 2, "Không"],
      ["Sofa bed", "Sofa có thể chuyển thành giường", 2, "Không"],
      ["Giường phụ (Extra bed)", "Giường bổ sung cho khách", 1, "Có"],
    ],
  }]);
  downloadFile("mau-danh-sach-loai-giuong.xlsx", workbook);
};

export const parseBedTypeFile = async (file: File): Promise<BedTypeRequest[]> => {
  if (!file.name.toLocaleLowerCase().endsWith(".xlsx")) {
    throw new Error("Vui lòng chọn file Excel định dạng .xlsx.");
  }
  const rows = await readXlsxRows(await file.arrayBuffer());
  if (rows.length < 2) throw new Error("File Excel chưa có dữ liệu loại giường.");

  const indexes = new Map<string, number>();
  rows[0].forEach((header, index) => {
    const normalized = normalizeHeader(header);
    Object.entries(aliases).forEach(([field, values]) => {
      if ((values as readonly string[]).includes(normalized)) indexes.set(field, index);
    });
  });
  const missing = Object.keys(aliases).filter((field) => !indexes.has(field));
  if (missing.length) throw new Error("File cần đủ các cột: Tên loại giường, Mô tả, Sức chứa, Là giường phụ.");

  const names = new Set<string>();
  const result: BedTypeRequest[] = [];
  rows.slice(1).forEach((row, index) => {
    if (row.every((cell) => !cell.trim())) return;
    const rowNumber = index + 2;
    const read = (field: keyof typeof aliases) => row[indexes.get(field)!]?.trim() ?? "";
    const name = read("name");
    const description = read("description");
    const capacityText = read("capacity").replace(",", ".");
    const capacity = Number(capacityText);
    const extraBedText = normalizeHeader(read("isExtraBed"));
    const isExtraBed = ["co", "yes", "true", "1"].includes(extraBedText)
      ? true
      : ["khong", "no", "false", "0"].includes(extraBedText)
        ? false
        : null;

    if (!name) throw new Error(`Dòng ${rowNumber}: tên loại giường không được để trống.`);
    if (names.has(name.toLocaleLowerCase())) throw new Error(`Dòng ${rowNumber}: tên loại giường "${name}" bị trùng trong file.`);
    if (!capacityText || !Number.isInteger(capacity) || capacity < 1) {
      throw new Error(`Dòng ${rowNumber}: sức chứa phải là số nguyên từ 1 trở lên.`);
    }
    if (isExtraBed === null) throw new Error(`Dòng ${rowNumber}: "Là giường phụ" phải là Có/Không.`);
    names.add(name.toLocaleLowerCase());
    result.push({ name, description, capacity, isExtraBed });
  });
  if (!result.length) throw new Error("File Excel không có dòng loại giường hợp lệ.");
  return result;
};
