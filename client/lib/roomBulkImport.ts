import { createXlsxWorkbook, downloadFile, readXlsxRowsByName, readZipFiles } from "./bulkImportFiles";

export type RoomImportBuilding = { id: string; name: string };
export type RoomImportFloor = { id: string; name: string; buildingId: string };
export type RoomImportAmenity = { id: string; name: string };
export type RoomImportBedType = { id: number; name: string };
export type RoomImportOptions = {
  roomTypes: string[];
  statuses: string[];
  amenities: RoomImportAmenity[];
  bedTypes: RoomImportBedType[];
  buildings: RoomImportBuilding[];
  floors: RoomImportFloor[];
  language?: "en" | "vi";
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
  beds: Array<{ bedTypeId: number; bedTypeName: string; quantity: number }>;
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
const BED_HEADERS = ["Số phòng", "Loại giường", "Số lượng"];
const ROOM_HEADERS = [
  "Số phòng", "Loại phòng", "Tòa", "Tầng", "Trạng thái",
  "Tiện ích (ID)", "Mô tả", ...IMAGE_HEADERS,
];
const ENGLISH_ROOM_HEADERS: Record<string, string> = {
  "Số phòng": "Room number",
  "Loại phòng": "Room type",
  "Tòa": "Building",
  "Tầng": "Floor",
  "Trạng thái": "Status",
  "Tiện ích (ID)": "Amenity IDs",
  "Mô tả": "Description",
  ...Object.fromEntries(IMAGE_HEADERS.map((header, index) => [header, `Image ${index + 1}`])),
};
const ENGLISH_BED_HEADERS = ["Room number", "Bed type", "Quantity"];
const ROOM_TYPE_ENGLISH: Record<string, string> = {
  STANDARD: "Standard Room",
  DELUXE: "Deluxe Room",
  SUITE: "Suite Room",
  FAMILY: "Family Room",
  "Phòng Tiêu Chuẩn": "Standard Room",
  "Phòng Cao Cấp": "Deluxe Room",
  "Phòng Thượng Hạng": "Suite Room",
  "Phòng Gia Đình": "Family Room",
  "Standard Room": "Standard Room",
  "Deluxe Room": "Deluxe Room",
  "Superior Room": "Deluxe Room",
  "Suite Room": "Suite Room",
  "Family Room": "Family Room",
};
const STATUS_ENGLISH: Record<string, string> = {
  READY: "Ready",
  CLEANING: "Cleaning",
  IN_USE: "Occupied",
  MAINTENANCE: "Maintenance",
  "Sẵn sàng": "Ready",
  "Đang dọn": "Cleaning",
  "Đang ở": "Occupied",
  "Bảo trì": "Maintenance",
  Ready: "Ready",
  Cleaning: "Cleaning",
  Occupied: "Occupied",
  Maintenance: "Maintenance",
};
const BED_TYPE_ENGLISH: Array<[RegExp, string]> = [
  [/2giuongdon|2singlebeds/i, "2 single beds"],
  [/giuongdon|singlebed/i, "Single bed"],
  [/giuongking|kingsize/i, "King-size bed"],
  [/giuongphu|extrabed/i, "Extra bed"],
];
const SHEET_NAMES = {
  vi: { rooms: "Dữ liệu phòng", instructions: "Hướng dẫn", catalog: "Danh mục", beds: "Giường phòng" },
  en: { rooms: "Room Data", instructions: "Instructions", catalog: "Catalog", beds: "Room Beds" },
} as const;
const REQUIRED_ROOM_HEADERS = ROOM_HEADERS.filter((header) => header !== "Số phòng");
const normalize = (value: string) =>
  value.trim().toLocaleLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "");
const getRoomHeaders = (english: boolean) => ROOM_HEADERS.map((header) => english ? ENGLISH_ROOM_HEADERS[header] : header);
const canonicalizeHeaders = (headers: string[], aliases: Record<string, string>) =>
  headers.map((header) => aliases[normalize(header)] ?? normalize(header));
const localizedBedType = (name: string, english: boolean) => english
  ? BED_TYPE_ENGLISH.find(([pattern]) => pattern.test(normalize(name)))?.[1] ?? name
  : name;
const translatedValue = (value: string, translations: Record<string, string>) =>
  Object.entries(translations).find(([source]) => normalize(source) === normalize(value))?.[1] ?? value;
const localizedBuilding = (name: string, english: boolean) =>
  english ? name.replace(/^Tòa\s*/i, "Building ") : name;
