package com.suspectra.repository;

import com.suspectra.entity.RecognitionRun;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface RecognitionRunRepository extends JpaRepository<RecognitionRun, UUID> {
    List<RecognitionRun> findByCaseIdOrderByCreatedAtDesc(UUID caseId);
}
