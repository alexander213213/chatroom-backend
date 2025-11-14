package net.vornyx.chatroom.dto;

import java.time.LocalDateTime;
import java.util.List;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import net.vornyx.chatroom.entities.Message;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class MessageResponseDto {
    private Long id;
    private String username;
    private String content;
    private LocalDateTime timestamp;
    private Integer roomId;
    private Message replyTo;
    private List<ReactMessageDto> reactions; 

    public MessageResponseDto(Message message, String username) {
        this.id = message.getId();
        this.username = username;
        this.content = message.getContent();
        this.timestamp = message.getCreated_at();
        this.roomId = message.getMessageId().getRoomId();
        this.replyTo = message.getReplyTo();
    }
}