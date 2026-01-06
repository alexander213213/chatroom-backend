// ============================================
// LOAD HEAD RESOURCES (CSS & Libraries)
// ============================================
(function loadHeadResources() {
    // Load CSS
    const cssLink = document.createElement('link');
    cssLink.rel = 'stylesheet';
    cssLink.href = 'room.css';
    document.head.appendChild(cssLink);
    
    // Load SockJS
    const sockjsScript = document.createElement('script');
    sockjsScript.src = 'https://cdn.jsdelivr.net/npm/sockjs-client@1/dist/sockjs.min.js';
    document.head.appendChild(sockjsScript);
    
    // Load Stomp
    const stompScript = document.createElement('script');
    stompScript.src = 'https://cdn.jsdelivr.net/npm/stompjs@2.3.3/lib/stomp.min.js';
    document.head.appendChild(stompScript);
    
    // Set meta charset and title
    const meta = document.createElement('meta');
    meta.charset = 'UTF-8';
    document.head.appendChild(meta);
    
    if (!document.title) {
        document.title = 'Chat Room';
    }
})();

// Configuration
const CONFIG = {
    API_BASE: window.location.origin,
    WS_BASE: window.location.origin + '/ws'
};

let currentUsername = null;
let currentRoom = null;
let stompClient = null;
let rooms = [];
let messages = {};
let notes = {}; // Store notes for each room
let typingTimeout = null;
let replyToMessage = null;
let editingMessageId = null;
let editingNoteId = null;
let emojiPickerTarget = null;
let timestampUpdateInterval = null;
let userStatusMap = {}; // Track online/offline status for all users

const emojis = ['👍', '❤️', '😂', '😮', '😢', '😭', '🎉', '🔥', '👀', '💯', '✨', '🚀'];

// ============================================
// NOTIFICATION SYSTEM
// ============================================
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'error' ? '#d87d7d' : type === 'success' ? '#7db87d' : '#c98b73'};
        border: 2px solid #8b5a3c;
        padding: 15px 20px;
        border-radius: 4px;
        color: #4a2c1a;
        font-family: 'Press Start 2P';
        font-size: 8px;
        max-width: 300px;
        z-index: 10000;
        animation: slideIn 0.3s ease-out;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Add animation styles if not already in CSS
if (!document.getElementById('notificationStyles')) {
    const style = document.createElement('style');
    style.id = 'notificationStyles';
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(400px); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(400px); opacity: 0; }
        }
    `;
    document.head.appendChild(style);
}

// ============================================
// MODAL UTILITIES (from room.html)
// ============================================
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('show');
    } else {
        console.error('Modal not found:', modalId);
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('show');
    }
    
    // Clear inputs
    if (modalId === 'createRoomModal') {
        const input = document.getElementById('roomName');
        if (input) input.value = '';
    }
    if (modalId === 'inviteMembersModal') {
        const input = document.getElementById('inviteUsername');
        if (input) input.value = '';
    }
    if (modalId === 'notesModal') {
        const input = document.getElementById('noteInput');
        if (input) input.value = '';
    }
}

// Window controls handler
document.addEventListener('click', function(e) {
    if (e.target.classList.contains('window-btn')) {
        const action = e.target.dataset.action;
        
        if (action === 'minimize-chat') {
            const chatSection = document.querySelector('.chat-window');
            if (chatSection) {
                const isHidden = chatSection.classList.contains('minimized');
                if (isHidden) {
                    chatSection.classList.remove('minimized');
                    chatSection.style.display = 'flex';
                } else {
                    chatSection.classList.add('minimized');
                    chatSection.style.display = 'none';
                }
            }
        } else if (action === 'close-chat') {
            const chatSection = document.querySelector('.chat-window');
            if (chatSection) chatSection.style.display = 'none';
        } else if (action === 'minimize-files') {
            const filesPanel = document.querySelector('.files-panel');
            if (filesPanel) {
                const isHidden = filesPanel.classList.contains('minimized');
                filesPanel.classList.toggle('minimized');
                filesPanel.style.display = isHidden ? 'block' : 'none';
                
                const filesPH = document.querySelector('.files-placeholder');
                if (filesPH) {
                    filesPH.classList.toggle('minimized');
                    filesPH.style.display = isHidden ? 'block' : 'none';
                }
            }
        } else if (action === 'minimize-rooms') {
            const roomsPanel = document.querySelector('.rooms-panel');
            if (roomsPanel) {
                const isHidden = roomsPanel.classList.contains('minimized');
                roomsPanel.classList.toggle('minimized');
                roomsPanel.style.display = isHidden ? 'block' : 'none';
            }
        }
    }
});

// Room context menu for delete/invite
document.addEventListener('contextmenu', function(e) {
    const roomItem = e.target.closest('.room-item');
    if (roomItem && currentRoom) {
        e.preventDefault();
        openModal('inviteMembersModal');
    }
});

// Display current username in header
document.addEventListener('DOMContentLoaded', function() {
    const userDisplay = document.getElementById('currentUserDisplay');
    if (userDisplay) {
        // For development: comment out the line below to use localStorage values
        // localStorage.setItem('username', 'TestUser'); // Dev only - remove for production
        userDisplay.textContent = localStorage.getItem('username') || sessionStorage.getItem('username') || 'Guest';
    }
});

// ============================================
// API LAYER
// ============================================
const api = {
    async request(endpoint, options = {}) {
        const url = `${CONFIG.API_BASE}${endpoint}`;
        const token = localStorage.getItem('token');
        
        const defaultOptions = {
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                ...(token && { 'Authorization': `Bearer ${token}` })
            }
        };
        
        const response = await fetch(url, { ...defaultOptions, ...options });
        
        if (response.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('username');
            window.location.href = 'auth.html';
            return;
        }
        
        return response;
    },
    
    async register(username, password) {
        return await this.request('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });
    },
    
    async login(username, password) {
        return await this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });
    },
    
    async logout() {
        return await this.request('/auth/logout', {
            method: 'POST'
        });
    },
    
    async getRooms() {
        return await this.request('/rooms');
    },
    
    async createRoom(name) {
        return await this.request('/rooms', {
            method: 'POST',
            body: JSON.stringify({ name })
        });
    },
    
    async getRoomMembers(roomId) {
        return await this.request(`/rooms/${roomId}`);
    },
    
    async inviteUsers(roomId, usernames) {
        return await this.request(`/rooms/${roomId}/invite`, {
            method: 'POST',
            body: JSON.stringify(usernames)
        });
    },
    
    async deleteRoom(roomId) {
        return await this.request(`/rooms/${roomId}`, {
            method: 'DELETE'
        });
    },
    
    async getMessages(roomId, before = null, limit = 20) {
        const params = new URLSearchParams({ limit });
        if (before) params.append('before', before);
        return await this.request(`/rooms/${roomId}/messages?${params}`);
    },
    
    async getNotes(roomId, before = null, limit = 20) {
        const params = new URLSearchParams({ limit });
        if (before) params.append('before', before);
        return await this.request(`/rooms/${roomId}/notes?${params}`);
    },

    async uploadFile(roomId, file) {
        const formData = new FormData();
        formData.append('file', file);
        return await this.request(`/rooms/${roomId}/upload`, {
            method: 'POST',
            body: formData
        });
    },

    async getRoomFiles(roomId) {
        return await this.request(`/rooms/${roomId}/files`);
    }
};

// Get avatar for a user
// Cache for user avatars
const userAvatarCache = {};

// Get user avatar from profile or generate fallback
async function getUserAvatar(username) {
    if (!username) return generateDefaultAvatar('');
    
    // Return from cache if available
    if (userAvatarCache[username]) {
        return userAvatarCache[username];
    }
    
    // Try to fetch user profile with avatar from backend
    try {
        const response = await fetch(`${CONFIG.API_BASE}/users/${encodeURIComponent(username)}`);
        if (response.ok) {
            const user = await response.json();
            if (user.avatar) {
                userAvatarCache[username] = user.avatar;
                return user.avatar;
            }
        }
    } catch (error) {
        // Fallback to generated avatar silently
    }
    
    // Fallback to generated avatar
    const generatedAvatar = generateDefaultAvatar(username);
    userAvatarCache[username] = generatedAvatar;
    return generatedAvatar;
}

// Generate default avatar based on username (initials + color)
function generateDefaultAvatar(username) {
    if (!username) return 'https://ui-avatars.com/api/?name=?&background=999999&color=fff&size=48&bold=true';
    
    // Generate initials from username
    const initials = username
        .split(' ')
        .map(word => word[0])
        .join('')
        .toUpperCase()
        .substring(0, 2);
    
    // Generate consistent color based on username hash
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
        hash = ((hash << 5) - hash) + username.charCodeAt(i);
        hash = hash & hash; // Convert to 32-bit integer
    }
    
    const colors = [
        'FF6B6B', '4ECDC4', '45B7D1', 'FFA07A', '98D8C8',
        'F7DC6F', 'BB8FCE', '85C1E2', 'F8B88B', '80D084'
    ];
    const color = colors[Math.abs(hash) % colors.length];
    
    // Use UI Avatars service (free, no registration needed)
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=${color}&color=fff&size=48&bold=true`;
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function init() {
    // Check authentication
    const token = localStorage.getItem('token');
    const username = localStorage.getItem('username');
    
    if (!token || !username) {
        window.location.href = 'auth.html';
        return;
    }
    
    // Set current username
    currentUsername = username;
    
    // Update top bar with current user
    updateTopBar();
    
    setupEventListeners();
    
    // Load rooms and initialize
    loadRooms().then(() => {
        // Connect WebSocket after rooms are loaded
        connectWebSocket();
        
        // Update timestamps every minute
        timestampUpdateInterval = setInterval(() => {
            if (currentRoom && messages[currentRoom.id] && messages[currentRoom.id].length > 0) {
                const container = document.getElementById('messagesContainer');
                const messageElements = container.querySelectorAll('.message');
                messageElements.forEach(msgEl => {
                    const msgId = parseInt(msgEl.dataset.messageId);
                    const msg = messages[currentRoom.id].find(m => m.id === msgId);
                    if (msg && msg.timestamp) {
                        const timestampEl = msgEl.querySelector('.message-timestamp');
                        if (timestampEl) {
                            timestampEl.textContent = formatTime(msg.timestamp);
                        }
                    }
                });
            }
        }, 60000);
    }).catch(error => {
        console.error('Failed to load rooms:', error);
    });
});

