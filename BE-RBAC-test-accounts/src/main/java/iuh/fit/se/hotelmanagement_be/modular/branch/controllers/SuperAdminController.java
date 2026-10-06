package iuh.fit.se.hotelmanagement_be.modular.branch.controllers;

import iuh.fit.se.hotelmanagement_be.modular.auth.responses.EmployeeResponse;
import iuh.fit.se.hotelmanagement_be.modular.auth.services.impl.EmployeeServiceImpl;
import iuh.fit.se.hotelmanagement_be.modular.booking.responses.BookingResponseForHotel;
import iuh.fit.se.hotelmanagement_be.modular.booking.services.BookingService;
import iuh.fit.se.hotelmanagement_be.modular.branch.entities.Hotel;
import iuh.fit.se.hotelmanagement_be.modular.branch.entities.Province;
import iuh.fit.se.hotelmanagement_be.modular.branch.repositories.HotelRepository;
import iuh.fit.se.hotelmanagement_be.modular.branch.repositories.ProvinceRepository;
import iuh.fit.se.hotelmanagement_be.modular.branch.requests.SuperAdminCreateBranchRequest;
import iuh.fit.se.hotelmanagement_be.modular.branch.responses.SuperAdminBranchDetailResponse;
import iuh.fit.se.hotelmanagement_be.modular.branch.responses.SuperAdminBranchSummaryResponse;
import iuh.fit.se.hotelmanagement_be.shared.dtos.ApiResponse;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.List;

@RestController
@RequestMapping("/super-admin")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@PreAuthorize("hasAuthority('ROLE_SUPER_ADMIN')")
public class SuperAdminController {
    HotelRepository hotelRepository;
    ProvinceRepository provinceRepository;
    EmployeeServiceImpl employeeService;
    BookingService bookingService;

    @GetMapping("/provinces")
    public ResponseEntity<ApiResponse<List<ProvinceOption>>> getProvinces() {
        List<ProvinceOption> provinces = provinceRepository.findAll().stream()
                .map(province -> new ProvinceOption(province.getId(), province.getName()))
                .toList();
        return ResponseEntity.ok(response(provinces, "Lấy danh sách tỉnh/thành công."));
    }

    @GetMapping("/branches")
    @Transactional(readOnly = true)
    public ResponseEntity<ApiResponse<List<SuperAdminBranchSummaryResponse>>> getBranches() {
        List<SuperAdminBranchSummaryResponse> branches = hotelRepository.findAll().stream()
                .map(this::summarizeBranch)
                .toList();
        return ResponseEntity.ok(response(branches, "Lấy danh sách chi nhánh thành công."));
    }

    @PostMapping("/branches")
    @Transactional
    public ResponseEntity<ApiResponse<SuperAdminBranchSummaryResponse>> createBranch(
            @RequestBody SuperAdminCreateBranchRequest request) {
        if (request == null || isBlank(request.getName()) || isBlank(request.getAddress())
                || isBlank(request.getPhone()) || isBlank(request.getProvinceName())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Vui lòng nhập đầy đủ tên, địa chỉ, số điện thoại và tỉnh/thành.");
        }
        String name = request.getName().trim();
        if (hotelRepository.existsByName(name)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Tên chi nhánh đã tồn tại.");
        }
        Province province = provinceRepository.findByName(request.getProvinceName().trim())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Không tìm thấy tỉnh/thành đã chọn."));
        Hotel hotel = hotelRepository.save(Hotel.builder()
                .name(name)
                .address(request.getAddress().trim())
                .phone(request.getPhone().trim())
                .province(province)
                .build());
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(response(summarizeBranch(hotel), "Tạo chi nhánh thành công."));
    }

    @GetMapping("/branches/{hotelId}")
    @Transactional(readOnly = true)
    public ResponseEntity<ApiResponse<SuperAdminBranchDetailResponse>> getBranchDetails(@PathVariable Long hotelId) {
        Hotel hotel = hotelRepository.findById(hotelId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy chi nhánh."));
        List<EmployeeResponse> employees = employeeService.getEmployeesByHotelId(hotelId);
        List<BookingResponseForHotel> bookings = bookingService.getBookingsByHotel(hotelId);
        return ResponseEntity.ok(response(SuperAdminBranchDetailResponse.builder()
                .branch(summarizeBranch(hotel, employees.size(), bookings))
                .employees(employees)
                .bookings(bookings)
                .build(), "Lấy chi tiết chi nhánh thành công."));
    }

    private SuperAdminBranchSummaryResponse summarizeBranch(Hotel hotel) {
        List<BookingResponseForHotel> bookings = bookingService.getBookingsByHotel(hotel.getId());
        long employeeCount = employeeService.getEmployeesByHotelId(hotel.getId()).size();
        return summarizeBranch(hotel, employeeCount, bookings);
    }

    private SuperAdminBranchSummaryResponse summarizeBranch(
            Hotel hotel,
            long employeeCount,
            List<BookingResponseForHotel> bookings) {
        BigDecimal totalRevenue = bookings.stream()
                .map(BookingResponseForHotel::getPaidAmount)
                .filter(amount -> amount != null)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        return SuperAdminBranchSummaryResponse.builder()
                .id(hotel.getId())
                .name(hotel.getName())
                .address(hotel.getAddress())
                .phone(hotel.getPhone())
                .provinceName(hotel.getProvince() == null ? null : hotel.getProvince().getName())
                .employeeCount(employeeCount)
                .bookingCount(bookings.size())
                .totalRevenue(totalRevenue)
                .build();
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private <T> ApiResponse<T> response(T result, String message) {
        return ApiResponse.<T>builder()
                .code(200)
                .message(message)
                .result(result)
                .build();
    }

    public record ProvinceOption(String id, String name) {
    }
}
