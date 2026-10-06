package iuh.fit.se.hotelmanagement_be.modular.branch.services.impl;

import iuh.fit.se.hotelmanagement_be.modular.auth.responses.EmployeeResponse;
import iuh.fit.se.hotelmanagement_be.modular.auth.services.impl.EmployeeServiceImpl;
import iuh.fit.se.hotelmanagement_be.modular.booking.responses.BookingResponseForHotel;
import iuh.fit.se.hotelmanagement_be.modular.booking.services.BookingService;
import iuh.fit.se.hotelmanagement_be.modular.branch.entities.Hotel;
import iuh.fit.se.hotelmanagement_be.modular.branch.entities.Province;
import iuh.fit.se.hotelmanagement_be.modular.branch.repositories.BuildingRepository;
import iuh.fit.se.hotelmanagement_be.modular.branch.repositories.BranchRoomPolicyRepository;
import iuh.fit.se.hotelmanagement_be.modular.branch.repositories.FloorRepository;
import iuh.fit.se.hotelmanagement_be.modular.branch.repositories.HotelRepository;
import iuh.fit.se.hotelmanagement_be.modular.branch.repositories.ProvinceRepository;
import iuh.fit.se.hotelmanagement_be.modular.branch.requests.SuperAdminCreateBranchRequest;
import iuh.fit.se.hotelmanagement_be.modular.branch.requests.BranchRoomPolicyRequest;
import iuh.fit.se.hotelmanagement_be.modular.branch.entities.BranchRoomPolicy;
import iuh.fit.se.hotelmanagement_be.modular.branch.responses.SuperAdminBranchDetailResponse;
import iuh.fit.se.hotelmanagement_be.modular.branch.responses.SuperAdminBranchSummaryResponse;
import iuh.fit.se.hotelmanagement_be.modular.branch.responses.SuperAdminProvinceResponse;
import iuh.fit.se.hotelmanagement_be.modular.branch.services.SuperAdminService;
import iuh.fit.se.hotelmanagement_be.modular.promotion.repositories.PromotionRepository;
import iuh.fit.se.hotelmanagement_be.modular.room.repositories.RoomRepository;
import iuh.fit.se.hotelmanagement_be.modular.service.repositories.ServiceRepository;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.List;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class SuperAdminServiceImpl implements SuperAdminService {
    HotelRepository hotelRepository;
    ProvinceRepository provinceRepository;
    BuildingRepository buildingRepository;
    BranchRoomPolicyRepository branchRoomPolicyRepository;
    FloorRepository floorRepository;
    RoomRepository roomRepository;
    ServiceRepository serviceRepository;
    PromotionRepository promotionRepository;
    EmployeeServiceImpl employeeService;
    BookingService bookingService;

    @Override
    @Transactional(readOnly = true)
    public List<SuperAdminProvinceResponse> getProvinces() {
        return provinceRepository.findAll().stream()
                .map(province -> new SuperAdminProvinceResponse(province.getId(), province.getName()))
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<SuperAdminBranchSummaryResponse> getBranches() {
        return hotelRepository.findAll().stream().map(this::summarizeBranch).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<SuperAdminBranchSummaryResponse> getBranchesByProvince(String provinceId) {
        if (!provinceRepository.existsById(provinceId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy tỉnh/thành.");
        }
        return hotelRepository.findAllByProvince_Id(provinceId).stream()
                .map(this::summarizeBranch)
                .toList();
    }

    @Override
    @Transactional
    public SuperAdminBranchSummaryResponse createBranch(SuperAdminCreateBranchRequest request) {
        if (request == null || isBlank(request.getName()) || isBlank(request.getAddress())
                || isBlank(request.getPhone()) || isBlank(request.getProvinceName())) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Vui lòng nhập đầy đủ tên, địa chỉ, số điện thoại và tỉnh/thành.");
        }
        String name = request.getName().trim();
        if (hotelRepository.existsByName(name)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Tên chi nhánh đã tồn tại.");
        }
        Province province = provinceRepository.findByName(request.getProvinceName().trim())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.BAD_REQUEST, "Không tìm thấy tỉnh/thành đã chọn."));
        Hotel hotel = hotelRepository.save(Hotel.builder()
                .name(name)
                .address(request.getAddress().trim())
                .phone(request.getPhone().trim())
                .province(province)
                .build());
        return summarizeBranch(hotel);
    }

    @Override
    @Transactional(readOnly = true)
    public SuperAdminBranchDetailResponse getBranchDetails(Long hotelId) {
        Hotel hotel = hotelRepository.findById(hotelId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy chi nhánh."));
        List<EmployeeResponse> employees = employeeService.getEmployeesByHotelId(hotelId);
        List<BookingResponseForHotel> bookings = bookingService.getBookingsByHotel(hotelId);
        List<SuperAdminBranchDetailResponse.BuildingItem> buildings = buildingRepository.findByHotelId(hotelId).stream()
                .map(building -> new SuperAdminBranchDetailResponse.BuildingItem(
                        building.getId(),
                        building.getName(),
                        building.getFloors() == null ? 0 : building.getFloors().size()))
                .toList();
        List<SuperAdminBranchDetailResponse.FloorItem> floors = floorRepository.findByBuilding_Hotel_Id(hotelId).stream()
                .map(floor -> new SuperAdminBranchDetailResponse.FloorItem(
                        floor.getId(),
                        floor.getFloorNumber(),
                        floor.getBuilding().getId(),
                        floor.getBuilding().getName(),
                        floor.getRooms() == null ? 0 : floor.getRooms().size()))
                .toList();
        List<SuperAdminBranchDetailResponse.RoomItem> rooms = roomRepository.findByFloor_Building_Hotel_Id(hotelId).stream()
                .map(room -> new SuperAdminBranchDetailResponse.RoomItem(
                        room.getId(),
                        room.getRoomNumber(),
                        room.getRoomType() == null ? null : room.getRoomType().name(),
                        room.getRoomStatus() == null ? null : room.getRoomStatus().name(),
                        room.getFloor().getId(),
                        room.getFloor().getFloorNumber(),
                        room.getFloor().getBuilding().getName()))
                .toList();
        List<SuperAdminBranchDetailResponse.ServiceItem> services = serviceRepository.findAvailableServicesForHotel(hotelId).stream()
                .map(service -> new SuperAdminBranchDetailResponse.ServiceItem(
                        service.getId(),
                        service.getName(),
                        service.getCategory(),
                        service.getPrice(),
                        service.getUnit(),
                        service.getHotel() == null))
                .toList();
        List<SuperAdminBranchDetailResponse.PromotionItem> promotions = promotionRepository.findBranchAndSharedPromotions(hotelId).stream()
                .map(promotion -> new SuperAdminBranchDetailResponse.PromotionItem(
                        promotion.getId(),
                        promotion.getCode(),
                        promotion.getName(),
                        promotion.getStatus() == null ? null : promotion.getStatus().name(),
                        promotion.getStartDate() == null ? null : promotion.getStartDate().toString(),
                        promotion.getEndDate() == null ? null : promotion.getEndDate().toString()))
                .toList();
        List<SuperAdminBranchDetailResponse.RoomPolicyItem> roomPolicies = branchRoomPolicyRepository.findByHotelId(hotelId).stream()
                .map(this::toRoomPolicyItem)
                .toList();

        return SuperAdminBranchDetailResponse.builder()
                .branch(summarizeBranch(hotel, employees.size(), bookings))
                .employees(employees)
                .bookings(bookings)
                .buildings(buildings)
                .floors(floors)
                .rooms(rooms)
                .services(services)
                .promotions(promotions)
                .roomPolicies(roomPolicies)
                .build();
    }

    @Override
    @Transactional
    public List<SuperAdminBranchDetailResponse.RoomPolicyItem> saveBranchRoomPolicies(
            Long hotelId,
            List<BranchRoomPolicyRequest> requests) {
        Hotel hotel = hotelRepository.findById(hotelId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy chi nhánh."));
        if (requests == null || requests.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cần gửi ít nhất một cấu hình loại phòng.");
        }
        if (requests.stream().anyMatch(request -> request == null || request.getRoomType() == null
                || request.getBasePrice() == null || request.getArea() == null
                || request.getExtraAdultFee() == null || request.getExtraChildFee() == null
                || request.getStandardCapacity() == null || request.getMaxExtraGuests() == null)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Mỗi loại phòng cần đủ giá, diện tích, sức chứa và phụ thu.");
        }
        long distinctRoomTypes = requests.stream().map(BranchRoomPolicyRequest::getRoomType).distinct().count();
        if (distinctRoomTypes != requests.size()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Không được gửi trùng loại phòng.");
        }
        List<BranchRoomPolicy> savedPolicies = requests.stream().map(request -> {
            BranchRoomPolicy policy = branchRoomPolicyRepository
                    .findByHotelAndRoomType(hotel, request.getRoomType())
                    .orElseGet(() -> BranchRoomPolicy.builder()
                            .hotel(hotel)
                            .roomType(request.getRoomType())
                            .build());
            policy.setArea(request.getArea());
            policy.setBasePrice(request.getBasePrice());
            policy.setExtraAdultFee(request.getExtraAdultFee());
            policy.setExtraChildFee(request.getExtraChildFee());
            policy.setStandardCapacity(request.getStandardCapacity());
            policy.setMaxExtraGuests(request.getMaxExtraGuests());
            return branchRoomPolicyRepository.save(policy);
        }).toList();
        return savedPolicies.stream().map(this::toRoomPolicyItem).toList();
    }

    private SuperAdminBranchDetailResponse.RoomPolicyItem toRoomPolicyItem(BranchRoomPolicy policy) {
        return new SuperAdminBranchDetailResponse.RoomPolicyItem(
                policy.getId(),
                policy.getRoomType().name(),
                policy.getArea(),
                policy.getBasePrice(),
                policy.getExtraAdultFee(),
                policy.getExtraChildFee(),
                policy.getStandardCapacity(),
                policy.getMaxExtraGuests());
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
}
