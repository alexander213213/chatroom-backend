package net.vornyx.chatroom.controllers;

import java.util.Optional;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import net.vornyx.chatroom.dto.UserDto;
import net.vornyx.chatroom.entities.User;
import net.vornyx.chatroom.repositories.UserRepository;


@RestController
@RequestMapping("/auth")
public class AuthController {

    private final UserRepository userRepository;

    public AuthController(UserRepository userRepository) {
        this.userRepository = userRepository;
    }
    
    @PostMapping("/register")
    public ResponseEntity<String> register(@RequestBody UserDto dto) {
        if (userRepository.findByUsername(dto.getUsername()).isPresent()) {
            return ResponseEntity.status(409).body("Username Already Exist");
        }

        User user = new User();
        user.setUsername(dto.getUsername());
        user.setPassword(dto.getPassword());
        userRepository.save(user);
        return ResponseEntity.ok("User Registered Succesfully");
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody UserDto dto) {
        Optional<User> user = userRepository.findByUsername(dto.getUsername());
        if (user.isPresent()) {
            
        }
        return ResponseEntity.ok("ok");
    }

}