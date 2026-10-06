package iuh.fit.se.hotelmanagement_be.modular.booking.controllers;


import io.swagger.v3.oas.annotations.tags.Tag;
import iuh.fit.se.hotelmanagement_be.modular.booking.requests.BookingModificationRequest;
import iuh.fit.se.hotelmanagement_be.modular.booking.responses.BookingModificationResponse;
import iuh.fit.se.hotelmanagement_be.modular.booking.services.BookingManagementService;
import iuh.fit.se.hotelmanagement_be.shared.dtos.ApiResponse;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;

@Slf4j
@RestController
@RequestMapping("/management-bookings")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Booking", description = "APIs liên quan đến đặt phòng")
public class BookingManagementController {
    BookingManagementService bookingManagementService;

    /**
     * API chỉnh sửa đơn đặt phòng (Hỗ trợ đồng thời: Hủy phòng, thêm phòng, đổi phòng, đổi ngày, hủy dịch vụ).
     *
     * @param bookingId ID của đơn đặt phòng cần thay đổi.
     * @param request   DTO chứa danh sách các thay đổi.
     * @return Thông báo thành công kèm theo request gốc hoặc kết quả trả về.
     */
    @PutMapping("/{bookingId}/modify")
    @PreAuthorize("hasAuthority('UPDATE_BOOKING')")
    public ResponseEntity<ApiResponse<BookingModificationResponse>> modifyBooking(
            @PathVariable String bookingId,
            @RequestBody BookingModificationRequest request
    ) {
        log.info("Received request to modify booking ID: {}", bookingId);

        BookingModificationResponse result = bookingManagementService.modifyBooking(bookingId, request);

        return ResponseEntity.ok(
                ApiResponse.<BookingModificationResponse>builder()
                        .code(200)
                        .message("Booking modified successfully")
                        .result(result)
                        .build()
        );
    }

}
