package com.suspectra.service;

import com.suspectra.dto.request.CreateCaseRequest;
import com.suspectra.dto.response.CaseDto;
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

    @Transactional(readOnly = true)
    public Page<CaseDto> getAllCases(int page, int size) {
        Pageable pageable = PageRequest.of(page, size);
        return caseRepository.findAllByOrderByCreatedAtDesc(pageable).map(this::toDto);
    }

    @Transactional(readOnly = true)
    public CaseDto getCaseById(UUID id) {
        Case c = caseRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Case not found: " + id));
        return toDto(c);
    }

    @Transactional
    public CaseDto createCase(CreateCaseRequest request) {
        User currentUser = getCurrentUser();
        Case saved = caseRepository.save(
                Case.builder()
                        .title(request.getTitle())
                        .description(request.getDescription())
                        .createdBy(currentUser)
                        .build()
        );
        return toDto(saved);
    }

    private CaseDto toDto(Case c) {
        return CaseDto.builder()
                .id(c.getId())
                .title(c.getTitle())
                .description(c.getDescription())
                .status(c.getStatus().name())
                .createdBy(CaseDto.UserSummary.builder()
                        .id(c.getCreatedBy().getId())
                        .email(c.getCreatedBy().getEmail())
                        .name(c.getCreatedBy().getName())
                        .role(c.getCreatedBy().getRole().name())
                        .build())
                .createdAt(c.getCreatedAt())
                .updatedAt(c.getUpdatedAt())
                .build();
    }

    private User getCurrentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + email));
    }
}
