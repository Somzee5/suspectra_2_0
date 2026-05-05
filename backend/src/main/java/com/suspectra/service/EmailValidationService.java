package com.suspectra.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import javax.naming.NamingException;
import javax.naming.directory.Attributes;
import javax.naming.directory.InitialDirContext;
import java.util.Hashtable;

@Service
@Slf4j
public class EmailValidationService {

    public void validateEmailDomain(String email) {
        String domain = email.substring(email.indexOf('@') + 1);
        if (!hasMxRecord(domain)) {
            log.warn("Email domain validation failed for domain: {}", domain);
            throw new IllegalArgumentException("Email address does not appear to be deliverable: " + email);
        }
    }

    private boolean hasMxRecord(String domain) {
        try {
            Hashtable<String, String> env = new Hashtable<>();
            env.put("java.naming.factory.initial", "com.sun.jndi.dns.DnsContextFactory");
            env.put("com.sun.jndi.dns.timeout.initial", "3000");
            env.put("com.sun.jndi.dns.timeout.retries", "1");

            InitialDirContext ctx = new InitialDirContext(env);
            Attributes attrs = ctx.getAttributes(domain, new String[]{"MX"});
            javax.naming.NamingEnumeration<?> mx = attrs.get("MX") != null
                    ? attrs.get("MX").getAll()
                    : null;
            return mx != null && mx.hasMore();
        } catch (NamingException e) {
            log.debug("MX lookup failed for domain {}: {}", domain, e.getMessage());
            return false;
        }
    }
}
