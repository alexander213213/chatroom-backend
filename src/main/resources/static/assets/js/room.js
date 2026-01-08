const API_BASE = window.location.origin;
let currentRoomId = null;
let messages = [];
let notes = [];
let replyToMessage = null;
let typingTimeout = null;

function displayUsername() {
    const username = window.getCurrentUser();
    document.getElementById('currentUserDisplay').textContent = username;
}

async function initializeRoom() {
    currentRoomId = sessionStorage.getItem('currentRoomId');
    
    if (!currentRoomId) {
        alert('No room selected');
        window.navigateTo('landing');
        return;
    }
    
    await loadRoomData();
    setupWebSocket();
    setupEventListeners();
}

async function loadRoomData() {
    try {
        const token = sessionStorage.getItem('authToken') || localStorage.getItem('authToken');
        
        const roomsResponse = await fetch(`${API_BASE}/rooms`, {
            headers: { 'Authorization': `Bearer ${token}` },
            credentials: 'include'
        });
        
        if (roomsResponse.ok) {
            const rooms = await roomsResponse.json();
            displayRoomsList(rooms);
            
            const currentRoom = rooms.find(r => r.id == currentRoomId);
            if (currentRoom) {
                document.getElementById('chatRoomTitle').textContent = currentRoom.name;
                showChatWindow();
            }
        }
        
        await Promise.all([
            loadMessages(),
            loadRoomMembers(),
            loadNotes()
        ]);
    } catch (err) {
        console.error('Failed to load room data:', err);
    }
}

function displayRoomsList(rooms) {
    const roomsContent = document.querySelector('.rooms-content');
    roomsContent.innerHTML = rooms.map(room => `
        <div class="room-item" data-room-id="${room.id}">
            <span class="room-icon">💼</span>
            <span>${room.name}</span>
        </div>
    `).join('');
    
    roomsContent.querySelectorAll('.room-item').forEach(item => {
        item.addEventListener('click', () => switchRoom(item.dataset.roomId));
    });
}

async function switchRoom(roomId) {
    currentRoomId = roomId;
    sessionStorage.setItem('currentRoomId', roomId);
    
    if (window.currentRoomSubscription) {
        window.currentRoomSubscription.unsubscribe();
    }
    if (window.reactionSubscription) {
        window.reactionSubscription.unsubscribe();
    }
    
    await loadRoomData();
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
        console.error('Failed to load messages:', err);
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
        console.error('Failed to load members:', err);
    }
}

async function loadNotes() {
    try {
        const token = sessionStorage.getItem('authToken') || localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}/rooms/${currentRoomId}/notes`, {
            headers: { 'Authorization': `Bearer ${token}` },
            credentials: 'include'
        });
        
        if (response.ok) {
            notes = await response.json();
            displayNotes();
        }
    } catch (err) {
        console.error('Failed to load notes:', err);
    }
}

function displayMessages() {
    const container = document.getElementById('messagesContainer');
    
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
            <div class="message-reply">
                <strong>${msg.replyTo.username}:</strong> ${msg.replyTo.content}
            </div>
        ` : '';
        
        const reactionsHtml = msg.reactions && msg.reactions.length > 0 ? `
            <div class="message-reactions">
                ${msg.reactions.map(r => `<span class="reaction">${r.emoji}</span>`).join('')}
            </div>
        ` : '';
        
        return `
            <div class="message ${isOwn ? 'own-message' : ''}" data-message-id="${msg.id}">
                <div class="message-header">
                    <strong>${msg.username}</strong>
                    <span class="message-time">${formatTime(msg.timestamp)}</span>
                </div>
                ${replyHtml}
                <div class="message-content">${escapeHtml(msg.content)}</div>
                ${reactionsHtml}
                <div class="message-actions">
                    <button onclick="setReplyTo(${msg.id}, '${escapeHtml(msg.username)}', '${escapeHtml(msg.content)}')">↩️</button>
                    <button onclick="showEmojiPicker(${msg.id})">😊</button>
                    ${isOwn ? `<button onclick="deleteMessage(${msg.id})">🗑️</button>` : ''}
                </div>
            </div>
        `;
    }).join('');
    
    container.scrollTop = container.scrollHeight;
}

function displayMembers(members) {
    const membersList = document.getElementById('membersList');
    membersList.innerHTML = members.map(username => `
        <li class="member-list-item">
            <span class="member-avatar">👤</span>
            <span>${username}</span>
        </li>
    `).join('');
}

function displayNotes() {
    const notesList = document.getElementById('notesList');
    
    if (notes.length === 0) {
        notesList.innerHTML = '<div class="note-empty">No notes yet</div>';
        return;
    }
    
    notesList.innerHTML = notes.map(note => `
        <div class="note-item">
            <div class="note-author">${note.username}</div>
            <div class="note-content">${escapeHtml(note.content)}</div>
        </div>
    `).join('');
}

