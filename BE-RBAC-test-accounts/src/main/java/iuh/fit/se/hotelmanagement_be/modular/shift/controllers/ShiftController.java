package iuh.fit.se.hotelmanagement_be.modular.shift.controllers;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import iuh.fit.se.hotelmanagement_be.config.SecurityUtils;
import iuh.fit.se.hotelmanagement_be.modular.shift.requests.ShiftAssignRequest;
import iuh.fit.se.hotelmanagement_be.modular.shift.requests.ShiftBatchAssignRequest;
import iuh.fit.se.hotelmanagement_be.modular.shift.responses.DailyShiftSummaryResponse;
import iuh.fit.se.hotelmanagement_be.modular.shift.responses.ShiftAssignmentResponse;
import iuh.fit.se.hotelmanagement_be.modular.shift.responses.WeeklyScheduleResponse;
import iuh.fit.se.hotelmanagement_be.modular.shift.services.ShiftService;
import iuh.fit.se.hotelmanagement_be.shared.dtos.ApiResponse;
import jakarta.validation.Valid;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@CrossOrigin(origins = "*")
@RestController
@RequestMapping("/staff-shifts")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Staff Shift Management", description = "APIs quản lý ca trực và phân công lịch làm việc theo tuần cho nhân viên (Phục vụ 3 tab trang Nhân viên)")
public class ShiftController {

    ShiftService shiftService;

    private Long resolveHotelId(Long hotelId) {
        Long tokenHotelId = SecurityUtils.getCurrentUserHotelId();
        return tokenHotelId != null ? tokenHotelId : hotelId;
    }

    @GetMapping("/today")
    @PreAuthorize("hasAuthority('VIEW_STAFF_SHIFTS')")
    @Operation(summary = "Lấy danh sách ca trực hôm nay (Tab 1: Ca trực hôm nay)",
            description = "Trả về danh sách nhân viên trực ca sáng / tối kèm vị trí và công việc của ngày hôm nay.")
    public ResponseEntity<ApiResponse<List<ShiftAssignmentResponse>>> getTodayShifts(
            @Parameter(description = "ID khách sạn / chi nhánh") @RequestParam(required = false) Long hotelId,
            @Parameter(description = "Ngày cần xem (mặc định hôm nay)") @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date
    ) {
        Long targetHotelId = resolveHotelId(hotelId);
        List<ShiftAssignmentResponse> result = shiftService.getTodayShifts(targetHotelId, date);
        return ResponseEntity.ok(ApiResponse.<List<ShiftAssignmentResponse>>builder()
                .code(1000)
                .message("Lấy danh sách ca trực thành công")
                .result(result)
                .build());
    }

    @GetMapping("/today/summary")
    @PreAuthorize("hasAuthority('VIEW_STAFF_SHIFTS')")
    @Operation(summary = "Lấy tóm tắt ca trực trong ngày",
            description = "Bao gồm ngày, thứ, trạng thái đủ ca và danh sách phân công.")
    public ResponseEntity<ApiResponse<DailyShiftSummaryResponse>> getDailyShiftSummary(
            @Parameter(description = "ID khách sạn") @RequestParam(required = false) Long hotelId,
            @Parameter(description = "Ngày cần xem") @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date
    ) {
        Long targetHotelId = resolveHotelId(hotelId);
        DailyShiftSummaryResponse result = shiftService.getDailyShiftSummary(targetHotelId, date);
        return ResponseEntity.ok(ApiResponse.<DailyShiftSummaryResponse>builder()
                .code(1000)
                .message("Lấy tóm tắt ca trực thành công")
                .result(result)
                .build());
    }

