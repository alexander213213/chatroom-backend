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

const emojis = ['👍', '❤️', '😂', '😮', '😢', '🎉', '🔥', '👀'];

// Debug logging utility
function debugLog(section, message, data = null) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [ROOM-${section}] ${message}`;
    console.log(logMessage, data || '');
}

function init() {
    debugLog('INIT', '=== ROOM PAGE INITIALIZATION ===');
    displayUsername();
    initializeRoom();
}

function displayUsername() {
    debugLog('USERNAME', 'Displaying username');
    const username = window.getCurrentUser();
    const display = document.getElementById('currentUserDisplay');
    if (display) {
        display.textContent = username;
        debugLog('USERNAME', 'Username set', username);
    } else {
        debugLog('USERNAME', 'ERROR: Display element not found');
    }
}

async function initializeRoom() {
    debugLog('INIT_ROOM', '=== INITIALIZING ROOM ===');
    
    currentRoomId = sessionStorage.getItem('currentRoomId');
    debugLog('INIT_ROOM', 'Retrieved room ID from session', currentRoomId);
    
    if (!currentRoomId) {
        debugLog('INIT_ROOM', 'ERROR: No room selected');
        alert('No room selected');
        window.navigateTo('landing');
        return;
    }
    
    await loadRoomData();
    setupWebSocket();
    setupEventListeners();
}

async function loadRoomData() {
    debugLog('LOAD_ROOM_DATA', '=== LOADING ROOM DATA ===');
    
    try {
        const token = sessionStorage.getItem('authToken') || localStorage.getItem('authToken');
        debugLog('LOAD_ROOM_DATA', 'Token retrieved', token ? `${token.substring(0, 20)}...` : 'NO TOKEN');
        
        if (!token) {
            debugLog('LOAD_ROOM_DATA', 'ERROR: No authentication token');
            return;
        }
        
        // Load all rooms to get current room info
        const roomsUrl = `${API_BASE}/rooms`;
        debugLog('LOAD_ROOM_DATA', 'Fetching rooms from', roomsUrl);
        
        const roomsResponse = await fetch(roomsUrl, {
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            credentials: 'include'
        });
        
        debugLog('LOAD_ROOM_DATA', 'Rooms response', {
            status: roomsResponse.status,
            ok: roomsResponse.ok
        });
        
        if (roomsResponse.ok) {
            const rooms = await roomsResponse.json();
            debugLog('LOAD_ROOM_DATA', `Loaded ${rooms.length} rooms`, rooms);
            
            displayRoomsList(rooms);
            
            const currentRoom = rooms.find(r => r.id == currentRoomId);
            debugLog('LOAD_ROOM_DATA', 'Current room found', currentRoom);
            
            if (currentRoom) {
                currentRoomName = currentRoom.name;
                currentRoomOwnerId = currentRoom.user.id;
                currentRoomOwnerUsername = currentRoom.user.username;
                
                debugLog('LOAD_ROOM_DATA', 'Room details', {
                    name: currentRoomName,
                    ownerId: currentRoomOwnerId,
                    ownerUsername: currentRoomOwnerUsername
                });
                
                document.getElementById('chatRoomTitle').textContent = currentRoom.name;
                showChatWindow();
                
                // Show delete button only for room owner
                const currentUser = window.getCurrentUser();
                const deleteBtn = document.getElementById('deleteRoomBtn');
                if (deleteBtn) {
                    if (currentRoomOwnerUsername === currentUser) {
                        deleteBtn.style.display = 'block';
                        debugLog('LOAD_ROOM_DATA', 'Delete button shown (user is owner)');
                    } else {
                        deleteBtn.style.display = 'none';
                        debugLog('LOAD_ROOM_DATA', 'Delete button hidden (user is not owner)');
                    }
                }
            } else {
                debugLog('LOAD_ROOM_DATA', 'ERROR: Current room not found in user rooms');
            }
        } else {
            const errorText = await roomsResponse.text();
            debugLog('LOAD_ROOM_DATA', 'ERROR: Failed to fetch rooms', {
                status: roomsResponse.status,
                error: errorText
            });
        }
        
        // Load room-specific data in parallel
        await Promise.all([
            loadMessages(),
            loadRoomMembers(),
            loadNotes(),
            loadFiles()
        ]);
        
    } catch (err) {
        debugLog('LOAD_ROOM_DATA', 'EXCEPTION', {
            error: err.message,
            stack: err.stack
        });
    }
}

function displayRoomsList(rooms) {
    debugLog('DISPLAY_ROOMS_LIST', `Displaying ${rooms.length} rooms`);
    const roomsContent = document.getElementById('roomsContent');
    
    if (!roomsContent) {
        debugLog('DISPLAY_ROOMS_LIST', 'ERROR: roomsContent element not found');
        return;
    }
    
    roomsContent.innerHTML = rooms.map(room => `
        <div class="room-item ${room.id == currentRoomId ? 'active' : ''}" data-room-id="${room.id}">
            <span class="room-icon">💼</span>
            <span>${escapeHtml(room.name)}</span>
        </div>
    `).join('');
    
    roomsContent.querySelectorAll('.room-item').forEach(item => {
        item.addEventListener('click', () => {
            const roomId = item.dataset.roomId;
            debugLog('DISPLAY_ROOMS_LIST', 'Room clicked', roomId);
            switchRoom(roomId);
        });
    });
    
    debugLog('DISPLAY_ROOMS_LIST', 'Rooms list rendered');
}

async function switchRoom(roomId) {
    debugLog('SWITCH_ROOM', '=== SWITCHING ROOM ===', { roomId });
    
    currentRoomId = roomId;
    sessionStorage.setItem('currentRoomId', roomId);
    
    // Unsubscribe from previous room
    if (window.currentRoomSubscription) {
        window.currentRoomSubscription.unsubscribe();
        debugLog('SWITCH_ROOM', 'Unsubscribed from previous room messages');
    }
    if (window.reactionSubscription) {
        window.reactionSubscription.unsubscribe();
        debugLog('SWITCH_ROOM', 'Unsubscribed from previous room reactions');
    }
    
    // Clear data
    messages = [];
    notes = [];
    files = [];
    
    await loadRoomData();
    setupWebSocket();
}

async function loadMessages() {
    debugLog('LOAD_MESSAGES', '=== LOADING MESSAGES ===');
    
    try {
        const token = sessionStorage.getItem('authToken') || localStorage.getItem('authToken');
        const url = `${API_BASE}/rooms/${currentRoomId}/messages?limit=50`;
        
        debugLog('LOAD_MESSAGES', 'Fetching from', url);
        
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` },
            credentials: 'include'
        });
        
        debugLog('LOAD_MESSAGES', 'Response', {
            status: response.status,
            ok: response.ok
        });
        
        if (response.ok) {
            messages = await response.json();
            debugLog('LOAD_MESSAGES', `Loaded ${messages.length} messages`, messages);
            displayMessages();
        } else {
            const errorText = await response.text();
            debugLog('LOAD_MESSAGES', 'ERROR', {
                status: response.status,
                error: errorText
            });
        }
    } catch (err) {
        debugLog('LOAD_MESSAGES', 'EXCEPTION', {
            error: err.message,
            stack: err.stack
        });
    }
}

