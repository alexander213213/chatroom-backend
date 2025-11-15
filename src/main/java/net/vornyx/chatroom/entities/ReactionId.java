package net.vornyx.chatroom.entities;

import java.io.Serializable;

import jakarta.persistence.Embeddable;

@Embeddable
public class ReactionId implements Serializable {

    private Integer userId;
    private Long messageId;

    public ReactionId() {
    }

    public ReactionId(Integer userId, Long messageId) {
        this.userId = userId;
        this.messageId = messageId;
    }

    // getters & setters
    public Integer getUserId() {
        return userId;
    }

    public void setUserId(Integer userId) {
        this.userId = userId;
    }

    public Long getMessageId() {
        return messageId;
    }

    public void setMessageId(Long messageId) {
        this.messageId = messageId;
    }

    // equals & hashCode
    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof ReactionId)) {
            return false;
        }
        ReactionId that = (ReactionId) o;
        return userId.equals(that.userId) && messageId.equals(that.messageId);
    }

    @Override
    public int hashCode() {
        return userId.hashCode() ^ messageId.hashCode();
    }
}
