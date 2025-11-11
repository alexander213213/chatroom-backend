package net.vornyx.chatroom.repositories;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import net.vornyx.chatroom.entities.Room;
import net.vornyx.chatroom.entities.RoomMember;
import net.vornyx.chatroom.entities.RoomMemberId;
import net.vornyx.chatroom.entities.User;

public interface RoomMemberRepository extends JpaRepository<RoomMember, RoomMemberId> {

    // Optional helpful query methods:
    boolean existsByUserAndRoom(User user, Room room);
    List<RoomMember> findByRoom(Room room);
    List<RoomMember> findByUser(User user);
}