package net.vornyx.chatroom.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import net.vornyx.chatroom.entities.Reaction;
import net.vornyx.chatroom.util.Operation;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class ReactMessageDto {
    private Long messageId;
    private String username;
    private String emoji;
    private Operation type;

    public ReactMessageDto(Reaction reaction, String username, String emoji) {
        this.messageId = reaction.getReactionId().getMessageId();
        this.username = username;
        this.emoji = reaction.getEmoji();
    }

}