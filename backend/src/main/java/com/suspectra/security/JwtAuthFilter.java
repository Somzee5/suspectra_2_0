package com.suspectra.security;

import com.suspectra.service.CustomUserDetailsService;
import com.suspectra.service.JwtService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
@RequiredArgsConstructor
public class JwtAuthFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(JwtAuthFilter.class);

    private final JwtService             jwtService;
    private final CustomUserDetailsService userDetailsService;
    private final SecurityAuditService   auditService;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {

        final String authHeader = request.getHeader("Authorization");

        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        final String jwt = authHeader.substring(7);
        final String ip  = resolveIp(request);

        try {
            final String email = jwtService.extractEmail(jwt);

            if (email != null && SecurityContextHolder.getContext().getAuthentication() == null) {
                UserDetails userDetails = userDetailsService.loadUserByUsername(email);

                if (jwtService.isTokenValid(jwt, userDetails)) {
                    UsernamePasswordAuthenticationToken authToken =
                            new UsernamePasswordAuthenticationToken(userDetails, null, userDetails.getAuthorities());
                    authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                    SecurityContextHolder.getContext().setAuthentication(authToken);
                } else {
                    log.warn("JWT rejected for {} from {} — token invalid or expired", email, ip);
                    auditService.record(SecurityAuditService.EventType.JWT_INVALID, email, ip,
                            "Token failed validation — possible replay or tampering");
                }
            }
        } catch (io.jsonwebtoken.ExpiredJwtException ex) {
            String ip2 = resolveIp(request);
            log.warn("Expired JWT from {} on {}", ip2, request.getRequestURI());
            auditService.record(SecurityAuditService.EventType.JWT_EXPIRED, "[unknown]", ip2,
                    "Expired token presented on " + request.getRequestURI());
        } catch (Exception ex) {
            log.warn("Malformed JWT from {} — {}", ip, ex.getMessage());
            auditService.record(SecurityAuditService.EventType.JWT_INVALID, "[unknown]", ip,
                    "Malformed token: " + ex.getClass().getSimpleName());
        }

        filterChain.doFilter(request, response);
    }

    private String resolveIp(HttpServletRequest req) {
        String xff = req.getHeader("X-Forwarded-For");
        return (xff != null && !xff.isBlank()) ? xff.split(",")[0].trim() : req.getRemoteAddr();
    }
}
