import { toast } from "@/components/ui/use-toast";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Calendar, RefreshCw, Save, Trash2, UserPlus, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { localizedText } from "../i18n";
import BookingServiceSelector, { type ServiceSelection } from "../components/BookingServiceSelector";
import { useGetAllServicesQuery } from "../services/serviceApi";
import { useGetRoomsByCurrentHotelQuery } from "../services/roomApi";
import { useGetCustomerByIdQuery } from "../services/customerApi";
import {
  useModifyBookingMutation,
  type ManagementBookingModificationRequest,
  type ManagementBookingRoomToAdd,
} from "../services/managementBookingApi";
import type { BookingListItem } from "../services/bookingApi";
import { useAppSelector } from "../store/hooks";

type BookingDetail = Record<string, unknown>;

const isRoomUnavailableForBooking = (room: Record<string, unknown>) =>
  ["MAINTENANCE", "CLEANING"].includes(String(room.roomStatus ?? room.status ?? "").trim().toUpperCase());

const roomIdOf = (detail: BookingDetail) => String(detail.roomId ?? detail.roomID ?? detail.id ?? "");
const detailIdOf = (detail: BookingDetail) => String(
  detail.bookingDetailId
  ?? detail.bookingDetailsId
  ?? detail.bookingDetailID
  ?? detail.detailId
  ?? detail.detailID
  ?? detail.id
  ?? "",
);
const bookingDetailStatusOf = (detail: BookingDetail) => String(
  detail.bookingDetailStatusType
  ?? detail.bookingDetailsStatusType
  ?? detail.bookingDetailStatus
  ?? detail.bookingStatusType
  ?? detail.detailStatus
  ?? detail.status
  ?? "",
).trim().toUpperCase();
const bookingDetailHasCheckedIn = (detail: BookingDetail) => {
  const status = bookingDetailStatusOf(detail);
  const statusIsCheckedIn = ["CHECKED_IN", "CHECKEDIN", "IN_HOUSE", "INHOUSE", "ARRIVED"].includes(status);
  const checkedInFlag = [detail.isCheckedIn, detail.checkedIn, detail.checkInCompleted, detail.hasCheckedIn]
    .some((value) => value === true || String(value).toLowerCase() === "true");
  const actualCheckIn = [detail.actualCheckInTime, detail.actualCheckIn, detail.realCheckInTime, detail.checkInActualTime, detail.checkedInAt]
    .some((value) => value !== undefined && value !== null && value !== false && value !== 0 && String(value).trim() !== "" && String(value).toLowerCase() !== "false");
  return statusIsCheckedIn || checkedInFlag || actualCheckIn;
};
const canModifyBookingDetailRoom = (detail: BookingDetail) => bookingDetailStatusOf(detail) === "PENDING" && !bookingDetailHasCheckedIn(detail);

const serviceDetailIdOf = (service: BookingDetail) => String(
  service.bookingServiceDetailId
  ?? service.serviceDetailId
  ?? service.bookingServiceDetailID
  ?? service.serviceDetailID
  ?? service.id
  ?? service.serviceId
  ?? "",
);

const servicesOf = (detail: BookingDetail) => {
  const services = ([
    detail.bookingServiceResponsesForHotels,
    detail.bookingServiceResponseForHotels,
    detail.bookingServiceDetails,
    detail.serviceRequests,
    detail.serviceResponses,
    detail.services,
  ].find(Array.isArray) ?? []) as BookingDetail[];
  return services.filter((service) => String(service.cancelled).toLowerCase() !== "true");
};

