import {
  AlarmClock,
  Banknote,
  Ban,
  CalendarCheck,
  ClipboardList,
  ConciergeBell,
  CreditCard,
  DoorOpen,
  Info,
  Tag,
} from "lucide-react";
import { localizedText } from "../i18n";

const getRuleSections = () => [
  {
    title: localizedText("Đặt phòng", "Booking"),
    description: localizedText(
      "Kiểm tra ngày lưu trú, loại phòng, số lượng khách và thông tin liên hệ trước khi xác nhận booking.",
      "Verify stay dates, room type, guest count, and contact details before confirming a booking.",
    ),
    icon: CalendarCheck,
    tone: "blue",
    points: [
      localizedText("Giá và tình trạng phòng được áp dụng theo booking đã xác nhận.", "The confirmed booking determines the applicable room rate and availability."),
      localizedText("Các dịch vụ đặt kèm được tính theo số lượng và đơn giá ghi trên booking.", "Booked add-on services are charged according to the quantity and unit price on the booking."),
    ],
  },
  {
    title: localizedText("Khuyến mãi", "Promotions"),
    description: localizedText(
      "Mỗi mã khuyến mãi chỉ được áp dụng một lần cho từng khách hàng.",
      "Each promotion code can be applied only once per guest.",
    ),
    icon: Tag,
    tone: "violet",
    points: [
      localizedText("Khách có tài khoản chính thức được sử dụng mỗi mã tối đa một lần cho tài khoản đó.", "A registered customer can use each promotion code at most once for their account."),
      localizedText("Khách vãng lai cũng chỉ được sử dụng mỗi mã một lần; ghi nhận việc sử dụng theo thông tin khách trên booking.", "Walk-in guests may also use each promotion code only once; record usage against the guest details on the booking."),
      localizedText("Khi mã đã được áp dụng vào booking, quyền sử dụng mã được tính là đã dùng. Nếu booking đó bị hủy, mã không được hoàn lại và khách không thể dùng lại mã đó.", "Once a code has been applied to a booking, it counts as used. If that booking is canceled, the code is not restored and the guest cannot use it again."),
    ],
  },
  {
    title: localizedText("Check-in sớm", "Early check-in"),
    description: localizedText(
      "Có thể phát sinh phụ thu tùy thời điểm khách nhận phòng thực tế so với giờ check-in đã đặt.",
      "A surcharge may apply depending on the actual arrival time compared with the scheduled check-in.",
    ),
    icon: DoorOpen,
    tone: "emerald",
    points: [
      localizedText("Trước 06:00: 100% giá phòng ngày đó.", "Before 06:00: 100% of that day's room rate."),
      localizedText("Từ 06:00 đến 09:00: 50% giá phòng ngày đó.", "From 06:00 to 09:00: 50% of that day's room rate."),
      localizedText("Sau 09:00 đến trước giờ check-in đã đặt: 30% giá phòng ngày đó.", "After 09:00 and before the scheduled check-in: 30% of that day's room rate."),
      localizedText("Nếu nhận phòng từ ngày trước ngày đặt, tính 100% giá phòng của ngày nhận sớm đó; nhận sớm nhiều ngày thì tính đủ giá từng ngày sớm.", "If check-in is on an earlier date than booked, charge 100% of the room rate for that early-arrival date; for multiple early days, charge the full rate for each day."),
    ],
  },
  {
    title: localizedText("Check-out trễ", "Late check-out"),
    description: localizedText(
      "Phụ thu được tính theo giá phòng ngày check-out và tự cập nhật vào tổng booking khi phát sinh.",
      "The surcharge is based on the room rate for the checkout date and is automatically added to the booking total when incurred.",
    ),
    icon: AlarmClock,
    tone: "amber",
    points: [
      localizedText("Đến trước 12:30: không tính phụ thu.", "Before 12:30: no surcharge."),
      localizedText("Từ 12:30 đến 15:00: 30% giá phòng ngày đó.", "From 12:30 through 15:00: 30% of that day's room rate."),
      localizedText("Sau 15:00 đến 18:00: 50% giá phòng ngày đó.", "After 15:00 through 18:00: 50% of that day's room rate."),
      localizedText("Sau 18:00 hoặc trả sang ngày hôm sau: 100% giá phòng ngày đó.", "After 18:00 or checkout on the following day: 100% of that day's room rate."),
    ],
  },
  {
    title: localizedText("Chính sách hủy phòng", "Room cancellation policy"),
    description: localizedText(
      "Áp dụng khi hủy riêng một phòng trong booking; khoản phạt được tính theo giờ check-in của phòng đó.",
      "Applies when canceling an individual room in a booking; the penalty is based on that room's check-in time.",
    ),
    icon: Ban,
    tone: "rose",
    points: [
      localizedText("Chỉ phòng đang ở trạng thái PENDING (chưa check-in) mới được hủy. Phòng đã check-in hoặc checkout không thể chỉnh sửa hay hủy.", "Only rooms in PENDING status (not checked in) can be canceled. Checked-in or checked-out rooms cannot be edited or canceled."),
      localizedText("Từ 72 giờ trước check-in trở lên: không phạt tiền phòng.", "At least 72 hours before check-in: no room-charge penalty."),
      localizedText("Từ 24 đến dưới 72 giờ trước check-in: phạt 50% phần tiền phòng đã thanh toán được phân bổ cho phòng đó.", "From 24 to under 72 hours before check-in: the penalty is 50% of the paid room amount allocated to that room."),
      localizedText("Dưới 24 giờ trước check-in: phạt 100% phần tiền phòng đã thanh toán được phân bổ cho phòng đó.", "Under 24 hours before check-in: the penalty is 100% of the paid room amount allocated to that room."),
      localizedText("Khi hủy phòng, các dịch vụ chưa bị hủy của phòng đó sẽ tự động bị hủy theo. Dịch vụ đã sử dụng thì không thể hủy phòng.", "When a room is canceled, its active services are canceled automatically. A room cannot be canceled if a service has already been used."),
      localizedText("Hủy riêng phòng không tạo yêu cầu hoàn tiền ngay. Booking được đối soát khi checkout; nếu đã thanh toán dư, khoản dư được xử lý hoàn sau khi toàn bộ booking checkout.", "Canceling one room does not create an immediate refund request. The booking is reconciled at checkout; any overpayment is refunded after every room in the booking has checked out."),
    ],
  },
  {
    title: localizedText("Hoàn tiền do hủy booking", "Refunds for booking cancellations"),
    description: localizedText(
      "Mức khấu trừ tiền phòng phụ thuộc vào thời điểm yêu cầu hủy so với giờ check-in đầu tiên của booking.",
      "The room-charge cancellation penalty depends on when the cancellation is requested relative to the booking's earliest check-in.",
    ),
    icon: Ban,
    tone: "rose",
    points: [
      localizedText("Từ 72 giờ trước check-in trở lên: không áp dụng phạt tiền phòng.", "At least 72 hours before check-in: no room-charge cancellation penalty."),
      localizedText("Từ 24 đến dưới 72 giờ: mức phạt là 50% phần tiền phòng được phân bổ.", "From 24 to under 72 hours: the penalty is 50% of the allocated room payment."),
      localizedText("Dưới 24 giờ hoặc khách không đến: mức phạt là 100% phần tiền phòng được phân bổ.", "Under 24 hours or no-show: the penalty is 100% of the allocated room payment."),
      localizedText("Toàn bộ phần tiền đã thanh toán được phân bổ cho dịch vụ được hoàn; mức phạt hủy chỉ khấu trừ vào phần tiền phòng.", "The full amount paid and allocated to services is refunded; the cancellation penalty is deducted from the room portion only."),
      localizedText("Số tiền hoàn cuối cùng căn cứ vào số đã thanh toán và cách phân bổ giữa tiền phòng, dịch vụ, giảm giá và phụ thu của booking; hãy kiểm tra yêu cầu hoàn trước khi xác nhận.", "The final refund is based on the amount paid and its allocation across room charges, services, discounts, and surcharges; review the refund request before confirming it."),
    ],
  },
  {
    title: localizedText("Hoàn tiền dư khi checkout", "Remaining-balance refunds at checkout"),
    description: localizedText(
      "Đây là khoản hoàn phát sinh khi đối soát checkout, không phải khoản hoàn do hủy booking.",
      "This refund is generated during checkout reconciliation, not from canceling a booking.",
    ),
    icon: Banknote,
    tone: "sky",
    points: [
      localizedText("Phát sinh khi khách đã thanh toán nhiều hơn tổng chi phí thực tế, ví dụ dịch vụ đã thanh toán nhưng chưa sử dụng được hủy trước checkout.", "It applies when the guest has paid more than the final actual charges—for example, a prepaid service that was not used and is canceled before checkout."),
      localizedText("Hoàn theo số tiền khách thực trả vượt quá số tiền cuối cùng phải thanh toán; không áp dụng mức phạt hủy phòng.", "Refund the amount actually paid above the final balance due; booking-cancellation room penalties do not apply."),
      localizedText("Kiểm tra lại tiền phòng, dịch vụ đã dùng, dịch vụ đã hủy, phụ thu và giảm giá trước khi xác nhận số tiền hoàn.", "Verify room charges, consumed and canceled services, surcharges, and discounts before confirming the refund amount."),
      localizedText("Xử lý theo phương thức hoàn đã chọn: tiền mặt tại quầy hoặc chuyển khoản/hoàn online.", "Process using the selected refund method: cash at the front desk or bank transfer/online refund."),
    ],
  },
  {
    title: localizedText("Dịch vụ", "Services"),
    description: localizedText(
      "Nhân viên xác nhận dịch vụ sau khi khách sử dụng. Dịch vụ đã sử dụng không thể hủy.",
      "Staff should mark a service as used after the guest consumes it. Used services cannot be canceled.",
    ),
    icon: ConciergeBell,
    tone: "violet",
    points: [
      localizedText("Đối chiếu tên dịch vụ, số lượng và đơn giá với khách.", "Confirm the service name, quantity, and unit price with the guest."),
      localizedText("Nếu dịch vụ chưa sử dụng, hãy hủy trước khi checkout để cập nhật lại số tiền khách cần thanh toán hoặc được hoàn.", "If a service was not used, cancel it before checkout so the amount due or refundable is recalculated."),
    ],
  },
  {
    title: localizedText("Đối soát thanh toán", "Payment settlement"),
    description: localizedText(
      "Tổng cuối cùng bao gồm tiền phòng, dịch vụ, phụ thu check-in sớm, check-out trễ, phụ thu khác và giảm giá.",
      "The final total includes room charges, services, early check-in and late check-out surcharges, other surcharges, and discounts.",
    ),
    icon: CreditCard,
    tone: "sky",
    points: [
      localizedText("So sánh tổng booking với số đã thanh toán để xác định số còn phải thu hoặc số tiền cần hoàn.", "Compare the booking total with the amount paid to determine any balance due or refund."),
      localizedText("Chọn đúng phương thức hoàn tiền và xác nhận giao tiền/chuyển khoản theo quy trình của khách sạn.", "Choose the correct refund method and confirm cash handover or bank transfer according to hotel procedure."),
      localizedText("Hoàn tiền qua tài khoản ngân hàng dự kiến mất từ 1–3 ngày.", "Bank-account refunds are expected to take 1–3 days."),
      localizedText("Khách sẽ nhận email xác nhận khi đặt booking, khi thanh toán được ghi nhận, khi checkout hoàn tất và khi khoản hoàn tiền đã được xử lý. Email chỉ gửi được khi booking có địa chỉ email hợp lệ.", "The guest receives email confirmations when a booking is created, a payment is recorded, checkout is completed, and a refund has been processed. Emails require a valid address on the booking."),
    ],
  },
];

