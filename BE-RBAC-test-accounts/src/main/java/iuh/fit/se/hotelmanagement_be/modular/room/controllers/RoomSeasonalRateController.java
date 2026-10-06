package iuh.fit.se.hotelmanagement_be.modular.room.controllers;

import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import iuh.fit.se.hotelmanagement_be.modular.auth.entities.Account;
import iuh.fit.se.hotelmanagement_be.modular.room.entities.RoomSeasonalRate;
import iuh.fit.se.hotelmanagement_be.modular.room.entities.enums.RoomType;
import iuh.fit.se.hotelmanagement_be.modular.room.requests.RoomSeasonalRateCreateRequest;
import iuh.fit.se.hotelmanagement_be.modular.room.requests.RoomSeasonalRateUpdateRequest;
import iuh.fit.se.hotelmanagement_be.modular.room.responses.RoomSeasonalRateResponse;
import iuh.fit.se.hotelmanagement_be.modular.room.services.RoomSeasonalRateService;
import iuh.fit.se.hotelmanagement_be.shared.dtos.ApiResponse;
import jakarta.validation.Valid;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/room_seasonal_rates")
@Tag(name = "Room Seasonal Raete", description = "APIs liên qua đến quản lí giá của chi nhánh theo từng sự kiện")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class RoomSeasonalRateController {
    // lay ds gia cho su kien
    // them su kien gia
    // chinh sua su kien gia
    // lấy tât cả ds sự kiện
    RoomSeasonalRateService roomSeasonalRateService;

    /**
     * API phân trang danh sách đợt giá mùa vụ theo chi nhánh, hỗ trợ lọc tùy chọn theo loại phòng và sắp xếp.
     *
     * @param roomType Loại phòng (Không bắt buộc: ?roomType=DELUXE. Nếu bỏ trống sẽ lấy tất cả loại phòng)
     * @param pageable Phân trang & sắp xếp tự động nhận từ Spring: ?page=0&size=10&sort=startDate,asc
     */
    @GetMapping("/hotel/by-date")
    public ResponseEntity<Page<RoomSeasonalRate>> getSeasonalRatesByDate(
            Authentication authentication,
            @RequestParam(required = false) RoomType roomType,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date, // <-- Truyền ngày ở đây nè!
            @Parameter(hidden = true) Pageable pageable // <-- Thêm dòng này để định nghĩa sẵn nếu client không truyền
    ) {
        Account account = (Account) authentication.getPrincipal();
        Long hotelId = account.getHotelId();
        Page<RoomSeasonalRate> result = roomSeasonalRateService.getRatesByDate(hotelId, roomType, date, pageable);
        return ResponseEntity.ok(result);
    }

    /**
     * API Tạo mới đợt giá mùa vụ cho chi nhánh
     * Đồng thời check trùng lịch và bắn Socket realtime qua tầng Service
     */
    @PreAuthorize("hasAuthority('UPDATE_ROOM')")
    @PostMapping("/createSeasonalRate")
    public ResponseEntity<ApiResponse<List<RoomSeasonalRateResponse>>> createSeasonalRate(
            @RequestBody List<@Valid RoomSeasonalRateCreateRequest> requests,
            Authentication authentication // Lấy thông tin admin đang đăng nhập từ Security Context
    ) {
        Account currentAdmin = (Account) authentication.getPrincipal();
        List<RoomSeasonalRateResponse> response = roomSeasonalRateService.createSeasonalRate(requests, currentAdmin);

        return ResponseEntity.ok(
                ApiResponse.<List<RoomSeasonalRateResponse>>builder()
                        .code(1000) // Hoặc code thành công tùy cấu trúc dự án của ông
                        .message("Tạo đợt giá mùa vụ thành công và đã cập nhật realtime!")
                        .result(response)
                        .build()
        );
    }

    @PreAuthorize("hasAuthority('UPDATE_ROOM')")
    @PostMapping("/updateSeasonalRate")
    public ResponseEntity<ApiResponse<List<RoomSeasonalRateResponse>>> updateSeasonalRate(
            @RequestBody List<@Valid RoomSeasonalRateUpdateRequest> requests,
            Authentication authentication) {
        Account currentAdmin = (Account) authentication.getPrincipal();
        List<RoomSeasonalRateResponse> responses = roomSeasonalRateService.saveOrUpdateBatchSeasonalRates(requests, currentAdmin);
        return ResponseEntity.ok(
                ApiResponse.<List<RoomSeasonalRateResponse>>builder()
                        .code(1000)
                        .message("Cap nhat thanh cong giá mùa vụ thành công và đã cập nhật realtime!")
                        .result(responses)
                        .build()
        );

    }

    @PreAuthorize("hasAuthority('VIEW_ROOMS')")
    @GetMapping("/hotel/{hotelId}/monthly")
    public ResponseEntity<ApiResponse<List<RoomSeasonalRateResponse>>> getRatesByMonth(
            Authentication authentication,
            @RequestParam int month,
            @RequestParam int year) {
        Account account = (Account) authentication.getPrincipal();
        Long  hotelId = account.getHotelId();

        List<RoomSeasonalRateResponse> responses = roomSeasonalRateService.getRatesByMonth(hotelId, month, year);

        return ResponseEntity.ok(
                ApiResponse.<List<RoomSeasonalRateResponse>>builder()
                        .code(1000)
                        .message("Lấy danh sách sự kiện theo tháng thành công!")
                        .result(responses)
                        .build()
        );
    }

}
