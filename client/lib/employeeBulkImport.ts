import { createXlsxWorkbook, downloadFile, readZipFiles, readXlsxRows } from "./bulkImportFiles";
import type { EmployeeRecord } from "../services/employeeApi";

const WORKBOOK_NAME = "mau-nhap-nhan-vien.xlsx";
const EMPLOYEE_HEADERS = ["Họ và tên", "Email", "Số điện thoại", "CCCD", "Địa chỉ", "Chức vụ", "Tên file ảnh"];
const EMPLOYEE_ROLES = ["Lễ tân", "Buồng phòng", "Bảo vệ"];
const IMAGE_EXTENSIONS = /\.(png|jpe?g|webp)$/i;

export type EmployeeImportRow = {
  fullName: string;
  email: string;
  phone: string;
  cccd: string;
  address: string;
  position: string;
  imageFileName: string;
  rowNumber: number;
};

export type EmployeeImportRowResult = {
  rowNumber: number;
  fullName: string;
  passed: boolean;
  message?: string;
};

export const downloadEmployeeTemplate = () => {
  const workbook = createXlsxWorkbook([
    {
      name: "Nhân viên",
      rows: [
        EMPLOYEE_HEADERS,
        ["Nguyễn Văn An (Ví dụ)", "an.nguyen@example.com", "0901234567", "012345678901", "Quận 1, TP. Hồ Chí Minh", "Lễ tân", "nguyen-van-an.jpg"],
      ],
      validations: [
        { range: "F2:F1000", type: "list", formula1: "=EmployeeRoles" },
      ],
    },
    {
      name: "Hướng dẫn",
      rows: [
        ["Hướng dẫn nhập nhân viên"],
        [`Đặt file ${WORKBOOK_NAME} và thư mục images cùng cấp trong một thư mục.`],
        ["Bỏ ảnh JPG, JPEG, PNG hoặc WebP vào thư mục images, sau đó nén file Excel và thư mục images thành một file ZIP."],
        ["Tên file ảnh trong cột Tên file ảnh phải khớp tên ảnh bên trong images, ví dụ nguyen-van-an.jpg."],
        ["Không đổi tên các cột trong sheet Nhân viên. Tất cả cột đều bắt buộc; chức vụ chỉ gồm Lễ tân, Buồng phòng hoặc Bảo vệ."],
        ["Email, số điện thoại và CCCD không được trùng với nhân viên đã có hoặc với dòng khác trong file."],
        ["Số điện thoại và CCCD nên nhập dưới dạng văn bản để giữ số 0 ở đầu."],
        ["Tài khoản mới sẽ được cấp mật khẩu mặc định 1111."],
      ],
    },
    {
      name: "Danh mục",
      rows: EMPLOYEE_ROLES.map((role) => [role]),
    },
  ], [
    { name: "EmployeeRoles", formula: "'Danh mục'!$A$1:$A$3" },
  ]);
  downloadFile(WORKBOOK_NAME, workbook);
};

const getArchiveContents = async (file: File) => {
  const entries = await readZipFiles(await file.arrayBuffer());
  const workbookCandidates = entries.filter(({ name }) => {
    const normalizedName = name.replace(/\\/g, "/").toLocaleLowerCase();
    return normalizedName === WORKBOOK_NAME || normalizedName.endsWith(`/${WORKBOOK_NAME}`);
  });
  if (workbookCandidates.length !== 1) {
    throw new Error(workbookCandidates.length > 1
      ? `ZIP có nhiều file "${WORKBOOK_NAME}". Chỉ giữ lại một file Excel mẫu.`
      : `Không tìm thấy "${WORKBOOK_NAME}" trong file ZIP.`);
  }

  const workbookPath = workbookCandidates[0].name.replace(/\\/g, "/");
  const workbookDirectory = workbookPath.includes("/")
    ? workbookPath.slice(0, workbookPath.lastIndexOf("/") + 1)
    : "";
  const imageDirectory = `${workbookDirectory}images/`.toLocaleLowerCase();
  const images = entries.filter(({ name }) => {
    const normalizedName = name.replace(/\\/g, "/").toLocaleLowerCase();
    return normalizedName.startsWith(imageDirectory) && IMAGE_EXTENSIONS.test(normalizedName);
  });

  const workbookBytes = new Uint8Array(workbookCandidates[0].content.byteLength);
  workbookBytes.set(workbookCandidates[0].content);
  return { rows: await readXlsxRows(workbookBytes), images };
};

