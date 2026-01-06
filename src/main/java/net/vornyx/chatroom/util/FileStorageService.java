package net.vornyx.chatroom.util;

import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.net.MalformedURLException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;

import javax.imageio.ImageIO;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import jakarta.annotation.PostConstruct;

@Service
public class FileStorageService {

    @Value("${file.upload.base-dir:/var/lib/chatroom}")
    private String baseDir;

    private Path roomsLocation;
    private Path avatarsLocation;

    @PostConstruct
    public void init() {
        this.roomsLocation = Paths.get(baseDir, "rooms");
        this.avatarsLocation = Paths.get(baseDir, "avatars");
        
        try {
            Files.createDirectories(roomsLocation);
            Files.createDirectories(avatarsLocation);
        } catch (IOException e) {
            throw new RuntimeException("Could not create upload directories!", e);
        }
    }

    /**
     * Store attachment in room-specific directory
     */
    public String storeAttachment(MultipartFile file, Long roomNum) throws IOException {
        String filename = StringUtils.cleanPath(file.getOriginalFilename());
        
        // Security check: prevent path traversal
        if (filename.contains("..")) {
            throw new IOException("Invalid filename: " + filename);
        }

        // Create room directory if it doesn't exist
        Path roomPath = roomsLocation.resolve(roomNum.toString());
        Files.createDirectories(roomPath);

        // Save file
        Path targetLocation = roomPath.resolve(filename);
        Files.copy(file.getInputStream(), targetLocation, StandardCopyOption.REPLACE_EXISTING);

        return filename;
    }

    /**
     * Load attachment from room
     */
    public Resource loadAttachment(String filename, Long roomNum) throws IOException {
        try {
            Path file = roomsLocation.resolve(roomNum.toString()).resolve(filename).normalize();
            Resource resource = new UrlResource(file.toUri());
            
            if (resource.exists() && resource.isReadable()) {
                return resource;
            } else {
                throw new IOException("File not found: " + filename);
            }
        } catch (MalformedURLException e) {
            throw new IOException("File not found: " + filename, e);
        }
    }

    /**
     * Store and process avatar image
     * Resizes to 256x256 and converts to PNG
     */
    public String storeAvatar(MultipartFile file, String username) throws IOException {
        // Read the uploaded image
        BufferedImage originalImage = ImageIO.read(file.getInputStream());
        
        if (originalImage == null) {
            throw new IOException("Invalid image file");
        }

        // Process image: resize to 256x256
        BufferedImage resizedImage = resizeImage(originalImage, 256, 256);

        // Save as PNG
        String filename = username + ".png";
        Path targetLocation = avatarsLocation.resolve(filename);
        
        ImageIO.write(resizedImage, "PNG", targetLocation.toFile());

        return filename;
    }

    /**
     * Load avatar for a user
     */
    public Resource loadAvatar(String username) throws IOException {
        try {
            String filename = username + ".png";
            Path file = avatarsLocation.resolve(filename).normalize();
            Resource resource = new UrlResource(file.toUri());
            
            if (resource.exists() && resource.isReadable()) {
                return resource;
            } else {
                throw new IOException("Avatar not found for user: " + username);
            }
        } catch (MalformedURLException e) {
            throw new IOException("Avatar not found for user: " + username, e);
        }
    }

    /**
     * Delete attachment from room
     */
    public void deleteAttachment(String filename, Long roomNum) throws IOException {
        Path file = roomsLocation.resolve(roomNum.toString()).resolve(filename).normalize();
        Files.deleteIfExists(file);
    }

    /**
     * Delete user's avatar
     */
    public void deleteAvatar(String username) throws IOException {
        String filename = username + ".png";
        Path file = avatarsLocation.resolve(filename).normalize();
        Files.deleteIfExists(file);
    }

    /**
     * List all attachments in a room
     */
    public java.util.List<net.vornyx.chatroom.dto.FileMetadata> listAttachments(Long roomNum) throws IOException {
        Path roomPath = roomsLocation.resolve(roomNum.toString());
        
        // If room directory doesn't exist, return empty list
        if (!Files.exists(roomPath)) {
            return java.util.Collections.emptyList();
        }

        java.util.List<net.vornyx.chatroom.dto.FileMetadata> fileList = new java.util.ArrayList<>();
        
        try (java.util.stream.Stream<Path> files = Files.list(roomPath)) {
            files.filter(Files::isRegularFile)
                 .forEach(path -> {
                     try {
                         String filename = path.getFileName().toString();
                         long size = Files.size(path);
                         String contentType = Files.probeContentType(path);
                         
                         if (contentType == null) {
                             contentType = "application/octet-stream";
                         }
                         
                         java.nio.file.attribute.BasicFileAttributes attrs = 
                             Files.readAttributes(path, java.nio.file.attribute.BasicFileAttributes.class);
                         
                         java.time.LocalDateTime uploadedAt = 
                             java.time.LocalDateTime.ofInstant(
                                 attrs.creationTime().toInstant(), 
                                 java.time.ZoneId.systemDefault()
                             );
                         
                         boolean isImage = contentType.startsWith("image/");
                         
                         net.vornyx.chatroom.dto.FileMetadata metadata = net.vornyx.chatroom.dto.FileMetadata.builder()
                                 .filename(filename)
                                 .originalFilename(filename)
                                 .size(size)
                                 .contentType(contentType)
                                 .downloadUrl("/api/files/rooms/" + roomNum + "/attachments/" + filename)
                                 .uploadedAt(uploadedAt)
                                 .uploadedBy(null) // You could store this in file metadata or database
                                 .isImage(isImage)
                                 .build();
                         
                         fileList.add(metadata);
                     } catch (IOException e) {
                         // Skip files that can't be read
                     }
                 });
        }
        
        // Sort by upload time (newest first)
        fileList.sort((a, b) -> b.getUploadedAt().compareTo(a.getUploadedAt()));
        
        return fileList;
    }

    /**
     * Resize image to specified dimensions
     * Maintains aspect ratio and centers the image
     */
    private BufferedImage resizeImage(BufferedImage originalImage, int targetWidth, int targetHeight) {
        int originalWidth = originalImage.getWidth();
        int originalHeight = originalImage.getHeight();

        // Calculate dimensions to maintain aspect ratio
        double aspectRatio = (double) originalWidth / originalHeight;
        int newWidth, newHeight;

        if (aspectRatio > 1) {
            // Landscape
            newWidth = targetWidth;
            newHeight = (int) (targetWidth / aspectRatio);
        } else {
            // Portrait or square
            newHeight = targetHeight;
            newWidth = (int) (targetHeight * aspectRatio);
        }

        // Create scaled image
        BufferedImage scaledImage = new BufferedImage(newWidth, newHeight, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g2d = scaledImage.createGraphics();
        
        // Enable high-quality rendering
        g2d.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
        g2d.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
        g2d.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        
        g2d.drawImage(originalImage, 0, 0, newWidth, newHeight, null);
        g2d.dispose();

        // Create final image with exact dimensions (crop/center if needed)
        BufferedImage finalImage = new BufferedImage(targetWidth, targetHeight, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g2dFinal = finalImage.createGraphics();
        
        // Center the image
        int x = (targetWidth - newWidth) / 2;
        int y = (targetHeight - newHeight) / 2;
        
        g2dFinal.drawImage(scaledImage, x, y, null);
        g2dFinal.dispose();

        return finalImage;
    }
}