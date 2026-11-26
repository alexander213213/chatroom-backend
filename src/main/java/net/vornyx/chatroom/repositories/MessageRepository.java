package net.vornyx.chatroom.repositories;

import java.util.List;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import net.vornyx.chatroom.entities.Message;

public interface MessageRepository extends JpaRepository<Message, Long> {

    // Get all messages in a room
    List<Message> findByMessageId_RoomId(Integer roomId);

    // Get all messages from a specific user
    List<Message> findByMessageId_UserId(Integer userId);

    // Messages after a specific message ID
    List<Message> findByMessageId_RoomIdAndIdGreaterThan(Integer roomId, Long id);

    List<Message> findByMessageId_RoomIdOrderByIdDesc(Integer roomId, Pageable pageable);

    List<Message> findByMessageId_RoomIdAndIdLessThanOrderByIdDesc(Integer roomId, Integer id, Pageable pageable);

    void deleteAllByMessageId_RoomId(Integer roomId);

    // Replies point at their parent via FK; detach them before the parent is deleted
    @Modifying
    @Query("update Message m set m.replyTo = null where m.replyTo.id = :id")
    void clearRepliesTo(@Param("id") Long id);

    @Modifying
    @Query("update Message m set m.replyTo = null where m.messageId.roomId = :roomId")
    void clearRepliesInRoom(@Param("roomId") Integer roomId);
}
