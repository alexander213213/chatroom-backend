package net.vornyx.chatroom;

import java.util.TimeZone;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class ChatroomApplication {

	public static void main(String[] args) {
		// Timestamps are LocalDateTime (no zone) and the frontend reads them as UTC, so pin the JVM to UTC
		TimeZone.setDefault(TimeZone.getTimeZone("UTC"));
		SpringApplication.run(ChatroomApplication.class, args);
	}

}
