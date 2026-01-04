console.log('Landing page loaded');

// State
let currentUsername = null;
let userRooms = [];
let selectedRoomForInvite = null;
let stompClient = null;

// Initialize page
document.addEventListener('DOMContentLoaded', initLandingPage);

function initLandingPage() {
    console.log('Initializing landing page...');
    
    // Get current user
    currentUsername = window.getCurrentUser ? window.getCurrentUser() : 'Guest';
    console.log('Current user:', currentUsername);
    
    // Setup event listeners
    setupEventListeners();
    
    // Load user's rooms
    loadUserRooms();
    
    // Get WebSocket client
    stompClient = window.stompClient;
    
    // Subscribe to real-time updates
    if (stompClient && stompClient.connected) {
        subscribeToRoomUpdates();
        console.log('✓ WebSocket connected - subscribed to room updates');
    } else {
        console.warn('WebSocket not connected - real-time updates disabled');
    }
    
    console.log('✓ Landing page initialized successfully');
}

// Setup event listeners
function setupEventListeners() {
    // Advanced settings toggle
    const advancedToggle = document.getElementById('advancedToggle');
    const settingsContent = document.getElementById('settingsContent');
    if (advancedToggle && settingsContent) {
        advancedToggle.addEventListener('click', () => {
            settingsContent.classList.toggle('hidden');
            advancedToggle.classList.toggle('collapsed');
        });
    }
    
    // Max members checkbox
    const setMaxMembersCheck = document.getElementById('setMaxMembersCheck');
    const maxMembersControl = document.getElementById('maxMembersControl');
    if (setMaxMembersCheck && maxMembersControl) {
        setMaxMembersCheck.addEventListener('change', (e) => {
            maxMembersControl.style.display = e.target.checked ? 'flex' : 'none';
        });
    }
    
    // Number controls
    const decreaseBtn = document.getElementById('decreaseMax');
    const increaseBtn = document.getElementById('increaseMax');
    const maxMembersInput = document.getElementById('maxMembersInput');
    
    if (decreaseBtn && maxMembersInput) {
        decreaseBtn.addEventListener('click', () => {
            const val = parseInt(maxMembersInput.value) || 10;
            if (val > 2) maxMembersInput.value = val - 1;
        });
    }
    
    if (increaseBtn && maxMembersInput) {
        increaseBtn.addEventListener('click', () => {
            const val = parseInt(maxMembersInput.value) || 10;
            if (val < 100) maxMembersInput.value = val + 1;
        });
    }
    
    // Create room button
    const createRoomBtn = document.getElementById('createRoomBtn');
    if (createRoomBtn) {
        createRoomBtn.addEventListener('click', handleCreateRoom);
    }
    
    // Create new room button (in Your Rooms)
    const createNewRoomBtn = document.getElementById('createNewRoomBtn');
    if (createNewRoomBtn) {
        createNewRoomBtn.addEventListener('click', () => {
            document.getElementById('roomNameInput').focus();
        });
    }
    
    // Copy room ID button
    const copyRoomIdBtn = document.getElementById('copyRoomIdBtn');
    if (copyRoomIdBtn) {
        copyRoomIdBtn.addEventListener('click', handleCopyRoomId);
    }
    
    // Search room button
    const searchRoomBtn = document.getElementById('searchRoomBtn');
    if (searchRoomBtn) {
        searchRoomBtn.addEventListener('click', handleSearchRoom);
    }
    
    // Send invite button
    const sendInviteBtn = document.getElementById('sendInviteBtn');
    if (sendInviteBtn) {
        sendInviteBtn.addEventListener('click', handleSendInvite);
    }
}

