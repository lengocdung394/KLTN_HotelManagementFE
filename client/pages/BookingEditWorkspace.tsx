import { useMemo, useState } from "react";
import { ArrowLeft, Save } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import BookingServiceSelector, { type ServiceSelection } from "../components/BookingServiceSelector";
import { useGetAllServicesQuery } from "../services/serviceApi";
import { useModifyBookingMutation, type ManagementBookingModificationRequest } from "../services/managementBookingApi";
import type { BookingListItem } from "../services/bookingApi";
import { useAppSelector } from "../store/hooks";

type EditRoom = {
  id: string;
  databaseId: number;
  type: string;
  guests: number;
  price: number;
};

type BookingDetail = Record<string, unknown>;

const roomIdOf = (detail: BookingDetail) => Number(detail.roomId ?? detail.roomID);
const detailIdOf = (detail: BookingDetail) => Number(
  detail.bookingDetailId
  ?? detail.bookingDetailsId
  ?? detail.bookingDetailID
  ?? detail.detailId
  ?? detail.detailID
  ?? detail.id,
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
  const [modifyBooking, { isLoading }] = useModifyBookingMutation();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [roomServices, setRoomServices] = useState<Record<string, ServiceSelection[]>>({});

  const details = useMemo(
    () => (Array.isArray(booking?.bookingDetails) ? booking.bookingDetails : []) as BookingDetail[],
    [booking],
  );
  const rooms = useMemo<EditRoom[]>(() => details.map((detail, index) => {
    const databaseId = roomIdOf(detail);
    return {
      id: String(databaseId || detail.roomNumber || `room-${index + 1}`),
      databaseId,
      type: String(detail.roomType ?? detail.roomName ?? "Phòng booking"),
      guests: Number(detail.numAdults ?? detail.adults ?? 1) + Number(detail.numChildren ?? detail.children ?? 0) + Number(detail.numInfants ?? detail.infants ?? 0),
      price: Number(detail.baseRoomPricePerNight ?? detail.roomPrice ?? detail.price ?? 0),
    };
  }), [details]);

  const initialServices = useMemo(() => Object.fromEntries(details.map((detail) => {
    const roomId = roomIdOf(detail);
    const selections = servicesOf(detail).map((service) => ({
      serviceId: String(service.serviceId ?? service.id ?? ""),
      quantity: Number(service.quantity ?? 1),
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
    return [String(roomId), {
      checkIn: String(detail.checkInTime ?? "").slice(0, 10),
      checkOut: String(detail.checkOutTime ?? "").slice(0, 10),
    }];
  })), [details]);

  const handleSave = async () => {
    setError("");
    const bookingId = booking?.bookingId ?? booking?.orderId;
    const numericEmployeeId = Number(employeeId ?? localStorage.getItem("id"));
    if (bookingId === undefined) return setError("Không tìm thấy mã booking.");
    if (!Number.isFinite(numericEmployeeId)) return setError("Không tìm thấy mã nhân viên.");

    const servicesToAddForExistingRooms = rooms.flatMap((room, index) => {
      const detail = details[index];
      const bookingDetailId = detailIdOf(detail);
      const addedServices = (roomServices[room.id] ?? [])
        .filter((selection) => !selection.isExisting && Number.isFinite(Number(selection.serviceId)) && selection.quantity > 0)
        .map((selection) => {
          const service = services.find((item) => String(item.id) === selection.serviceId);
          return {
            serviceId: Number(selection.serviceId),
            quantity: selection.quantity,
            name: selection.name ?? service?.name,
            price: selection.price ?? service?.price,
            usedAt: selection.usedAt ?? new Date().toISOString().slice(0, 19),
          };
        });
      return Number.isFinite(bookingDetailId) && addedServices.length > 0 ? [{ bookingDetailId, services: addedServices }] : [];
    });

    const request: ManagementBookingModificationRequest = {
      employeeId: numericEmployeeId,
      bookingDetailIdsToCancel: [],
      servicesToCancel: [],
      roomsToAdd: [],
      roomsToChange: [],
      roomsToUpdateDates: [],
      servicesToAddForExistingRooms,
    };

    try {
      await modifyBooking({ bookingId, request }).unwrap();
      setSuccess(true);
    } catch (requestError) {
      const responseError = requestError as { data?: { message?: string; error?: string }; error?: string };
      setError(responseError.data?.message ?? responseError.data?.error ?? responseError.error ?? "Không thể cập nhật booking.");
    }
  };

  if (!booking) {
    return <section className="mt-6 rounded-2xl border border-rose-200 bg-white p-6 text-sm text-rose-600">Không tìm thấy booking cần chỉnh sửa.</section>;
  }

  if (success) {
    return <section className="mt-6 rounded-2xl border border-emerald-200 bg-white p-8 text-center"><h2 className="text-lg font-bold text-emerald-700">Cập nhật booking thành công</h2><button type="button" onClick={() => navigate("/booking-list")} className="mt-5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Quay lại danh sách booking</button></section>;
  }

  return <section className="mt-6 rounded-2xl border border-slate-200/80 bg-white shadow-sm">
    <div className="flex items-center justify-between border-b border-slate-100 p-5">
      <div><h2 className="text-lg font-bold text-slate-900">Chỉnh sửa booking #{booking.bookingId ?? booking.orderId}</h2><p className="mt-1 text-sm text-slate-500">Thêm dịch vụ phát sinh cho từng phòng.</p></div>
      <button type="button" onClick={() => navigate("/booking-list")} className="flex items-center gap-2 text-sm font-semibold text-slate-600"><ArrowLeft size={16} />Quay lại</button>
    </div>
    <BookingServiceSelector
      rooms={rooms}
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
    {error && <p className="px-5 pb-5 text-sm text-rose-600">{error}</p>}
    <div className="border-t border-slate-100 px-5 py-4"><button type="button" disabled={isLoading} onClick={() => void handleSave()} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><Save size={16} />{isLoading ? "Đang cập nhật..." : "Lưu thay đổi"}</button></div>
  </section>;
}
