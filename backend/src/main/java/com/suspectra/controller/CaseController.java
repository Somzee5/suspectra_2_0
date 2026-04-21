package com.suspectra.controller;

import com.suspectra.dto.request.CreateCaseRequest;
import com.suspectra.dto.response.ApiResponse;
import com.suspectra.entity.Case;
import com.suspectra.service.CaseService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/cases")
@RequiredArgsConstructor
public class CaseController {

    private final CaseService caseService;

    @GetMapping
    public ResponseEntity<ApiResponse<Page<Case>>> getAllCases(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return ResponseEntity.ok(ApiResponse.ok("Cases fetched", caseService.getAllCases(page, size)));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<Case>> getCaseById(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.ok("Case fetched", caseService.getCaseById(id)));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<Case>> createCase(@Valid @RequestBody CreateCaseRequest request) {
        Case created = caseService.createCase(request);
        return ResponseEntity.status(201).body(ApiResponse.ok("Case created", created));
    }
}
