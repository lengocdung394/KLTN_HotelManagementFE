package iuh.fit.se.hotelmanagement_be.modular.branch.controllers;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import iuh.fit.se.hotelmanagement_be.modular.auth.entities.Account;
import iuh.fit.se.hotelmanagement_be.modular.branch.responses.BuildingResponse;
import iuh.fit.se.hotelmanagement_be.modular.branch.services.BuildingService;
import iuh.fit.se.hotelmanagement_be.shared.dtos.ApiResponse;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/branch")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Building", description = "APIs liên quan đến quản lý tòa nhà")
public class BuildingController {
    BuildingService buildingService;

    @GetMapping("/getBuildingByHotelId")
    @PreAuthorize("hasAuthority('VIEW_BUILDINGS')")
    @Operation(summary = "Lấy danh sách tòa nhà theo khách sạn của tài khoản đăng nhập")
    public ResponseEntity<ApiResponse<List<BuildingResponse>>> getBuildingsByHotelId(Authentication authentication) {
        Account account = (Account) authentication.getPrincipal();
        List<BuildingResponse> buildings = buildingService.getBuildingsByHotelId(account.getHotelId());
        return ResponseEntity.ok(ApiResponse.<List<BuildingResponse>>builder()
                .code(100)
                .result(buildings)
                .message("Lấy danh sách tòa nhà thành công")
                .build());
    }
}
