package net.vornyx.chatroom.dto;

public record SendMessageDto(
        String content,
        Integer replyTo
) {}