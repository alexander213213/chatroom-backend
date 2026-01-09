package net.vornyx.chatroom.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import net.vornyx.chatroom.util.Operation;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class NoteDto {
    private Long id;
    private Integer roomId;
    private String username;
    private Operation type;
    private String content;
}