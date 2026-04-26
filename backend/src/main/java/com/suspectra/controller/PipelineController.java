package com.suspectra.controller;

import com.suspectra.dto.request.RunPipelineRequest;
import com.suspectra.dto.response.AgingRunDto;
import com.suspectra.dto.response.ApiResponse;
import com.suspectra.service.PipelineService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/pipeline")
@RequiredArgsConstructor
public class PipelineController {

    private final PipelineService pipelineService;

    /**
     * Full age-invariant recognition pipeline.
     *
     * Receives the humanized face image (already produced by the AI service)
     * and orchestrates aging variant generation + recognition + DB persistence.
     *
     * Frontend flow:
     *   1. Export sketch canvas → call AI humanization → get humanized face
     *   2. POST /api/pipeline/run with humanized image + case_id
     *   3. Display returned variants + best match
     */
    @PostMapping("/run")
    public ResponseEntity<ApiResponse<AgingRunDto>> runPipeline(
            @Valid @RequestBody RunPipelineRequest request) {
        AgingRunDto result = pipelineService.runPipeline(request);
        String msg = result.getError() != null
                ? "Pipeline completed with errors"
                : "Pipeline complete — age-invariant recognition done";
        return ResponseEntity.ok(ApiResponse.ok(msg, result));
    }
}
