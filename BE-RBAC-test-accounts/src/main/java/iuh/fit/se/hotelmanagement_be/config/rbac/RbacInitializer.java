package iuh.fit.se.hotelmanagement_be.config.rbac;

import iuh.fit.se.hotelmanagement_be.modular.auth.entities.Account;
import iuh.fit.se.hotelmanagement_be.modular.auth.entities.Customer;
import iuh.fit.se.hotelmanagement_be.modular.auth.entities.enums.LoyaltyTier;
import iuh.fit.se.hotelmanagement_be.modular.auth.entities.Employee;
import iuh.fit.se.hotelmanagement_be.modular.auth.entities.Permission;
import iuh.fit.se.hotelmanagement_be.modular.auth.entities.Role;
import iuh.fit.se.hotelmanagement_be.modular.auth.repositories.AccountRepository;
import iuh.fit.se.hotelmanagement_be.modular.auth.repositories.CustomerRepository;
import iuh.fit.se.hotelmanagement_be.modular.auth.repositories.EmployeeRepository;
import iuh.fit.se.hotelmanagement_be.modular.auth.repositories.PermissionRepository;
import iuh.fit.se.hotelmanagement_be.modular.auth.repositories.RoleRepository;
import iuh.fit.se.hotelmanagement_be.modular.branch.entities.*;
import iuh.fit.se.hotelmanagement_be.modular.branch.repositories.*;
import iuh.fit.se.hotelmanagement_be.modular.room.entities.BedType;
import iuh.fit.se.hotelmanagement_be.modular.room.entities.Room;
import iuh.fit.se.hotelmanagement_be.modular.room.entities.RoomImage;
import iuh.fit.se.hotelmanagement_be.modular.room.entities.RoomTypeBed;
import iuh.fit.se.hotelmanagement_be.modular.room.entities.enums.RoomStatus;
import iuh.fit.se.hotelmanagement_be.modular.room.entities.enums.RoomType;
import iuh.fit.se.hotelmanagement_be.modular.room.repositories.BedTypeRepository;
import iuh.fit.se.hotelmanagement_be.modular.room.repositories.RoomRepository;
import iuh.fit.se.hotelmanagement_be.modular.room.repositories.RoomTypeBedRepository;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.*;

@Component
@RequiredArgsConstructor
@Order(1)
public class RbacInitializer implements CommandLineRunner {

    private final PermissionRepository permissionRepository;
    private final RoleRepository roleRepository;
    private final RbacConfig rbacConfig;
    private final AccountRepository accountRepository;
    private final PasswordEncoder passwordEncoder;
    private final EmployeeRepository employeeRepository;
    private final BuildingRepository buildingRepository;
    private final HotelRepository hotelRepository;
    private final FloorRepository floorRepository;
    private final ProvinceRepository provinceRepository;
    private final BranchRoomPolicyRepository branchRoomPolicyRepository;
    private final RoomTypeBedRepository roomTypeBedRepository;
    private final RoomRepository roomRepository;
    private final BedTypeRepository bedTypeRepository;
    private final CustomerRepository customerRepository;
    private final org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;

