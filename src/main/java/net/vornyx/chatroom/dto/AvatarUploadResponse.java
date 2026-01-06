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
public class AvatarUploadResponse {
    
    private String filename;
    
    private String username;
    
    @JsonProperty("avatar_url")
    private String avatarUrl;
    
    @JsonProperty("thumbnail_url")
    private String thumbnailUrl;
    
    @JsonProperty("uploaded_at")
    private LocalDateTime uploadedAt;
    
    private Integer width;
    
    private Integer height;
}