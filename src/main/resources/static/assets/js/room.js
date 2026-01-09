const API_BASE = window.location.origin;
let currentRoomId = null;
let currentRoomName = '';
let currentRoomOwnerId = null;
let currentRoomOwnerUsername = null;
let messages = [];
let notes = [];
let files = [];
let replyToMessage = null;
let typingTimeout = null;
let messageSubscription = null;
let reactionSubscription = null;
let typingSubscription = null;
let noteSubscription = null;

const emojis = ['👍', '❤️', '😂', '😮', '😢', '🎉', '🔥', '👀'];

function debugLog(section, message, data = null) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [ROOM-${section}] ${message}`, data || '');
}

function displayUsername() {
    const username = window.getCurrentUser();
    const display = document.getElementById('currentUserDisplay');
    if (display) display.textContent = username;
}

async function initializeRoom() {
    debugLog('INIT', 'Initializing room');
    
    currentRoomId = sessionStorage.getItem('currentRoomId');
    
    if (!currentRoomId) {
        alert('No room selected');
        window.location.href = 'index.html';
        return;
    }
    
    await loadRoomData();
    await setupWebSocket();
    setupEventListeners();
}

async function loadRoomData() {
    debugLog('LOAD_DATA', 'Loading room data');
    
    try {
        const token = sessionStorage.getItem('authToken') || localStorage.getItem('authToken');
        
        // Load all rooms
        const roomsResponse = await fetch(`${API_BASE}/rooms`, {
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            credentials: 'include'
        });
        
        if (roomsResponse.ok) {
            const rooms = await roomsResponse.json();
            displayRoomsList(rooms);
            
            const currentRoom = rooms.find(r => r.id == currentRoomId);
            
            if (currentRoom) {
                currentRoomName = currentRoom.name;
                currentRoomOwnerId = currentRoom.user.id;
                currentRoomOwnerUsername = currentRoom.user.username;
                
                document.getElementById('chatRoomTitle').textContent = currentRoom.name;
                showChatWindow();
                
                // Show delete button only for room owner
                const currentUser = window.getCurrentUser();
                const deleteBtn = document.getElementById('deleteRoomBtn');
                if (deleteBtn) {
                    deleteBtn.style.display = currentRoomOwnerUsername === currentUser ? 'block' : 'none';
                }
            }
        }
        
        // Load room-specific data
        await Promise.all([
            loadMessages(),
            loadRoomMembers(),
            loadNotes(),
            loadFiles()
        ]);
        
    } catch (err) {
        debugLog('LOAD_DATA', 'EXCEPTION', err);
    }
}

function displayRoomsList(rooms) {
    const roomsContent = document.getElementById('roomsContent');
    if (!roomsContent) return;
    
    roomsContent.innerHTML = rooms.map(room => `
        <div class="room-item ${room.id == currentRoomId ? 'active' : ''}" data-room-id="${room.id}">
            <span class="room-icon">💼</span>
            <span>${escapeHtml(room.name)}</span>
        </div>
    `).join('');
    
    roomsContent.querySelectorAll('.room-item').forEach(item => {
        item.addEventListener('click', () => {
            const roomId = item.dataset.roomId;
            switchRoom(roomId);
        });
    });
}

function switchRoom(roomId) {
    debugLog('SWITCH', `Switching to room ${roomId}`);
    currentRoomId = roomId;
    sessionStorage.setItem('currentRoomId', roomId);
    
    // Unsubscribe from previous room
    if (messageSubscription) messageSubscription.unsubscribe();
    if (reactionSubscription) reactionSubscription.unsubscribe();
    if (typingSubscription) typingSubscription.unsubscribe();
    if (noteSubscription) noteSubscription.unsubscribe();
    
    messages = [];
    notes = [];
    files = [];
    
    loadRoomData();
    setupWebSocket();
}

async function loadMessages() {
    try {
        const token = sessionStorage.getItem('authToken') || localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}/rooms/${currentRoomId}/messages?limit=50`, {
            headers: { 'Authorization': `Bearer ${token}` },
            credentials: 'include'
        });
        
        if (response.ok) {
            messages = await response.json();
            displayMessages();
        }
    } catch (err) {
        debugLog('MESSAGES', 'EXCEPTION', err);
    }
}