    @GetMapping("/weekly")
    @PreAuthorize("hasAuthority('VIEW_STAFF_SHIFTS')")
    @Operation(summary = "Lấy lịch phân ca cả tuần (Tab 3: Lịch phân ca tuần)",
            description = "Trả về ma trận 7 ngày (từ Thứ 2 đến Chủ nhật) kèm thống kê số ca đã phân công và nhân viên trực.")
    public ResponseEntity<ApiResponse<WeeklyScheduleResponse>> getWeeklySchedule(
            @Parameter(description = "ID khách sạn / chi nhánh") @RequestParam(required = false) Long hotelId,
            @Parameter(description = "Ngày đầu tuần Thứ 2 (YYYY-MM-DD)") @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate weekStartDate
    ) {
        Long targetHotelId = resolveHotelId(hotelId);
        WeeklyScheduleResponse result = shiftService.getWeeklySchedule(targetHotelId, weekStartDate);
        return ResponseEntity.ok(ApiResponse.<WeeklyScheduleResponse>builder()
                .code(1000)
                .message("Lấy lịch phân ca tuần thành công")
                .result(result)
                .build());
    }

    @PostMapping("/assign")
    @PreAuthorize("hasAuthority('MANAGE_STAFF_SHIFTS')")
    @Operation(summary = "Phân công một ca trực cho nhân viên",
            description = "Tạo mới hoặc cập nhật phân công nhân viên vào ca làm việc theo ngày và vị trí.")
    public ResponseEntity<ApiResponse<ShiftAssignmentResponse>> assignShift(
            @Valid @RequestBody ShiftAssignRequest request,
            @RequestParam(required = false) Long hotelId
    ) {
        Long targetHotelId = resolveHotelId(hotelId);
        ShiftAssignmentResponse result = shiftService.assignShift(request, targetHotelId);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.<ShiftAssignmentResponse>builder()
                .code(1000)
                .message("Phân công ca trực thành công")
                .result(result)
                .build());
    }

    @PostMapping("/assign-batch")
    @PreAuthorize("hasAuthority('MANAGE_STAFF_SHIFTS')")
    @Operation(summary = "Lưu phân công ca trực hàng loạt cho cả tuần",
            description = "Nhận danh sách phân ca của nhiều ngày/nhiều vị trí và lưu đồng loạt vào CSDL.")
    public ResponseEntity<ApiResponse<List<ShiftAssignmentResponse>>> assignBatch(
            @Valid @RequestBody ShiftBatchAssignRequest request,
            @RequestParam(required = false) Long hotelId
    ) {
        Long targetHotelId = resolveHotelId(hotelId);
        List<ShiftAssignmentResponse> result = shiftService.assignBatchShifts(request, targetHotelId);
        return ResponseEntity.ok(ApiResponse.<List<ShiftAssignmentResponse>>builder()
                .code(1000)
                .message("Lưu phân ca hàng loạt thành công")
                .result(result)
                .build());
    }

    @DeleteMapping("/{shiftId}")
    @PreAuthorize("hasAuthority('MANAGE_STAFF_SHIFTS')")
    @Operation(summary = "Hủy / Xóa phân công một ca trực")
    public ResponseEntity<ApiResponse<Void>> deleteShift(@PathVariable String shiftId) {
        shiftService.deleteShift(shiftId);
        return ResponseEntity.ok(ApiResponse.<Void>builder()
                .code(1000)
                .message("Đã xóa ca trực thành công")
                .build());
    }

    @PostMapping("/init-default")
    @PreAuthorize("hasAuthority('MANAGE_STAFF_SHIFTS')")
    @Operation(summary = "Tự động tạo lịch phân ca mẫu nếu tuần chưa có lịch")
    public ResponseEntity<ApiResponse<WeeklyScheduleResponse>> initDefaultWeeklySchedule(
            @RequestParam(required = false) Long hotelId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate weekStartDate
    ) {
        Long targetHotelId = resolveHotelId(hotelId);
        WeeklyScheduleResponse result = shiftService.initDefaultWeeklyScheduleIfEmpty(targetHotelId, weekStartDate);
        return ResponseEntity.ok(ApiResponse.<WeeklyScheduleResponse>builder()
                .code(1000)
                .message("Khởi tạo lịch mẫu tuần thành công")
                .result(result)
                .build());
    }
}
