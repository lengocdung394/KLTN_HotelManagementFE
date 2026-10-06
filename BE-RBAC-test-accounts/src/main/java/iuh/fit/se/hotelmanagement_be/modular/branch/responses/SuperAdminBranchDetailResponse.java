package iuh.fit.se.hotelmanagement_be.modular.branch.responses;

import iuh.fit.se.hotelmanagement_be.modular.auth.responses.EmployeeResponse;
import iuh.fit.se.hotelmanagement_be.modular.booking.responses.BookingResponseForHotel;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class SuperAdminBranchDetailResponse {
    SuperAdminBranchSummaryResponse branch;
    List<EmployeeResponse> employees;
    List<BookingResponseForHotel> bookings;
    List<BuildingItem> buildings;
    List<FloorItem> floors;
    List<RoomItem> rooms;
    List<ServiceItem> services;
    List<PromotionItem> promotions;
    List<RoomPolicyItem> roomPolicies;

    public record BuildingItem(String id, String name, int floorCount) {
    }

    public record FloorItem(String id, int floorNumber, String buildingId, String buildingName, int roomCount) {
    }

    public record RoomItem(
            String id,
            String roomNumber,
            String roomType,
            String roomStatus,
            String floorId,
            int floorNumber,
            String buildingName) {
    }

    public record ServiceItem(String id, String name, String category, Double price, String unit, boolean shared) {
    }

    public record PromotionItem(String id, String code, String name, String status, String startDate, String endDate) {
    }

    public record RoomPolicyItem(
            String id,
            String roomType,
            Double area,
            Double basePrice,
            Double extraAdultFee,
            Double extraChildFee,
            Integer standardCapacity,
            Integer maxExtraGuests) {
    }
}