function setupWebSocket() {
    if (!window.isWebSocketConnected()) {
        console.log('WebSocket not connected, waiting...');
        setTimeout(setupWebSocket, 1000);
        return;
    }
    
    const stomp = window.stompClient;
    
    window.currentRoomSubscription = stomp.subscribe(`/topic/${currentRoomId}/messages`, (message) => {
        const msg = JSON.parse(message.body);
        handleIncomingMessage(msg);
    });
    
    window.reactionSubscription = stomp.subscribe(`/topic/${currentRoomId}/reactions`, (message) => {
        const reaction = JSON.parse(message.body);
        handleIncomingReaction(reaction);
    });
    
    stomp.subscribe(`/topic/${currentRoomId}/typing`, (message) => {
        const data = JSON.parse(message.body);
        showTypingIndicator(data);
    });
    
    stomp.subscribe(`/topic/${currentRoomId}/notes`, (message) => {
        const note = JSON.parse(message.body);
        handleIncomingNote(note);
    });
}

function handleIncomingMessage(msg) {
    if (msg.type === 'DELETE') {
        messages = messages.filter(m => m.id !== msg.id);
    } else if (msg.type === 'UPDATE') {
        const index = messages.findIndex(m => m.id === msg.id);
        if (index !== -1) {
            messages[index] = msg;
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
    
    if (data.typing) {
        indicator.textContent = `${data.username} is typing...`;
        indicator.style.display = 'block';
    } else {
        indicator.style.display = 'none';
    }
}

function sendMessage() {
    const input = document.getElementById('messageInput');
    const content = input.value.trim();
    
    if (!content) return;
    
    const stomp = window.stompClient;
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
    
    replyText.textContent = `Replying to ${username}: ${content.substring(0, 50)}...`;
    preview.style.display = 'block';
}

function clearReply() {
    replyToMessage = null;
    document.getElementById('replyPreview').style.display = 'none';
}

function deleteMessage(messageId) {
    if (!confirm('Delete this message?')) return;
    
    const stomp = window.stompClient;
    stomp.send(`/app/rooms/${currentRoomId}/message`, {}, JSON.stringify({
        id: messageId,
        type: 'DELETE'
    }));
}

function showEmojiPicker(messageId) {
    const picker = document.getElementById('emojiPicker');
    const emojis = ['👍', '❤️', '😂', '😮', '😢', '🎉', '🔥', '👏'];
    
    document.getElementById('emojiGrid').innerHTML = emojis.map(emoji => 
        `<button class="emoji-btn" onclick="reactToMessage(${messageId}, '${emoji}')">${emoji}</button>`
    ).join('');
    
    picker.style.display = 'block';
    setTimeout(() => picker.style.display = 'none', 5000);
}

function reactToMessage(messageId, emoji) {
    const stomp = window.stompClient;
    stomp.send(`/app/rooms/${currentRoomId}/react`, {}, JSON.stringify({
        messageId: messageId,
        username: window.getCurrentUser(),
        emoji: emoji,
        type: 'POST'
    }));
    
    document.getElementById('emojiPicker').style.display = 'none';
}

function addNote() {
    const input = document.getElementById('noteInput');
    const content = input.value.trim();
    
    if (!content) return;
    
    const stomp = window.stompClient;
    stomp.send(`/app/rooms/${currentRoomId}/note`, {}, JSON.stringify({
        roomId: parseInt(currentRoomId),
        username: window.getCurrentUser(),
        content: content
    }));
    
    input.value = '';
}

function openModal(modalId) {
    document.getElementById(modalId).style.display = 'flex';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

function showChatWindow() {
    document.querySelector('.chat-placeholder').style.display = 'none';
    document.querySelector('.chat-window').style.display = 'flex';
    document.getElementById('messageInputContainer').style.display = 'flex';
}

function setupEventListeners() {
    document.getElementById('sendBtn').addEventListener('click', sendMessage);
    document.getElementById('messageInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
    
    document.getElementById('messageInput').addEventListener('input', (e) => {
        clearTimeout(typingTimeout);
        
        const stomp = window.stompClient;
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
    });
    
    document.getElementById('cancelReply').addEventListener('click', clearReply);
    document.getElementById('notesBtn').addEventListener('click', () => openModal('notesModal'));
    document.getElementById('addNoteBtn').addEventListener('click', addNote);
    document.getElementById('homeBtn').addEventListener('click', () => window.navigateTo('landing'));
    document.getElementById('viewProfileBtn').addEventListener('click', () => openModal('viewProfileModal'));
    
    document.querySelectorAll('.window-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const action = e.target.dataset.action;
            
            if (action === 'minimize-chat' || action === 'close-chat') {
                document.querySelector('.chat-window').style.display = 'none';
                document.querySelector('.chat-placeholder').style.display = 'flex';
            } else if (action === 'minimize-files') {
                const filesPanel = document.querySelector('.files-panel');
                const placeholder = document.querySelector('.files-placeholder');
                filesPanel.style.display = 'none';
                placeholder.style.display = 'flex';
            } else if (action === 'minimize-rooms') {
                document.querySelector('.rooms-panel').classList.toggle('minimized');
            }
        });
    });
}

function formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

window.setReplyTo = setReplyTo;
window.deleteMessage = deleteMessage;
window.showEmojiPicker = showEmojiPicker;
window.reactToMessage = reactToMessage;
window.closeModal = closeModal;

displayUsername();
initializeRoom();

window.cleanupPage = function() {
    if (window.currentRoomSubscription) {
        window.currentRoomSubscription.unsubscribe();
        window.currentRoomSubscription = null;
    }
    if (window.reactionSubscription) {
        window.reactionSubscription.unsubscribe();
        window.reactionSubscription = null;
    }
    clearTimeout(typingTimeout);
    console.log('Room page cleanup');
};