function setupEventListeners() {
    // Top bar - Icon buttons
    const topIcons = document.querySelectorAll('.top-icons .icon-btn');
    if (topIcons.length >= 2) {
        // Notifications button
        topIcons[0].addEventListener('click', toggleNotificationModal);
        
        // Home button
        topIcons[1].addEventListener('click', goHome);
    }
    
    // View profile link
    const viewProfile = document.querySelector('.view-profile');
    if (viewProfile) {
        viewProfile.addEventListener('click', (e) => {
            e.preventDefault();
            // Navigate to dashboard
            window.location.href = 'dashboard.html';
        });
    }
    
    // Create room
    const createRoomBtn = document.getElementById('createRoomBtn');
    if (createRoomBtn) {
        createRoomBtn.addEventListener('click', () => {
            openModal('createRoomModal');
        });
    }
    
    const confirmCreateRoom = document.getElementById('confirmCreateRoom');
    if (confirmCreateRoom) {
        confirmCreateRoom.addEventListener('click', createRoom);
    }
    
    // Room members
    const roomMembersBtn = document.getElementById('roomMembersBtn');
    if (roomMembersBtn) {
        roomMembersBtn.addEventListener('click', showRoomMembers);
    }
    
    // Delete room
    const deleteRoomBtn = document.getElementById('deleteRoomBtn');
    if (deleteRoomBtn) {
        deleteRoomBtn.addEventListener('click', deleteCurrentRoom);
    }
    
    // Invite members
    const confirmInvite = document.getElementById('confirmInvite');
    if (confirmInvite) {
        confirmInvite.addEventListener('click', inviteUser);
    }
    
    // Send message
    const sendBtn = document.getElementById('sendBtn');
    const messageInput = document.getElementById('messageInput');
    
    if (sendBtn) {
        sendBtn.addEventListener('click', sendMessage);
    }
    
    if (messageInput) {
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
        // Typing indicator
        messageInput.addEventListener('input', handleTyping);
    }

    // Cancel reply
    const cancelReplyBtn = document.getElementById('cancelReply');
    if (cancelReplyBtn) {
        cancelReplyBtn.addEventListener('click', cancelReply);
    }

    const fileBtn = document.getElementById('fileBtn');
    const fileInput = document.getElementById('fileInput');
    if (fileBtn && fileInput) {
        fileBtn.addEventListener('click', () => {
            fileInput.click();
        });
        fileInput.addEventListener('change', handleFileSelect);
    }
    
    // Modal close buttons
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal');
            if (modal) {
                closeModal(modal.id);
            }
        });
    });
    
    // Close modals on outside click
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal(modal.id);
            }
        });
    });

    // Window controls
    setupWindowControls();
    
    // Setup emoji picker
    setupEmojiPicker();
    
    // Close emoji picker on outside click
    document.addEventListener('click', (e) => {
        const picker = document.getElementById('emojiPicker');
        if (picker && !e.target.closest('.emoji-picker') && !e.target.closest('.message-actions')) {
            picker.style.display = 'none';
        }
    });

    // Notes event listeners
    const notesBtn = document.getElementById('notesBtn');
    const addNoteBtn = document.getElementById('addNoteBtn');
    const noteInput = document.getElementById('noteInput');
    
    
    if (notesBtn) {
        notesBtn.addEventListener('click', () => {
            openModal('notesModal');
        });
    }
    
    if (addNoteBtn) {
        addNoteBtn.addEventListener('click', sendNote);
    }
    
    if (noteInput) {
        noteInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                sendNote();
            }
        });
    }
}

// ============================================
// TOP BAR FUNCTIONS (From dashboard)
// ============================================

// Toggle notification modal
function toggleNotificationModal() {
    const modal = document.getElementById('notificationModal');
    if (!modal) {
        createNotificationModal();
        document.getElementById('notificationModal').style.display = 'block';
    } else {
        modal.style.display = modal.style.display === 'none' ? 'block' : 'none';
    }
}

// Create notification modal
function createNotificationModal() {
    if (document.getElementById('notificationModal')) return;
    
    const modal = document.createElement('div');
    modal.id = 'notificationModal';
    modal.style.cssText = `
        position: fixed;
        top: 90px;
        right: 30px;
        width: 350px;
        max-height: 500px;
        background: var(--bg-panel);
        border: 3px solid var(--border-dark);
        border-radius: 0;
        box-shadow: 0 8px 24px rgba(0,0,0,0.3);
        z-index: 1000;
        display: none;
        overflow: hidden;
    `;
    
    modal.innerHTML = `
        <div style="padding: 15px; border-bottom: 3px solid var(--border-dark); background: var(--bg-panel);">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <h3 style="color: var(--text-main); font-size: 12px; margin: 0; letter-spacing: 1px;">NOTIFICATIONS</h3>
                <button id="closeNotifModal" style="
                    background: transparent;
                    border: none;
                    color: var(--text-main);
                    font-size: 18px;
                    cursor: pointer;
                    padding: 0;
                    width: 24px;
                    height: 24px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                ">×</button>
            </div>
        </div>
        <div id="notificationList" style="max-height: 400px; overflow-y: auto; padding: 10px;"></div>
    `;
    
    document.body.appendChild(modal);
    
    document.getElementById('closeNotifModal').addEventListener('click', () => {
        modal.style.display = 'none';
    });
    
    document.addEventListener('click', (e) => {
        if (!modal.contains(e.target) && !e.target.closest('.icon-btn')) {
            modal.style.display = 'none';
        }
    });
    
    renderNotifications();
}

// Render notifications in modal
function renderNotifications() {
    const notifList = document.getElementById('notificationList');
    if (!notifList) return;
    
    const mockNotifications = [
        { id: 1, type: 'message', text: 'New message in ' + (currentRoom?.name || 'room'), time: '5m ago' },
        { id: 2, type: 'invite', text: 'You have been invited to a room', time: '1h ago' },
        { id: 3, type: 'status', text: 'A team member came online', time: '2h ago' }
    ];
    
    if (mockNotifications.length === 0) {
        notifList.innerHTML = `
            <div style="text-align: center; padding: 40px 20px; color: var(--text-muted); font-size: 8px;">
                No new notifications
            </div>
        `;
        return;
    }
    
    notifList.innerHTML = mockNotifications.map(notif => `
        <div class="notification-item" data-id="${notif.id}" style="
            background: white;
            border: 2px solid var(--border-dark);
            padding: 12px;
            margin-bottom: 8px;
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            cursor: pointer;
            transition: all 0.2s;
        ">
            <div style="flex: 1;">
                <div style="color: var(--text-main); font-size: 8px; margin-bottom: 4px; font-weight: bold;">
                    ${notif.type === 'invite' ? '📨' : notif.type === 'status' ? '🟢' : '💬'} ${notif.text}
                </div>
                <div style="color: var(--text-muted); font-size: 7px;">
                    ${notif.time}
                </div>
            </div>
        </div>
    `).join('');
}

