package com.suspectra.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "recognition_runs")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RecognitionRun {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "case_id", nullable = false)
    private UUID caseId;

    @Column(name = "input_s3_key")
    private String inputS3Key;

    @Column(name = "top_matches", columnDefinition = "TEXT", nullable = false)
    @Builder.Default
    private String topMatches = "[]";

    @Column(name = "total_found", nullable = false)
    @Builder.Default
    private Integer totalFound = 0;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
