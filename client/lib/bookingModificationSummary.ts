import type { ManagementBookingModificationRequest } from "../services/managementBookingApi";

type BookingModificationSummaryInput = Partial<Pick<
  ManagementBookingModificationRequest,
  | "bookingDetailIdsToCancel"
  | "roomsToAdd"
  | "roomsToChange"
  | "servicesToAddForExistingRooms"
  | "servicesToCancel"
  | "serviceQuantityUpdates"
>>;

export function describeBookingModification(
  bookingId: string | number,
  request: BookingModificationSummaryInput,
) {
  const roomsToChange = request.roomsToChange ?? [];
  const serviceQuantityChanges = (request.serviceQuantityUpdates ?? []).flatMap(({ services }) => services);
  const summary = {
    addedRooms: request.roomsToAdd?.length ?? 0,
    removedRooms: request.bookingDetailIdsToCancel?.length ?? 0,
    reassignedRooms: roomsToChange.filter(({ newRoomId }) => Boolean(newRoomId)).length,
    changedDates: roomsToChange.filter(({ newCheckInTime, newCheckoutTime }) => Boolean(newCheckInTime || newCheckoutTime)).length,
    changedGuestCounts: roomsToChange.filter(({ numAdults, numChildren, numInfants }) =>
      [numAdults, numChildren, numInfants].some((value) => value !== null && value !== undefined),
    ).length,
    addedServices: (request.servicesToAddForExistingRooms ?? []).reduce(
      (count, room) => count + room.services.length,
      0,
    ) + (request.roomsToAdd ?? []).reduce((count, room) => count + room.serviceRequests.length, 0),
    removedServices: (request.servicesToCancel ?? []).reduce(
      (count, room) => count + room.serviceDetailIds.length,
      0,
    ) + serviceQuantityChanges.filter(({ quantity }) => quantity <= 0).length,
    updatedServices: serviceQuantityChanges.filter(({ quantity }) => quantity > 0).length,
  };

  const vi: string[] = [];
  const en: string[] = [];
  const addChange = (
    count: number,
    viLabel: (count: number) => string,
    enSingular: string,
    enPlural = `${enSingular}s`,
  ) => {
    if (count === 0) return;
    vi.push(viLabel(count));
    en.push(`${count} ${count === 1 ? enSingular : enPlural}`);
  };

  addChange(summary.addedRooms, (count) => `thêm ${count} phòng`, "room added", "rooms added");
  addChange(summary.removedRooms, (count) => `gỡ ${count} phòng`, "room removed", "rooms removed");
  addChange(summary.reassignedRooms, (count) => `chuyển ${count} phòng sang phòng khác`, "room reassigned", "rooms reassigned");
  addChange(summary.changedDates, (count) => `đổi ngày lưu trú của ${count} phòng`, "stay date changed", "stay dates changed");
  addChange(summary.changedGuestCounts, (count) => `cập nhật số khách của ${count} phòng`, "room guest count updated", "room guest counts updated");
  addChange(summary.addedServices, (count) => `thêm ${count} dịch vụ`, "service added", "services added");
  addChange(summary.updatedServices, (count) => `cập nhật số lượng ${count} dịch vụ`, "service quantity updated", "service quantities updated");
  addChange(summary.removedServices, (count) => `gỡ ${count} dịch vụ`, "service removed", "services removed");

  return {
    vi: vi.length > 0
      ? `Booking #${bookingId}: ${vi.join(", ")}.`
      : `Các thông tin của booking #${bookingId} đã được lưu.`,
    en: en.length > 0
      ? `Booking #${bookingId}: ${en.join(", ")}.`
      : `Booking #${bookingId} information has been saved.`,
  };
}
