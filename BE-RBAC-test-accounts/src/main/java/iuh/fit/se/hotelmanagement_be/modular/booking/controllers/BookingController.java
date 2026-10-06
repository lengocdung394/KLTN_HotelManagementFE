package iuh.fit.se.hotelmanagement_be.modular.booking.controllers;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import iuh.fit.se.hotelmanagement_be.modular.auth.entities.Account;
import iuh.fit.se.hotelmanagement_be.modular.booking.requests.BookingCreateRequest;
import iuh.fit.se.hotelmanagement_be.modular.booking.responses.BookingResponse;
import iuh.fit.se.hotelmanagement_be.modular.booking.responses.CheckoutSummaryResponse;
import iuh.fit.se.hotelmanagement_be.modular.booking.responses.RoomMatrixResponse;
import iuh.fit.se.hotelmanagement_be.modular.booking.services.BookingService;
import jakarta.validation.Valid;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/bookings")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Booking", description = "APIs liên quan đến đặt phòng")
public class BookingController {

    BookingService bookingService;
    iuh.fit.se.hotelmanagement_be.modular.room.repositories.RoomRepository roomRepository;

    @GetMapping("/available-rooms")
    public ResponseEntity<?> getAvailableRooms() {
        return ResponseEntity.ok(roomRepository.findAll());
    }

    /**
     * Endpoint 1: Khách hàng tự đặt phòng trực tuyến (Online)
     */
    @PostMapping("/customer")
    @Operation(summary = "Khách hàng tự đặt phòng trực tuyến (Online)")
    public ResponseEntity<BookingResponse> createCustomerBooking(@RequestBody @Valid BookingCreateRequest request) {
        BookingResponse response = bookingService.createCustomerBooking(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PostMapping("/counter")
    @PreAuthorize("hasAuthority('CREATE_BOOKING')")
    @Operation(summary = "Nhân viên hỗ trợ đặt phòng tại quầy")
    public ResponseEntity<BookingResponse> createCounterBooking(
            @RequestBody @Valid BookingCreateRequest request,
            Authentication authentication
    ) {
        // 1. Lấy thông tin tài khoản đang đăng nhập từ token
        Account account = (Account) authentication.getPrincipal();

        // 2. Lấy mã nhân viên và mã khách sạn trực tiếp ngầm từ token
        String employeeId = account.getEmployeeId();
        Long hotelId = account.getHotelId();

        // 3. Truyền xuống service
        BookingResponse response = bookingService.createCounterBooking(employeeId, hotelId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }


    /**
     * Endpoint 4: Lấy thông tin tổng quan lúc Checkout (Xem khách còn nợ bao nhiêu tiền dịch vụ)
     */
    @GetMapping("/{bookingId}/checkout-summary")
    @Operation(summary = "Lấy thông tin tổng quan hóa đơn lúc Checkout (Đối soát tiền còn thiếu)")
    public ResponseEntity<CheckoutSummaryResponse> getCheckoutSummary(@PathVariable String bookingId) {
        return ResponseEntity.ok(bookingService.getCheckoutSummary(bookingId));
    }



}