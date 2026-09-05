import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import BatchActionDialog from "../components/BatchActionDialog";
import BatchStayCard from "../components/BatchStayCard";
import CheckoutSummary, { type CheckoutSummaryRoom } from "../components/CheckoutSummary";
import DatePickerPopover from "../components/DatePickerPopover";
import BookingServiceSelector, { bookingServices, type ServiceSelection } from "../components/BookingServiceSelector";
import EarlyLateStayNotice from "../components/EarlyLateStayNotice";
import {
  CalendarCheck,
  CalendarDays,
  Check,
  ChevronDown,
  Clock3,
  CreditCard,
  LogIn,
  LogOut,
  Search,
  Sparkles,
  UserRound,
} from "lucide-react";

type ServiceCharge = { name: string; quantity: number; amount: number };

const arrivals = [
  {
    id: "BK-00842",
    guest: "Nguyễn Minh Anh",
    phone: "090 123 4567",
    room: "101 · Deluxe King",
    time: "14:00",
    guests: 2,
    status: "Chờ check-in",
  },
  {
    id: "BK-00840",
    guest: "Trần Thùy Dương",
    phone: "098 765 4321",
    room: "102 · Deluxe Twin",
    time: "15:30",
    guests: 2,
    status: "Chờ check-in",
  },
  {
    id: "BK-00837",
    guest: "Lê Hoàng Nam",
    phone: "090 555 0198",
    room: "203 · Executive Suite",
    time: "16:00",
    guests: 3,
    status: "Đã check-in",
  },
];

const groupArrival = {
  id: "BK-00845",
  guest: "Nguyễn Hoàng Long",
  phone: "091 234 5678",
  rooms: ["101", "102", "103", "104", "105"],
  time: "13:30",
  guests: 10,
  status: "Chờ check-in",
};

const groupDeparture = {
  id: "BK-00846",
  guest: "Công ty Minh Thành",
  rooms: ["301", "302", "303", "304", "305"],
  time: "12:00",
  guests: 10,
  status: "Đang ở",
  roomAmounts: [2000000, 2500000, 2500000, 3000000, 3000000],
  services: [80000, 0, 120000, 50000, 0],
};

const departures = [
  {
    id: "BK-00841",
    guest: "Phạm Gia Huy",
    room: "103 · Executive",
    time: "11:00",
    status: "Đang ở",
    roomPaid: true,
    services: [
      { name: "Nước suối", quantity: 2, amount: 30000 },
      { name: "Giặt ủi", quantity: 1, amount: 50000 },
    ],
    lateFee: 0,
  },
  {
    id: "BK-00839",
    guest: "Công ty VinaTech",
    room: "201 · Suite Garden",
    time: "12:00",
    status: "Đang ở",
    roomPaid: true,
    services: [],
    lateFee: 200000,
  },
  {
    id: "BK-00838",
    guest: "Đỗ Khánh Linh",
    room: "202 · Suite Garden",
    time: "12:00",
    status: "Đã trả phòng",
    roomPaid: true,
    services: [],
    lateFee: 0,
  },
];

const cleaningStaff = [
  "Nguyễn Thị Mai",
  "Lê Thị Hương",
  "Phạm Ngọc Anh",
  "Trần Minh Tú",
];
const initialCleaningTasks = [
  {
    room: "102",
    type: "Deluxe Twin",
    detail: "Khách sắp nhận phòng · 15:30",
    assignee: "",
  },
  {
    room: "201",
    type: "Suite Garden",
    detail: "Khách vừa trả phòng · 12:00",
    assignee: "",
  },
  {
    room: "202",
    type: "Suite Garden",
    detail: "Khách vừa trả phòng · 12:00",
    assignee: "",
  },
];

type CleaningTask = (typeof initialCleaningTasks)[number];
type FlowFilter = "all" | "check-in" | "check-out";
type DailyRecord = {
  id: string;
  guest: string;
  room: string;
  time: string;
  status: string;
  flow: "check-in" | "check-out";
  guests?: number;
  roomPaid?: boolean;
  roomAmount?: number;
  services?: ServiceCharge[];
  lateFee?: number;
};

type RoomDetail = {
  id: string;
  type: string;
  floor: string;
  beds: string;
  size: string;
  view: string;
  rate: string;
  status: string;
  note: string;
  amenities: string[];
};

const roomDetailsById: Record<string, RoomDetail> = {
  "101": {
    id: "101",
    type: "Deluxe King",
    floor: "Tầng 1",
    beds: "1 giường lớn",
    size: "28 m²",
    view: "Hướng sông",
    rate: "1.250.000đ/đêm",
    status: "Sẵn sàng",
    note: "Phòng gần thang máy, ưu tiên check-in sớm.",
    amenities: ["Ban công", "Máy lạnh", "Wifi", "TV 50 inch", "Minibar"],
  },
  "102": {
    id: "102",
    type: "Deluxe Twin",
    floor: "Tầng 1",
    beds: "2 giường đơn",
    size: "30 m²",
    view: "Nhìn sân vườn",
    rate: "1.250.000đ/đêm",
    status: "Đang dọn",
    note: "Đang chuẩn bị phòng cho lượt nhận lúc 15:30.",
    amenities: ["Bữa sáng", "Wifi", "Máy sấy", "Bàn làm việc"],
  },
  "103": {
    id: "103",
    type: "Executive",
    floor: "Tầng 1",
    beds: "1 giường lớn",
    size: "32 m²",
    view: "Nhìn phố",
    rate: "1.850.000đ/đêm",
    status: "Đang ở",
    note: "Khách yêu cầu late check-out 30 phút.",
    amenities: ["Bồn tắm", "Wifi", "TV", "Két an toàn"],
  },
  "201": {
    id: "201",
    type: "Suite Garden",
    floor: "Tầng 2",
    beds: "1 giường lớn",
    size: "45 m²",
    view: "Vườn riêng",
    rate: "2.450.000đ/đêm",
    status: "Đang ở",
    note: "Đoàn doanh nghiệp, cần hóa đơn công ty.",
    amenities: ["Phòng khách", "Bồn tắm", "Wifi", "Máy pha cà phê"],
  },
  "202": {
    id: "202",
    type: "Suite Garden",
    floor: "Tầng 2",
    beds: "1 giường lớn",
    size: "45 m²",
    view: "Vườn riêng",
    rate: "2.450.000đ/đêm",
    status: "Cần dọn",
    note: "Vừa check-out, ưu tiên dọn trước 14:00.",
    amenities: ["Phòng khách", "Minibar", "Wifi", "Bàn ăn nhỏ"],
  },
  "203": {
    id: "203",
    type: "Executive Suite",
    floor: "Tầng 2",
    beds: "1 giường lớn",
    size: "52 m²",
    view: "Hướng sông",
    rate: "3.100.000đ/đêm",
    status: "Đang ở",
    note: "Khách VIP, ưu tiên hỗ trợ concierge.",
    amenities: ["Phòng khách", "Bồn tắm", "Wifi tốc độ cao", "Máy pha cà phê"],
  },
};

