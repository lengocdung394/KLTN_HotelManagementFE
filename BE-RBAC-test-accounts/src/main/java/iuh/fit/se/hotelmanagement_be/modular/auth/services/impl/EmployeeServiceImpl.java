package iuh.fit.se.hotelmanagement_be.modular.auth.services.impl;

import iuh.fit.se.hotelmanagement_be.modular.auth.entities.Account;
import iuh.fit.se.hotelmanagement_be.modular.auth.entities.Employee;
import iuh.fit.se.hotelmanagement_be.modular.auth.entities.Role;
import iuh.fit.se.hotelmanagement_be.modular.auth.repositories.AccountRepository;
import iuh.fit.se.hotelmanagement_be.modular.auth.repositories.EmployeeRepository;
import iuh.fit.se.hotelmanagement_be.modular.auth.repositories.RoleRepository;
import iuh.fit.se.hotelmanagement_be.modular.auth.requests.UserRegisterRequest;
import iuh.fit.se.hotelmanagement_be.modular.auth.responses.EmployeeCreateResponse;
import iuh.fit.se.hotelmanagement_be.modular.auth.services.EmployeeService;
import iuh.fit.se.hotelmanagement_be.modular.branch.entities.Hotel;
import iuh.fit.se.hotelmanagement_be.modular.branch.repositories.HotelRepository;
import iuh.fit.se.hotelmanagement_be.shared.CloudinaryService;
import jakarta.transaction.Transactional;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import iuh.fit.se.hotelmanagement_be.modular.auth.responses.EmployeeResponse;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class EmployeeServiceImpl implements EmployeeService {
    EmployeeRepository employeeRepository;
    AccountRepository accountRepository;
    RoleRepository roleRepository;
    HotelRepository hotelRepository;
    PasswordEncoder passwordEncoder;
    CloudinaryService cloudinaryService;

    // Sử dụng khi quản lí tạo tài khoản cho nhân viên (kèm theo thông tin cá nhân)
    @Transactional
    @Override
    public EmployeeCreateResponse createStaffAndAccount(UserRegisterRequest dto, MultipartFile avatarFile, Account currentAccount) {
        Set<String> creatorRoles = currentAccount.getRoles().stream()
                .map(Role::getName)
                .collect(Collectors.toSet());

        boolean isManager = creatorRoles.contains("ROLE_MANAGER");
        boolean isAdmin = creatorRoles.contains("ROLE_SUPER_ADMIN");

        if (isManager && "Quản lý".equalsIgnoreCase(dto.getPosition())) {
            throw new RuntimeException("Quyền hạn bị từ chối: Quản lý chi nhánh chỉ được phép tạo tài khoản Nhân viên cấp dưới!");
        }

        if (isManager) {
            Long currentHotelId = currentAccount.getHotelId();
            if (currentHotelId != null) {
                dto.setHotelId(currentHotelId);
            } else {
                throw new RuntimeException("Lỗi hệ thống: Tài khoản Quản lý hiện tại chưa được cấu hình chi nhánh làm việc!");
            }
        } else if (isAdmin) {
            if (dto.getHotelId() == null) {
                throw new RuntimeException("Yêu cầu nhập liệu: Vui lòng lựa chọn chi nhánh khách sạn trực thuộc cho nhân sự mới!");
            }
        } else {
            throw new RuntimeException("Quyền hạn bị từ chối: Bạn không có đặc quyền thực hiện hành động này!");
        }

        // Kiểm tra trùng lặp Email
        if (accountRepository.existsByEmail(dto.getEmail())) {
            throw new RuntimeException("Lỗi: Email này đã được đăng ký tài khoản trong hệ thống!");
        }

        // Upload avatar lên Cloudinary
        String uploadedUrl = "";
        if (avatarFile != null && !avatarFile.isEmpty()) {
            uploadedUrl = cloudinaryService.uploadImage(avatarFile, "avatars");
        }

        // Tìm chi nhánh khách sạn
        Hotel hotel = hotelRepository.findById(dto.getHotelId())
                .orElseThrow(() -> new RuntimeException("Lỗi: Không tìm thấy khách sạn có ID: " + dto.getHotelId()));

        // Phân loại Role
        String targetRoleName = "Quản lý".equalsIgnoreCase(dto.getPosition()) ? "ROLE_MANAGER" : "ROLE_EMPLOYEE";
        Role assignedRole = roleRepository.findByName(targetRoleName)
                .orElseThrow(() -> new RuntimeException("Lỗi hệ thống: Không tìm thấy vai trò " + targetRoleName + " dưới DB!"));

        // Tạo Account trước
        Account newAccount = Account.builder()
                .email(dto.getEmail())
                .password(passwordEncoder.encode("1111"))
                .roles(Set.of(assignedRole))
                .build();

        // Tạo Employee
        Employee newEmployee = Employee.builder()
                .fullName(dto.getFullName())
                .phone(dto.getPhone())
                .cccd(dto.getCccd())
                .address(dto.getAddress())
                .position(dto.getPosition())
                .avatarUrl(uploadedUrl)
                .hotel(hotel)
                .account(newAccount)
                .build();

        // Lưu Employee (Cascade lưu luôn Account)
        Employee savedEmployee = employeeRepository.save(newEmployee);

        return EmployeeCreateResponse.builder()
                .id(savedEmployee.getId())
                .fullName(savedEmployee.getFullName())
                .email(savedEmployee.getAccount().getEmail())
                .phone(savedEmployee.getPhone())
                .cccd(savedEmployee.getCccd())
                .address(savedEmployee.getAddress())
                .position(savedEmployee.getPosition())
                .hotelName(hotel.getName())
                .roles(savedEmployee.getAccount().getRoles().stream()
                        .map(Role::getName)
                        .collect(Collectors.toSet()))
                .build();
    }

    @Override
    public List<EmployeeResponse> getEmployeesByHotelId(Long hotelId) {
        List<Employee> list = (hotelId == null)
                ? employeeRepository.findAll()
                : employeeRepository.findByHotelId(hotelId);
        return list.stream()
                .map(this::toEmployeeResponse)
                .collect(Collectors.toList());
    }

    @Override
    public EmployeeResponse getEmployeeById(String id) {
        Employee emp = employeeRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy nhân viên có ID: " + id));
        return toEmployeeResponse(emp);
    }

    @Transactional
    @Override
    public EmployeeResponse updateEmployee(String id, UserRegisterRequest dto, MultipartFile avatarFile) {
        Employee emp = employeeRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy nhân viên có ID: " + id));

        // Kiểm tra trùng SĐT nếu thay đổi
        if (dto.getPhone() != null && !dto.getPhone().isBlank() && !dto.getPhone().equals(emp.getPhone())) {
            if (employeeRepository.existsByPhoneAndIdNot(dto.getPhone(), id)) {
                throw new RuntimeException("Số điện thoại này đã được sử dụng bởi nhân viên khác!");
            }
            emp.setPhone(dto.getPhone());
        }

        // Kiểm tra trùng CCCD nếu thay đổi
        if (dto.getCccd() != null && !dto.getCccd().isBlank() && !dto.getCccd().equals(emp.getCccd())) {
            if (employeeRepository.existsByCccdAndIdNot(dto.getCccd(), id)) {
                throw new RuntimeException("Số CCCD này đã được sử dụng bởi nhân viên khác!");
            }
            emp.setCccd(dto.getCccd());
        }

        if (dto.getFullName() != null && !dto.getFullName().isBlank()) {
            emp.setFullName(dto.getFullName());
        }
        if (dto.getAddress() != null) {
            emp.setAddress(dto.getAddress());
        }
        if (dto.getPosition() != null && !dto.getPosition().isBlank()) {
            emp.setPosition(dto.getPosition());
        }

        // Upload avatar nếu có file mới
        if (avatarFile != null && !avatarFile.isEmpty()) {
            String uploadedUrl = cloudinaryService.uploadImage(avatarFile, "avatars");
            emp.setAvatarUrl(uploadedUrl);
        }

        // Đổi chi nhánh nếu có truyền hotelId
        if (dto.getHotelId() != null && (emp.getHotel() == null || !dto.getHotelId().equals(emp.getHotel().getId()))) {
            Hotel newHotel = hotelRepository.findById(dto.getHotelId())
                    .orElseThrow(() -> new RuntimeException("Không tìm thấy khách sạn có ID: " + dto.getHotelId()));
            emp.setHotel(newHotel);
        }

        Employee saved = employeeRepository.save(emp);
        return toEmployeeResponse(saved);
    }

    private EmployeeResponse toEmployeeResponse(Employee emp) {
        if (emp == null) return null;
        Set<String> roles = (emp.getAccount() != null && emp.getAccount().getRoles() != null)
                ? emp.getAccount().getRoles().stream().map(Role::getName).collect(Collectors.toSet())
                : Set.of();
        String email = (emp.getAccount() != null) ? emp.getAccount().getEmail() : null;
        Long hotelId = (emp.getHotel() != null) ? emp.getHotel().getId() : null;
        String hotelName = (emp.getHotel() != null) ? emp.getHotel().getName() : null;

        return EmployeeResponse.builder()
                .id(emp.getId())
                .email(email)
                .fullName(emp.getFullName())
                .phone(emp.getPhone())
                .cccd(emp.getCccd())
                .address(emp.getAddress())
                .position(emp.getPosition())
                .avatarUrl(emp.getAvatarUrl())
                .dateOfBirth(emp.getDateOfBirth())
                .hotelId(hotelId)
                .hotelName(hotelName)
                .roles(roles)
                .build();
    }
}
