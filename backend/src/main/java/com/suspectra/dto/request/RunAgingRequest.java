package com.suspectra.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;
import java.util.UUID;

@Data
public class RunAgingRequest {

    @NotNull
    private UUID caseId;

    /** Base64-encoded PNG/JPEG of the humanized face. */
    @NotBlank
    private String imageBase64;

    /** Year deltas to generate. Defaults to 5 steps spanning −20 → +20. */
    private List<Integer> ageSteps = List.of(-20, -10, 0, 10, 20);

    private int    maxFaces  = 10;
    private double threshold = 30.0;
}
