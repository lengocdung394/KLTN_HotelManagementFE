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
}
