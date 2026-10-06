import { createXlsxWorkbook, downloadFile, readXlsxRows, readZipFiles } from "./bulkImportFiles";

export type RoomImportBuilding = { id: string; name: string };
export type RoomImportFloor = { id: string; name: string; buildingId: string };
export type RoomImportAmenity = { id: string; name: string };
export type RoomImportOptions = {
  roomTypes: string[];
  statuses: string[];
  amenities: RoomImportAmenity[];
  buildings: RoomImportBuilding[];
  floors: RoomImportFloor[];
};

export type ImportedRoomData = {
  roomNumber: string;
  roomType: string;
  building: RoomImportBuilding;
  floor: RoomImportFloor;
  area: number;
  price: number;
  capacity: number;
  maxExtraGuests: number;
  extraAdultFee: number;
  extraChildFee: number;
  bedType: string;
  status: string;
  amenities: string[];
  description: string;
  imageFiles: File[];
  rowNumber: number;
};

export type RoomImportRowResult = {
  rowNumber: number;
  roomNumber: string;
  passed: boolean;
  message?: string;
};

export type RoomImportResult = {
  rooms: ImportedRoomData[];
  rows: RoomImportRowResult[];
};

const IMAGE_HEADERS = Array.from({ length: 8 }, (_, index) => `Ảnh ${index + 1}`);
const ROOM_HEADERS = [
  "Số phòng", "Loại phòng", "Tòa", "Tầng", "Trạng thái",
  "Tiện ích (ID)", "Mô tả", ...IMAGE_HEADERS,
];
const REQUIRED_ROOM_HEADERS = ROOM_HEADERS.filter((header) => header !== "Số phòng");
const normalize = (value: string) =>
  value.trim().toLocaleLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "");
const uniqueValues = (values: string[]) => [...new Map(values.map((value) => [normalize(value), value.trim()])).values()].filter(Boolean);
const excelColumnName = (index: number) => {
  let value = index + 1;
  let name = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    value = Math.floor((value - 1) / 26);
  }
  return name;
};
const imageMimeType = (fileName: string) => {
  const extension = fileName.split(".").pop()?.toLowerCase();
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  if (extension === "gif") return "image/gif";
  return "image/bmp";
};

