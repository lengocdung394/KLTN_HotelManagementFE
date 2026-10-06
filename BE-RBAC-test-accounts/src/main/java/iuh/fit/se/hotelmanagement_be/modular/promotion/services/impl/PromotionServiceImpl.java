package iuh.fit.se.hotelmanagement_be.modular.promotion.services.impl;

import iuh.fit.se.hotelmanagement_be.exception.AppException;
import iuh.fit.se.hotelmanagement_be.exception.ErrorCode;
import iuh.fit.se.hotelmanagement_be.modular.auth.entities.Account;
import iuh.fit.se.hotelmanagement_be.modular.branch.entities.Hotel;
import iuh.fit.se.hotelmanagement_be.modular.branch.repositories.HotelRepository;
import iuh.fit.se.hotelmanagement_be.modular.promotion.entities.CustomerPromotion;
import iuh.fit.se.hotelmanagement_be.modular.promotion.entities.Promotion;
import iuh.fit.se.hotelmanagement_be.modular.promotion.enums.PromotionScope;
import iuh.fit.se.hotelmanagement_be.modular.promotion.enums.PromotionStatus;
import iuh.fit.se.hotelmanagement_be.modular.promotion.repositories.CustomerPromotionRepository;
import iuh.fit.se.hotelmanagement_be.modular.promotion.repositories.PromotionRepository;
import iuh.fit.se.hotelmanagement_be.modular.promotion.requests.ChangeStatusRequest;
import iuh.fit.se.hotelmanagement_be.modular.promotion.requests.CreatePromotionRequest;
import iuh.fit.se.hotelmanagement_be.modular.promotion.requests.UpdatePromotionRequest;
import iuh.fit.se.hotelmanagement_be.modular.promotion.responses.CustomerPromotionResponse;
import iuh.fit.se.hotelmanagement_be.modular.promotion.responses.PageResponse;
import iuh.fit.se.hotelmanagement_be.modular.promotion.responses.PromotionResponse;
import iuh.fit.se.hotelmanagement_be.modular.promotion.services.PromotionService;
import iuh.fit.se.hotelmanagement_be.shared.CloudinaryService;
import iuh.fit.se.hotelmanagement_be.shared.enums.ImageCategory;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
@Transactional(readOnly = true)
public class PromotionServiceImpl implements PromotionService {

    PromotionRepository promotionRepository;
    HotelRepository hotelRepository;
    CustomerPromotionRepository customerPromotionRepository;
    CloudinaryService cloudinaryService;
    PromotionSocketEmitter promotionSocketEmitter;

    // State machine: trạng thái hiện tại → các trạng thái được phép chuyển
    static final Map<PromotionStatus, Set<PromotionStatus>> ALLOWED_TRANSITIONS = Map.of(
            PromotionStatus.DRAFT, Set.of(PromotionStatus.ACTIVE, PromotionStatus.INACTIVE),
            PromotionStatus.ACTIVE, Set.of(PromotionStatus.INACTIVE, PromotionStatus.EXPIRED),
            PromotionStatus.INACTIVE, Set.of(PromotionStatus.ACTIVE, PromotionStatus.EXPIRED),
            PromotionStatus.EXPIRED, Set.of()
    );


    // can xem them truong hop admin cua chi nhanh tong tao khuyen mai
    @Override
    @Transactional
    public PromotionResponse createPromotion(CreatePromotionRequest request, MultipartFile imageFile, Long hotelId) {
        log.info("Tạo mới khuyến mãi, mã: {}", request.getDescription());

        // 1. Kiểm tra xác thực
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new AppException(ErrorCode.UNAUTHENTICATED);
        }

        var authorities = authentication.getAuthorities();
        boolean isAdmin = authorities.stream().anyMatch(a -> a.getAuthority().equals("ROLE_SUPER_ADMIN"));
        boolean isManager = authorities.stream().anyMatch(a -> a.getAuthority().equals("ROLE_MANAGER"));

        if (!isAdmin && !isManager) {
            throw new AppException(ErrorCode.UNAUTHORIZED);
        }

        // 2. Nếu là MANAGER, kiểm tra xem có đúng chi nhánh của mình không
        if (isManager) {
            // Vì Account implement UserDetails nên principal chính là đối tượng Account của bạn
            Account currentAccount = (Account) authentication.getPrincipal();

            Long managerHotelId = currentAccount.getHotelId(); // Lấy hotelId từ Account
            Long requestedHotelId = hotelId;     // hotelId từ request tạo promotion

            // So sánh: Nếu manager không thuộc chi nhánh nào, hoặc chi nhánh gửi lên không khớp -> Chặn
            if (managerHotelId == null || !managerHotelId.equals(requestedHotelId)) {
                throw new AppException(ErrorCode.UNAUTHORIZED_BRANCH_ACCESS);
            }
        }

        // kiem tra cho phai la admin chi nhanh do hoac la quan li chi nhanh do


        validateDates(request.getStartDate(), request.getEndDate());


