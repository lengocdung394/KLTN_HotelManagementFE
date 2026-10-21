# Bản đồ chức năng và mã nguồn

Tài liệu tra cứu nhanh vị trí triển khai các màn hình và luồng nghiệp vụ trong frontend. Dùng để bắt đầu điều tra từ đúng route/workspace/API thay vì tìm lại toàn bộ repo. Cập nhật mục liên quan khi thêm route, chuyển workspace hoặc đổi API chính.

## Điều hướng ứng dụng

- Khai báo route, đăng nhập, phân quyền theo role và kết nối Socket.IO: [`client/App.tsx`](../client/App.tsx).
- Ánh xạ route sang workspace, dựng khung trang và phần nội dung từng module: [`client/pages/ModulePage.tsx`](../client/pages/ModulePage.tsx).
- Menu điều hướng và link tới các tab: [`client/components/AppSidebar.tsx`](../client/components/AppSidebar.tsx).
- Route `/admin` của `ROLE_SUPER_ADMIN` vào trực tiếp [`client/pages/AdminDashboardPage.tsx`](../client/pages/AdminDashboardPage.tsx).
- Người dùng không có role nhân viên/manager/admin bị chuyển tới trang access denied; cổng khách hàng nằm ngoài app nhân viên này.

## Màn hình và chức năng

| URL | Màn hình / entry point | Nơi triển khai chính |
| --- | --- | --- |
| `/login` | Đăng nhập | [`client/pages/LoginPage.tsx`](../client/pages/LoginPage.tsx) |
| `/overview` | Tổng quan chi nhánh | [`client/pages/Index.tsx`](../client/pages/Index.tsx), các thẻ tổng quan dùng component trong `client/components/` |
| `/bookings` | Lịch đặt phòng; mở luồng tạo/chỉnh sửa booking từ nút hành động | `ModulePage` → [`client/pages/BookingWorkspace.tsx`](../client/pages/BookingWorkspace.tsx). Route chuẩn nội bộ của module là `/dat-phong`. |
| `/booking-list` | Tìm kiếm, chi tiết, thanh toán và hủy booking | [`client/pages/BookingListWorkspace.tsx`](../client/pages/BookingListWorkspace.tsx) |
| `/check-in-out` | Check-in, check-out, phụ thu, chi tiết phòng/booking | [`client/pages/CheckInOutWorkspace.tsx`](../client/pages/CheckInOutWorkspace.tsx); danh sách: [`client/components/CheckInOutRecordList.tsx`](../client/components/CheckInOutRecordList.tsx); modal chi tiết: [`client/components/CheckInOutBookingDetailModal.tsx`](../client/components/CheckInOutBookingDetailModal.tsx); tổng kết checkout: [`client/components/CheckoutSummary.tsx`](../client/components/CheckoutSummary.tsx) |
| `/rooms` | Danh sách phòng, trạng thái, dọn phòng, tòa/tầng và giá | [`client/pages/RoomWorkspace.tsx`](../client/pages/RoomWorkspace.tsx); thẻ/list phòng: [`client/components/RoomListTab.tsx`](../client/components/RoomListTab.tsx); API: [`client/services/roomApi.ts`](../client/services/roomApi.ts) |
| `/customers` | Khách hàng | [`client/pages/CustomerPage.tsx`](../client/pages/CustomerPage.tsx) và [`client/pages/CustomerWorkspace.tsx`](../client/pages/CustomerWorkspace.tsx) |
| `/refund-approvals` | Duyệt hoàn tiền checkout/hủy booking | [`client/pages/RefundApprovalWorkspace.tsx`](../client/pages/RefundApprovalWorkspace.tsx); component checkout: [`client/components/CheckoutRefundApprovalsPanel.tsx`](../client/components/CheckoutRefundApprovalsPanel.tsx) |
| `/hotel-rules` | Nội quy khách sạn | [`client/pages/HotelRulesWorkspace.tsx`](../client/pages/HotelRulesWorkspace.tsx) |
| `/promotions` | Khuyến mãi | [`client/pages/PromotionWorkspace.tsx`](../client/pages/PromotionWorkspace.tsx) |
| `/services/usage` | Theo dõi/xác nhận sử dụng dịch vụ | [`client/pages/ServiceWorkspace.tsx`](../client/pages/ServiceWorkspace.tsx), `mode="usage"` |
| `/services/catalog` | Quản lý danh mục dịch vụ (manager) | [`client/pages/ServiceWorkspace.tsx`](../client/pages/ServiceWorkspace.tsx), `mode="catalog"` |
| `/invoices` | Hóa đơn | [`client/pages/InvoiceWorkspace.tsx`](../client/pages/InvoiceWorkspace.tsx) |
| `/staff` | Quản lý nhân viên, ca hôm nay và phân ca tuần; nhân viên xem lịch và xác nhận việc dọn | [`client/pages/StaffTabsWorkspace.tsx`](../client/pages/StaffTabsWorkspace.tsx), [`client/pages/ManagerShiftPlanner.tsx`](../client/pages/ManagerShiftPlanner.tsx), [`client/pages/EmployeeShiftSchedule.tsx`](../client/pages/EmployeeShiftSchedule.tsx) |
| `/permissions` | Phân quyền | [`client/pages/PermissionsWorkspace.tsx`](../client/pages/PermissionsWorkspace.tsx) |
| `/reports` | Báo cáo | [`client/pages/ReportWorkspace.tsx`](../client/pages/ReportWorkspace.tsx) |
| `/settings` | Cài đặt/ngôn ngữ và hồ sơ | `LanguageSettings` và phần hồ sơ trong [`client/pages/ModulePage.tsx`](../client/pages/ModulePage.tsx) |
| `/admin` | Quản trị hệ thống | [`client/pages/AdminDashboardPage.tsx`](../client/pages/AdminDashboardPage.tsx) |

