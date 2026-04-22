package com.suspectra.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Data
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class RecognitionRunDto {

    private UUID          id;
    private UUID          caseId;
    private String        inputS3Key;
    private List<SuspectMatch> matches;
    private int           total;
    private LocalDateTime createdAt;
    private String        error;

    @Data
    @Builder
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class SuspectMatch {
        private String  suspectId;
        private String  name;
        private Integer age;
        private String  gender;
        private String  crimeType;
        private String  description;
        private String  imageUrl;
        private double  awsSimilarity;
        private double  embeddingScore;
        private double  finalScore;
        private double  confidence;
    }
}
