package iuh.fit.se.hotelmanagement_be.modular.promotion.controllers;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.tags.Tag;
import iuh.fit.se.hotelmanagement_be.modular.auth.entities.Account;
import iuh.fit.se.hotelmanagement_be.modular.promotion.enums.PromotionScope;
import iuh.fit.se.hotelmanagement_be.modular.promotion.enums.PromotionStatus;
import iuh.fit.se.hotelmanagement_be.modular.promotion.requests.ChangeStatusRequest;
import iuh.fit.se.hotelmanagement_be.modular.promotion.requests.CreatePromotionRequest;
import iuh.fit.se.hotelmanagement_be.modular.promotion.requests.UpdatePromotionRequest;
import iuh.fit.se.hotelmanagement_be.modular.promotion.responses.PageResponse;
import iuh.fit.se.hotelmanagement_be.modular.promotion.responses.PromotionResponse;
import iuh.fit.se.hotelmanagement_be.modular.promotion.services.PromotionService;
import iuh.fit.se.hotelmanagement_be.shared.dtos.ApiResponse;
import jakarta.validation.Valid;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/promotions")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Promotion", description = "APIs quản lý khuyến mãi khách sạn SenViet")
public class PromotionController {

    PromotionService promotionService;

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Tạo mới khuyến mãi")
    @PreAuthorize("hasAuthority('CREATE_PROMOTION')")
    public ResponseEntity<ApiResponse<PromotionResponse>> createPromotion(
            @Parameter(
                    content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                            schema = @Schema(implementation = CreatePromotionRequest.class))
            )
            @RequestPart("promotionInfo") @Valid CreatePromotionRequest request,
            @RequestPart(value = "image", required = false) MultipartFile imageFile,
            Authentication authentication
    ) {
        Account account = (Account) authentication.getPrincipal();
        Long hotelId = account.getHotelId();

        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.<PromotionResponse>builder()
                        .code(1000)
                        .result(promotionService.createPromotion(request, imageFile, hotelId))
                        .message("Tạo khuyến mãi thành công")
                        .build());
    }

    @GetMapping("/{id}")
    @Operation(summary = "Lấy chi tiết khuyến mãi theo ID")
    public ResponseEntity<ApiResponse<PromotionResponse>> getById(
            @Parameter(description = "ID của khuyến mãi") @PathVariable String id) {

        return ResponseEntity.ok(ApiResponse.<PromotionResponse>builder()
                .code(1000)
                .result(promotionService.getPromotionById(id))
                .message("Lấy thông tin thành công")
                .build());
    }

    @GetMapping
    @Operation(summary = "Lấy danh sách tất cả khuyến mãi",
            description = "Hỗ trợ filter: hotelId, status, type, keyword, startDate, endDate, page, size, sortBy, sortDir")
    public ResponseEntity<ApiResponse<PageResponse<PromotionResponse>>> getAll(
            @RequestParam(required = false) Long hotelId, // Thêm tham số lọc theo chi nhánh
            @RequestParam(required = false) PromotionStatus status,
            @RequestParam(required = false) PromotionScope type,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime endDate,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir) {

        // Map Java field name -> DB column name cho native query
        String sortColumn = switch (sortBy) {
            case "createdAt" -> "created_at";
            case "updatedAt" -> "updated_at";
            case "startDate" -> "start_date";
            case "endDate" -> "end_date";
            default -> sortBy;
        };
        Sort sort = sortDir.equalsIgnoreCase("asc")
                ? Sort.by(sortColumn).ascending()
                : Sort.by(sortColumn).descending();

        return ResponseEntity.ok(ApiResponse.<PageResponse<PromotionResponse>>builder()
                .code(1000)
                .result(promotionService.getAllPromotions(
                        hotelId, status, type, keyword, startDate, endDate, // Truyền thêm hotelId xuống Service
                        PageRequest.of(page, size, sort)))
                .message("Lấy danh sách thành công")
                .build());
    }

    @GetMapping("/active")
    @Operation(summary = "Lấy danh sách khuyến mãi đang ACTIVE")
    public ResponseEntity<ApiResponse<List<PromotionResponse>>> getActive() {
        return ResponseEntity.ok(ApiResponse.<List<PromotionResponse>>builder()
                .code(1000)
                .result(promotionService.getActivePromotions())
                .message("Lấy danh sách thành công")
                .build());
    }

    @PreAuthorize("hasAuthority('UPDATE_PROMOTION')")
    @PutMapping(value = "/{id}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Cập nhật thông tin khuyến mãi")
    public ResponseEntity<ApiResponse<PromotionResponse>> update(
            @PathVariable String id,
            @Parameter(
                    content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE,
                            schema = @Schema(implementation = UpdatePromotionRequest.class))
            )
            @RequestPart("promotionInfo") @Valid UpdatePromotionRequest request,
            @RequestPart(value = "image", required = false) MultipartFile imageFile,
            Authentication authentication) {

        Account account = (Account) authentication.getPrincipal();
        Long hotelId = account.getHotelId();

        return ResponseEntity.ok(ApiResponse.<PromotionResponse>builder()
                .code(1000)
                .result(promotionService.updatePromotion(id, request, imageFile, hotelId))
                .message("Cập nhật thành công")
                .build());
    }


    @PatchMapping("/{id}/status")
    @PreAuthorize("hasAuthority('UPDATE_PROMOTION')")
    @Operation(summary = "Thay đổi trạng thái khuyến mãi",
            description = "DRAFT→ACTIVE/INACTIVE | ACTIVE→INACTIVE/EXPIRED | INACTIVE→ACTIVE/EXPIRED")
    public ResponseEntity<ApiResponse<PromotionResponse>> changeStatus(
            @PathVariable String id,
            @Valid @RequestBody ChangeStatusRequest request) {

        return ResponseEntity.ok(ApiResponse.<PromotionResponse>builder()
                .code(1000)
                .result(promotionService.changeStatus(id, request))
                .message("Cập nhật trạng thái thành công")
                .build());
    }

    // ============================================================
    // DELETE /promotions/{id} — Xóa mềm
    // ============================================================
    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('DELETE_PROMOTION')")
    @Operation(summary = "Xóa khuyến mãi (soft delete)")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable String id) {
        promotionService.deletePromotion(id);
        return ResponseEntity.ok(ApiResponse.<Void>builder()
                .code(1000)
                .message("Xóa khuyến mãi thành công")
                .build());
    }
}
