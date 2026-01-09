package net.vornyx.chatroom.controllers;

import java.util.Collections;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import jakarta.transaction.Transactional;
import net.vornyx.chatroom.dto.MessageResponseDto;
import net.vornyx.chatroom.dto.NoteDto;
import net.vornyx.chatroom.dto.ReactMessageDto;
import net.vornyx.chatroom.entities.Message;
import net.vornyx.chatroom.entities.Note;
import net.vornyx.chatroom.entities.Reaction;
import net.vornyx.chatroom.entities.Room;
import net.vornyx.chatroom.entities.RoomMember;
import net.vornyx.chatroom.entities.User;
import net.vornyx.chatroom.repositories.MessageRepository;
import net.vornyx.chatroom.repositories.NoteRepository;
import net.vornyx.chatroom.repositories.ReactionRepository;
import net.vornyx.chatroom.repositories.RoomMemberRepository;
import net.vornyx.chatroom.repositories.RoomRepository;
import net.vornyx.chatroom.repositories.UserRepository;
import net.vornyx.chatroom.util.Operation;

@Transactional
@RestController
@RequestMapping("/rooms")
class ChatroomController {

    @Autowired
    private RoomRepository roomRepository;

    @Autowired
    private RoomMemberRepository roomMemberRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private MessageRepository messageRepository;

    @Autowired
    private ReactionRepository reactionRepository;

    @Autowired
    private NoteRepository noteRepository;

    @PostMapping("")
    public ResponseEntity<String> newRoom(@AuthenticationPrincipal User user, @RequestBody Room room) {
        room.setUser(user);
        Room savedRoom = roomRepository.save(room);
 
        RoomMember roomMember = new RoomMember(user, savedRoom);

        roomMemberRepository.save(roomMember);

        return ResponseEntity.ok("Room Created Successfully");
    }

    @GetMapping("")
    public ResponseEntity<List<Room>> roomList(@AuthenticationPrincipal User user) {
        List<RoomMember> roomMemberList = roomMemberRepository.findByUser(user);
        List<Room> roomList = roomMemberList.stream().map(RoomMember::getRoom).toList();
        return ResponseEntity.ok(roomList);
    }

    @GetMapping("/{roomId}")
    public List<String> userList(@AuthenticationPrincipal User user, @PathVariable Integer roomId) {
        Room room = roomRepository.findById(roomId).orElseThrow(() -> new RuntimeException("Room not found"));

        List<RoomMember> roomMembers = roomMemberRepository.findByRoom(room);
        List<String> usernameList = roomMembers.stream().map(roomMember -> roomMember.getUser().getUsername()).toList();
        return usernameList;
    }

    @PostMapping("/{roomId}/invite")
    public ResponseEntity<?> invite(@AuthenticationPrincipal User user, @PathVariable Integer roomId, @RequestBody List<String> usernames) {
        Room room = roomRepository.findById(roomId).orElseThrow(() -> new RuntimeException("Room not found"));
        List<User> userList = userRepository.findAllByUsernameIn(usernames);
        Set<User> existingMembers = roomMemberRepository.findByRoom(room)
                .stream()
                .map(RoomMember::getUser)
                .collect(Collectors.toSet());

        List<RoomMember> newMembers = userList.stream()
                .filter(u -> !existingMembers.contains(u))
                .map(u -> new RoomMember(u, room))
                .toList();

        roomMemberRepository.saveAll(newMembers);

        return ResponseEntity.ok("Users Successfully Added To Room");
    }

    @GetMapping("/{roomId}/messages")
    public ResponseEntity<List<MessageResponseDto>> getMessages(
            @AuthenticationPrincipal User user,
            @PathVariable Integer roomId,
            @RequestParam(required = false) Integer before,
            @RequestParam(defaultValue = "20") int limit
    ) {
        Room room = roomRepository.findById(roomId)
                .orElseThrow(() -> new RuntimeException("Room not found"));

        boolean isMember = roomMemberRepository.existsByUserAndRoom(user, room);
        if (!isMember) {
            return ResponseEntity.status(403).body(null);
        }

        List<Message> messages;

        if (before == null) {
            messages = messageRepository
                    .findByMessageId_RoomIdOrderByIdDesc(room.getId(), PageRequest.of(0, limit));
        } else {
            messages = messageRepository
                    .findByMessageId_RoomIdAndIdLessThanOrderByIdDesc(room.getId(), before, PageRequest.of(0, limit));
        }

        Collections.reverse(messages);

        // Convert to DTOs with usernames
        List<MessageResponseDto> responseDtos = messages.stream()
            .map(message -> {
                User messageUser = userRepository.findById(message.getMessageId().getUserId())
                        .orElseThrow(() -> new RuntimeException("User not found"));

                // Fetch reactions for this message
                List<Reaction> reactions = reactionRepository.findAllByReactionId_MessageId(message.getId());

                List<ReactMessageDto> reactionDtos = reactions.stream()
                        .map(reaction -> {
                            User reactionUser = userRepository.findById(reaction.getReactionId().getUserId())
                                    .orElseThrow(() -> new RuntimeException("User not found"));
                            return new ReactMessageDto(reaction, reactionUser.getUsername(), reaction.getEmoji());
                        })
                        .toList();
                MessageResponseDto response = new MessageResponseDto(message, messageUser.getUsername());
                response.setReactions(reactionDtos);
                return response;
            })
            .toList();

        return ResponseEntity.ok(responseDtos);
    }

    @GetMapping("/{roomId}/notes")
    public ResponseEntity<List<NoteDto>> getNotes(
            @AuthenticationPrincipal User user,
            @PathVariable Integer roomId,
            @RequestParam(required = false) Integer before,
            @RequestParam(defaultValue = "20") int limit
    ) {
        Room room = roomRepository.findById(roomId)
                .orElseThrow(() -> new RuntimeException("Room not found"));

        boolean isMember = roomMemberRepository.existsByUserAndRoom(user, room);
        if (!isMember) {
            return ResponseEntity.status(403).body(null);
        }

        List<Note> Notes;

        if (before == null) {
            Notes = noteRepository
                    .findByNoteId_RoomIdOrderByIdDesc(room.getId(), PageRequest.of(0, limit));
        } else {
            Notes = noteRepository
                    .findByNoteId_RoomIdAndIdLessThanOrderByIdDesc(room.getId(), before, PageRequest.of(0, limit));
        }

        Collections.reverse(Notes);

        // Convert to DTOs with usernames
        List<NoteDto> noteDtos = Notes.stream()
            .map(Note -> {
                User noteUser = userRepository.findById(Note.getNoteId().getUserId())
                        .orElseThrow(() -> new RuntimeException("User not found"));

            
                NoteDto response = new NoteDto(Note.getId(),roomId, noteUser.getUsername(), Operation.NONE, Note.getContent());
                return response;
            })
            .toList();

        return ResponseEntity.ok(noteDtos);
    }

    @DeleteMapping("/{roomId}")
    public ResponseEntity<String> deleteRoom(@AuthenticationPrincipal User user, @PathVariable Integer roomId) {
        if (!user.getId().equals(roomRepository.findById(roomId).get().getUser().getId())) {
            return ResponseEntity.status(403).body("User is not the owner of room");
        }
        messageRepository.deleteAllByMessageId_RoomId(roomId);
        roomMemberRepository.deleteAllById_RoomId(roomId);
        roomRepository.deleteById(roomId);
        return ResponseEntity.ok("Room successfully deleted");
    }

}
