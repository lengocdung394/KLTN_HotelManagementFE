package iuh.fit.se.hotelmanagement_be.modular.room.controllers;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import iuh.fit.se.hotelmanagement_be.modular.room.requests.requestForAmenityExcel.AmenityExcelImportRequest;
import iuh.fit.se.hotelmanagement_be.modular.room.responses.AmenityGetAllResponse;
import iuh.fit.se.hotelmanagement_be.modular.room.services.AmenityService;
import iuh.fit.se.hotelmanagement_be.shared.dtos.ApiResponse;
import iuh.fit.se.hotelmanagement_be.shared.entities.ImportTaskStatus;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.PathVariable;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/amenities")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Amenity", description = "APIs liên quan đến quản lý tiện nghi")
public class AmenityController {
    AmenityService amenityService;

    @GetMapping("/getAll")
    @PreAuthorize("hasAuthority('VIEW_AMENITIES')")
    @Operation(summary = "Lấy danh sách tất cả tiện ích")
    public ResponseEntity<ApiResponse<List<AmenityGetAllResponse>>> getAll() {
        List<AmenityGetAllResponse> amenities = amenityService.getAllAmenities();

        return ResponseEntity.ok(ApiResponse.<List<AmenityGetAllResponse>>builder()
                .code(200)
                .message("Lấy danh sách tiện ích thành công!")
                .result(amenities)
                .build());
    }

    @PostMapping("/importExcel")
    @PreAuthorize("hasAuthority('MANAGE_AMENITIES')")
    @Operation(summary = "Nhập danh sách tiện nghi từ file Excel")
    public ResponseEntity<ApiResponse<List<AmenityGetAllResponse>>> importExcel(
            @RequestBody AmenityExcelImportRequest request) {
        List<AmenityGetAllResponse> imported = amenityService.importAmenities(request);
        return ResponseEntity.ok(ApiResponse.<List<AmenityGetAllResponse>>builder()
                .code(200)
                .message("Đã lưu " + imported.size() + " tiện nghi mới.")
                .result(imported)
                .build());
    }

    @PostMapping("/importExcel/async")
    @PreAuthorize("hasAuthority('MANAGE_AMENITIES')")
    @Operation(summary = "Bắt đầu nhập tiện nghi và trả về mã tiến trình")
    public ResponseEntity<Map<String, String>> startAsyncImport(
            @RequestBody AmenityExcelImportRequest request) {
        String taskId = amenityService.startAsyncImport(request);
        return ResponseEntity.accepted().body(Map.of(
                "taskId", taskId,
                "message", "Đã nhận dữ liệu tiện nghi và bắt đầu xử lý."
        ));
    }

    @GetMapping("/import-status/{taskId}")
    @PreAuthorize("hasAuthority('MANAGE_AMENITIES')")
    @Operation(summary = "Lấy tiến trình nhập tiện nghi")
    public ResponseEntity<ImportTaskStatus> getImportStatus(@PathVariable String taskId) {
        return ResponseEntity.ok(amenityService.getImportStatus(taskId));
    }
}
