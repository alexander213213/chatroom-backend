package net.vornyx.chatroom.repositories;

import java.util.List;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import net.vornyx.chatroom.entities.Note;

public interface NoteRepository extends JpaRepository<Note, Long> {

    // Get all Notes in a room
    List<Note> findByNoteId_RoomId(Integer roomId);

    // Get all Notes from a specific user
    List<Note> findByNoteId_UserId(Integer userId);

    // Notes after a specific Note ID
    List<Note> findByNoteId_RoomIdAndIdGreaterThan(Integer roomId, Long id);

    List<Note> findByNoteId_RoomIdOrderByIdDesc(Integer roomId, Pageable pageable);

    List<Note> findByNoteId_RoomIdAndIdLessThanOrderByIdDesc(Integer roomId, Integer id, Pageable pageable);

    void deleteAllByNoteId_RoomId(Integer roomId);
}
