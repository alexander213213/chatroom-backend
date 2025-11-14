package net.vornyx.chatroom.repositories;

import java.util.List;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import net.vornyx.chatroom.entities.Reaction;

public interface ReactionRepository extends JpaRepository<Reaction, Long> {

    // Get all Reactions in a room
    List<Reaction> findByReactionId_MessageId(Long messageId);

    // Get all Reactions from a specific user
    List<Reaction> findByReactionId_UserId(Integer userId);

    // Reactions after a specific Reaction ID
    List<Reaction> findByReactionId_MessageIdAndIdGreaterThan(Integer messageId, Long id);

    List<Reaction> findByReactionId_MessageIdOrderByIdDesc(Integer messageId, Pageable pageable);

    List<Reaction> findByReactionId_MessageIdAndIdLessThanOrderByIdDesc(Integer messageId, Integer id, Pageable pageable);

    void deleteAllByReactionId_MessageId(Integer messageId);
}
