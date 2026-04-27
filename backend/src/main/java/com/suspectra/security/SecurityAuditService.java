package com.suspectra.security;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.List;

/**
 * In-memory ring buffer of the last 100 security events.
 * Also writes each event to the dedicated AUDIT logger → logs/audit.log
 */
@Service
public class SecurityAuditService {

    private static final Logger AUDIT = LoggerFactory.getLogger("AUDIT");
    private static final DateTimeFormatter FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private static final int MAX_EVENTS = 100;

    public enum EventType {
        OTP_SENT,
        OTP_VERIFIED,
        OTP_FAILED,
        OTP_RATE_LIMITED,
        JWT_VALID,
        JWT_INVALID,
        JWT_EXPIRED,
        RECOGNITION_RUN,
        AGING_RUN,
        CASE_CREATED,
        SUSPICIOUS_REQUEST
    }

    public record SecurityEvent(
            String timestamp,
            EventType type,
            String actor,
            String ipAddress,
            String detail
    ) {}

    private final Deque<SecurityEvent> events = new ArrayDeque<>();

    public synchronized void record(EventType type, String actor, String ip, String detail) {
        String ts = LocalDateTime.now().format(FMT);
        SecurityEvent event = new SecurityEvent(ts, type, actor, ip, detail);
        events.addFirst(event);
        if (events.size() > MAX_EVENTS) {
            events.removeLast();
        }
        AUDIT.info("[{}] actor={} ip={} — {}", type.name(), actor, ip, detail);
    }

    public synchronized List<SecurityEvent> recent(int limit) {
        return events.stream().limit(Math.min(limit, MAX_EVENTS)).toList();
    }
}
