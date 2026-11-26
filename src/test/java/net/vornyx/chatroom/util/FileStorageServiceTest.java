package net.vornyx.chatroom.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.io.IOException;
import java.nio.file.Path;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class FileStorageServiceTest {

    @TempDir
    Path base;

    @Test
    void resolvesPlainNamesInsideBase() throws IOException {
        assertEquals(base.toAbsolutePath().normalize().resolve("photo.png"),
                FileStorageService.resolveInside(base, "photo.png"));
    }

    @Test
    void rejectsPathTraversal() {
        for (String name : new String[] {"../secret.txt", "a/../../x", "/etc/passwd", "sub/file.txt", "..", ""}) {
            assertThrows(IOException.class, () -> FileStorageService.resolveInside(base, name), name);
        }
    }
}