const readFirstAvailableSheet = async (data: Uint8Array, names: string[]) => {
  for (const name of names) {
    try {
      const rows = await readXlsxRowsByName(data, name);
      if (rows.length > 0) return rows;
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes(`Không tìm thấy sheet "${name}"`)) {
        throw error;
      }
    }
  }
  return [];
};
const roomHeaderAliases = Object.fromEntries(ROOM_HEADERS.flatMap((header) => [
  [normalize(header), normalize(header)],
  [normalize(ENGLISH_ROOM_HEADERS[header]), normalize(header)],
]));
roomHeaderAliases[normalize("Mã phòng")] = normalize("Số phòng");
roomHeaderAliases[normalize("Amenity")] = normalize("Tiện ích (ID)");
roomHeaderAliases[normalize("Amenities")] = normalize("Tiện ích (ID)");
roomHeaderAliases[normalize("Amenity IDs")] = normalize("Tiện ích (ID)");
const bedHeaderAliases = Object.fromEntries(BED_HEADERS.flatMap((header, index) => [
  [normalize(header), normalize(header)],
  [normalize(ENGLISH_BED_HEADERS[index]), normalize(header)],
]));
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
  const english = options.language === "en";
  const sheetNames = english ? SHEET_NAMES.en : SHEET_NAMES.vi;
  const roomHeaders = getRoomHeaders(english);
  const bedHeaders = english ? ENGLISH_BED_HEADERS : BED_HEADERS;
  const roomTypes = uniqueValues(options.roomTypes);
  const statuses = uniqueValues(options.statuses);
  const roomTypeChoices = roomTypes.map((value) => english ? translatedValue(value, ROOM_TYPE_ENGLISH) : value);
  const statusChoices = statuses.map((value) => english ? translatedValue(value, STATUS_ENGLISH) : value);
  const amenities = [...new Map(options.amenities
    .filter((item) => item.id.trim() && item.name.trim())
    .map((item) => [item.id.trim(), { ...item, id: item.id.trim(), name: item.name.trim() }])).values()];
  const bedTypes = [...new Map(options.bedTypes
    .filter((item) => Number.isInteger(item.id) && item.id > 0 && item.name.trim())
    .map((item) => [normalize(item.name), { ...item, name: item.name.trim() }])).values()];
  const bedTypeChoices = bedTypes.map((bedType) => localizedBedType(bedType.name, english));
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
  if (bedTypes.length === 0) {
    throw new Error("Chưa có loại giường trong danh mục. Vui lòng thêm loại giường trước khi tải mẫu.");
  }
  const exampleValues: Record<string, string | number> = {
    "Số phòng": 101,
    "Loại phòng": roomTypeChoices[0] ?? "",
    "Tòa": selectedBuilding ? localizedBuilding(selectedBuilding.name, english) : "",
    "Tầng": selectedFloor ? Number(selectedFloor.name) : "",
    "Trạng thái": statusChoices[0] ?? "",
    "Mô tả": english ? "Comfortable room with full amenities" : "Phòng nghỉ thoáng mát, đầy đủ tiện nghi",
    "Tiện ích (ID)": amenities.slice(0, 2).map((item) => item.id).join("; "),
    ...Object.fromEntries(IMAGE_HEADERS.map((header, index) => [header, index < 4 ? `101-${index + 1}.jpg` : ""])),
  };
  const example = ROOM_HEADERS.map((header) => exampleValues[header] ?? "");
  const catalogRows: Array<Array<string | number>> = [[
    ...(english
      ? ["Category", "ID / Value", "Amenity name", "Building", "Building ID", "Floor ID", "floorNumber"]
      : ["Danh mục", "ID / Giá trị", "Tên tiện ích", "Tòa nhà", "ID tòa nhà", "ID tầng", "floorNumber"]),
  ]];
  const namedRanges: Array<{ name: string; formula: string }> = [];
  const addCatalog = (label: string, rangeName: string, values: string[]) => {
    if (values.length === 0) return;
    const startRow = catalogRows.length + 1;
    values.forEach((value, index) => catalogRows.push([index === 0 ? label : "", value]));
    const endRow = catalogRows.length;
    namedRanges.push({ name: rangeName, formula: `'${sheetNames.catalog}'!$B$${startRow}:$B$${endRow}` });
  };
  addCatalog(english ? "Room type" : "Loại phòng", "RoomTypes", roomTypeChoices);
  addCatalog(english ? "Status" : "Trạng thái", "RoomStatuses", statusChoices);
  addCatalog(english ? "Building" : "Tòa", "BuildingList", buildings.map((item) => localizedBuilding(item.name, english)));
  addCatalog(english ? "Floor number (floorNumber)" : "Số tầng (floorNumber)", "FloorNumbers", floorNumbers);
  floors.forEach((floor) => {
    const building = buildings.find((item) => item.id === floor.buildingId);
    if (building) {
      catalogRows.push(["", "", "", localizedBuilding(building.name, english), building.id, floor.id, floor.name]);
    }
  });
  if (amenities.length > 0) {
    amenities.forEach((amenity, index) => catalogRows.push([index === 0 ? (english ? "Amenity" : "Tiện ích") : "", amenity.id, amenity.name]));
  }
  const bedTypeStartRow = catalogRows.length + 1;
  bedTypes.forEach((bedType, index) => catalogRows.push([index === 0 ? (english ? "Bed type" : "Loại giường") : "", bedTypeChoices[index]]));
  const bedTypeEndRow = catalogRows.length;
  namedRanges.push({ name: "BedTypes", formula: `'${sheetNames.catalog}'!$B$${bedTypeStartRow}:$B$${bedTypeEndRow}` });
  namedRanges.push({ name: "RoomNumbers", formula: `'${sheetNames.rooms}'!$A$2:$A$1000` });

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
      name: sheetNames.rooms,
      rows: [roomHeaders, example],
      validations: [
        ...(roomTypes.length ? [listValidation("Loại phòng", "RoomTypes")] : []),
        ...(buildings.length ? [listValidation("Tòa", "BuildingList")] : []),
        ...(floorNumbers.length ? [listValidation("Tầng", "FloorNumbers")] : []),
        ...(statuses.length ? [listValidation("Trạng thái", "RoomStatuses")] : []),
        numericValidation("Số phòng", "whole", 1),
      ],
    },
    {
      name: sheetNames.instructions,
      rows: english ? [
        ["ROOM IMPORT INSTRUCTIONS"],
        ["Each row in the Room Data sheet represents one room. Do not rename the columns."],
        ["Room type, Building, Floor, and Status cells have dropdown lists. Choose a floor number that belongs to the selected building."],
        ["The Catalog sheet lists the floors from the server with their building name, building ID, floor ID, and floorNumber. The system uses Building and floorNumber to find the correct floor."],
        ["Room numbers must be positive whole numbers; this is validated in Excel."],
        ["Enter amenity IDs in one cell, separated by semicolons (;). There is no limit to the number of IDs."],
        ["Find amenity IDs and names in the Catalog sheet. Only IDs in the catalog are accepted."],
        ["In the Room Beds sheet, choose the Room number and Bed type from the dropdown lists, then enter a whole-number quantity of at least 1."],
        ["A room can have multiple bed types by adding multiple rows for the same room number. List each bed type only once per room."],
        ["Each room must have at least one bed configuration. Available bed types come from the current catalog."],
        ["Each room needs 4 to 8 images. Enter image filenames in the Image 1 through Image 8 columns."],
        ["Image filenames must exactly match files in the images folder, including the extension, for example 101-1.jpg."],
        ["Create a dulieuphong folder, place phong.xlsx and the images folder inside it, then zip the folder as dulieuphong.zip."],
        ["Price, area, capacity, and extra guest fees are not required in this template."],
        ["The data will be sent to the server for import when dulieuphong.zip is uploaded."],
      ] : [
        ["HƯỚNG DẪN NHẬP PHÒNG"],
        ["Mỗi dòng trong sheet Dữ liệu phòng là một phòng. Không đổi tên các cột."],
        ["Ô Loại phòng, Tòa, Tầng và Trạng thái có danh sách xổ xuống; chọn Tầng theo đúng Tòa trong danh mục tầng ở sheet Danh mục."],
        ["Sheet Danh mục liệt kê tất cả các tầng thật từ máy chủ, kèm Tòa nhà, ID tòa, ID tầng và floorNumber. Hệ thống dùng Tòa + floorNumber để tìm ID tầng chính xác."],
        ["Số phòng phải là số nguyên dương; ô này được kiểm tra dữ liệu ngay trong Excel."],
        ["Tiện ích dùng một ô duy nhất; nhập ID tiện ích, ngăn cách nhiều ID bằng dấu chấm phẩy (;). Có thể nhập nhiều ID, không giới hạn số lượng."],
        ["Tra ID và tên tiện ích trong sheet Danh mục. Chỉ nhập ID có trong danh mục; hệ thống sẽ kiểm tra từng ID và báo lỗi nếu ID sai."],
        ["Sheet Giường phòng: mỗi dòng chọn Số phòng và Loại giường từ danh sách xổ xuống, nhập Số lượng là số nguyên từ 1 trở lên."],
        ["Một phòng có thể có nhiều loại giường; thêm nhiều dòng cùng Số phòng. Mỗi loại giường chỉ khai báo một lần cho mỗi phòng."],
        ["Mỗi phòng phải có ít nhất một cấu hình giường. Danh sách loại giường được lấy từ danh mục hiện tại."],
        ["Mỗi phòng cần từ 4 đến 8 ảnh. Nhập tên file ảnh bằng tay vào các cột Ảnh 1 đến Ảnh 8."],
        ["Tên ảnh phải khớp chính xác với file trong images, gồm phần mở rộng, ví dụ 101-1.jpg."],
        ["Tạo thư mục dulieuphong, đặt phong.xlsx và thư mục images bên trong, rồi nén thư mục dulieuphong thành dulieuphong.zip."],
        ["Thông tin giá, diện tích, sức chứa và phụ thu không cần nhập trong mẫu này."],
        ["Dữ liệu được gửi lên máy chủ để import khi tải file dulieuphong.zip."],
      ],
    },
    {
      name: sheetNames.catalog,
      rows: catalogRows,
    },
    {
      name: sheetNames.beds,
      rows: [
        bedHeaders,
        [101, bedTypeChoices[0], 1],
      ],
      validations: [
        { range: "A2:A1000", type: "list", formula1: "=RoomNumbers" },
        { range: "B2:B1000", type: "list", formula1: "=BedTypes" },
        { range: "C2:C1000", type: "whole", operator: "greaterThanOrEqual", formula1: "1" },
      ],
    },
  ], namedRanges));
};

