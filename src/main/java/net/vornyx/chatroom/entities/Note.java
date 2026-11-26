package net.vornyx.chatroom.entities;

import java.time.LocalDateTime;

import org.hibernate.annotations.CreationTimestamp;

import jakarta.persistence.Column;
import jakarta.persistence.Embedded;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "notes")
@Getter
@Setter
public class Note {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id; // auto-incremented message ID

    @Embedded
    private NoteId noteId;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String content;


    // Set by Hibernate on insert; nothing else assigns it, so it was saved as NULL
    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime created_at;

    public Note() {
    }

    public Note(NoteId noteId, String content) {
        this.noteId = noteId;
        this.content = content;
    }
}
