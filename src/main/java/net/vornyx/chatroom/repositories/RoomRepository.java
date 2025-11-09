package net.vornyx.chatroom.repositories;


import org.springframework.data.jpa.repository.JpaRepository;

import net.vornyx.chatroom.entities.Room;


public interface RoomRepository extends JpaRepository<Room, Integer> {}