async function loadRoomMembers() {
    debugLog('LOAD_MEMBERS', '=== LOADING ROOM MEMBERS ===');
    
    try {
        const token = sessionStorage.getItem('authToken') || localStorage.getItem('authToken');
        const url = `${API_BASE}/rooms/${currentRoomId}`;
        
        debugLog('LOAD_MEMBERS', 'Fetching from', url);
        
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` },
            credentials: 'include'
        });
        
        debugLog('LOAD_MEMBERS', 'Response', {
            status: response.status,
            ok: response.ok
        });
        
        if (response.ok) {
            const members = await response.json();
            debugLog('LOAD_MEMBERS', `Loaded ${members.length} members`, members);
            displayMembers(members);
        } else {
            const errorText = await response.text();
            debugLog('LOAD_MEMBERS', 'ERROR', {
                status: response.status,
                error: errorText
            });
        }
    } catch (err) {
        debugLog('LOAD_MEMBERS', 'EXCEPTION', {
            error: err.message,
            stack: err.stack
        });
    }
}

async function loadNotes() {
    debugLog('LOAD_NOTES', '=== LOADING NOTES ===');
    
    try {
        const token = sessionStorage.getItem('authToken') || localStorage.getItem('authToken');
        const url = `${API_BASE}/rooms/${currentRoomId}/notes?limit=50`;
        
        debugLog('LOAD_NOTES', 'Fetching from', url);
        
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` },
            credentials: 'include'
        });
        
        debugLog('LOAD_NOTES', 'Response', {
            status: response.status,
            ok: response.ok
        });
        
        if (response.ok) {
            notes = await response.json();
            debugLog('LOAD_NOTES', `Loaded ${notes.length} notes`, notes);
            displayNotes();
        } else {
            const errorText = await response.text();
            debugLog('LOAD_NOTES', 'ERROR', {
                status: response.status,
                error: errorText
            });
        }
    } catch (err) {
        debugLog('LOAD_NOTES', 'EXCEPTION', {
            error: err.message,
            stack: err.stack
        });
    }
}

