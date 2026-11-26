package net.vornyx.chatroom.controllers;

import java.security.Principal;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Controller;

import jakarta.transaction.Transactional;
import net.vornyx.chatroom.dto.MessageDto;
import net.vornyx.chatroom.dto.NoteDto;
import net.vornyx.chatroom.dto.ReactMessageDto;
import net.vornyx.chatroom.dto.TypingDto;
import net.vornyx.chatroom.entities.Message;
import net.vornyx.chatroom.entities.MessageId;
import net.vornyx.chatroom.entities.Note;
import net.vornyx.chatroom.entities.NoteId;
import net.vornyx.chatroom.entities.Reaction;
import net.vornyx.chatroom.entities.ReactionId;
import net.vornyx.chatroom.entities.Room;
import net.vornyx.chatroom.entities.User;
import net.vornyx.chatroom.repositories.MessageRepository;
import net.vornyx.chatroom.repositories.NoteRepository;
import net.vornyx.chatroom.repositories.ReactionRepository;
import net.vornyx.chatroom.repositories.RoomMemberRepository;
import net.vornyx.chatroom.repositories.RoomRepository;
import net.vornyx.chatroom.repositories.UserRepository;
import net.vornyx.chatroom.util.Operation;
@Transactional
@Controller
public class ChatWebSocketController {
    private static final int MAX_CONTENT = 4000;

    @Autowired
    private MessageRepository messageRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RoomRepository roomRepository;

    @Autowired
    private RoomMemberRepository roomMemberRepository;

    @Autowired
    private ReactionRepository reactionRepository;

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    @Autowired
    private NoteRepository noteRepository;

    // Identity comes from the authenticated WebSocket session, never from the payload
    private User requireMember(Principal principal, Integer roomId) {
        if (principal == null) {
            throw new AccessDeniedException("Not authenticated");
        }
        User user = userRepository.findByUsername(principal.getName())
                .orElseThrow(() -> new AccessDeniedException("User not found"));
        Room room = roomRepository.findById(roomId).orElseThrow(() -> new IllegalArgumentException("Room not found"));
        if (!roomMemberRepository.existsByUserAndRoom(user, room)) {
            throw new AccessDeniedException("Not a member of this room");
        }
        return user;
    }

    private static void requireContent(String content) {
        if (content == null || content.isBlank() || content.length() > MAX_CONTENT) {
            throw new IllegalArgumentException("Content must be 1-" + MAX_CONTENT + " characters");
        }
    }

    private Message messageInRoom(Long id, Integer roomId) {
        Message message = id == null ? null : messageRepository.findById(id).orElse(null);
        if (message == null || !roomId.equals(message.getMessageId().getRoomId())) {
            throw new IllegalArgumentException("Message not found in this room");
        }
        return message;
    }

    private static void requireOwner(Message message, User user) {
        if (!user.getId().equals(message.getMessageId().getUserId())) {
            throw new AccessDeniedException("Not your message");
        }
    }

    @MessageMapping("/rooms/{roomId}/message")
    public void sendMessage(Principal principal, @Payload MessageDto messageDto, @DestinationVariable Integer roomId) {
        User user = requireMember(principal, roomId);
        messageDto.setUsername(user.getUsername());
        messageDto.setRoomId(roomId);

        if (messageDto.getType() == Operation.POST) {
            requireContent(messageDto.getContent());
            Message message = new Message(new MessageId(user.getId(), roomId), messageDto.getContent());
            if (messageDto.getReplyTo() != null) {
                message.setReplyTo(messageInRoom(messageDto.getReplyTo(), roomId));
            }
            messageDto.setId(messageRepository.save(message).getId());
            messagingTemplate.convertAndSend("/topic/" + roomId + "/messages", messageDto);
        } else if (messageDto.getType() == Operation.UPDATE) {
            requireContent(messageDto.getContent());
            Message message = messageInRoom(messageDto.getId(), roomId);
            requireOwner(message, user);
            message.setContent(messageDto.getContent());
            messageRepository.save(message);
            messageDto.setReplyTo(message.getReplyTo() == null ? null : message.getReplyTo().getId());
            messagingTemplate.convertAndSend("/topic/" + roomId + "/messages", messageDto);
        } else if (messageDto.getType() == Operation.DELETE) {
            Message message = messageInRoom(messageDto.getId(), roomId);
            requireOwner(message, user);
            reactionRepository.deleteAllByReactionId_MessageId(message.getId());
            messageRepository.clearRepliesTo(message.getId());
            messageRepository.delete(message);
            messagingTemplate.convertAndSend("/topic/" + roomId + "/messages", messageDto);
        }
    }