async function loadRoomMembers() {
    try {
        const token = sessionStorage.getItem('authToken') || localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}/rooms/${currentRoomId}`, {
            headers: { 'Authorization': `Bearer ${token}` },
            credentials: 'include'
        });
        
        if (response.ok) {
            const members = await response.json();
            displayMembers(members);
        }
    } catch (err) {
        debugLog('MEMBERS', 'EXCEPTION', err);
    }
}

async function loadNotes() {
    try {
        const token = sessionStorage.getItem('authToken') || localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}/rooms/${currentRoomId}/notes?limit=50`, {
            headers: { 'Authorization': `Bearer ${token}` },
            credentials: 'include'
        });
        
        if (response.ok) {
            notes = await response.json();
            displayNotes();
        }
    } catch (err) {
        debugLog('NOTES', 'EXCEPTION', err);
    }
}

async function loadFiles() {
    try {
        const token = sessionStorage.getItem('authToken') || localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}/api/files/rooms/${currentRoomId}/attachments`, {
            headers: { 'Authorization': `Bearer ${token}` },
            credentials: 'include'
        });
        
        if (response.ok) {
            const data = await response.json();
            files = data.attachments || [];
            displayFiles();
        } else if (response.status === 404) {
            files = [];
            displayFiles();
        }
    } catch (err) {
        debugLog('FILES', 'EXCEPTION', err);
    }
}

function renderMarkdown(text) {
    return text
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank">$1</a>')
        .replace(/`(.+?)`/g, '<code>$1</code>')
        .replace(/\n/g, '<br>');
}

function displayMessages() {
    const container = document.getElementById('messagesContainer');
    if (!container) return;
    
    if (messages.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: var(--text-muted); font-size: 8px;">
                No messages yet. Start the conversation!
            </div>
        `;
        return;
    }
    
    container.innerHTML = messages.map(msg => {
        const isOwn = msg.username === window.getCurrentUser();
        const replyHtml = msg.replyTo ? `
            <div class="message-reply-preview">
                <strong>${escapeHtml(msg.replyTo.username)}:</strong> ${escapeHtml(msg.replyTo.content.substring(0, 50))}${msg.replyTo.content.length > 50 ? '...' : ''}
            </div>
        ` : '';
        
        const reactionsHtml = msg.reactions && msg.reactions.length > 0 ? `
            <div class="reactions-display">
                ${getGroupedReactions(msg.reactions).map(r => 
                    `<span class="reaction ${r.userReacted ? 'user-reaction' : ''}" onclick="toggleReaction(${msg.id}, '${r.emoji}')">${r.emoji}<span class="reaction-count">${r.count}</span></span>`
                ).join('')}
            </div>
        ` : '';
        
        return `
            <div class="message ${isOwn ? 'own-message' : ''}" data-message-id="${msg.id}">
                <div class="message-header">
                    <span class="message-username">${escapeHtml(msg.username)}</span>
                    <span class="message-timestamp">${formatTime(msg.timestamp)}</span>
                </div>
                ${replyHtml}
                <div class="message-content">${renderMarkdown(escapeHtml(msg.content))}</div>
                ${reactionsHtml}
                <div class="message-actions">
                    <span class="reply-btn" onclick="setReplyTo(${msg.id}, '${escapeHtml(msg.username)}', '${escapeHtml(msg.content).replace(/'/g, "\\'")}')">↩️</span>
                    <span class="reaction-btn" onclick="showEmojiPicker(${msg.id}, event)">😊</span>
                    ${isOwn ? `<span class="reaction-btn" onclick="deleteMessage(${msg.id})">🗑️</span>` : ''}
                </div>
            </div>
        `;
    }).join('');
    
    container.scrollTop = container.scrollHeight;
}

function getGroupedReactions(reactions) {
    const grouped = {};
    const currentUser = window.getCurrentUser();
    
    reactions.forEach(r => {
        if (!grouped[r.emoji]) {
            grouped[r.emoji] = { emoji: r.emoji, count: 0, userReacted: false };
        }
        grouped[r.emoji].count++;
        if (r.username === currentUser) {
            grouped[r.emoji].userReacted = true;
        }
    });
    
    return Object.values(grouped);
}

function displayMembers(members) {
    const membersList = document.getElementById('membersList');
    if (!membersList) return;
    
    membersList.innerHTML = members.map(username => `
        <li class="member-item">
            <span class="member-status ${username === window.getCurrentUser() ? 'online' : 'offline'}"></span>
            <span>${escapeHtml(username)}</span>
        </li>
    `).join('');
}

function displayNotes() {
    const notesList = document.getElementById('notesList');
    if (!notesList) return;
    
    if (notes.length === 0) {
        notesList.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-muted); font-size: 8px;">No notes yet</div>';
        return;
    }
    
    notesList.innerHTML = notes.map(note => `
        <div class="note-item" style="background: white; border: 2px solid var(--border-dark); padding: 10px; margin-bottom: 10px; border-radius: 3px;">
            <div style="font-size: 7px; color: var(--text-muted); margin-bottom: 5px; font-weight: bold;">${escapeHtml(note.username)}</div>
            <div style="font-size: 8px; line-height: 1.4;">${renderMarkdown(escapeHtml(note.content))}</div>
        </div>
    `).join('');
}