Các route alias như `/dat-phong`, `/nhan-vien`, `/phan-quyen`, `/bao-cao`, `/cai-dat` được xử lý trong `App.tsx` hoặc chuẩn hóa tại `ModulePage.tsx`.

## API, state và realtime

- API dùng RTK Query và Axios base query: [`client/services/baseApi.ts`](../client/services/baseApi.ts), [`client/store/axiosBaseQuery.ts`](../client/store/axiosBaseQuery.ts), [`client/store/axiosClient.ts`](../client/store/axiosClient.ts).
- Booking/list/room matrix: [`client/services/bookingApi.ts`](../client/services/bookingApi.ts).
- Check-in/check-out/summary: [`client/services/checkInOutApi.ts`](../client/services/checkInOutApi.ts).
- Chỉnh sửa booking, hủy và hoàn tiền checkout: [`client/services/managementBookingApi.ts`](../client/services/managementBookingApi.ts).
- Thanh toán: [`client/services/paymentApi.ts`](../client/services/paymentApi.ts).
- Phòng, trạng thái phòng, loại phòng: [`client/services/roomApi.ts`](../client/services/roomApi.ts).
- Nhân viên/ca làm: [`client/services/employeeApi.ts`](../client/services/employeeApi.ts), [`client/services/shiftApi.ts`](../client/services/shiftApi.ts).
- Danh sách nhân viên cho trang `/staff` lấy từ `GET /employee/my-hotel`; backend xác định chi nhánh từ tài khoản đang đăng nhập thay vì phụ thuộc `hotelId` giải mã ở frontend.
- Tạo nhân viên khóa biểu mẫu trong suốt quá trình tải ảnh và lưu; backend kiểm tra trùng email, số điện thoại và CCCD trước khi tạo tài khoản/hồ sơ.
- Phân ca tuần dùng `GET/PUT /staff-shifts/weekly`; nhân viên xem lịch ở `EmployeeShiftSchedule`, quản lý lập đủ 3 ca tại `ManagerShiftPlanner`.
- Checkout tạo việc dọn phòng; nhân viên xem/xác nhận qua `GET /housekeeping-tasks/my` và `POST /housekeeping-tasks/{id}/complete`. Backend chuyển việc cho nhân viên dự phòng sau 1 giờ nếu chưa xác nhận.
- `EmployeeShiftSessionGuard` nhắc trước 5 phút và đăng xuất tài khoản nhân viên ở trình duyệt khi ca kết thúc; đăng xuất này không thu hồi JWT phía backend.
- Redux store/auth: [`client/store/index.ts`](../client/store/index.ts), [`client/store/authSlice.ts`](../client/store/authSlice.ts).
- Đăng ký và khởi tạo socket: [`client/lib/socket.ts`](../client/lib/socket.ts). Workspace đăng ký callback qua `bindHotelSocketEvents`; sau event thường invalidate tag RTK Query tương ứng.

## Luồng trạng thái phòng hiện tại

