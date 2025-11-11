package net.vornyx.chatroom.entities;

import java.io.Serializable;

import jakarta.persistence.Embeddable;


@Embeddable
public class RoomMemberId implements Serializable{
    private Integer userId;
    private Integer roomId;

    public RoomMemberId() {
    }

    

    public RoomMemberId(Integer userId, Integer roomId) {
        this.userId = userId;
        this.roomId = roomId;
    }



    public Integer getUserId() {
        return this.userId;
    }
    public Integer getRoomId() {
        return this.roomId;
    }
    public void setUserId(Integer userId) {
        this.userId = userId;
    }
    public void setRoomId(Integer roomId) {
        this.roomId = roomId;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof RoomMemberId)) return false;
        RoomMemberId that = (RoomMemberId) o;
        return userId.equals(that.userId) && roomId.equals(that.roomId);
    }

    @Override
    public int hashCode() {
        return userId.hashCode() ^ roomId.hashCode();
    }


}