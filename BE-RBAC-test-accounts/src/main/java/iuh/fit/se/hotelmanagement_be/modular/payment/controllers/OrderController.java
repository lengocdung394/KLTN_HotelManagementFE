package iuh.fit.se.hotelmanagement_be.modular.payment.controllers;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import iuh.fit.se.hotelmanagement_be.modular.payment.entities.enums.OrderStatusType;
import iuh.fit.se.hotelmanagement_be.modular.payment.requests.PaymentCreateRequest;
import iuh.fit.se.hotelmanagement_be.modular.payment.responses.OrderResponse;
import iuh.fit.se.hotelmanagement_be.modular.payment.responses.PaymentTransactionResponse;
import iuh.fit.se.hotelmanagement_be.modular.payment.services.OrderService;
import iuh.fit.se.hotelmanagement_be.shared.dtos.ApiResponse;
import jakarta.validation.Valid;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/orders")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Order & Payment", description = "APIs quản lý hóa đơn thanh toán và các giao dịch đặt cọc, thanh toán quầy")
@SecurityRequirement(name = "bearerAuth")
public class OrderController {

    OrderService orderService;

    @GetMapping("/{id}")
    @Operation(
            summary = "Lấy chi tiết hóa đơn theo ID",
            description = "Truy vấn thông tin chi tiết hóa đơn, tiền phòng, tiền dịch vụ, giảm giá, số tiền đã trả và các giao dịch"
    )
    public ResponseEntity<ApiResponse<OrderResponse>> getById(
            @Parameter(description = "ID của hóa đơn", example = "ORD202609251234") @PathVariable String id) {

        return ResponseEntity.ok(ApiResponse.<OrderResponse>builder()
                .code(1000)
                .result(orderService.getOrderById(id))
                .message("Lấy thông tin hóa đơn thành công")
                .build());
    }

    @GetMapping("/booking/{bookingId}")
    @Operation(
            summary = "Lấy hóa đơn theo mã đặt phòng (Booking ID)",
            description = "Tra cứu hóa đơn tương ứng với đơn đặt phòng cụ thể"
    )
    public ResponseEntity<ApiResponse<OrderResponse>> getByBookingId(
            @Parameter(description = "ID của đơn đặt phòng", example = "BK12345") @PathVariable String bookingId) {

        return ResponseEntity.ok(ApiResponse.<OrderResponse>builder()
                .code(1000)
                .result(orderService.getOrderByBookingId(bookingId))
                .message("Lấy thông tin hóa đơn theo đơn đặt phòng thành công")
                .build());
    }

    @GetMapping
    @PreAuthorize("hasAuthority('VIEW_INVOICES')")
    @Operation(
            summary = "Lấy danh sách hóa đơn theo trạng thái",
            description = "Lọc hóa đơn theo trạng thái: OPEN (đang mở/chưa trả đủ), CLOSED (đã quyết toán), CANCELLED (hủy)"
    )
    public ResponseEntity<ApiResponse<List<OrderResponse>>> getOrdersByStatus(
            @Parameter(description = "Trạng thái hóa đơn: OPEN, CLOSED, CANCELLED", example = "OPEN")
            @RequestParam(required = false) OrderStatusType status) {

        return ResponseEntity.ok(ApiResponse.<List<OrderResponse>>builder()
                .code(1000)
                .result(orderService.getOrdersByStatus(status))
                .message("Lấy danh sách hóa đơn thành công")
                .build());
    }

    @PostMapping("/payments")
    @PreAuthorize("hasAuthority('MANAGE_CHECKIN_CHECKOUT')")
    @Operation(
            summary = "Thực hiện thanh toán / Ghi nhận tiền cọc hoặc thanh toán tại quầy",
            description = "Tạo một giao dịch thanh toán (tiền mặt, chuyển khoản, ví điện tử) cho hóa đơn. Tự động đóng hóa đơn nếu đã trả hết nợ."
    )
    public ResponseEntity<ApiResponse<PaymentTransactionResponse>> processPayment(
            @Valid @RequestBody PaymentCreateRequest request) {

        PaymentTransactionResponse result = orderService.processPayment(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.<PaymentTransactionResponse>builder()
                        .code(1000)
                        .result(result)
                        .message("Ghi nhận thanh toán thành công")
                        .build());
    }

    @PatchMapping("/{id}/close")
    @PreAuthorize("hasAuthority('MANAGE_CHECKIN_CHECKOUT')")
    @Operation(
            summary = "Quyết toán và đóng hóa đơn thủ công",
            description = "Nhân viên/Lễ tân chủ động đóng hóa đơn khi hoàn tất thủ tục trả phòng"
    )
    public ResponseEntity<ApiResponse<OrderResponse>> closeOrder(
            @Parameter(description = "ID của hóa đơn", example = "ORD202609251234") @PathVariable String id) {

        return ResponseEntity.ok(ApiResponse.<OrderResponse>builder()
                .code(1000)
                .result(orderService.closeOrder(id))
                .message("Đã quyết toán và đóng hóa đơn thành công")
                .build());
    }
}
