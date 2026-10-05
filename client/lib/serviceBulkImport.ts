import { createXlsxWorkbook, createZipArchive, downloadFile, readZipFiles, readXlsxRows } from "./bulkImportFiles";

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

export type ServiceImportRowResult = {
  rowNumber: number;
  serviceName: string;
  passed: boolean;
  message?: string;
};

export type ServiceImportValidationResult = {
  rows: ServiceImportRowResult[];
  validCount: number;
  invalidCount: number;
};

export const downloadServiceTemplate = () => {
  const workbook = createXlsxWorkbook([
    { name: "Dịch vụ", rows: [SERVICE_HEADERS, TEMPLATE_SAMPLE] },
    {
      name: "Hướng dẫn",
      rows: [
        ["Hướng dẫn nhập dịch vụ"],
        ["Đặt file mau-nhap-dich-vu.xlsx và thư mục images cùng cấp trong một thư mục."],
        ["Bỏ tất cả ảnh vào images, rồi nén thư mục chứa file Excel và images thành dichvu.zip."],
        ["Chọn dichvu.zip để nhập. Tên file ở cột Tên file ảnh phải khớp với tên ảnh trong images, gồm cả phần đuôi, ví dụ massage.jpg."],
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

const getServiceArchiveFiles = (entries: Awaited<ReturnType<typeof readZipFiles>>) => {
  const workbookCandidates = entries.filter(({ name }) =>
    name.replace(/\\/g, "/").toLocaleLowerCase().endsWith("/mau-nhap-dich-vu.xlsx") ||
    name.replace(/\\/g, "/").toLocaleLowerCase() === "mau-nhap-dich-vu.xlsx",
  );
  if (workbookCandidates.length !== 1) {
    throw new Error(workbookCandidates.length > 1
      ? 'ZIP có nhiều file "mau-nhap-dich-vu.xlsx"; chỉ để một file Excel trong thư mục dữ liệu.'
      : 'Không tìm thấy file "mau-nhap-dich-vu.xlsx" trong ZIP. Hãy đặt file này và thư mục "images" cùng cấp.');
  }

  const workbook = workbookCandidates[0];
  const workbookPath = workbook.name.replace(/\\/g, "/");
  const workbookDirectory = workbookPath.includes("/")
    ? workbookPath.slice(0, workbookPath.lastIndexOf("/") + 1)
    : "";
  const imageDirectory = `${workbookDirectory}images/`.toLocaleLowerCase();
  const imageEntries = entries.filter(({ name }) => {
    const normalizedName = name.replace(/\\/g, "/").toLocaleLowerCase();
    return normalizedName.startsWith(imageDirectory) &&
      /\.(png|jpe?g|webp|gif|bmp)$/i.test(normalizedName);
  });

  return { workbook, imageEntries };
};

export const normalizeServiceImportArchive = async (file: File) => {
  const entries = await readZipFiles(await file.arrayBuffer());
  const { workbook, imageEntries } = getServiceArchiveFiles(entries);
  const normalizedEntries = [
    { name: "mau-nhap-dich-vu.xlsx", content: workbook.content },
    ...imageEntries.map(({ name, content }) => ({
      name: `images/${name.replace(/\\/g, "/").split("/").pop() ?? name}`,
      content,
    })),
  ];
  return new File([createZipArchive(normalizedEntries)], file.name, { type: "application/zip" });
};

export const validateServiceImportArchive = async (
  file: File,
  existingServiceNames: string[] = [],
): Promise<ServiceImportValidationResult> => {
  const entries = await readZipFiles(await file.arrayBuffer());
  const { workbook, imageEntries } = getServiceArchiveFiles(entries);

  const workbookData = new Uint8Array(workbook.content.byteLength);
  workbookData.set(workbook.content);
  const rows = await readXlsxRows(workbookData);
  const headers = rows[0]?.map((value) => value.trim()) ?? [];
  const columnIndexes = SERVICE_HEADERS.map((header) => headers.indexOf(header));
  const missingHeaders = SERVICE_HEADERS.filter((_, index) => columnIndexes[index] < 0);
  if (missingHeaders.length > 0) throw new Error(`File Excel thiếu cột: ${missingHeaders.join(", ")}.`);

  const imageNames = new Map<string, number>();
  imageEntries.forEach(({ name }) => {
    const fileName = name.split("/").pop() ?? name;
    const key = fileName.toLocaleLowerCase();
    imageNames.set(key, (imageNames.get(key) ?? 0) + 1);
  });

  const existingNames = new Set(existingServiceNames.map((name) => name.trim().toLocaleLowerCase()));
  const seenNames = new Set<string>();
  const dataRows = rows.slice(1).map((row, index) => ({ row, rowNumber: index + 2 }))
    .filter(({ row }) => row.some((value) => value?.trim()));
  if (dataRows.length === 0) throw new Error("File Excel chưa có dòng dữ liệu dịch vụ nào.");

  const results = dataRows.map(({ row, rowNumber }): ServiceImportRowResult => {
    const value = (columnIndex: number) => row[columnIndexes[columnIndex]]?.trim() ?? "";
    const serviceName = value(0);
    const description = value(1);
    const priceText = value(2).replace(/\./g, "").replace(/,/g, ".");
    const price = Number(priceText);
    const unit = value(3);
    const category = value(4);
    const imageFileName = value(5);
    const nameKey = serviceName.toLocaleLowerCase();
    let message: string | undefined;

    if (!serviceName || !description || !unit || !category || !imageFileName || !priceText || !Number.isFinite(price) || price < 0) {
      message = "Thiếu thông tin bắt buộc hoặc giá không hợp lệ.";
    } else if (existingNames.has(nameKey) || seenNames.has(nameKey)) {
      message = `Tên dịch vụ "${serviceName}" bị trùng với dữ liệu hiện có hoặc dòng trước.`;
    } else if ((imageNames.get(imageFileName.toLocaleLowerCase()) ?? 0) === 0) {
      message = `Không tìm thấy ảnh "${imageFileName}" trong thư mục images.`;
    } else if ((imageNames.get(imageFileName.toLocaleLowerCase()) ?? 0) > 1) {
      message = `Tên ảnh "${imageFileName}" bị trùng trong ZIP.`;
    }

    if (!message) seenNames.add(nameKey);
    return { rowNumber, serviceName, passed: !message, message };
  });

  return {
    rows: results,
    validCount: results.filter((row) => row.passed).length,
    invalidCount: results.filter((row) => !row.passed).length,
  };
};

export const parseServiceImportArchive = async (file: File) => {
  const entries = await readZipFiles(await file.arrayBuffer());
  const { workbook, imageEntries } = getServiceArchiveFiles(entries);

  const workbookData = new Uint8Array(workbook.content.byteLength);
  workbookData.set(workbook.content);
  const rows = parseServiceRows(await readXlsxRows(workbookData));
  if (imageEntries.length === 0) throw new Error('Không tìm thấy ảnh trong thư mục "images" của ZIP.');

  const filesByName = new Map<string, File[]>();
  imageEntries.forEach(({ name, content }) => {
    const fileName = name.split("/").pop() ?? name;
    const imageData = new Uint8Array(content.byteLength);
    imageData.set(content);
    const imageFile = new File([imageData.buffer], fileName, { type: getImageMimeType(fileName) });
    const key = fileName.toLocaleLowerCase();
    filesByName.set(key, [...(filesByName.get(key) ?? []), imageFile]);
  });
  return { rows, images: filesByName };
};
