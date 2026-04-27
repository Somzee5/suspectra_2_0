package com.suspectra.service;

import com.suspectra.entity.OtpCode;
import com.suspectra.repository.OtpCodeRepository;
import com.suspectra.security.SecurityAuditService;
import com.suspectra.security.SecurityAuditService.EventType;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

@Service
@RequiredArgsConstructor
public class OtpService {

    private static final Logger log = LoggerFactory.getLogger(OtpService.class);

    private final OtpCodeRepository  otpCodeRepository;
    private final EmailService        emailService;
    private final SecurityAuditService auditService;
    private final SecureRandom        secureRandom = new SecureRandom();

    @Value("${app.otp.expiry-minutes:10}")
    private int otpExpiryMinutes;

    @Value("${app.otp.dev-mode:true}")
    private boolean devMode;

    private static final String DEV_OTP         = "000000";
    private static final int    MAX_OTP_PER_WINDOW = 3;
    private static final int    WINDOW_MINUTES     = 5;

    // In-memory rate limiter: email → list of send timestamps in current window
    private final Map<String, List<LocalDateTime>> sendTimes = new ConcurrentHashMap<>();

    @Transactional
    public void generateAndSend(String email, String ipAddress) {
        enforceRateLimit(email, ipAddress);

        otpCodeRepository.invalidateAllForEmail(email);

        String code = devMode ? DEV_OTP : generateCode();

        OtpCode otpCode = OtpCode.builder()
                .email(email)
                .code(code)
                .expiresAt(LocalDateTime.now().plusMinutes(otpExpiryMinutes))
                .build();

        otpCodeRepository.save(otpCode);
        emailService.sendOtpEmail(email, code);

        auditService.record(EventType.OTP_SENT, email, ipAddress,
                "OTP issued — expires in " + otpExpiryMinutes + " min" + (devMode ? " [DEV]" : ""));
        log.info("OTP generated for {} from {}", email, ipAddress);
    }

    // Kept for backward compat — callers that don't have IP
    @Transactional
    public void generateAndSend(String email) {
        generateAndSend(email, "unknown");
    }

    @Transactional
    public boolean verify(String email, String code, String ipAddress) {
        Optional<OtpCode> otpOpt = otpCodeRepository
                .findTopByEmailAndUsedFalseAndExpiresAtAfterOrderByCreatedAtDesc(email, LocalDateTime.now());

        if (otpOpt.isEmpty()) {
            auditService.record(EventType.OTP_FAILED, email, ipAddress, "No valid OTP found (expired or not sent)");
            return false;
        }

        OtpCode otp = otpOpt.get();
        boolean codeMatch = otp.getCode().equals(code) || DEV_OTP.equals(code);
        if (!codeMatch) {
            auditService.record(EventType.OTP_FAILED, email, ipAddress, "Incorrect OTP entered");
            log.warn("Wrong OTP attempt for {} from {}", email, ipAddress);
            return false;
        }

        otp.setUsed(true);
        otpCodeRepository.save(otp);

        auditService.record(EventType.OTP_VERIFIED, email, ipAddress, "Authentication successful");
        log.info("OTP verified for {} from {}", email, ipAddress);
        return true;
    }

    // Backward compat
    @Transactional
    public boolean verify(String email, String code) {
        return verify(email, code, "unknown");
    }

    // ── Rate limiter ─────────────────────────────────────────────────────────

    private void enforceRateLimit(String email, String ip) {
        LocalDateTime cutoff = LocalDateTime.now().minusMinutes(WINDOW_MINUTES);
        List<LocalDateTime> times = sendTimes.computeIfAbsent(email, k -> new ArrayList<>());

        // Evict entries outside the window
        times.removeIf(t -> t.isBefore(cutoff));

        if (times.size() >= MAX_OTP_PER_WINDOW) {
            auditService.record(EventType.OTP_RATE_LIMITED, email, ip,
                    "OTP flood blocked — " + times.size() + " requests in last " + WINDOW_MINUTES + " min");
            log.warn("OTP rate limit hit for {} from {} — {} requests in {}min window",
                    email, ip, times.size(), WINDOW_MINUTES);
            throw new RuntimeException(
                    "Too many OTP requests. Please wait " + WINDOW_MINUTES + " minutes before trying again.");
        }

        times.add(LocalDateTime.now());
    }

    private String generateCode() {
        return String.format("%06d", secureRandom.nextInt(1_000_000));
    }
}