// Go home (navigate to landing/dashboard)
function goHome() {
    if (typeof navigateTo === 'function') {
        navigateTo('landing');
    } else {
        window.location.href = 'index.html';
    }
}

// Update top bar with current user info
function updateTopBar() {
    const topAvatar = document.querySelector('.top-bar .avatar');
    const topUsername = document.querySelector('.top-bar .username');
    const currentUserDisplay = document.getElementById('currentUserDisplay');
    
    if (topAvatar) topAvatar.textContent = '👨‍💻';
    if (topUsername) topUsername.textContent = currentUsername || 'Loading...';
    if (currentUserDisplay) currentUserDisplay.textContent = currentUsername || 'Loading...';
}

// Modal management
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('show');
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('show');
    }
    
    // Clear inputs
    if (modalId === 'createRoomModal') {
        const roomNameInput = document.getElementById('roomName');
        if (roomNameInput) roomNameInput.value = '';
    }
    if (modalId === 'inviteMembersModal') {
        const inviteInput = document.getElementById('inviteUsername');
        if (inviteInput) inviteInput.value = '';
    }
}

// Authentication - Logout
async function logout() {
    try {
        await api.logout();
    } catch (error) {
        console.error('Logout error:', error);
    }
    
    if (window.stompClient) {
        window.stompClient.disconnect();
    }
    
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    window.location.href = 'auth.html';
}

// Room management - Load rooms
async function loadRooms() {
    try {
        const response = await api.getRooms();
        if (response.ok) {
            const data = await response.json();
            // Handle both array and object with rooms property
            const roomsList = Array.isArray(data) ? data : (data.rooms || []);
            rooms = roomsList; // Store globally
            renderRooms(roomsList);
        } else {
            console.error('Failed to load rooms:', response.status);
        }
    } catch (error) {
        console.error('Error loading rooms:', error);
    }
}

// Room management - Render rooms
function renderRooms(roomsList = []) {
    const roomsContent = document.querySelector('.rooms-content');
    if (!roomsContent) return;
    
    roomsContent.innerHTML = '';
    
    if (roomsList.length === 0) {
        roomsContent.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-muted); font-size: 12px;">No rooms yet. Create one!</div>';
        return;
    }
    
    roomsList.forEach(room => {
        const roomDiv = document.createElement('div');
        roomDiv.className = 'room-item';
        roomDiv.dataset.roomId = room.id;
        if (currentRoom && currentRoom.id === room.id) {
            roomDiv.classList.add('active');
        }
        roomDiv.innerHTML = `<span class="room-icon">${room.icon || '💬'}</span><span>${room.name}</span>`;
        roomDiv.addEventListener('click', () => selectRoomFromList(room));
        roomsContent.appendChild(roomDiv);
    });
}

// Room management - Create room
async function createRoom() {
    const roomNameInput = document.getElementById('roomName');
    if (!roomNameInput) return;
    
    const roomName = roomNameInput.value.trim();
    
    if (!roomName) {
        showNotification('Please enter a room name', 'error');
        return;
    }
    
    try {
        const response = await api.createRoom(roomName);
        if (response.ok) {
            roomNameInput.value = '';
            closeModal('createRoomModal');
            await loadRooms();
            showNotification('Room created successfully', 'success');
        } else if (response.status === 409) {
            showNotification('Room already exists', 'error');
        } else {
            showNotification('Failed to create room', 'error');
        }
    } catch (error) {
        console.error('Error creating room:', error);
        showNotification('Could not create room', 'error');
    }
}

// Load messages from API
async function loadMessages(roomId) {
    try {
        const response = await api.getMessages(roomId);
        if (response.ok) {
            const data = await response.json();
            // Handle both array and object with messages property
            messages[roomId] = Array.isArray(data) ? data : (data.messages || []);
            renderMessages();
        } else {
            console.error('Failed to load messages:', response.status);
            // Try to load from localStorage
            const storedMessages = localStorage.getItem(`messages_${roomId}`);
            messages[roomId] = storedMessages ? JSON.parse(storedMessages) : [];
        }
    } catch (error) {
        console.error('Error loading messages:', error);
        // Try to load from localStorage
        const storedMessages = localStorage.getItem(`messages_${roomId}`);
        messages[roomId] = storedMessages ? JSON.parse(storedMessages) : [];
    }
}

// Show room members modal
async function showRoomMembers() {
    if (!currentRoom) return;
    
    try {
        const response = await api.getRoomMembers(currentRoom.id);
        if (response.ok) {
            const members = await response.json();
            const membersList = document.getElementById('membersList');
            if (membersList) {
                membersList.innerHTML = '';
                
                // Handle both array of strings and array of objects
                const memberArray = Array.isArray(members) ? members : (members.members || []);
                memberArray.forEach(member => {
                    const memberName = typeof member === 'string' ? member : member.username;
                    const memberDiv = document.createElement('div');
                    memberDiv.className = 'member-item';
                    memberDiv.textContent = memberName;
                    membersList.appendChild(memberDiv);
                });
                
                openModal('inviteMembersModal');
            }
        }
    } catch (error) {
        console.error('Error loading members:', error);
    }
}

// Invite user to room
async function inviteUser() {
    const inviteUsernameInput = document.getElementById('inviteUsername');
    if (!inviteUsernameInput) return;
    
    const username = inviteUsernameInput.value.trim();
    
    if (!username || !currentRoom) return;
    
    try {
        const response = await api.inviteUsers(currentRoom.id, [username]);
        if (response.ok) {
            inviteUsernameInput.value = '';
            await showRoomMembers(); // Refresh members list
            showNotification('User invited successfully', 'success');
        } else {
            showNotification('Failed to invite user', 'error');
        }
    } catch (error) {
        console.error('Error inviting user:', error);
        showNotification('Could not invite user', 'error');
    }
}

// Delete current room
async function deleteCurrentRoom() {
    if (!currentRoom) return;
    
    if (!confirm(`Delete room "${currentRoom.name}"? This cannot be undone.`)) return;
    
    try {
        const response = await api.deleteRoom(currentRoom.id);
        if (response.ok) {
            currentRoom = null;
            await loadRooms();
            
            // Reset chat area
            const roomNameElement = document.querySelector('.chat-titlebar .window-title');
            if (roomNameElement) roomNameElement.textContent = 'Select a room';
            
            const roomMembersBtn = document.getElementById('roomMembersBtn');
            const deleteRoomBtn = document.getElementById('deleteRoomBtn');
            const messageInputContainer = document.getElementById('messageInputContainer');
            const filesContent = document.getElementById('filesContent');
            if (roomMembersBtn) roomMembersBtn.style.display = 'none';
            if (deleteRoomBtn) deleteRoomBtn.style.display = 'none';
            if (messageInputContainer) messageInputContainer.style.display = 'none';
            if (filesContent) filesContent.style.display = 'none';
            
            const container = document.getElementById('messagesContainer');
            if (container) {
                container.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-muted);">Select a room to start chatting</div>';
            }
            showNotification('Room deleted successfully', 'success');
        } else if (response.status === 403) {
            showNotification('You do not have permission to delete this room', 'error');
        }
    } catch (error) {
        console.error('Error deleting room:', error);
        showNotification('Could not delete room', 'error');
    }
}

// Helper function to select room from list
function selectRoomFromList(room) {
    selectRoom(room);
}

