package com.suspectra.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
public class EmailService {

    private final JavaMailSender mailSender;

    @Value("${app.otp.dev-mode:true}")
    private boolean devMode;

    @Value("${spring.mail.username:}")
    private String fromEmail;

    public void sendOtpEmail(String toEmail, String otp) {
        if (devMode) {
            log.info("╔══════════════════════════════╗");
            log.info("║   [DEV MODE] OTP for {}  ", toEmail);
            log.info("║   Code: {}                   ", otp);
            log.info("╚══════════════════════════════╝");
            return;
        }

        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(fromEmail);
            message.setTo(toEmail);
            message.setSubject("Suspectra 2.0 — Your Login OTP");
            message.setText(buildEmailBody(otp));
            mailSender.send(message);
            log.info("OTP email sent to {}", toEmail);
        } catch (Exception e) {
            log.error("Failed to send OTP email to {}: {}", toEmail, e.getMessage());
            throw new RuntimeException("Failed to send OTP email");
        }
    }

    private String buildEmailBody(String otp) {
        return """
                SUSPECTRA 2.0 — Forensic Sketch Recognition Platform
                ─────────────────────────────────────────────────────

                Your one-time login code is:

                    %s

                This code expires in 10 minutes.
                Do not share this code with anyone.

                If you did not request this, ignore this email.

                — Suspectra Security Team
                """.formatted(otp);
    }
}
