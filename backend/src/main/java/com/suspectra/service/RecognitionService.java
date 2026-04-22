package com.suspectra.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.suspectra.dto.request.RunRecognitionRequest;
import com.suspectra.dto.response.RecognitionRunDto;
import com.suspectra.entity.RecognitionRun;
import com.suspectra.repository.RecognitionRunRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class RecognitionService {

    private final RecognitionRunRepository runRepository;
    private final ObjectMapper             objectMapper;

    @Value("${ai.service.url:http://localhost:8001}")
    private String aiServiceUrl;

    private final RestTemplate restTemplate = new RestTemplate();

    @Transactional
    public RecognitionRunDto runSearch(RunRecognitionRequest request) {
        // Call AI service
        Map<String, Object> body = new HashMap<>();
        body.put("image_base64", request.getImageBase64());
        body.put("max_faces",    request.getMaxFaces());
        body.put("threshold",    request.getThreshold());

        Map<?, ?> aiResult;
        try {
            ResponseEntity<Map> response = restTemplate.postForEntity(
                    aiServiceUrl + "/api/recognition/search", body, Map.class);
            aiResult = response.getBody();
        } catch (RestClientException e) {
            log.error("AI service unreachable: {}", e.getMessage());
            return RecognitionRunDto.builder()
                    .caseId(request.getCaseId())
                    .matches(List.of())
                    .total(0)
                    .error("AI service is offline. Start the Python service and try again.")
                    .build();
        }

        if (aiResult == null) {
            return RecognitionRunDto.builder()
                    .caseId(request.getCaseId()).matches(List.of()).total(0)
                    .error("Empty response from AI service").build();
        }

        // Parse matches
        List<Map<String, Object>> rawMatches =
                objectMapper.convertValue(aiResult.get("matches"), new TypeReference<>() {});
        int total = rawMatches != null ? rawMatches.size() : 0;

        String matchesJson;
        try {
            matchesJson = objectMapper.writeValueAsString(rawMatches != null ? rawMatches : List.of());
        } catch (Exception e) {
            matchesJson = "[]";
        }

        String queryKey = aiResult.get("query_s3_key") != null
                ? aiResult.get("query_s3_key").toString() : null;

        // Persist run
        RecognitionRun run = runRepository.save(RecognitionRun.builder()
                .caseId(request.getCaseId())
                .inputS3Key(queryKey)
                .topMatches(matchesJson)
                .totalFound(total)
                .build());

        return toDto(run, rawMatches != null ? rawMatches : List.of(),
                aiResult.get("error") != null ? aiResult.get("error").toString() : null);
    }

    @Transactional(readOnly = true)
    public List<RecognitionRunDto> getRunsByCase(UUID caseId) {
        return runRepository.findByCaseIdOrderByCreatedAtDesc(caseId).stream()
                .map(run -> {
                    List<Map<String, Object>> matches = parseMatches(run.getTopMatches());
                    return toDto(run, matches, null);
                })
                .toList();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private List<Map<String, Object>> parseMatches(String json) {
        try {
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (Exception e) {
            return List.of();
        }
    }

    private RecognitionRunDto toDto(RecognitionRun run,
                                    List<Map<String, Object>> rawMatches,
                                    String error) {
        List<RecognitionRunDto.SuspectMatch> matches = rawMatches.stream()
                .map(m -> RecognitionRunDto.SuspectMatch.builder()
                        .suspectId(str(m, "suspect_id"))
                        .name(str(m, "name"))
                        .age(m.get("age") instanceof Number n ? n.intValue() : null)
                        .gender(str(m, "gender"))
                        .crimeType(str(m, "crime_type"))
                        .description(str(m, "description"))
                        .imageUrl(str(m, "image_url"))
                        .awsSimilarity(num(m, "aws_similarity"))
                        .embeddingScore(num(m, "embedding_score"))
                        .finalScore(num(m, "final_score"))
                        .confidence(num(m, "confidence"))
                        .build())
                .toList();

        return RecognitionRunDto.builder()
                .id(run.getId())
                .caseId(run.getCaseId())
                .inputS3Key(run.getInputS3Key())
                .matches(matches)
                .total(matches.size())
                .createdAt(run.getCreatedAt())
                .error(error)
                .build();
    }

    private String str(Map<String, Object> m, String key) {
        Object v = m.get(key);
        return v != null ? v.toString() : "";
    }

    private double num(Map<String, Object> m, String key) {
        Object v = m.get(key);
        return v instanceof Number n ? n.doubleValue() : 0.0;
    }
}