export const downloadBuildingTemplate = (language: "en" | "vi") => {
  const english = language === "en";
  const headers = english ? ["Building name"] : ["Tên tòa nhà"];
  const sheetName = english ? "Buildings" : "Danh sách tòa nhà";
  const rows: Array<Array<string | number>> = [
    headers,
    [english ? "Sunrise Building" : "Tòa Sunrise"],
    [english ? "Garden Building" : "Tòa Garden"],
  ];
  downloadFile(
    english ? "building-template.xlsx" : "mau-nhap-toa-nha.xlsx",
    createXlsxWorkbook([{ name: sheetName, rows }]),
  );
};

export const downloadFloorTemplate = (
  language: "en" | "vi",
  buildings: RoomImportBuilding[],
  selectedBuildingId: string,
) => {
  if (buildings.length === 0) {
    throw new Error(language === "en" ? "No buildings are available to create floors." : "Chưa có tòa nhà để tạo tầng.");
  }
  const english = language === "en";
  const sheetName = english ? "Floors" : "Danh sách tầng";
  const buildingHeader = english ? "Building" : "Tòa nhà";
  const floorHeader = english ? "Floor number" : "Số tầng";
  const selectedBuilding = buildings.find((building) => building.id === selectedBuildingId) ?? buildings[0];
  const buildingOptions = [...new Map(buildings.map((building) => {
    const name = localizedBuilding(building.name, english);
    return [name, name];
  })).values()];
  const selectedBuildingName = localizedBuilding(selectedBuilding.name, english);
  const rows: Array<Array<string | number>> = [
    [buildingHeader, floorHeader],
    [selectedBuildingName, 1],
    [selectedBuildingName, 2],
  ];
  const namedRanges = [{ name: "BuildingList", formula: `'${english ? "Buildings" : "Danh mục"}'!$A$2:$A$${buildingOptions.length + 1}` }];
  const sheets = [
    {
      name: sheetName,
      rows,
      validations: [
        { range: "A2:A1000", type: "list" as const, formula1: "=BuildingList" },
        { range: "B2:B1000", type: "whole" as const, operator: "greaterThanOrEqual" as const, formula1: "1" },
      ],
    },
    {
      name: english ? "Buildings" : "Danh mục",
      rows: [[buildingHeader], ...buildingOptions.map((name) => [name])],
    },
  ];
  downloadFile(
    english ? "floor-template.xlsx" : "mau-nhap-tang.xlsx",
    createXlsxWorkbook(sheets, namedRanges),
  );
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
  const rows = await readFirstAvailableSheet(workbookBytes, [SHEET_NAMES.vi.rooms, SHEET_NAMES.en.rooms]);
  const bedRows = await readFirstAvailableSheet(workbookBytes, [SHEET_NAMES.vi.beds, SHEET_NAMES.en.beds]);
  const headers = canonicalizeHeaders(rows[0] ?? [], roomHeaderAliases);
  const missingHeaders = REQUIRED_ROOM_HEADERS.filter((header) => !headers.includes(normalize(header)));
  if (!headers.includes(normalize("Số phòng")) && !headers.includes(normalize("Mã phòng"))) missingHeaders.push("Số phòng");
  if (missingHeaders.length) throw new Error(`File phong.xlsx thiếu cột: ${missingHeaders.join(", ")}.`);
  if (bedRows.length === 0) throw new Error('Sheet "Giường phòng" chưa có dòng tiêu đề.');

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
  options.roomTypes.forEach((value) => roomTypes.set(normalize(translatedValue(value, ROOM_TYPE_ENGLISH)), value));
  options.statuses.forEach((value) => statuses.set(normalize(translatedValue(value, STATUS_ENGLISH)), value));
  const amenities = new Map(options.amenities.map((amenity) => [amenity.id.trim(), amenity.name]));
  const bedTypes = new Map(options.bedTypes.map((bedType) => [normalize(bedType.name), bedType]));
  options.bedTypes.forEach((bedType) => bedTypes.set(normalize(localizedBedType(bedType.name, true)), bedType));
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
      const building = options.buildings.find((item) =>
        normalize(item.name) === normalize(rawBuilding)
        || normalize(item.name.replace(/^Tòa\s*/i, "Building ")) === normalize(rawBuilding)
        || normalize(item.id) === normalize(rawBuilding),
      );
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
        beds: [],
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

  const bedHeaders = canonicalizeHeaders(bedRows[0] ?? [], bedHeaderAliases);
  const missingBedHeaders = BED_HEADERS.filter((header) => !bedHeaders.includes(normalize(header)));
  if (missingBedHeaders.length) {
    throw new Error(`Sheet Giường phòng thiếu cột: ${missingBedHeaders.join(", ")}.`);
  }
  const roomsByNumber = new Map(importedRooms.map((room) => [normalize(room.roomNumber), room]));
  const invalidBedRooms = new Set<string>();
  const assignedBedKeys = new Set<string>();
  bedRows.slice(1).forEach((row, index) => {
    if (row.every((cell) => !cell?.trim())) return;
    const rowNumber = index + 2;
    const value = (header: string) => {
      const columnIndex = bedHeaders.indexOf(normalize(header));
      return columnIndex < 0 ? "" : row[columnIndex]?.trim() ?? "";
    };
    const roomNumber = value("Số phòng");
    const roomKey = normalize(roomNumber);
    const room = roomsByNumber.get(roomKey);
    try {
      if (!room) throw new Error(`Không tìm thấy phòng "${roomNumber}" trong sheet Dữ liệu phòng.`);
      const rawBedType = value("Loại giường");
      const bedType = bedTypes.get(normalize(rawBedType));
      if (!bedType) throw new Error(`Loại giường "${rawBedType}" không nằm trong danh mục.`);
      const quantityText = value("Số lượng");
      const quantity = Number(quantityText);
      if (!quantityText || !Number.isSafeInteger(quantity) || quantity < 1) {
        throw new Error("Số lượng phải là số nguyên từ 1 trở lên.");
      }
      const key = `${roomKey}:${bedType.id}`;
      if (assignedBedKeys.has(key)) {
        throw new Error(`Loại giường "${bedType.name}" bị khai báo trùng cho phòng ${roomNumber}.`);
      }
      assignedBedKeys.add(key);
      room.beds.push({ bedTypeId: bedType.id, bedTypeName: bedType.name, quantity });
      rowResults.push({
        rowNumber,
        roomNumber,
        passed: true,
        message: `Sheet Giường phòng: đã gán ${quantity} × ${bedType.name}.`,
      });
    } catch (error) {
      if (roomKey) invalidBedRooms.add(roomKey);
      rowResults.push({
        rowNumber,
        roomNumber,
        passed: false,
        message: error instanceof Error ? error.message : `Dòng ${rowNumber} ở sheet Giường phòng không hợp lệ.`,
      });
    }
  });

  importedRooms.forEach((room) => {
    const roomKey = normalize(room.roomNumber);
    if (room.beds.length === 0) {
      invalidBedRooms.add(roomKey);
      const roomResult = rowResults.find((result) =>
        result.passed && normalize(result.roomNumber) === roomKey && !result.message?.startsWith("Sheet Giường phòng:"),
      );
      if (roomResult) {
        roomResult.passed = false;
        roomResult.message = `Phòng ${room.roomNumber} chưa có cấu hình giường trong sheet Giường phòng.`;
      }
    }
  });
  const validRooms = importedRooms.filter((room) => !invalidBedRooms.has(normalize(room.roomNumber)));
  return { rooms: validRooms, rows: rowResults };
};
