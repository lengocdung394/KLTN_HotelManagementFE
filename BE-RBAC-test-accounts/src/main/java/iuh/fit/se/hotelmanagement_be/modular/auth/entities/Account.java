package iuh.fit.se.hotelmanagement_be.modular.auth.entities;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import lombok.experimental.SuperBuilder;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashSet;
import java.util.Collection;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@EqualsAndHashCode()
@Data
@SuperBuilder
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Entity
@Table(name = "account")
public class Account implements UserDetails {
    @Id
    @Column(name = "account_id")
    String id;

    String email;

    String password;

    // Quan hệ 1-1 ngược lại tới Employee (Account không giữ khóa ngoại)
    @ToString.Exclude
    @OneToOne(mappedBy = "account", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    Employee employee;

    // Quan hệ 1-1 ngược lại tới Customer (Account không giữ khóa ngoại)
    @ToString.Exclude
    @OneToOne(mappedBy = "account", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    Customer customer;

    // Helper method lấy Hotel ID (chỉ áp dụng cho Nhân viên thuộc chi nhánh)
    public Long getHotelId() {
        if (this.employee != null && this.employee.getHotel() != null) {
            return this.employee.getHotel().getId();
        }
        return null; // Admin tổng hoặc Customer
    }

    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(name = "account_role",
            joinColumns = @JoinColumn(name = "account_id"),
            inverseJoinColumns = @JoinColumn(name = "role_id"))
    Set<Role> roles;


    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        if (this.roles == null || this.roles.isEmpty()) {
            return List.of();
        }

        Set<String> authorityNames = new HashSet<>();
        for (Role role : this.roles) {
            authorityNames.add(role.getName());
            if (role.getPermissions() != null) {
                role.getPermissions().forEach(permission -> authorityNames.add(permission.getName()));
            }
        }
        return authorityNames.stream()
                .map(SimpleGrantedAuthority::new)
                .collect(Collectors.toList());
    }

    @Override
    public String getUsername() {
        return this.email;
    }

    @Override
    public boolean isAccountNonExpired() {
        return UserDetails.super.isAccountNonExpired();
    }

    @Override
    public boolean isAccountNonLocked() {
        return UserDetails.super.isAccountNonLocked();
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return UserDetails.super.isCredentialsNonExpired();
    }

    @Override
    public boolean isEnabled() {
        return UserDetails.super.isEnabled();
    }

    // --- TỰ ĐỘNG SINH MÃ ACCOUNT TRƯỚC KHI LƯU ---
    @PrePersist
    protected void onCreate() {
        if (this.id == null || this.id.isEmpty()) {
            String dateStr = DateTimeFormatter.ofPattern("yyyyMMdd").format(LocalDateTime.now());
            int randomNum = (int) (Math.random() * 9000) + 1000;
            this.id = "ACC" + dateStr + randomNum; // Ví dụ: ACC202609228492
        }
    }



    // Helper method lấy Employee ID (nếu là nhân viên)
    public String getEmployeeId() {
        if (this.employee != null) {
            return this.employee.getId();
        }
        return null;
    }
}