async function loadFiles() {
    debugLog('LOAD_FILES', '=== LOADING FILES ===');
    
    try {
        const token = sessionStorage.getItem('authToken') || localStorage.getItem('authToken');
        const url = `${API_BASE}/api/files/rooms/${currentRoomId}/attachments`;
        
        debugLog('LOAD_FILES', 'Fetching from', url);
        
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` },
            credentials: 'include'
        });
        
        debugLog('LOAD_FILES', 'Response', {
            status: response.status,
            ok: response.ok
        });
        
        if (response.ok) {
            const data = await response.json();
            files = data.attachments || [];
            debugLog('LOAD_FILES', `Loaded ${files.length} files`, files);
            displayFiles();
        } else if (response.status === 404) {
            debugLog('LOAD_FILES', 'No files found (404 - expected for new rooms)');
            files = [];
            displayFiles();
        } else {
            const errorText = await response.text();
            debugLog('LOAD_FILES', 'ERROR', {
                status: response.status,
                error: errorText
            });
        }
    } catch (err) {
        debugLog('LOAD_FILES', 'EXCEPTION', {
            error: err.message,
            stack: err.stack
        });
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
    debugLog('DISPLAY_MESSAGES', `Rendering ${messages.length} messages`);
    const container = document.getElementById('messagesContainer');
    
    if (!container) {
        debugLog('DISPLAY_MESSAGES', 'ERROR: Container not found');
        return;
    }
    
    if (messages.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: var(--text-muted); font-size: 8px;">
                No messages yet. Start the conversation!
            </div>
        `;
        debugLog('DISPLAY_MESSAGES', 'Displayed empty state');
        return;
    }
    
    container.innerHTML = messages.map((msg, index) => {
        debugLog('DISPLAY_MESSAGES', `Rendering message ${index + 1}/${messages.length}`, {
            id: msg.id,
            username: msg.username,
            hasReactions: !!(msg.reactions && msg.reactions.length > 0)
        });
        
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
    debugLog('DISPLAY_MESSAGES', 'Messages rendered and scrolled to bottom');
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
    debugLog('DISPLAY_MEMBERS', `Rendering ${members.length} members`);
    const membersList = document.getElementById('membersList');
    
    if (!membersList) {
        debugLog('DISPLAY_MEMBERS', 'ERROR: membersList not found');
        return;
    }
    
    membersList.innerHTML = members.map(username => `
        <li class="member-item">
            <span class="member-status ${username === window.getCurrentUser() ? 'online' : 'offline'}"></span>
            <span>${escapeHtml(username)}</span>
        </li>
    `).join('');
    
    debugLog('DISPLAY_MEMBERS', 'Members rendered');
}

function displayNotes() {
    debugLog('DISPLAY_NOTES', `Rendering ${notes.length} notes`);
    const notesList = document.getElementById('notesList');
    
    if (!notesList) {
        debugLog('DISPLAY_NOTES', 'ERROR: notesList not found');
        return;
    }
    
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
    
    debugLog('DISPLAY_NOTES', 'Notes rendered');
}

function displayFiles() {
    debugLog('DISPLAY_FILES', `Rendering ${files.length} files`);
    const filesContent = document.getElementById('filesContent');
    const filesListModal = document.getElementById('filesListModal');
    
    if (files.length === 0) {
        const emptyMsg = '<div style="text-align: center; padding: 20px; color: var(--text-muted); font-size: 8px;">No files uploaded yet</div>';
        if (filesContent) filesContent.innerHTML = emptyMsg;
        if (filesListModal) filesListModal.innerHTML = emptyMsg;
        debugLog('DISPLAY_FILES', 'Displayed empty state');
        return;
    }
    
    const filesHtml = files.map((file, index) => {
        debugLog('DISPLAY_FILES', `Rendering file ${index + 1}/${files.length}`, {
            filename: file.filename,
            size: file.size,
            isImage: file.isImage
        });
        
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
    
    debugLog('DISPLAY_FILES', 'Files rendered');
}

async function downloadFile(filename) {
    debugLog('DOWNLOAD_FILE', 'Downloading file', filename);
    
    try {
        const token = sessionStorage.getItem('authToken') || localStorage.getItem('authToken');
        const url = `${API_BASE}/api/files/rooms/${currentRoomId}/attachments/${filename}`;
        
        debugLog('DOWNLOAD_FILE', 'Fetching from', url);
        
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` },
            credentials: 'include'
        });
        
        debugLog('DOWNLOAD_FILE', 'Response', {
            status: response.status,
            ok: response.ok
        });
        
        if (response.ok) {
            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(downloadUrl);
            document.body.removeChild(a);
            debugLog('DOWNLOAD_FILE', 'Download completed');
        } else {
            debugLog('DOWNLOAD_FILE', 'ERROR: Download failed');
            alert('Failed to download file');
        }
    } catch (err) {
        debugLog('DOWNLOAD_FILE', 'EXCEPTION', {
            error: err.message,
            stack: err.stack
        });
        alert('Failed to download file');
    }
}

function setupWebSocket() {
    debugLog('WEBSOCKET', '=== SETTING UP WEBSOCKET ===');
    
    if (!window.isWebSocketConnected()) {
        debugLog('WEBSOCKET', 'WebSocket not connected, retrying in 1 second');
        setTimeout(setupWebSocket, 1000);
        return;
    }
    
    const stomp = window.stompClient;
    debugLog('WEBSOCKET', 'STOMP client available, subscribing to room topics');
    
    // Subscribe to messages
    window.currentRoomSubscription = stomp.subscribe(`/topic/${currentRoomId}/messages`, (message) => {
        debugLog('WEBSOCKET', 'Message received', message.body);
        const msg = JSON.parse(message.body);
        handleIncomingMessage(msg);
    });
    
    // Subscribe to reactions
    window.reactionSubscription = stomp.subscribe(`/topic/${currentRoomId}/reactions`, (message) => {
        debugLog('WEBSOCKET', 'Reaction received', message.body);
        const reaction = JSON.parse(message.body);
        handleIncomingReaction(reaction);
    });
    
    // Subscribe to typing indicators
    stomp.subscribe(`/topic/${currentRoomId}/typing`, (message) => {
        debugLog('WEBSOCKET', 'Typing indicator received', message.body);
        const data = JSON.parse(message.body);
        showTypingIndicator(data);
    });
    
    // Subscribe to notes
    stomp.subscribe(`/topic/${currentRoomId}/notes`, (message) => {
        debugLog('WEBSOCKET', 'Note received', message.body);
        const note = JSON.parse(message.body);
        handleIncomingNote(note);
    });
    
    debugLog('WEBSOCKET', 'Successfully subscribed to all room topics');
}

function handleIncomingMessage(msg) {
    debugLog('INCOMING_MESSAGE', 'Processing message', {
        type: msg.type,
        id: msg.id,
        username: msg.username
    });
    
    if (msg.type === 'DELETE') {
        messages = messages.filter(m => m.id !== msg.id);
        debugLog('INCOMING_MESSAGE', 'Message deleted', msg.id);
    } else if (msg.type === 'UPDATE') {
        const index = messages.findIndex(m => m.id === msg.id);
        if (index !== -1) {
            messages[index] = { ...messages[index], ...msg };
            debugLog('INCOMING_MESSAGE', 'Message updated', msg.id);
        }
    } else {
        messages.push(msg);
        debugLog('INCOMING_MESSAGE', 'New message added', msg.id);
    }
    displayMessages();
}

function handleIncomingReaction(reaction) {
    debugLog('INCOMING_REACTION', 'Processing reaction', {
        type: reaction.type,
        messageId: reaction.messageId,
        emoji: reaction.emoji,
        username: reaction.username
    });
    
    const msg = messages.find(m => m.id === reaction.messageId);
    if (!msg) {
        debugLog('INCOMING_REACTION', 'ERROR: Message not found', reaction.messageId);
        return;
    }
    
    if (!msg.reactions) msg.reactions = [];
    
    if (reaction.type === 'DELETE') {
        msg.reactions = msg.reactions.filter(r => 
            !(r.username === reaction.username && r.messageId === reaction.messageId)
        );
        debugLog('INCOMING_REACTION', 'Reaction deleted');
    } else {
        const existingIndex = msg.reactions.findIndex(r => 
            r.username === reaction.username && r.messageId === reaction.messageId
        );
        
        if (existingIndex !== -1) {
            msg.reactions[existingIndex] = reaction;
            debugLog('INCOMING_REACTION', 'Reaction updated');
        } else {
            msg.reactions.push(reaction);
            debugLog('INCOMING_REACTION', 'New reaction added');
        }
    }
    
    displayMessages();
}

function handleIncomingNote(note) {
    debugLog('INCOMING_NOTE', 'Processing note', {
        roomId: note.roomId,
        username: note.username
    });
    
    const existingIndex = notes.findIndex(n => 
        n.roomId === note.roomId && n.username === note.username
    );
    
    if (existingIndex !== -1) {
        notes[existingIndex] = note;
        debugLog('INCOMING_NOTE', 'Note updated');
    } else {
        notes.push(note);
        debugLog('INCOMING_NOTE', 'New note added');
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
        debugLog('TYPING', 'Showing typing indicator', data.username);
    } else {
        indicator.style.display = 'none';
        debugLog('TYPING', 'Hiding typing indicator');
    }
}

function sendMessage() {
    debugLog('SEND_MESSAGE', '=== SENDING MESSAGE ===');
    const input = document.getElementById('messageInput');
    if (!input) return;
    
    const content = input.value.trim();
    
    if (!content) {
        debugLog('SEND_MESSAGE', 'Empty message, aborting');
        return;
    }
    
    debugLog('SEND_MESSAGE', 'Message content', content);
    
    const stomp = window.stompClient;
    const payload = {
        username: window.getCurrentUser(),
        content: content,
        type: 'POST'
    };
    
    if (replyToMessage) {
        payload.replyTo = replyToMessage.id;
        debugLog('SEND_MESSAGE', 'Replying to message', replyToMessage.id);
    }
    
    debugLog('SEND_MESSAGE', 'Sending payload', payload);
    stomp.send(`/app/rooms/${currentRoomId}/message`, {}, JSON.stringify(payload));
    
    input.value = '';
    clearReply();
}

function setReplyTo(messageId, username, content) {
    debugLog('REPLY', 'Setting reply target', { messageId, username });
    replyToMessage = { id: messageId, username, content };
    
    const preview = document.getElementById('replyPreview');
    const replyText = document.getElementById('replyText');
    
    if (preview && replyText) {
        replyText.textContent = `Replying to ${username}: ${content.substring(0, 50)}...`;
        preview.style.display = 'block';
    }
}

function clearReply() {
    debugLog('REPLY', 'Clearing reply');
    replyToMessage = null;
    const preview = document.getElementById('replyPreview');
    if (preview) preview.style.display = 'none';
}

function deleteMessage(messageId) {
    if (!confirm('Delete this message?')) return;
    
    debugLog('DELETE_MESSAGE', 'Deleting message', messageId);
    
    const stomp = window.stompClient;
    stomp.send(`/app/rooms/${currentRoomId}/message`, {}, JSON.stringify({
        id: messageId,
        type: 'DELETE'
    }));
}

function showEmojiPicker(messageId, event) {
    debugLog('EMOJI_PICKER', 'Showing emoji picker for message', messageId);
    const picker = document.getElementById('emojiPicker');
    if (!picker) return;
    
    document.getElementById('emojiGrid').innerHTML = emojis.map(emoji => 
        `<button class="emoji-item" onclick="reactToMessage(${messageId}, '${emoji}')" style="cursor: pointer; padding: 8px; border: none; background: none; font-size: 20px;">${emoji}</button>`
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
    debugLog('REACT', 'Reacting to message', { messageId, emoji });
    
    const stomp = window.stompClient;
    const currentUser = window.getCurrentUser();
    
    const msg = messages.find(m => m.id === messageId);
    const existingReaction = msg?.reactions?.find(r => 
        r.username === currentUser && r.messageId === messageId
    );
    
    if (existingReaction) {
        if (existingReaction.emoji === emoji) {
            debugLog('REACT', 'Removing reaction');
            stomp.send(`/app/rooms/${currentRoomId}/react`, {}, JSON.stringify({
                messageId: messageId,
                username: currentUser,
                type: 'DELETE'
            }));
        } else {
            debugLog('REACT', 'Updating reaction');
            stomp.send(`/app/rooms/${currentRoomId}/react`, {}, JSON.stringify({
                messageId: messageId,
                username: currentUser,
                emoji: emoji,
                type: 'UPDATE'
            }));
        }
    } else {
        debugLog('REACT', 'Adding new reaction');
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
    debugLog('NOTE', '=== ADDING NOTE ===');
    const input = document.getElementById('noteInput');
    if (!input) return;
    
    const content = input.value.trim();
    if (!content) {
        debugLog('NOTE', 'Empty note, aborting');
        return;
    }
    
    debugLog('NOTE', 'Note content', content);
    
    const stomp = window.stompClient;
    stomp.send(`/app/rooms/${currentRoomId}/note`, {}, JSON.stringify({
        roomId: parseInt(currentRoomId),
        username: window.getCurrentUser(),
        content: content
    }));
    
    input.value = '';
}

async function uploadFile() {
    debugLog('UPLOAD_FILE', '=== UPLOADING FILE ===');
    const input = document.getElementById('fileInput');
    const file = input.files[0];
    
    if (!file) {
        debugLog('UPLOAD_FILE', 'No file selected');
        return;
    }
    
    debugLog('UPLOAD_FILE', 'File selected', {
        name: file.name,
        size: file.size,
        type: file.type
    });
    
    if (file.size > 200 * 1024 * 1024) {
        debugLog('UPLOAD_FILE', 'ERROR: File too large', file.size);
        alert('File too large. Maximum size is 200MB');
        return;
    }
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
        const token = sessionStorage.getItem('authToken') || localStorage.getItem('authToken');
        const url = `${API_BASE}/api/files/rooms/${currentRoomId}/attachments`;
        
        debugLog('UPLOAD_FILE', 'Uploading to', url);
        
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            credentials: 'include',
            body: formData
        });
        
        debugLog('UPLOAD_FILE', 'Response', {
            status: response.status,
            ok: response.ok
        });
        
        if (response.ok) {
            const result = await response.json();
            debugLog('UPLOAD_FILE', 'File uploaded successfully', result);
            input.value = '';
            await loadFiles();
            alert('File uploaded successfully');
        } else {
            const errorText = await response.text();
            debugLog('UPLOAD_FILE', 'ERROR: Upload failed', {
                status: response.status,
                error: errorText
            });
            alert('Failed to upload file');
        }
    } catch (err) {
        debugLog('UPLOAD_FILE', 'EXCEPTION', {
            error: err.message,
            stack: err.stack
        });
        alert('Failed to upload file');
    }
}

async function deleteRoom() {
    debugLog('DELETE_ROOM', '=== DELETING ROOM ===', { roomId: currentRoomId });
    
    if (!confirm(`Delete room "${currentRoomName}"? This action cannot be undone.`)) {
        debugLog('DELETE_ROOM', 'User cancelled deletion');
        return;
    }
    
    try {
        const token = sessionStorage.getItem('authToken') || localStorage.getItem('authToken');
        const url = `${API_BASE}/rooms/${currentRoomId}`;
        
        debugLog('DELETE_ROOM', 'Sending DELETE request to', url);
        
        const response = await fetch(url, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` },
            credentials: 'include'
        });
        
        debugLog('DELETE_ROOM', 'Response', {
            status: response.status,
            ok: response.ok
        });
        
        if (response.ok) {
            debugLog('DELETE_ROOM', 'Room deleted successfully');
            alert('Room deleted successfully');
            window.navigateTo('landing');
        } else if (response.status === 403) {
            debugLog('DELETE_ROOM', 'ERROR: Permission denied');
            alert('You do not have permission to delete this room');
        } else {
            const errorText = await response.text();
            debugLog('DELETE_ROOM', 'ERROR', {
                status: response.status,
                error: errorText
            });
            alert('Failed to delete room');
        }
    } catch (err) {
        debugLog('DELETE_ROOM', 'EXCEPTION', {
            error: err.message,
            stack: err.stack
        });
        alert('Failed to delete room');
    }
}

function openModal(modalId) {
    debugLog('MODAL', 'Opening modal', modalId);
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'flex';
        modal.classList.add('show');
    }
}

