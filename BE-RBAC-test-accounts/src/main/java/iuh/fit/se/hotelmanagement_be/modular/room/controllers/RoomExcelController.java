package iuh.fit.se.hotelmanagement_be.modular.room.controllers;

import iuh.fit.se.hotelmanagement_be.config.SecurityUtils;
import iuh.fit.se.hotelmanagement_be.modular.room.requests.RoomExcelImportRequest;
import iuh.fit.se.hotelmanagement_be.modular.room.services.impl.RoomExcelService;
import iuh.fit.se.hotelmanagement_be.shared.entities.ImportTaskStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/roomsExcel")
@RequiredArgsConstructor
public class RoomExcelController {
    private final RoomExcelService roomExcelService;

    @PostMapping("/importRooms")
    @PreAuthorize("hasAuthority('CREATE_ROOM')")
    public ResponseEntity<Map<String, String>> importRooms(@RequestBody RoomExcelImportRequest request) {
        Long hotelId = SecurityUtils.getCurrentUserHotelId();
        if (hotelId == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "Tài khoản chưa được gán khách sạn."));
        }

        String taskId = roomExcelService.startAsyncRoomImport(request, hotelId);
        return ResponseEntity.ok(Map.of(
                "taskId", taskId,
                "message", "Đã nhận dữ liệu phòng và bắt đầu lưu."
        ));
    }

    @GetMapping("/status/{taskId}")
    @PreAuthorize("hasAuthority('CREATE_ROOM')")
    public ResponseEntity<ImportTaskStatus> getImportStatus(@PathVariable String taskId) {
        return ResponseEntity.ok(roomExcelService.getTaskStatus(taskId));
    }
}
