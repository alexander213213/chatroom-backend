package net.vornyx.chatroom.repositories;

import java.util.List;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import net.vornyx.chatroom.entities.Message;
import net.vornyx.chatroom.entities.Room;

public interface MessageRepository extends JpaRepository<Message, Long> {

    // Get all messages in a room
    List<Message> findByMessageIdRoomId(Integer roomId);

    // Get all messages from a specific user
    List<Message> findByMessageIdUserId(Integer userId);

    // Messages after a specific message ID
    List<Message> findByMessageIdRoomIdAndIdGreaterThan(Integer roomId, Long id);

    List<Message> findByRoomOrderByIdDesc(Room room, Pageable pageable);

    List<Message> findByRoomAndIdLessThanOrderByIdDesc(Room room, Integer id, Pageable pageable);
}
