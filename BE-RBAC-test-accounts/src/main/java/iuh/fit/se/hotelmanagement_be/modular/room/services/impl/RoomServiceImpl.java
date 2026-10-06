package iuh.fit.se.hotelmanagement_be.modular.room.services.impl;

import iuh.fit.se.hotelmanagement_be.config.SecurityUtils;
import iuh.fit.se.hotelmanagement_be.exception.AppException;
import iuh.fit.se.hotelmanagement_be.exception.ErrorCode;
import iuh.fit.se.hotelmanagement_be.modular.auth.entities.Account;
import iuh.fit.se.hotelmanagement_be.modular.branch.entities.BranchRoomPolicy;
import iuh.fit.se.hotelmanagement_be.modular.branch.entities.Floor;
import iuh.fit.se.hotelmanagement_be.modular.branch.entities.Hotel;
import iuh.fit.se.hotelmanagement_be.modular.branch.repositories.BranchRoomPolicyRepository;
import iuh.fit.se.hotelmanagement_be.modular.branch.repositories.FloorRepository;
import iuh.fit.se.hotelmanagement_be.modular.branch.repositories.HotelRepository;
import iuh.fit.se.hotelmanagement_be.modular.room.entities.Amenity;
import iuh.fit.se.hotelmanagement_be.modular.room.entities.Room;
import iuh.fit.se.hotelmanagement_be.modular.room.entities.RoomImage;
import iuh.fit.se.hotelmanagement_be.modular.room.entities.RoomTypeBed;
import iuh.fit.se.hotelmanagement_be.modular.room.entities.enums.RoomType;
import iuh.fit.se.hotelmanagement_be.modular.room.repositories.AmenityRepository;
import iuh.fit.se.hotelmanagement_be.modular.room.repositories.RoomRepository;
import iuh.fit.se.hotelmanagement_be.modular.room.repositories.RoomTypeBedRepository;
import iuh.fit.se.hotelmanagement_be.modular.room.requests.RoomCreateRequest;
import iuh.fit.se.hotelmanagement_be.modular.room.requests.RoomUpdateRequest;
import iuh.fit.se.hotelmanagement_be.modular.room.responses.RoomBedResponse;
import iuh.fit.se.hotelmanagement_be.modular.room.responses.RoomCreateResponse;
import iuh.fit.se.hotelmanagement_be.modular.room.responses.RoomResponse;
import iuh.fit.se.hotelmanagement_be.modular.room.responses.RoomTypeDetailResponse;
import iuh.fit.se.hotelmanagement_be.modular.room.services.RoomService;
import iuh.fit.se.hotelmanagement_be.shared.CloudinaryService;
import iuh.fit.se.hotelmanagement_be.shared.enums.ImageCategory;
import jakarta.transaction.Transactional;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class RoomServiceImpl implements RoomService {
    RoomRepository roomRepository;
    FloorRepository floorRepository;
    AmenityRepository amenityRepository;
    CloudinaryService cloudinaryService;
    RoomTypeBedRepository roomTypeBedRepository;
    private final BranchRoomPolicyRepository branchRoomPolicyRepository;
    private final HotelRepository hotelRepository;
    RoomSocketEmitter roomSocketEmitter;

    @Transactional
    @Override
    public RoomCreateResponse updateRoom(String roomId, RoomUpdateRequest dto, List<MultipartFile> imageFiles) {
        // 1. Tìm phòng cần chỉnh sửa
        Room room = roomRepository.findById(roomId)
                .orElseThrow(() -> new AppException(ErrorCode.ROOM_NOT_FOUND));

        // 2. Kiểm tra quyền bảo mật chi nhánh (Hotel Scope)
        Long currentHotelId = SecurityUtils.getCurrentUserHotelId();
        Long roomHotelId = (room.getFloor() != null && room.getFloor().getBuilding() != null
                && room.getFloor().getBuilding().getHotel() != null)
                ? room.getFloor().getBuilding().getHotel().getId()
                : null;

        if (currentHotelId != null && !currentHotelId.equals(roomHotelId)) {
            throw new AppException(ErrorCode.UNAUTHORIZED);
        }

        Floor newFloor = null;
        // 3. Kiểm tra và cập nhật Tầng (Floor) nếu có thay đổi
        if (!room.getFloor().getId().equals(dto.getFloorId())) {
            newFloor = floorRepository.findById(dto.getFloorId())
                    .orElseThrow(() -> new AppException(ErrorCode.FLOOR_NOT_FOUND));

            Long newFloorHotelId = (newFloor.getBuilding() != null && newFloor.getBuilding().getHotel() != null)
                    ? newFloor.getBuilding().getHotel().getId()
                    : null;

            if (currentHotelId != null && !currentHotelId.equals(newFloorHotelId)) {
                throw new AppException(ErrorCode.UNAUTHORIZED);
            }
            room.setFloor(newFloor);
        } else {
            newFloor = room.getFloor();
        }

        // Tự động sinh số phòng nếu người dùng không truyền lên (Dùng kiểu String)
        String roomNumber = dto.getRoomNumber();

        if (roomNumber == null || roomNumber.trim().isEmpty()) {
            String maxRoomNumStr = roomRepository.findMaxRoomNumberByFloorId(newFloor.getId());
            if (maxRoomNumStr != null && !maxRoomNumStr.isEmpty()) {
                try {
                    // Chuyển String lớn nhất hiện tại sang số nguyên, cộng 1, rồi đổi lại thành String
                    int nextNum = Integer.parseInt(maxRoomNumStr) + 1;
                    roomNumber = String.valueOf(nextNum);
                } catch (NumberFormatException e) {
                    // Phòng hờ nếu dữ liệu cũ trong DB không phải dạng số thuần túy
                    roomNumber = String.valueOf(newFloor.getFloorNumber() * 100 + 1);
                }
            } else {
                // Nếu tầng chưa có phòng nào, lấy chuẩn tầng nhân 100 + 1 (VD: Tầng 1 -> "101")
                roomNumber = String.valueOf(newFloor.getFloorNumber() * 100 + 1);
            }
        } else {
            // Kiểm tra nếu người dùng tự nhập mà bị trùng số phòng trong cùng tầng (trừ phòng hiện tại ra)
            boolean exists = roomRepository.existsByFloorIdAndRoomNumberAndIdNot(newFloor.getId(), roomNumber, roomId);
            if (exists) {
                throw new AppException(ErrorCode.ROOM_NUMBER_ALREADY_EXISTS);
            }
            room.setRoomNumber(roomNumber);
        }

        // 1. Khởi tạo danh sách chứa tất cả ảnh sau khi gộp
        List<RoomImage> finalRoomImages = new ArrayList<>();

        // 2. Đưa các ảnh cũ được giữ lại vào danh sách trước
        List<String> keptImageUrls = dto.getKeptImageUrls() != null ? dto.getKeptImageUrls() : new ArrayList<>();
        for (String url : keptImageUrls) {
            finalRoomImages.add(RoomImage.builder()
                    .url(url)
                    .isDefault(false) // Tạm thời để false hết
                    .build());
        }

        // 3. Upload ảnh mới và đưa tiếp vào danh sách sau ảnh cũ
//        List<MultipartFile> validNewFiles = validateAndFilterImages(imageFiles, false);
//        if (validNewFiles != null && !validNewFiles.isEmpty()) {
//            List<String> uploadedNewUrls = cloudinaryService.uploadMultipleImages(validNewFiles, "room");
//            for (String url : uploadedNewUrls) {
//                finalRoomImages.add(RoomImage.builder()
//                        .url(url)
//                        .isDefault(false) // Tạm thời để false hết
//                        .build());
//            }
//        }
        String branchName = "default-branch";
        if (newFloor.getBuilding() != null && newFloor.getBuilding().getHotel() != null) {
            branchName = newFloor.getBuilding().getHotel().getName();
        } else if (room.getFloor() != null && room.getFloor().getBuilding() != null && room.getFloor().getBuilding().getHotel() != null) {
            branchName = room.getFloor().getBuilding().getHotel().getName();
        }
        // ===================================================================================

        // 3. Upload ảnh mới và đưa tiếp vào danh sách sau ảnh cũ (Dùng uploadBranchImages theo chi nhánh)
        List<MultipartFile> validNewFiles = validateAndFilterImages(imageFiles, false);
        if (validNewFiles != null && !validNewFiles.isEmpty()) {
            List<String> uploadedNewUrls = cloudinaryService.uploadBranchImages(validNewFiles, branchName, ImageCategory.ROOMS);
            for (String url : uploadedNewUrls) {
                finalRoomImages.add(RoomImage.builder()
                        .url(url)
                        .isDefault(false)
                        .build());
            }
        }

        // 4. Kiểm tra tổng số lượng ảnh có thỏa mãn từ 4 đến 8 ảnh không
        if (finalRoomImages.size() < 4 || finalRoomImages.size() > 8) {
            throw new AppException(ErrorCode.INVALID_IMAGE_COUNT);
        }

        // 5. XÁC ĐỊNH VÀ GẮN CỜ ẢNH ĐẠI DIỆN (IS_DEFAULT)
        int targetDefaultIndex = 0; // Mặc định lấy tấm đầu tiên nếu client không truyền lên hoặc truyền sai
        if (dto.getDefaultImageIndex() != null
                && dto.getDefaultImageIndex() >= 0
                && dto.getDefaultImageIndex() < finalRoomImages.size()) {
            targetDefaultIndex = dto.getDefaultImageIndex();
        }

       // Duyệt qua danh sách gộp, vị trí nào trùng với targetDefaultIndex thì bật isDefault = true, còn lại false
        for (int i = 0; i < finalRoomImages.size(); i++) {
            boolean isDefault = (i == targetDefaultIndex);
            finalRoomImages.get(i).setIsDefault(isDefault);
        }

        // 6. Gán danh sách hoàn chỉnh vào Room để lưu DB
        room.setAvatarUrl(finalRoomImages);
        // 5. Cập nhật các thông tin cơ bản
        room.setRoomStatus(dto.getRoomStatus());
        room.setRoomType(dto.getRoomType());

        // 6. Cập nhật danh sách Tiện ích (Amenities)
        if (dto.getAmenityIds() != null) {
            Set<Amenity> amenities = new HashSet<>(amenityRepository.findAllById(dto.getAmenityIds()));
            room.setAmenities(amenities);
        }
        BranchRoomPolicy branchRoomPolicy = branchRoomPolicyRepository.findByHotelIdAndRoomType(currentHotelId, dto.getRoomType());
        // gia phong tieu chua
        room.setBasePrice(branchRoomPolicy.getBasePrice());
        // 7. Lưu thay đổi xuống CSDL
        Room updatedRoom = roomRepository.save(room);

        RoomCreateResponse response = RoomCreateResponse.builder()
                .id(updatedRoom.getId())
                .basePrice(updatedRoom.getBasePrice())
                .floorId(updatedRoom.getFloor().getId())
                .roomStatus(updatedRoom.getRoomStatus())
                .roomType(updatedRoom.getRoomType())
                .totalAmenitiesPrice(updatedRoom.getTotalAmenitiesPrice())
                .totalPrice(updatedRoom.calculateRoomTotalPrice(updatedRoom, branchRoomPolicy) + updatedRoom.getTotalAmenitiesPrice())
                .defaultImageUrl(updatedRoom.getDefaultImageUrl())
                .avatarUrl(updatedRoom.getAvatarUrl())
                .amenities(updatedRoom.getAmenities())
                .build();

        // 8. Bắn sự kiện qua Socket
        roomSocketEmitter.emitRoomRoomUpdate(currentHotelId, updatedRoom);
        return response;
    }

    // ham them phong
    @Transactional
    @Override
    public RoomCreateResponse createRoom(RoomCreateRequest dto, List<MultipartFile> imageFiles) {

        log.info("Thêm phòng, mã: {}", dto.toString());
        // kiem tra dau vao file anh
        List<MultipartFile> validFiles = validateAndFilterImages(imageFiles, true);
        // 2. Tìm Tầng (Floor)
        Floor floor = floorRepository.findById(dto.getFloorId())
                .orElseThrow(() -> new AppException(ErrorCode.FLOOR_NOT_FOUND));

        // ==================== BỔ SUNG: XÁC THỰC CHI NHÁNH (HOTEL SCOPE) ====================
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new AppException(ErrorCode.UNAUTHENTICATED);
        }


        // Tự động sinh số phòng nếu người dùng không truyền lên (Dùng kiểu String)
        String roomNumber = dto.getRoomNumber();
        var authorities = authentication.getAuthorities();
        boolean isAdmin = authorities.stream().anyMatch(a -> a.getAuthority().equals("ROLE_SUPER_ADMIN"));
        boolean isManager = authorities.stream().anyMatch(a -> a.getAuthority().equals("ROLE_MANAGER"));

        // Lấy hotelId của tài khoản đang đăng nhập
        Long userHotelId = null;
        if (authentication.getPrincipal() instanceof Account account) {
            userHotelId = account.getHotelId();
        }

        // Lấy hotelId mà Floor này đang thuộc về (Floor -> Building -> Hotel)
        Long floorHotelId = (floor.getBuilding() != null && floor.getBuilding().getHotel() != null)
                ? floor.getBuilding().getHotel().getId()
                : null;

        // Rào chắn bảo mật: Nếu là Manager hoặc Admin đã được gán chi nhánh cố định
        if (isManager || (isAdmin && userHotelId != null)) {
            if (userHotelId == null) {
                throw new AppException(ErrorCode.MANAGER_HOTEL_NOT_ASSIGNED);
            }
            // NẾU TẦNG KHÔNG THUỘC KHÁCH SẠN CỦA USER -> BÁO LỖI UNAUTHORIZED
            if (!userHotelId.equals(floorHotelId)) {
                throw new AppException(ErrorCode.UNAUTHORIZED); // Hoặc ErrorCode.CANNOT_CREATE_ROOM_FOR_OTHER_HOTEL
            }
        }
        // ===================================================================================

        // 3. Upload ảnh lên Cloudinary
        //List<String> uploadedUrls = cloudinaryService.uploadMultipleImages(validFiles, "room");
        // Lấy tên chi nhánh (Hotel Name) từ thông tin Floor -> Building -> Hotel
        String branchName = (floor.getBuilding() != null && floor.getBuilding().getHotel() != null)
                ? floor.getBuilding().getHotel().getName()
                : "default-branch";

        //ĐOẠN CODE MỚI: Upload theo chi nhánh và danh mục ROOMS
        List<String> uploadedUrls = cloudinaryService.uploadBranchImages(validFiles, branchName, ImageCategory.ROOMS);
        // 4. Xác định vị trí ảnh đại diện
        int targetDefaultIndex = 0;
        if (dto.getDefaultImageIndex() != null
                && dto.getDefaultImageIndex() >= 0
                && dto.getDefaultImageIndex() < uploadedUrls.size()) {
            targetDefaultIndex = dto.getDefaultImageIndex();
        }

        // 5. Build danh sách RoomImage (gắn cờ isDefault)
        List<RoomImage> roomImages = new ArrayList<>();
        for (int i = 0; i < uploadedUrls.size(); i++) {
            boolean isDefault = (i == targetDefaultIndex);
            roomImages.add(RoomImage.builder()
                    .url(uploadedUrls.get(i))
                    .isDefault(isDefault)
                    .build());
        }

        // 6. Lấy danh sách Tiện ích (Amenities) nếu có
        Set<Amenity> amenities = new HashSet<>();
        if (dto.getAmenityIds() != null && !dto.getAmenityIds().isEmpty()) {
            amenities = new HashSet<>(amenityRepository.findAllById(dto.getAmenityIds()));
        }

        // lay gia phong tieu chuan thong qua loai phong
        Double baseprice = branchRoomPolicyRepository.findByHotelIdAndRoomType(userHotelId, dto.getRoomType()).getBasePrice();
        // 7. Tạo Entity và Lưu xuống CSDL
        Room newRoom = Room.builder()
                .floor(floor)
                .roomStatus(dto.getRoomStatus())
                .roomType(dto.getRoomType())
                // gia phong tieu chuan
                .basePrice(baseprice)
                .avatarUrl(roomImages)
                .amenities(amenities)
                .roomNumber(roomNumber)
                .build();

        Room savedRoom = roomRepository.save(newRoom);

        BranchRoomPolicy branchRoomPolicy = branchRoomPolicyRepository.findByHotelIdAndRoomType(userHotelId, savedRoom.getRoomType());

        RoomCreateResponse response = RoomCreateResponse.builder()
                .id(savedRoom.getId()) // Nên trả về cả ID phòng vừa tạo
                .floorId(savedRoom.getFloor().getId())
                .roomStatus(savedRoom.getRoomStatus())
                .roomType(savedRoom.getRoomType())
                .totalAmenitiesPrice(savedRoom.getTotalAmenitiesPrice())
                // Gia final ca tien phong + tien ich
                .totalPrice(savedRoom.calculateRoomTotalPrice(savedRoom, branchRoomPolicy) + savedRoom.getTotalAmenitiesPrice())
                .defaultImageUrl(savedRoom.getDefaultImageUrl())
                .avatarUrl(savedRoom.getAvatarUrl())
                .amenities(savedRoom.getAmenities())

                .build();
        // ban su kien soc ket
        roomSocketEmitter.emitRoomRoomCreate(userHotelId, savedRoom);
        return response;
    }

    @Override
    public List<RoomResponse> getRoomsByFloorId(String floorId) {
        Floor floor = floorRepository.findById(floorId)
                .orElseThrow(() -> new RuntimeException("Floor not found"));

        // Lấy hotelId của User đang login từ SecurityContext
        Long currentHotelId = SecurityUtils.getCurrentUserHotelId();

        // Nếu không phải Super Admin VÀ tầng này không thuộc khách sạn của User -> Báo lỗi Access Denied
        if (currentHotelId != null && !floor.getBuilding().getHotel().getId().equals(currentHotelId)) {
            throw new AccessDeniedException("Bạn không có quyền truy cập dữ liệu tầng của chi nhánh khác!");
        }

        return roomRepository.findByFloorId(floorId).stream()
                .map(r -> RoomResponse.builder()
                        .id(r.getId())
                        .floorId(r.getFloor().getId())
                        .roomStatus(r.getRoomStatus())
                        .roomType(r.getRoomType())
                        .totalAmenitiesPrice(r.getTotalAmenitiesPrice())
                        // gia final ca tien phong + tien ich
                        .totalPrice(r.calculateRoomTotalPrice(r, branchRoomPolicyRepository.findByHotelIdAndRoomType(currentHotelId, r.getRoomType())) + r.getTotalAmenitiesPrice())
                        .defaultImageUrl(r.getDefaultImageUrl())
                        .avatarUrl(r.getAvatarUrl())
                        .amenities(r.getAmenities()).build()
                )
                .collect(Collectors.toList());
    }

    @Override
    public List<RoomResponse> getRoomsByHotelId(Long hotelId) {
        List<Room> rooms = roomRepository.findByFloor_Building_Hotel_Id(hotelId);
        if (rooms == null || rooms.isEmpty()) {
            log.warn("⚠ Không tìm thấy phòng nào cho hotelId: {}", hotelId);
            return Collections.emptyList();
        }

        return rooms.stream().map(room -> {
            // 1. Lấy Hotel của phòng thông qua chuỗi quan hệ Floor -> Building -> Hotel
            Hotel hotel = room.getFloor().getBuilding().getHotel();

            // 2. Tìm BranchRoomPolicy dựa vào Hotel và RoomType của phòng
            BranchRoomPolicy policy = branchRoomPolicyRepository
                    .findByHotelAndRoomType(hotel, room.getRoomType())
                    .orElse(null);

            // 3. Lấy danh sách giường theo RoomType (như phần trước)
            List<RoomTypeBed> roomTypeBeds = roomTypeBedRepository.findByRoomType(room.getRoomType());
            List<RoomBedResponse> bedResponses = roomTypeBeds.stream().map(rtb ->
                    RoomBedResponse.builder()
                            .bedTypeName(rtb.getBedType().getName())
                            .description(rtb.getBedType().getDescription())
                            .quantity(rtb.getQuantity())
                            .capacity(rtb.getBedType().getCapacity())
                            .isExtraBed(rtb.getBedType().getIsExtraBed())
                            .build()
            ).toList();

            // 4. Build ra RoomResponse đầy đủ thông tin chính sách phòng
            return RoomResponse.builder()
                    .id(room.getId())
                    .floorId(room.getFloor() != null ? room.getFloor().getId() : null)
                    // lay ra so phong
                    .roomNumber(room.getRoomNumber())
                    .floorNumber(room.getFloor().getFloorNumber())
                    .nameBuilding(room.getFloor().getBuilding().getName())
                    .roomStatus(room.getRoomStatus())
                    .basePrice(room.getBasePrice())
                    .roomType(room.getRoomType())
                    .avatarUrl(room.getAvatarUrl())
                    .amenities(room.getAmenities())
                    .totalAmenitiesPrice(room.getTotalAmenitiesPrice())
                    // gia phong final tien phong + dich vu
                    .totalPrice(room.calculateRoomTotalPrice(room, policy))
                    .defaultImageUrl(room.getDefaultImageUrl())
                    .beds(bedResponses)
                    .standardCapacity(policy.getStandardCapacity())
                    .maxExtraGuests(policy.getMaxExtraGuests())
                    .extraAdultFee(policy != null ? policy.getExtraAdultFee() : null)
                    .extraChildFee(policy != null ? policy.getExtraChildFee() : null)
                    .build();
        }).toList();
    }

    @Override
    public RoomTypeDetailResponse getRoomTypeDetailByHotelAndType(Long hotelId, RoomType roomType) {
        // 1. Lấy thông tin Hotel từ hotelId
        Hotel hotel = hotelRepository.findById(hotelId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy khách sạn với ID: " + hotelId));

        // 2. Lấy Chính sách quy định của loại phòng tại khách sạn này
        BranchRoomPolicy policy = branchRoomPolicyRepository
                .findByHotelAndRoomType(hotel, roomType)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy chính sách cho loại phòng này tại chi nhánh."));

        // 3. Lấy Danh sách giường đi kèm của loại phòng này
        List<RoomTypeBed> roomTypeBeds = roomTypeBedRepository.findByRoomType(roomType);

        List<RoomBedResponse> bedResponses = roomTypeBeds.stream().map(rtb ->
                RoomBedResponse.builder()
                        .bedTypeName(rtb.getBedType().getName())
                        .description(rtb.getBedType().getDescription())
                        .quantity(rtb.getQuantity())
                        .capacity(rtb.getBedType().getCapacity())
                        .isExtraBed(rtb.getBedType().getIsExtraBed())
                        .build()
        ).toList();

        // 4. Tổng hợp và trả về DTO
        return RoomTypeDetailResponse.builder()
                .roomType(roomType)
                .standardCapacity(policy.getStandardCapacity())
                .maxExtraGuests(policy.getMaxExtraGuests())
                .extraAdultFee(policy.getExtraAdultFee())
                .extraChildFee(policy.getExtraChildFee())
                // gia cua phong
                .priceBase(policy.getBasePrice())
                .beds(bedResponses)
                .build();
    }


    private List<MultipartFile> validateAndFilterImages(List<MultipartFile> imageFiles, boolean isRequired) {
        if (imageFiles == null || imageFiles.isEmpty()) {
            if (isRequired) {
                throw new AppException(ErrorCode.INVALID_IMAGE_COUNT);
            }
            return Collections.emptyList();
        }

        // Lọc bỏ các file rỗng
        List<MultipartFile> validFiles = imageFiles.stream()
                .filter(file -> file != null && !file.isEmpty())
                .toList();

        // Kiểm tra số lượng (bắt buộc từ 4 đến 8 ảnh nếu là bắt buộc)
        if (isRequired && (validFiles.size() < 4 || validFiles.size() > 8)) {
            throw new AppException(ErrorCode.INVALID_IMAGE_COUNT);
        }

        if (validFiles.isEmpty()) {
            if (isRequired) {
                throw new AppException(ErrorCode.INVALID_IMAGE_COUNT);
            }
            return Collections.emptyList();
        }

        // Các định dạng ảnh cho phép & Giới hạn dung lượng (5MB)
        List<String> allowedContentTypes = List.of("image/jpeg", "image/png", "image/jpg", "image/webp");
        long maxFileSize = 5 * 1024 * 1024;

        for (MultipartFile file : validFiles) {
            // Kiểm tra định dạng loại ảnh
            String contentType = file.getContentType();
            if (contentType == null || !allowedContentTypes.contains(contentType.toLowerCase())) {
                throw new AppException(ErrorCode.INVALID_IMAGE_FORMAT);
            }

            // Kiểm tra dung lượng file
            if (file.getSize() > maxFileSize) {
                throw new AppException(ErrorCode.IMAGE_SIZE_TOO_LARGE);
            }
        }

        return validFiles;
    }
}
