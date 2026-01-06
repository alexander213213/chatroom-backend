package net.vornyx.chatroom.dto;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonProperty;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RoomAttachmentsResponse {
    
    @JsonProperty("room_num")
    private Long roomNum;
    
    private Integer count;
    
    @JsonProperty("total_size")
    private Long totalSize;
    
    private List<FileMetadata> attachments;
}