1. Backend check-in/check-out và lưu trạng thái phòng: `E:\HotelManagement_BE\src\main\java\iuh\fit\se\hotelmanagement_be\modular\booking\services\impl\CheckInOutServiceImpl.java`.
2. Backend API để nhân viên chuyển phòng thủ công sang READY/MAINTENANCE: `E:\HotelManagement_BE\src\main\java\iuh\fit\se\hotelmanagement_be\modular\room\controllers\RoomController.java`, `RoomServiceImpl.java`.
3. Phòng MAINTENANCE/CLEANING bị ẩn khỏi danh sách chọn phòng ở `client/pages/BookingWorkspace.tsx` và các dropdown thêm/đổi phòng ở `client/pages/BookingEditWorkspace.tsx`; backend cũng từ chối tạo booking, thêm/đổi phòng và giữ chỗ tạm thời với các trạng thái này. Truy vấn phòng trống lọc các trạng thái đó tại `E:\HotelManagement_BE\src\main\java\iuh\fit\se\hotelmanagement_be\modular\booking\repositories\BookingDetailRepository.java`.
4. Frontend trạng thái, thao tác xác nhận dọn và API: `client/pages/RoomWorkspace.tsx`, `client/components/RoomListTab.tsx`, `client/services/roomApi.ts`.
5. Event cập nhật trạng thái phòng được gửi qua `room_update` trong backend `RoomSocketEmitter`; frontend nhận ở `client/lib/socket.ts` và workspace phù hợp invalidate tag `Room`.
6. Trong chi tiết booking tại `client/pages/BookingListWorkspace.tsx`, từng phòng có trạng thái `CHECKED_OUT` được gắn nhãn “Đã hoàn thành”.

## Backend tương ứng

Backend chạy ở repo riêng `E:\HotelManagement_BE`. Với luồng booking/check-in/checkout, tìm theo thứ tự:

1. Controller dưới `src/main/java/iuh/fit/se/hotelmanagement_be/modular/booking/controllers/`.
2. Interface service trong `.../booking/services/`.
3. Implementation nghiệp vụ trong `.../booking/services/impl/`.
4. DTO/response trong `.../booking/requests/` và `.../booking/responses/`.
5. Repository trong `.../booking/repositories/`.

Các controller module khác thường nằm tại `src/main/java/iuh/fit/se/hotelmanagement_be/modular/<module>/controllers/`; DTO, service, repository và entity nằm trong các thư mục cùng module.

## Phân ca và bàn giao dọn phòng

1. Quản lý lập lịch tuần tại `client/pages/ManagerShiftPlanner.tsx`; API và lưu lịch tuần nằm ở backend module `shift` (`ShiftController`, `ShiftServiceImpl`, `ShiftAssignmentRepository`).
2. Mỗi ngày có ba ca: 06:00–14:00, 14:00–22:00 và 22:00–06:00; mỗi ca cần 2 lễ tân, 2 buồng phòng và 1 bảo vệ. Backend kiểm tra định mức, chức vụ, chi nhánh và không cho phân một nhân viên hai lần trong cùng ngày; sang ngày khác có thể phân lại nhân viên đó.
3. `ShiftScheduleReminderScheduler` gửi thông báo cho quản lý lúc 15:00 thứ Bảy để lập lịch tuần kế tiếp.
4. Checkout tạo task dọn phòng trong `booking/HousekeepingTaskService`; lịch sử phân ca của ca hiện hành được ưu tiên, nhân viên buồng phòng trong chi nhánh được dùng làm dự phòng nếu cần. Task chưa được xác nhận sau 1 giờ sẽ chuyển cho người dự phòng và phát thông báo.
5. Nhân viên xác nhận task tại `client/pages/EmployeeShiftSchedule.tsx`; backend chuyển phòng sang READY và phát event cập nhật trạng thái.
6. `client/components/EmployeeShiftSessionGuard.tsx` nhắc trước giờ hết ca 5 phút và tự đăng xuất frontend khi hết ca. Do JWT backend hiện stateless, thao tác này chỉ kết thúc phiên trên trình duyệt đang mở.

## Cách tra cứu cho yêu cầu mới

1. Tìm URL ở bảng trên và mở workspace entry point.
2. Tìm mutation/query tương ứng trong `client/services/`.
3. Nếu yêu cầu liên quan trạng thái dùng chung giữa các màn hình, kiểm tra cả RTK Query tags và `client/lib/socket.ts`.
4. Nếu API hoặc quy tắc nghiệp vụ cần đổi, lần controller → service implementation → repository/DTO trong backend.
5. Khi thêm/chuyển màn hình, cập nhật bảng URL; khi đổi luồng chính, cập nhật phần API/realtime hoặc luồng nghiệp vụ tương ứng.
