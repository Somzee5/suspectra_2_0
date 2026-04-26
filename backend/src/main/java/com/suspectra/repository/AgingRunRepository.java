package com.suspectra.repository;

import com.suspectra.entity.AgingRun;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface AgingRunRepository extends JpaRepository<AgingRun, UUID> {

    List<AgingRun> findByCaseIdOrderByCreatedAtDesc(UUID caseId);
}