function setupWindowControls() {
    const chatWindow = document.querySelector('.chat-window');
    const filesPanel = document.querySelector('.files-panel');
    const roomsPanel = document.querySelector('.rooms-panel');

    // Minimize/Restore chat window
    document.querySelector('[data-action="minimize-chat"]')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const chatMain = chatWindow.querySelector('.chat-main');
        if (chatMain.style.display === 'none') {
            chatMain.style.display = 'grid';
        } else {
            chatMain.style.display = 'none';
        }
    });

    // Restore on titlebar click when minimized
    document.querySelector('.chat-titlebar')?.addEventListener('click', (e) => {
        if (!e.target.classList.contains('window-btn')) {
            const chatMain = chatWindow.querySelector('.chat-main');
            if (chatMain.style.display === 'none') {
                chatMain.style.display = 'grid';
            }
        }
    });

    // Close chat window (and files panel, show placeholders, keep rooms)
    document.querySelector('[data-action="close-chat"]')?.addEventListener('click', () => {
        chatWindow.style.display = 'none';
        filesPanel.style.display = 'none';
        
        // Show placeholder boxes
        document.querySelector('.chat-placeholder').classList.add('visible');
        document.querySelector('.files-placeholder').classList.add('visible');
        
        // Keep rooms panel visible
    });

    // Minimize/Restore files panel
    document.querySelector('[data-action="minimize-files"]')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const filesContent = filesPanel.querySelector('.files-content');
        if (filesContent.style.display === 'none') {
            filesContent.style.display = 'block';
        } else {
            filesContent.style.display = 'none';
        }
    });

    document.querySelector('.files-panel .window-titlebar')?.addEventListener('click', (e) => {
        if (!e.target.classList.contains('window-btn')) {
            const filesContent = filesPanel.querySelector('.files-content');
            if (filesContent.style.display === 'none') {
                filesContent.style.display = 'block';
            }
        }
    });

    // Minimize/Restore rooms panel
    document.querySelector('[data-action="minimize-rooms"]')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const roomsContent = roomsPanel.querySelector('.rooms-content');
        if (roomsContent.style.display === 'none') {
            roomsContent.style.display = 'block';
        } else {
            roomsContent.style.display = 'none';
        }
    });

    document.querySelector('.rooms-panel .window-titlebar')?.addEventListener('click', (e) => {
        if (!e.target.classList.contains('window-btn')) {
            const roomsContent = roomsPanel.querySelector('.rooms-content');
            if (roomsContent.style.display === 'none') {
                roomsContent.style.display = 'block';
            }
        }
    });

    // Room selection - reopens chat window
    document.querySelectorAll('.room-item').forEach(roomItem => {
        roomItem.addEventListener('click', () => {
            // Remove active class from all rooms
            document.querySelectorAll('.room-item').forEach(r => r.classList.remove('active'));
            // Add active class to clicked room
            roomItem.classList.add('active');
            
            // Show chat and files, hide placeholders
            chatWindow.style.display = 'grid';
            filesPanel.style.display = 'flex';
            document.querySelector('.chat-placeholder').classList.remove('visible');
            document.querySelector('.files-placeholder').classList.remove('visible');
            
            // Reset minimized states - show content
            const chatMain = chatWindow.querySelector('.chat-main');
            const filesContent = filesPanel.querySelector('.files-content');
            chatMain.style.display = 'grid';
            filesContent.style.display = 'block';
            
            const roomId = roomItem.dataset.roomId;
            const roomName = roomItem.textContent.trim();
            
            // Update room title
            document.querySelector('.chat-titlebar .window-title').textContent = roomName;
            
            // Here you would load messages for this room
            selectRoom({ id: roomId, name: roomName });
        });
    });
}

// Handle file selection
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (!currentRoom) {
        showNotification('Please select a room first', 'error');
        event.target.value = ''; // Reset input
        return;
    }
    
    // Check file size (e.g., 10MB limit)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
        showNotification('File is too large. Maximum size is 10MB.', 'error');
        event.target.value = ''; // Reset input
        return;
    }
    
    // TODO: Upload file to server
    uploadFile(file);
    
    // Reset file input so same file can be selected again
    event.target.value = '';
}

// Upload file to server
async function uploadFile(file) {
    if (!currentRoom) return;
    
    try {
        const response = await api.uploadFile(currentRoom.id, file);
        
        if (response.ok) {
            showNotification('File uploaded successfully', 'success');
            await loadRoomFiles(currentRoom.id);
        } else {
            throw new Error('Upload failed');
        }
    } catch (error) {
        // Offline mode: add file to local list
        console.warn('Offline mode: adding file to local list');
        
        if (!window.localFiles) window.localFiles = {};
        if (!window.localFiles[currentRoom.id]) window.localFiles[currentRoom.id] = [];
        window.localFiles[currentRoom.id].push({
            id: Date.now(),
            name: file.name,
            icon: getFileIcon(file.name), // Use filename for better icon mapping
            type: file.type,
            size: file.size
        });
        
        renderRoomFiles();
    }
}

// Get appropriate icon for file type
function getFileIcon(mimeTypeOrFilename) {
    const lowerInput = (mimeTypeOrFilename || '').toLowerCase();
    
    // Check by file extension first (more reliable)
    if (lowerInput.endsWith('.pdf')) return '📄';
    if (lowerInput.endsWith('.pptx') || lowerInput.endsWith('.ppt')) return '📄';
    if (lowerInput.endsWith('.xlsx') || lowerInput.endsWith('.xls')) return '📊';
    if (lowerInput.endsWith('.jpg') || lowerInput.endsWith('.jpeg') || lowerInput.endsWith('.png') || lowerInput.endsWith('.gif') || lowerInput.endsWith('.bmp')) return '📷';
    if (lowerInput.endsWith('.txt')) return '📋';
    
    // Check by MIME type
    if (lowerInput.includes('pdf')) return '📄';
    if (lowerInput.includes('powerpoint') || lowerInput.includes('presentation')) return '📄';
    if (lowerInput.includes('excel') || lowerInput.includes('spreadsheet')) return '📊';
    if (lowerInput.startsWith('image/')) return '📷';
    if (lowerInput.includes('text/plain')) return '📋';
    if (lowerInput.startsWith('video/')) return '🎬';
    if (lowerInput.startsWith('audio/')) return '🎵';
    if (lowerInput.includes('zip') || lowerInput.includes('rar') || lowerInput.includes('archive')) return '📦';
    if (lowerInput.includes('word') || lowerInput.includes('document')) return '📄';
    
    return '📄'; // Default file icon
}

// Toggle reaction on a message
function toggleReaction(messageId, emoji) {
    if (!currentRoom) return;
    
    const msg = messages[currentRoom.id]?.find(m => m.id === messageId);
    if (!msg) return;
    
    const userReaction = msg?.reactions?.find(r => r.username === currentUsername);
    
    if (stompClient && stompClient.connected) {
        if (userReaction) {
            stompClient.send(`/app/rooms/${currentRoom.id}/react`, {}, JSON.stringify({
                messageId: messageId,
                username: currentUsername,
                type: 'DELETE'
            }));
        } else {
            stompClient.send(`/app/rooms/${currentRoom.id}/react`, {}, JSON.stringify({
                messageId: messageId,
                username: currentUsername,
                emoji: emoji,
                type: 'POST'
            }));
        }
    } else {
        // Offline mode: toggle locally
        if (!msg.reactions) msg.reactions = [];
        if (userReaction) {
            msg.reactions = msg.reactions.filter(r => r.username !== currentUsername);
        } else {
            msg.reactions.push({ username: currentUsername, emoji: emoji, messageId: messageId });
        }
        renderMessages();
    }
}

// Reply to a message
function replyToMsg(messageId) {
    const msg = messages[currentRoom.id].find(m => m.id === messageId);
    if (!msg) return;
    
    replyToMessage = messageId;
    document.getElementById('replyPreview').style.display = 'flex';
    document.getElementById('replyText').textContent = `Replying to ${msg.username}: ${msg.content}`;
    document.getElementById('messageInput').focus();
}

// Cancel reply
function cancelReply() {
    replyToMessage = null;
    document.getElementById('replyPreview').style.display = 'none';
}

// Edit message
function editMessage(messageId) {
    const msg = messages[currentRoom.id].find(m => m.id === messageId);
    if (!msg) return;
    
    editingMessageId = messageId;
    document.getElementById('messageInput').value = msg.content;
    document.getElementById('messageInput').focus();
}

// Delete message
function deleteMessage(messageId) {
    if (!confirm('Delete this message?')) return;
    if (!currentRoom) return;
    
    if (stompClient && stompClient.connected) {
        stompClient.send(`/app/rooms/${currentRoom.id}/message`, {}, JSON.stringify({
            id: messageId,
            type: 'DELETE'
        }));
    } else {
        // Offline mode: delete locally
        messages[currentRoom.id] = messages[currentRoom.id].filter(m => m.id !== messageId);
        renderMessages();
    }
}

// Show emoji picker for message
function showEmojiPickerForMessage(event, messageId) {
    event.stopPropagation();
    emojiPickerTarget = messageId;
    
    const picker = document.getElementById('emojiPicker');
    const button = event.currentTarget;
    const rect = button.getBoundingClientRect();
    
    picker.style.display = 'block';
    
    const pickerWidth = 210;
    const pickerHeight = 150;
    
    // Position to the left of the button, above it
    let left = rect.left - pickerWidth - 10;
    let top = rect.top - pickerHeight / 2 + rect.height / 2;
    
    // Keep within viewport
    if (left < 10) {
        left = rect.right + 10;
    }
    
    if (top < 10) {
        top = 10;
    }
    
    if (top + pickerHeight > window.innerHeight - 10) {
        top = window.innerHeight - pickerHeight - 10;
    }
    
    picker.style.top = `${top}px`;
    picker.style.left = `${left}px`;
}

