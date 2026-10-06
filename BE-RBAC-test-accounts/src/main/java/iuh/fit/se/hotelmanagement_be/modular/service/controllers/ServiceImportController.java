package iuh.fit.se.hotelmanagement_be.modular.service.controllers;

import io.swagger.v3.oas.annotations.tags.Tag;
import iuh.fit.se.hotelmanagement_be.modular.auth.entities.Account;
import iuh.fit.se.hotelmanagement_be.modular.service.requests.ServiceExcelImportRequest;
import iuh.fit.se.hotelmanagement_be.modular.service.services.impl.ServiceImportService;
import iuh.fit.se.hotelmanagement_be.shared.entities.ImportTaskStatus;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/servicesImport")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Hotel Services", description = "APIs quản lý và tra cứu danh mục dịch vụ khách sạn (Nhà hàng, Spa, Hội nghị, Đưa đón...)")
public class ServiceImportController {

    @Autowired
    private ServiceImportService serviceImportService;

    @PostMapping("/import-urls-async")
    @PreAuthorize("hasAuthority('CREATE_SERVICE')")
    public ResponseEntity<?> startUrlImport(
            @RequestBody ServiceExcelImportRequest request,
            Authentication authentication) {
        Account account = (Account) authentication.getPrincipal();
        String taskId = serviceImportService.startAsyncUrlImport(request, account.getHotelId());
        return ResponseEntity.ok(Map.of(
                "success", true,
                "taskId", taskId,
                "message", "Đã tiếp nhận dữ liệu dịch vụ và bắt đầu lưu."
        ));
    }

    /**
     * 2. API để Frontend gọi định kỳ (polling) kiểm tra tiến trình dựa vào taskId
     */
    @GetMapping("/import-status/{taskId}")
    @PreAuthorize("hasAuthority('CREATE_SERVICE')")
    public ResponseEntity<ImportTaskStatus> getImportStatus(@PathVariable String taskId) {
        ImportTaskStatus status = serviceImportService.getTaskStatus(taskId);
        return ResponseEntity.ok(status);
    }
}
