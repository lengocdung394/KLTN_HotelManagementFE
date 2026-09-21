import { toast } from "@/components/ui/use-toast";
import { useMemo, useState } from "react";
import { ArrowLeft, Calendar, RefreshCw, Save, Trash2, UserPlus, X } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import BookingServiceSelector, { type ServiceSelection } from "../components/BookingServiceSelector";
import { useGetAllServicesQuery } from "../services/serviceApi";
import { useGetRoomsByCurrentHotelQuery } from "../services/roomApi";
import {
  useModifyBookingMutation,
  type ManagementBookingModificationRequest,
  type ManagementBookingRoomToAdd,
} from "../services/managementBookingApi";
import type { BookingListItem } from "../services/bookingApi";
import { useAppSelector } from "../store/hooks";

type BookingDetail = Record<string, unknown>;

const roomIdOf = (detail: BookingDetail) => Number(detail.roomId ?? detail.roomID ?? detail.id);
const detailIdOf = (detail: BookingDetail) => Number(
  detail.bookingDetailId
  ?? detail.bookingDetailsId
  ?? detail.bookingDetailID
  ?? detail.detailId
  ?? detail.detailID
  ?? detail.id,
);

const serviceDetailIdOf = (service: BookingDetail) => Number(
  service.bookingServiceDetailId
  ?? service.serviceDetailId
  ?? service.bookingServiceDetailID
  ?? service.serviceDetailID
  ?? service.id
  ?? service.serviceId,
);

const servicesOf = (detail: BookingDetail) => ([
  detail.bookingServiceResponsesForHotels,
  detail.bookingServiceResponseForHotels,
  detail.bookingServiceDetails,
  detail.serviceRequests,
  detail.serviceResponses,
  detail.services,
].find(Array.isArray) ?? []) as BookingDetail[];