// Setup emoji picker
function setupEmojiPicker() {
    const grid = document.getElementById('emojiGrid');
    if (!grid) return;
    
    grid.innerHTML = '';
    
    emojis.forEach(emoji => {
        const item = document.createElement('div');
        item.className = 'emoji-item';
        item.textContent = emoji;
        item.onclick = () => selectEmoji(emoji);
        grid.appendChild(item);
    });
}

// Select emoji from picker
function selectEmoji(emoji) {
    if (!emojiPickerTarget || !currentRoom) return;
    
    const msg = messages[currentRoom.id].find(m => m.id === emojiPickerTarget);
    if (!msg) return;
    
    const userReaction = msg?.reactions?.find(r => r.username === currentUsername);
    
    if (stompClient && stompClient.connected) {
        if (userReaction) {
            stompClient.send(`/app/rooms/${currentRoom.id}/react`, {}, JSON.stringify({
                messageId: emojiPickerTarget,
                username: currentUsername,
                emoji: emoji,
                type: 'UPDATE'
            }));
        } else {
            stompClient.send(`/app/rooms/${currentRoom.id}/react`, {}, JSON.stringify({
                messageId: emojiPickerTarget,
                username: currentUsername,
                emoji: emoji,
                type: 'POST'
            }));
        }
    } else {
        // Offline mode: add reaction locally
        if (!msg.reactions) msg.reactions = [];
        if (userReaction) {
            userReaction.emoji = emoji;
        } else {
            msg.reactions.push({ username: currentUsername, emoji: emoji, messageId: emojiPickerTarget });
        }
        renderMessages();
    }
    
    document.getElementById('emojiPicker').style.display = 'none';
    emojiPickerTarget = null;
}

// Start replying to a message
function startReply(msg) {
    currentReply = {
        id: msg.id,
        username: msg.username,
        content: msg.content
    };
    
    // Update input placeholder
    const messageInput = document.getElementById('messageInput');
    messageInput.placeholder = `Replying to ${msg.username}...`;
    
    // Show reply indicator
    showReplyIndicator();
}

// Show reply indicator above input
function showReplyIndicator() {
    let indicator = document.getElementById('replyIndicator');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'replyIndicator';
        const chatInput = document.querySelector('.chat-input');
        chatInput.parentNode.insertBefore(indicator, chatInput);
    }
    
    indicator.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
                <strong>Reply to ${escapeHtml(currentReply.username)}:</strong> ${escapeHtml(currentReply.content.substring(0, 50))}${currentReply.content.length > 50 ? '...' : ''}
            </div>
            <button id="cancelReply">✕</button>
        </div>
    `;
    
    document.getElementById('cancelReply').addEventListener('click', cancelReply);
}

// Send messages
function sendMessage() {
    const messageInput = document.getElementById('messageInput');
    const content = messageInput.value.trim();
    
    if (!content) {
        return;
    }
    
    if (!currentRoom) {
        console.error('No room selected');
        return;
    }
    
    // If WebSocket is connected, send via WebSocket
    if (stompClient && stompClient.connected) {
        try {
            if (editingMessageId) {
                // Update message
                stompClient.send(`/app/rooms/${currentRoom.id}/message`, {}, JSON.stringify({
                    id: editingMessageId,
                    username: currentUsername,
                    content: content,
                    type: 'UPDATE'
                }));
                editingMessageId = null;
            } else {
                // New message
                const message = {
                    username: currentUsername,
                    content: content,
                    type: 'POST'
                };
                
                if (replyToMessage) {
                    message.replyTo = replyToMessage;
                }
                
                stompClient.send(`/app/rooms/${currentRoom.id}/message`, {}, JSON.stringify(message));
            }
            
        } catch (error) {
            console.error('Error sending message via WebSocket:', error);
        }
    } else {
        // Fallback: add message locally for offline/standalone mode
        console.warn('WebSocket not connected - adding message locally');
        
        if (!messages[currentRoom.id]) {
            messages[currentRoom.id] = [];
        }
        
        // Create local message
        const localMessage = {
            id: Date.now(),
            username: currentUsername,
            content: content,
            timestamp: new Date().toISOString(),
            type: 'POST'
        };
        
        if (replyToMessage) {
            localMessage.replyTo = replyToMessage;
        }
        
        messages[currentRoom.id].push(localMessage);
        // Save to localStorage
        localStorage.setItem(`messages_${currentRoom.id}`, JSON.stringify(messages[currentRoom.id]));
        renderMessages();
    }
    
    messageInput.value = '';
    cancelReply();
    sendTypingStatus(false);
}

// Handle typing indicator
function handleTyping() {
    if (!currentRoom || !stompClient) return;
    
    sendTypingStatus(true);
    
    if (typingTimeout) {
        clearTimeout(typingTimeout);
    }
    
    typingTimeout = setTimeout(() => {
        sendTypingStatus(false);
    }, 3000);
}

// Send typing status
function sendTypingStatus(isTyping) {
    if (!currentRoom || !stompClient) return;
    
    stompClient.send(`/app/rooms/${currentRoom.id}/typing`, {}, JSON.stringify({
        username: currentUsername,
        typing: isTyping
    }));
}

// Display messages in UI
function renderMessages() {
    const container = document.getElementById('messagesContainer');
    
    if (!container) {
        console.error('Messages container not found');
        return;
    }
    
    // Clear container
    container.innerHTML = '';
    
    // Check if room is selected and has messages
    if (!currentRoom || !messages[currentRoom.id] || messages[currentRoom.id].length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: var(--text-muted); font-size: 8px;">
                No messages yet. Start the conversation!
            </div>
        `;
        return;
    }
    
    // Sort messages by ID
    const sortedMessages = [...messages[currentRoom.id]].sort((a, b) => a.id - b.id);
    
    // Create and append message elements
    sortedMessages.forEach(msg => {
        const messageElement = createMessageElement(msg);
        container.appendChild(messageElement);
    });
    
    // Scroll to bottom to show latest messages
    scrollToBottom();
}

// Create message elements
function createMessageElement(msg) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message';
    messageDiv.dataset.messageId = msg.id;
    
    const isOwnMessage = msg.username === currentUsername;
    const userAvatar = getUserAvatar(msg.username);
    
    let html = `
        <div class="message-header">
            <img src="${userAvatar}" alt="${msg.username}" class="message-avatar" style="width: 24px; height: 24px; border-radius: 3px; margin-right: 8px;">
            <span class="message-username">${msg.username}</span>
            <span class="message-timestamp">${formatTime(msg.timestamp)}</span>
        </div>
    `;
    
    if (msg.replyTo) {
        // Handle both cases: full object or just ID
        const replyContent = msg.replyTo.content || 
                           messages[currentRoom.id]?.find(m => m.id === msg.replyTo)?.content ||
                           'Message';
        html += `
            <div class="message-reply-preview">
                Replying to: ${escapeHtml(replyContent)}
            </div>
        `;
    }
    
    html += `<div class="message-content">${escapeHtml(msg.content)}</div>`;
    
    // Add reactions
    if (msg.reactions && msg.reactions.length > 0) {
        const reactionGroups = {};
        msg.reactions.forEach(r => {
            if (!reactionGroups[r.emoji]) {
                reactionGroups[r.emoji] = [];
            }
            reactionGroups[r.emoji].push(r.username);
        });
        
        html += '<div class="message-reactions">';
        Object.entries(reactionGroups).forEach(([emoji, users]) => {
            const userReacted = users.includes(currentUsername);
            html += `
                <div class="reaction ${userReacted ? 'user-reacted' : ''}" onclick="toggleReaction(${msg.id}, '${emoji}')">
                    <span>${emoji}</span>
                    <span class="reaction-count">${users.length}</span>
                </div>
            `;
        });
        html += '</div>';
    }
    
    // Add action buttons for everyone (reply + react)
    html += `
        <div class="message-actions">
            <button class="icon-btn" onclick="replyToMsg(${msg.id})" title="Reply">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="9 14 4 9 9 4"></polyline>
                    <path d="M20 20v-7a4 4 0 0 0-4-4H4"></path>
                </svg>
            </button>
            <button class="icon-btn" onclick="showEmojiPickerForMessage(event, ${msg.id})" title="React">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <path d="M8 14s1.5 2 4 2 4-2 4-2"></path>
                    <line x1="9" y1="9" x2="9.01" y2="9"></line>
                    <line x1="15" y1="9" x2="15.01" y2="9"></line>
                </svg>
            </button>
    `;
    
    // Add edit/delete only for own messages
    if (isOwnMessage) {
        html += `
            <button class="icon-btn" onclick="editMessage(${msg.id})" title="Edit">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
            </button>
            <button class="icon-btn" onclick="deleteMessage(${msg.id})" title="Delete">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
            </button>
        `;
    }
    
    html += '</div>';
    
    messageDiv.innerHTML = html;
    return messageDiv;
}

