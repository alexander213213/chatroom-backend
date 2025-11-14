package net.vornyx.chatroom.entities;

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
@Table(name="reactions")
@Getter
@Setter
public class Reaction {
    @Id
    @GeneratedValue(strategy=GenerationType.IDENTITY)
    private Long id;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String emoji;

    @Embedded
    private ReactionId reactionId;

    public Reaction() {
    }

    public Reaction(ReactionId reactionId, String emoji) {
        this.reactionId = reactionId;
        this.emoji = emoji;
    }

}