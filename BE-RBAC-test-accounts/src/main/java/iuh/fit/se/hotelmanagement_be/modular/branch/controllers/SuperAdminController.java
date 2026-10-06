package iuh.fit.se.hotelmanagement_be.modular.branch.controllers;

import iuh.fit.se.hotelmanagement_be.modular.branch.requests.BranchRoomPolicyRequest;
import iuh.fit.se.hotelmanagement_be.modular.branch.requests.SuperAdminCreateBranchRequest;
import iuh.fit.se.hotelmanagement_be.modular.branch.responses.SuperAdminBranchDetailResponse;
import iuh.fit.se.hotelmanagement_be.modular.branch.responses.SuperAdminBranchSummaryResponse;
import iuh.fit.se.hotelmanagement_be.modular.branch.responses.SuperAdminProvinceResponse;
import iuh.fit.se.hotelmanagement_be.modular.branch.services.SuperAdminService;
import iuh.fit.se.hotelmanagement_be.shared.dtos.ApiResponse;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/super-admin")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@PreAuthorize("hasAuthority('ROLE_SUPER_ADMIN')")
public class SuperAdminController {
    SuperAdminService superAdminService;

    @GetMapping("/provinces")
    public ResponseEntity<ApiResponse<List<SuperAdminProvinceResponse>>> getProvinces() {
        return ResponseEntity.ok(response(
                superAdminService.getProvinces(),
                "Lấy danh sách tỉnh/thành công."));
    }

    @GetMapping("/branches")
    public ResponseEntity<ApiResponse<List<SuperAdminBranchSummaryResponse>>> getBranches() {
        return ResponseEntity.ok(response(
                superAdminService.getBranches(),
                "Lấy danh sách chi nhánh thành công."));
    }

    @GetMapping("/branches/by-province/{provinceId}")
    public ResponseEntity<ApiResponse<List<SuperAdminBranchSummaryResponse>>> getBranchesByProvince(
            @PathVariable String provinceId) {
        return ResponseEntity.ok(response(
                superAdminService.getBranchesByProvince(provinceId),
                "Lấy danh sách khách sạn theo tỉnh/thành thành công."));
    }

    @PostMapping("/branches")
    public ResponseEntity<ApiResponse<SuperAdminBranchSummaryResponse>> createBranch(
            @RequestBody SuperAdminCreateBranchRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(response(
                superAdminService.createBranch(request),
                "Tạo chi nhánh thành công."));
    }

    @GetMapping("/branches/{hotelId}")
    public ResponseEntity<ApiResponse<SuperAdminBranchDetailResponse>> getBranchDetails(
            @PathVariable Long hotelId) {
        return ResponseEntity.ok(response(
                superAdminService.getBranchDetails(hotelId),
                "Lấy chi tiết chi nhánh thành công."));
    }

    @PutMapping("/branches/{hotelId}/room-policies")
    public ResponseEntity<ApiResponse<List<SuperAdminBranchDetailResponse.RoomPolicyItem>>> saveBranchRoomPolicies(
            @PathVariable Long hotelId,
            @RequestBody List<BranchRoomPolicyRequest> requests) {
        return ResponseEntity.ok(response(
                superAdminService.saveBranchRoomPolicies(hotelId, requests),
                "Lưu cấu hình loại phòng cho chi nhánh thành công."));
    }

    private <T> ApiResponse<T> response(T result, String message) {
        return ApiResponse.<T>builder()
                .code(200)
                .message(message)
                .result(result)
                .build();
    }
}
