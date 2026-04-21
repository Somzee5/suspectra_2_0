package com.suspectra.repository;

import com.suspectra.entity.Case;
import com.suspectra.entity.User;
import com.suspectra.entity.enums.CaseStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface CaseRepository extends JpaRepository<Case, UUID> {
    Page<Case> findByCreatedByOrderByCreatedAtDesc(User user, Pageable pageable);
    Page<Case> findAllByOrderByCreatedAtDesc(Pageable pageable);
    long countByStatus(CaseStatus status);
}
