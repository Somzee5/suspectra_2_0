package com.suspectra.controller;

import com.suspectra.dto.request.RunRecognitionRequest;
import com.suspectra.dto.response.ApiResponse;
import com.suspectra.dto.response.RecognitionRunDto;
import com.suspectra.service.RecognitionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/recognition")
@RequiredArgsConstructor
public class RecognitionController {

    private final RecognitionService recognitionService;

    @PostMapping("/run")
    public ResponseEntity<ApiResponse<RecognitionRunDto>> runRecognition(
            @Valid @RequestBody RunRecognitionRequest request) {
        RecognitionRunDto result = recognitionService.runSearch(request);
        return ResponseEntity.ok(ApiResponse.ok("Recognition complete", result));
    }

    @GetMapping("/case/{caseId}")
    public ResponseEntity<ApiResponse<List<RecognitionRunDto>>> getByCase(
            @PathVariable UUID caseId) {
        List<RecognitionRunDto> runs = recognitionService.getRunsByCase(caseId);
        return ResponseEntity.ok(ApiResponse.ok("Recognition history fetched", runs));
    }
}
