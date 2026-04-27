package com.suspectra.controller;

import com.suspectra.dto.response.ApiResponse;
import com.suspectra.security.SecurityAuditService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Exposes recent security events — useful during demo to show live audit trail.
 * GET /api/audit/recent?limit=20
 */
@RestController
@RequestMapping("/api/audit")
@RequiredArgsConstructor
public class SecurityAuditController {

    private final SecurityAuditService auditService;

    @GetMapping("/recent")
    public ResponseEntity<ApiResponse<List<SecurityAuditService.SecurityEvent>>> recent(
            @RequestParam(defaultValue = "20") int limit) {
        List<SecurityAuditService.SecurityEvent> events = auditService.recent(limit);
        return ResponseEntity.ok(ApiResponse.ok("Security events (" + events.size() + " entries)", events));
    }
}
