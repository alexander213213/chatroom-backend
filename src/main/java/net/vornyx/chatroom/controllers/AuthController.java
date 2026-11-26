package net.vornyx.chatroom.controllers;

import java.time.Duration;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import jakarta.servlet.http.HttpServletResponse;
import net.vornyx.chatroom.dto.UserDto;
import net.vornyx.chatroom.entities.User;
import net.vornyx.chatroom.repositories.UserRepository;
import net.vornyx.chatroom.util.JwtService;

@RestController
@RequestMapping("/auth")
public class AuthController {

    private final PasswordEncoder passwordEncoder;
    private final UserRepository userRepository;
    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;

    @Value("${chatroom.cookie.secure:false}") // set true when served over HTTPS
    private boolean secureCookie;

    public AuthController(AuthenticationManager authenticationManager, UserRepository userRepository, JwtService jwtService, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.authenticationManager = authenticationManager;
        this.jwtService = jwtService;
        this.passwordEncoder = passwordEncoder;
    }

    @PostMapping("/register")
    public ResponseEntity<String> register(@RequestBody UserDto dto) {
        // Usernames end up in avatar filenames and in the chat UI, so keep them plain
        if (dto.getUsername() == null || !dto.getUsername().matches("[A-Za-z0-9_.-]{3,32}") || dto.getUsername().contains("..")) {
            return ResponseEntity.badRequest().body("Username must be 3-32 characters: letters, digits, _ . -");
        }
        if (dto.getPassword() == null || dto.getPassword().length() < 8 || dto.getPassword().length() > 72) {
            return ResponseEntity.badRequest().body("Password must be 8-72 characters");
        }
        if (userRepository.findByUsername(dto.getUsername()).isPresent()) {
            return ResponseEntity.status(409).body("Username Already Exists");
        }

        User user = new User();
        user.setUsername(dto.getUsername());
        user.setPassword(passwordEncoder.encode(dto.getPassword()));
        userRepository.save(user);
        return ResponseEntity.ok("User Registered Successfully");
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody UserDto dto, HttpServletResponse response) {
        Authentication auth;
        try {
            auth = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(dto.getUsername(), dto.getPassword())
            );
        } catch (AuthenticationException e) {
            return ResponseEntity.status(401).body("Invalid username or password");
        }

        User user = (User) auth.getPrincipal();
        String token = jwtService.generateToken(user);

        response.addHeader(HttpHeaders.SET_COOKIE, jwtCookie(token, Duration.ofHours(24)).toString());

        return ResponseEntity.ok(token);
    }

    @PostMapping("/logout")
    public ResponseEntity<String> logout(HttpServletResponse response) {

        response.addHeader(HttpHeaders.SET_COOKIE, jwtCookie("", Duration.ZERO).toString());

        return ResponseEntity.ok("Logged out successfully");
    }

    // SameSite=Strict stops other sites from riding the cookie (CSRF protection is off)
    private ResponseCookie jwtCookie(String value, Duration maxAge) {
        return ResponseCookie.from("jwt", value)
                .httpOnly(true)
                .secure(secureCookie)
                .sameSite("Strict")
                .path("/")
                .maxAge(maxAge)
                .build();
    }

}