// Format time for messages
function formatTime(timestamp) {
    if (!timestamp) return 'Just now';
    
    const date = new Date(timestamp);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
        console.warn('Invalid timestamp:', timestamp);
        return 'Just now';
    }
    
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Scroll to bottom of messages
function scrollToBottom() {
    const container = document.getElementById('messagesContainer');
    if (container) {
        // If no messages, scroll to top; otherwise scroll to bottom
        if (!currentRoom || !messages[currentRoom.id] || messages[currentRoom.id].length === 0) {
            container.scrollTop = 0;
        } else {
            container.scrollTop = container.scrollHeight;
        }
    }
}

// ============================================
// DATA LOADING FUNCTIONS
// ============================================

// Load team members for a room
async function loadRoomMembers(roomId) {
    try {
        const response = await api.getRoomMembers(roomId);
        if (!response.ok) throw new Error('API unavailable');
        const data = await response.json();
        console.log('Room members loaded from API:', data);
        
        // Extract member usernames and render
        const membersList = Array.isArray(data) ? data : (data.members || []);
        renderTeamMembers(membersList);
    } catch (error) {
        // Offline mode - show no members
        console.warn('Offline mode: no server members available');
        renderTeamMembers([]);
    }
}

// Render team members in the sidebar
function renderTeamMembers(members = []) {
    const memberList = document.getElementById('membersList');
    
    if (!memberList) {
        console.error('Member list element not found');
        return;
    }
    
    // Clear existing members
    memberList.innerHTML = '';
    
    // If no members, show message
    if (members.length === 0) {
        memberList.innerHTML = '<li class="member-item" style="color: var(--text-muted); font-size: 7px;">No members available</li>';
        return;
    }
    
    // Render each member
    members.forEach(member => {
        const memberEl = document.createElement('li');
        memberEl.className = 'member';
        
        const username = escapeHtml(member.username || member);
        const userAvatar = getUserAvatar(username);
        
        // Get status from userStatusMap, default to 'offline'
        const memberStatus = userStatusMap[username] || 'offline';
        
        memberEl.innerHTML = `
            <img src="${userAvatar}" alt="${username}" style="width: 24px; height: 24px; border-radius: 3px; margin-right: 8px;">
            <div class="member-status ${memberStatus}" title="${memberStatus.charAt(0).toUpperCase() + memberStatus.slice(1)}"></div>
            <span class="member-name">${username}</span>
        `;
        
        memberList.appendChild(memberEl);
    });
    
    console.log(`Rendered ${members.length} team members`);
}

// Update individual member's status display in the UI
function updateMemberStatusDisplay(username, status) {
    const memberElements = document.querySelectorAll('.member');
    
    memberElements.forEach((element) => {
        const memberName = element.querySelector('.member-name')?.textContent;
        
        if (memberName === username) {
            const statusIndicator = element.querySelector('.member-status');
            if (statusIndicator) {
                statusIndicator.className = `member-status ${status}`;
                // Update title on hover
                statusIndicator.title = status.charAt(0).toUpperCase() + status.slice(1);
            }
        }
    });
}

// Update current user's status display
function updateUserStatus() {
    const statusIndicator = document.querySelector('.status-indicator');
    
    if (!statusIndicator) {
        console.error('Status indicator not found');
        return;
    }
    
    // Assume online if WebSocket is connected, offline otherwise
    const isConnected = stompClient && stompClient.connected;
    const userStatus = isConnected ? 'online' : 'offline';
    
    const statusDot = statusIndicator.querySelector('.status-dot');
    const statusText = statusIndicator.querySelector('span');
    
    if (statusDot && statusText) {
        statusDot.className = `status-dot ${userStatus}`;
        statusText.textContent = userStatus.charAt(0).toUpperCase() + userStatus.slice(1);
    }
    
    console.log(`User status: ${userStatus}`);
}

// Load files for a room
async function loadRoomFiles(roomId) {
    if (!roomId) return;
    
    try {
        const response = await api.getRoomFiles(roomId);
        if (!response.ok) throw new Error('API unavailable');
        const data = await response.json();
        
        // Store files if we get them
        if (data && data.files) {
            if (!window.serverFiles) window.serverFiles = {};
            window.serverFiles[roomId] = data.files;
            console.log('Room files loaded from API:', data.files);
        }
    } catch (error) {
        // Offline mode - files panel will be empty or use local files
        console.warn('Offline mode: files from server unavailable');
    }
    renderRoomFiles();
}

// Render files in the files panel
function renderRoomFiles() {
    const filesContent = document.querySelector('.files-content');
    
    if (!filesContent) {
        console.error('Files content element not found');
        return;
    }
    
    // Clear existing files
    filesContent.innerHTML = '';
    
    if (!currentRoom) {
        filesContent.innerHTML = '<p style="color: var(--text-muted); padding: 10px; font-size: 8px;">Select a room to view files</p>';
        return;
    }
    
    // Get current room's files from both server and local
    const serverFiles = window.serverFiles && window.serverFiles[currentRoom.id] ? window.serverFiles[currentRoom.id] : [];
    const localFiles = window.localFiles && window.localFiles[currentRoom.id] ? window.localFiles[currentRoom.id] : [];
    const allFiles = [...serverFiles, ...localFiles];
    
    if (allFiles.length === 0) {
        filesContent.innerHTML = '<p style="color: var(--text-muted); padding: 10px; font-size: 8px;">No files shared yet</p>';
        return;
    }
    
    // Render each file
    allFiles.forEach(file => {
        const fileEl = document.createElement('div');
        fileEl.className = 'file-item';
        fileEl.style.cssText = 'padding: 8px; margin: 5px 0; background: var(--bg-panel); border-radius: 4px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; border: 1px solid var(--border-dark);';
        
        const icon = getFileIcon(file.name || '');
        fileEl.innerHTML = `
            <span style="flex: 1; font-size: 8px;">${icon} ${file.name || file.originalName || 'Unnamed'}</span>
            <small style="color: var(--text-muted); font-size: 7px;">${file.size ? (file.size / 1024).toFixed(2) + ' KB' : ''}</small>
        `;
        fileEl.onclick = () => handleFileClick(file);
        filesContent.appendChild(fileEl);
    });
}

// Handle file click
function handleFileClick(file) {
    console.log('File clicked:', file.name || file.originalName);
    
    // If it's a local file (from local storage), show download option
    if (file.dataUrl) {
        const link = document.createElement('a');
        link.href = file.dataUrl;
        link.download = file.name || file.originalName || 'download';
        link.click();
    } else if (file.id) {
        // Backend file - try to download
        window.open(`${CONFIG.API_BASE}/api/files/${file.id}/download`, '_blank');
    }
    
    showNotification(`Opening file: ${file.name || file.originalName}`, 'info');
}

// Load available rooms
async function loadAvailableRooms() {
    try {
        const response = await api.getRooms();
        if (!response.ok) throw new Error('API unavailable');
        const data = await response.json();
        console.log('Available rooms loaded from API');
        renderAvailableRooms(data.rooms);
    } catch (error) {
        // Offline mode - rooms are already in HTML
        console.warn('Offline mode: using rooms from HTML');
    }
}

// Render available rooms (optional - for dynamic room list)
function renderAvailableRooms(rooms) {
    const roomsContent = document.querySelector('.rooms-content');
    
    if (!roomsContent) {
        console.error('Rooms content element not found');
        return;
    }
    
    // Clear existing rooms
    roomsContent.innerHTML = '';
    
    // Render each room
    rooms.forEach((room, index) => {
        const roomDiv = document.createElement('div');
        roomDiv.className = 'room-item';
        roomDiv.dataset.roomId = room.id;
        
        // Mark first room as active
        if (index === 0) {
            roomDiv.classList.add('active');
        }
        
        roomDiv.innerHTML = `
            <span class="room-icon">${room.icon || '💬'}</span>
            <span>${escapeHtml(room.name)}</span>
        `;
        
        // Add click handler
        roomDiv.addEventListener('click', () => {
            // Remove active from all
            document.querySelectorAll('.room-item').forEach(r => r.classList.remove('active'));
            roomDiv.classList.add('active');
            
            // Show chat and files if hidden
            document.querySelector('.chat-window').style.display = 'grid';
            document.querySelector('.files-panel').style.display = 'flex';
            document.querySelector('.chat-placeholder').classList.remove('visible');
            document.querySelector('.files-placeholder').classList.remove('visible');
            
            // Select the room
            selectRoom({ id: room.id, name: room.name });
        });
        
        roomsContent.appendChild(roomDiv);
    });
}