// Create room
async function handleCreateRoom() {
    const roomNameInput = document.getElementById('roomNameInput');
    const setMaxMembersCheck = document.getElementById('setMaxMembersCheck');
    const maxMembersInput = document.getElementById('maxMembersInput');
    const adminOnlyCheck = document.getElementById('adminOnlyCheck');
    
    const roomName = roomNameInput.value.trim();
    
    if (!roomName) {
        showToast('Please enter a room name', 'error');
        return;
    }
    
    console.log('Creating room:', roomName);
    
    // Prepare room data
    const roomData = {
        name: roomName,
        createdBy: currentUsername
    };
    
    if (setMaxMembersCheck.checked) {
        roomData.maxMembers = parseInt(maxMembersInput.value) || 10;
    }
    
    if (adminOnlyCheck.checked) {
        roomData.adminOnly = true;
    }
    
    try {
        const response = await fetch(`${CONFIG.API_BASE}/rooms`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(roomData)
        });
        
        if (response.ok) {
            const newRoom = await response.json();
            console.log('Room created:', newRoom);
            
            showToast(`Room "${roomName}" created successfully!`, 'success');
            
            // Clear input
            roomNameInput.value = '';
            
            // Reload rooms list
            loadUserRooms();
        } else {
            const error = await response.text();
            showToast(error || 'Failed to create room', 'error');
        }
    } catch (err) {
        console.error('Create room error:', err);
        
        // Offline mode - add room locally
        const localRoom = {
            id: 'room-' + Date.now(),
            name: roomName,
            memberCount: 1,
            maxMembers: setMaxMembersCheck.checked ? parseInt(maxMembersInput.value) : null,
            adminOnly: adminOnlyCheck.checked,
            isOnline: false,
            createdBy: currentUsername
        };
        
        userRooms.push(localRoom);
        renderUserRooms();
        
        showToast(`Room "${roomName}" created (offline mode)`, 'info');
        roomNameInput.value = '';
    }
}

// Copy room ID
function handleCopyRoomId() {
    if (userRooms.length === 0) {
        showToast('No rooms available to copy ID', 'error');
        return;
    }
    
    // Copy the first room's ID (or you can add logic to select specific room)
    const roomId = userRooms[0].id;
    
    navigator.clipboard.writeText(roomId).then(() => {
        showToast('Room ID copied to clipboard!', 'success');
    }).catch(() => {
        showToast('Failed to copy room ID', 'error');
    });
}

// Load user's rooms
async function loadUserRooms() {
    console.log('Loading user rooms...');
    
    try {
        const response = await fetch(`${CONFIG.API_BASE}/rooms`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include'
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log('Rooms loaded from API:', data);
            
            // Filter rooms where user is a member
            userRooms = data.rooms || [];
            renderUserRooms();
            updateRoomSelect();
        } else {
            throw new Error('API unavailable');
        }
    } catch (err) {
        console.warn('Offline mode: no rooms from server');
        
        // Show empty state or use local rooms if any
        if (userRooms.length === 0) {
            renderUserRooms();
        }
    }
}

// Render user's rooms
function renderUserRooms() {
    const roomsList = document.getElementById('yourRoomsList');
    
    if (!roomsList) {
        console.error('Rooms list element not found');
        return;
    }
    
    // Clear existing
    roomsList.innerHTML = '';
    
    if (userRooms.length === 0) {
        roomsList.innerHTML = '<div class="empty-state">No rooms yet. Create one to get started!</div>';
        return;
    }
    
    // Render each room
    userRooms.forEach(room => {
        const roomCard = document.createElement('div');
        roomCard.className = 'room-card';
        roomCard.dataset.roomId = room.id;
        
        const isOnline = room.isOnline || false;
        
        roomCard.innerHTML = `
            <div class="room-header">
                <div class="room-name">${escapeHtml(room.name)}</div>
                <div class="room-status ${isOnline ? 'online' : 'offline'}"></div>
            </div>
            <div class="room-info">
                ${room.memberCount || 0} Members${room.maxMembers ? ` / ${room.maxMembers}` : ''} • ${isOnline ? 'Online' : 'Offline'}
            </div>
        `;
        
        // Add click handler
        roomCard.addEventListener('click', () => {
            handleRoomClick(room);
        });
        
        roomsList.appendChild(roomCard);
    });
    
    console.log(`Rendered ${userRooms.length} rooms`);
}

// Handle room click
function handleRoomClick(room) {
    console.log('Room clicked:', room.name);
    
    // Navigate to room page and select this room
    if (typeof window.selectRoom === 'function') {
        window.selectRoom(room);
    }
    
    if (typeof window.navigateTo === 'function') {
        window.navigateTo('room');
    } else {
        console.error('navigateTo function not available');
    }
}

// Update room select dropdown
function updateRoomSelect() {
    const roomSelect = document.getElementById('roomSelect');
    
    if (!roomSelect) {
        console.error('Room select element not found');
        return;
    }
    
    // Clear existing options
    roomSelect.innerHTML = '';
    
    if (userRooms.length === 0) {
        roomSelect.innerHTML = '<option value="">No rooms available</option>';
        return;
    }
    
    // Add room options
    userRooms.forEach(room => {
        const option = document.createElement('option');
        option.value = room.id;
        option.textContent = room.name;
        roomSelect.appendChild(option);
    });
    
    // Set selected room
    if (userRooms.length > 0) {
        selectedRoomForInvite = userRooms[0].id;
    }
    
    // Update when selection changes
    roomSelect.addEventListener('change', (e) => {
        selectedRoomForInvite = e.target.value;
        loadRoomMembers(selectedRoomForInvite);
    });
    
    // Load members for first room
    if (selectedRoomForInvite) {
        loadRoomMembers(selectedRoomForInvite);
    }
}

