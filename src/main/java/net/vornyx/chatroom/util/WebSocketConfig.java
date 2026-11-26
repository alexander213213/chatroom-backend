package net.vornyx.chatroom.util;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

import net.vornyx.chatroom.repositories.RoomMemberRepository;
import net.vornyx.chatroom.repositories.UserRepository;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private static final Pattern ROOM_TOPIC = Pattern.compile("^/topic/(\\d+)/.*");

    private final UserRepository userRepository;
    private final RoomMemberRepository roomMemberRepository;
    private final JwtService jwtService;

    public WebSocketConfig(UserRepository userRepository, RoomMemberRepository roomMemberRepository, JwtService jwtService) {
        this.jwtService = jwtService;
        this.userRepository = userRepository;
        this.roomMemberRepository = roomMemberRepository;
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        config.enableSimpleBroker("/topic"); // Server → Clients
        config.setApplicationDestinationPrefixes("/app"); // Client → Server
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws") // Websocket endpoint
                .setAllowedOriginPatterns("*")
                .withSockJS(); // allow fallback
    }

    // Only logged-in room members may subscribe to a room's topics or send to the broker
    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(new ChannelInterceptor() {
            @Override
            public Message<?> preSend(Message<?> message, MessageChannel channel) {
                StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
                if (accessor == null) {
                    return message;
                }
                StompCommand command = accessor.getCommand();
                if (command == StompCommand.CONNECT && accessor.getUser() == null) {
                    authenticateFromHeader(accessor);
                }
                if (command != StompCommand.SUBSCRIBE && command != StompCommand.SEND) {
                    return message;
                }
                if (accessor.getUser() == null) {
                    throw new AccessDeniedException("Not authenticated");
                }
                String destination = accessor.getDestination() == null ? "" : accessor.getDestination();
                if (command == StompCommand.SEND && destination.startsWith("/topic")) {
                    throw new AccessDeniedException("Clients cannot publish to topics directly");
                }
                Matcher m = ROOM_TOPIC.matcher(destination);
                if (command == StompCommand.SUBSCRIBE) {
                    if (!m.matches() || !isMember(accessor.getUser().getName(), Integer.valueOf(m.group(1)))) {
                        throw new AccessDeniedException("Not a member of this room");
                    }
                }
                return message;
            }
        });
    }

    // The client sends "Authorization: Bearer <jwt>" in the STOMP CONNECT frame
    private void authenticateFromHeader(StompHeaderAccessor accessor) {
        String header = accessor.getFirstNativeHeader("Authorization");
        if (header == null || !header.startsWith("Bearer ")) {
            return;
        }
        try {
            String username = jwtService.extractUsername(header.substring(7));
            userRepository.findByUsername(username).ifPresent(user ->
                    accessor.setUser(new UsernamePasswordAuthenticationToken(user, null, user.getAuthorities())));
        } catch (RuntimeException e) {
            // invalid token: stay anonymous, later SUBSCRIBE/SEND are refused
        }
    }

    private boolean isMember(String username, Integer roomId) {
        return userRepository.findByUsername(username)
                .map(user -> roomMemberRepository.existsById(new net.vornyx.chatroom.entities.RoomMemberId(user.getId(), roomId)))
                .orElse(false);
    }
}
