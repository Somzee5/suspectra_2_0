package com.suspectra.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.suspectra.dto.request.RunAgingRequest;
import com.suspectra.dto.response.AgingRunDto;
import com.suspectra.entity.AgingRun;
import com.suspectra.repository.AgingRunRepository;
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
public class AgingService {

    private final AgingRunRepository agingRunRepository;
    private final ObjectMapper       objectMapper;

    @Value("${ai.service.url:http://localhost:8001}")
    private String aiServiceUrl;

    private final RestTemplate restTemplate = new RestTemplate();

    /**
     * Full age-invariant recognition pipeline:
     *   1. Call AI service /api/aging/recognize-variants
     *   2. Persist result to aging_runs
     *   3. Return DTO with variants + best match
     */
    @Transactional
    public AgingRunDto runAging(RunAgingRequest request) {

        // Build AI service request
        Map<String, Object> body = new HashMap<>();
        body.put("image_base64", request.getImageBase64());
        body.put("age_steps",    request.getAgeSteps());
        body.put("max_faces",    request.getMaxFaces());
        body.put("threshold",    request.getThreshold());

        Map<?, ?> aiResult;
        try {
            ResponseEntity<Map> resp = restTemplate.postForEntity(
                    aiServiceUrl + "/api/aging/recognize-variants", body, Map.class);
            aiResult = resp.getBody();
        } catch (RestClientException ex) {
            log.error("AI service unreachable for aging: {}", ex.getMessage());
            return AgingRunDto.builder()
                    .caseId(request.getCaseId())
                    .ageSteps(request.getAgeSteps())
                    .variants(List.of())
                    .totalMatches(0)
                    .error("AI service is offline. Start the Python service and try again.")
                    .build();
        }

        if (aiResult == null) {
            return AgingRunDto.builder()
                    .caseId(request.getCaseId())
                    .ageSteps(request.getAgeSteps())
                    .variants(List.of())
                    .totalMatches(0)
                    .error("Empty response from AI service")
                    .build();
        }

        // Parse AI response
        List<Map<String, Object>> rawVariants = safeList(aiResult, "variants");
        List<Map<String, Object>> allResults  = safeList(aiResult, "all_results");
        Map<String, Object>       bestRaw     = safeMap(aiResult, "best_match");
        String sourceVariant = aiResult.get("source_variant") != null
                ? aiResult.get("source_variant").toString() : null;
        int total = allResults.size();

        // Serialize for DB storage
        String allResultsJson = toJson(allResults);
        String ageStepsJson   = toJson(request.getAgeSteps());

        // Best match metadata for quick DB lookup
        String bestId    = bestRaw != null ? str(bestRaw, "suspect_id")  : null;
        String bestName  = bestRaw != null ? str(bestRaw, "name")        : null;
        Double bestScore = bestRaw != null ? num(bestRaw, "final_score") : null;

        // Persist to DB
        AgingRun run = agingRunRepository.save(AgingRun.builder()
                .caseId(request.getCaseId())
                .ageSteps(ageStepsJson)
                .variantsCount(rawVariants.size())
                .bestMatchId(bestId)
                .bestMatchName(bestName)
                .bestMatchScore(bestScore)
                .sourceVariant(sourceVariant)
                .totalMatches(total)
                .allResults(allResultsJson)
                .build());

        // Build response DTO (variants include images for live display)
        List<AgingRunDto.VariantResult> variantDtos = rawVariants.stream()
                .map(this::toVariantResult)
                .toList();

        AgingRunDto.SuspectMatch bestDto = bestRaw != null ? toSuspectMatch(bestRaw) : null;

        List<AgingRunDto.SuspectMatch> allMatchDtos = allResults.stream()
                .map(this::toSuspectMatch)
                .toList();

        return AgingRunDto.builder()
                .id(run.getId())
                .caseId(run.getCaseId())
                .ageSteps(request.getAgeSteps())
                .variants(variantDtos)
                .bestMatch(bestDto)
                .sourceVariant(sourceVariant)
                .totalMatches(total)
                .createdAt(run.getCreatedAt())
                .build();
    }

    @Transactional(readOnly = true)
    public List<AgingRunDto> getRunsByCase(UUID caseId) {
        return agingRunRepository.findByCaseIdOrderByCreatedAtDesc(caseId).stream()
                .map(run -> AgingRunDto.builder()
                        .id(run.getId())
                        .caseId(run.getCaseId())
                        .ageSteps(parseIntList(run.getAgeSteps()))
                        // no variants list in history view (images would be huge)
                        .bestMatch(run.getBestMatchId() != null
                                ? AgingRunDto.SuspectMatch.builder()
                                        .suspectId(run.getBestMatchId())
                                        .name(run.getBestMatchName())
                                        .finalScore(run.getBestMatchScore() != null
                                                ? run.getBestMatchScore() : 0.0)
                                        .sourceVariant(run.getSourceVariant())
                                        .build()
                                : null)
                        .sourceVariant(run.getSourceVariant())
                        .totalMatches(run.getTotalMatches())
                        .createdAt(run.getCreatedAt())
                        .build())
                .toList();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private AgingRunDto.VariantResult toVariantResult(Map<String, Object> raw) {
        List<Map<String, Object>> rawMatches = safeList(raw, "matches");
        return AgingRunDto.VariantResult.builder()
                .ageDelta(raw.get("age_delta") instanceof Number n ? n.intValue() : 0)
                .imageb64(str(raw, "image_b64"))
                .faceFound(Boolean.TRUE.equals(raw.get("face_found")))
                .matches(rawMatches.stream().map(this::toSuspectMatch).toList())
                .build();
    }

    private AgingRunDto.SuspectMatch toSuspectMatch(Map<String, Object> m) {
        return AgingRunDto.SuspectMatch.builder()
                .suspectId(str(m, "suspect_id"))
                .name(str(m, "name"))
                .age(m.get("age") instanceof Number n ? n.intValue() : null)
                .gender(str(m, "gender"))
                .crimeType(str(m, "crime_type"))
                .description(str(m, "description"))
                .embeddingScore(num(m, "embedding_score"))
                .finalScore(num(m, "final_score"))
                .confidence(num(m, "confidence"))
                .sourceVariant(str(m, "source_variant"))
                .build();
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> safeList(Map<?, ?> map, String key) {
        try {
            Object val = map.get(key);
            if (val instanceof List<?> list) {
                return objectMapper.convertValue(list, new TypeReference<>() {});
            }
        } catch (Exception ignored) {}
        return List.of();
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> safeMap(Map<?, ?> map, String key) {
        try {
            Object val = map.get(key);
            if (val instanceof Map<?, ?> m) {
                return objectMapper.convertValue(m, new TypeReference<>() {});
            }
        } catch (Exception ignored) {}
        return null;
    }

    private String toJson(Object obj) {
        try { return objectMapper.writeValueAsString(obj); } catch (Exception e) { return "[]"; }
    }

    private List<Integer> parseIntList(String json) {
        try { return objectMapper.readValue(json, new TypeReference<>() {}); }
        catch (Exception e) { return List.of(-20, -10, 0, 10, 20); }
    }

    private String str(Map<String, Object> m, String key) {
        Object v = m.get(key); return v != null ? v.toString() : "";
    }

    private double num(Map<String, Object> m, String key) {
        Object v = m.get(key); return v instanceof Number n ? n.doubleValue() : 0.0;
    }

}