const toneClasses: Record<string, { icon: string; bullet: string }> = {
  blue: { icon: "bg-blue-50 text-blue-700", bullet: "bg-blue-500" },
  emerald: { icon: "bg-emerald-50 text-emerald-700", bullet: "bg-emerald-500" },
  amber: { icon: "bg-amber-50 text-amber-700", bullet: "bg-amber-500" },
  rose: { icon: "bg-rose-50 text-rose-700", bullet: "bg-rose-500" },
  violet: { icon: "bg-violet-50 text-violet-700", bullet: "bg-violet-500" },
  sky: { icon: "bg-sky-50 text-sky-700", bullet: "bg-sky-500" },
};

export default function HotelRulesWorkspace() {
  const ruleSections = getRuleSections();
  return (
    <div className="mt-6 space-y-5">
      <section className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-5 sm:p-7">
        <div className="flex items-start gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-blue-600 text-white shadow-sm">
            <ClipboardList size={23} />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-700">
              {localizedText("Hướng dẫn nhân viên", "Staff reference")}
            </p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">
              {localizedText("Quy định vận hành lưu trú", "Stay operation guidelines")}
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              {localizedText(
                "Tổng hợp quy tắc hệ thống đang áp dụng cho đặt phòng, nhận/trả phòng, hủy booking, dịch vụ và đối soát. Hãy kiểm tra chi tiết booking trước khi xác nhận các khoản thu hoặc hoàn.",
                "A summary of the rules currently applied by the system for bookings, check-in/out, cancellations, services, and settlement. Review booking details before confirming charges or refunds.",
              )}
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {ruleSections.map(({ title, description, icon: Icon, tone, points }) => {
          const colors = toneClasses[tone];
          return (
            <section key={title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${colors.icon}`}>
                  <Icon size={19} />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-slate-900">{title}</h3>
                  <p className="mt-1 text-sm leading-5 text-slate-500">{description}</p>
                </div>
              </div>
              <ul className="mt-4 space-y-2.5 border-t border-slate-100 pt-4">
                {points.map((point) => (
                  <li key={point} className="flex gap-2.5 text-sm leading-5 text-slate-700">
                    <span className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${colors.bullet}`} />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      <aside className="flex gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-5 text-slate-600">
        <Info size={18} className="mt-0.5 shrink-0 text-blue-600" />
        <p>
          {localizedText(
            "Các tỷ lệ phụ thu và mức phạt trên là quy tắc hiện được hệ thống áp dụng. Khi tư vấn khách, hãy đối chiếu booking, chính sách giá của khách sạn và yêu cầu hoàn thực tế.",
            "These surcharge rates and penalties reflect the rules currently applied by the system. When advising a guest, verify the booking, hotel pricing policy, and actual refund request.",
          )}
        </p>
      </aside>
    </div>
  );
}
