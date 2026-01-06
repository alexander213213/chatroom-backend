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
public class AttachmentUploadResponse {
    
    private String filename;
    
    @JsonProperty("original_filename")
    private String originalFilename;
    
    @JsonProperty("room_num")
    private Long roomNum;
    
    private Long size;
    
    @JsonProperty("content_type")
    private String contentType;
    
    @JsonProperty("download_url")
    private String downloadUrl;
    
    @JsonProperty("uploaded_at")
    private LocalDateTime uploadedAt;
    
    @JsonProperty("uploaded_by")
    private String uploadedBy;
}