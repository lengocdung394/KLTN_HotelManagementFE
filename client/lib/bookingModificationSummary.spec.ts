import { describe, expect, it } from "vitest";
import { describeBookingModification } from "./bookingModificationSummary";

describe("describeBookingModification", () => {
  it("summarizes the changed booking categories in both locales", () => {
    const description = describeBookingModification("BK-12", {
      bookingDetailIdsToCancel: ["detail-1"],
      roomsToAdd: [{
        roomId: "room-2",
        checkInTime: "2025-01-02T14:00:00",
        checkOutTime: "2025-01-04T12:00:00",
        numAdults: 2,
        numChildren: 0,
        numInfants: 0,
        serviceRequests: [{ serviceId: "service-1", quantity: 1 }],
      }],
      roomsToChange: [{
        bookingDetailId: "detail-2",
        newRoomId: "room-3",
        newCheckInTime: "2025-01-02T14:00:00",
        newCheckoutTime: null,
        numAdults: 2,
        numChildren: null,
        numInfants: null,
      }],
      servicesToAddForExistingRooms: [{
        bookingDetailId: "detail-2",
        services: [{ serviceId: "service-2", quantity: 1 }],
      }],
      servicesToCancel: [{
        bookingDetailId: "detail-2",
        serviceDetailIds: ["service-detail-1"],
      }],
      serviceQuantityUpdates: [{
        bookingDetailId: "detail-2",
        services: [
          { serviceId: "service-3", quantity: 2 },
          { serviceId: "service-4", quantity: 0 },
        ],
      }],
    });

    expect(description.vi).toContain("Booking #BK-12");
    expect(description.vi).toContain("thêm 1 phòng");
    expect(description.vi).toContain("đổi ngày lưu trú của 1 phòng");
    expect(description.vi).toContain("thêm 2 dịch vụ");
    expect(description.vi).toContain("gỡ 2 dịch vụ");
    expect(description.en).toContain("1 room added");
    expect(description.en).toContain("1 room reassigned");
    expect(description.en).toContain("2 services added");
  });

  it("uses a clear fallback when the submitted modification has no changes", () => {
    expect(describeBookingModification(42, {}).en).toBe("Booking #42 information has been saved.");
  });
});