const parseRows = (rows: string[][]): EmployeeImportRow[] => {
  const headers = rows[0]?.map((value) => value.trim()) ?? [];
  const columnIndexes = EMPLOYEE_HEADERS.map((header) => headers.indexOf(header));
  const missingHeaders = EMPLOYEE_HEADERS.filter((_, index) => columnIndexes[index] < 0);
  if (missingHeaders.length) throw new Error(`File Excel thiếu cột: ${missingHeaders.join(", ")}.`);

  const dataRows = rows.slice(1)
    .map((row, index) => ({ row, rowNumber: index + 2 }))
    .filter(({ row }) => row.some((value) => value?.trim()));
  if (dataRows.length === 0) throw new Error("File Excel chưa có dòng dữ liệu nhân viên nào.");

  return dataRows.map(({ row, rowNumber }) => {
    const value = (column: number) => row[columnIndexes[column]]?.trim() ?? "";
    return {
      fullName: value(0),
      email: value(1),
      phone: value(2),
      cccd: value(3),
      address: value(4),
      position: value(5),
      imageFileName: value(6),
      rowNumber,
    };
  });
};

export const validateEmployeeImportArchive = async (file: File, existingEmployees: EmployeeRecord[]) => {
  const { rows, images } = await getArchiveContents(file);
  const employees = parseRows(rows);
  const imageCounts = new Map<string, number>();
  images.forEach(({ name }) => {
    const fileName = name.replace(/\\/g, "/").split("/").pop() ?? name;
    const key = fileName.toLocaleLowerCase();
    imageCounts.set(key, (imageCounts.get(key) ?? 0) + 1);
  });

  const existingEmails = new Set(existingEmployees.map((employee) => employee.email?.trim().toLocaleLowerCase() ?? ""));
  const existingPhones = new Set(existingEmployees.map((employee) => employee.phone?.trim() ?? ""));
  const existingCccds = new Set(existingEmployees.map((employee) => employee.cccd?.trim() ?? ""));
  const seenEmails = new Set<string>();
  const seenPhones = new Set<string>();
  const seenCccds = new Set<string>();
  const results = employees.map((employee): EmployeeImportRowResult => {
    const emailKey = employee.email.toLocaleLowerCase();
    const imageCount = imageCounts.get(employee.imageFileName.toLocaleLowerCase()) ?? 0;
    let message: string | undefined;

    if (!employee.fullName || !employee.email || !employee.phone || !employee.cccd || !employee.address || !employee.position || !employee.imageFileName) {
      message = "Thiếu thông tin bắt buộc.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(employee.email)) {
      message = "Email không đúng định dạng.";
    } else if (!EMPLOYEE_ROLES.includes(employee.position)) {
      message = "Chức vụ không hợp lệ. Chỉ chấp nhận Lễ tân, Buồng phòng hoặc Bảo vệ.";
    } else if (
      existingEmails.has(emailKey) || seenEmails.has(emailKey) ||
      existingPhones.has(employee.phone) || seenPhones.has(employee.phone) ||
      existingCccds.has(employee.cccd) || seenCccds.has(employee.cccd)
    ) {
      message = "Email, số điện thoại hoặc CCCD bị trùng với nhân viên hiện có hoặc dòng khác trong file.";
    } else if (imageCount === 0) {
      message = `Không tìm thấy ảnh "${employee.imageFileName}" trong thư mục images.`;
    } else if (imageCount > 1) {
      message = `Tên ảnh "${employee.imageFileName}" bị trùng trong ZIP.`;
    }

    if (!message) {
      seenEmails.add(emailKey);
      seenPhones.add(employee.phone);
      seenCccds.add(employee.cccd);
    }
    return { rowNumber: employee.rowNumber, fullName: employee.fullName || "(Chưa có tên)", passed: !message, message };
  });

  return {
    employees,
    images,
    rows: results,
    validCount: results.filter((row) => row.passed).length,
    invalidCount: results.filter((row) => !row.passed).length,
  };
};

export const parseEmployeeImportArchive = async (file: File) => {
  const { rows, images } = await getArchiveContents(file);
  const employees = parseRows(rows);
  if (!images.length) throw new Error('Không tìm thấy ảnh JPG, PNG hoặc WebP trong thư mục "images" của ZIP.');

  const imagesByName = new Map<string, File[]>();
  images.forEach(({ name, content }) => {
    const fileName = name.replace(/\\/g, "/").split("/").pop() ?? name;
    const extension = fileName.split(".").pop()?.toLocaleLowerCase();
    const type = extension === "png" ? "image/png" : extension === "webp" ? "image/webp" : "image/jpeg";
    const bytes = new Uint8Array(content.byteLength);
    bytes.set(content);
    const image = new File([bytes.buffer], fileName, { type });
    const key = fileName.toLocaleLowerCase();
    imagesByName.set(key, [...(imagesByName.get(key) ?? []), image]);
  });

  return { employees, images: imagesByName };
};
