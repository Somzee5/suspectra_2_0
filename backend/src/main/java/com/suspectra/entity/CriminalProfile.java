package com.suspectra.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "criminal_profiles")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CriminalProfile {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private String name;

    private LocalDate dob;
    private String gender;
    private Integer age;

    @Column(name = "photo_url")
    private String photoUrl;

    @Column(name = "crime_type")
    private String crimeType;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "rekognition_face_id")
    private String rekognitionFaceId;

    @Column(name = "s3_key")
    private String s3Key;

    @Column(name = "suspect_ref", unique = true)
    private String suspectRef;

    @CreationTimestamp
    @Column(name = "added_at", updatable = false)
    private LocalDateTime addedAt;
}
