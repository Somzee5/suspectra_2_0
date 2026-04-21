package com.suspectra.service;

import com.suspectra.entity.OtpCode;
import com.suspectra.repository.OtpCodeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class OtpService {

    private final OtpCodeRepository otpCodeRepository;
    private final EmailService emailService;
    private final SecureRandom secureRandom = new SecureRandom();

    @Value("${app.otp.expiry-minutes:10}")
    private int otpExpiryMinutes;

    @Value("${app.otp.dev-mode:true}")
    private boolean devMode;

    private static final String DEV_OTP = "000000";

    @Transactional
    public void generateAndSend(String email) {
        otpCodeRepository.invalidateAllForEmail(email);

        // In dev mode always use 000000 — no email needed, just type it in
        String code = devMode ? DEV_OTP : generateCode();

        OtpCode otpCode = OtpCode.builder()
                .email(email)
                .code(code)
                .expiresAt(LocalDateTime.now().plusMinutes(otpExpiryMinutes))
                .build();

        otpCodeRepository.save(otpCode);
        emailService.sendOtpEmail(email, code);
    }

    @Transactional
    public boolean verify(String email, String code) {
        Optional<OtpCode> otpOpt = otpCodeRepository
                .findTopByEmailAndUsedFalseAndExpiresAtAfterOrderByCreatedAtDesc(email, LocalDateTime.now());

        if (otpOpt.isEmpty()) return false;

        OtpCode otp = otpOpt.get();
        if (!otp.getCode().equals(code)) return false;

        otp.setUsed(true);
        otpCodeRepository.save(otp);
        return true;
    }

    private String generateCode() {
        return String.format("%06d", secureRandom.nextInt(1_000_000));
    }
}
