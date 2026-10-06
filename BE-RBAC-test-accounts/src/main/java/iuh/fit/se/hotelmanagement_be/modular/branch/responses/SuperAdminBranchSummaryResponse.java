package iuh.fit.se.hotelmanagement_be.modular.branch.responses;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class SuperAdminBranchSummaryResponse {
    Long id;
    String name;
    String address;
    String phone;
    String provinceName;
    long employeeCount;
    long bookingCount;
    BigDecimal totalRevenue;
}
