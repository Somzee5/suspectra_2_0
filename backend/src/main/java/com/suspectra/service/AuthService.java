package com.suspectra.service;

import com.suspectra.dto.response.AuthResponse;
import com.suspectra.entity.User;
import com.suspectra.entity.enums.UserRole;
import com.suspectra.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthService {

    private final UserRepository           userRepository;
    private final OtpService               otpService;
    private final JwtService               jwtService;
    private final CustomUserDetailsService userDetailsService;

    @Transactional
    public void sendOtp(String email, String ipAddress) {
        if (!userRepository.existsByEmail(email)) {
            String name = email.split("@")[0];
            User newUser = User.builder()
                    .email(email)
                    .name(name)
                    .role(UserRole.INVESTIGATOR)
                    .build();
            userRepository.save(newUser);
            log.info("New investigator account created for: {}", email);
        }
        otpService.generateAndSend(email, ipAddress);
    }

    public AuthResponse verifyOtpAndLogin(String email, String otp, String ipAddress) {
        boolean valid = otpService.verify(email, otp, ipAddress);
        if (!valid) {
            throw new IllegalArgumentException("Invalid or expired OTP");
        }

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + email));

        if (!user.isActive()) {
            throw new IllegalStateException("Account is deactivated. Contact administrator.");
        }

        UserDetails userDetails = userDetailsService.loadUserByUsername(email);
        String token = jwtService.generateToken(userDetails);

        return AuthResponse.builder()
                .token(token)
                .user(AuthResponse.UserDto.builder()
                        .id(user.getId())
                        .email(user.getEmail())
                        .name(user.getName())
                        .role(user.getRole())
                        .isActive(user.isActive())
                        .build())
                .build();
    }
}
