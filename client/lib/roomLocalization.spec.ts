import { describe, expect, it } from "vitest";
import { getRoomBedTranslationKey, localizeBedDescription, localizeRoomNamePrefix } from "./roomLocalization";

const translations = {
  "room.bedNotUpdated": "Bed type not updated",
  "room.doubleSingleBeds": "2 single beds",
  "room.singleBed": "single bed",
  "room.kingBed": "King-size bed",
};

describe("room bed localization", () => {
  it("recognizes supported Vietnamese and English bed names", () => {
    expect(getRoomBedTranslationKey("1 giường đơn")).toBe("room.singleBed");
    expect(getRoomBedTranslationKey("2 single beds")).toBe("room.doubleSingleBeds");
    expect(getRoomBedTranslationKey("1 giường King Size")).toBe("room.kingBed");
  });

  it("localizes multiple bed types while preserving separators and quantities", () => {
    expect(localizeBedDescription(
      "1 giường đơn · 2 giường đơn + 1 giường King Size x 2",
      (key) => translations[key],
    )).toBe("single bed · 2 single beds + King-size bed × 2");
  });

  it("leaves unrecognized bed names unchanged", () => {
    expect(localizeBedDescription("Giường Queen", (key) => translations[key])).toBe("Giường Queen");
  });

  it("localizes Vietnamese building and floor prefixes while preserving names", () => {
    expect(localizeRoomNamePrefix("Tòa A", "toa", "Building")).toBe("Building A");
    expect(localizeRoomNamePrefix("Toà Hoa Hong", "toa", "Building")).toBe("Building Hoa Hong");
    expect(localizeRoomNamePrefix("Tầng 1", "tang", "Floor")).toBe("Floor 1");
    expect(localizeRoomNamePrefix("Building Hoa Hong", "toa", "Building")).toBe("Building Hoa Hong");
  });
});
