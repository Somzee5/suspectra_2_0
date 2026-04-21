package com.suspectra.dto.response;

import com.suspectra.entity.enums.UserRole;
import lombok.Builder;
import lombok.Data;

import java.util.UUID;

@Data
@Builder
public class AuthResponse {
    private String token;
    private UserDto user;

    @Data
    @Builder
    public static class UserDto {
        private UUID id;
        private String email;
        private String name;
        private UserRole role;
        private boolean isActive;
    }
}
