package com.suspectra.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "aging_runs")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AgingRun {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "case_id", nullable = false)
    private UUID caseId;

    @Column(name = "age_steps", nullable = false, length = 200)
    @Builder.Default
    private String ageSteps = "[-20,-10,0,10,20]";

    @Column(name = "variants_count", nullable = false)
    @Builder.Default
    private Integer variantsCount = 0;

    @Column(name = "best_match_id", length = 100)
    private String bestMatchId;

    @Column(name = "best_match_name", length = 255)
    private String bestMatchName;

    @Column(name = "best_match_score", precision = 6, scale = 3)
    private Double bestMatchScore;

    /** Which age delta (e.g. "+10" or "-20") produced the best match. */
    @Column(name = "source_variant", length = 20)
    private String sourceVariant;

    @Column(name = "total_matches", nullable = false)
    @Builder.Default
    private Integer totalMatches = 0;

    /** Full ranked JSON array of SuspectMatch objects (mirrors recognition_runs.top_matches). */
    @Column(name = "all_results", columnDefinition = "TEXT", nullable = false)
    @Builder.Default
    private String allResults = "[]";

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
