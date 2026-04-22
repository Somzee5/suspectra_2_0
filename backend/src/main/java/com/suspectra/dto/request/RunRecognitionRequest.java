package com.suspectra.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

@Data
public class RunRecognitionRequest {

    @NotNull
    private UUID caseId;

    @NotBlank
    private String imageBase64;

    private int    maxFaces  = 10;
    private double threshold = 40.0;
}
