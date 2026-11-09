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
      ["Ở menu bên trái, chọn Tổng quan để mở trang theo dõi hoạt động của chi nhánh.", "Select Overview in the left menu to open the branch activity dashboard."],
      ["Đọc các thẻ chỉ số đầu trang như doanh thu, công suất phòng, khách đang lưu trú và lượt đến/trả phòng; đây là số liệu tổng hợp để theo dõi nhanh.", "Review the summary cards at the top, such as revenue, occupancy, in-house guests, and arrivals/departures. These are quick overview metrics."],
      ["Kéo xuống lịch check-in/check-out. Kiểm tra ngày đang chọn trước khi tra cứu lịch.", "Scroll to the check-in/check-out schedule and verify the selected date before reviewing it."],
      ["Dùng mũi tên hoặc bộ chọn ngày để xem ngày cần tra; chọn Hôm nay để quay lại ngày hiện tại.", "Use the arrows or date picker to view the required day; select Today to return to the current date."],
      ["Chọn tab tương ứng: khách chờ nhận phòng, khách chờ trả phòng hoặc khách đã nhận phòng sớm.", "Select the relevant tab: waiting check-ins, waiting check-outs, or early check-ins."],
      ["Tìm đúng booking trong danh sách rồi chọn dòng đó để tiếp tục xử lý tại quầy lễ tân.", "Find the correct booking in the list and select its row to continue at the front desk."],
      ["Tại khu vực Dịch vụ cần xác nhận, mở booking liên quan và kiểm tra dịch vụ cùng số lượng trước khi xác nhận đã sử dụng.", "In Services to confirm, open the relevant booking and verify each service and quantity before confirming usage."],
      ["Nếu chỉ số đang tải, báo lỗi hoặc hiện dấu gạch ngang, mở phân hệ chi tiết để kiểm tra; không tự xem dữ liệu thiếu là bằng 0.", "If a metric is loading, shows an error, or displays a dash, check the relevant module for details; do not treat missing data as zero."],
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
      { src: "/user-guide/screenshots/booking-dates-rooms.jpg", alt: ["Ảnh chụp thật bước chọn ngày và phòng; tên khách trong lịch đã được ẩn", "Actual dates-and-rooms step; guest names in the calendar have been hidden"] },
      { src: "/user-guide/screenshots/booking-guest-info.jpg", alt: ["Ảnh chụp thật bước nhập thông tin khách và số người theo phòng; dữ liệu cá nhân đã được ẩn", "Actual guest-information step with guest counts per room; personal data has been hidden"] },
      { src: "/user-guide/screenshots/booking-services-all-rooms.jpg", alt: ["Ảnh chụp thật bước chọn dịch vụ cho tất cả phòng và tóm tắt chi phí", "Actual service-selection step for all rooms and its cost summary"] },
      { src: "/user-guide/screenshots/booking-services-by-room.jpg", alt: ["Ảnh chụp thật bước chọn dịch vụ riêng theo từng phòng", "Actual service-selection step for individual rooms"] },
      { src: "/user-guide/screenshots/booking-promotion-selection.jpg", alt: ["Ảnh chụp thật bước chọn khuyến mãi; tên và mã ưu đãi đã được làm mờ", "Actual promotion-selection step; promotion names and codes have been blurred"] },
    ],
    route: "/bookings",
    steps: [
      ["Mở Quản lý đặt phòng → Đặt phòng. Trên trang lịch đặt phòng, nhấn Đặt phòng mới để mở biểu mẫu tạo booking.", "Open Booking management → Bookings. On the booking schedule page, select New booking to open the booking form."],
      ["Bước 1 – Ngày & phòng: chọn Ngày nhận phòng trước, sau đó chọn Ngày trả phòng. Kiểm tra ngày trả muộn hơn ngày nhận và số đêm hiển thị.", "Step 1 – Dates & rooms: choose Check-in date first, then Check-out date. Confirm check-out is later and review the displayed night count."],
      ["Nếu ngày lịch bận màu vàng, ngày không khả dụng hoặc hệ thống báo không tải được lịch bận, dừng lại để kiểm tra lịch/đường truyền; không cố đặt ngày bị khóa.", "If a date is marked busy in yellow, unavailable, or the busy schedule fails to load, stop and check the schedule/connection; do not book a blocked date."],
      ["Trong lịch phòng, đọc chú giải: Còn phòng, Đã đặt/không thể chọn và Đang chọn. Chỉ chọn ô phòng còn trống cho đúng khoảng ngày.", "In the room calendar, read the legend: Available, Booked/unavailable, and Selecting. Select only an available room cell for the required dates."],
      ["Nhấn hoặc kéo dọc trên các ô lịch để chọn phòng; kéo dọc có thể chọn nhiều phòng trong cùng ngày. Kiểm tra vùng ngày/phòng được tô chọn.", "Click or drag vertically on calendar cells to select rooms; dragging vertically can select multiple rooms for the same dates. Verify the highlighted room/date range."],
      ["Muốn bỏ phòng, nhấn lại ô đang chọn. Khi chỉnh khoảng ngày đã chọn, chỉ bỏ được ngày ở đầu hoặc cuối khoảng theo hướng dẫn của lịch.", "To remove a room, click its selected cell again. When adjusting a selected range, only its first or last day can be removed as indicated by the calendar."],
      ["Dùng ô tìm kiếm phòng để tra theo số hoặc loại phòng; dùng các danh sách Loại phòng, Tầng và Tòa nhà để lọc thêm.", "Use room search to find a room number or room type; use the Room type, Floor, and Building filters to narrow results."],
      ["Nếu không thấy phòng, kiểm tra lại ngày và xóa bộ lọc. Không chọn phòng kín/không khả dụng để thay thế cho phòng khách yêu cầu.", "If the room is missing, verify dates and clear filters. Do not select a booked/unavailable room as a substitute for the requested room."],
      ["Xem phần Đã chọn ở cuối bước để kiểm tra số phòng và tổng tạm tính. Nhấn Xem phòng đã chọn nếu muốn rà soát riêng các phòng đã chọn.", "Review Selected at the bottom of the step for room count and estimated total. Select View selected rooms to review only chosen rooms."],
      ["Đặt nhiều phòng: kiểm tra từng số phòng, ngày ở và sức chứa. Chỉ nhấn Tiếp tục khi toàn bộ phòng cần đặt đã được chọn đúng.", "For multiple rooms, verify each room number, stay dates, and capacity. Select Continue only after all required rooms are selected correctly."],
      ["Bước 2 – Thông tin đặt phòng: tìm khách đã lưu theo tên/số điện thoại và chọn đúng hồ sơ; thông tin khách sẽ được điền tự động.", "Step 2 – Booking information: search saved customers by name/phone and select the correct profile; the guest details will be populated."],
      ["Nếu chưa có hồ sơ, nhập họ tên, số điện thoại đủ 10 chữ số và CCCD đủ 12 chữ số. Email xác nhận là tùy chọn nhưng phải đúng định dạng nếu có nhập.", "If there is no profile, enter the full name, a 10-digit phone number, and 12-digit identity number. Confirmation email is optional, but must be valid if entered."],
      ["Nếu nhập khách mới, nhấn Tạo khách hàng và chờ thông báo chọn/tạo hồ sơ thành công. Nếu đã chọn hồ sơ lưu, kiểm tra tên và số điện thoại hiển thị.", "For a new guest, select Create customer and wait for confirmation that the profile was created/selected. For a saved profile, verify the displayed name and phone."],
      ["Với từng phòng, chọn số người lớn (từ 12 tuổi), trẻ em (2 đến dưới 12 tuổi) và em bé (dưới 2 tuổi) theo thực tế.", "For each room, select the actual number of adults (12+), children (2 to under 12), and infants (under 2)."],
      ["Đọc sức chứa tiêu chuẩn, số khách ghép thêm tối đa và phụ thu hiển thị. Điều chỉnh số khách nếu vượt sức chứa; em bé dưới 2 tuổi được ghi là miễn phí theo quy định hiển thị.", "Review standard capacity, maximum extra guests, and displayed surcharges. Adjust guest counts if capacity is exceeded; infants under 2 are shown as free under the displayed policy."],
      ["Bấm Tiếp tục chọn dịch vụ. Nếu nút chưa bật, đọc thông báo để biết còn thiếu thông tin gì; hồ sơ khách cần được chọn/tạo trước khi đi tiếp.", "Select Continue to services. If the button is disabled, read the message to see what is missing; a customer profile must be selected/created first."],
      ["Bước 3 – Dịch vụ: chọn Chọn cho tất cả phòng nếu mọi phòng dùng cùng dịch vụ; chọn Chọn riêng từng phòng nếu dịch vụ/số người khác nhau theo phòng.", "Step 3 – Services: choose Select for all rooms when every room needs the same services; choose Select individually by room when services/quantities vary."],
      ["Dùng Tìm dịch vụ để lọc theo tên. Mỗi mục hiển thị tên, nhóm, giá/đơn vị và mô tả; đọc giá và đơn vị trước khi tích chọn.", "Use Search services to filter by name. Each item shows its name, category, price/unit, and description; review price and unit before selecting."],
      ["Ở chế độ tất cả phòng, tích chọn dịch vụ cần thêm. Rà soát phần Chi tiết từng phòng: kiểm tra dịch vụ, giá, số người sử dụng và tổng tiền của từng phòng.", "In all-rooms mode, check the services to add. Review Room details for each room: service, price, number of users, and room total."],
      ["Nếu dịch vụ chỉ áp dụng cho một số người, bỏ chọn Áp dụng cả phòng rồi nhập đúng số người dùng; nếu áp dụng cả phòng, giữ tùy chọn này.", "If a service is for only some guests, clear Apply to the whole room and enter the actual number of users; keep it selected when everyone in the room uses it."],
      ["Ở chế độ từng phòng, mở thẻ đúng phòng, tìm dịch vụ, tích chọn và nhập số lượng. Kiểm tra đơn giá/đơn vị hiển thị bên cạnh dịch vụ.", "In per-room mode, expand the correct room, find and check the service, then enter its quantity. Verify the displayed unit price/unit."],
      ["Dùng mục Chi tiết phòng và Tóm tắt chi phí để đối chiếu tiền phòng, từng phí dịch vụ và tổng từng phòng. Bỏ chọn dịch vụ nếu khách không yêu cầu.", "Use Room details and Cost summary to reconcile room charges, each service fee, and each room total. Uncheck any service the guest did not request."],
      ["Nếu danh sách dịch vụ báo lỗi tải, không tự đoán giá hoặc xác nhận dịch vụ; thử tải lại hoặc báo quản lý. Nếu không cần dịch vụ, để trống và nhấn Tiếp tục.", "If the service list fails to load, do not guess prices or confirm a service; retry or contact a manager. If no services are needed, leave them unselected and select Continue."],
      ["Bước 4 – Khuyến mãi: rà soát cả Khuyến mãi chi nhánh và Khuyến mãi khách hàng. Mã khách hàng chỉ hiện sau khi đã chọn hồ sơ khách có mã lưu.", "Step 4 – Promotions: review both Branch promotions and Customer promotions. Customer offers appear only after selecting a guest profile with saved offers."],
      ["Dùng ô Tìm khuyến mãi để tìm theo tên/mã. Hoặc nhập mã vào ô Nhập mã khuyến mãi rồi nhấn Áp dụng; mã được chuẩn hóa chữ hoa.", "Use Search promotions to find an offer by name/code. Or enter a code in the promotion field and select Apply; the code is normalized to uppercase."],
      ["Muốn xem thể lệ, nhấn Chi tiết trên thẻ khuyến mãi. Kiểm tra mã, mức giảm, mô tả, áp dụng cho tiền phòng/tiền dịch vụ/tổng hóa đơn, mức tối thiểu, ngày hiệu lực và trạng thái.", "To review the terms, select Details on a promotion card. Check the code, discount, description, whether it applies to room/services/total, minimums, validity dates, and status."],
      ["Trong Chi tiết, đọc số tiền giảm dự kiến cho booking này và mức giảm tối đa (nếu có). Chỉ chọn mã khi điều kiện phù hợp với tổng booking hiện tại.", "In Details, review the estimated discount for this booking and maximum discount (if any). Choose the offer only if the current booking meets its conditions."],
      ["Nhấn Chọn mã trên thẻ hoặc Chọn khuyến mãi này trong cửa sổ chi tiết. Chỉ chọn một mã; kiểm tra dòng Đã áp dụng và số tiền giảm.", "Select Choose code on a card or Choose this promotion in its details dialog. Only one offer is selected; verify the applied-code line and discount amount."],
      ["Muốn hệ thống so sánh các ưu đãi đủ điều kiện, nhấn Chọn mã giảm nhiều nhất. Nếu không có ưu đãi hợp lệ, đọc cảnh báo thay vì nghĩ rằng đã được giảm.", "To compare eligible offers, select Choose best available discount. If none qualify, read the warning rather than assuming a discount was applied."],
      ["Nếu báo không tìm thấy mã, kiểm tra chính tả/mã và nguồn phát hành. Nếu không đủ điều kiện, đọc mức tối thiểu hoặc ngày hiệu lực trong Chi tiết.", "If a code is not found, verify its spelling and issuing source. If ineligible, review minimums or validity dates in Details."],
      ["Nếu chọn nhầm hoặc muốn bỏ ưu đãi, nhấn Bỏ chọn; kiểm tra tổng tiền được cập nhật lại.", "If the wrong offer was selected or should be removed, select Remove selection and verify the total updates."],
      ["Ở bước cuối, kiểm tra tổng tiền sau khi áp dụng khuyến mãi. Biểu mẫu tạo booking hiện không có lựa chọn phương thức thanh toán.", "At the final step, review the total after promotions. The booking form currently has no payment-method selector."],
      ["Trước khi gửi, đối chiếu lại khách, số người/phụ thu từng phòng, ngày/phòng, dịch vụ, khuyến mãi và tổng tiền. Không xem booking là đã thanh toán chỉ vì đã xác nhận; ghi nhận thu tiền theo quy trình của chi nhánh.", "Before submitting, recheck the guest, guest counts/surcharges by room, dates/rooms, services, promotion, and total. Do not treat a booking as paid just because it was confirmed; record payment using the branch's process."],
      ["Nhấn Xác nhận đặt phòng một lần và chờ kết quả. Khi thành công, lưu mã booking và kiểm tra trạng thái trong Danh sách booking; không gửi lại chỉ vì trang đang xử lý.", "Select Confirm booking once and wait for the result. On success, note the booking reference and verify its status in Booking list; do not resubmit while it is processing."],
      ["Tra cứu booking cũ: mở Danh sách booking, lọc/tìm đúng mã hoặc khách, mở dòng để xem trạng thái. Khi sửa booking, rà lại ngày/phòng, dịch vụ, khuyến mãi và tổng tiền trước khi cập nhật.", "To find an existing booking, open Booking list, filter/search for the correct reference or guest, and open the row to review its status. Before editing, recheck dates/rooms, services, promotion, and total."],
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
      ["Mở Check-in / Check-out từ menu bên trái hoặc chọn Mở quầy lễ tân trên Tổng quan.", "Open Check-in / Check-out from the left menu or select Open front desk on Overview."],
      ["Chọn ngày dự kiến xử lý; xác nhận ngày trên màn hình đúng với ngày khách đến/trả.", "Select the processing date and confirm it matches the guest's arrival/departure date."],
      ["Mở booking và đối chiếu mã booking, tên/số điện thoại khách, số phòng, ngày lưu trú, số khách và trạng thái hiện tại.", "Open the booking and verify its reference, guest name/phone, room, stay dates, guest count, and current status."],
      ["Chọn tab Nhận phòng hoặc Trả phòng để chỉ xem danh sách cần xử lý tương ứng.", "Select the Check-in or Check-out tab to view the relevant queue."],
      ["Tìm bằng mã booking hoặc thông tin khách trong danh sách. Nếu không thấy, kiểm tra ngày, tab và bộ lọc trước khi báo booking bị mất.", "Find the record using its booking reference or guest details. If it is missing, verify the date, tab, and filters before reporting it as lost."],
      ["Khi nhận phòng, xác nhận đúng khách và phòng; kiểm tra trạng thái thanh toán, ghi chú đến sớm và phụ thu (nếu có).", "For check-in, confirm the guest and room, then review payment status, early-arrival notes, and any surcharge."],
      ["Chỉ xác nhận nhận phòng sau khi đã thông báo và thống nhất các khoản phí phát sinh với khách.", "Confirm check-in only after any additional charges have been explained and agreed with the guest."],
      ["Khi trả phòng, kiểm tra từng dịch vụ đã sử dụng và khoản phát sinh; xác nhận số lượng thực tế thay vì mặc định số đã đặt.", "For check-out, review each service used and extra charge; confirm actual usage instead of assuming the booked quantity was used."],
      ["Đối chiếu tiền đã thu, số còn phải thu hoặc số tiền hoàn. Nếu có hoàn tiền, làm theo phương thức và quy trình phê duyệt của khách sạn.", "Reconcile payments received, any balance due, and any refund. Follow the hotel's refund method and approval process."],
      ["Với booking nhiều phòng, mở và rà soát từng phòng/khách. Chỉ dùng thao tác nhóm khi mọi dòng được chọn đều đúng.", "For multi-room bookings, open and review each room/guest. Use a group action only when every selected row is correct."],
      ["Sau khi xác nhận, kiểm tra trạng thái mới trên booking và đảm bảo phòng chuyển sang trạng thái phù hợp với nghiệp vụ.", "After confirming, verify the booking's new status and ensure the room reflects the appropriate operational state."],
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
      ["Mở Quản lý phòng → Quản lý danh sách phòng để xem các phòng thuộc chi nhánh.", "Open Room management → Room list to view rooms at the branch."],
      ["Dùng bộ lọc trên trang để tìm theo thông tin có sẵn; kiểm tra đúng số phòng trước khi mở chi tiết.", "Use the page filters to search by available details; verify the room number before opening its record."],
      ["Đọc nhãn/màu trạng thái để phân biệt phòng trống, đang sử dụng, đang dọn hoặc bảo trì.", "Read the status label/color to distinguish available, occupied, cleaning, or maintenance rooms."],
      ["Mở phòng cần xem và kiểm tra thông tin, hình ảnh, tiện nghi, tầng/tòa nhà.", "Open the room and review its details, images, amenities, floor, and building."],
      ["Nếu có quyền chỉnh sửa, cập nhật các trường cần thiết rồi đọc lại toàn bộ thông tin trước khi lưu.", "If you have edit permission, update the required fields and review all details before saving."],
      ["Khi giao dọn phòng, mở mục công việc/phân công, chọn đúng phòng và nhân viên được giao, rồi xác nhận phân công.", "To assign housekeeping, open tasks/assignments, select the correct room and staff member, then confirm the assignment."],
      ["Cập nhật trạng thái phòng theo tiến độ thực tế; không chuyển sang Sẵn sàng trước khi công việc dọn/kiểm tra hoàn tất.", "Update room status to match actual progress; do not mark it Ready until cleaning/inspection is complete."],
      ["Mở Lịch bận để xem khoảng thời gian không nhận đặt áp dụng cho chi nhánh. Mở chi tiết lịch để xác nhận ngày và phạm vi.", "Open Busy schedule to review periods when the branch is unavailable. Open a schedule to verify dates and scope."],
      ["Khi ngày đặt bị khóa, kiểm tra lịch bận trước; không đổi trạng thái phòng để lách ngày bị chặn.", "When a booking date is blocked, check Busy schedule first; do not change room status to bypass a blocked date."],
      ["Thao tác tạo lịch bận hoặc sửa giá phòng chỉ dành cho tài khoản được phân quyền quản lý; xác nhận chi nhánh và thời hạn trước khi lưu.", "Creating busy schedules or changing room rates is restricted to authorized managers; verify branch and dates before saving."],
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
      ["Mở mục Khách hàng và dùng ô tìm kiếm/bộ lọc để tìm đúng hồ sơ.", "Open Customers and use the search/filter controls to find the correct profile."],
      ["Đối chiếu thông tin nhận dạng và lịch sử trước khi mở hoặc trao đổi dữ liệu; chỉ chỉnh sửa nếu tài khoản có quyền.", "Verify identifying details and history before opening or discussing the record; edit only if authorized."],
      ["Mở Dịch vụ → Thao tác dịch vụ khách hàng, sau đó tìm booking liên quan.", "Open Services → Guest service usage, then find the relevant booking."],
      ["Mở chi tiết dịch vụ; so sánh dịch vụ đã đặt với lượng khách thực tế đã sử dụng.", "Open service details and compare the booking with the amount actually used."],
      ["Nhập/xác nhận lượng sử dụng thực tế và kiểm tra lại đơn vị, số lượng, giá trước khi lưu.", "Enter/confirm actual usage and recheck unit, quantity, and price before saving."],
      ["Nếu dịch vụ chưa dùng hoặc thông tin không khớp, không xác nhận đã sử dụng; hỏi khách hoặc quản lý để xử lý.", "If the service was not used or details do not match, do not confirm usage; check with the guest or manager."],
      ["Để quản lý danh mục dịch vụ, mở Dịch vụ → Quản lý danh mục dịch vụ; kiểm tra tên, giá và trạng thái hoạt động trước khi lưu thay đổi.", "To manage service offerings, open Services → Service catalog; verify the name, price, and active status before saving changes."],
      ["Mở Hóa đơn, dùng bộ lọc tra cứu rồi mở hóa đơn đúng booking.", "Open Invoices, use the filters to search, then open the invoice for the correct booking."],
      ["Đối chiếu các dòng tiền với booking, dịch vụ và thanh toán đã ghi nhận; nếu chưa rõ chênh lệch, ghi nhận mã booking và báo quản lý.", "Reconcile invoice line items with the booking, services, and recorded payments; if a discrepancy remains, note the booking reference and contact a manager."],
      ["Tại Phê duyệt hoàn tiền, mở yêu cầu chờ xử lý, xác minh booking, số tiền, phương thức và lý do trước khi quyết định.", "In Refund approvals, open a pending request and verify the booking, amount, method, and reason before deciding."],
      ["Chỉ phê duyệt/từ chối trong phạm vi quyền và theo chính sách; kiểm tra kết quả xử lý sau khi gửi quyết định.", "Approve/reject only within your permissions and policy; verify the result after submitting the decision."],
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
      { src: "/user-guide/screenshots/settings.jpg", alt: ["Ảnh chụp trang Cài đặt; thông tin nhận diện đã được làm mờ", "Settings screen; identifying details have been blurred"] },
    ],
    route: "/staff",
    steps: [
      ["Nhân viên: mở Nhân viên & ca làm → Ca trực để xem lịch được xếp; kiểm tra đúng ngày và ca.", "Staff: open Staff & shifts → My shifts to view the assigned schedule; verify the date and shift."],
      ["Mở mục công việc/Phân công dọn phòng để xem nhiệm vụ được giao; đọc phòng, thời hạn và hướng dẫn trước khi bắt đầu.", "Open Tasks/Housekeeping assignments to view assigned work; review the room, due time, and instructions before starting."],
      ["Sau khi hoàn tất, mở đúng nhiệm vụ và cập nhật trạng thái theo kết quả thực tế; báo quản lý nếu không thể hoàn tất hoặc thông tin sai.", "When finished, reopen the task and update its status to reflect the actual result; notify a manager if it cannot be completed or details are wrong."],
      ["Quản lý: mở Nhân viên & ca làm → Danh sách nhân viên, tìm đúng nhân viên và kiểm tra chi nhánh/trạng thái trước khi xem hoặc cập nhật.", "Managers: open Staff & shifts → Employee list, find the correct employee, and verify branch/status before reviewing or updating."],
      ["Để lập ca, mở Phân ca làm, chọn khoảng ngày/ca theo màn hình và chọn nhân viên thuộc chi nhánh phù hợp.", "To schedule shifts, open Assign shifts, choose the date range/shift shown on screen, and select staff for the appropriate branch."],
      ["Rà soát trùng ca, ngày, nhân viên và giờ trước khi lưu; sau khi lưu, kiểm tra ca xuất hiện đúng trên lịch.", "Check for overlapping shifts and verify date, employee, and hours before saving; then confirm the shift appears on the schedule."],
      ["Để giao việc, mở Phân công công việc, điền nội dung, thời hạn và phòng/nhân viên liên quan; đọc lại người nhận và chi tiết trước khi xác nhận.", "To assign a task, open Assign tasks, enter the description, due date, and related room/staff; verify assignee and details before confirming."],
      ["Mở Báo cáo, chọn loại báo cáo nếu có, đặt khoảng thời gian và chi nhánh cần xem.", "Open Reports, choose a report type if available, and set the date range and branch."],
      ["Kiểm tra lại bộ lọc trước khi đọc hoặc xuất số liệu; so sánh cùng khoảng thời gian và không coi dữ liệu chưa tải là số 0.", "Verify filters before reviewing/exporting figures; compare equivalent date ranges and do not treat unloaded data as zero."],
      ["Cài đặt cho phép cập nhật hồ sơ/cấu hình được cấp quyền và đổi Tiếng Việt/English. Một số thay đổi cần xác thực lại.", "Settings lets you update authorized profile/configuration and switch Vietnamese/English. Some changes require re-authentication."],
    ],
    tip: ["Phân ca, giao việc và xem báo cáo có thể bị giới hạn theo vai trò. Hãy hỏi quản lý nếu thiếu quyền.", "Shift assignment, task delegation, and reports may be restricted by role. Contact a manager if access is missing."],
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
                "Hướng dẫn dành cho nhân viên và quản lý chi nhánh. Mở từng mục để xem ảnh chụp thực tế và từng thao tác theo thứ tự; một số chức năng chỉ hiển thị khi tài khoản có quyền.",
                "For hotel staff and branch managers. Expand a section for real screenshots and ordered, individual actions; some features appear only for authorized accounts.",
              )}
            </DialogDescription>
          </DialogHeader>
          <a
            href="/user-guide/USER_GUIDE_VI.pdf"
            download="Sen-Viet-User-Guide-VI.pdf"
            className="inline-flex w-fit items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <Download className="h-4 w-4" />
            {text("Tải hướng dẫn tiếng Việt (PDF)", "Download Vietnamese guide (PDF)")}
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
                        {text("Ảnh chụp giao diện thật (bằng tiếng Việt); thông tin nhận diện đã được che hoặc làm mờ.", "Real application screenshot (Vietnamese UI); identifying details have been hidden or blurred.")}
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
                        {text("Ảnh chụp giao diện thật (bằng tiếng Việt); thông tin nhận diện đã được che hoặc làm mờ.", "Real application screenshot (Vietnamese UI); identifying details have been hidden or blurred.")}
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
