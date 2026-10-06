package iuh.fit.se.hotelmanagement_be.modular.booking.controllers;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import iuh.fit.se.hotelmanagement_be.modular.auth.entities.Account;
import iuh.fit.se.hotelmanagement_be.modular.booking.responses.BookingResponse;
import iuh.fit.se.hotelmanagement_be.modular.booking.services.CheckInOutService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
@Slf4j
@RestController
@RequestMapping("/checkInOuts")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Checkin checkout", description = "APIs liên quan đến checkin checkout")
public class CheckInOutController {
    CheckInOutService checkInOutService;
    /**
     * POST: /bookings/{bookingId}/bulk-check-in?employeeId=...
     */
    @PostMapping("/{bookingId}/check-in/bulk")
    @PreAuthorize("hasAuthority('MANAGE_CHECKIN_CHECKOUT')")
    @Operation(summary = "Thực hiện thủ tục nhận phòng đồng loạt (Bulk Check-in) cho danh sách phòng được chọn và tính phụ thu sớm")
    public ResponseEntity<BookingResponse> processBulkCheckIn(
            @PathVariable String bookingId,
            @RequestBody List<String> bookingDetailIds,
            Authentication authentication) {

            // Lấy ngầm hotelId từ Token
            Account account = (Account) authentication.getPrincipal();
            String employeeId = account.getEmployeeId();
        BookingResponse response = checkInOutService.processBulkCheckIn(bookingId, bookingDetailIds, employeeId);
        return ResponseEntity.ok(response);
    }

    /**
     * POST: /bookings/{bookingId}/bulk-check-out?employeeId=...
     */
    @PostMapping("/{bookingId}/check-out/bulk")
    @PreAuthorize("hasAuthority('MANAGE_CHECKIN_CHECKOUT')")
    @Operation(summary = "Thực hiện thủ tục trả phòng đồng loạt (Bulk Check-out), tính phụ thu lố giờ, chốt tiền dịch vụ và đóng Order CLOSED")
    public ResponseEntity<BookingResponse> c(
            @PathVariable String bookingId,
            @RequestBody List<String> bookingDetailIds,
            Authentication authentication) {
        // Lấy ngầm hotelId từ Token
        Account account = (Account) authentication.getPrincipal();
        String employeeId = account.getEmployeeId();
        BookingResponse response = checkInOutService.processBulkCheckOut(bookingId, bookingDetailIds, employeeId);
        return ResponseEntity.ok(response);
    }
}
