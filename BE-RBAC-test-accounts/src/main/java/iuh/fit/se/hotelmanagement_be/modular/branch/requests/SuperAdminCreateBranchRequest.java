package iuh.fit.se.hotelmanagement_be.modular.branch.requests;

import lombok.AccessLevel;
import lombok.Data;
import lombok.experimental.FieldDefaults;

@Data
@FieldDefaults(level = AccessLevel.PRIVATE)
public class SuperAdminCreateBranchRequest {
    String name;
    String address;
    String phone;
    String provinceName;
}
