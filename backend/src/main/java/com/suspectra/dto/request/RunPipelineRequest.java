package com.suspectra.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;
import java.util.UUID;

@Data
public class RunPipelineRequest {

    @NotNull
    private UUID caseId;

    /** Base64-encoded PNG of the humanized face (produced by the AI humanization step). */
    @NotBlank
    private String imageBase64;

    /** Age deltas to probe. Defaults to the standard 5-step spread. */
    private List<Integer> ageSteps = List.of(-20, -10, 0, 10, 20);

    private int    maxFaces  = 10;
    private double threshold = 30.0;
}
