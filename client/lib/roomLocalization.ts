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
