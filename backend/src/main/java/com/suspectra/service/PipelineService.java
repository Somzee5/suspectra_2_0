package com.suspectra.service;

import com.suspectra.dto.request.RunAgingRequest;
import com.suspectra.dto.request.RunPipelineRequest;
import com.suspectra.dto.response.AgingRunDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * Pipeline orchestrator — ties aging + recognition into one call.
 *
 * The humanization step is handled client-side (frontend calls AI service
 * directly for canvas export + SD inference). This service receives the
 * already-humanized face and runs the aging-invariant recognition pipeline:
 *   1. Generate N age variants via AI service
 *   2. Run ArcFace recognition on each variant
 *   3. Persist results in aging_runs (linked to case)
 *   4. Return ranked matches + best match
 *
 * Delegates entirely to AgingService — no duplicate AI call logic here.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PipelineService {

    private final AgingService agingService;

    public AgingRunDto runPipeline(RunPipelineRequest request) {
        log.info("Pipeline run — caseId={} steps={}", request.getCaseId(), request.getAgeSteps());

        RunAgingRequest agingRequest = new RunAgingRequest();
        agingRequest.setCaseId(request.getCaseId());
        agingRequest.setImageBase64(request.getImageBase64());
        agingRequest.setAgeSteps(request.getAgeSteps());
        agingRequest.setMaxFaces(request.getMaxFaces());
        agingRequest.setThreshold(request.getThreshold());

        return agingService.runAging(agingRequest);
    }
}