    @MessageMapping("/rooms/{roomId}/react")
    public void react(Principal principal, @Payload ReactMessageDto reactionDto, @DestinationVariable Integer roomId) {
        User user = requireMember(principal, roomId);
        reactionDto.setUsername(user.getUsername());
        messageInRoom(reactionDto.getMessageId(), roomId);

        if (reactionDto.getType() == Operation.POST || reactionDto.getType() == Operation.UPDATE) {
            String emoji = reactionDto.getEmoji();
            // An emoji is a few code points; block markup and quote characters outright
            if (emoji == null || emoji.isBlank() || emoji.length() > 16 || emoji.matches(".*[<>\"'&\\\\`].*")) {
                throw new IllegalArgumentException("Invalid emoji");
            }
            Reaction reaction = reactionRepository.findByReactionId_UserIdAndReactionId_MessageId(user.getId(), reactionDto.getMessageId());
            if (reaction == null) {
                if (reactionDto.getType() == Operation.UPDATE) {
                    return;
                }
                reaction = new Reaction(new ReactionId(user.getId(), reactionDto.getMessageId()), emoji);
            } else if (reactionDto.getType() == Operation.POST) {
                return; // one reaction per user per message
            }
            reaction.setEmoji(emoji);
            reactionRepository.save(reaction);
            messagingTemplate.convertAndSend("/topic/" + roomId + "/reactions", reactionDto);
        } else if (reactionDto.getType() == Operation.DELETE) {
            reactionRepository.deleteByReactionId_UserIdAndReactionId_MessageId(user.getId(), reactionDto.getMessageId());
            messagingTemplate.convertAndSend("/topic/" + roomId + "/reactions", reactionDto);
        }
    }

    @MessageMapping("/rooms/{roomId}/typing")
    public void typing(Principal principal, @Payload TypingDto typingDto, @DestinationVariable Integer roomId) {
        User user = requireMember(principal, roomId);
        typingDto.setUsername(user.getUsername());
        messagingTemplate.convertAndSend("/topic/" + roomId + "/typing", typingDto);
    }

    @MessageMapping("/rooms/{roomId}/note")
    public void note(Principal principal, @Payload NoteDto noteDto, @DestinationVariable Integer roomId) {
        User user = requireMember(principal, roomId);
        noteDto.setUsername(user.getUsername());
        noteDto.setRoomId(roomId);

        if (noteDto.getType() == Operation.POST) {
            requireContent(noteDto.getContent());
            Note note = new Note(new NoteId(user.getId(), roomId), noteDto.getContent());
            noteDto.setId(noteRepository.save(note).getId());
            messagingTemplate.convertAndSend("/topic/" + roomId + "/notes", noteDto);
        } else if (noteDto.getType() == Operation.UPDATE || noteDto.getType() == Operation.DELETE) {
            Note note = noteDto.getId() == null ? null : noteRepository.findById(noteDto.getId()).orElse(null);
            if (note == null || !roomId.equals(note.getNoteId().getRoomId())) {
                throw new IllegalArgumentException("Note not found in this room");
            }
            if (!user.getId().equals(note.getNoteId().getUserId())) {
                throw new AccessDeniedException("Not your note");
            }
            if (noteDto.getType() == Operation.UPDATE) {
                requireContent(noteDto.getContent());
                note.setContent(noteDto.getContent());
                noteRepository.save(note);
            } else {
                noteRepository.delete(note);
            }
            messagingTemplate.convertAndSend("/topic/" + roomId + "/notes", noteDto);
        }
    }

}
