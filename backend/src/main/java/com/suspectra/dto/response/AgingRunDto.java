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
public class AgingRunDto {

    private UUID            id;
    private UUID            caseId;
    private List<Integer>   ageSteps;

    /** Per-variant results (includes base64 image for frontend display). */
    private List<VariantResult> variants;

    /** Highest-scoring match across all age variants. */
    private SuspectMatch    bestMatch;

    /** Which age delta (e.g. "+10") produced the best match. */
    private String          sourceVariant;

    private int             totalMatches;
    private LocalDateTime   createdAt;
    private String          error;

    // ── Nested types ──────────────────────────────────────────────────────────

    @Data
    @Builder
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class VariantResult {
        private int             ageDelta;
        private String          imageb64;         // base64 PNG, included only in live response
        private List<SuspectMatch> matches;
        private boolean         faceFound;
    }

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
        private double  embeddingScore;
        private double  finalScore;
        private double  confidence;
        private String  sourceVariant;
    }
}