// Load room members
async function loadRoomMembers(roomId) {
    if (!roomId) return;
    
    console.log('Loading members for room:', roomId);
    
    try {
        const response = await fetch(`${CONFIG.API_BASE}/rooms/${roomId}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include'
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log('Room members loaded:', data);
            
            renderTeamMembers(data.members || []);
        } else {
            throw new Error('API unavailable');
        }
    } catch (err) {
        console.warn('Offline mode: no members from server');
        renderTeamMembers([]);
    }
}

// Render team members
async function renderTeamMembers(members) {
    const membersList = document.getElementById('teamMembersList');
    
    if (!membersList) {
        console.error('Members list element not found');
        return;
    }
    
    // Clear existing
    membersList.innerHTML = '';
    
    if (members.length === 0) {
        membersList.innerHTML = '<div class="empty-state small">Select a room to view members</div>';
        return;
    }
    
    // Render each member
    for (const member of members) {
        const memberCard = document.createElement('div');
        memberCard.className = 'member-card';
        
        const username = member.username || member;
        const avatar = await getUserAvatar(username);
        
        memberCard.innerHTML = `
            <img src="${avatar}" alt="${escapeHtml(username)}" class="member-avatar">
            <div class="member-info">
                <div class="member-name">${escapeHtml(username)}</div>
                <div class="member-status-text">Member</div>
            </div>
        `;
        
        membersList.appendChild(memberCard);
    }
    
    console.log(`Rendered ${members.length} team members`);
}

// Get user avatar
async function getUserAvatar(username) {
    if (!username) return generateDefaultAvatar('');
    
    try {
        const response = await fetch(`${CONFIG.API_BASE}/users/${encodeURIComponent(username)}`);
        if (response.ok) {
            const user = await response.json();
            if (user.avatar) return user.avatar;
        }
    } catch (error) {
        console.log(`Could not fetch profile for ${username}`);
    }
    
    return generateDefaultAvatar(username);
}

// Generate default avatar
function generateDefaultAvatar(username) {
    if (!username) return 'https://ui-avatars.com/api/?name=?&background=999999&color=fff&size=48&bold=true';
    
    const initials = username
        .split(' ')
        .map(word => word[0])
        .join('')
        .toUpperCase()
        .substring(0, 2);
    
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
        hash = ((hash << 5) - hash) + username.charCodeAt(i);
        hash = hash & hash;
    }
    
    const colors = [
        'FF6B6B', '4ECDC4', '45B7D1', 'FFA07A', '98D8C8',
        'F7DC6F', 'BB8FCE', '85C1E2', 'F8B88B', '80D084'
    ];
    const color = colors[Math.abs(hash) % colors.length];
    
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=${color}&color=fff&size=48&bold=true`;
}

// Search room by ID
async function handleSearchRoom() {
    const roomIdSearch = document.getElementById('roomIdSearch');
    const searchResults = document.getElementById('searchResults');
    
    const roomId = roomIdSearch.value.trim();
    
    if (!roomId) {
        showToast('Please enter a room ID', 'error');
        return;
    }
    
    console.log('Searching for room:', roomId);
    
    try {
        const response = await fetch(`${CONFIG.API_BASE}/rooms/${roomId}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include'
        });
        
        if (response.ok) {
            const room = await response.json();
            console.log('Room found:', room);
            
            // Display search result
            searchResults.style.display = 'block';
            searchResults.innerHTML = `
                <div class="found-room">
                    <div class="found-room-header">
                        <div class="found-room-name">${escapeHtml(room.name)}</div>
                    </div>
                    <div class="found-room-info">
                        ${room.memberCount || 0} Members${room.maxMembers ? ` / ${room.maxMembers}` : ''}
                    </div>
                    <button class="pixel-btn primary join-btn" onclick="joinRoom('${room.id}', '${escapeHtml(room.name)}')">
                        Join Room
                    </button>
                </div>
            `;
        } else {
            showToast('Room not found', 'error');
            searchResults.style.display = 'none';
        }
    } catch (err) {
        console.error('Search room error:', err);
        showToast('Failed to search room', 'error');
        searchResults.style.display = 'none';
    }
}

// Join room
async function joinRoom(roomId, roomName) {
    console.log('Joining room:', roomId);
    
    try {
        const response = await fetch(`${CONFIG.API_BASE}/rooms/${roomId}/join`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ username: currentUsername })
        });
        
        if (response.ok) {
            showToast(`Joined room "${roomName}"!`, 'success');
            
            // Reload rooms
            loadUserRooms();
            
            // Clear search
            document.getElementById('roomIdSearch').value = '';
            document.getElementById('searchResults').style.display = 'none';
        } else {
            const error = await response.text();
            showToast(error || 'Failed to join room', 'error');
        }
    } catch (err) {
        console.error('Join room error:', err);
        showToast('Failed to join room', 'error');
    }
}

// Send invite
async function handleSendInvite() {
    const inviteUsernameInput = document.getElementById('inviteUsernameInput');
    const roomSelect = document.getElementById('roomSelect');
    
    const username = inviteUsernameInput.value.trim();
    const roomId = roomSelect.value;
    
    if (!username) {
        showToast('Please enter a username', 'error');
        return;
    }
    
    if (!roomId) {
        showToast('Please select a room', 'error');
        return;
    }
    
    console.log('Sending invite to:', username, 'for room:', roomId);
    
    try {
        const response = await fetch(`${CONFIG.API_BASE}/rooms/${roomId}/invite`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify([username])
        });
        
        if (response.ok) {
            showToast(`Invitation sent to ${username}!`, 'success');
            inviteUsernameInput.value = '';
        } else {
            const error = await response.text();
            showToast(error || 'Failed to send invite', 'error');
        }
    } catch (err) {
        console.error('Send invite error:', err);
        showToast('Failed to send invite', 'error');
    }
}

// Subscribe to WebSocket room updates
function subscribeToRoomUpdates() {
    if (!stompClient || !stompClient.connected) {
        console.log('WebSocket not connected - cannot subscribe');
        return;
    }
    
    try {
        // Subscribe to room updates
        stompClient.subscribe('/topic/rooms/updates', (message) => {
            const update = JSON.parse(message.body);
            console.log('Room update received:', update);
            
            handleRoomUpdate(update);
        });
        
        console.log('✓ Subscribed to room updates');
    } catch (error) {
        console.error('Error subscribing to room updates:', error);
    }
}

// Handle room update from WebSocket
function handleRoomUpdate(update) {
    if (!update || !update.type) return;
    
    console.log('Processing room update:', update.type);
    
    switch (update.type) {
        case 'ROOM_CREATED':
            // Add new room to list if user is a member
            if (update.room && update.room.members && update.room.members.includes(currentUsername)) {
                const exists = userRooms.find(r => r.id === update.room.id);
                if (!exists) {
                    userRooms.push(update.room);
                    renderUserRooms();
                    updateRoomSelect();
                }
            }
            break;
            
        case 'ROOM_UPDATED':
            // Update existing room
            const roomIndex = userRooms.findIndex(r => r.id === update.roomId);
            if (roomIndex !== -1 && update.room) {
                userRooms[roomIndex] = { ...userRooms[roomIndex], ...update.room };
                renderUserRooms();
            }
            break;
            
        case 'MEMBER_JOINED':
        case 'MEMBER_LEFT':
            // Update member count
            const room = userRooms.find(r => r.id === update.roomId);
            if (room) {
                room.memberCount = update.memberCount || room.memberCount;
                renderUserRooms();
                
                // If this is the selected room, reload members
                if (selectedRoomForInvite === update.roomId) {
                    loadRoomMembers(update.roomId);
                }
            }
            break;
            
        case 'STATUS_CHANGED':
            // Update online/offline status
            const statusRoom = userRooms.find(r => r.id === update.roomId);
            if (statusRoom) {
                statusRoom.isOnline = update.isOnline;
                renderUserRooms();
            }
            break;
    }
}

// Show toast notification
function showToast(message, type = 'info') {
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 5000);
}

// Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Cleanup function
window.cleanupPage = function() {
    console.log('Cleaning up landing page');
    
    // Clear state
    userRooms = [];
    selectedRoomForInvite = null;
    
    console.log('✓ Landing page cleaned up');
};

// Export functions for global use
window.joinRoom = joinRoom;