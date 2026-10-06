package iuh.fit.se.hotelmanagement_be.config;

import iuh.fit.se.hotelmanagement_be.modular.auth.repositories.AccountRepository;
import jakarta.servlet.Filter;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.stereotype.Component;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
@EnableMethodSecurity
public class SecurityConfig {
    private final JwtAuthenticationFilter jwtAuthFilter;
    private final AuthEntryPoint authEntryPoint;
    private final AccountRepository accountRepository;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .cors(cors -> cors.configurationSource(corsConfigurationSource())) // 👈 thêm dòng này
                .csrf(csrf -> csrf.disable())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(
                                "/v3/api-docs/**",
                                "/swagger-ui/**",
                                "/swagger-ui.html"
                        ).permitAll()
                        .requestMatchers(
                                "/auth/**",
                                "/api/v1/auth/**"
                        ).permitAll()
                        .requestMatchers("/error").permitAll()
                        .requestMatchers("/api/v1/rooms/public/**").permitAll()
                        // TODO: cho phan hoan thien upload file
                        .requestMatchers("/servicesImport/**").permitAll()
                        // TODO: Xóa dòng này sau khi hoàn thiện Auth cho module KM
                        .requestMatchers("/management-rooms/**").permitAll()
                        .requestMatchers("/management-bookings/**").permitAll()
                        .requestMatchers("/payment/**").permitAll()
                        .requestMatchers("/customer-promotions/**").permitAll()
                        .requestMatchers("/employee/**").permitAll()
                        .requestMatchers("/staff-shifts/**").permitAll()
                        .requestMatchers("/customer/**").permitAll()
                        .requestMatchers("/users/**").permitAll()
                        .requestMatchers("/bedTypes/**").permitAll()
                        .requestMatchers("/amenities/**").permitAll()
                        .requestMatchers("/promotions/**").permitAll()
                        .requestMatchers( "/services/**").permitAll()
                        .requestMatchers("/customer/types").permitAll()
                        .requestMatchers("/bookings/**").permitAll()
                        .requestMatchers("/orders/**").permitAll()
                        .requestMatchers("/room/**").permitAll()
                        .requestMatchers("/reviews/**").permitAll()
                        .requestMatchers("/payment/webhook/payos").permitAll()
                        .requestMatchers("/staff-shifts/**").permitAll()
                        .requestMatchers("/api/v1/admin/**").hasRole("SUPER_ADMIN")
                        .anyRequest().authenticated()
                )
                .exceptionHandling(exception -> exception.authenticationEntryPoint(authEntryPoint))
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOriginPatterns(List.of("http://localhost:*", "http://127.0.0.1:*"));
        configuration.setAllowedOrigins(List.of(
                "http://localhost:8080",
                "http://localhost:8081",
                "http://localhost:8082",
                "http://localhost:8083",
                "http://localhost:5173",
                "http://localhost:3000"
        ));
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("*"));
        configuration.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }
}