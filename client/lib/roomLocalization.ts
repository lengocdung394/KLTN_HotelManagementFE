export type RoomAmenityTranslationKey =
  | "room.wifi"
  | "room.airConditioning"
  | "room.privateBathroom"
  | "room.minibar"
  | "room.workDesk"
  | "room.television"
  | "room.hotWater";

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
