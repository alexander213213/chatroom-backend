package net.vornyx.chatroom.controllers;

import java.time.LocalDateTime;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
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
import net.vornyx.chatroom.entities.User;
import net.vornyx.chatroom.repositories.MessageRepository;
import net.vornyx.chatroom.repositories.NoteRepository;
import net.vornyx.chatroom.repositories.ReactionRepository;
import net.vornyx.chatroom.repositories.RoomRepository;
import net.vornyx.chatroom.repositories.UserRepository;
import net.vornyx.chatroom.util.Operation;
@Transactional
@Controller
public class ChatWebSocketController {
    @Autowired
    private MessageRepository messageRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RoomRepository roomRepository;

    @Autowired
    private ReactionRepository reactionRepository;

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    @Autowired
    private NoteRepository noteRepository;


    // @SendTo("/topic/{roomId}/messages")
    @MessageMapping("/rooms/{roomId}/message")
    public void sendMessage(@AuthenticationPrincipal User sender, @Payload MessageDto messageDto, @DestinationVariable Integer roomId) {
        roomRepository.findById(roomId).orElseThrow(() -> new RuntimeException("Room not found"));
        if (messageDto.getType() == Operation.POST || messageDto.getType() == Operation.UPDATE) {
            Message message = new Message();
            message.setContent(messageDto.getContent());
            if (messageDto.getReplyTo() != null) {
                message.setReplyTo(messageRepository.findById(messageDto.getReplyTo()).get());
                System.out.println(message.getReplyTo().getContent());
            }
            User user = userRepository.findByUsername(messageDto.getUsername()).orElseThrow(() -> new RuntimeException("User not found"));
            MessageId messageId = new MessageId(user.getId(), roomId);
            message.setMessageId(messageId);
            message.setCreated_at(LocalDateTime.now());
            if (messageDto.getType() == Operation.UPDATE) {
                message.setId(messageDto.getMessageId());
            }
            messageRepository.save(message);
            messagingTemplate.convertAndSend("/topic/" + roomId + "/messages", messageDto);
        } else if (messageDto.getType() == Operation.DELETE) {
            messageRepository.deleteById(messageDto.getMessageId());
        }
    }

    @MessageMapping("/rooms/{roomId}/react")
    public void react(@AuthenticationPrincipal User sender, @Payload ReactMessageDto reactionDto, @DestinationVariable Integer roomId) {
        roomRepository.findById(roomId).orElseThrow(() -> new RuntimeException("Room not found"));
        if (reactionDto.getType() == Operation.POST) {
            if (reactionRepository.findByReactionId_UserIdAndReactionId_MessageId(roomId, reactionDto.getMessageId()) != null) {
                return;
            }
            Reaction reaction = new Reaction();
            reaction.setEmoji(reactionDto.getEmoji());
            User user = userRepository.findByUsername(reactionDto.getUsername()).orElseThrow(() -> new RuntimeException("User not found"));
            ReactionId reactionId = new ReactionId(user.getId(), reactionDto.getMessageId());
            reaction.setReactionId(reactionId);
            reactionRepository.save(reaction);
            messagingTemplate.convertAndSend("/topic/" + roomId + "/reactions", reactionDto);

        } else if (reactionDto.getType() == Operation.UPDATE) {
            Reaction reaction = reactionRepository.findByReactionId_UserIdAndReactionId_MessageId(roomId, reactionDto.getMessageId());
            reaction.setEmoji(reactionDto.getEmoji());
            reactionRepository.save(reaction);
            messagingTemplate.convertAndSend("/topic/" + roomId + "/reactions", reactionDto);
        } else if (reactionDto.getType() == Operation.DELETE) {
            User user = userRepository.findByUsername(reactionDto.getUsername()).get();
            reactionRepository.deleteByReactionId_UserIdAndReactionId_MessageId(user.getId(), reactionDto.getMessageId());
            messagingTemplate.convertAndSend("/topic/" + roomId + "/reactions", reactionDto);
        }
    }

    @MessageMapping("/rooms/{roomId}/typing")
    public void typing(@AuthenticationPrincipal User user, @Payload TypingDto typingDto, @DestinationVariable Integer roomId) {
        roomRepository.findById(roomId).orElseThrow(() -> new RuntimeException("Room not found"));
        messagingTemplate.convertAndSend("/topic/" + roomId + "/typing", typingDto);
    }

    @MessageMapping("/rooms/{roomId}/note")
    public void note(@AuthenticationPrincipal User sender, @Payload NoteDto noteDto, @DestinationVariable Integer roomId) {
        roomRepository.findById(roomId).orElseThrow(() -> new RuntimeException("Room not found"));
        User user = userRepository.findByUsername(noteDto.getUsername()).orElseThrow(() -> new RuntimeException("User not found"));
        NoteId noteId = new NoteId(user.getId(), roomId);
        Note note = new Note(noteId, noteDto.getContent());
        noteRepository.save(note);
        messagingTemplate.convertAndSend("/topic/" + roomId + "/typing", noteDto);
    }

}
