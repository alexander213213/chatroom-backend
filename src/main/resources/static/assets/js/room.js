const API_BASE = window.location.origin;
let currentRoomId = null;
let currentRoomName = '';
let messages = [];
let notes = [];
let replyToMessage = null;
let typingTimeout = null;

function displayUsername() {
    const username = window.getCurrentUser();
    const display = document.getElementById('currentUserDisplay');
    if (display) display.textContent = username;
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
                currentRoomName = currentRoom.name;
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
    if (!roomsContent) return;
    
    roomsContent.innerHTML = rooms.map(room => `
        <div class="room-item ${room.id == currentRoomId ? 'active' : ''}" data-room-id="${room.id}">
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
    
    messages = [];
    notes = [];
    
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
        const response = await fetch(`${API_BASE}/rooms/${currentRoomId}/notes?limit=50`, {
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
                <div class="message-content">${escapeHtml(msg.content)}</div>
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
        notesList.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-muted); font-size: 8px;">No notes yet</div>';
        return;
    }
    
    notesList.innerHTML = notes.map(note => `
        <div class="note-item" style="background: white; border: 2px solid var(--border-dark); padding: 10px; margin-bottom: 10px;">
            <div style="font-size: 7px; color: var(--text-muted); margin-bottom: 5px;">${escapeHtml(note.username)}</div>
            <div style="font-size: 8px;">${escapeHtml(note.content)}</div>
        </div>
    `).join('');
}

function setupWebSocket() {
    if (!window.isWebSocketConnected()) {
        console.log('WebSocket not connected, retrying...');
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
    
    const stomp = window.stompClient;
    stomp.send(`/app/rooms/${currentRoomId}/message`, {}, JSON.stringify({
        id: messageId,
        type: 'DELETE'
    }));
}

function showEmojiPicker(messageId, event) {
    const picker = document.getElementById('emojiPicker');
    if (!picker) return;
    
    const emojis = ['👍', '❤️', '😂', '😮', '😢', '🎉', '🔥', '👏'];
    
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
    const stomp = window.stompClient;
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
    
    const stomp = window.stompClient;
    stomp.send(`/app/rooms/${currentRoomId}/note`, {}, JSON.stringify({
        roomId: parseInt(currentRoomId),
        username: window.getCurrentUser(),
        content: content
    }));
    
    input.value = '';
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
    const messageInputContainer = document.getElementById('messageInputContainer');
    
    if (chatPlaceholder) chatPlaceholder.style.display = 'none';
    if (chatWindow) {
        chatWindow.style.display = 'grid';
        chatWindow.classList.add('active');
    }
    if (messageInputContainer) messageInputContainer.style.display = 'flex';
}

function setupEventListeners() {
    const sendBtn = document.getElementById('sendBtn');
    const messageInput = document.getElementById('messageInput');
    const cancelReply = document.getElementById('cancelReply');
    const notesBtn = document.getElementById('notesBtn');
    const addNoteBtn = document.getElementById('addNoteBtn');
    const homeBtn = document.getElementById('homeBtn');
    const viewProfileBtn = document.getElementById('viewProfileBtn');
    
    if (sendBtn) sendBtn.addEventListener('click', sendMessage);
    
    if (messageInput) {
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
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
    }
    
    if (cancelReply) cancelReply.addEventListener('click', clearReply);
    if (notesBtn) notesBtn.addEventListener('click', () => openModal('notesModal'));
    if (addNoteBtn) addNoteBtn.addEventListener('click', addNote);
    if (homeBtn) homeBtn.addEventListener('click', () => window.navigateTo('landing'));
    if (viewProfileBtn) viewProfileBtn.addEventListener('click', () => alert('Profile feature coming soon!'));
    
    document.querySelectorAll('.window-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const action = e.target.dataset.action;
            
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
    
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.emoji-picker') && !e.target.closest('.reaction-btn')) {
            const picker = document.getElementById('emojiPicker');
            if (picker) picker.style.display = 'none';
        }
    });
}

function formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

window.setReplyTo = setReplyTo;
window.deleteMessage = deleteMessage;
window.showEmojiPicker = showEmojiPicker;
window.reactToMessage = reactToMessage;
window.toggleReaction = toggleReaction;
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