package net.vornyx.chatroom.repositories;


import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import net.vornyx.chatroom.entities.Message;


public interface MessageRepository extends JpaRepository<Message, Long> {
    List<Message> findByRoomIdOrderByCreatedAtAsc(Integer roomId);
}