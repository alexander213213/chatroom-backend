package net.vornyx.chatroom.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class SendMessageDto {
    private Integer roomId;
    private String username;
    private String content;
    private Long replyTo;
}