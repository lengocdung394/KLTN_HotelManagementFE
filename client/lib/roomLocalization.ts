export type RoomAmenityTranslationKey =
  | "room.wifi"
  | "room.airConditioning"
  | "room.privateBathroom"
  | "room.minibar"
  | "room.workDesk"
  | "room.television"
  | "room.hotWater";

export type RoomBedTranslationKey =
  | "room.bedNotUpdated"
  | "room.doubleSingleBeds"
  | "room.singleBed"
  | "room.kingBed";

export type RoomBedTypeTranslationKey =
  | "room.singleBed"
  | "room.queenBed"
  | "room.kingBed"
  | "room.createForm.extraBed";

const normalizeBedTypeCatalogValue = (value: string) => value.toLowerCase().normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/đ/g, "d");

const STANDARD_BED_TYPE_ENGLISH: Record<string, string> = {
  "giuong don (single)": "Single bed",
  "giuong danh cho mot nguoi": "A bed for one person",
  "giuong doi (queen)": "Queen bed",
  "giuong doi co queen": "Queen-size double bed",
  "giuong king": "King-size bed",
  "giuong doi co king": "King-size double bed",
  "sofa bed": "Sofa bed",
  "sofa co the chuyen thanh giuong": "Convertible sofa bed",
  "giuong phu (extra bed)": "Extra bed",
  "giuong bo sung cho khach": "Extra bed for guests",
};

export const getStandardBedTypeEnglishValue = (value: string) =>
  STANDARD_BED_TYPE_ENGLISH[normalizeBedTypeCatalogValue(value)] ?? null;

export const getRoomBedTypeTranslationKey = (value: string): RoomBedTypeTranslationKey | null => {
  const normalized = normalizeBedTypeCatalogValue(value);
  if (normalized.includes("giuong don") || normalized.includes("single bed")) return "room.singleBed";
  if (normalized.includes("queen") || normalized.includes("giuong doi")) return "room.queenBed";
  if (normalized.includes("giuong king") || normalized.includes("king-size") || normalized.includes("king size")) {
    return "room.kingBed";
  }
  if (normalized.includes("giuong phu") || normalized.includes("extra bed")) return "room.createForm.extraBed";
  return null;
};

export const localizeRoomNamePrefix = (value: string, prefix: string, translatedPrefix: string) => {
  const trimmedValue = value.trim();
  const normalizedValue = trimmedValue.toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");
  if (!normalizedValue.startsWith(`${prefix} `)) return value;
  const separatorIndex = trimmedValue.indexOf(" ");
  return `${translatedPrefix} ${trimmedValue.slice(separatorIndex + 1).trimStart()}`;
};

export const getRoomAmenityTranslationKey = (value: string): RoomAmenityTranslationKey | null => {
  const normalized = value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (normalized.includes("wifi") || normalized.includes("wi-fi") || normalized.includes("wi fi")) return "room.wifi";
  if (normalized.includes("dieu hoa") || normalized.includes("may lanh") || normalized.includes("air conditioning")) return "room.airConditioning";
  if (normalized.includes("phong tam rieng") || normalized.includes("private bathroom")) return "room.privateBathroom";
  if (normalized.includes("minibar")) return "room.minibar";
  if (normalized.includes("ban lam viec") || normalized.includes("work desk")) return "room.workDesk";
  if (normalized.includes("tivi") || normalized.includes("television") || normalized === "tv") return "room.television";
  if (normalized.includes("nuoc nong") || normalized.includes("hot water")) return "room.hotWater";
  return null;
};

export const getRoomBedTranslationKey = (value: string): RoomBedTranslationKey | null => {
  const normalized = value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");
  if (normalized.includes("2 giuong don") || normalized.includes("2 single beds")) return "room.doubleSingleBeds";
  if (normalized.includes("giuong don") || normalized.includes("single bed")) return "room.singleBed";
  if (normalized.includes("giuong king") || normalized.includes("king-size") || normalized.includes("king size")) return "room.kingBed";
  if (normalized.includes("chua cap nhat loai giuong") || normalized.includes("bed type not updated")) return "room.bedNotUpdated";
  return null;
};

export const localizeBedDescription = (
  value: string,
  translate: (key: RoomBedTranslationKey) => string,
) => value.split(/( · |\s+\+\s+)/).map((item) => {
  if (/^(?: · |\s+\+\s+)$/.test(item)) return item;
  const quantity = item.match(/\s*[×x]\s*(\d+)$/i)?.[1];
  const name = quantity ? item.replace(/\s*[×x]\s*\d+$/i, "") : item;
  const translationKey = getRoomBedTranslationKey(name);
  const translated = translationKey ? translate(translationKey) : name;
  return `${translated}${quantity ? ` × ${quantity}` : ""}`;
}).join("");