// Subscribe to user status updates via WebSocket
function subscribeToUserStatus() {
    if (!stompClient || !stompClient.connected) {
        console.log('WebSocket not connected - status updates disabled in offline mode');
        return;
    }
    
    try {
        stompClient.subscribe('/topic/user/status', (message) => {
            try {
                const data = JSON.parse(message.body);
                const { username, status } = data;
                
                if (!username || !status) return;
                
                // Update the status map
                userStatusMap[username] = status;
                console.log(`User status updated: ${username} is ${status}`);
                
                // Update current user's status display
                if (username === currentUsername) {
                    updateUserStatus();
                }
                
                // Update member list display to reflect new status
                updateMemberStatusDisplay(username, status);
            } catch (error) {
                console.error('Error parsing status message:', error);
            }
        });
        
        console.log('✓ Subscribed to user status updates');
    } catch (error) {
        console.error('Error subscribing to user status:', error);
    }
}

// Handle incoming websocket messages
function handleIncomingMessage(msg) {
    console.log('Incoming message:', msg);
    console.log('Current room ID:', currentRoom?.id);
    
    // Check if message is for current room (use loose equality for string/number comparison)
    if (!currentRoom || msg.roomId != currentRoom.id) {
        console.log('Message filtered out - wrong room');
        return;
    }
    
    // Initialize messages array if needed
    if (!messages[currentRoom.id]) {
        messages[currentRoom.id] = [];
    }
    
    // Handle different message types
    if (msg.type === 'POST') {
        // Check if message already exists (avoids duplicates)
        const exists = messages[currentRoom.id].find(m => m.id === msg.id);
        if (!exists) {
            messages[currentRoom.id].push(msg);
            console.log('Message added to list');
        } else {
            console.log('Message already exists, skipping');
        }
    } else if (msg.type === 'UPDATE') {
        // Find and update message
        const index = messages[currentRoom.id].findIndex(m => m.id === msg.id);
        if (index !== -1) {
            // Preserve reactions when updating
            const existingReactions = messages[currentRoom.id][index].reactions || [];
            messages[currentRoom.id][index] = {
                ...messages[currentRoom.id][index],
                content: msg.content,
                reactions: existingReactions
            };
            console.log('Message updated');
        }
    } else if (msg.type === 'DELETE') {
        // Remove message - ensure id comparison is correct
        console.log('Deleting message with id:', msg.id, 'Type:', typeof msg.id);
        const beforeCount = messages[currentRoom.id].length;
        messages[currentRoom.id] = messages[currentRoom.id].filter(m => {
            const isSameId = String(m.id) === String(msg.id);
            console.log(`Message ${m.id} (type: ${typeof m.id}) vs delete id ${msg.id} (type: ${typeof msg.id}): ${isSameId}`);
            return !isSameId;
        });
        console.log(`Message deleted. Before: ${beforeCount}, After: ${messages[currentRoom.id].length}`);
    }
    
    // Re-render messages
    renderMessages();
}

// Handle incoming reactions
function handleIncomingReaction(reaction) {
    console.log('Incoming reaction:', reaction);
    
    if (!currentRoom) return;
    
    const msg = messages[currentRoom.id]?.find(m => m.id === reaction.messageId);
    if (!msg) return;
    
    if (!msg.reactions) {
        msg.reactions = [];
    }
    
    if (reaction.type === 'POST') {
        // Check if reaction already exists
        const exists = msg.reactions.find(r => 
            r.username === reaction.username && r.messageId === reaction.messageId
        );
        if (!exists) {
            msg.reactions.push(reaction);
        }
    } else if (reaction.type === 'UPDATE') {
        const index = msg.reactions.findIndex(r => r.username === reaction.username);
        if (index !== -1) {
            msg.reactions[index] = reaction;
        }
    } else if (reaction.type === 'DELETE') {
        msg.reactions = msg.reactions.filter(r => r.username !== reaction.username);
    }
    
    renderMessages();
}

// Handle typing indicator
function handleTypingIndicator(data) {
    if (data.username === currentUsername) return;
    
    const indicator = document.getElementById('typingIndicator');
    if (!indicator) return;
    
    if (data.typing) {
        indicator.textContent = `${data.username} is typing...`;
        indicator.style.display = 'block';
    } else {
        indicator.style.display = 'none';
    }
}

// WebSocket Connection
function connectWebSocket() {
    const token = localStorage.getItem('token');
    if (!token) {
        console.warn('No token available for WebSocket connection');
        return;
    }
    
    const socket = new SockJS(CONFIG.WS_BASE);
    stompClient = Stomp.over(socket);
    
    // Disable debug logs
    stompClient.debug = () => {};
    
    stompClient.connect(
        { Authorization: `Bearer ${token}` },
        (frame) => {
            console.log('✓ WebSocket connected');
            
            // Subscribe to room and status
            if (currentRoom && currentRoom.id) {
                subscribeToRoom(currentRoom.id);
                subscribeToUserStatus();
            }
            
            // Send user online status (if backend supports it)
            if (stompClient && stompClient.connected && currentUsername) {
                try {
                    stompClient.send('/app/status', {}, JSON.stringify({
                        username: currentUsername,
                        status: 'online'
                    }));
                } catch (error) {
                    console.log('Status endpoint not available - continuing without it');
                }
            }
            
            // Update current user's status display
            updateUserStatus();
            
            // If a room is already selected, subscribe to it
            if (currentRoom) {
                subscribeToRoom(currentRoom.id);
            }
        },
        (error) => {
            console.error('WebSocket error:', error);
            // Attempt reconnection
            setTimeout(connectWebSocket, 5000);
        }
    );
    
    // Handle disconnection
    socket.onclose = function() {
        console.log('WebSocket disconnected');
        // Send user offline status before disconnecting (if backend supports it)
        if (currentUsername) {
            try {
                stompClient.send('/app/status', {}, JSON.stringify({
                    username: currentUsername,
                    status: 'offline'
                }));
            } catch (error) {
                // Silent fail - endpoint may not exist
            }
            userStatusMap[currentUsername] = 'offline';
            updateUserStatus();
        }
    };
}

function subscribeToRoom(roomId) {
    if (!stompClient || !stompClient.connected) {
        console.error('STOMP client not connected');
        return;
    }
    
    console.log('Subscribing to room:', roomId);
    
    // Subscribe to messages
    stompClient.subscribe(`/topic/${roomId}/messages`, (message) => {
        console.log('Received message via WebSocket:', message.body);
        const msg = JSON.parse(message.body);
        msg.roomId = roomId;
        handleIncomingMessage(msg);
    });
    
    // Subscribe to reactions
    stompClient.subscribe(`/topic/${roomId}/reactions`, (message) => {
        console.log('Received reaction via WebSocket:', message.body);
        const reaction = JSON.parse(message.body);
        handleIncomingReaction(reaction);
    });
    
    // Subscribe to typing indicators
    stompClient.subscribe(`/topic/${roomId}/typing`, (message) => {
        const data = JSON.parse(message.body);
        handleTypingIndicator(data);
    });
    
    // Subscribe to notes
    stompClient.subscribe(`/topic/${roomId}/notes`, (message) => {
        const note = JSON.parse(message.body);
        handleIncomingNote(note);
    });
}

// Select/enter a room
function selectRoom(room) {
    if (!room || !room.id) {
        console.error('Invalid room');
        return;
    }
    
    console.log('Selecting room:', room.name);
    
    currentRoom = room;
    
    // Initialize messages for room if not exists
    if (!messages[room.id]) {
        messages[room.id] = [];
    }
    
    // Update UI - set title
    const roomNameElement = document.querySelector('.chat-titlebar .window-title');
    if (roomNameElement) {
        roomNameElement.textContent = room.name;
    }
    
    // Update room list to show active state
    document.querySelectorAll('.room-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.roomId === String(room.id) || item.dataset.roomId == room.id) {
            item.classList.add('active');
        }
    });
    
    // Show chat and files panels
    const chatWindow = document.querySelector('.chat-window');
    const filesPanel = document.querySelector('.files-panel');
    const filesContent = document.getElementById('filesContent');
    const messageInputContainer = document.getElementById('messageInputContainer');
    if (chatWindow) chatWindow.style.display = 'grid';
    if (filesPanel) filesPanel.style.display = 'flex';
    if (filesContent) filesContent.style.display = 'block';
    if (messageInputContainer) messageInputContainer.style.display = 'flex';
    document.querySelector('.chat-placeholder')?.classList.remove('visible');
    document.querySelector('.files-placeholder')?.classList.remove('visible');
    
    // Show room controls
    const roomMembersBtn = document.getElementById('roomMembersBtn');
    if (roomMembersBtn) roomMembersBtn.style.display = 'block';
    
    // Show delete button only if current user is the owner
    const deleteBtn = document.getElementById('deleteRoomBtn');
    if (deleteBtn) {
        const isOwner = room.user && room.user.username === currentUsername;
        deleteBtn.style.display = isOwner ? 'block' : 'none';
    }
    
    // Load room data
    loadMessages(room.id);
    loadRoomMembers(room.id);
    loadRoomFiles(room.id);
    loadNotes(room.id);
    
    // Render messages for this room
    renderMessages();
    renderNotes();
    
    // Only subscribe if WebSocket is connected
    if (stompClient && stompClient.connected) {
        subscribeToRoom(room.id);
        subscribeToUserStatus();
        console.log('✓ WebSocket subscriptions active for room:', room.name);
    } else {
        console.log('Offline mode: local messaging only');
    }
}

