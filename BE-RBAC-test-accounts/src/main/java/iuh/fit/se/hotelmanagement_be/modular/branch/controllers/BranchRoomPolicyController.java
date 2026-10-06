package iuh.fit.se.hotelmanagement_be.modular.branch.controllers;

import io.swagger.v3.oas.annotations.tags.Tag;
import iuh.fit.se.hotelmanagement_be.modular.auth.entities.Account;
import iuh.fit.se.hotelmanagement_be.modular.branch.entities.BranchRoomPolicy;
import iuh.fit.se.hotelmanagement_be.modular.branch.requests.BranchRoomPolicyRequest;
import iuh.fit.se.hotelmanagement_be.modular.branch.services.BranchRoomPolicyService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.stereotype.Service;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/branch_room_policys")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "BranchRoomPolicy", description = "API liên quan đến cấu hình của từng loại phòng")
public class BranchRoomPolicyController {

    BranchRoomPolicyService branchRoomPolicyService;

    // 1. Lấy danh sách loại phòng và chính sách giá theo chi nhánh (hotelId)
    @GetMapping("/hotel")
    public ResponseEntity<List<BranchRoomPolicy>> getPoliciesByHotel(Authentication authentication) {
        Account account = (Account) authentication.getPrincipal();
        Long hotelId = account.getHotelId();
        List<BranchRoomPolicy> policies = branchRoomPolicyService.getPoliciesByHotel(hotelId);
        return ResponseEntity.ok(policies);
    }

    // 2. Chỉnh sửa giá và chính sách cho từng loại phòng chỉ cho admin and quan li chinh sua
    @PreAuthorize("hasAuthority('MANAGE_BRANCH_SETTINGS')")
    @PutMapping("/{policyId}")
    public ResponseEntity<BranchRoomPolicy> updateRoomPolicy(
            @PathVariable String policyId,
            @RequestBody BranchRoomPolicyRequest request,
            Authentication authentication
    ) {
        Account account = (Account) authentication.getPrincipal();
        BranchRoomPolicy updatedPolicy = branchRoomPolicyService.updateRoomPolicy(policyId, request, account);
        return ResponseEntity.ok(updatedPolicy);
    }
}