    @Override
    public void run(String... args) {

        // ==========================================
        // 0. ĐỒNG BỘ POSTGRESQL SEQUENCES TRÁNH DUPLICATE KEY
        // ==========================================
        try {
            String[] tables = {"orders", "bookings", "booking_details", "booking_services", "payment_transactions", "rooms"};
            String[] pks = {"order_id", "booking_id", "booking_detail_id", "booking_service_id", "payment_transaction_id", "room_id"};
            for (int i = 0; i < tables.length; i++) {
                try {
                    String sql = String.format("SELECT setval(pg_get_serial_sequence('%s', '%s'), COALESCE((SELECT MAX(%s) FROM %s), 0) + 1, false);",
                            tables[i], pks[i], pks[i], tables[i]);
                    jdbcTemplate.execute(sql);
                } catch (Exception ignored) {}
            }
            System.out.println(">>> [STARTUP] Đã đồng bộ tất cả PostgreSQL sequences về MAX(ID) + 1.");
        } catch (Exception e) {
            System.err.println(">>> [STARTUP WARN] Đồng bộ sequence: " + e.getMessage());
        }

        // ==========================================
        // 1. KHỞI TẠO PERMISSIONS & ROLES (RBAC)
        // ==========================================
        Role legacyAdminRole = roleRepository.findByName("ROLE_ADMIN").orElse(null);
        Role superAdminRole = roleRepository.findByName("ROLE_SUPER_ADMIN").orElse(null);
        if (legacyAdminRole != null && superAdminRole == null) {
            legacyAdminRole.setName("ROLE_SUPER_ADMIN");
            roleRepository.save(legacyAdminRole);
        } else if (legacyAdminRole != null) {
            jdbcTemplate.update(
                    "DELETE FROM account_role legacy WHERE legacy.role_id = ? " +
                            "AND EXISTS (SELECT 1 FROM account_role current " +
                            "WHERE current.account_id = legacy.account_id AND current.role_id = ?)",
                    legacyAdminRole.getId(),
                    superAdminRole.getId()
            );
            jdbcTemplate.update(
                    "UPDATE account_role SET role_id = ? WHERE role_id = ?",
                    superAdminRole.getId(),
                    legacyAdminRole.getId()
            );
            roleRepository.delete(legacyAdminRole);
        }

        Map<String, Permission> permissionMap = new HashMap<>();

        for (String p : rbacConfig.getPermissions()) {
            Permission permission = permissionRepository.findByName(p)
                    .orElseGet(() -> permissionRepository.save(
                            Permission.builder().name(p).build()
                    ));
            permissionMap.put(p, permission);
        }

        for (String roleName : rbacConfig.getRoles().keySet()) {
            Role role = roleRepository.findByName(roleName)
                    .orElseGet(() -> roleRepository.save(
                            Role.builder()
                                    .name(roleName)
                                    .permissions(new HashSet<>())
                                    .build()
                    ));

            role.getPermissions().clear();
            for (String p : rbacConfig.getRoles().get(roleName)) {
                role.getPermissions().add(permissionMap.get(p));
            }
            roleRepository.save(role);
        }

        Role systemAdminRole = roleRepository.findByName("ROLE_SUPER_ADMIN")
                .orElseThrow(() -> new RuntimeException("Lỗi cấu hình: File JSON thiếu ROLE_SUPER_ADMIN"));
        Role managerRole = roleRepository.findByName("ROLE_MANAGER")
                .orElseThrow(() -> new RuntimeException("Lỗi cấu hình: File JSON thiếu ROLE_MANAGER"));
        Role employeeRole = roleRepository.findByName("ROLE_EMPLOYEE")
                .orElseThrow(() -> new RuntimeException("Lỗi cấu hình: File JSON thiếu ROLE_EMPLOYEE"));

        System.out.println(">>> [STARTUP] Khởi tạo hệ thống Permission & Role hoàn tất.");

        // ==========================================
        // 2. KHỞI TẠO CHI NHÁNH 1: SÀI GÒN
        // ==========================================
        if (!hotelRepository.existsByName("Sài Gòn Sky Hotel & Residence")) {
            Province provinceHcm = provinceRepository.findByName("TP. Hồ Chí Minh")
                    .orElseGet(() -> provinceRepository.save(Province.builder().name("TP. Hồ Chí Minh").build()));

            Hotel hotel1 = hotelRepository.save(
                    Hotel.builder()
                            .name("Sài Gòn Sky Hotel & Residence")
                            .address("123 Lê Lợi, Quận 1, TP. HCM")
                            .phone("0283999999")
                            .province(provinceHcm)
                            .build()
            );

            // Tòa nhà & Tầng mẫu cho Chi nhánh 1
            Building b1 = buildingRepository.save(Building.builder().name("Tòa A - Sài Gòn").hotel(hotel1).build());
            floorRepository.save(Floor.builder().floorNumber(1).building(b1).build());
            floorRepository.save(Floor.builder().floorNumber(2).building(b1).build());

            branchRoomPolicyRepository.saveAll(List.of(
                    BranchRoomPolicy.builder()
                            .hotel(hotel1)
                            .roomType(RoomType.STANDARD)
                            .area(20.5)
                            .standardCapacity(2)    // Sức chứa tiêu chuẩn (VD: 2 người)
                            .maxExtraGuests(2)// Sức chứa phụ thu tối đa (VD: tối đa thêm 2 người)// Số em bé tối đa
                            .extraAdultFee(250000.0)
                            .extraChildFee(120000.0)
                            .basePrice(100.0)
                            .build(),
                    BranchRoomPolicy.builder()
                            .hotel(hotel1)
                            .area(30.5)
                            .roomType(RoomType.DELUXE)
                            .standardCapacity(2)
                            .maxExtraGuests(3)
                            .extraAdultFee(180000.0)
                            .extraChildFee(90000.0)
                            .basePrice(200.0)
                            .build(),
                    BranchRoomPolicy.builder()
                            .hotel(hotel1)
                            .roomType(RoomType.SUITE)
                            .standardCapacity(3)
                            .maxExtraGuests(3)
                            .area(40.5)
                            .extraAdultFee(350000.0)
                            .extraChildFee(180000.0)
                            .basePrice(300.0)
                            .build(),
                    BranchRoomPolicy.builder()
                            .hotel(hotel1)
                            .roomType(RoomType.FAMILY)
                            .standardCapacity(4)
                            .maxExtraGuests(4)
                            .area(50.5)
                            .extraAdultFee(280000.0)
                            .extraChildFee(140000.0)
                            .basePrice(400.0)
                            .build()
            ));
            // Admin Chi nhánh 1
            createBranchAdmin(
                    "admin.saigon@senviet.vn",
                    "Quản Lý Sài Gòn",
                    "0901111111",
                    "Admin Chi nhánh Sài Gòn",
                    hotel1,
                    managerRole
            );
            System.out.println(">>> [STARTUP] Đã tạo Chi nhánh 1: Sài Gòn Sky Hotel & Policy kèm theo.");
        }

        // ==========================================
        // 3. KHỞI TẠO CHI NHÁNH 2: HÀ NỘI
        // ==========================================
        if (!hotelRepository.existsByName("Hà Nội Grand Hotel")) {
            Province provinceHanoi = provinceRepository.findByName("TP. Hà Nội")
                    .orElseGet(() -> provinceRepository.save(Province.builder().name("TP. Hà Nội").build()));

            Hotel hotel2 = hotelRepository.save(
                    Hotel.builder()
                            .name("Hà Nội Grand Hotel")
                            .address("45 Tràng Tiền, Hoàn Kiếm, Hà Nội")
                            .phone("0243888888")
                            .province(provinceHanoi)
                            .build()
            );

            // Tòa nhà & Tầng mẫu cho Chi nhánh 2
            Building b2 = buildingRepository.save(Building.builder().name("Tòa Hoàn Kiếm - Hà Nội").hotel(hotel2).build());
            floorRepository.save(Floor.builder().floorNumber(1).building(b2).build());
            floorRepository.save(Floor.builder().floorNumber(2).building(b2).build());

            branchRoomPolicyRepository.saveAll(List.of(
                    BranchRoomPolicy.builder()
                            .hotel(hotel2)
                            .roomType(RoomType.STANDARD)
                            .standardCapacity(2)    // Sức chứa tiêu chuẩn (VD: 2 người)
                            .maxExtraGuests(2)
                            .area(20.5)// Sức chứa phụ thu tối đa (VD: tối đa thêm 2 người)// Số em bé tối đa
                            .extraAdultFee(250000.0)
                            .extraChildFee(120000.0)
                            .basePrice(100.0)
                            .build(),
                    BranchRoomPolicy.builder()
                            .hotel(hotel2)
                            .roomType(RoomType.DELUXE)
                            .standardCapacity(2)
                            .maxExtraGuests(3)
                            .area(30.5)
                            .extraAdultFee(180000.0)
                            .extraChildFee(90000.0)
                            .basePrice(200.0)
                            .build(),
                    BranchRoomPolicy.builder()
                            .hotel(hotel2)
                            .roomType(RoomType.SUITE)
                            .standardCapacity(3)
                            .maxExtraGuests(3)
                            .area(40.5)
                            .extraAdultFee(350000.0)
                            .extraChildFee(180000.0)
                            .basePrice(300.0)
                            .build(),
                    BranchRoomPolicy.builder()
                            .hotel(hotel2)
                            .roomType(RoomType.FAMILY)
                            .standardCapacity(4)
                            .maxExtraGuests(4)
                            .area(50.5)
                            .extraAdultFee(280000.0)
                            .extraChildFee(140000.0)
                            .basePrice(400.0)
                            .build()
            ));
            // Admin Chi nhánh 2
            createBranchAdmin(
                    "admin.hanoi@senviet.vn",
                    "Quản Lý Hà Nội",
                    "0902222222",
                    "Admin Chi nhánh Hà Nội",
                    hotel2,
                    managerRole
            );
            System.out.println(">>> [STARTUP] Đã tạo Chi nhánh 2: Hà Nội Grand Hotel & Policy kèm theo.");
        }

        ensureBranchSeedData("Sài Gòn Sky Hotel & Residence", "Tòa A - Sài Gòn");
        ensureBranchSeedData("Hà Nội Grand Hotel", "Tòa Hoàn Kiếm - Hà Nội");

        ensureBranchTestAccounts(
                "Sài Gòn Sky Hotel & Residence",
                "saigon",
                "Sài Gòn",
                "0901111111",
                "0901111112",
                "0901111113",
                managerRole,
                employeeRole
        );
        ensureBranchTestAccounts(
                "Hà Nội Grand Hotel",
                "hanoi",
                "Hà Nội",
                "0902222222",
                "0902222223",
                "0902222224",
                managerRole,
                employeeRole
        );

        // ==========================================
        // 4. KHỞI TẠO ADMIN TỔNG (SUPER ADMIN)
        // ==========================================
        String superAdminEmail = "admin@senviet.vn";
        Account existingSuperAdmin = accountRepository.findByEmail(superAdminEmail).orElse(null);
        if (existingSuperAdmin == null) {
            Account superAdminAccount = Account.builder()
                    .email(superAdminEmail)
                    .password(passwordEncoder.encode("admin123"))
                    .roles(Set.of(systemAdminRole))
                    .build();

            Employee superAdminEmployee = Employee.builder()
                    .fullName("Admin Tổng Toàn Hệ Thống")
                    .phone("0901234567")
                    .position("Super Admin")
                    .hotel(null)
                    .account(superAdminAccount)
                    .build();

            employeeRepository.save(superAdminEmployee);
            System.out.println(">>> [STARTUP] Đã tạo Tài khoản Admin Tổng: " + superAdminEmail);
        } else {
            if (!hasRole(existingSuperAdmin, systemAdminRole)) {
                Set<Role> roles = existingSuperAdmin.getRoles() == null
                        ? new HashSet<>()
                        : new HashSet<>(existingSuperAdmin.getRoles());
                roles.add(systemAdminRole);
                existingSuperAdmin.setRoles(roles);
                accountRepository.save(existingSuperAdmin);
            }
            if (existingSuperAdmin.getEmployee() == null) {
                employeeRepository.save(Employee.builder()
                        .fullName("Admin Tổng Toàn Hệ Thống")
                        .phone("0901234567")
                        .position("Super Admin")
                        .hotel(null)
                        .account(existingSuperAdmin)
                        .build());
            }
        }

        // ==========================================
        // 5. KHỞI TẠO DANH MỤC LOẠI GIƯỜNG & PHÂN BỔ GIƯỜNG
        // ==========================================
        ensureBedType("Single Bed", "Giường đơn tiêu chuẩn kích thước 1m2 x 2m", 1, false);
        ensureBedType("Queen Bed", "Giường đôi vừa kích thước 1m6 x 2m", 2, false);
        ensureBedType("King Bed", "Giường đôi lớn kích thước 1m8 x 2m", 2, false);
        ensureBedType("Super King Bed", "Giường đôi siêu lớn kích thước 2m x 2m2", 2, false);
        ensureBedType("Sofa Bed", "Giường sofa đa năng đặt tại phòng khách", 2, true);
        ensureBedType("Extra Bed", "Giường phụ di động kê thêm khi có yêu cầu", 1, true);

        ensureRoomTypeBed(RoomType.STANDARD, "Queen Bed", 1);
        ensureRoomTypeBed(RoomType.DELUXE, "King Bed", 1);
        ensureRoomTypeBed(RoomType.SUITE, "Super King Bed", 1);
        ensureRoomTypeBed(RoomType.SUITE, "Sofa Bed", 1);
        ensureRoomTypeBed(RoomType.FAMILY, "Queen Bed", 2);

        // ==========================================
        // 6. KHỞI TẠO KHÁCH HÀNG MẪU (NẾU CHƯA CÓ)
        // ==========================================
        try {
            Role customerRole = roleRepository.findByName("ROLE_CUSTOMER")
                    .orElseThrow(() -> new RuntimeException("Thiếu cấu hình ROLE_CUSTOMER"));
            Account customerAccount = accountRepository.findByEmail("customer@senviet.vn")
                    .orElseGet(() -> accountRepository.save(Account.builder()
                            .email("customer@senviet.vn")
                            .password(passwordEncoder.encode("customer123"))
                            .roles(Set.of(customerRole))
                            .build()));
            if (customerRepository.findByAccount(customerAccount).isEmpty()
                    && customerRepository.findByEmail("customer@senviet.vn").isEmpty()) {
                Customer defaultCustomer = Customer.builder()
                        .fullName("Huỳnh Văn Hiếu")
                        .phone("0901234567")
                        .email("customer@senviet.vn")
                        .loyaltyTier(LoyaltyTier.BRONZE)
                        .totalSpent(0.0)
                        .totalBookings(0)
                        .account(customerAccount)
                        .build();
                customerRepository.save(defaultCustomer);
                System.out.println(">>> [STARTUP] Đã khởi tạo Khách hàng mẫu thành công.");
            }
        } catch (Exception e) {
            System.err.println(">>> [STARTUP WARN] Khởi tạo khách hàng mẫu thất bại: " + e.getMessage());
        }

        // ==========================================
        // 7. KHỞI TẠO PHÒNG MẪU (NẾU CHƯA CÓ)
        // ==========================================
        try {
            ensureSampleRooms();
        } catch (Exception e) {
            System.err.println(">>> [STARTUP WARN] Khởi tạo phòng mẫu thất bại: " + e.getMessage());
        }

        // ==========================================
        // 8. ĐẢM BẢO CHÍNH SÁCH GIÁ (POLICY) CHO TẤT CẢ KHÁCH SẠN
        // ==========================================
        try {
            List<Hotel> allHotels = hotelRepository.findAll();
            for (Hotel hotel : allHotels) {
                for (RoomType rt : RoomType.values()) {
                    if (branchRoomPolicyRepository.findByHotelIdAndRoomType(hotel.getId(), rt) == null) {
                        double base = switch (rt) {
                            case STANDARD -> 1000000.0;
                            case DELUXE -> 2000000.0;
                            case SUITE -> 3000000.0;
                            case FAMILY -> 3500000.0;
                        };
                        branchRoomPolicyRepository.save(BranchRoomPolicy.builder()
                                .hotel(hotel)
                                .roomType(rt)
                                .standardCapacity(rt == RoomType.FAMILY ? 4 : (rt == RoomType.SUITE ? 3 : 2))
                                .maxExtraGuests(rt == RoomType.FAMILY ? 4 : (rt == RoomType.DELUXE || rt == RoomType.SUITE ? 3 : 2))
                                .extraAdultFee(200000.0)
                                .extraChildFee(100000.0)
                                .area(switch (rt) {
                                    case STANDARD -> 20.5;
                                    case DELUXE -> 30.5;
                                    case SUITE -> 40.5;
                                    case FAMILY -> 50.5;
                                })
                                .basePrice(base)
                                .build());
                    }
                }
            }
            System.out.println(">>> [STARTUP] Đã đồng bộ BranchRoomPolicy cho toàn bộ khách sạn.");
        } catch (Exception e) {
            System.err.println(">>> [STARTUP WARN] Đồng bộ BranchRoomPolicy thất bại: " + e.getMessage());
        }
    }

