package iuh.fit.se.hotelmanagement_be.modular.auth.controllers;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import iuh.fit.se.hotelmanagement_be.modular.auth.entities.Account;
import iuh.fit.se.hotelmanagement_be.modular.auth.entities.Customer;
import iuh.fit.se.hotelmanagement_be.modular.auth.entities.enums.LoyaltyTier;
import iuh.fit.se.hotelmanagement_be.modular.auth.requests.*;
import iuh.fit.se.hotelmanagement_be.modular.auth.responses.*;
import iuh.fit.se.hotelmanagement_be.modular.auth.services.AuthService;
import iuh.fit.se.hotelmanagement_be.modular.auth.services.CustomerService;
import iuh.fit.se.hotelmanagement_be.shared.dtos.ApiResponse;
import jakarta.validation.Valid;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Arrays;
import java.util.List;

@RestController
@RequestMapping({"/customer", "/users"})
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Customer", description = "APIs dành cho khách hàng: Hồ sơ, Loyalty, Đổi mật khẩu")
public class CustomerController {

    AuthService authService;
    CustomerService customerService;

    @Operation(summary = "Lấy danh sách tất cả loại khách hàng (LoyaltyTier)")
    @GetMapping("/types")
    public ResponseEntity<ApiResponse<List<LoyaltyTier>>> getAllLoyaltyTier() {
        List<LoyaltyTier> loyaltyTier = Arrays.asList(LoyaltyTier.values());
        return ResponseEntity.ok(ApiResponse.<List<LoyaltyTier>>builder()
                .code(1000)
                .message("Lấy thành công danh sách loại khách hàng")
                .result(loyaltyTier)
                .build());
    }


    @Operation(summary = "Lấy thông tin hồ sơ của khách hàng đang đăng nhập")
    @SecurityRequirement(name = "bearerAuth")
    @PreAuthorize("hasRole('CUSTOMER')")
    @GetMapping("/me/profile")
    public ResponseEntity<ApiResponse<CustomerProfileResponse>> getMyProfile() {
        CustomerProfileResponse response = authService.getMyCustomerProfile();
        return ResponseEntity.ok(ApiResponse.<CustomerProfileResponse>builder()
                .code(1000)
                .message("Lấy thông tin hồ sơ thành công")
                .result(response)
                .build());
    }

    @Operation(summary = "Cập nhật hồ sơ cá nhân của khách hàng")
    @SecurityRequirement(name = "bearerAuth")
    @PreAuthorize("hasRole('CUSTOMER')")
    @PutMapping("/me/profile")
    public ResponseEntity<ApiResponse<CustomerProfileResponse>> updateMyProfile(
            @Valid @RequestBody CustomerUpdateProfileRequest request) {
        CustomerProfileResponse response = authService.updateMyCustomerProfile(request);
        return ResponseEntity.ok(ApiResponse.<CustomerProfileResponse>builder()
                .code(1000)
                .message("Cập nhật hồ sơ thành công")
                .result(response)
                .build());
    }

    @Operation(summary = "Đổi mật khẩu tài khoản khách hàng")
    @SecurityRequirement(name = "bearerAuth")
    @PreAuthorize("hasRole('CUSTOMER')")
    @PatchMapping("/me/change-password")
    public ResponseEntity<ApiResponse<Void>> changePassword(
            @Valid @RequestBody ChangePasswordRequest request) {
        authService.changeCustomerPassword(request);
        return ResponseEntity.ok(ApiResponse.<Void>builder()
                .code(1000)
                .message("Đổi mật khẩu thành công")
                .build());
    }

    // Luong tao khach hang tai quay
    @PostMapping("/walk-in")
    public ResponseEntity<CustomerResponse> createWalkInCustomer(@RequestBody @Valid WalkInCustomerRequest request,  Authentication authentication) {
        Account account = (Account) authentication.getPrincipal();
        Long hotelId = account.getHotelId();
        CustomerResponse newCustomer = customerService.createWalkInCustomer(request, hotelId);
        return ResponseEntity.status(HttpStatus.CREATED).body(newCustomer);
    }

    // Tìm kiếm khách hàng thông qua mã khách hàng
    @GetMapping("/findByIdCustomer/{id}")
    public ResponseEntity<CustomerFindByIdResponse> getCustomerById(@PathVariable String id) {
        CustomerFindByIdResponse customer = customerService.getCustomerById(id);
        return ResponseEntity.ok(customer);
    }

    @Operation(summary = "Nhân viên cập nhật thông tin khách hàng tại quầy")
    @PreAuthorize("hasAuthority('MANAGE_CUSTOMER')")
    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<iuh.fit.se.hotelmanagement_be.modular.auth.responses.CustomerGetOneResponse>> updateCustomer(
            @PathVariable String id,
            @RequestBody iuh.fit.se.hotelmanagement_be.modular.auth.requests.CustomerUpdateRequest request) {
        iuh.fit.se.hotelmanagement_be.modular.auth.responses.CustomerGetOneResponse updated = customerService.updateCustomer(id, request);
        return ResponseEntity.ok(ApiResponse.<iuh.fit.se.hotelmanagement_be.modular.auth.responses.CustomerGetOneResponse>builder()
                .code(1000)
                .message("Cập nhật thông tin khách hàng thành công")
                .result(updated)
                .build());
    }

    /**
     * 1. Yêu cầu đăng ký / kích hoạt tài khoản
     * Phân loại: NEW_CUSTOMER hoặc WALK_IN_CUSTOMER_NEEDS_PASSWORD và gửi OTP
     */
    @PostMapping("/register-request")
    public ResponseEntity<ApiResponse<CustomerRegisterResponse>> registerRequest(
            @Valid @RequestBody CustomerRegisterRequest request
    ) {
        CustomerRegisterResponse response = customerService.customerRegisterRequest(request);

        return ResponseEntity.ok(
                ApiResponse.<CustomerRegisterResponse>builder()
                        .code(1000) // Hoặc HttpStatus.OK.value() tùy chuẩn project của ông
                        .message("Yêu cầu đăng ký thành công")
                        .result(response)
                        .build()
        );
    }

    /**
     * 2. Xác thực OTP và hoàn tất đăng ký (tạo mật khẩu mới)
     */
    @PostMapping("/verify-register")
    public ResponseEntity<ApiResponse<UserResponse>> verifyAndRegister(
            @Valid @RequestBody VerifyOtpRequest request
    ) {
        UserResponse response = customerService.verifyOtpAndRegisterCustomer(request);

        return ResponseEntity.ok(
                ApiResponse.<UserResponse>builder()
                        .code(1000)
                        .message("Đăng ký tài khoản thành công")
                        .result(response)
                        .build()
        );
    }
    @PostMapping("/check-registration")
    public ResponseEntity<ApiResponse<CustomerCheckResponse>> checkRegistration(
            @Valid @RequestBody CustomerCheckRequest request
    ) {
        CustomerCheckResponse response =
                customerService.checkCustomer(request);

        return ResponseEntity.ok(
                ApiResponse.<CustomerCheckResponse>builder()
                        .code(1000)
                        .message("Kiểm tra hồ sơ thành công")
                        .result(response)
                        .build()
        );
    }

}