function closeModal(modalId) {
    debugLog('MODAL', 'Closing modal', modalId);
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('show');
    }
}

function showChatWindow() {
    debugLog('SHOW_CHAT', 'Showing chat window');
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
    debugLog('EVENTS', 'Setting up event listeners');
    
    const sendBtn = document.getElementById('sendBtn');
    const messageInput = document.getElementById('messageInput');
    const cancelReply = document.getElementById('cancelReply');
    const notesBtn = document.getElementById('notesBtn');
    const filesViewBtn = document.getElementById('filesViewBtn');
    const addNoteBtn = document.getElementById('addNoteBtn');
    const fileBtn = document.getElementById('fileBtn');
    const fileInput = document.getElementById('fileInput');
    const homeBtn = document.getElementById('homeBtn');
    const deleteRoomBtn = document.getElementById('deleteRoomBtn');
    
    if (sendBtn) {
        sendBtn.addEventListener('click', sendMessage);
        debugLog('EVENTS', 'Send button listener attached');
    }
    
    if (messageInput) {
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                debugLog('EVENTS', 'Enter key pressed in message input');
                sendMessage();
            }
        });
        
        messageInput.addEventListener('input', () => {
            clearTimeout(typingTimeout);
            
            const stomp = window.stompClient;
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
        
        debugLog('EVENTS', 'Message input listeners attached');
    }
    
    if (cancelReply) cancelReply.addEventListener('click', clearReply);
    if (notesBtn) notesBtn.addEventListener('click', () => openModal('notesModal'));
    if (filesViewBtn) filesViewBtn.addEventListener('click', () => openModal('filesViewModal'));
    if (addNoteBtn) addNoteBtn.addEventListener('click', addNote);
    if (fileBtn) fileBtn.addEventListener('click', () => fileInput.click());
    if (fileInput) fileInput.addEventListener('change', uploadFile);
    if (homeBtn) homeBtn.addEventListener('click', () => {
        debugLog('EVENTS', 'Home button clicked');
        window.navigateTo('landing');
    });
    if (deleteRoomBtn) deleteRoomBtn.addEventListener('click', deleteRoom);
    
    document.querySelectorAll('.window-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const action = e.target.dataset.action;
            debugLog('EVENTS', 'Window button clicked', action);
            
            if (action === 'minimize-chat' || action === 'close-chat') {
                const chatWindow = document.querySelector('.chat-window');
                const chatPlaceholder = document.querySelector('.chat-placeholder');
                if (chatWindow) chatWindow.style.display = 'none';
                if (chatPlaceholder) chatPlaceholder.style.display = 'flex';
            } else if (action === 'minimize-files') {
                const filesPanel = document.querySelector('.files-panel');
                if (filesPanel) filesPanel.classList.toggle('minimized');
            } else if (action === 'minimize-rooms') {
                const roomsPanel = document.querySelector('.rooms-panel');
                if (roomsPanel) roomsPanel.classList.toggle('minimized');
            }
        });
    });
    
    debugLog('EVENTS', 'All event listeners setup completed');
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

// Global function exports
window.setReplyTo = setReplyTo;
window.deleteMessage = deleteMessage;
window.showEmojiPicker = showEmojiPicker;
window.reactToMessage = reactToMessage;
window.toggleReaction = toggleReaction;
window.closeModal = closeModal;
window.downloadFile = downloadFile;

init();

window.cleanupPage = function() {
    debugLog('CLEANUP', '=== ROOM PAGE CLEANUP ===');
    if (window.currentRoomSubscription) {
        window.currentRoomSubscription.unsubscribe();
        window.currentRoomSubscription = null;
        debugLog('CLEANUP', 'Unsubscribed from room messages');
    }
    if (window.reactionSubscription) {
        window.reactionSubscription.unsubscribe();
        window.reactionSubscription = null;
        debugLog('CLEANUP', 'Unsubscribed from room reactions');
    }
    clearTimeout(typingTimeout);
    debugLog('CLEANUP', 'Cleanup completed');
};