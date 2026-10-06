package iuh.fit.se.hotelmanagement_be.modular.branch.controllers;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import iuh.fit.se.hotelmanagement_be.modular.auth.entities.Account;
import iuh.fit.se.hotelmanagement_be.modular.branch.responses.FloorResponse;
import iuh.fit.se.hotelmanagement_be.modular.branch.services.FloorService;
import iuh.fit.se.hotelmanagement_be.shared.dtos.ApiResponse;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/floor")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Floor", description = "APIs liên quan đến quản lý tầng")
public class FloorController {
    FloorService floorService;

    @GetMapping("/getFloorsByBuildingId")
    @PreAuthorize("hasAuthority('VIEW_FLOORS') and (hasAuthority('ROLE_SUPER_ADMIN') or principal.hotelId != null)")
    @Operation(summary = "Lấy danh sách tầng theo ID tòa nhà")
    public ResponseEntity<ApiResponse<List<FloorResponse>>> getFloorsByBuildingId(
            @RequestParam String buildingId,
            Authentication authentication) {
        Account account = (Account) authentication.getPrincipal();
        List<FloorResponse> floors = floorService.getFloorsByBuildingId(buildingId, account.getHotelId());
        return ResponseEntity.ok(ApiResponse.<List<FloorResponse>>builder()
                .code(200)
                .result(floors)
                .build());
    }

    @GetMapping("/getFloorsByHotelId")
    @PreAuthorize("hasAuthority('VIEW_FLOORS') and (hasAuthority('ROLE_SUPER_ADMIN') or principal.hotelId != null)")
    @Operation(summary = "Lấy danh sách tầng thuộc khách sạn của tài khoản đăng nhập")
    public ResponseEntity<ApiResponse<List<FloorResponse>>> getFloorsByHotelId(Authentication authentication) {
        Account account = (Account) authentication.getPrincipal();
        List<FloorResponse> floors = floorService.getAllFloors(account.getHotelId());
        return ResponseEntity.ok(ApiResponse.<List<FloorResponse>>builder()
                .code(200)
                .result(floors)
                .build());
    }
}
