package com.suspectra.security;

import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.io.IOException;

/**
 * Logs every inbound HTTP request to the AUDIT logger.
 * Output: [METHOD] /path  [user|anonymous]  ip=x.x.x.x  status=200  42ms
 */
@Component
@Order(1)
public class RequestAuditFilter implements Filter {

    private static final Logger AUDIT = LoggerFactory.getLogger("AUDIT");

    @Override
    public void doFilter(ServletRequest req, ServletResponse res, FilterChain chain)
            throws IOException, ServletException {

        HttpServletRequest  request  = (HttpServletRequest) req;
        HttpServletResponse response = (HttpServletResponse) res;

        long start = System.currentTimeMillis();
        chain.doFilter(req, res);
        long elapsed = System.currentTimeMillis() - start;

        String ip     = resolveClientIp(request);
        String method = request.getMethod();
        String uri    = request.getRequestURI();
        int    status = response.getStatus();
        String auth   = request.getHeader("Authorization");
        String actor  = (auth != null && auth.startsWith("Bearer ")) ? "[authenticated]" : "[anonymous]";

        AUDIT.info("{} {:<45} {}  ip={}  status={}  {}ms",
                method,
                uri,
                actor,
                ip,
                status,
                elapsed);
    }

    private String resolveClientIp(HttpServletRequest req) {
        String xff = req.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) {
            return xff.split(",")[0].trim();
        }
        return req.getRemoteAddr();
    }
}
