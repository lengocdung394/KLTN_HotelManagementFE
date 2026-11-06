import { Download, HelpCircle, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTranslation } from "react-i18next";

type GuideSection = {
  title: [string, string];
  imageVi?: string;
  imageEn?: string;
  imageAlt?: [string, string];
  relatedScreenshots?: { src: string; alt: [string, string] }[];
  route?: string;
  steps: [string, string][];
  tip?: [string, string];
};

const guideSections: GuideSection[] = [
  {
    title: ["1. Tổng quan chi nhánh", "1. Branch overview"],
    imageVi: "/user-guide/screenshots/overview.jpg",
    imageEn: "/user-guide/screenshots/overview.jpg",
    imageAlt: ["Ảnh chụp giao diện Tổng quan thực tế; thông tin nhận diện đã được làm mờ", "Actual Overview screen; identifying details have been blurred"],
    relatedScreenshots: [
      { src: "/user-guide/screenshots/overview-schedule.jpg", alt: ["Ảnh chụp lịch check-in/check-out và dịch vụ cần xác nhận", "Check-in/check-out schedule and services awaiting confirmation"] },
    ],
    route: "/overview",
    steps: [
      ["Mở mục Tổng quan ở menu bên trái. Các thẻ trên cùng tóm tắt doanh thu, công suất phòng, khách đang lưu trú và lượt đến/trả phòng.", "Open Overview from the left menu. The top cards summarize revenue, room occupancy, guests in-house, and arrivals/departures."],
      ["Kéo xuống khu vực lịch check-in/check-out. Dùng nút mũi tên hoặc ô ngày để xem lịch một ngày khác; nút Hôm nay đưa về ngày hiện tại.", "Scroll to the check-in/check-out schedule. Use the arrows or date field to view another day; Today returns to the current date."],
      ["Chọn tab khách chờ check-in, khách chờ check-out hoặc đã check-in sớm. Chọn một dòng để mở thao tác lễ tân.", "Select the waiting check-in, waiting check-out, or early check-in tab. Select a row to open the front-desk workflow."],
      ["Khu vực Dịch vụ cần xác nhận liệt kê phần dịch vụ còn chưa xác nhận sử dụng. Nhấn Xác nhận dịch vụ để xử lý.", "Services to confirm lists service quantities that have not yet been confirmed as used. Select Confirm services to process them."],
      ["Các chỉ số có thể hiện dấu gạch ngang hoặc lỗi khi dữ liệu đang tải/không khả dụng; không xem dữ liệu thiếu là 0.", "Metrics may show a dash or error while data is loading or unavailable; do not treat missing data as zero."],
    ],
    tip: ["Kiểm tra đúng ngày và chi nhánh trước khi xử lý booking; số liệu Tổng quan phục vụ theo dõi nhanh, còn chi tiết cần xem ở phân hệ tương ứng.", "Verify the date and branch before acting on bookings. Overview is for quick monitoring; use the relevant module for full details."],
  },
  {
    title: ["2. Tạo và tra cứu booking", "2. Create and find bookings"],
    imageVi: "/user-guide/screenshots/bookings.jpg",
    imageEn: "/user-guide/screenshots/bookings.jpg",
    imageAlt: ["Ảnh chụp trang Đặt phòng thực tế", "Actual Bookings screen"],
    relatedScreenshots: [
      { src: "/user-guide/screenshots/booking-list.jpg", alt: ["Ảnh chụp trang Danh sách booking thực tế", "Actual Booking list screen"] },
    ],
    route: "/bookings",
    steps: [
      ["Mở Quản lý đặt phòng → Đặt phòng. Chọn ngày nhận và trả phòng trước; ngày trả phải sau ngày nhận.", "Open Booking management → Create booking. Select check-in and check-out dates first; check-out must be later than check-in."],
      ["Chọn loại phòng và số lượng phòng còn trống. Xem thông tin sức chứa, giá và phụ thu; ngày lịch bận không thể chọn.", "Choose an available room type and quantity. Review capacity, rate, and surcharges; busy-schedule dates cannot be selected."],
      ["Nhập thông tin khách lưu trú cho từng phòng. Kiểm tra tên, số điện thoại và số lượng khách trước khi tiếp tục.", "Enter guest details for each room. Verify names, phone numbers, and guest counts before continuing."],
      ["Thêm dịch vụ/ưu đãi nếu phù hợp. Rà soát lại ngày, phòng, khách, dịch vụ và tổng tiền rồi mới xác nhận.", "Add services/promotions if applicable. Review dates, rooms, guests, services, and the total before confirming."],
      ["Mở Danh sách booking để tìm booking, dùng các bộ lọc có sẵn và mở dòng cần xem. Chỉ thao tác theo trạng thái booking và quyền tài khoản.", "Open Booking list to find bookings, use available filters, and open the relevant record. Actions depend on booking status and account permissions."],
      ["Khi chỉnh sửa booking, xác nhận thay đổi ngày/phòng có còn hợp lệ và đọc lại số tiền mới trước khi lưu.", "When editing a booking, confirm changed dates/rooms are still valid and review the updated amount before saving."],
    ],
    tip: ["Không xác nhận nếu thông tin liên hệ hoặc phòng chưa đúng. Với booking đã nhận phòng/hoàn tất/hủy, một số thay đổi sẽ bị khóa.", "Do not confirm if contact or room details are incorrect. Some edits are locked for checked-in, completed, or cancelled bookings."],
  },
  {
    title: ["3. Check-in / Check-out tại quầy", "3. Front-desk check-in / check-out"],
    imageVi: "/user-guide/screenshots/check-in-out.jpg",
    imageEn: "/user-guide/screenshots/check-in-out.jpg",
    imageAlt: ["Ảnh chụp trang Check-in / Check-out thực tế", "Actual Check-in / Check-out screen"],
    route: "/check-in-out",
    steps: [
      ["Mở Check-in / Check-out từ menu hoặc chọn Mở quầy lễ tân trên Tổng quan.", "Open Check-in / Check-out from the menu or select Open front desk on Overview."],
      ["Chọn ngày và tab Nhận phòng hoặc Trả phòng. Tìm đúng booking/khách trong danh sách chờ.", "Select the date and Check-in or Check-out tab. Find the correct booking/guest in the waiting list."],
      ["Mở chi tiết, đối chiếu họ tên, số điện thoại, mã booking, số phòng, ngày ở, số khách và trạng thái thanh toán.", "Open the details and verify guest name, phone, booking reference, room, stay dates, guest count, and payment status."],
      ["Check-in: xác nhận đúng khách/phòng rồi thực hiện nhận phòng. Nếu đến sớm hoặc có phụ thu, kiểm tra nội dung và phí trước khi xác nhận.", "Check-in: confirm the guest and room, then complete check-in. For early arrival or a surcharge, review the details and amount before confirming."],
      ["Check-out: kiểm tra dịch vụ, khoản phát sinh, tiền đã thu và tiền thừa/hoàn. Chọn phương án hoàn theo yêu cầu khách và chính sách.", "Check-out: review services, extra charges, payments received, and any change/refund due. Choose the refund option according to the guest's request and policy."],
      ["Với booking nhiều phòng, kiểm tra từng phòng/khách; chỉ dùng thao tác nhóm sau khi đã rà soát toàn bộ các dòng được chọn.", "For multi-room bookings, review each room/guest. Use a group action only after checking every selected record."],
    ],
    tip: ["Không tự xác nhận tiền mặt đã hoàn nếu chưa giao/hoàn thực tế. Yêu cầu hoàn qua ngân hàng có thể cần xử lý tại Phê duyệt hoàn tiền.", "Do not mark a cash refund complete until it has actually been returned. Bank refunds may need to be handled in Refund approvals."],
  },
  {
    title: ["4. Quản lý phòng và lịch bận", "4. Room management and busy schedules"],
    imageVi: "/user-guide/screenshots/rooms.jpg",
    imageEn: "/user-guide/screenshots/rooms.jpg",
    imageAlt: ["Ảnh chụp trang Quản lý phòng thực tế", "Actual Room management screen"],
    relatedScreenshots: [
      { src: "/user-guide/screenshots/room-pricing.jpg", alt: ["Ảnh chụp phần cấu hình giá phòng", "Room pricing configuration screen"] },
      { src: "/user-guide/screenshots/hotel-closures.jpg", alt: ["Ảnh chụp trang Lịch bận thực tế; thông tin lịch đã được làm mờ", "Actual Busy schedule screen; schedule details have been blurred"] },
      { src: "/user-guide/screenshots/hotel-rules.jpg", alt: ["Ảnh chụp trang Nội quy khách sạn", "Hotel rules screen"] },
    ],
    route: "/rooms",
    steps: [
      ["Mở Quản lý phòng → Danh sách phòng để lọc và xem trạng thái. Màu/nhãn trạng thái giúp nhận biết phòng sẵn sàng, đang sử dụng, đang dọn hoặc bảo trì.", "Open Room management → Room list to filter and review statuses. Status colors/labels distinguish ready, occupied, cleaning, or maintenance rooms."],
      ["Mở chi tiết phòng để xem thông tin và hình ảnh. Người có quyền có thể cập nhật cấu hình phòng, tòa/tầng, tiện nghi hoặc giá.", "Open a room's details to review information and images. Authorized users can update room configuration, building/floor, amenities, or pricing."],
      ["Khi giao dọn phòng, xác nhận đúng số phòng và nhân viên; cập nhật trạng thái theo đúng tiến độ thực tế.", "When assigning housekeeping, verify the room and employee; update status to match actual progress."],
      ["Mở Lịch bận để xem các ngày tạm ngưng khai thác áp dụng cho chi nhánh. Khoảng ngày này được đánh dấu/chặn trong luồng đặt phòng.", "Open Busy schedule to review dates when the branch is unavailable. These dates are marked/blocked in the booking flow."],
      ["Chỉ quản trị viên hệ thống tạo lịch bận; chọn phạm vi chi nhánh, thời gian, kiểm tra lịch trùng và thông báo cho đúng đối tượng.", "Only system administrators create busy schedules; choose branch scope and dates, check for conflicts, and notify the intended branches."],
    ],
    tip: ["Nếu ngày đặt bị khóa, xem lịch bận trước khi thử ngày khác; không tự đổi trạng thái phòng để lách lịch.", "If a booking date is blocked, review the busy schedule before choosing another date; do not change room status to bypass it."],
  },
  {
    title: ["5. Khách hàng, dịch vụ, hóa đơn và hoàn tiền", "5. Customers, services, invoices, and refunds"],
    imageVi: "/user-guide/screenshots/customers.jpg",
    imageEn: "/user-guide/screenshots/customers.jpg",
    imageAlt: ["Ảnh chụp trang Quản lý khách hàng; thông tin khách đã được làm mờ", "Customer management screen; guest details have been blurred"],
    relatedScreenshots: [
      { src: "/user-guide/screenshots/services.jpg", alt: ["Ảnh chụp trang thao tác dịch vụ khách hàng", "Guest service usage screen"] },
      { src: "/user-guide/screenshots/service-catalog.jpg", alt: ["Ảnh chụp danh mục dịch vụ", "Service catalog screen"] },
      { src: "/user-guide/screenshots/invoices.jpg", alt: ["Ảnh chụp trang Hóa đơn; dữ liệu booking đã được làm mờ", "Invoice screen; booking details have been blurred"] },
      { src: "/user-guide/screenshots/refund-approvals.jpg", alt: ["Ảnh chụp trang Phê duyệt hoàn tiền", "Refund approvals screen"] },
      { src: "/user-guide/screenshots/promotions.jpg", alt: ["Ảnh chụp trang Khuyến mãi", "Promotions screen"] },
    ],
    route: "/customers",
    steps: [
      ["Khách hàng: tìm hồ sơ theo công cụ tìm kiếm/bộ lọc, mở hồ sơ để đối chiếu thông tin và lịch sử. Chỉ tài khoản có quyền mới sửa hồ sơ.", "Customers: find a profile using search/filters and open it to review details and history. Only authorized accounts can edit profiles."],
      ["Dịch vụ khách hàng: mở Thao tác dịch vụ khách hàng, tìm booking và xác nhận đúng số lượng khách đã sử dụng; không xác nhận theo số lượng đã đặt nếu thực tế khác.", "Guest services: open Guest service usage, find the booking, and confirm the quantity actually used; do not confirm the booked quantity if actual usage differs."],
      ["Hóa đơn: tra cứu hóa đơn theo bộ lọc có sẵn, mở chi tiết và đối chiếu booking/thanh toán trước khi giải thích chênh lệch.", "Invoices: search using available filters, open the details, and reconcile with the booking/payment before explaining a discrepancy."],
      ["Phê duyệt hoàn tiền: kiểm tra booking, số tiền, phương thức và chứng từ/yêu cầu; chỉ phê duyệt hoặc từ chối trong phạm vi quyền.", "Refund approvals: verify the booking, amount, method, and supporting request/details; approve or reject only within your permissions."],
    ],
    tip: ["Thông tin hồ sơ và tên khách là nội dung dữ liệu, không tự chuyển ngôn ngữ theo nút Tiếng Việt/English.", "Profile information and guest names are data content and do not automatically change when switching Vietnamese/English."],
  },
  {
    title: ["6. Nhân viên, ca làm và báo cáo", "6. Staff, shifts, and reports"],
    imageVi: "/user-guide/screenshots/staff.jpg",
    imageEn: "/user-guide/screenshots/staff.jpg",
    imageAlt: ["Ảnh chụp trang Nhân viên & ca làm thực tế; thông tin nhân viên đã được làm mờ", "Actual Staff & shifts screen; staff details have been blurred"],
    relatedScreenshots: [
      { src: "/user-guide/screenshots/staff-employees.jpg", alt: ["Ảnh chụp danh sách nhân viên; thông tin cá nhân đã được làm mờ", "Employee directory; personal details have been blurred"] },
      { src: "/user-guide/screenshots/staff-shifts.jpg", alt: ["Ảnh chụp màn hình phân ca làm việc", "Shift scheduling screen"] },
      { src: "/user-guide/screenshots/staff-tasks.jpg", alt: ["Ảnh chụp màn hình phân công công việc", "Task assignment screen"] },
      { src: "/user-guide/screenshots/reports.jpg", alt: ["Ảnh chụp báo cáo doanh thu", "Revenue report screen"] },
      { src: "/user-guide/screenshots/permissions.jpg", alt: ["Ảnh chụp trang Phân quyền", "Permissions screen"] },
      { src: "/user-guide/screenshots/settings.jpg", alt: ["Ảnh chụp trang Cài đặt; thông tin nhận diện đã được làm mờ", "Settings screen; identifying details have been blurred"] },
    ],
    route: "/staff",
    steps: [
      ["Nhân viên mở Nhân viên & ca làm → Ca trực để xem lịch làm việc; mở Phân công dọn phòng/Công việc để xem việc được giao.", "Staff open Staff & shifts → My shifts to review their schedule and Housekeeping assignment/Tasks to see assigned work."],
      ["Cập nhật tiến độ công việc sau khi thực hiện. Nếu ca hoặc nhiệm vụ chưa hiển thị, kiểm tra ngày/chi nhánh hoặc hỏi quản lý.", "Update task progress after completing the work. If a shift/task is missing, verify the date/branch or ask a manager."],
      ["Quản lý mở Danh sách nhân viên để tra cứu nhân sự, Phân ca làm để lập ca và Phân công công việc để giao nhiệm vụ.", "Managers open Employee list to find staff, Assign shifts to schedule work, and Assign tasks to delegate responsibilities."],
      ["Mở Báo cáo, chọn khoảng thời gian/bộ lọc chi nhánh rồi đọc số liệu. Kiểm tra bộ lọc trước khi tải hoặc dùng số liệu.", "Open Reports, select a date range/branch filter, then review the metrics. Verify filters before exporting or using figures."],
      ["Cài đặt cho phép cập nhật hồ sơ/cấu hình được cấp quyền và đổi Tiếng Việt/English. Một số thay đổi cần xác thực lại.", "Settings lets you update authorized profile/configuration and switch Vietnamese/English. Some changes require re-authentication."],
    ],
    tip: ["Phân ca, giao việc và xem báo cáo có thể bị giới hạn theo vai trò. Hãy hỏi quản lý nếu thiếu quyền.", "Shift assignment, task delegation, and reports may be restricted by role. Contact a manager if access is missing."],
  },
  {
    title: ["7. Cổng quản trị hệ thống", "7. System administration portal"],
    route: "/admin",
    steps: [
      ["Tổng quan/Thông báo: theo dõi hoạt động toàn hệ thống, mở thông báo để xem chi tiết và đánh dấu đã đọc.", "Overview/Notifications: monitor system-wide activity, open notifications for details, and mark them as read."],
      ["Tỉnh/thành và chi nhánh: chọn tỉnh hoặc chi nhánh trước khi xem chi tiết/cập nhật. Kiểm tra địa chỉ và phạm vi chi nhánh.", "Provinces and branches: select a province/branch before reviewing or updating details. Verify address and branch scope."],
      ["Danh mục, tiện nghi, loại giường, dịch vụ và khuyến mãi: dùng đúng khu vực quản lý; rà soát dữ liệu dùng chung trước khi lưu.", "Catalogs, amenities, bed types, services, and promotions: use the appropriate management area and review shared data before saving."],
      ["Role và quyền: xác nhận vai trò, quyền thay đổi và người bị ảnh hưởng trước khi lưu cấu hình.", "Roles and permissions: verify the role, permission change, and affected users before saving."],
      ["Tạo lịch bận: nhập tiêu đề, mô tả, ngày bắt đầu/kết thúc; chọn tất cả chi nhánh hoặc các chi nhánh cụ thể; xử lý xung đột rồi gửi thông báo.", "Create a busy schedule: enter title, description, start/end dates; select all or specific branches; resolve conflicts and notify."],
      ["Quản lý tài khoản/thống kê: kiểm tra đúng đối tượng và phạm vi trước khi tạo, cập nhật hoặc xem dữ liệu.", "Accounts/statistics: verify the target and scope before creating, updating, or viewing data."],
    ],
    tip: ["Cấu hình quản trị có thể ảnh hưởng nhiều chi nhánh. Kiểm tra phạm vi và dữ liệu trước khi xác nhận; không chia sẻ thông tin đăng nhập quản trị.", "Administrative configuration can affect multiple branches. Check scope and data before confirming; never share administrator credentials."],
  },
];