        // Upload banner ảnh nếu có
        String branchName = "system"; // Mặc định cho toàn hệ thống
        if (hotelId != null) {
            Hotel hotelObj = hotelRepository.findById(hotelId).orElse(null);
            if (hotelObj != null && hotelObj.getName() != null) {
                branchName = hotelObj.getName();
            }
        }

        String imageUrl = null;
        if (imageFile != null && !imageFile.isEmpty()) {
            // Nếu có hotelId -> Dùng hàm uploadBranchImages theo tên chi nhánh + danh mục PROMOTIONS
            // Nếu là system -> Dùng hàm uploadImage gốc với folder "system/promotions"
            if (hotelId != null) {
                List<String> uploadedUrls = cloudinaryService.uploadBranchImages(List.of(imageFile), branchName, ImageCategory.PROMOTIONS);
                imageUrl = uploadedUrls.isEmpty() ? null : uploadedUrls.get(0);
            } else {
                imageUrl = cloudinaryService.uploadImage(imageFile, "system/promotions");
            }
        }

        Hotel hotel = hotelRepository.findById(hotelId).orElse(null);
        // 4. Khởi tạo đối tượng Promotion
        Promotion promotion = Promotion.builder()
                .name(request.getName().trim())
                .description(request.getDescription())
                .type(request.getType())
                .discountType(request.getDiscountType())

                .discountValue(request.getDiscountValue())

                .maxDiscountAmount(request.getMaxDiscountAmount())

                .minBookingValue(request.getMinBookingValue())
                .minRoomValue(request.getMinRoomValue())
                .minServiceValue(request.getMinServiceValue())

                .startDate(request.getStartDate())
                .endDate(request.getEndDate())

                .usageLimit(request.getUsageLimit())
                .status(request.getStatus() != null ? request.getStatus() : PromotionStatus.DRAFT)
                .isExclusive(request.isExclusive())
                .hotel(hotel)
                .imageUrl(imageUrl)
                .usedCount(0)
                .deleted(false)
                .build();

        promotion = promotionRepository.save(promotion);

        PromotionResponse response = toResponse(promotion);
        // luong socket
        promotionSocketEmitter.emitPromotionCreate(hotelId, promotion);

        return response;
    }

    // ==================== READ ====================
    @Override
    public PromotionResponse getPromotionById(String id) {
        return toResponse(findOrThrow(id));
    }

    @Override
    public PageResponse<PromotionResponse> getAllPromotions(Long hotelId,
                                                            PromotionStatus status, PromotionScope type, String keyword,
                                                            LocalDateTime startDate, LocalDateTime endDate, Pageable pageable) {

        String kw = (keyword != null && keyword.isBlank()) ? null : keyword;
        String statusStr = (status != null) ? status.name() : null;
        String typeStr = (type != null) ? type.name() : null;
        Page<Promotion> page = promotionRepository.findAllWithFilters(hotelId, statusStr, typeStr, kw, startDate, endDate, pageable);
        return PageResponse.of(page.map(this::toResponse));
    }

    @Override
    public List<PromotionResponse> getActivePromotions() {
        return promotionRepository
                .findAllByStatusAndDeletedFalseOrderByCreatedAtDesc(PromotionStatus.ACTIVE)
                .stream().map(this::toResponse).collect(Collectors.toList());
    }

    // can can chinh lai cho truong hop ma hotelId == null - tuc la TH ma admin sua khuyen mai
    @Override
    @Transactional
    public PromotionResponse updatePromotion(String id, UpdatePromotionRequest request, MultipartFile imageFile, Long hotelId) {
        log.info("Cập nhật khuyến mãi ID: {}", id);
        Promotion promotion = findOrThrow(id);

        if (promotion.getStatus() == PromotionStatus.ACTIVE && promotion.getUsedCount() > 0) {
            throw new IllegalStateException(
                    "Không thể sửa khuyến mãi đang ACTIVE đã có " + promotion.getUsedCount() + " lượt dùng. Hãy đổi sang INACTIVE trước.");
        }

        validateDates(request.getStartDate(), request.getEndDate());
//      validateDiscountValue(request.getType(), request.getDiscountValue());

        if (imageFile != null && !imageFile.isEmpty()) {
            // Xác định tên chi nhánh từ khuyến mãi hiện tại hoặc tham số truyền vào
            String branchName = "system";
            Long targetHotelId = hotelId != null ? hotelId : (promotion.getHotel() != null ? promotion.getHotel().getId() : null);

            if (targetHotelId != null) {
                Hotel hotelObj = hotelRepository.findById(targetHotelId).orElse(null);
                if (hotelObj != null && hotelObj.getName() != null) {
                    branchName = hotelObj.getName();
                }
            }

            String imageUrl;
            if (targetHotelId != null) {
                List<String> uploadedUrls = cloudinaryService.uploadBranchImages(List.of(imageFile), branchName, ImageCategory.PROMOTIONS);
                imageUrl = uploadedUrls.isEmpty() ? null : uploadedUrls.get(0);
            } else {
                imageUrl = cloudinaryService.uploadImage(imageFile, "system/promotions");
            }

            promotion.setImageUrl(imageUrl);
        }

        promotion.setName(request.getName().trim());
        promotion.setDescription(request.getDescription());
        promotion.setType(request.getType());
        promotion.setDiscountValue(request.getDiscountValue());
        promotion.setMaxDiscountAmount(request.getMaxDiscountAmount());
        promotion.setMinBookingValue(request.getMinBookingValue());
        promotion.setStartDate(request.getStartDate());
        promotion.setEndDate(request.getEndDate());
        promotion.setUsageLimit(request.getUsageLimit());

        PromotionResponse response = toResponse(promotionRepository.save(promotion));

        // su kien socket
        promotionSocketEmitter.emitPromotionUpdate(hotelId);
        // can nhac cho su kien bang soc ket cho toan bo chi nhanh

        return response;
    }

    // ==================== CHANGE STATUS ====================
    @Override
    @Transactional
    public PromotionResponse changeStatus(String id, ChangeStatusRequest request) {
        log.info("Đổi trạng thái khuyến mãi ID: {} → {}", id, request.getStatus());
        Promotion promotion = findOrThrow(id);

        PromotionStatus current = promotion.getStatus();
        PromotionStatus next = request.getStatus();

        if (!ALLOWED_TRANSITIONS.getOrDefault(current, Set.of()).contains(next)) {
            throw new IllegalStateException("Không thể chuyển trạng thái từ '" + current + "' sang '" + next + "'");
        }

        if (next == PromotionStatus.ACTIVE && promotion.getEndDate().isBefore(LocalDateTime.now())) {
            throw new IllegalStateException("Không thể kích hoạt khuyến mãi đã hết hạn");
        }

        promotion.setStatus(next);
        return toResponse(promotionRepository.save(promotion));
    }


    // ==================== DELETE ====================
    @Override
    @Transactional
    public void deletePromotion(String id) {
        log.info("Xóa mềm khuyến mãi ID: {}", id);
        Promotion promotion = findOrThrow(id);

        if (promotion.getStatus() == PromotionStatus.ACTIVE) {
            throw new IllegalStateException("Không thể xóa khuyến mãi đang ACTIVE. Hãy đổi sang INACTIVE trước.");
        }

        promotion.setDeleted(true);
        promotionRepository.save(promotion);
    }

    // ==================== HELPERS ====================
    private Promotion findOrThrow(String id) {
        return promotionRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy khuyến mãi với ID: " + id));
    }

    private void validateDates(LocalDateTime start, LocalDateTime end) {
        if (!end.isAfter(start)) {
            throw new IllegalArgumentException("Ngày kết thúc phải sau ngày bắt đầu");
        }
    }

