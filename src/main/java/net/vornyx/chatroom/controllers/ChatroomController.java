package net.vornyx.chatroom.controllers;

import java.util.Collections;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import jakarta.transaction.Transactional;
import net.vornyx.chatroom.entities.Message;
import net.vornyx.chatroom.entities.Room;
import net.vornyx.chatroom.entities.RoomMember;
import net.vornyx.chatroom.entities.User;
import net.vornyx.chatroom.repositories.MessageRepository;
import net.vornyx.chatroom.repositories.RoomMemberRepository;
import net.vornyx.chatroom.repositories.RoomRepository;
import net.vornyx.chatroom.repositories.UserRepository;

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

    @PostMapping("/")
    public ResponseEntity<String> newRoom(@AuthenticationPrincipal User user, @RequestBody Room room) {
        Room savedRoom = roomRepository.save(room);

        RoomMember roomMember = new RoomMember(user, savedRoom);

        roomMemberRepository.save(roomMember);

        return ResponseEntity.ok("Room Created Successfully");
    }

    @GetMapping("/")
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
    public ResponseEntity invite(@AuthenticationPrincipal User user, @PathVariable Integer roomId, @RequestBody List<String> usernames) {
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
    public ResponseEntity<List<Message>> getMessages(
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
            // Load newest messages
            messages = messageRepository
                    .findByRoomOrderByIdDesc(room, PageRequest.of(0, limit));
        } else {
            // Load messages *before* given id
            messages = messageRepository
                    .findByRoomAndIdLessThanOrderByIdDesc(room, before, PageRequest.of(0, limit));
        }

        // Return in normal chronological order
        Collections.reverse(messages);

        return ResponseEntity.ok(messages);
    }

}
