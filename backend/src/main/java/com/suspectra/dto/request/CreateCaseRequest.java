package com.suspectra.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class CreateCaseRequest {

    @NotBlank(message = "Case title is required")
    @Size(min = 3, max = 500, message = "Title must be between 3 and 500 characters")
    private String title;

    @Size(max = 5000, message = "Description too long")
    private String description;
}
