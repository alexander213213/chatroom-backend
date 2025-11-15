package net.vornyx.chatroom.entities;

import java.io.Serializable;

import jakarta.persistence.Embeddable;

@Embeddable
public class NoteId implements Serializable {

    private Integer userId;
    private Integer roomId;

    public NoteId() {
    }

    public NoteId(Integer userId, Integer roomId) {
        this.userId = userId;
        this.roomId = roomId;
    }

    // getters & setters
    public Integer getUserId() {
        return userId;
    }

    public void setUserId(Integer userId) {
        this.userId = userId;
    }

    public Integer getRoomId() {
        return roomId;
    }

    public void setRoomId(Integer roomId) {
        this.roomId = roomId;
    }

    // equals & hashCode
    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof NoteId)) {
            return false;
        }
        NoteId that = (NoteId) o;
        return userId.equals(that.userId) && roomId.equals(that.roomId);
    }

    @Override
    public int hashCode() {
        return userId.hashCode() ^ roomId.hashCode();
    }
}
