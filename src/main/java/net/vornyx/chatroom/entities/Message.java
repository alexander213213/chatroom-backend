package net.vornyx.chatroom.entities;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;


@Entity
@Table(name="messages")
public class Message {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY)
    private Long id;

    private Integer roomId;
    private Integer userId;

    @Column(columnDefinition = "TEXT")
    private String content;

    private Instant createdAt = Instant.now();
}