//    private void validateDiscountValue(PromotionType type, BigDecimal value) {
//        if (type == PromotionType.PERCENTAGE && value.compareTo(BigDecimal.valueOf(100)) > 0) {
//            throw new IllegalArgumentException("Giá trị giảm theo % không được vượt quá 100%");
//        }
//    }

    private CustomerPromotionResponse toCustomerPromotionResponse(CustomerPromotion cp) {
        Promotion promotion = cp.getPromotion();

        return CustomerPromotionResponse.builder()
                .id(cp.getId())
                .voucherCode(cp.getUniqueCode())
                .isUsed(cp.isUsed())
                .savedAt(cp.getCreatedAt())
                .usedAt(cp.getUsedAt())
                // Information from Promotion
                .promotionId(promotion.getId())
                .name(promotion.getName())
                .description(promotion.getDescription())
                .type(promotion.getType())
                .discountValue(promotion.getDiscountValue())
                .maxDiscountAmount(promotion.getMaxDiscountAmount())
                .minBookingValue(promotion.getMinBookingValue())
                .startDate(promotion.getStartDate())
                .endDate(promotion.getEndDate())
                .hotelId(promotion.getHotel() != null ? promotion.getHotel().getId() : null)
                .hotelName(promotion.getHotel() != null ? promotion.getHotel().getName() : "Toàn hệ thống")
                .imageUrl(promotion.getImageUrl())
                .build();
    }

    private PromotionResponse toResponse(Promotion p) {
        LocalDateTime now = LocalDateTime.now();
        boolean available = p.getStatus() == PromotionStatus.ACTIVE
                && !p.getEndDate().isBefore(now)
                && !p.getStartDate().isAfter(now)
                && (p.getUsageLimit() == null || p.getUsedCount() < p.getUsageLimit());

        return PromotionResponse.builder()
                .id(p.getId())
                .code(p.getCode())
                .name(p.getName())
                .description(p.getDescription())
                .type(p.getType())

                .promotionDiscountType(p.getDiscountType())
                .discountValue(p.getDiscountValue())
                .maxDiscountAmount(p.getMaxDiscountAmount())
                .minBookingValue(p.getMinBookingValue())
                .minRoomValue(p.getMinRoomValue())
                .minServiceValue(p.getMinServiceValue())
                .startDate(p.getStartDate())
                .endDate(p.getEndDate())
                .usageLimit(p.getUsageLimit())
                .usedCount(p.getUsedCount())
                .status(p.getStatus())
                .available(available)
                .imageUrl(p.getImageUrl())
                .createdAt(p.getCreatedAt())
                .updatedAt(p.getUpdatedAt())
                .build();
    }
}
