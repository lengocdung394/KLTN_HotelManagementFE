import { createXlsxWorkbook, downloadFile, readZipFiles, readXlsxRows } from "./bulkImportFiles";

const SERVICE_HEADERS = ["Tên dịch vụ", "Mô tả", "Giá", "Đơn vị", "Danh mục", "Tên file ảnh"];
const TEMPLATE_SAMPLE = ["Massage Thư Giãn (Ví dụ)", "Dịch vụ massage body đá nóng 60 phút", 250000, "Lần", "Spa", "massage.jpg"];

export type ServiceImportRow = {
  name: string;
  description: string;
  price: number;
  unit: string;
  category: string;
  imageFileName: string;
  rowNumber: number;
};

export const downloadServiceTemplate = () => {
  const workbook = createXlsxWorkbook([
    { name: "Dịch vụ", rows: [SERVICE_HEADERS, TEMPLATE_SAMPLE] },
    {
      name: "Hướng dẫn",
      rows: [
        ["Hướng dẫn nhập dịch vụ"],
        ["Tạo thư mục gốc tên dich-vu, đặt file Excel này và thư mục images bên trong."],
        ["Bỏ tất cả ảnh vào dich-vu/images, sau đó nén toàn bộ thư mục dich-vu thành một file ZIP."],
        ["Chọn file ZIP đó để nhập. Tên file ở cột Tên file ảnh phải khớp với tên ảnh, ví dụ massage.jpg."],
        ["Không đổi tên các cột trong sheet Dịch vụ; mỗi dòng tương ứng một dịch vụ."],
      ],
    },
  ]);
  downloadFile("mau-nhap-dich-vu.xlsx", workbook);
};

const parseServiceRows = (rows: string[][]): ServiceImportRow[] => {
  const headers = rows[0]?.map((value) => value.trim()) ?? [];
  const columnIndexes = SERVICE_HEADERS.map((header) => headers.indexOf(header));
  const missingHeaders = SERVICE_HEADERS.filter((_, index) => columnIndexes[index] < 0);
  if (missingHeaders.length > 0) {
    throw new Error(`File Excel thiếu cột: ${missingHeaders.join(", ")}.`);
  }

  const dataRows = rows.slice(1).map((row, index) => ({ row, rowNumber: index + 2 }))
    .filter(({ row }) => row.some((value) => value?.trim()))
    .map(({ row, rowNumber }) => {
      const value = (columnIndex: number) => row[columnIndexes[columnIndex]]?.trim() ?? "";
      const priceText = value(2).replace(/\./g, "").replace(/,/g, ".");
      const price = Number(priceText);
      const result: ServiceImportRow = {
        name: value(0),
        description: value(1),
        price,
        unit: value(3),
        category: value(4),
        imageFileName: value(5),
        rowNumber,
      };
      if (!result.name || !result.description || !result.unit || !result.category || !result.imageFileName || !Number.isFinite(price) || price < 0) {
        throw new Error(`Dữ liệu ở dòng ${result.rowNumber} chưa hợp lệ hoặc đang thiếu thông tin.`);
      }
      return result;
    });

  if (dataRows.length === 0) throw new Error("File Excel chưa có dòng dữ liệu dịch vụ nào.");
  return dataRows;
};

const getImageMimeType = (fileName: string) => {
  const extension = fileName.split(".").pop()?.toLowerCase();
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  if (extension === "gif") return "image/gif";
  return "image/bmp";
};

export const parseServiceImportArchive = async (file: File) => {
  const entries = await readZipFiles(await file.arrayBuffer());
  const workbook = entries.find((entry) => /\.xlsx$/i.test(entry.name));
  if (!workbook) throw new Error('Không tìm thấy file Excel .xlsx trong ZIP. Hãy đặt file Excel trong thư mục "dich-vu".');

  const workbookData = workbook.content.buffer.slice(
    workbook.content.byteOffset,
    workbook.content.byteOffset + workbook.content.byteLength,
  );
  const rows = parseServiceRows(await readXlsxRows(workbookData));
  const imageEntries = entries.filter((entry) =>
    /(^|\/)images\/.+\.(png|jpe?g|webp|gif|bmp)$/i.test(entry.name),
  );
  if (imageEntries.length === 0) throw new Error('Không tìm thấy ảnh trong thư mục "images" của ZIP.');

  const filesByName = new Map<string, File[]>();
  imageEntries.forEach(({ name, content }) => {
    const fileName = name.split("/").pop() ?? name;
    const imageFile = new File([content], fileName, { type: getImageMimeType(fileName) });
    const key = fileName.toLocaleLowerCase();
    filesByName.set(key, [...(filesByName.get(key) ?? []), imageFile]);
  });
  return { rows, images: filesByName };
};
