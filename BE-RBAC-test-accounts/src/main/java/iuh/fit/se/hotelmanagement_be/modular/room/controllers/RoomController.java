package iuh.fit.se.hotelmanagement_be.modular.room.controllers;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.tags.Tag;
import iuh.fit.se.hotelmanagement_be.config.SecurityUtils;
import iuh.fit.se.hotelmanagement_be.modular.room.requests.RoomCreateRequest;
import iuh.fit.se.hotelmanagement_be.modular.room.requests.RoomUpdateRequest;
import iuh.fit.se.hotelmanagement_be.modular.room.responses.RoomCreateResponse;
import iuh.fit.se.hotelmanagement_be.modular.room.responses.RoomResponse;
import iuh.fit.se.hotelmanagement_be.modular.room.services.RoomService;
import iuh.fit.se.hotelmanagement_be.shared.dtos.ApiResponse;
import jakarta.validation.Valid;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/room")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Room", description = "APIs liên quan đến quản lý bàn")
public class RoomController {
    RoomService roomService;

    @PostMapping(value = "/create", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    //Chỉ cho phép người dùng có Role ADMIN hoặc MANAGER gọi API này
    @PreAuthorize("hasAuthority('CREATE_ROOM')")
    public ResponseEntity<ApiResponse<RoomCreateResponse>> createRoom(
            @Parameter(
                    content = @Content(
                            mediaType = MediaType.APPLICATION_JSON_VALUE,
                            schema = @Schema(implementation = RoomCreateRequest.class)
                    )
            )
            @RequestPart("roomInfo") @Valid RoomCreateRequest request,
            @RequestPart("avatarUrl") List<MultipartFile> imageFiles
    ) {
        RoomCreateResponse result = roomService.createRoom(request, imageFiles);

        return ResponseEntity.ok(ApiResponse.<RoomCreateResponse>builder()
                .code(200)
                .message("Thêm phòng mới thành công!")
                .result(result)
                .build());
    }


    @GetMapping
    @Operation(summary = "Lấy danh sách phòng theo ID của tầng")
    public ResponseEntity<ApiResponse<List<RoomResponse>>> getRooms(@RequestParam String floorId) {
        List<RoomResponse> roomResponseList = roomService.getRoomsByFloorId(floorId);

        return ResponseEntity.ok(ApiResponse.<List<RoomResponse>>builder()
                .code(200)
                .result(roomResponseList)
                .message("Lay thanh cong danh sach")
                .build());

    }

    @GetMapping("/hotel")
    @Operation(summary = "Lấy danh sách phòng thuộc khách sạn của tài khoản đang đăng nhập")
    @PreAuthorize("hasAuthority('VIEW_ROOMS')")
    public ResponseEntity<ApiResponse<List<RoomResponse>>> getRoomsByCurrentHotel() {

        // 💡 Lấy hotelId từ token của nhân viên đang đăng nhập
        // (Hãy thay thế bằng hàm lấy token thực tế trong dự án của bạn, ví dụ: SecurityUtils.getCurrentHotelId())
        Long hotelId = SecurityUtils.getCurrentUserHotelId();

        // Gọi Service lấy danh sách phòng
        List<RoomResponse> roomResponseList = roomService.getRoomsByHotelId(hotelId);

        return ResponseEntity.ok(ApiResponse.<List<RoomResponse>>builder()
                .code(200)
                .message("Lấy danh sách phòng của khách sạn thành công!")
                .result(roomResponseList)
                .build());
    }

    @GetMapping("/public/hotel/{hotelId}")
    @Operation(summary = "Lấy danh sách phòng công khai theo ID khách sạn")
    public ResponseEntity<ApiResponse<List<RoomResponse>>> getPublicRoomsByHotelId(@PathVariable Long hotelId) {
        List<RoomResponse> roomResponseList = roomService.getRoomsByHotelId(hotelId);
        return ResponseEntity.ok(ApiResponse.<List<RoomResponse>>builder()
                .code(200)
                .message("Lấy danh sách phòng công khai thành công!")
                .result(roomResponseList)
                .build());
    }

    @GetMapping("/public/all")
    @Operation(summary = "Lấy danh sách tất cả phòng công khai theo khách sạn")
    public ResponseEntity<ApiResponse<List<RoomResponse>>> getPublicAllRooms(@RequestParam(required = false) Long hotelId) {
        List<RoomResponse> roomResponseList = (hotelId != null)
                ? roomService.getRoomsByHotelId(hotelId)
                : List.of();
        return ResponseEntity.ok(ApiResponse.<List<RoomResponse>>builder()
                .code(200)
                .message("Lấy danh sách phòng công khai thành công!")
                .result(roomResponseList)
                .build());
    }

    // chinh sua mot phong
    @PutMapping(value = "/updateRoomById/{roomId}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAuthority('UPDATE_ROOM')")
    public ResponseEntity<ApiResponse<RoomCreateResponse>> updateRoom(
            @PathVariable String roomId,
            @RequestPart("room") @Valid RoomUpdateRequest request,
            @RequestPart(value = "images", required = false) List<MultipartFile> imageFiles
    ) {
        RoomCreateResponse response = roomService.updateRoom(roomId, request, imageFiles);
        return ResponseEntity.ok(ApiResponse.<RoomCreateResponse>builder()
                .code(200)
                .result(response)
                .build());
    }
}