export const downloadRoomTemplate = (options: RoomImportOptions) => {
  const roomTypes = uniqueValues(options.roomTypes);
  const statuses = uniqueValues(options.statuses);
  const amenities = [...new Map(options.amenities
    .filter((item) => item.id.trim() && item.name.trim())
    .map((item) => [item.id.trim(), { ...item, id: item.id.trim(), name: item.name.trim() }])).values()];
  const buildings = options.buildings.filter((item) => item.id && item.name.trim());
  const floors = options.floors.filter((item) =>
    item.id && /^-?\d+$/.test(item.name.trim()) && buildings.some((building) => building.id === item.buildingId),
  );
  const floorNumbers = [...new Set(floors.map((item) => item.name.trim()))];
  const selectedBuilding = buildings[0];
  const selectedFloor = floors.find((floor) => floor.buildingId === selectedBuilding?.id && /^-?\d+$/.test(floor.name.trim()));
  if (buildings.length === 0) {
    throw new Error("Không tải được danh sách tòa nhà từ máy chủ. Vui lòng thử lại sau.");
  }
  if (floorNumbers.length === 0) {
    throw new Error("Không tải được danh sách số tầng hợp lệ của các tòa nhà từ máy chủ. Vui lòng thử lại sau.");
  }
  const exampleValues: Record<string, string | number> = {
    "Số phòng": 101,
    "Loại phòng": roomTypes[0] ?? "",
    "Tòa": selectedBuilding?.name ?? "",
    "Tầng": selectedFloor ? Number(selectedFloor.name) : "",
    "Trạng thái": statuses[0] ?? "",
    "Mô tả": "Phòng nghỉ thoáng mát, đầy đủ tiện nghi",
    "Tiện ích (ID)": amenities.slice(0, 2).map((item) => item.id).join("; "),
    ...Object.fromEntries(IMAGE_HEADERS.map((header, index) => [header, index < 4 ? `101-${index + 1}.jpg` : ""])),
  };
  const example = ROOM_HEADERS.map((header) => exampleValues[header] ?? "");
  const catalogRows: Array<Array<string | number>> = [[
    "Danh mục", "ID / Giá trị", "Tên tiện ích", "Tòa nhà", "ID tòa nhà", "ID tầng", "floorNumber",
  ]];
  const namedRanges: Array<{ name: string; formula: string }> = [];
  const addCatalog = (label: string, rangeName: string, values: string[]) => {
    if (values.length === 0) return;
    const startRow = catalogRows.length + 1;
    values.forEach((value, index) => catalogRows.push([index === 0 ? label : "", value]));
    const endRow = catalogRows.length;
    namedRanges.push({ name: rangeName, formula: `'Danh mục'!$B$${startRow}:$B$${endRow}` });
  };
  addCatalog("Loại phòng", "RoomTypes", roomTypes);
  addCatalog("Trạng thái", "RoomStatuses", statuses);
  addCatalog("Tòa", "BuildingList", buildings.map((item) => item.name));
  addCatalog("Số tầng (floorNumber)", "FloorNumbers", floorNumbers);
  floors.forEach((floor) => {
    const building = buildings.find((item) => item.id === floor.buildingId);
    if (building) {
      catalogRows.push(["", "", "", building.name, building.id, floor.id, floor.name]);
    }
  });
  if (amenities.length > 0) {
    amenities.forEach((amenity, index) => catalogRows.push([index === 0 ? "Tiện ích" : "", amenity.id, amenity.name]));
  }

  const listValidation = (header: string, rangeName: string) => ({
    range: `${excelColumnName(ROOM_HEADERS.indexOf(header))}2:${excelColumnName(ROOM_HEADERS.indexOf(header))}1000`,
    type: "list" as const,
    formula1: `=${rangeName}`,
  });
  const numericValidation = (header: string, type: "whole" | "decimal", minimum: number, maximum?: number) => ({
    range: `${excelColumnName(ROOM_HEADERS.indexOf(header))}2:${excelColumnName(ROOM_HEADERS.indexOf(header))}1000`,
    type,
    operator: maximum === undefined ? "greaterThanOrEqual" as const : "between" as const,
    formula1: String(minimum),
    ...(maximum === undefined ? {} : { formula2: String(maximum) }),
  });

  downloadFile("phong.xlsx", createXlsxWorkbook([
    {
      name: "Dữ liệu phòng",
      rows: [ROOM_HEADERS, example],
      validations: [
        ...(roomTypes.length ? [listValidation("Loại phòng", "RoomTypes")] : []),
        ...(buildings.length ? [listValidation("Tòa", "BuildingList")] : []),
        ...(floorNumbers.length ? [listValidation("Tầng", "FloorNumbers")] : []),
        ...(statuses.length ? [listValidation("Trạng thái", "RoomStatuses")] : []),
        numericValidation("Số phòng", "whole", 1),
      ],
    },
    {
      name: "Hướng dẫn",
      rows: [
        ["HƯỚNG DẪN NHẬP PHÒNG"],
        ["Mỗi dòng trong sheet Dữ liệu phòng là một phòng. Không đổi tên các cột."],
        ["Ô Loại phòng, Tòa, Tầng và Trạng thái có danh sách xổ xuống; chọn Tầng theo đúng Tòa trong danh mục tầng ở sheet Danh mục."],
        ["Sheet Danh mục liệt kê tất cả các tầng thật từ máy chủ, kèm Tòa nhà, ID tòa, ID tầng và floorNumber. Hệ thống dùng Tòa + floorNumber để tìm ID tầng chính xác."],
        ["Số phòng phải là số nguyên dương; ô này được kiểm tra dữ liệu ngay trong Excel."],
        ["Tiện ích dùng một ô duy nhất; nhập ID tiện ích, ngăn cách nhiều ID bằng dấu chấm phẩy (;). Có thể nhập nhiều ID, không giới hạn số lượng."],
        ["Tra ID và tên tiện ích trong sheet Danh mục. Chỉ nhập ID có trong danh mục; hệ thống sẽ kiểm tra từng ID và báo lỗi nếu ID sai."],
        ["Mỗi phòng cần từ 4 đến 8 ảnh. Nhập tên file ảnh bằng tay vào các cột Ảnh 1 đến Ảnh 8."],
        ["Tên ảnh phải khớp chính xác với file trong images, gồm phần mở rộng, ví dụ 101-1.jpg."],
        ["Tạo thư mục dulieuphong, đặt phong.xlsx và thư mục images bên trong, rồi nén thư mục dulieuphong thành dulieuphong.zip."],
        ["Thông tin giá, diện tích, sức chứa, phụ thu và loại giường không cần nhập trong mẫu này."],
        ["Dữ liệu được gửi lên máy chủ để import khi tải file dulieuphong.zip."],
      ],
    },
    {
      name: "Danh mục",
      rows: catalogRows,
    },
  ], namedRanges));
};

