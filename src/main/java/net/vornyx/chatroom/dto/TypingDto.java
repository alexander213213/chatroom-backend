package net.vornyx.chatroom.dto;

public record TypingDto(
        String username,
        boolean typing
) {}