    /**
     * Helper method tạo tài khoản Admin cho chi nhánh
     */
    private void createBranchAdmin(String email, String fullName, String phone, String position, Hotel hotel, Role role) {
        if (!accountRepository.existsByEmail(email)) {
            Account account = Account.builder()
                    .email(email)
                    .password(passwordEncoder.encode("admin123"))
                    .roles(Set.of(role))
                    .build();

            Employee employee = Employee.builder()
                    .fullName(fullName)
                    .phone(phone)
                    .position(position)
                    .hotel(hotel)
                    .account(account)
                    .build();

            employeeRepository.save(employee);
        }
    }

    private void ensureBranchSeedData(String hotelName, String buildingName) {
        Hotel hotel = hotelRepository.findByName(hotelName)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy chi nhánh: " + hotelName));

        Building building = buildingRepository.findByHotelIdAndName(hotel.getId(), buildingName)
                .orElseGet(() -> buildingRepository.save(Building.builder()
                        .name(buildingName)
                        .hotel(hotel)
                        .build()));

        for (int floorNumber = 1; floorNumber <= 2; floorNumber++) {
            if (!floorRepository.existsByBuilding_IdAndFloorNumber(building.getId(), floorNumber)) {
                floorRepository.save(Floor.builder()
                        .floorNumber(floorNumber)
                        .building(building)
                        .build());
            }
        }
    }

