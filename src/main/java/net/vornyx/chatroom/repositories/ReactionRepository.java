package net.vornyx.chatroom.repositories;

import java.util.List;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import net.vornyx.chatroom.entities.Reaction;

public interface ReactionRepository extends JpaRepository<Reaction, Long> {


    // Get all Reactions in a room
    Reaction findByReactionId_MessageId(Long messageId);

    // Get all Reactions from a specific user
    Reaction findByReactionId_UserId(Integer userId);

    Reaction findByReactionId_UserIdAndReactionId_MessageId(Integer userId, Long messageId);
    // Get all Reactions in a room
    List<Reaction> findAllByReactionId_MessageId(Long messageId);

    // Get all Reactions from a specific user
    List<Reaction> findAllByReactionId_UserId(Integer userId);
    // Reactions after a specific Reaction ID
    List<Reaction> findByReactionId_MessageIdAndIdGreaterThan(Integer messageId, Long id);

    List<Reaction> findByReactionId_MessageIdOrderByIdDesc(Integer messageId, Pageable pageable);

    List<Reaction> findByReactionId_MessageIdAndIdLessThanOrderByIdDesc(Integer messageId, Integer id, Pageable pageable);

    void deleteByReactionId_UserIdAndReactionId_MessageId(Integer userId, Long messageId);

    void deleteAllByReactionId_MessageId(Long messageId);

    @Modifying
    @Query("delete from Reaction r where r.reactionId.messageId in (select m.id from Message m where m.messageId.roomId = :roomId)")
    void deleteAllInRoom(@Param("roomId") Integer roomId);
}