function displayFiles() {
    const filesContent = document.getElementById('filesContent');
    const filesListModal = document.getElementById('filesListModal');
    
    if (files.length === 0) {
        const emptyMsg = '<div style="text-align: center; padding: 20px; color: var(--text-muted); font-size: 8px;">No files uploaded yet</div>';
        if (filesContent) filesContent.innerHTML = emptyMsg;
        if (filesListModal) filesListModal.innerHTML = emptyMsg;
        return;
    }
    
    const filesHtml = files.map(file => {
        const icon = file.isImage ? '🖼️' : '📄';
        const sizeKB = (file.size / 1024).toFixed(1);
        return `
            <div class="file-item" onclick="downloadFile('${file.filename}')" style="cursor: pointer;">
                <div style="font-size: 32px;">${icon}</div>
                <div style="font-size: 7px; margin-top: 5px; word-break: break-all;">${escapeHtml(file.originalFilename)}</div>
                <div style="font-size: 6px; color: var(--text-muted);">${sizeKB} KB</div>
            </div>
        `;
    }).join('');
    
    if (filesContent) filesContent.innerHTML = filesHtml;
    if (filesListModal) filesListModal.innerHTML = filesHtml;
}

async function downloadFile(filename) {
    try {
        const token = sessionStorage.getItem('authToken') || localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}/api/files/rooms/${currentRoomId}/attachments/${filename}`, {
            headers: { 'Authorization': `Bearer ${token}` },
            credentials: 'include'
        });
        
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } else {
            alert('Failed to download file');
        }
    } catch (err) {
        debugLog('DOWNLOAD', 'EXCEPTION', err);
        alert('Failed to download file');
    }
}

async function setupWebSocket() {
    debugLog('WEBSOCKET', 'Setting up subscriptions');
    
    // Wait for WebSocket to be ready
    let attempts = 0;
    while (!window.isWebSocketConnected() && attempts < 10) {
        await new Promise(resolve => setTimeout(resolve, 500));
        attempts++;
    }
    
    if (!window.isWebSocketConnected()) {
        debugLog('WEBSOCKET', 'ERROR: Could not connect');
        return;
    }
    
    const stomp = window.stompClient || window.getStompClient();
    
    // Subscribe to messages
    messageSubscription = stomp.subscribe(`/topic/${currentRoomId}/messages`, (message) => {
        const msg = JSON.parse(message.body);
        handleIncomingMessage(msg);
    });
    
    // Subscribe to reactions
    reactionSubscription = stomp.subscribe(`/topic/${currentRoomId}/reactions`, (message) => {
        const reaction = JSON.parse(message.body);
        handleIncomingReaction(reaction);
    });
    
    // Subscribe to typing
    typingSubscription = stomp.subscribe(`/topic/${currentRoomId}/typing`, (message) => {
        const data = JSON.parse(message.body);
        showTypingIndicator(data);
    });
    
    // Subscribe to notes
    noteSubscription = stomp.subscribe(`/topic/${currentRoomId}/notes`, (message) => {
        const note = JSON.parse(message.body);
        handleIncomingNote(note);
    });
    
    debugLog('WEBSOCKET', 'Subscriptions complete');
}

function handleIncomingMessage(msg) {
    if (msg.type === 'DELETE') {
        messages = messages.filter(m => m.id !== msg.id);
    } else if (msg.type === 'UPDATE') {
        const index = messages.findIndex(m => m.id === msg.id);
        if (index !== -1) {
            messages[index] = { ...messages[index], ...msg };
        }
    } else {
        messages.push(msg);
    }
    displayMessages();
}

function handleIncomingReaction(reaction) {
    const msg = messages.find(m => m.id === reaction.messageId);
    if (!msg) return;
    
    if (!msg.reactions) msg.reactions = [];
    
    if (reaction.type === 'DELETE') {
        msg.reactions = msg.reactions.filter(r => 
            !(r.username === reaction.username && r.messageId === reaction.messageId)
        );
    } else {
        const existingIndex = msg.reactions.findIndex(r => 
            r.username === reaction.username && r.messageId === reaction.messageId
        );
        
        if (existingIndex !== -1) {
            msg.reactions[existingIndex] = reaction;
        } else {
            msg.reactions.push(reaction);
        }
    }
    
    displayMessages();
}

function handleIncomingNote(note) {
    const existingIndex = notes.findIndex(n => 
        n.roomId === note.roomId && n.username === note.username
    );
    
    if (existingIndex !== -1) {
        notes[existingIndex] = note;
    } else {
        notes.push(note);
    }
    
    displayNotes();
}

function showTypingIndicator(data) {
    if (data.username === window.getCurrentUser()) return;
    
    const indicator = document.getElementById('typingIndicator');
    if (!indicator) return;
    
    if (data.typing) {
        indicator.textContent = `${data.username} is typing...`;
        indicator.style.display = 'block';
    } else {
        indicator.style.display = 'none';
    }
}

function sendMessage() {
    const input = document.getElementById('messageInput');
    if (!input) return;
    
    const content = input.value.trim();
    if (!content) return;
    
    const stomp = window.stompClient || window.getStompClient();
    const payload = {
        username: window.getCurrentUser(),
        content: content,
        type: 'POST'
    };
    
    if (replyToMessage) {
        payload.replyTo = replyToMessage.id;
    }
    
    stomp.send(`/app/rooms/${currentRoomId}/message`, {}, JSON.stringify(payload));
    
    input.value = '';
    clearReply();
}

function setReplyTo(messageId, username, content) {
    replyToMessage = { id: messageId, username, content };
    
    const preview = document.getElementById('replyPreview');
    const replyText = document.getElementById('replyText');
    
    if (preview && replyText) {
        replyText.textContent = `Replying to ${username}: ${content.substring(0, 50)}...`;
        preview.style.display = 'block';
    }
}

function clearReply() {
    replyToMessage = null;
    const preview = document.getElementById('replyPreview');
    if (preview) preview.style.display = 'none';
}

function deleteMessage(messageId) {
    if (!confirm('Delete this message?')) return;
    
    const stomp = window.stompClient || window.getStompClient();
    stomp.send(`/app/rooms/${currentRoomId}/message`, {}, JSON.stringify({
        id: messageId,
        type: 'DELETE'
    }));
}

function showEmojiPicker(messageId, event) {
    const picker = document.getElementById('emojiPicker');
    if (!picker) return;
    
    document.getElementById('emojiGrid').innerHTML = emojis.map(emoji => 
        `<button class="emoji-item" onclick="reactToMessage(${messageId}, '${emoji}')">${emoji}</button>`
    ).join('');
    
    if (event) {
        picker.style.left = `${event.pageX}px`;
        picker.style.top = `${event.pageY}px`;
        picker.style.position = 'fixed';
    }
    
    picker.style.display = 'block';
    setTimeout(() => picker.style.display = 'none', 5000);
}

function reactToMessage(messageId, emoji) {
    const stomp = window.stompClient || window.getStompClient();
    const currentUser = window.getCurrentUser();
    
    const msg = messages.find(m => m.id === messageId);
    const existingReaction = msg?.reactions?.find(r => 
        r.username === currentUser && r.messageId === messageId
    );
    
    if (existingReaction) {
        if (existingReaction.emoji === emoji) {
            stomp.send(`/app/rooms/${currentRoomId}/react`, {}, JSON.stringify({
                messageId: messageId,
                username: currentUser,
                type: 'DELETE'
            }));
        } else {
            stomp.send(`/app/rooms/${currentRoomId}/react`, {}, JSON.stringify({
                messageId: messageId,
                username: currentUser,
                emoji: emoji,
                type: 'UPDATE'
            }));
        }
    } else {
        stomp.send(`/app/rooms/${currentRoomId}/react`, {}, JSON.stringify({
            messageId: messageId,
            username: currentUser,
            emoji: emoji,
            type: 'POST'
        }));
    }
    
    const picker = document.getElementById('emojiPicker');
    if (picker) picker.style.display = 'none';
}

function toggleReaction(messageId, emoji) {
    reactToMessage(messageId, emoji);
}

function addNote() {
    const input = document.getElementById('noteInput');
    if (!input) return;
    
    const content = input.value.trim();
    if (!content) return;
    
    const stomp = window.stompClient || window.getStompClient();
    stomp.send(`/app/rooms/${currentRoomId}/note`, {}, JSON.stringify({
        roomId: parseInt(currentRoomId),
        username: window.getCurrentUser(),
        content: content
    }));
    
    input.value = '';
}

async function uploadFile() {
    const input = document.getElementById('fileInput');
    const file = input.files[0];
    
    if (!file) return;
    
    if (file.size > 200 * 1024 * 1024) {
        alert('File too large. Maximum size is 200MB');
        return;
    }
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
        const token = sessionStorage.getItem('authToken') || localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}/api/files/rooms/${currentRoomId}/attachments`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            credentials: 'include',
            body: formData
        });
        
        if (response.ok) {
            input.value = '';
            await loadFiles();
            alert('File uploaded successfully');
        } else {
            alert('Failed to upload file');
        }
    } catch (err) {
        debugLog('UPLOAD', 'EXCEPTION', err);
        alert('Failed to upload file');
    }
}

