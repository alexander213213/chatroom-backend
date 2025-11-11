package net.vornyx.chatroom.entities;

import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.MapsId;
import jakarta.persistence.Table;

@Entity
@Table(name = "room_members")
public class RoomMember {

    @EmbeddedId
    private RoomMemberId id;

    @ManyToOne
    @MapsId("userId")
    private User user;

    @ManyToOne
    @MapsId("roomId")
    private Room room;

    private java.time.LocalDateTime joinedAt;

    public RoomMember() {
    }

    public RoomMember(User user, Room room) {
        this.user = user;
        this.room = room;
        this.id = new RoomMemberId(user.getId(), room.getId());
        this.joinedAt = java.time.LocalDateTime.now();
    }

    public Room getRoom() {
        return this.room;
    }
    public User getUser() {
        return this.user;
    }

    public void setRoom(Room room) {
        this.room = room;
    }

    public void setUser(User user) {
        this.user = user;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof RoomMember)) {
            return false;
        }
        RoomMember that = (RoomMember) o;
        return id.equals(that.id);
    }

    @Override
    public int hashCode() {
        return id.hashCode();
    }

}