    private void ensureBedType(String name, String description, int capacity, boolean extraBed) {
        if (bedTypeRepository.findByName(name) == null) {
            bedTypeRepository.save(BedType.builder()
                    .name(name)
                    .description(description)
                    .capacity(capacity)
                    .isExtraBed(extraBed)
                    .build());
        }
    }

    private void ensureRoomTypeBed(RoomType roomType, String bedTypeName, int quantity) {
        BedType bedType = bedTypeRepository.findByName(bedTypeName);
        if (bedType != null && !roomTypeBedRepository.existsByRoomTypeAndBedTypeId(roomType, bedType.getId())) {
            roomTypeBedRepository.save(RoomTypeBed.builder()
                    .roomType(roomType)
                    .bedType(bedType)
                    .quantity(quantity)
                    .build());
        }
    }

    private void ensureSampleRooms() {
        List<Floor> floors = floorRepository.findAll();
        RoomType[] roomTypes = RoomType.values();
        String[] imageUrls = {
                "https://images.unsplash.com/photo-1611892440504-42a792e24d32?q=80&w=900&auto=format&fit=crop",
                "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?q=80&w=900&auto=format&fit=crop",
                "https://images.unsplash.com/photo-1566665797739-1674de7a421a?q=80&w=900&auto=format&fit=crop",
                "https://images.unsplash.com/photo-1590490360182-c33d57733427?q=80&w=900&auto=format&fit=crop"
        };
        double[] basePrices = {1_000_000.0, 2_000_000.0, 3_000_000.0, 3_500_000.0};

        for (Floor floor : floors) {
            for (int i = 0; i < roomTypes.length; i++) {
                RoomType roomType = roomTypes[i];
                if (roomRepository.existsByFloorIdAndRoomType(floor.getId(), roomType)) {
                    continue;
                }

                int number = floor.getFloorNumber() * 100 + i + 1;
                String roomNumber = String.valueOf(number);
                while (roomRepository.existsByFloorIdAndRoomNumber(floor.getId(), roomNumber)) {
                    roomNumber = String.valueOf(++number);
                }

                roomRepository.save(Room.builder()
                        .floor(floor)
                        .roomNumber(roomNumber)
                        .roomStatus(RoomStatus.READY)
                        .roomType(roomType)
                        .basePrice(basePrices[i])
                        .avatarUrl(List.of(RoomImage.builder()
                                .url(imageUrls[i])
                                .isDefault(true)
                                .build()))
                        .amenities(Set.of())
                        .build());
            }
        }
    }