export default function CheckInOutWorkspace() {
  const { t } = useTranslation();
  const [flowFilter, setFlowFilter] = useState<FlowFilter>("all");
  const [query, setQuery] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [arrivalState, setArrivalState] = useState(arrivals);
  const [groupArrivalState, setGroupArrivalState] = useState(groupArrival);
  const [checkedInGroupRooms, setCheckedInGroupRooms] = useState<string[]>([]);
  const [departureState, setDepartureState] = useState(departures);
  const [cleaningTasks, setCleaningTasks] =
    useState<CleaningTask[]>(initialCleaningTasks);
  const [pendingCleaning, setPendingCleaning] = useState<{
    room: string;
    type: string;
  } | null>(null);
  const [roomPreview, setRoomPreview] = useState<{
    record: DailyRecord;
    detail: RoomDetail;
  } | null>(null);
  const [checkoutRecord, setCheckoutRecord] = useState<DailyRecord | null>(
    null,
  );
  const [selectingGroupRoom, setSelectingGroupRoom] = useState(false);
  const [selectedGroupRooms, setSelectedGroupRooms] = useState<string[]>([]);
  const [selectedDepartureIds, setSelectedDepartureIds] = useState<string[]>(
    [],
  );
  const [batchCheckoutOpen, setBatchCheckoutOpen] = useState(false);
  const [groupDepartureState, setGroupDepartureState] = useState(groupDeparture);
  const [selectedGroupDepartureRooms, setSelectedGroupDepartureRooms] = useState<string[]>([]);
  const [confirmedGroupDepartureRooms, setConfirmedGroupDepartureRooms] = useState<string[]>([]);
  const [groupCheckoutOpen, setGroupCheckoutOpen] = useState(false);
  const [warningAction, setWarningAction] = useState<{ id: string; flow: "check-in" | "check-out"; message: string; fee: number } | null>(null);
  const [serviceRecord, setServiceRecord] = useState<DailyRecord | null>(null);
  const [serviceSelections, setServiceSelections] = useState<ServiceSelection[]>([]);
  const [serviceRoomSelections, setServiceRoomSelections] = useState<Record<string, ServiceSelection[]>>({});
  const [serviceSelectorRooms, setServiceSelectorRooms] = useState<Array<{ id: string; type: string; guests: number; price: number }>>([]);
  const [serviceModalMode, setServiceModalMode] = useState<"all" | "per-room">("per-room");
  const [serviceAllSelections, setServiceAllSelections] = useState<ServiceSelection[]>([]);
  const [recordServices, setRecordServices] = useState<Record<string, ServiceCharge[]>>({});
  const dailyRecords = useMemo<DailyRecord[]>(() => {
    const checkInRecords = arrivalState.map((record) => ({
      ...record,
      flow: "check-in" as const,
    }));
    const checkOutRecords = departureState.map((record) => ({
      ...record,
      flow: "check-out" as const,
    }));
    return [...checkInRecords, ...checkOutRecords].sort((a, b) =>
      a.time.localeCompare(b.time),
    );
  }, [arrivalState, departureState]);
  const filtered = dailyRecords
    .filter((record) => {
      const matchesQuery = `${record.guest} ${record.room}`
        .toLowerCase()
        .includes(query.toLowerCase());
      const matchesFlow = flowFilter === "all" || record.flow === flowFilter;
      return matchesQuery && matchesFlow;
    })
    .sort((a, b) => a.time.localeCompare(b.time));

  const pendingRecords = filtered.filter(
    (record) => record.status === "Chờ check-in" || record.status === "Đang ở",
  );
  const completedRecords = filtered.filter(
    (record) =>
      record.status === "Đã check-in" || record.status === "Đã trả phòng",
  );

  const renderRecord = (record: (typeof filtered)[number]) => {
    const isCheckIn = record.flow === "check-in";
    const canComplete =
      (isCheckIn && record.status === "Chờ check-in") ||
      (!isCheckIn && record.status === "Đang ở");
    const canUndo =
      (isCheckIn && record.status === "Đã check-in") ||
      (!isCheckIn && record.status === "Đã trả phòng");
    const services = recordServices[record.id] ?? record.services ?? [];
    const serviceTotal =
      services.reduce(
        (total, service) => total + service.amount,
        0,
      ) + (record.lateFee || 0);
    const statusLabel =
      record.status === "Chờ check-in"
        ? t("frontDesk.waitingCheckIn")
        : record.status === "Đang ở"
          ? "Đang lưu trú"
          : record.status === "Đã check-in"
            ? "Đã check-in"
            : "Đã check-out";
        const addServiceButton = <button type="button" onClick={() => openServiceSelector(record)} className="rounded-lg border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-50">Thêm dịch vụ</button>;

    return (
      <article
        key={record.id}
        className={`mx-4 my-3 flex flex-col gap-4 rounded-xl border bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between ${isCheckIn ? "border-blue-200" : "border-amber-200"}`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`grid h-10 w-10 place-items-center rounded-full ${isCheckIn ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}
          >
            {isCheckIn ? <LogIn size={18} /> : <LogOut size={18} />}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="font-bold text-slate-900">{record.guest}</h4>
              <span className="text-xs text-slate-400">{record.id}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${isCheckIn ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"}`}
              >
                {isCheckIn ? "Check-in" : "Check-out"}
              </span>
              {record.roomPaid && (
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                  Đã thanh toán tiền phòng
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-slate-500">
              <button
                type="button"
                onClick={() => openRoomModal(record)}
                className="rounded px-1 font-semibold text-blue-700 underline-offset-2 hover:bg-blue-50 hover:underline"
              >
                {record.room}
              </button>{" "}
              ·{" "}
              {record.guests
                ? `${record.guests} ${t("common.guestCount")}`
                : t("frontDesk.stay")}
            </p>
            {!isCheckIn && serviceTotal > 0 && (
              <p className="mt-1 text-xs font-semibold text-amber-700">
                Dịch vụ / phụ thu: {serviceTotal.toLocaleString("vi-VN")}đ
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between gap-4 sm:justify-end">
          <div className="text-left sm:text-right">
            <p className="text-xs font-semibold text-slate-500">
              {isCheckIn ? t("frontDesk.checkInTime") : t("frontDesk.checkOutTime")}
            </p>
            <p className="mt-1 font-bold text-slate-800">{record.time}</p>
          </div>
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${record.status === "Đã check-in" || record.status === "Đã trả phòng" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}
          >
            {statusLabel}
          </span>
          {canComplete && (
            <button
              onClick={() => {
                const now = new Date();
                const [hours, minutes] = record.time.split(":").map(Number);
                const scheduled = new Date(now);
                scheduled.setHours(hours, minutes, 0, 0);
                const isEarly = isCheckIn && now < scheduled;
                const isLate = !isCheckIn && now > scheduled;
                if (isLate || isEarly) {
                  setWarningAction({ id: record.id, flow: record.flow, fee: isEarly ? 150000 : 200000, message: isEarly ? `Khách đang check-in sớm hơn giờ dự kiến ${record.time}.` : `Khách đang check-out trễ hơn giờ dự kiến ${record.time}.` });
                } else if (isCheckIn) completeRecord(record.id, record.flow);
                else setCheckoutRecord(record);
              }}
              className={`flex w-36 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:shadow-md ${isCheckIn ? "bg-blue-600 hover:bg-blue-700" : "bg-amber-600 hover:bg-amber-700"}`}
            >
              {isCheckIn ? "Check-in" : "Check-out"}
            </button>
          )}
          {isCheckIn && record.status === "Chờ check-in" && addServiceButton}
          {!isCheckIn && record.status === "Đang ở" && addServiceButton}
          {canUndo && (
            <button
              type="button"
              onClick={() => {
                if (isCheckIn) {
                  setArrivalState((current) =>
                    current.map((item) =>
                      item.id === record.id ? { ...item, status: "Chờ check-in" } : item,
                    ),
                  );
                } else {
                  setDepartureState((current) =>
                    current.map((item) =>
                      item.id === record.id ? { ...item, status: "Đang ở" } : item,
                    ),
                  );
                }
              }}
              className={`w-36 shrink-0 rounded-lg border px-4 py-2.5 text-xs font-bold transition ${isCheckIn ? "border-blue-200 text-blue-700 hover:bg-blue-50" : "border-amber-200 text-amber-700 hover:bg-amber-50"}`}
            >
              {isCheckIn ? "Bỏ check-in" : "Bỏ check-out"}
            </button>
          )}
        </div>
      </article>
    );
  };

  const renderStatusGroup = (
    title: string,
    records: typeof filtered,
    isCompleted: boolean,
  ) => {
    if (records.length === 0) return null;
    return (
      <div className="border-b border-slate-100 last:border-0">
        <div className="flex items-center justify-between bg-slate-50 px-5 py-3">
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">
            {title} ({records.length})
          </p>
          <span
            className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
              isCompleted
                ? "bg-emerald-50 text-emerald-700"
                : "bg-amber-50 text-amber-700"
            }`}
          >
            {isCompleted ? "Đã xử lý" : "Chờ xử lý"}
          </span>
        </div>
        {records.map(renderRecord)}
      </div>
    );
  };

  const assignCleaner = (room: string, assignee: string) => {
    setCleaningTasks((current) =>
      current.map((task) =>
        task.room === room ? { ...task, assignee } : task,
      ),
    );
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem("staywise-cleaning-rooms");
      const assignments = stored ? JSON.parse(stored) : {};
      assignments[room] = { status: "Đang dọn", cleaner: assignee };
      window.localStorage.setItem(
        "staywise-cleaning-rooms",
        JSON.stringify(assignments),
      );
    }
  };

  const completeRecord = (id: string, flow: "check-in" | "check-out") => {
    if (flow === "check-in") {
      setArrivalState((current) =>
        current.map((item) =>
          item.id === id ? { ...item, status: "Đã check-in" } : item,
        ),
      );
    } else {
      const record = departureState.find((item) => item.id === id);
      setDepartureState((current) =>
        current.map((item) =>
          item.id === id ? { ...item, status: "Đã trả phòng" } : item,
        ),
      );
      if (record) {
        const [room, type] = record.room.split(" · ");
        setCleaningTasks((current) =>
          current.some((task) => task.room === room)
            ? current
            : [
                ...current,
                {
                  room,
                  type,
                  detail: `Khách vừa trả phòng · ${record.time}`,
                  assignee: "",
                },
              ],
        );
        setPendingCleaning({ room, type });
      }
    }
  };

  const checkInGroup = (rooms: string[]) => {
    const nextRooms = [...new Set([...checkedInGroupRooms, ...rooms])];
    setCheckedInGroupRooms(nextRooms);
  };

  const toggleGroupRoom = (room: string) => {
    setSelectedGroupRooms((current) =>
      current.includes(room)
        ? current.filter((item) => item !== room)
        : [...current, room],
    );
  };

  const undoGroupRoomCheckIn = (room: string) => {
    setCheckedInGroupRooms((current) =>
      current.filter((item) => item !== room),
    );
    setSelectedGroupRooms((current) => current.filter((item) => item !== room));
    setGroupArrivalState((current) => ({ ...current, status: "Chờ check-in" }));
  };

  const undoGroupRoomCheckOut = (room: string) => {
    setConfirmedGroupDepartureRooms((current) =>
      current.filter((item) => item !== room),
    );
    setSelectedGroupDepartureRooms((current) =>
      current.filter((item) => item !== room),
    );
    setGroupDepartureState((current) => ({ ...current, status: "Đang ở" }));
  };

  const toggleGroupRoomImmediately = (room: string) => {
    if (checkedInGroupRooms.includes(room)) {
      undoGroupRoomCheckIn(room);
    } else {
      checkInGroup([room]);
    }
  };

  const toggleDepartureSelection = (id: string) => {
    setSelectedDepartureIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  };

  const confirmBatchCheckout = () => {
    selectedDepartureIds.forEach((id) => completeRecord(id, "check-out"));
    setSelectedDepartureIds([]);
    setBatchCheckoutOpen(false);
    setPendingCleaning(null);
  };

  const toggleGroupDepartureRoom = (room: string) => {
    setSelectedGroupDepartureRooms((current) => current.includes(room) ? current.filter((item) => item !== room) : [...current, room]);
  };

  const completeGroupCheckout = () => {
    if (selectedGroupDepartureRooms.length === 0) return;
    const nextSelected = Array.from(new Set([...selectedGroupDepartureRooms]));
    setSelectedGroupDepartureRooms(nextSelected);
    if (nextSelected.length === groupDepartureState.rooms.length) {
      setGroupDepartureState((current) => ({ ...current, status: "Đã trả phòng" }));
    }
  };

  const groupArrivalComplete = groupArrivalState.rooms.every((room) => checkedInGroupRooms.includes(room));
  const groupDepartureComplete = groupDepartureState.rooms.every((room) => confirmedGroupDepartureRooms.includes(room));

  const groupDialogRooms = groupArrivalState.rooms.map((room) => ({
    id: room,
    label: "Phòng",
    meta: room,
    status: checkedInGroupRooms.includes(room) ? "complete" as const : "pending" as const,
  }));
  const batchDialogRooms = departureState.filter((record) => record.status === "Đang ở").map((record) => ({
    id: record.id,
    badge: record.room.split(" · ")[0].slice(-2),
    label: record.guest,
    meta: `Phòng ${record.room.split(" · ")[0]}`,
    status: "pending" as const,
    amount: (record.services || []).reduce((total, service) => total + service.amount, 0) + (record.lateFee || 0),
  }));
  const groupDepartureItems = groupDepartureState.rooms.map((room, index) => ({
    id: room,
    badge: room.slice(-2),
    title: `Phòng ${room}`,
    subtitle: `${groupDepartureState.id} · Dịch vụ/phụ thu: ${groupDepartureState.services[index].toLocaleString("vi-VN")}đ`,
    status: confirmedGroupDepartureRooms.includes(room) ? "complete" as const : selectedGroupDepartureRooms.includes(room) ? "pending" as const : "pending" as const,
  }));
  const groupCheckoutSummaryRooms: CheckoutSummaryRoom[] = groupDepartureState.rooms
    .filter((room) => selectedGroupDepartureRooms.includes(room))
    .map((room) => {
      const index = groupDepartureState.rooms.indexOf(room);
      return {
        id: room,
        label: `Phòng ${room}`,
        roomPaid: false,
        roomAmount: groupDepartureState.roomAmounts[index],
        services: groupDepartureState.services[index] > 0 ? [{ name: "Dịch vụ / phụ thu", quantity: 1, amount: groupDepartureState.services[index] }] : [],
      };
    });
  const confirmGroupCheckout = (roomsToConfirm = selectedGroupDepartureRooms) => {
    if (roomsToConfirm.length === 0) return;
    const merged = Array.from(new Set([...confirmedGroupDepartureRooms, ...roomsToConfirm]));
    setConfirmedGroupDepartureRooms(merged);
    setSelectedGroupDepartureRooms([]);
    setGroupCheckoutOpen(false);
    if (merged.length === groupDepartureState.rooms.length) setGroupDepartureState((current) => ({ ...current, status: "Đã trả phòng" }));
  };
  const checkoutRoomsFromRecords = (records: Array<Pick<DailyRecord, "id" | "guest" | "room" | "roomAmount" | "roomPaid" | "services" | "lateFee">>): CheckoutSummaryRoom[] => records.map((record) => ({
    id: record.id,
    label: `Phòng ${record.room.split(" · ")[0]} · ${record.guest}`,
    roomAmount: record.roomAmount,
    roomPaid: record.roomPaid,
    services: record.services,
    lateFee: record.lateFee,
  }));

  const confirmCheckout = () => {
    if (!checkoutRecord) return;
    completeRecord(checkoutRecord.id, "check-out");
    setCheckoutRecord(null);
  };

  const pendingArrivals =
    arrivalState.filter((item) => item.status === "Chờ check-in").length +
    (groupArrivalState.status === "Chờ check-in" ? 1 : 0);
  const pendingDepartures = departureState.filter(
    (item) => item.status === "Đang ở",
  ).length;

  const openServiceSelector = (record: DailyRecord) => {
    const currentServices = recordServices[record.id] ?? record.services ?? [];
    setServiceSelections(currentServices.map((service) => ({
      serviceId: bookingServices.find((item) => item.name === service.name)?.id ?? "",
      quantity: service.quantity,
    })).filter((selection) => selection.serviceId));
    const roomId = record.room.split(" · ")[0];
    setServiceSelectorRooms([{ id: roomId, type: record.room.split(" · ")[1] ?? "Phòng", guests: record.guests ?? 1, price: 0 }]);
    setServiceRoomSelections({ [roomId]: currentServices.map((service) => ({
      serviceId: bookingServices.find((item) => item.name === service.name)?.id ?? "",
      quantity: service.quantity,
    })).filter((selection) => selection.serviceId) });
    setServiceAllSelections([]);
    setServiceModalMode("per-room");
    setServiceRecord(record);
  };

  const openGroupServiceSelector = (id: string, guest: string, rooms: string[], guests: number) => {
    setServiceRecord({ id, guest, room: `${rooms.join(", ")} · Đoàn`, guests, time: "", status: "Đang ở", flow: "check-out" });
    const guestsPerRoom = Math.max(1, Math.ceil(guests / rooms.length));
    setServiceSelectorRooms(rooms.map((room) => ({ id: room, type: "Phòng đoàn", guests: guestsPerRoom, price: 0 })));
    setServiceRoomSelections({});
    setServiceAllSelections([]);
    setServiceModalMode("per-room");
  };

  const saveRecordServices = () => {
    if (!serviceRecord) return;
    const selections = serviceModalMode === "all"
      ? serviceSelectorRooms.flatMap((room) => serviceAllSelections.map((selection) => ({ ...selection, quantity: selection.quantity * room.guests })))
      : Object.values(serviceRoomSelections).flat().length > 0 ? Object.values(serviceRoomSelections).flat() : serviceSelections;
    const mergedSelections = selections.reduce<ServiceSelection[]>((current, selection) => {
      const existing = current.find((item) => item.serviceId === selection.serviceId);
      return existing ? current.map((item) => item.serviceId === selection.serviceId ? { ...item, quantity: item.quantity + selection.quantity } : item) : [...current, selection];
    }, []);
    setRecordServices((current) => ({
      ...current,
      [serviceRecord.id]: mergedSelections.map((selection) => ({
        name: bookingServices.find((service) => service.id === selection.serviceId)?.name ?? "Dịch vụ",
        quantity: selection.quantity,
        amount: (bookingServices.find((service) => service.id === selection.serviceId)?.price ?? 0) * selection.quantity,
      })),
    }));
    setServiceRecord(null);
  };

  const openRoomModal = (record: DailyRecord) => {
    const [roomId, roomType] = record.room.split(" · ");
    const fallback: RoomDetail = {
      id: roomId,
      type: roomType || t("frontDesk.unknownRoomType", "Unknown room type"),
      floor: t("frontDesk.notUpdated", "Not updated"),
      beds: t("frontDesk.notUpdated", "Not updated"),
      size: t("frontDesk.notUpdated", "Not updated"),
      view: t("frontDesk.notUpdated", "Not updated"),
      rate: t("frontDesk.notUpdated", "Not updated"),
      status: t("frontDesk.updating", "Updating"),
      note: t(
        "frontDesk.syncNote",
        "Room details will be synced from the room system.",
      ),
      amenities: [t("frontDesk.notUpdated", "Not updated")],
    };
    setRoomPreview({ record, detail: roomDetailsById[roomId] || fallback });
  };

  return (
    <section className="mt-6 rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-600">
            <CalendarCheck size={20} />
          </div>
          <div>
            <h3 className="font-bold text-slate-900">
              {t("frontDesk.todayTitle")}
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              {t("frontDesk.todayDescription")}
            </p>
          </div>
        </div>
        <span className="flex w-fit items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
          <Clock3 size={14} />
          {t("common.dateLabel")}
        </span>
      </div>
      <div className="border-b border-slate-100 p-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="flex items-center justify-between rounded-xl bg-blue-50/70 px-4 py-3">
              <div className="flex items-center gap-2">
                <LogIn size={16} className="text-blue-600" />
                <p className="text-sm font-semibold text-slate-800">
                  {t("frontDesk.waitingCheckIn")}
                </p>
              </div>
              <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-blue-700">
                {pendingArrivals}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-amber-50/70 px-4 py-3">
              <div className="flex items-center gap-2">
                <LogOut size={16} className="text-amber-600" />
                <p className="text-sm font-semibold text-slate-800">
                  {t("frontDesk.waitingCheckOut")}
                </p>
              </div>
              <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-amber-700">
                {pendingDepartures}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:justify-end">
            <DatePickerPopover
              value={selectedDate}
              onChange={setSelectedDate}
              placeholder="Chọn ngày"
              buttonClassName="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:border-blue-300 hover:text-blue-600"
            />
            <label className="relative flex items-center">
              <span className="sr-only">
                {t("frontDesk.filterList", "Filter list type")}
              </span>
              <select
                value={flowFilter}
                onChange={(event) =>
                  setFlowFilter(event.target.value as FlowFilter)
                }
                className="h-10 w-full appearance-none rounded-lg border border-slate-200 bg-white pl-3 pr-9 text-sm font-medium text-slate-700 outline-none focus:border-blue-400 sm:w-52"
              >
                <option value="all">{t("frontDesk.allToday")}</option>
                <option value="check-in">{t("frontDesk.onlyCheckIn")}</option>
                <option value="check-out">{t("frontDesk.onlyCheckOut")}</option>
              </select>
              <ChevronDown
                size={14}
                className="pointer-events-none absolute right-3 text-slate-400"
              />
            </label>
          </div>
        </div>
      </div>
      <div className="border-b border-slate-100 bg-slate-50/60 p-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-3 text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("frontDesk.searchPlaceholder")}
            className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
        </div>
      </div>
      <div className="divide-y divide-slate-100">
        {!groupArrivalComplete && groupArrivalState.status === "Chờ check-in" &&
          (flowFilter === "all" || flowFilter === "check-in") &&
          `${groupArrivalState.guest} ${groupArrivalState.id} ${groupArrivalState.rooms.join(" ")}`
            .toLowerCase()
            .includes(query.toLowerCase()) && (
            <BatchStayCard
              mode="check-in"
              title={groupArrivalState.guest}
              description={`${groupArrivalState.rooms.length} phòng · ${groupArrivalState.guests} khách · Nhận lúc ${groupArrivalState.time}`}
              items={groupArrivalState.rooms.map((room) => ({ id: room, title: `Phòng ${room}`, subtitle: groupArrivalState.id, status: checkedInGroupRooms.includes(room) ? "complete" as const : "pending" as const }))}
              selectedIds={checkedInGroupRooms}
              draftSelectedIds={selectedGroupRooms}
              actionLabel={`Check-in cả đoàn`}
              actionCount={groupArrivalState.rooms.length}
              actionDisabled={false}
              onAddService={() => openGroupServiceSelector(groupArrivalState.id, groupArrivalState.guest, groupArrivalState.rooms, groupArrivalState.guests)}
              onAction={(nextSelected) => {
                if (nextSelected.length > 0) {
                  const merged = Array.from(new Set([...checkedInGroupRooms, ...nextSelected]));
                  setCheckedInGroupRooms(merged);
                  setSelectedGroupRooms([]);
                  if (merged.length === groupArrivalState.rooms.length) {
                    setGroupArrivalState((current) => ({ ...current, status: "Đã check-in" }));
                  }
                }
              }}
            />
          )}
        {!groupDepartureComplete && groupDepartureState.status === "Đang ở" &&
          (flowFilter === "all" || flowFilter === "check-out") &&
          `${groupDepartureState.guest} ${groupDepartureState.id} ${groupDepartureState.rooms.join(" ")}`
            .toLowerCase()
            .includes(query.toLowerCase()) && (
            <BatchStayCard
              mode="check-out"
              title={groupDepartureState.guest}
              description={`${groupDepartureState.rooms.length} phòng · ${groupDepartureState.guests} khách · Trả lúc ${groupDepartureState.time}`}
              items={groupDepartureItems}
              selectedIds={confirmedGroupDepartureRooms}
              draftSelectedIds={selectedGroupDepartureRooms}
              actionLabel="Check-out cả đoàn"
              actionCount={groupDepartureState.rooms.length}
              actionDisabled={false}
              onAddService={() => openGroupServiceSelector(groupDepartureState.id, groupDepartureState.guest, groupDepartureState.rooms, groupDepartureState.guests)}
              checkoutSummaryRooms={groupCheckoutSummaryRooms}
              onAction={(nextSelected) => {
                if (nextSelected.length === 0) return;
                setSelectedGroupDepartureRooms(nextSelected);
                const selectedTotal = groupDepartureState.rooms
                  .filter((room) => nextSelected.includes(room))
                  .reduce((total, room) => { const index = groupDepartureState.rooms.indexOf(room); return total + groupDepartureState.roomAmounts[index] + groupDepartureState.services[index]; }, 0);
                if (selectedTotal > 0) setGroupCheckoutOpen(true);
                else confirmGroupCheckout(nextSelected);
              }}
            />
          )}
        <>
          {renderStatusGroup("Chờ xử lý", pendingRecords, false)}
          {renderStatusGroup("Đã check-in / Đã trả phòng", completedRecords, true)}
        </>
      </div>
      {filtered.length === 0 && (
        <div className="p-8 text-center">
          <p className="text-sm font-semibold text-slate-700">
            Không có lượt phù hợp trong hôm nay
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Thử đổi từ khoá tìm kiếm hoặc bộ lọc check-in/check-out.
          </p>
        </div>
      )}
      {warningAction && <EarlyLateStayNotice action={warningAction.flow} message={warningAction.message} fee={warningAction.fee} onCancel={() => setWarningAction(null)} onConfirm={() => { const action = warningAction; setWarningAction(null); if (action.flow === "check-in") completeRecord(action.id, action.flow); else setCheckoutRecord(filtered.find((record) => record.id === action.id) ?? null); }} />}
      {serviceRecord && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4" onMouseDown={() => setServiceRecord(null)}>
          <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><p className="text-xs font-bold uppercase tracking-wider text-blue-600">Dịch vụ cho khách</p><h3 className="mt-1 text-lg font-bold text-slate-900">{serviceRecord.guest} · {serviceRecord.room.split(" · ")[0]}</h3></div><button type="button" onClick={() => setServiceRecord(null)} className="text-2xl leading-none text-slate-400">×</button></div>
            <BookingServiceSelector rooms={serviceSelectorRooms} serviceMode={serviceModalMode} setServiceMode={setServiceModalMode} allRoomServices={serviceAllSelections} setAllRoomServices={setServiceAllSelections} roomServices={serviceRoomSelections} setRoomServices={setServiceRoomSelections} roomRanges={{}} fallbackRange={{ checkIn: "2026-01-01", checkOut: "2026-01-02" }} language="vi" nightsForRoom={() => 1} onContinue={saveRecordServices} onSkip={() => setServiceRecord(null)} continueLabel="Xác nhận" skipLabel="Đóng" />
          </div>
        </div>
      )}
      <div className="border-t border-slate-100 bg-slate-50/60 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-amber-500" />
              <h3 className="font-bold text-slate-900">
                {t("frontDesk.cleaningAssignment")}
              </h3>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {t("frontDesk.cleaningDescription")}
            </p>
          </div>
          <span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">
            {cleaningTasks.filter((task) => task.assignee).length}/
            {cleaningTasks.length} {t("frontDesk.assigned")}
          </span>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          {cleaningTasks.map((task) => (
            <div
              key={task.room}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-slate-900">
                    {t("room.roomLabel", "Room")} {task.room}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">{task.type}</p>
                </div>
                <span className="rounded-md bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-700">
                  {t("frontDesk.needsCleaning")}
                </span>
              </div>
              <p className="mt-3 text-xs text-slate-500">{task.detail}</p>
              <label className="mt-3 flex items-center gap-2 text-xs font-semibold text-slate-600">
                <UserRound size={14} className="text-slate-400" />
                <select
                  value={task.assignee}
                  onChange={(event) =>
                    assignCleaner(task.room, event.target.value)
                  }
                  className="h-9 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 text-xs font-normal outline-none focus:border-blue-400"
                >
                  <option value="">{t("frontDesk.chooseEmployee")}</option>
                  {cleaningStaff.map((employee) => (
                    <option key={employee}>{employee}</option>
                  ))}
                </select>
              </label>
            </div>
          ))}
        </div>
      </div>
      {selectingGroupRoom && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4"
          onMouseDown={() => setSelectingGroupRoom(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">
                  Check-in từng phòng
                </p>
                <h3 className="mt-1 text-xl font-bold text-slate-900">
                  Chọn phòng khách nhận hôm nay
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Có thể chọn hoặc bỏ chọn trước khi xác nhận.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedGroupRooms([]);
                  setSelectingGroupRoom(false);
                }}
                className="text-2xl leading-none text-slate-400"
              >
                ×
              </button>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              {groupArrivalState.rooms
                .filter((room) => !checkedInGroupRooms.includes(room))
                .map((room) => {
                  const selected = selectedGroupRooms.includes(room);
                  return (
                    <button
                      type="button"
                      key={room}
                      onClick={() => toggleGroupRoom(room)}
                      className={`rounded-xl border p-4 text-left transition ${selected ? "border-blue-500 bg-blue-50 ring-2 ring-blue-100" : "border-slate-200 bg-white hover:border-blue-400 hover:bg-blue-50"}`}
                    >
                      <span className="flex items-center justify-between text-xs font-semibold text-slate-500">
                        <span>Phòng</span>
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleGroupRoom(room)}
                          onClick={(event) => event.stopPropagation()}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                      </span>
                      <span className="mt-1 block text-lg font-bold text-slate-900">
                        {room}
                      </span>
                      <span className="mt-1 block text-xs text-blue-700">
                        {selected ? "Đã chọn · Bấm để bỏ" : "Bấm để chọn"}
                      </span>
                    </button>
                  );
                })}
            </div>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setSelectedGroupRooms([]);
                  setSelectingGroupRoom(false);
                }}
                className="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={selectedGroupRooms.length === 0}
                onClick={() => {
                  checkInGroup(selectedGroupRooms);
                  setSelectedGroupRooms([]);
                  setSelectingGroupRoom(false);
                }}
                className="flex-1 rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Xác nhận check-in ({selectedGroupRooms.length})
              </button>
            </div>
          </div>
        </div>
      )}
      {checkoutRecord &&
        (() => {
          const services = recordServices[checkoutRecord.id] ?? checkoutRecord.services ?? [];
          const serviceTotal = services.reduce(
            (total, service) => total + service.amount,
            0,
          );
          const lateFee = checkoutRecord.lateFee || 0;
          const totalDue = serviceTotal + lateFee;
          const formatMoney = (amount: number) =>
            `${amount.toLocaleString("vi-VN")}đ`;
          return (
            <div
              className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4"
              onMouseDown={() => setCheckoutRecord(null)}
            >
              <div
                className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl"
                onMouseDown={(event) => event.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">
                      Đối soát check-out
                    </p>
                    <h3 className="mt-1 text-xl font-bold text-slate-900">
                      {checkoutRecord.guest} ·{" "}
                      {checkoutRecord.room.split(" · ")[0]}
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Booking {checkoutRecord.id}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCheckoutRecord(null)}
                    className="text-2xl leading-none text-slate-400"
                  >
                    ×
                  </button>
                </div>
                <div className="mt-5 space-y-3 text-sm">
                  <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-3">
                    <span>
                      <span className="block font-semibold text-slate-700">
                        Tiền phòng
                      </span>
                      <span className="text-xs text-emerald-700">
                        Đã thanh toán 100% lúc đặt · Mã GD: {checkoutRecord.id}
                      </span>
                    </span>
                    <strong className="text-emerald-700">0đ</strong>
                  </div>
                  <div className="rounded-lg border border-slate-200 p-3">
                    <p className="font-semibold text-slate-700">
                      Dịch vụ phát sinh
                    </p>
                    {services.length === 0 && (
                      <p className="mt-2 text-xs text-slate-400">
                        Không có dịch vụ phát sinh.
                      </p>
                    )}
                    {services.map((service) => (
                      <div
                        key={service.name}
                        className="mt-2 flex justify-between text-slate-600"
                      >
                        <span>
                          {service.name} x{service.quantity}
                        </span>
                        <span className="font-semibold">
                          {formatMoney(service.amount)}
                        </span>
                      </div>
                    ))}
                    {lateFee > 0 && (
                      <div className="mt-2 flex justify-between border-t border-slate-100 pt-2 text-slate-600">
                        <span>Phụ thu check-out trễ</span>
                        <span className="font-semibold">
                          {formatMoney(lateFee)}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-200 pt-4">
                    <span className="font-bold text-slate-900">
                      Tổng tiền cần thanh toán thêm
                    </span>
                    <strong className="text-lg text-blue-700">
                      {formatMoney(totalDue)}
                    </strong>
                  </div>
                </div>
                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setCheckoutRecord(null)}
                    className="rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-600"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    onClick={confirmCheckout}
                    className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
                  >
                    <CreditCard size={16} />
                    Xác nhận Check-out
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
      {groupCheckoutOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4" onMouseDown={() => setGroupCheckoutOpen(false)}>
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">Đối soát check-out cả đoàn</p>
                <h3 className="mt-1 text-xl font-bold text-slate-900">{groupDepartureState.guest}</h3>
                <p className="mt-1 text-sm text-slate-500">{selectedGroupDepartureRooms.length} phòng · Booking {groupDepartureState.id}</p>
              </div>
              <button type="button" onClick={() => setGroupCheckoutOpen(false)} className="text-2xl leading-none text-slate-400">×</button>
            </div>
            <div className="mt-5">
              <CheckoutSummary rooms={groupCheckoutSummaryRooms} />
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setGroupCheckoutOpen(false)} className="rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-600">Hủy</button>
              <button type="button" onClick={() => confirmGroupCheckout()} className="flex w-56 shrink-0 items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"><CreditCard size={16} />Thanh toán & Check-out</button>
            </div>
          </div>
        </div>
      )}
      {roomPreview && (
        <div
          className="fixed inset-0 z-40 grid place-items-center bg-slate-950/35 p-4"
          onMouseDown={() => setRoomPreview(null)}
        >
          <div
            className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-2xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">
                  Chi tiết phòng
                </p>
                <h3 className="mt-1 text-xl font-bold text-slate-900">
                  Phòng {roomPreview.detail.id} · {roomPreview.detail.type}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Booking {roomPreview.record.id} · Khách{" "}
                  {roomPreview.record.guest}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRoomPreview(null)}
                className="text-2xl leading-none text-slate-400"
              >
                ×
              </button>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-semibold text-slate-500">
                  Thông tin cơ bản
                </p>
                <div className="mt-3 space-y-2 text-sm text-slate-700">
                  <p>
                    <span className="font-semibold">Tầng:</span>{" "}
                    {roomPreview.detail.floor}
                  </p>
                  <p>
                    <span className="font-semibold">Giường:</span>{" "}
                    {roomPreview.detail.beds}
                  </p>
                  <p>
                    <span className="font-semibold">Diện tích:</span>{" "}
                    {roomPreview.detail.size}
                  </p>
                  <p>
                    <span className="font-semibold">Hướng:</span>{" "}
                    {roomPreview.detail.view}
                  </p>
                  <p>
                    <span className="font-semibold">Giá:</span>{" "}
                    {roomPreview.detail.rate}
                  </p>
                </div>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-semibold text-slate-500">
                  Trạng thái vận hành
                </p>
                <div className="mt-3 space-y-2 text-sm text-slate-700">
                  <p>
                    <span className="font-semibold">Tình trạng phòng:</span>{" "}
                    {roomPreview.detail.status}
                  </p>
                  <p>
                    <span className="font-semibold">Lượt hiện tại:</span>{" "}
                    {roomPreview.record.flow === "check-in"
                      ? "Check-in"
                      : "Check-out"}{" "}
                    lúc {roomPreview.record.time}
                  </p>
                  <p>
                    <span className="font-semibold">Trạng thái lượt:</span>{" "}
                    {roomPreview.record.status}
                  </p>
                  <p>
                    <span className="font-semibold">Ghi chú:</span>{" "}
                    {roomPreview.detail.note}
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-4 rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-semibold text-slate-500">
                Tiện ích phòng
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {roomPreview.detail.amenities.map((amenity) => (
                  <span
                    key={amenity}
                    className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700"
                  >
                    {amenity}
                  </span>
                ))}
              </div>
            </div>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setRoomPreview(null)}
                className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}
      {pendingCleaning && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/30 p-4"
          onMouseDown={() => setPendingCleaning(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-600">
                  Check-out hoàn tất
                </p>
                <h3 className="mt-1 text-lg font-bold text-slate-900">
                  Phân công dọn phòng {pendingCleaning.room}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Chọn một trong hai nhân viên để bắt đầu dọn{" "}
                  {pendingCleaning.type}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPendingCleaning(null)}
                className="text-2xl leading-none text-slate-400"
              >
                ×
              </button>
            </div>
            <div className="mt-5 space-y-2">
              {cleaningStaff.slice(0, 2).map((employee) => (
                <button
                  type="button"
                  key={employee}
                  onClick={() => {
                    assignCleaner(pendingCleaning.room, employee);
                    setPendingCleaning(null);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl border border-slate-200 p-3 text-left transition hover:border-amber-300 hover:bg-amber-50"
                >
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-amber-100 text-xs font-bold text-amber-700">
                    {employee
                      .split(" ")
                      .map((part) => part[0])
                      .slice(-2)
                      .join("")}
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-slate-800">
                      {employee}
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-500">
                      Housekeeping · Có thể nhận ca
                    </span>
                  </span>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setPendingCleaning(null)}
              className="mt-5 w-full rounded-lg border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              Để sau
            </button>
          </div>
        </div>
      )}
      {checkedInGroupRooms.length > 0 && (flowFilter === "all" || flowFilter === "check-in") && (
        <div className="border-t border-slate-100 bg-blue-50/40 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-bold text-slate-900">
                Phòng đoàn đã check-in
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Bấm “Bỏ check-in” nếu nhận nhầm phòng để chọn lại.
              </p>
            </div>
            <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-blue-700">
              {checkedInGroupRooms.length}/{groupArrivalState.rooms.length}{" "}
              phòng
            </span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {checkedInGroupRooms.map((room) => (
              <button
                type="button"
                key={room}
                onClick={() => undoGroupRoomCheckIn(room)}
                className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-700 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700"
              >
                Phòng {room} · Bỏ check-in
              </button>
            ))}
          </div>
        </div>
      )}
      {selectedGroupDepartureRooms.length > 0 && (flowFilter === "all" || flowFilter === "check-out") && (
        <div className="border-t border-slate-100 bg-amber-50/40 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-bold text-slate-900">
                Phòng đoàn đã check-out
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Bấm “Bỏ check-out” nếu chọn nhầm phòng để chọn lại.
              </p>
            </div>
            <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-amber-700">
              {selectedGroupDepartureRooms.length}/{groupDepartureState.rooms.length}{" "}
              phòng
            </span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {selectedGroupDepartureRooms.map((room) => (
              <button
                type="button"
                key={room}
                onClick={() => undoGroupRoomCheckOut(room)}
                className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs font-semibold text-amber-700 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700"
              >
                Phòng {room} · Bỏ check-out
              </button>
            ))}
          </div>
        </div>
      )}
      {selectingGroupRoom && (
        <div
          className="fixed inset-0 z-60 grid place-items-center bg-slate-950/40 p-4"
          onMouseDown={() => {
            setSelectedGroupRooms([]);
            setSelectingGroupRoom(false);
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">
                  Check-in từng phòng
                </p>
                <h3 className="mt-1 text-xl font-bold text-slate-900">
                  Cập nhật trạng thái phòng
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Bấm vào phòng để đổi trạng thái. Phòng vẫn giữ trong danh sách
                  để chỉnh lại.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedGroupRooms([]);
                  setSelectingGroupRoom(false);
                }}
                className="text-2xl leading-none text-slate-400"
              >
                ×
              </button>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              {groupArrivalState.rooms.map((room) => {
                const checkedIn = checkedInGroupRooms.includes(room);
                return (
                  <button
                    type="button"
                    key={room}
                    onClick={() => toggleGroupRoomImmediately(room)}
                    className={`rounded-xl border p-4 text-left transition ${checkedIn ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white hover:border-blue-400 hover:bg-blue-50"}`}
                  >
                    <span className="flex items-center justify-between text-xs font-semibold text-slate-500">
                      <span>Phòng</span>
                      <span
                        className={`rounded-full px-2 py-1 text-[10px] ${checkedIn ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}
                      >
                        {checkedIn ? "Đã check-in" : "Chờ check-in"}
                      </span>
                    </span>
                    <span className="mt-2 block text-lg font-bold text-slate-900">
                      {room}
                    </span>
                    <span
                      className={`mt-1 block text-xs ${checkedIn ? "text-rose-600" : "text-blue-700"}`}
                    >
                      {checkedIn ? "Bấm để hoàn tác" : "Bấm để check-in"}
                    </span>
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedGroupRooms([]);
                setSelectingGroupRoom(false);
              }}
              className="mt-5 w-full rounded-lg border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              Đóng
            </button>
          </div>
        </div>
      )}
      <BatchActionDialog
        open={selectingGroupRoom}
        mode="check-in"
        rooms={groupDialogRooms}
        selectedIds={checkedInGroupRooms}
        onToggle={toggleGroupRoomImmediately}
        onClose={() => setSelectingGroupRoom(false)}
        onConfirm={() => setSelectingGroupRoom(false)}
      />
      <BatchActionDialog
        open={batchCheckoutOpen}
        mode="check-out"
        rooms={batchDialogRooms}
        selectedIds={selectedDepartureIds}
        checkoutSummaryRooms={checkoutRoomsFromRecords(departureState.filter((record) => selectedDepartureIds.includes(record.id)))}
        onToggle={toggleDepartureSelection}
        onClose={() => setBatchCheckoutOpen(false)}
        onConfirm={confirmBatchCheckout}
      />
    </section>
  );
}
