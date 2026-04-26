package com.suspectra.controller;

import com.suspectra.dto.request.RunAgingRequest;
import com.suspectra.dto.response.AgingRunDto;
import com.suspectra.dto.response.ApiResponse;
import com.suspectra.service.AgingService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/aging")
@RequiredArgsConstructor
public class AgingController {

    private final AgingService agingService;

    /**
     * Run the full age-invariant recognition pipeline for a case:
     *   1. Generate age variants of the humanized face
     *   2. Run ArcFace recognition on each variant
     *   3. Return best match + per-variant breakdown
     *   4. Persists result to aging_runs table
     */
    @PostMapping("/run")
    public ResponseEntity<ApiResponse<AgingRunDto>> runAging(
            @Valid @RequestBody RunAgingRequest request) {
        AgingRunDto result = agingService.runAging(request);
        String msg = result.getError() != null
                ? "Aging run completed with errors"
                : "Age-invariant recognition complete";
        return ResponseEntity.ok(ApiResponse.ok(msg, result));
    }

    /** Fetch all aging runs for a case (history view, no variant images). */
    @GetMapping("/case/{caseId}")
    public ResponseEntity<ApiResponse<List<AgingRunDto>>> getByCase(
            @PathVariable UUID caseId) {
        List<AgingRunDto> runs = agingService.getRunsByCase(caseId);
        return ResponseEntity.ok(ApiResponse.ok("Aging history fetched", runs));
    }
}