export default function BookingEditWorkspace() {
  const { i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const hotelId = useAppSelector((state) => state.auth.hotelId);
  const employeeId = useAppSelector((state) => state.auth.employeeId);
  const booking = (location.state as { editBooking?: BookingListItem } | null)?.editBooking;
  const bookingStatus = String(booking?.bookingStatus ?? "").trim().toUpperCase();
  const isCheckedOutBooking = bookingStatus === "COMPLETED" || (
    Array.isArray(booking?.bookingDetails)
    && booking.bookingDetails.length > 0
    && booking.bookingDetails
      .filter((detail) => String(detail.bookingDetailStatus ?? detail.bookingStatusType ?? detail.status ?? "").toUpperCase() !== "CANCELLED")
      .every((detail) => String(detail.bookingDetailStatus ?? detail.bookingStatusType ?? detail.status ?? "").toUpperCase() === "CHECKED_OUT")
  );
  const rawBookingCustomer = booking?.customer ?? booking?.customerInfo ?? booking?.guest;
  const bookingCustomer = rawBookingCustomer && typeof rawBookingCustomer === "object" ? rawBookingCustomer as Record<string, unknown> : {};
  const customerId = String(booking?.customerId ?? booking?.customerID ?? booking?.customer_id ?? booking?.idCustomer ?? bookingCustomer.id ?? bookingCustomer.customerId ?? bookingCustomer.customerID ?? bookingCustomer.idCustomer ?? "");
  const { data: customerById, isLoading: isCustomerLoading, isError: isCustomerError } = useGetCustomerByIdQuery(customerId, { skip: !customerId });
  useEffect(() => {
    console.log("[booking-edit] customerId:", customerId);
    console.log("[booking-edit] customer loading:", isCustomerLoading, "error:", isCustomerError);
    console.log("[booking-edit] customer data:", customerById);
  }, [customerId, customerById, isCustomerLoading, isCustomerError]);

  const { data: services = [], isLoading: isServicesLoading, isError: isServicesError } = useGetAllServicesQuery(
    hotelId ? { hotelId: Number(hotelId), activeOnly: true } : { activeOnly: true },
  );
  const { data: hotelRooms = [] } = useGetRoomsByCurrentHotelQuery();
  const [modifyBooking, { isLoading }] = useModifyBookingMutation();
  const saveInFlight = useRef(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // 1. Phục vụ HỦY PHÒNG (bookingDetailIdsToCancel)
  const [cancelledDetailIds, setCancelledDetailIds] = useState<string[]>([]);

  // 2. Phục vụ HỦY DỊCH VỤ LẺ (servicesToCancel: { bookingDetailId, serviceDetailIds })
  const [cancelledServiceDetailIds, setCancelledServiceDetailIds] = useState<Record<string, string[]>>({});

  // 3. Phục vụ ĐỔI PHÒNG (roomsToChange: { bookingDetailId, newRoomId })
  const [roomChanges, setRoomChanges] = useState<Record<string, string>>({});

  // 4. Phục vụ CẬP NHẬT NGÀY LƯU TRÚ qua roomsToChange
  const [dateUpdates, setDateUpdates] = useState<Record<string, { checkIn: string; checkOut: string }>>({});

  // 5. Phục vụ THÊM DỊCH VỤ MỚI CHO PHÒNG HIỆN CÓ (servicesToAddForExistingRooms)
  const [roomServices, setRoomServices] = useState<Record<string, ServiceSelection[]>>({});

  // 6. Phục vụ THÊM PHÒNG MỚI VÀO BOOKING (roomsToAdd)
  const [newRoomsToAdd, setNewRoomsToAdd] = useState<ManagementBookingRoomToAdd[]>([]);
  const [isAddingNewRoom, setIsAddingNewRoom] = useState(false);
  const [selectedNewRoomId, setSelectedNewRoomId] = useState<string>("");
  const [newRoomCheckIn, setNewRoomCheckIn] = useState("");
  const [newRoomCheckOut, setNewRoomCheckOut] = useState("");
  const [newRoomAdults, setNewRoomAdults] = useState(1);
  const [newRoomChildren, setNewRoomChildren] = useState(0);
  const [newRoomInfants, setNewRoomInfants] = useState(0);

  const details = useMemo(
    () => (Array.isArray(booking?.bookingDetails) ? booking.bookingDetails : []) as BookingDetail[],
    [booking],
  );

  const activeDetails = useMemo(
    () => details.filter((detail) => !cancelledDetailIds.includes(detailIdOf(detail))),
    [details, cancelledDetailIds],
  );

  const editRooms = useMemo(() => activeDetails.map((detail, index) => {
    const databaseId = roomIdOf(detail);
    return {
      id: String(databaseId || detail.roomNumber || `room-${index + 1}`),
      databaseId,
      type: String(detail.roomType ?? detail.roomName ?? "Phòng booking"),
      guests: Number(detail.numAdults ?? detail.adults ?? 1) + Number(detail.numChildren ?? detail.children ?? 0) + Number(detail.numInfants ?? detail.infants ?? 0),
      price: Number(detail.baseRoomPricePerNight ?? detail.roomPrice ?? detail.price ?? 0),
    };
  }), [activeDetails]);

  const editableServiceRooms = useMemo(
    () => editRooms.filter((_, index) => canModifyBookingDetailRoom(activeDetails[index])),
    [editRooms, activeDetails],
  );

  const initialServices = useMemo(() => Object.fromEntries(details.flatMap((detail) => {
    const roomId = roomIdOf(detail);
    const detailId = detailIdOf(detail);
    const rawServices = servicesOf(detail);
    const groupedMap = new Map<string, ServiceSelection>();

    rawServices.forEach((service) => {
      const sId = String(service.serviceId ?? service.serviceID ?? service.id ?? "");
      if (!sId) return;
      const qty = Number(service.quantity ?? service.amount ?? 1);
      const dId = serviceDetailIdOf(service);
      const rawPrice = service.price ?? service.unitPrice;
      const price = rawPrice == null ? undefined : Number(rawPrice);
      const name = String(service.name ?? service.serviceName ?? service.nameService ?? service.service_name ?? "");

      const existing = groupedMap.get(sId);
      if (existing) {
        existing.quantity += qty;
        existing.originalQuantity = (existing.originalQuantity ?? 0) + qty;
      } else {
        groupedMap.set(sId, {
          serviceId: sId,
          quantity: qty,
          originalQuantity: qty,
          detailId: dId,
          name,
          price,
          usedAt: service.usedAt == null ? undefined : String(service.usedAt),
          isExisting: true,
          applyToRoom: false,
        });
      }
    });

    const selections = Array.from(groupedMap.values());
    return [
      [String(roomId), selections],
      [String(detailId), selections],
    ];
  })), [details]);

  useEffect(() => {
    if (Object.keys(roomServices).length === 0 && Object.keys(initialServices).length > 0) {
      setRoomServices(initialServices);
    }
  }, [initialServices, roomServices]);

  const ranges = useMemo(() => Object.fromEntries(details.map((detail) => {
    const roomId = roomIdOf(detail);
    const detailId = detailIdOf(detail);
    const updated = dateUpdates[detailId];
    return [String(roomId), {
      checkIn: updated?.checkIn ?? String(detail.checkInTime ?? "").slice(0, 10),
      checkOut: updated?.checkOut ?? String(detail.checkOutTime ?? "").slice(0, 10),
    }];
  })), [details, dateUpdates]);

  const handleToggleCancelRoom = (detailId: string) => {
    setCancelledDetailIds((prev) =>
      prev.includes(detailId) ? prev.filter((id) => id !== detailId) : [...prev, detailId],
    );
  };

  const handleToggleCancelService = (bookingDetailId: string, serviceDetailId: string) => {
    setCancelledServiceDetailIds((prev) => {
      const currentList = prev[bookingDetailId] ?? [];
      const newList = currentList.includes(serviceDetailId)
        ? currentList.filter((id) => id !== serviceDetailId)
        : [...currentList, serviceDetailId];
      return { ...prev, [bookingDetailId]: newList };
    });
  };

  const handleRoomChange = (bookingDetailId: string, newRoomId: string) => {
    setRoomChanges((prev) => ({ ...prev, [bookingDetailId]: newRoomId }));
  };

  const handleDateChange = (bookingDetailId: string, field: "checkIn" | "checkOut", value: string) => {
    setDateUpdates((prev) => {
      const existing = prev[bookingDetailId] ?? { checkIn: "", checkOut: "" };
      return {
        ...prev,
        [bookingDetailId]: {
          ...existing,
          [field]: value,
        },
      };
    });
  };

  const handleAddNewRoom = () => {
    if (!selectedNewRoomId || !newRoomCheckIn || !newRoomCheckOut) {
      setError(localizedText("Vui lòng chọn phòng, ngày check-in và ngày check-out cho phòng mới.", "Select a room, check-in date, and check-out date for the new room."));
      return;
    }
    const selectedRoom = hotelRooms.find((room) => String(room.id ?? room.roomId ?? "") === selectedNewRoomId);
    if (selectedRoom && isRoomUnavailableForBooking(selectedRoom)) {
      setError(localizedText("Phòng đang bảo trì hoặc dọn dẹp nên không thể đặt.", "This room is under maintenance or being cleaned and cannot be booked."));
      return;
    }
    const newRoom: ManagementBookingRoomToAdd = {
      roomId: selectedNewRoomId,
      checkInTime: `${newRoomCheckIn}T14:00:00`,
      checkOutTime: `${newRoomCheckOut}T12:00:00`,
      numAdults: newRoomAdults,
      numChildren: newRoomChildren,
      numInfants: newRoomInfants,
      serviceRequests: [],
    };
    setNewRoomsToAdd((prev) => [...prev, newRoom]);
    setSelectedNewRoomId("");
    setIsAddingNewRoom(false);
    setError("");
  };

  const handleRemoveNewRoom = (index: number) => {
    setNewRoomsToAdd((prev) => prev.filter((_, i) => i !== index));
  };

  const [showDebugJson, setShowDebugJson] = useState(false);

  const currentPayload = useMemo<ManagementBookingModificationRequest>(() => {
    const currentEmployeeId = String(employeeId ?? localStorage.getItem("id") ?? localStorage.getItem("employeeId") ?? "");

    const roomUpdatesByDetailId = new Map<string, ManagementBookingModificationRequest["roomsToChange"][number]>();
    Object.entries(roomChanges)
      .filter(([detailIdStr, newRoomId]) => {
        const detail = details.find((item) => detailIdOf(item) === detailIdStr);
        return Boolean(newRoomId) && !cancelledDetailIds.includes(detailIdStr)
          && detail !== undefined && canModifyBookingDetailRoom(detail);
      })
      .forEach(([bookingDetailId, newRoomId]) => {
        roomUpdatesByDetailId.set(bookingDetailId, {
          bookingDetailId,
          newRoomId,
          newCheckInTime: null,
          newCheckoutTime: null,
          numAdults: null,
          numChildren: null,
          numInfants: null,
        });
      });

    Object.entries(dateUpdates)
      .filter(([detailIdStr, dates]) => Boolean(dates.checkIn || dates.checkOut) && !cancelledDetailIds.includes(detailIdStr))
      .flatMap(([detailIdStr, dates]) => {
        const detailId = detailIdStr;
        const detail = details.find((d) => detailIdOf(d) === detailId);
        if (!detail || !canModifyBookingDetailRoom(detail)) return [];
        const originalCheckIn = String(detail?.checkInTime ?? "").slice(0, 10);
        const originalCheckOut = String(detail?.checkOutTime ?? "").slice(0, 10);
        return [{
          bookingDetailId: detailId,
          newCheckInTime: dates.checkIn && dates.checkIn !== originalCheckIn ? `${dates.checkIn}T14:00:00` : null,
          newCheckoutTime: dates.checkOut && dates.checkOut !== originalCheckOut ? `${dates.checkOut}T12:00:00` : null,
          numAdults: null,
          numChildren: null,
          numInfants: null,
        }];
      })
      .forEach((dateUpdate) => {
        if (!dateUpdate.newCheckInTime && !dateUpdate.newCheckoutTime) return;
        const existing = roomUpdatesByDetailId.get(dateUpdate.bookingDetailId);
        roomUpdatesByDetailId.set(dateUpdate.bookingDetailId, {
          bookingDetailId: dateUpdate.bookingDetailId,
          newRoomId: existing?.newRoomId ?? null,
          newCheckInTime: dateUpdate.newCheckInTime ?? existing?.newCheckInTime ?? null,
          newCheckoutTime: dateUpdate.newCheckoutTime ?? existing?.newCheckoutTime ?? null,
          numAdults: existing?.numAdults ?? null,
          numChildren: existing?.numChildren ?? null,
          numInfants: existing?.numInfants ?? null,
        });
      });

    const roomsToChangeFormatted = Array.from(roomUpdatesByDetailId.values());

    const servicesToAddForExistingRoomsFormatted: { bookingDetailId: string; services: any[] }[] = [];
    const serviceQuantityUpdatesFormatted: { bookingDetailId: string; services: { serviceId: string; quantity: number }[] }[] = [];
    const servicesToCancelMap: Record<string, string[]> = { ...cancelledServiceDetailIds };

    editRooms.forEach((room, index) => {
      const detail = activeDetails[index];
      const bookingDetailId = detailIdOf(detail);
      if (!bookingDetailId || !canModifyBookingDetailRoom(detail)) return;

      const currentSelections = roomServices[room.id] ?? roomServices[String(room.databaseId)] ?? [];
      const origSelections = initialServices[room.id] ?? initialServices[String(room.databaseId)] ?? initialServices[String(roomIdOf(detail))] ?? [];

      const additionsForRoom: any[] = [];
      const quantityUpdatesForRoom: { serviceId: string; quantity: number }[] = [];

      currentSelections.forEach((curr) => {
        const serviceId = String(curr.serviceId ?? "").trim();
        if (!serviceId || curr.quantity <= 0) return;

        const orig = origSelections.find((o) => String(o.serviceId) === String(curr.serviceId));
        const currentQty = Number(curr.quantity) || 0;
        const origQty = orig ? Number(orig.originalQuantity ?? orig.quantity ?? 0) : 0;

        if (origQty === 0) {
          const serviceObj = services.find((item) => String(item.id) === curr.serviceId);
          additionsForRoom.push({
            serviceId,
            quantity: currentQty,
            name: curr.name ?? serviceObj?.name,
            price: curr.price ?? serviceObj?.price,
          });
        } else if (currentQty > origQty) {
          const extraQty = currentQty - origQty;
          const serviceObj = services.find((item) => String(item.id) === curr.serviceId);
          additionsForRoom.push({
            serviceId,
            quantity: extraQty,
            name: curr.name ?? serviceObj?.name,
            price: curr.price ?? serviceObj?.price,
          });
        } else if (currentQty < origQty) {
          quantityUpdatesForRoom.push({
            serviceId,
            quantity: currentQty,
          });
        }
      });

      origSelections.forEach((orig) => {
        const serviceId = String(orig.serviceId ?? "").trim();
        if (!serviceId) return;
        const origQty = Number(orig.originalQuantity ?? orig.quantity ?? 0);
        if (origQty <= 0) return;

        const curr = currentSelections.find((c) => String(c.serviceId) === String(orig.serviceId));
        const currentQty = curr ? Number(curr.quantity) || 0 : 0;

        if (currentQty === 0) {
          if (!quantityUpdatesForRoom.some((q) => q.serviceId === serviceId)) {
            quantityUpdatesForRoom.push({
              serviceId,
              quantity: 0,
            });
          }
        }
      });

      if (additionsForRoom.length > 0) {
        servicesToAddForExistingRoomsFormatted.push({ bookingDetailId, services: additionsForRoom });
      }
      if (quantityUpdatesForRoom.length > 0) {
        serviceQuantityUpdatesFormatted.push({ bookingDetailId, services: quantityUpdatesForRoom });
      }
    });

    const servicesToCancelFormatted = Object.entries(servicesToCancelMap)
      .filter(([detailId, serviceIds]) => serviceIds.length > 0
        && details.some((detail) => detailIdOf(detail) === detailId && canModifyBookingDetailRoom(detail)))
      .map(([detailIdStr, serviceDetailIds]) => ({
        bookingDetailId: detailIdStr,
        serviceDetailIds,
      }));

    return {
      employeeId: currentEmployeeId,
      bookingDetailIdsToCancel: cancelledDetailIds,
      servicesToCancel: servicesToCancelFormatted,
      roomsToAdd: newRoomsToAdd,
      roomsToChange: roomsToChangeFormatted,
      servicesToAddForExistingRooms: servicesToAddForExistingRoomsFormatted,
      serviceQuantityUpdates: serviceQuantityUpdatesFormatted,
    };
  }, [
    employeeId,
    cancelledServiceDetailIds,
    roomChanges,
    cancelledDetailIds,
    dateUpdates,
    details,
    editRooms,
    activeDetails,
    roomServices,
    services,
    newRoomsToAdd,
  ]);

  const handleSave = async () => {
    if (saveInFlight.current) return;
    console.log("==========================================");
    console.log("===> [handleSave TRIGGERED]");
    console.log("===> Booking ID:", booking?.bookingId ?? booking?.orderId);
    console.log("===> Current Payload Sent to BE:", JSON.stringify(currentPayload, null, 2));
    console.log("==========================================");

    setError("");
    const bookingId = booking?.bookingId ?? booking?.orderId;
    if (bookingId === undefined) {
      console.error("Cannot find booking ID (bookingId is undefined).");
      return setError(localizedText("Không tìm thấy mã booking.", "Booking ID was not found."));
    }

    saveInFlight.current = true;
    try {
      console.log(`===> Calling modifyBooking mutation: PUT /management-bookings/${bookingId}/modify ...`);
      const res = await modifyBooking({ bookingId, request: currentPayload }).unwrap();
      console.log("===> [MODIFY BOOKING BE RESPONSE SUCCESS]:", res);
      toast({
        variant: "default",
        title: localizedText("Cập nhật booking thành công!", "Booking updated successfully!"),
        description: localizedText(
          `Đã lưu các chỉnh sửa phòng và dịch vụ cho booking ${bookingId}.`,
          `Room and service changes for booking ${bookingId} have been saved.`,
        ),
      });
      setSuccess(true);
    } catch (requestError) {
      console.error("===> [MODIFY BOOKING BE ERROR]:", requestError);
      const responseError = requestError as { data?: { message?: string; error?: string }; error?: string };
      const errorMessage = responseError.data?.message ?? responseError.data?.error ?? responseError.error ?? localizedText("Không thể cập nhật booking.", "Could not update booking.");
      toast({
        variant: "destructive",
        title: localizedText("Cập nhật booking thất bại", "Booking update failed"),
        description: errorMessage,
      });
      setError(errorMessage);
    } finally {
      saveInFlight.current = false;
    }
  };

  if (!booking) {
    return <section className="mt-6 rounded-2xl border border-rose-200 bg-white p-6 text-sm text-rose-600">{localizedText("Không tìm thấy booking cần chỉnh sửa.", "Booking to edit was not found.")}</section>;
  }

  if (isCheckedOutBooking) {
    return (
      <section className="mt-6 rounded-2xl border border-amber-200 bg-white p-6">
        <h2 className="font-bold text-amber-800">{localizedText("Booking đã checkout hoàn tất", "Booking checkout is complete")}</h2>
        <p className="mt-2 text-sm text-slate-600">{localizedText("Booking đã checkout không thể chỉnh sửa.", "Checked-out bookings cannot be edited.")}</p>
        <button
          type="button"
          onClick={() => navigate("/booking-list")}
          className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          {localizedText("Quay lại danh sách booking", "Back to booking list")}
        </button>
      </section>
    );
  }

  if (success) {
    return (
      <section className="mt-6 rounded-2xl border border-emerald-200 bg-white p-8 text-center">
        <h2 className="text-lg font-bold text-emerald-700">{localizedText("Cập nhật booking", "Booking updated")} {booking.bookingId ?? booking.orderId} {localizedText("thành công", "successfully")}</h2>
        <p className="mt-2 text-sm text-slate-600">{localizedText("Mọi thay đổi phòng, dịch vụ và thời gian lưu trú đã được lưu vào hệ thống.", "All room, service, and stay-date changes have been saved.")}</p>
        <button
          type="button"
          onClick={() => navigate("/booking-list")}
          className="mt-5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          {localizedText("Quay lại danh sách booking", "Back to booking list")}
        </button>
      </section>
    );
  }

  const displayCustomerName = customerById?.name ?? String(booking.customerName ?? booking.nameCustomer ?? bookingCustomer.name ?? bookingCustomer.fullName ?? "");
  const displayCustomerPhone = customerById?.phone ?? String(booking.customerPhone ?? booking.phone ?? booking.phoneNumber ?? bookingCustomer.phone ?? bookingCustomer.phoneNumber ?? bookingCustomer.customerPhone ?? "");
  const displayCustomerIdentity = customerById?.identityNumber ?? String(booking.customerIdentityNumber ?? booking.identityNumber ?? booking.identityCard ?? bookingCustomer.identityNumber ?? bookingCustomer.identityCard ?? bookingCustomer.identityCardNumber ?? bookingCustomer.citizenId ?? bookingCustomer.cccd ?? "");
  const bookingDetailsForDiscount = Array.isArray(booking.bookingDetails) ? booking.bookingDetails : [];
  const readAmount = (item: Record<string, unknown>, keys: string[]) => {
    const value = keys.map((key) => item[key]).find((candidate) => candidate !== undefined && candidate !== null && candidate !== "");
    if (value === undefined) return undefined;
    const amount = Number(value);
    return Number.isFinite(amount) ? amount : undefined;
  };
  const sumDetailAmounts = (keys: string[]) => bookingDetailsForDiscount.reduce((total, detail) => total + (readAmount(detail, keys) ?? 0), 0);
  const discountRoomAmount = Math.max(
    readAmount(booking, ["discountRoomAmount", "roomDiscountAmount"]) ?? 0,
    sumDetailAmounts(["discountRoomAmount", "roomDiscountAmount"]),
  );
  const discountServiceAmount = Math.max(
    readAmount(booking, ["discountServiceAmount", "serviceDiscountAmount"]) ?? 0,
    sumDetailAmounts(["discountServiceAmount", "serviceDiscountAmount"]),
  );
  const discountTotal = Math.max(
    readAmount(booking, ["discountAmountTotal", "discountTotal", "totalDiscountAmount"]) ?? 0,
    sumDetailAmounts(["discountAmountTotal", "discountTotal", "totalDiscountAmount"]),
    discountRoomAmount + discountServiceAmount,
  );
  const rawPromotion = booking.promotion ?? booking.promotionInfo ?? booking.customerPromotion ?? booking.appliedPromotion;
  const promotion = rawPromotion && typeof rawPromotion === "object" ? rawPromotion as Record<string, unknown> : {};
  const promotionName = String(booking.promotionName ?? booking.customerPromotionName ?? promotion.name ?? "");
  const promotionCode = String(booking.promotionCode ?? booking.customerPromotionCode ?? promotion.code ?? "");

  return (
    <section className="mt-6 space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">{localizedText("Chỉnh sửa booking", "Edit booking")} {booking.bookingId ?? booking.orderId}</h2>
            <p className="mt-1 text-sm text-slate-500">
              {localizedText("Quản lý đổi phòng, cập nhật thời gian, thêm/hủy phòng và dịch vụ cho đơn đặt phòng.", "Manage room changes, stay dates, and rooms or services added to or removed from this booking.")}
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate("/booking-list")}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <ArrowLeft size={16} /> {localizedText("Quay lại", "Back")}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <h3 className="text-base font-bold text-slate-900">{localizedText("Thông tin khách hàng", "Customer information")}</h3>
        <p className="mt-1 text-xs text-slate-500">{localizedText("Mã khách hàng", "Customer ID")}: {customerId || localizedText("Chưa có", "Not available")}</p>
        {isCustomerError && <p className="mt-2 text-xs text-rose-600">{localizedText("Không lấy được thông tin khách hàng từ hệ thống.", "Could not load customer information.")}</p>}
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <label className="text-sm font-semibold text-slate-700">
            {localizedText("Họ và tên", "Full name")}
            <input readOnly value={isCustomerLoading ? localizedText("Đang tải...", "Loading...") : displayCustomerName} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-normal text-slate-700 outline-none" />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            {localizedText("Số điện thoại", "Phone number")}
            <input readOnly value={isCustomerLoading ? localizedText("Đang tải...", "Loading...") : displayCustomerPhone} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-normal text-slate-700 outline-none" />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            {localizedText("Căn cước công dân", "National ID")}
            <input readOnly value={isCustomerLoading ? localizedText("Đang tải...", "Loading...") : displayCustomerIdentity} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-normal text-slate-700 outline-none" />
          </label>
        </div>
      </div>

      <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-5 shadow-sm">
        <h3 className="text-base font-bold text-slate-900">{localizedText("Khuyến mãi và giảm giá hiện tại", "Current promotions and discounts")}</h3>
        <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs text-slate-500">{localizedText("Khuyến mãi", "Promotion")}</p>
            <p className="mt-0.5 font-semibold text-slate-900">{promotionName || localizedText("Không có thông tin", "Not available")}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">{localizedText("Mã khuyến mãi", "Promotion code")}</p>
            <p className="mt-0.5 font-semibold text-slate-900">{promotionCode || localizedText("Không có thông tin", "Not available")}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">{localizedText("Tổng giảm giá phòng", "Total room discount")}</p>
            <p className="mt-0.5 font-semibold text-rose-700">{discountRoomAmount.toLocaleString(i18n.language.startsWith("en") ? "en-US" : "vi-VN")}{i18n.language.startsWith("en") ? " VND" : "đ"}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">{localizedText("Tổng giảm giá dịch vụ", "Total service discount")}</p>
            <p className="mt-0.5 font-semibold text-rose-700">{discountServiceAmount.toLocaleString(i18n.language.startsWith("en") ? "en-US" : "vi-VN")}{i18n.language.startsWith("en") ? " VND" : "đ"}</p>
          </div>
          <div className="sm:col-span-2 lg:col-span-4">
            <p className="text-xs text-slate-500">{localizedText("Tổng tiền giảm giá", "Total discount")}</p>
            <p className="mt-0.5 text-base font-bold text-rose-700">{discountTotal.toLocaleString(i18n.language.startsWith("en") ? "en-US" : "vi-VN")}{i18n.language.startsWith("en") ? " VND" : "đ"}</p>
          </div>
        </div>
      </div>

      {/* 1. Phân đoạn danh sách phòng hiện có trong booking */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <h3 className="text-base font-bold text-slate-900">{localizedText("1. Các phòng hiện có trong Booking", "1. Rooms in this booking")}</h3>
        <div className="mt-4 space-y-4">
          {details.map((detail, index) => {
            const detailId = detailIdOf(detail);
            const rId = roomIdOf(detail);
            const isCancelled = cancelledDetailIds.includes(detailId);
            const existingServicesList = servicesOf(detail);
            const cancelledServiceIdsForThisDetail = cancelledServiceDetailIds[detailId] ?? [];
            const currentDateUpdate = dateUpdates[detailId] ?? {
              checkIn: String(detail.checkInTime ?? "").slice(0, 10),
              checkOut: String(detail.checkOutTime ?? "").slice(0, 10),
            };

            return (
              <div
                key={detailId || index}
                className={`rounded-xl border p-4 transition-all ${
                  isCancelled
                    ? "border-rose-200 bg-rose-50/40 opacity-75"
                    : "border-slate-200 bg-slate-50/50 hover:border-slate-300"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/60 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">
                      {localizedText("Phòng", "Room")} #{String(rId || detail.roomNumber || index + 1)} ({String(detail.roomType ?? detail.roomName ?? localizedText("Phòng", "Room"))})
                    </span>
                    {isCancelled && (
                      <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-700">
                        {localizedText("Đã đánh dấu Hủy", "Marked for cancellation")}
                      </span>
                    )}
                    {!canModifyBookingDetailRoom(detail) && (
                      <span className="text-xs font-medium text-slate-500">
                        {localizedText("Chỉ phòng đang chờ nhận phòng mới có thể chỉnh sửa.", "Only rooms pending check-in can be modified.")}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    disabled={!canModifyBookingDetailRoom(detail)}
                    onClick={() => { if (canModifyBookingDetailRoom(detail)) handleToggleCancelRoom(detailId); }}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                      isCancelled
                        ? "bg-slate-200 text-slate-700 hover:bg-slate-300"
                        : "bg-rose-100 text-rose-700 hover:bg-rose-200"
                    } disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    {isCancelled ? <RefreshCw size={14} /> : <Trash2 size={14} />}
                    {isCancelled ? localizedText("Khôi phục phòng", "Restore room") : localizedText("Hủy phòng này", "Cancel this room")}
                  </button>
                </div>

                {!isCancelled && (
                  <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {/* Đổi ngày check-in / check-out */}
                    <div className="rounded-lg bg-white p-3 border border-slate-200">
                      <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                        <Calendar size={14} className="text-blue-600" /> {localizedText("Ngày nhận / trả phòng:", "Check-in / check-out dates:")}
                      </label>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-[11px] text-slate-500">Check-in</span>
                          <input
                            type="date"
                            value={currentDateUpdate.checkIn}
                            disabled={!canModifyBookingDetailRoom(detail)}
                            onChange={(e) => handleDateChange(detailId, "checkIn", e.target.value)}
                            className="mt-0.5 w-full rounded-md border border-slate-300 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                          />
                        </div>
                        <div>
                          <span className="text-[11px] text-slate-500">Check-out</span>
                          <input
                            type="date"
                            value={currentDateUpdate.checkOut}
                            disabled={!canModifyBookingDetailRoom(detail)}
                            onChange={(e) => handleDateChange(detailId, "checkOut", e.target.value)}
                            className="mt-0.5 w-full rounded-md border border-slate-300 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Đổi phòng */}
                    <div className="rounded-lg bg-white p-3 border border-slate-200">
                      <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                        <RefreshCw size={14} className="text-amber-600" /> {localizedText("Đổi sang phòng khác:", "Change to another room:")}
                      </label>
                      <select
                        value={roomChanges[detailId] ?? rId}
                        disabled={!canModifyBookingDetailRoom(detail)}
                        onChange={(e) => handleRoomChange(detailId, String(e.target.value))}
                        className="mt-2 w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                      >
                        <option value={rId}>{localizedText("Giữ phòng hiện tại", "Keep current room")} (#{rId})</option>
                        {hotelRooms
                          .filter((hr) => !isRoomUnavailableForBooking(hr))
                          .filter((hr) => String(hr.id ?? hr.roomId) !== String(rId))
                          .map((hr) => {
                            const hrId = String(hr.id ?? hr.roomId ?? "");
                            return (
                              <option key={hrId} value={hrId}>
                                {localizedText("Phòng", "Room")} #{hr.roomNumber ?? hrId} - {String(hr.roomType ?? hr.type ?? localizedText("Phòng", "Room"))} ({Number(hr.basePrice ?? hr.price ?? 0).toLocaleString(i18n.language.startsWith("en") ? "en-US" : "vi-VN")}{i18n.language.startsWith("en") ? " VND" : "đ"})
                              </option>
                            );
                          })}
                      </select>
                    </div>

                    {/* Dịch vụ lẻ đã đặt của phòng */}
                    <div className="rounded-lg bg-white p-3 border border-slate-200 sm:col-span-2 lg:col-span-1">
                      <label className="text-xs font-bold text-slate-700">{localizedText("Dịch vụ đã đặt:", "Booked services:")}</label>
                      {existingServicesList.length === 0 ? (
                        <p className="mt-1 text-xs text-slate-400">{localizedText("Chưa có dịch vụ lẻ nào.", "No individual services booked.")}</p>
                      ) : (
                        <div className="mt-2 space-y-1.5 max-h-28 overflow-y-auto pr-1">
                          {existingServicesList.map((srv, sIdx) => {
                            const sDetailId = serviceDetailIdOf(srv);
                            const isSrvCancelled = cancelledServiceIdsForThisDetail.includes(sDetailId);
                            const srvName = String(srv.name ?? srv.serviceName ?? srv.nameService ?? `Dịch vụ #${sIdx + 1}`);

                            return (
                              <div
                                key={sDetailId || sIdx}
                                className={`flex items-center justify-between text-xs rounded px-2 py-1 ${
                                  isSrvCancelled ? "bg-rose-50 text-rose-500 line-through" : "bg-slate-100 text-slate-700"
                                }`}
                              >
                                <span>{srvName} (x{Number(srv.quantity ?? 1)})</span>
                                <button
                                  type="button"
                                  disabled={!canModifyBookingDetailRoom(detail)}
                                  onClick={() => handleToggleCancelService(detailId, sDetailId)}
                                  className="text-slate-400 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40"
                                  title={isSrvCancelled ? localizedText("Khôi phục dịch vụ", "Restore service") : localizedText("Hủy dịch vụ này", "Cancel this service")}
                                >
                                  {isSrvCancelled ? <RefreshCw size={12} /> : <X size={12} />}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Thêm phòng mới vào Booking (roomsToAdd) */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900">{localizedText("2. Thêm phòng mới vào đơn đặt", "2. Add a room to the booking")}</h3>
          {!isAddingNewRoom && (
            <button
              type="button"
              onClick={() => setIsAddingNewRoom(true)}
              className="flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-600 hover:bg-blue-100"
            >
              <UserPlus size={14} /> {localizedText("Thêm phòng mới", "Add room")}
            </button>
          )}
        </div>

        {/* Form thêm phòng mới */}
        {isAddingNewRoom && (
          <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50/40 p-4">
            <h4 className="text-xs font-bold text-blue-900 uppercase tracking-wide">{localizedText("Nhập thông tin phòng mới", "Enter new room details")}</h4>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="text-xs font-semibold text-slate-700">{localizedText("Chọn phòng:", "Select room:")}</label>
                <select
                  value={selectedNewRoomId}
                  onChange={(e) => setSelectedNewRoomId(String(e.target.value))}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
                >
                  <option value="">-- {localizedText("Chọn phòng", "Select room")} --</option>
                  {hotelRooms.filter((hr) => !isRoomUnavailableForBooking(hr)).map((hr) => {
                    const hrId = String(hr.id ?? hr.roomId ?? "");
                    return (
                      <option key={hrId} value={hrId}>
                        {localizedText("Phòng", "Room")} #{hr.roomNumber ?? hrId} - {String(hr.roomType ?? hr.type ?? localizedText("Phòng", "Room"))} ({Number(hr.basePrice ?? hr.price ?? 0).toLocaleString(i18n.language.startsWith("en") ? "en-US" : "vi-VN")}{i18n.language.startsWith("en") ? " VND" : "đ"})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Check-in:</label>
                <input
                  type="date"
                  value={newRoomCheckIn}
                  onChange={(e) => setNewRoomCheckIn(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Check-out:</label>
                <input
                  type="date"
                  value={newRoomCheckOut}
                  onChange={(e) => setNewRoomCheckOut(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">{localizedText("Người lớn:", "Adults:")}</label>
                <input
                  type="number"
                  min={1}
                  value={newRoomAdults}
                  onChange={(e) => setNewRoomAdults(Number(e.target.value))}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">{localizedText("Trẻ em:", "Children:")}</label>
                <input
                  type="number"
                  min={0}
                  value={newRoomChildren}
                  onChange={(e) => setNewRoomChildren(Number(e.target.value))}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">{localizedText("Em bé:", "Infants:")}</label>
                <input
                  type="number"
                  min={0}
                  value={newRoomInfants}
                  onChange={(e) => setNewRoomInfants(Number(e.target.value))}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsAddingNewRoom(false)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                {localizedText("Hủy", "Cancel")}
              </button>
              <button
                type="button"
                onClick={handleAddNewRoom}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
              >
                {localizedText("Xác nhận thêm phòng", "Confirm room addition")}
              </button>
            </div>
          </div>
        )}

        {/* Danh sách các phòng mới đã chọn thêm */}
        {newRoomsToAdd.length > 0 && (
          <div className="mt-4 space-y-2">
            {newRoomsToAdd.map((room, idx) => (
              <div key={idx} className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 text-xs">
                <div>
                  <span className="font-bold text-emerald-900">{localizedText("Phòng bổ sung", "Added room")} #{room.roomId}</span>
                  <span className="ml-2 text-slate-600">
                    ({room.checkInTime.slice(0, 10)} ➔ {room.checkOutTime.slice(0, 10)})
                  </span>
                  <span className="ml-2 text-slate-500">
                    | {localizedText("Khách", "Guests")}: {room.numAdults} {localizedText("người lớn", "adults")}, {room.numChildren} {localizedText("trẻ em", "children")}, {room.numInfants} {localizedText("em bé", "infants")}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveNewRoom(idx)}
                  className="text-rose-600 hover:text-rose-800"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3. Thêm dịch vụ mới cho phòng đang active */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <h3 className="text-base font-bold text-slate-900">{localizedText("3. Thêm dịch vụ phát sinh cho các phòng đang chọn", "3. Add services to selected rooms")}</h3>
        <p className="mt-1 text-xs text-slate-500">{localizedText("Chọn dịch vụ mới bổ sung cho các phòng còn hoạt động trong booking.", "Select additional services for active rooms in this booking.")}</p>
        <div className="mt-4">
          <BookingServiceSelector
            rooms={editableServiceRooms}
            services={services}
            servicesLoading={isServicesLoading}
            servicesError={isServicesError}
            serviceMode="per-room"
            setServiceMode={() => undefined}
            allRoomServices={[]}
            setAllRoomServices={() => undefined}
            roomServices={Object.keys(roomServices).length > 0 ? roomServices : initialServices}
            setRoomServices={setRoomServices}
            roomRanges={ranges}
            fallbackRange={{ checkIn: "", checkOut: "" }}
            language={i18n.language.startsWith("en") ? "en" : "vi"}
            nightsForRoom={() => 1}
            onContinue={() => void handleSave()}
            onSkip={() => void handleSave()}
            isSubmitting={isLoading}
            submittingLabel={localizedText("Đang cập nhật...", "Updating...")}
            continueLabel={isLoading ? localizedText("Đang cập nhật...", "Updating...") : localizedText("Cập nhật", "Update")}
            skipLabel={localizedText("Cập nhật", "Update")}
          />
        </div>
      </div>

      {/* Thông báo lỗi & nút lưu */}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-600">
          {error}
        </div>
      )}

      {showDebugJson && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-emerald-400">
          <div className="flex items-center justify-between pb-2 border-b border-slate-700">
            <span className="text-xs font-mono font-bold text-slate-300">Payload JSON ({localizedText("Gửi xuống BE", "Sent to backend")} /management-bookings/{booking.bookingId ?? booking.orderId}/modify)</span>
            <button
              type="button"
              onClick={() => setShowDebugJson(false)}
              className="text-xs text-slate-400 hover:text-white"
            >
              {localizedText("Đóng", "Close")}
            </button>
          </div>
          <pre className="mt-3 max-h-60 overflow-y-auto overflow-x-auto text-xs font-mono leading-relaxed">
            {JSON.stringify(currentPayload, null, 2)}
          </pre>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
        <button
          type="button"
          onClick={() => setShowDebugJson(!showDebugJson)}
          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-mono font-semibold text-slate-700 hover:bg-slate-100"
        >
          {showDebugJson ? localizedText("Ẩn Debug JSON", "Hide debug JSON") : localizedText("🔍 Xem Debug JSON Payload", "🔍 View debug JSON payload")}
        </button>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/booking-list")}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            {localizedText("Hủy bỏ", "Cancel")}
          </button>
          <button
            type="button"
            disabled={isLoading}
            onClick={() => void handleSave()}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
          >
            <Save size={16} />
            {isLoading ? localizedText("Đang lưu thay đổi...", "Saving changes...") : localizedText("Lưu tất cả thay đổi", "Save all changes")}
          </button>
        </div>
      </div>
    </section>
  );
}