export const parseRoomImportArchive = async (
  file: File,
  options: RoomImportOptions,
  existingRoomNumbers: string[] = [],
): Promise<RoomImportResult> => {
  if (file.name.toLocaleLowerCase() !== "dulieuphong.zip") {
    throw new Error("Vui lòng chọn đúng file dulieuphong.zip.");
  }

  const entries = await readZipFiles(await file.arrayBuffer());
  const workbookCandidates = entries.filter((entry) => {
    const normalizedName = entry.name.replace(/\\/g, "/").toLocaleLowerCase();
    return normalizedName === "phong.xlsx" || normalizedName.endsWith("/phong.xlsx");
  });
  const workbook = workbookCandidates.find((entry) => entry.name.replace(/\\/g, "/").toLocaleLowerCase() === "phong.xlsx")
    ?? (workbookCandidates.length === 1 ? workbookCandidates[0] : undefined);
  if (!workbook) {
    throw new Error(workbookCandidates.length > 1
      ? 'ZIP có nhiều file "phong.xlsx"; chỉ để một file phong.xlsx cùng cấp với thư mục images.'
      : 'Không tìm thấy file "phong.xlsx" trong ZIP. Hãy đặt file trong thư mục dulieuphong/.');
  }
  const workbookPath = workbook.name.replace(/\\/g, "/");
  const workbookDirectory = workbookPath.includes("/") ? workbookPath.slice(0, workbookPath.lastIndexOf("/") + 1) : "";
  const imageDirectory = `${workbookDirectory}images/`.toLocaleLowerCase();
  const workbookBytes = new Uint8Array(workbook.content.byteLength);
  workbookBytes.set(workbook.content);
  const rows = await readXlsxRows(workbookBytes);
  const headers = rows[0]?.map(normalize) ?? [];
  const missingHeaders = REQUIRED_ROOM_HEADERS.filter((header) => !headers.includes(normalize(header)));
  if (!headers.includes(normalize("Số phòng")) && !headers.includes(normalize("Mã phòng"))) missingHeaders.push("Số phòng");
  if (missingHeaders.length) throw new Error(`File phong.xlsx thiếu cột: ${missingHeaders.join(", ")}.`);

  const imageFiles = new Map<string, File[]>();
  entries.filter((entry) => {
    const normalizedName = entry.name.replace(/\\/g, "/").toLocaleLowerCase();
    return normalizedName.startsWith(imageDirectory) && /\.(png|jpe?g|webp|gif|bmp)$/i.test(normalizedName);
  }).forEach(({ name, content }) => {
    const fileName = name.replace(/\\/g, "/").split("/").pop() ?? name;
    const bytes = new Uint8Array(content.byteLength);
    bytes.set(content);
    const image = new File([bytes.buffer], fileName, { type: imageMimeType(fileName) });
    const key = fileName.toLocaleLowerCase();
    imageFiles.set(key, [...(imageFiles.get(key) ?? []), image]);
  });

  const dataRows = rows.slice(1).filter((row) => row.some((cell) => cell?.trim()));
  if (dataRows.length === 0) throw new Error("Sheet Dữ liệu phòng chưa có dòng dữ liệu.");
  const byValue = (list: string[]) => new Map(list.map((value) => [normalize(value), value]));
  const roomTypes = byValue(options.roomTypes);
  const statuses = byValue(options.statuses);
  const amenities = new Map(options.amenities.map((amenity) => [amenity.id.trim(), amenity.name]));
  const roomNumbers = new Set(existingRoomNumbers.map(normalize));
  const rowResults: RoomImportRowResult[] = [];
  const importedRooms: ImportedRoomData[] = [];

  dataRows.forEach((row, rowIndex) => {
    const rowNumber = rowIndex + 2;
    const value = (header: string) => {
      const columnIndex = headers.indexOf(normalize(header));
      return columnIndex < 0 ? "" : row[columnIndex]?.trim() ?? "";
    };
    const roomNumber = value("Số phòng") || value("Mã phòng");
    try {
      if (!roomNumber) throw new Error(`Thiếu Số phòng ở dòng ${rowNumber}.`);
      if (!/^\d+$/.test(roomNumber) || !Number.isSafeInteger(Number(roomNumber)) || Number(roomNumber) < 1) {
        throw new Error(`Số phòng "${roomNumber}" ở dòng ${rowNumber} phải là số nguyên dương.`);
      }
      const normalizedRoomNumber = normalize(roomNumber);
      if (roomNumbers.has(normalizedRoomNumber)) {
        throw new Error(`Số phòng "${roomNumber}" ở dòng ${rowNumber} bị trùng hoặc đã tồn tại.`);
      }

      const rawType = value("Loại phòng");
      const roomType = roomTypes.get(normalize(rawType));
      if (!roomType) throw new Error(`Loại phòng "${rawType}" ở dòng ${rowNumber} không nằm trong danh mục.`);
      const rawBuilding = value("Tòa");
      const building = options.buildings.find((item) => normalize(item.name) === normalize(rawBuilding) || normalize(item.id) === normalize(rawBuilding));
      if (!building) throw new Error(`Không tìm thấy tòa "${rawBuilding}" ở dòng ${rowNumber}.`);
      const rawFloor = value("Tầng");
      if (!/^-?\d+$/.test(rawFloor) || !Number.isSafeInteger(Number(rawFloor)) ||
        Number(rawFloor) < -2147483648 || Number(rawFloor) > 2147483647) {
        throw new Error(`Tầng ở dòng ${rowNumber} phải là số nguyên floorNumber.`);
      }
      const floor = options.floors.find((item) =>
        item.buildingId === building.id && Number(item.name) === Number(rawFloor),
      );
      if (!floor) throw new Error(`Không tìm thấy floorNumber ${rawFloor} trong ${building.name} ở dòng ${rowNumber}.`);
      const rawStatus = value("Trạng thái");
      const status = statuses.get(normalize(rawStatus));
      if (!status) throw new Error(`Trạng thái "${rawStatus}" ở dòng ${rowNumber} không hợp lệ.`);
      const rawAmenityIds = (value("Tiện ích (ID)") || value("Tiện ích")).split(/[;,\n|]/).map((item) => item.trim()).filter(Boolean);
      const roomAmenities = [...new Set(rawAmenityIds)].map((amenityId) => {
        if (!/^-?\d+$/.test(amenityId)) {
          throw new Error(`ID tiện ích "${amenityId}" ở dòng ${rowNumber} không hợp lệ; chỉ nhập ID dạng số trong sheet Danh mục.`);
        }
        const amenity = amenities.get(amenityId);
        if (!amenity) throw new Error(`Không tìm thấy tiện ích có ID "${amenityId}" trong danh mục (dòng ${rowNumber}).`);
        return amenity;
      });

      const imageNames = IMAGE_HEADERS.map(value).filter(Boolean);
      if (imageNames.length < 4 || imageNames.length > 8) {
        throw new Error(`Phòng "${roomNumber}" ở dòng ${rowNumber} cần từ 4 đến 8 ảnh.`);
      }
      if (new Set(imageNames.map((name) => name.toLocaleLowerCase())).size !== imageNames.length) {
        throw new Error(`Phòng "${roomNumber}" có tên ảnh bị lặp ở dòng ${rowNumber}.`);
      }
      const roomImages = imageNames.map((imageName) => {
        const matches = imageFiles.get(imageName.toLocaleLowerCase()) ?? [];
        if (matches.length === 0) throw new Error(`Không tìm thấy ảnh "${imageName}" trong images (dòng ${rowNumber}).`);
        if (matches.length > 1) throw new Error(`Tên ảnh "${imageName}" bị trùng trong ZIP (dòng ${rowNumber}).`);
        return matches[0];
      });

      roomNumbers.add(normalizedRoomNumber);
      importedRooms.push({
        roomNumber,
        roomType,
        building,
        floor,
        area: 0,
        price: 0,
        capacity: 1,
        maxExtraGuests: 0,
        extraAdultFee: 0,
        extraChildFee: 0,
        bedType: "",
        status,
        amenities: roomAmenities,
        description: value("Mô tả"),
        imageFiles: roomImages,
        rowNumber,
      });
      rowResults.push({ rowNumber, roomNumber, passed: true });
    } catch (error) {
      rowResults.push({
        rowNumber,
        roomNumber,
        passed: false,
        message: error instanceof Error ? error.message : `Dòng ${rowNumber} không hợp lệ.`,
      });
    }
  });
  return { rooms: importedRooms, rows: rowResults };
};
