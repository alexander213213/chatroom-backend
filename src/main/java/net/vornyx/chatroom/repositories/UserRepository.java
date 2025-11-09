package net.vornyx.chatroom.repositories;


import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import net.vornyx.chatroom.entities.User;


public interface UserRepository extends JpaRepository<User, Integer> {
    Optional<User> findByUsername(String username);
}