export default function BookingEditWorkspace() {
  const location = useLocation();
  const navigate = useNavigate();
  const hotelId = useAppSelector((state) => state.auth.hotelId);
  const employeeId = useAppSelector((state) => state.auth.employeeId);
  const booking = (location.state as { editBooking?: BookingListItem } | null)?.editBooking;

  const { data: services = [], isLoading: isServicesLoading, isError: isServicesError } = useGetAllServicesQuery(
    hotelId ? { hotelId: Number(hotelId), activeOnly: true } : { activeOnly: true },
  );
  const { data: hotelRooms = [] } = useGetRoomsByCurrentHotelQuery();
  const [modifyBooking, { isLoading }] = useModifyBookingMutation();

  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // 1. Phục vụ HỦY PHÒNG (bookingDetailIdsToCancel)
  const [cancelledDetailIds, setCancelledDetailIds] = useState<number[]>([]);

  // 2. Phục vụ HỦY DỊCH VỤ LẺ (servicesToCancel: { bookingDetailId, serviceDetailIds })
  const [cancelledServiceDetailIds, setCancelledServiceDetailIds] = useState<Record<number, number[]>>({});

  // 3. Phục vụ ĐỔI PHÒNG (roomsToChange: { bookingDetailId, newRoomId })
  const [roomChanges, setRoomChanges] = useState<Record<number, number>>({});

  // 4. Phục vụ CẬP NHẬT NGÀY LƯU TRÚ (roomsToUpdateDates: { bookingDetailId, newCheckInTime, newCheckoutTime })
  const [dateUpdates, setDateUpdates] = useState<Record<number, { checkIn: string; checkOut: string }>>({});

  // 5. Phục vụ THÊM DỊCH VỤ MỚI CHO PHÒNG HIỆN CÓ (servicesToAddForExistingRooms)
  const [roomServices, setRoomServices] = useState<Record<string, ServiceSelection[]>>({});

  // 6. Phục vụ THÊM PHÒNG MỚI VÀO BOOKING (roomsToAdd)
  const [newRoomsToAdd, setNewRoomsToAdd] = useState<ManagementBookingRoomToAdd[]>([]);
  const [isAddingNewRoom, setIsAddingNewRoom] = useState(false);
  const [selectedNewRoomId, setSelectedNewRoomId] = useState<number | "">("");
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

  const initialServices = useMemo(() => Object.fromEntries(details.map((detail) => {
    const roomId = roomIdOf(detail);
    const selections = servicesOf(detail).map((service) => ({
      serviceId: String(service.serviceId ?? service.id ?? ""),
      quantity: Number(service.quantity ?? 1),
      originalQuantity: Number(service.quantity ?? 1),
      detailId: serviceDetailIdOf(service),
      name: String(service.name ?? service.serviceName ?? service.nameService ?? ""),
      price: service.price == null ? undefined : Number(service.price),
      usedAt: service.usedAt == null ? undefined : String(service.usedAt),
      isExisting: true,
      applyToRoom: false,
    }));
    return [String(roomId), selections];
  })), [details]);

  const ranges = useMemo(() => Object.fromEntries(details.map((detail) => {
    const roomId = roomIdOf(detail);
    const detailId = detailIdOf(detail);
    const updated = dateUpdates[detailId];
    return [String(roomId), {
      checkIn: updated?.checkIn ?? String(detail.checkInTime ?? "").slice(0, 10),
      checkOut: updated?.checkOut ?? String(detail.checkOutTime ?? "").slice(0, 10),
    }];
  })), [details, dateUpdates]);

  const handleToggleCancelRoom = (detailId: number) => {
    setCancelledDetailIds((prev) =>
      prev.includes(detailId) ? prev.filter((id) => id !== detailId) : [...prev, detailId],
    );
  };

  const handleToggleCancelService = (bookingDetailId: number, serviceDetailId: number) => {
    setCancelledServiceDetailIds((prev) => {
      const currentList = prev[bookingDetailId] ?? [];
      const newList = currentList.includes(serviceDetailId)
        ? currentList.filter((id) => id !== serviceDetailId)
        : [...currentList, serviceDetailId];
      return { ...prev, [bookingDetailId]: newList };
    });
  };

  const handleRoomChange = (bookingDetailId: number, newRoomId: number) => {
    setRoomChanges((prev) => ({ ...prev, [bookingDetailId]: newRoomId }));
  };

  const handleDateChange = (bookingDetailId: number, field: "checkIn" | "checkOut", value: string) => {
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
      setError("Vui lòng chọn phòng, ngày check-in và ngày check-out cho phòng mới.");
      return;
    }
    const newRoom: ManagementBookingRoomToAdd = {
      roomId: Number(selectedNewRoomId),
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
    const rawEmployeeId = Number(employeeId ?? localStorage.getItem("id") ?? localStorage.getItem("employeeId") ?? 1);
    const numericEmployeeId = Number.isFinite(rawEmployeeId) && rawEmployeeId > 0 ? rawEmployeeId : 1;

    const roomsToChangeFormatted = Object.entries(roomChanges)
      .filter(([detailIdStr, newRoomId]) => Boolean(newRoomId) && !cancelledDetailIds.includes(Number(detailIdStr)))
      .map(([detailIdStr, newRoomId]) => ({
        bookingDetailId: Number(detailIdStr),
        newRoomId,
      }));

    const roomsToUpdateDatesFormatted = Object.entries(dateUpdates)
      .filter(([detailIdStr, dates]) => Boolean(dates.checkIn || dates.checkOut) && !cancelledDetailIds.includes(Number(detailIdStr)))
      .map(([detailIdStr, dates]) => {
        const detailId = Number(detailIdStr);
        const detail = details.find((d) => detailIdOf(d) === detailId);
        const defaultIn = String(detail?.checkInTime ?? "").slice(0, 10);
        const defaultOut = String(detail?.checkOutTime ?? "").slice(0, 10);
        const checkIn = dates.checkIn || defaultIn;
        const checkOut = dates.checkOut || defaultOut;
        return {
          bookingDetailId: detailId,
          newCheckInTime: checkIn ? `${checkIn}T14:00:00` : "",
          newCheckoutTime: checkOut ? `${checkOut}T12:00:00` : "",
          newCheckOutTime: checkOut ? `${checkOut}T12:00:00` : "",
        };
      });

    const servicesToAddForExistingRoomsFormatted: { bookingDetailId: number; services: any[] }[] = [];
    const serviceQuantityUpdatesFormatted: { bookingDetailId: number; services: { serviceId: number; quantity: number }[] }[] = [];
    const servicesToCancelMap: Record<number, number[]> = { ...cancelledServiceDetailIds };

    editRooms.forEach((room, index) => {
      const detail = activeDetails[index];
      const bookingDetailId = detailIdOf(detail);
      if (!Number.isFinite(bookingDetailId)) return;

      const selections = roomServices[room.id] ?? initialServices[room.id] ?? [];
      const additionsForRoom: any[] = [];
      const quantityUpdatesForRoom: { serviceId: number; quantity: number }[] = [];

      selections.forEach((selection) => {
        const serviceIdNum = Number(selection.serviceId);
        if (!Number.isFinite(serviceIdNum)) return;
        const currentQty = selection.quantity;
        const origQty = selection.isExisting ? Number(selection.originalQuantity ?? selection.quantity) : 0;

        if (!selection.isExisting) {
          if (currentQty > 0) {
            const serviceObj = services.find((item) => String(item.id) === selection.serviceId);
            additionsForRoom.push({
              serviceId: serviceIdNum,
              quantity: currentQty,
              name: selection.name ?? serviceObj?.name,
              price: selection.price ?? serviceObj?.price,
              usedAt: selection.usedAt ?? new Date().toISOString().slice(0, 19),
            });
          }
        } else {
          if (currentQty < origQty) {
            quantityUpdatesForRoom.push({
              serviceId: serviceIdNum,
              quantity: currentQty,
            });
          } else if (currentQty > origQty) {
            const extraQty = currentQty - origQty;
            const serviceObj = services.find((item) => String(item.id) === selection.serviceId);
            additionsForRoom.push({
              serviceId: serviceIdNum,
              quantity: extraQty,
              name: selection.name ?? serviceObj?.name,
              price: selection.price ?? serviceObj?.price,
              usedAt: selection.usedAt ?? new Date().toISOString().slice(0, 19),
            });
          }
        }
      });

      const existingServicesInDetail = servicesOf(detail);
      existingServicesInDetail.forEach((srv) => {
        const sId = Number(srv.serviceId ?? srv.id);
        if (Number.isFinite(sId)) {
          const matchedSelection = selections.find((sel) => sel.isExisting && Number(sel.serviceId) === sId);
          if (!matchedSelection) {
            if (!quantityUpdatesForRoom.some((item) => item.serviceId === sId)) {
              quantityUpdatesForRoom.push({
                serviceId: sId,
                quantity: 0,
              });
            }
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
      .filter(([_, serviceIds]) => serviceIds.length > 0)
      .map(([detailIdStr, serviceDetailIds]) => ({
        bookingDetailId: Number(detailIdStr),
        serviceDetailIds,
      }));

    return {
      employeeId: numericEmployeeId,
      bookingDetailIdsToCancel: cancelledDetailIds,
      servicesToCancel: servicesToCancelFormatted,
      roomsToAdd: newRoomsToAdd,
      roomsToChange: roomsToChangeFormatted,
      roomsToUpdateDates: roomsToUpdateDatesFormatted,
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
    console.log("==========================================");
    console.log("===> [handleSave TRIGGERED]");
    console.log("===> Booking ID:", booking?.bookingId ?? booking?.orderId);
    console.log("===> Current Payload Sent to BE:", JSON.stringify(currentPayload, null, 2));
    console.log("==========================================");

    setError("");
    const bookingId = booking?.bookingId ?? booking?.orderId;
    if (bookingId === undefined) {
      console.error("===> ERROR: Không tìm thấy mã booking (bookingId is undefined).");
      return setError("Không tìm thấy mã booking.");
    }

    try {
      console.log(`===> Calling modifyBooking mutation: PUT /management-bookings/${bookingId}/modify ...`);
      const res = await modifyBooking({ bookingId, request: currentPayload }).unwrap();
      console.log("===> [MODIFY BOOKING BE RESPONSE SUCCESS]:", res);
      toast({
        variant: "success",
        title: "Cập nhật booking thành công!",
        description: `Đã lưu các chỉnh sửa phòng và dịch vụ cho booking #${bookingId}.`,
      });
      setSuccess(true);
    } catch (requestError) {
      console.error("===> [MODIFY BOOKING BE ERROR]:", requestError);
      const responseError = requestError as { data?: { message?: string; error?: string }; error?: string };
      const errorMessage = responseError.data?.message ?? responseError.data?.error ?? responseError.error ?? "Không thể cập nhật booking.";
      toast({
        variant: "destructive",
        title: "Cập nhật booking thất bại",
        description: errorMessage,
      });
      setError(errorMessage);
    }
  };

  if (!booking) {
    return <section className="mt-6 rounded-2xl border border-rose-200 bg-white p-6 text-sm text-rose-600">Không tìm thấy booking cần chỉnh sửa.</section>;
  }

  if (success) {
    return (
      <section className="mt-6 rounded-2xl border border-emerald-200 bg-white p-8 text-center">
        <h2 className="text-lg font-bold text-emerald-700">Cập nhật booking #{booking.bookingId ?? booking.orderId} thành công</h2>
        <p className="mt-2 text-sm text-slate-600">Mọi thay đổi phòng, dịch vụ và thời gian lưu trú đã được lưu vào hệ thống.</p>
        <button
          type="button"
          onClick={() => navigate("/booking-list")}
          className="mt-5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Quay lại danh sách booking
        </button>
      </section>
    );
  }

  return (
    <section className="mt-6 space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Chỉnh sửa booking #{booking.bookingId ?? booking.orderId}</h2>
            <p className="mt-1 text-sm text-slate-500">
              Quản lý đổi phòng, cập nhật thời gian, thêm/hủy phòng và dịch vụ cho đơn đặt phòng.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate("/booking-list")}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <ArrowLeft size={16} /> Quay lại
          </button>
        </div>
      </div>

      {/* 1. Phân đoạn danh sách phòng hiện có trong booking */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <h3 className="text-base font-bold text-slate-900">1. Các phòng hiện có trong Booking</h3>
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
                      Phòng #{rId || detail.roomNumber || index + 1} ({String(detail.roomType ?? detail.roomName ?? "Phòng")})
                    </span>
                    {isCancelled && (
                      <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-700">
                        Đã đánh dấu Hủy
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleCancelRoom(detailId)}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                      isCancelled
                        ? "bg-slate-200 text-slate-700 hover:bg-slate-300"
                        : "bg-rose-100 text-rose-700 hover:bg-rose-200"
                    }`}
                  >
                    {isCancelled ? <RefreshCw size={14} /> : <Trash2 size={14} />}
                    {isCancelled ? "Khôi phục phòng" : "Hủy phòng này"}
                  </button>
                </div>

                {!isCancelled && (
                  <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {/* Đổi ngày check-in / check-out */}
                    <div className="rounded-lg bg-white p-3 border border-slate-200">
                      <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                        <Calendar size={14} className="text-blue-600" /> Ngày nhận / trả phòng:
                      </label>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-[11px] text-slate-500">Check-in</span>
                          <input
                            type="date"
                            value={currentDateUpdate.checkIn}
                            onChange={(e) => handleDateChange(detailId, "checkIn", e.target.value)}
                            className="mt-0.5 w-full rounded-md border border-slate-300 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <span className="text-[11px] text-slate-500">Check-out</span>
                          <input
                            type="date"
                            value={currentDateUpdate.checkOut}
                            onChange={(e) => handleDateChange(detailId, "checkOut", e.target.value)}
                            className="mt-0.5 w-full rounded-md border border-slate-300 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Đổi phòng */}
                    <div className="rounded-lg bg-white p-3 border border-slate-200">
                      <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                        <RefreshCw size={14} className="text-amber-600" /> Đổi sang phòng khác:
                      </label>
                      <select
                        value={roomChanges[detailId] ?? rId}
                        onChange={(e) => handleRoomChange(detailId, Number(e.target.value))}
                        className="mt-2 w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
                      >
                        <option value={rId}>Giữ phòng hiện tại (#{rId})</option>
                        {hotelRooms
                          .filter((hr) => Number(hr.id ?? hr.roomId) !== rId)
                          .map((hr) => {
                            const hrId = Number(hr.id ?? hr.roomId);
                            return (
                              <option key={hrId} value={hrId}>
                                Phòng #{hr.roomNumber ?? hrId} - {String(hr.roomType ?? hr.type ?? "Phòng")} ({Number(hr.basePrice ?? hr.price ?? 0).toLocaleString("vi-VN")}đ)
                              </option>
                            );
                          })}
                      </select>
                    </div>

                    {/* Dịch vụ lẻ đã đặt của phòng */}
                    <div className="rounded-lg bg-white p-3 border border-slate-200 sm:col-span-2 lg:col-span-1">
                      <label className="text-xs font-bold text-slate-700">Dịch vụ đã đặt:</label>
                      {existingServicesList.length === 0 ? (
                        <p className="mt-1 text-xs text-slate-400">Chưa có dịch vụ lẻ nào.</p>
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
                                  onClick={() => handleToggleCancelService(detailId, sDetailId)}
                                  className="text-slate-400 hover:text-rose-600"
                                  title={isSrvCancelled ? "Khôi phục dịch vụ" : "Hủy dịch vụ này"}
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
          <h3 className="text-base font-bold text-slate-900">2. Thêm phòng mới vào đơn đặt</h3>
          {!isAddingNewRoom && (
            <button
              type="button"
              onClick={() => setIsAddingNewRoom(true)}
              className="flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-600 hover:bg-blue-100"
            >
              <UserPlus size={14} /> Thêm phòng mới
            </button>
          )}
        </div>

        {/* Form thêm phòng mới */}
        {isAddingNewRoom && (
          <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50/40 p-4">
            <h4 className="text-xs font-bold text-blue-900 uppercase tracking-wide">Nhập thông tin phòng mới</h4>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="text-xs font-semibold text-slate-700">Chọn phòng:</label>
                <select
                  value={selectedNewRoomId}
                  onChange={(e) => setSelectedNewRoomId(Number(e.target.value))}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
                >
                  <option value="">-- Chọn phòng --</option>
                  {hotelRooms.map((hr) => {
                    const hrId = Number(hr.id ?? hr.roomId);
                    return (
                      <option key={hrId} value={hrId}>
                        Phòng #{hr.roomNumber ?? hrId} - {String(hr.roomType ?? hr.type ?? "Phòng")} ({Number(hr.basePrice ?? hr.price ?? 0).toLocaleString("vi-VN")}đ)
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
                <label className="text-xs font-semibold text-slate-700">Người lớn:</label>
                <input
                  type="number"
                  min={1}
                  value={newRoomAdults}
                  onChange={(e) => setNewRoomAdults(Number(e.target.value))}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Trẻ em:</label>
                <input
                  type="number"
                  min={0}
                  value={newRoomChildren}
                  onChange={(e) => setNewRoomChildren(Number(e.target.value))}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Em bé:</label>
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
                Hủy
              </button>
              <button
                type="button"
                onClick={handleAddNewRoom}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
              >
                Xác nhận thêm phòng
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
                  <span className="font-bold text-emerald-900">Phòng bổ sung #{room.roomId}</span>
                  <span className="ml-2 text-slate-600">
                    ({room.checkInTime.slice(0, 10)} ➔ {room.checkOutTime.slice(0, 10)})
                  </span>
                  <span className="ml-2 text-slate-500">
                    | Khách: {room.numAdults} người lớn, {room.numChildren} trẻ em, {room.numInfants} em bé
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
        <h3 className="text-base font-bold text-slate-900">3. Thêm dịch vụ phát sinh cho các phòng đang chọn</h3>
        <p className="mt-1 text-xs text-slate-500">Chọn dịch vụ mới bổ sung cho các phòng còn hoạt động trong booking.</p>
        <div className="mt-4">
          <BookingServiceSelector
            rooms={editRooms}
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
            language="vi"
            nightsForRoom={() => 1}
            onContinue={() => void handleSave()}
            onSkip={() => void handleSave()}
            continueLabel={isLoading ? "Đang cập nhật..." : "Cập nhật"}
            skipLabel="Cập nhật"
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
            <span className="text-xs font-mono font-bold text-slate-300">Payload JSON (Gửi xuống BE /management-bookings/{booking.bookingId ?? booking.orderId}/modify)</span>
            <button
              type="button"
              onClick={() => setShowDebugJson(false)}
              className="text-xs text-slate-400 hover:text-white"
            >
              Đóng
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
          {showDebugJson ? "Ẩn Debug JSON" : "🔍 Xem Debug JSON Payload"}
        </button>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/booking-list")}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            disabled={isLoading}
            onClick={() => void handleSave()}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
          >
            <Save size={16} />
            {isLoading ? "Đang lưu thay đổi..." : "Lưu tất cả thay đổi"}
          </button>
        </div>
      </div>
    </section>
  );
}