    private void ensureBranchTestAccounts(
            String hotelName,
            String branchCode,
            String branchLabel,
            String adminPhone,
            String managerPhone,
            String employeePhone,
            Role managerRole,
            Role employeeRole
    ) {
        Hotel hotel = hotelRepository.findByName(hotelName)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy chi nhánh: " + hotelName));

        ensureBranchTestAccount(
                "admin." + branchCode + "@senviet.vn",
                "Admin Chi nhánh " + branchLabel,
                adminPhone,
                "Admin Chi nhánh",
                hotel,
                managerRole
        );
        ensureBranchTestAccount(
                "manager." + branchCode + "@senviet.vn",
                "Quản lý " + branchLabel,
                managerPhone,
                "Quản lý",
                hotel,
                managerRole
        );
        ensureBranchTestAccount(
                "employee." + branchCode + "@senviet.vn",
                "Nhân viên " + branchLabel,
                employeePhone,
                "Nhân viên",
                hotel,
                employeeRole
        );
    }

    private void ensureBranchTestAccount(
            String email,
            String fullName,
            String phone,
            String position,
            Hotel hotel,
            Role role
    ) {
        Account existingAccount = accountRepository.findByEmail(email).orElse(null);
        if (existingAccount != null) {
            if (!hasRole(existingAccount, role)) {
                Set<Role> roles = existingAccount.getRoles() == null
                        ? new HashSet<>()
                        : new HashSet<>(existingAccount.getRoles());
                roles.add(role);
                existingAccount.setRoles(roles);
                accountRepository.save(existingAccount);
            }
            Employee existingEmployee = existingAccount.getEmployee();
            if (existingEmployee != null) {
                boolean employeeChanged = !Objects.equals(existingEmployee.getFullName(), fullName)
                        || !Objects.equals(existingEmployee.getPhone(), phone)
                        || !Objects.equals(existingEmployee.getPosition(), position)
                        || existingEmployee.getHotel() == null
                        || !Objects.equals(existingEmployee.getHotel().getId(), hotel.getId());
                if (employeeChanged) {
                    existingEmployee.setFullName(fullName);
                    existingEmployee.setPhone(phone);
                    existingEmployee.setPosition(position);
                    existingEmployee.setHotel(hotel);
                    employeeRepository.save(existingEmployee);
                }
                return;
            }
        }

        Account account = existingAccount != null
                ? existingAccount
                : Account.builder()
                        .email(email)
                        .password(passwordEncoder.encode("admin123"))
                        .roles(Set.of(role))
                        .build();

        Employee employee = Employee.builder()
                .fullName(fullName)
                .phone(phone)
                .position(position)
                .hotel(hotel)
                .account(account)
                .build();

        employeeRepository.save(employee);
        System.out.println(">>> [STARTUP] Đã tạo tài khoản kiểm thử: " + email);
    }

    private boolean hasRole(Account account, Role expectedRole) {
        return account.getRoles() != null
                && account.getRoles().stream()
                .anyMatch(role -> Objects.equals(role.getId(), expectedRole.getId()));
    }
}