export default function UserGuideButton() {
  const [open, setOpen] = useState(false);
  const { i18n } = useTranslation();
  const isEn = i18n.language.startsWith("en");
  const text = (vi: string, en: string) => isEn ? en : vi;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={text("Mở hướng dẫn sử dụng", "Open user guide")}
        title={text("Hướng dẫn chi tiết", "Detailed user guide")}
        className="fixed bottom-6 right-24 z-40 grid h-14 w-14 place-items-center rounded-full border border-blue-200 bg-white text-blue-700 shadow-xl transition hover:scale-105 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        <HelpCircle className="h-6 w-6" />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl">
          <DialogHeader className="pr-8 text-left">
            <DialogTitle className="text-xl">
              {text("Hướng dẫn chi tiết sử dụng hệ thống", "Detailed system user guide")}
            </DialogTitle>
            <DialogDescription>
              {text(
                "Mở từng mục để xem ảnh chụp giao diện thực tế (nếu có), các bước thực hiện và lưu ý. Các thao tác hiển thị tùy theo quyền tài khoản.",
                "Expand a section for a real interface screenshot (when available), step-by-step instructions, and tips. Available actions depend on account permissions.",
              )}
            </DialogDescription>
          </DialogHeader>
          <a
            href="/user-guide/USER_GUIDE_VI_EN.pdf"
            download="Sen-Viet-User-Guide-VI-EN.pdf"
            className="inline-flex w-fit items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <Download className="h-4 w-4" />
            {text("Tải tài liệu tham khảo (PDF)", "Download reference guide (PDF)")}
          </a>
          <div className="space-y-3">
            {guideSections.map((section, index) => (
              <details key={section.title[0]} open={index === 0} className="group rounded-xl border border-slate-200 bg-white">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 font-semibold text-slate-900 marker:hidden">
                <span>{text(section.title[0], section.title[1])}</span>
                  <span className="text-sm text-blue-600 transition group-open:rotate-180">⌄</span>
                </summary>
                <div className="space-y-4 border-t border-slate-100 p-4">
                  {(isEn ? section.imageEn : section.imageVi) && section.imageAlt && (
                    <figure>
                      <img
                        src={isEn ? section.imageEn : section.imageVi}
                        alt={text(section.imageAlt[0], section.imageAlt[1])}
                        className="w-full rounded-lg border border-slate-200 bg-slate-50"
                      />
                      <figcaption className="mt-1 text-center text-xs text-slate-500">
                        {text("Ảnh chụp giao diện thật (bằng tiếng Việt); một số thông tin nhận diện đã được làm mờ.", "Real application screenshot (Vietnamese UI); identifying details have been blurred.")}
                      </figcaption>
                    </figure>
                  )}
                  {section.relatedScreenshots?.map((screenshot) => (
                    <figure key={screenshot.src}>
                      <img
                        src={screenshot.src}
                        alt={text(screenshot.alt[0], screenshot.alt[1])}
                        className="w-full rounded-lg border border-slate-200 bg-slate-50"
                      />
                      <figcaption className="mt-1 text-center text-xs text-slate-500">
                        {text("Ảnh chụp giao diện thật (bằng tiếng Việt); một số thông tin nhận diện đã được làm mờ.", "Real application screenshot (Vietnamese UI); identifying details have been blurred.")}
                      </figcaption>
                    </figure>
                  ))}
                  <ol className="space-y-3">
                    {section.steps.map(([vi, en], stepIndex) => (
                      <li key={vi} className="flex items-start gap-3 text-sm leading-6 text-slate-700">
                        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">{stepIndex + 1}</span>
                        <span>{text(vi, en)}</span>
                      </li>
                    ))}
                  </ol>
                  {section.tip && (
                    <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-5 text-amber-900">
                      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                      <span><strong>{text("Lưu ý: ", "Tip: ")}</strong>{text(section.tip[0], section.tip[1])}</span>
                    </p>
                  )}
                  {section.route && (
                    <Link
                      to={section.route}
                      onClick={() => setOpen(false)}
                      className="inline-flex rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                    >
                      {text("Mở màn hình này", "Open this page")}
                    </Link>
                  )}
                </div>
              </details>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