// Cleanup function - called when leaving the page
window.cleanupPage = function() {
    console.log('Cleaning up room page');
    
    // Send offline status before cleanup (if backend supports it)
    if (stompClient && stompClient.connected && currentUsername) {
        try {
            stompClient.send('/app/status', {}, JSON.stringify({
                username: currentUsername,
                status: 'offline'
            }));
        } catch (error) {
            // Silent fail
        }
    }
    
    if (timestampUpdateInterval) {
        clearInterval(timestampUpdateInterval);
    }
    
    if (typingTimeout) {
        clearTimeout(typingTimeout);
    }
    
    currentRoom = null;
    messages = {};
    notes = {};
    replyToMessage = null;
    editingMessageId = null;
    editingNoteId = null;
};

// Handle page unload to set user offline
window.addEventListener('beforeunload', function() {
    if (stompClient && stompClient.connected && currentUsername) {
        try {
            stompClient.send('/app/status', {}, JSON.stringify({
                username: currentUsername,
                status: 'offline'
            }));
        } catch (error) {
            // Silent fail
        }
    }
});

// ============================================
// NOTE FUNCTIONS
// ============================================

// Load notes from backend or localStorage
async function loadNotes(roomId) {
    // Try to load from backend first
    if (stompClient && stompClient.connected) {
        try {
            const response = await api.getNotes(roomId);
            if (response.ok) {
                const notesData = await response.json();
                notes[roomId] = notesData;
                // Save to localStorage as backup
                localStorage.setItem(`notes_${roomId}`, JSON.stringify(notesData));
                renderNotes();
                return;
            }
        } catch (error) {
            console.error('Error loading notes from backend:', error);
        }
    }
    
    // Fall back to localStorage
    const storedNotes = localStorage.getItem(`notes_${roomId}`);
    if (storedNotes) {
        notes[roomId] = JSON.parse(storedNotes);
    } else {
        notes[roomId] = [];
    }
    renderNotes();
}

// Render notes for current room
function renderNotes() {
    const notesList = document.getElementById('notesList');
    console.log('renderNotes called, notesList:', notesList);
    console.log('currentRoom:', currentRoom);
    console.log('notes:', notes);
    
    if (!notesList) {
        console.error('Notes list element not found');
        return;
    }

    notesList.innerHTML = '';

    if (!currentRoom || !notes[currentRoom.id] || notes[currentRoom.id].length === 0) {
        console.log('No notes for this room');
        notesList.innerHTML = '<div style="text-align: center; color: var(--text-muted); font-size: 7px; padding: 10px;">No notes yet. Add one to get started!</div>';
        return;
    }

    console.log('Rendering', notes[currentRoom.id].length, 'notes');
    notes[currentRoom.id].forEach(note => {
        const noteEl = createNoteElement(note);
        notesList.appendChild(noteEl);
    });
}

// Create note DOM element
function createNoteElement(note) {
    const noteDiv = document.createElement('div');
    noteDiv.className = 'note-item';
    noteDiv.dataset.noteId = note.id;

    const isOwnNote = note.username === currentUsername;

    let html = `<div class="note-text">${escapeHtml(note.content)}</div>`;
    html += `<div class="note-actions">`;

    if (isOwnNote) {
        html += `<button onclick="editNote(${note.id})" title="Edit">✎</button>`;
        html += `<button onclick="deleteNote(${note.id})" title="Delete">✕</button>`;
    }

    html += `</div>`;

    noteDiv.innerHTML = html;
    return noteDiv;
}

// Send note (works with or without backend)
function sendNote() {
    const input = document.getElementById('noteInput');
    const content = input.value.trim();

    console.log('sendNote called, content:', content);
    console.log('Current room:', currentRoom);

    if (!content || !currentRoom) {
        console.log('Note is empty or no room selected');
        return;
    }

    if (editingNoteId) {
        // Update existing note
        console.log('Updating note:', editingNoteId);
        const noteIdx = notes[currentRoom.id].findIndex(n => n.id === editingNoteId);
        if (noteIdx !== -1) {
            notes[currentRoom.id][noteIdx].content = content;
            console.log('Note updated:', notes[currentRoom.id][noteIdx]);
            saveNotesToLocalStorage();
        }
        editingNoteId = null;
    } else {
        // Create new note
        console.log('Creating new note');
        const newNote = {
            id: Date.now(),
            content: content,
            username: currentUsername,
            roomId: currentRoom.id,
            timestamp: new Date().toISOString(),
            type: 'POST'
        };

        if (!notes[currentRoom.id]) {
            notes[currentRoom.id] = [];
        }

        notes[currentRoom.id].push(newNote);
        console.log('Note created:', newNote);
        console.log('Total notes:', notes[currentRoom.id].length);
        saveNotesToLocalStorage();
    }

    input.value = '';
    renderNotes();
    console.log('renderNotes called');
}

// Save notes to localStorage
function saveNotesToLocalStorage() {
    if (currentRoom && notes[currentRoom.id]) {
        localStorage.setItem(`notes_${currentRoom.id}`, JSON.stringify(notes[currentRoom.id]));
    }
}

// Edit note
function editNote(noteId) {
    const note = notes[currentRoom.id].find(n => n.id === noteId);
    if (!note) return;

    editingNoteId = noteId;
    document.getElementById('noteInput').value = note.content;
    document.getElementById('noteInput').focus();
}

// Delete note
function deleteNote(noteId) {
    if (!confirm('Delete this note?')) return;

    if (!currentRoom) return;

    if (stompClient && stompClient.connected) {
        stompClient.send(`/app/rooms/${currentRoom.id}/note`, {}, JSON.stringify({
            id: noteId,
            type: 'DELETE'
        }));
    } else {
        // Local deletion
        notes[currentRoom.id] = notes[currentRoom.id].filter(n => n.id !== noteId);
        saveNotesToLocalStorage();
    }

    renderNotes();
}

// Handle incoming note from WebSocket
function handleIncomingNote(note) {
    if (!currentRoom || note.roomId != currentRoom.id) return;

    if (!notes[currentRoom.id]) {
        notes[currentRoom.id] = [];
    }

    if (note.type === 'POST') {
        // Add new note
        notes[currentRoom.id].push(note);
    } else if (note.type === 'EDIT') {
        // Update note
        const idx = notes[currentRoom.id].findIndex(n => n.id === note.id);
        if (idx !== -1) {
            notes[currentRoom.id][idx] = note;
        }
    } else if (note.type === 'DELETE') {
        // Remove note
        notes[currentRoom.id] = notes[currentRoom.id].filter(n => n.id !== note.id);
    }

    saveNotesToLocalStorage();
    renderNotes();
}

// ============================================
// WINDOW EXPORTS
// ============================================
window.replyToMsg = replyToMsg;
window.editMessage = editMessage;
window.deleteMessage = deleteMessage;
window.showEmojiPickerForMessage = showEmojiPickerForMessage;
window.selectEmoji = selectEmoji;
window.openModal = openModal;
window.closeModal = closeModal;
window.logout = logout;
window.loadRooms = loadRooms;
window.createRoom = createRoom;
window.showRoomMembers = showRoomMembers;
window.inviteUser = inviteUser;
window.deleteCurrentRoom = deleteCurrentRoom;
window.loadMessages = loadMessages;
window.toggleNotificationModal = toggleNotificationModal;
window.goHome = goHome;
window.updateTopBar = updateTopBar;
window.selectRoom = selectRoom;
window.toggleReaction = toggleReaction;
window.sendNote = sendNote;
window.editNote = editNote;
window.deleteNote = deleteNote;
window.loadNotes = loadNotes;
window.renderNotes = renderNotes;
window.saveNotesToLocalStorage = saveNotesToLocalStorage;
window.createNoteElement = createNoteElement;
window.handleIncomingNote = handleIncomingNote;
