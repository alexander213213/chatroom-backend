package net.vornyx.chatroom.entities;

import java.time.LocalDateTime;

import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

import jakarta.persistence.Column;
import jakarta.persistence.Embedded;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "messages")
@Getter
@Setter
public class Message {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id; // auto-incremented message ID

    @Embedded
    private MessageId messageId;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String content;

    @ManyToOne
    @JoinColumn(name = "reply_to", nullable=true) // FK -> messages.id
    @OnDelete(action = OnDeleteAction.CASCADE)
    private Message replyTo;
    

    private LocalDateTime created_at;

    public Message() {
    }

    public Message(MessageId messageId, String content) {
        this.messageId = messageId;
        this.content = content;
    }
}
