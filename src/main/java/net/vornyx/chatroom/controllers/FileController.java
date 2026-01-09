package net.vornyx.chatroom.controllers;

import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import jakarta.servlet.http.HttpServletRequest;
import net.vornyx.chatroom.dto.FileMetadata;
import net.vornyx.chatroom.util.FileStorageService;

@RestController
@RequestMapping("/api/files")
public class FileController {

    @Autowired
    private FileStorageService fileStorageService;

    /**
     * Upload attachment to a specific room
     * Max size: 200MB
     */
    @PostMapping("/rooms/{roomNum}/attachments")
    public ResponseEntity<?> uploadAttachment(
            @PathVariable Long roomNum,
            @RequestParam("file") MultipartFile file,
            @AuthenticationPrincipal UserDetails userDetails) {
        
        try {
            // Validate file size (200MB = 200 * 1024 * 1024 bytes)
            if (file.getSize() > 200 * 1024 * 1024) {
                return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE)
                        .body(Map.of("error", "File size exceeds 200MB limit"));
            }

            if (file.isEmpty()) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "File is empty"));
            }

            String filename = fileStorageService.storeAttachment(file, roomNum);
            
            Map<String, Object> response = new HashMap<>();
            response.put("filename", filename);
            response.put("roomNum", roomNum);
            response.put("size", file.getSize());
            response.put("contentType", file.getContentType());
            
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to upload file: " + e.getMessage()));
        }
    }
    /**
     * Get list of all attachments in a specific room
     */
    @GetMapping("/rooms/{roomNum}/attachments")
    public ResponseEntity<?> listAttachments(
            @PathVariable Long roomNum,
            @AuthenticationPrincipal UserDetails userDetails) {
        
        try {
            List<FileMetadata> attachments = fileStorageService.listAttachments(roomNum);
            
            Map<String, Object> response = new HashMap<>();
            response.put("room_num", roomNum);
            response.put("attachments", attachments);
            response.put("count", attachments.size());
            
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to list attachments: " + e.getMessage()));
        }
    }

    /**
     * Download attachment from a specific room
     */
    @GetMapping("/rooms/{roomNum}/attachments/{filename:.+}")
    public ResponseEntity<Resource> downloadAttachment(
            @PathVariable Long roomNum,
            @PathVariable String filename,
            @AuthenticationPrincipal UserDetails userDetails,
            HttpServletRequest request) {
        
        try {
            Resource resource = fileStorageService.loadAttachment(filename, roomNum);
            
            // Try to determine file's content type
            String contentType = null;
            try {
                contentType = request.getServletContext().getMimeType(resource.getFile().getAbsolutePath());
            } catch (IOException ex) {
                // Fallback to default content type
            }
            
            if (contentType == null) {
                contentType = "application/octet-stream";
            }
            
            return ResponseEntity.ok()
                    .contentType(MediaType.parseMediaType(contentType))
                    .header(HttpHeaders.CONTENT_DISPOSITION, 
                            "attachment; filename=\"" + resource.getFilename() + "\"")
                    .body(resource);
                    
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }
    }

    /**
     * Upload avatar for the authenticated user
     * Automatically processes and saves as PNG
     */
    @PostMapping("/avatars")
    public ResponseEntity<?> uploadAvatar(
            @RequestParam("file") MultipartFile file,
            @AuthenticationPrincipal UserDetails userDetails) {
        
        try {
            // Validate file is an image
            String contentType = file.getContentType();
            if (contentType == null || !contentType.startsWith("image/")) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "File must be an image"));
            }

            // Limit avatar size to 10MB
            if (file.getSize() > 10 * 1024 * 1024) {
                return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE)
                        .body(Map.of("error", "Avatar size exceeds 10MB limit"));
            }

            if (file.isEmpty()) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "File is empty"));
            }

            String username = userDetails.getUsername();
            String filename = fileStorageService.storeAvatar(file, username);
            
            Map<String, Object> response = new HashMap<>();
            response.put("filename", filename);
            response.put("username", username);
            response.put("url", "/api/files/avatars/" + username);
            
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to upload avatar: " + e.getMessage()));
        }
    }

    /**
     * Get avatar for a specific user
     */
    @GetMapping("/avatars/{username}")
    public ResponseEntity<Resource> getAvatar(
            @PathVariable String username,
            @AuthenticationPrincipal UserDetails userDetails) {
        
        try {
            Resource resource = fileStorageService.loadAvatar(username);
            
            return ResponseEntity.ok()
                    .contentType(MediaType.IMAGE_PNG)
                    .header(HttpHeaders.CACHE_CONTROL, "max-age=3600")
                    .body(resource);
                    
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }
    }

    /**
     * Delete attachment from a room (optional - add authorization logic)
     */
    @DeleteMapping("/rooms/{roomNum}/attachments/{filename:.+}")
    public ResponseEntity<?> deleteAttachment(
            @PathVariable Long roomNum,
            @PathVariable String filename,
            @AuthenticationPrincipal UserDetails userDetails) {
        
        try {
            fileStorageService.deleteAttachment(filename, roomNum);
            return ResponseEntity.ok(Map.of("message", "File deleted successfully"));
            
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to delete file: " + e.getMessage()));
        }
    }

    /**
     * Delete user's avatar
     */
    @DeleteMapping("/avatars")
    public ResponseEntity<?> deleteAvatar(@AuthenticationPrincipal UserDetails userDetails) {
        
        try {
            String username = userDetails.getUsername();
            fileStorageService.deleteAvatar(username);
            return ResponseEntity.ok(Map.of("message", "Avatar deleted successfully"));
            
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to delete avatar: " + e.getMessage()));
        }
    }
}