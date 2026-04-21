package com.suspectra.service;

import com.suspectra.dto.request.CreateCaseRequest;
import com.suspectra.entity.Case;
import com.suspectra.entity.User;
import com.suspectra.repository.CaseRepository;
import com.suspectra.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class CaseService {

    private final CaseRepository caseRepository;
    private final UserRepository userRepository;

    public Page<Case> getAllCases(int page, int size) {
        Pageable pageable = PageRequest.of(page, size);
        return caseRepository.findAllByOrderByCreatedAtDesc(pageable);
    }

    public Case getCaseById(UUID id) {
        return caseRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Case not found: " + id));
    }

    @Transactional
    public Case createCase(CreateCaseRequest request) {
        User currentUser = getCurrentUser();
        Case newCase = Case.builder()
                .title(request.getTitle())
                .description(request.getDescription())
                .createdBy(currentUser)
                .build();
        return caseRepository.save(newCase);
    }

    private User getCurrentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + email));
    }
}
