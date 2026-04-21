package com.suspectra.repository;

import com.suspectra.entity.Case;
import com.suspectra.entity.enums.CaseStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface CaseRepository extends JpaRepository<Case, UUID> {

    // EntityGraph eagerly loads createdBy — avoids LazyInitializationException during JSON serialization
    @EntityGraph(attributePaths = {"createdBy"})
    Page<Case> findAllByOrderByCreatedAtDesc(Pageable pageable);

    @EntityGraph(attributePaths = {"createdBy"})
    Optional<Case> findById(UUID id);

    long countByStatus(CaseStatus status);
}