async function deleteRoom() {
    if (!confirm(`Delete room "${currentRoomName}"? This action cannot be undone.`)) return;
    
    try {
        const token = sessionStorage.getItem('authToken') || localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}/rooms/${currentRoomId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` },
            credentials: 'include'
        });
        
        if (response.ok) {
            alert('Room deleted successfully');
            window.location.href = 'index.html';
        } else if (response.status === 403) {
            alert('You do not have permission to delete this room');
        } else {
            alert('Failed to delete room');
        }
    } catch (err) {
        debugLog('DELETE', 'EXCEPTION', err);
        alert('Failed to delete room');
    }
}

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'flex';
        modal.classList.add('show');
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('show');
    }
}

function showChatWindow() {
    const chatPlaceholder = document.querySelector('.chat-placeholder');
    const chatWindow = document.querySelector('.chat-window');
    const filesPlaceholder = document.querySelector('.files-placeholder');
    const filesPanel = document.querySelector('.files-panel');
    const messageInputContainer = document.getElementById('messageInputContainer');
    
    if (chatPlaceholder) chatPlaceholder.style.display = 'none';
    if (chatWindow) {
        chatWindow.style.display = 'grid';
        chatWindow.classList.add('active');
    }
    if (filesPlaceholder) filesPlaceholder.style.display = 'none';
    if (filesPanel) filesPanel.style.display = 'flex';
    if (messageInputContainer) messageInputContainer.style.display = 'flex';
}

function setupEventListeners() {
    const sendBtn = document.getElementById('sendBtn');
    const messageInput = document.getElementById('messageInput');
    
    if (sendBtn) sendBtn.addEventListener('click', sendMessage);
    
    if (messageInput) {
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
        });
        
        messageInput.addEventListener('input', () => {
            clearTimeout(typingTimeout);
            
            const stomp = window.stompClient || window.getStompClient();
            if (stomp && stomp.connected) {
                stomp.send(`/app/rooms/${currentRoomId}/typing`, {}, JSON.stringify({
                    username: window.getCurrentUser(),
                    typing: true
                }));
                
                typingTimeout = setTimeout(() => {
                    stomp.send(`/app/rooms/${currentRoomId}/typing`, {}, JSON.stringify({
                        username: window.getCurrentUser(),
                        typing: false
                    }));
                }, 1000);
            }
        });
    }
    
    const cancelReply = document.getElementById('cancelReply');
    if (cancelReply) cancelReply.addEventListener('click', clearReply);
    
    const notesBtn = document.getElementById('notesBtn');
    if (notesBtn) notesBtn.addEventListener('click', () => openModal('notesModal'));
    
    const filesViewBtn = document.getElementById('filesViewBtn');
    if (filesViewBtn) filesViewBtn.addEventListener('click', () => openModal('filesViewModal'));
    
    const addNoteBtn = document.getElementById('addNoteBtn');
    if (addNoteBtn) addNoteBtn.addEventListener('click', addNote);
    
    const fileBtn = document.getElementById('fileBtn');
    const fileInput = document.getElementById('fileInput');
    if (fileBtn) fileBtn.addEventListener('click', () => fileInput.click());
    if (fileInput) fileInput.addEventListener('change', uploadFile);
    
    const deleteRoomBtn = document.getElementById('deleteRoomBtn');
    if (deleteRoomBtn) deleteRoomBtn.addEventListener('click', deleteRoom);
    
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', () => window.logout());
}

function formatTime(timestamp) {
    if (!timestamp) return 'Just now';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Export global functions
window.setReplyTo = setReplyTo;
window.deleteMessage = deleteMessage;
window.showEmojiPicker = showEmojiPicker;
window.reactToMessage = reactToMessage;
window.toggleReaction = toggleReaction;
window.closeModal = closeModal;
window.downloadFile = downloadFile;

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    displayUsername();
    initializeRoom();
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (messageSubscription) messageSubscription.unsubscribe();
    if (reactionSubscription) reactionSubscription.unsubscribe();
    if (typingSubscription) typingSubscription.unsubscribe();
    if (noteSubscription) noteSubscription.unsubscribe();
    clearTimeout(typingTimeout);
});