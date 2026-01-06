package net.vornyx.chatroom.dto;

import java.time.LocalDateTime;

import com.fasterxml.jackson.annotation.JsonProperty;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FileDeleteResponse {
    
    private String message;
    
    private String filename;
    
    @JsonProperty("deleted_at")
    private LocalDateTime deletedAt;
    
    private Boolean success;
}