console.log('Landing page loaded');

// API Functions
const api = {
    async request(endpoint, options = {}) {
        const url = `${CONFIG.API_BASE}${endpoint}`;
        const token = localStorage.getItem('token') || sessionStorage.getItem('authToken');
        
        const defaultOptions = {
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                ...(token && { 'Authorization': `Bearer ${token}` })
            }
        };
        
        const response = await fetch(url, { ...defaultOptions, ...options });
        
        if (response.status === 401) {
            if (typeof logout === 'function') {
                logout();
            }
            return;
        }
        
        return response;
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
    }
};

// State
let currentUsername = null;
let rooms = [];
let allMembers = [];

// Initialize
function initLanding() {
    console.log('Initializing landing page...');
    
    if (typeof checkAuth === 'function' && !checkAuth()) {
        console.log('Not authenticated');
        if (typeof navigateTo === 'function') {
            navigateTo('auth');
        }
        return;
    }
    
    currentUsername = getCurrentUser();
    
    loadUserData();
    setupEventListeners();
    
    console.log('✓ Landing page initialized');
}

// Load Data
async function loadUserData() {
    const topUsername = document.querySelector('.top-bar .username');
    if (topUsername) topUsername.textContent = currentUsername;
    
    try {
        const response = await api.getRooms();
        if (response && response.ok) {
            rooms = await response.json();
            console.log('Loaded rooms:', rooms);
            await loadAllMembers();
            renderRooms();
            renderRoomDropdown();
            renderTeamMembers();
        }
    } catch (error) {
        console.error('Error loading rooms:', error);
    }
}

// Load all members from all rooms
async function loadAllMembers() {
    const membersByUser = new Map();
    
    try {
        for (const room of rooms) {
            const response = await api.getRoomMembers(room.id);
            if (response && response.ok) {
                const members = await response.json();
                
                members.forEach(memberName => {
                    if (memberName === currentUsername) return;
                    
                    if (!membersByUser.has(memberName)) {
                        membersByUser.set(memberName, {
                            name: memberName,
                            mutualRooms: []
                        });
                    }
                    membersByUser.get(memberName).mutualRooms.push(room.name);
                });
            }
        }
        
        allMembers = Array.from(membersByUser.values());
        console.log('Loaded members:', allMembers);
        
    } catch (error) {
        console.error('Error loading members:', error);
    }
}

// Event Listeners
function setupEventListeners() {
    // Top bar buttons
    const notifBtn = document.querySelectorAll('.icon-btn')[0];
    if (notifBtn) {
        notifBtn.addEventListener('click', () => {
            showModal('Notifications feature coming soon!');
        });
    }
    
    const homeBtn = document.querySelectorAll('.icon-btn')[1];
    if (homeBtn) {
        homeBtn.addEventListener('click', () => {
            if (typeof navigateTo === 'function') {
                navigateTo('dashboard');
            }
        });
    }
    
    const viewProfile = document.querySelector('.view-profile');
    if (viewProfile) {
        viewProfile.addEventListener('click', (e) => {
            e.preventDefault();
            if (typeof navigateTo === 'function') {
                navigateTo('dashboard');
            }
        });
    }
    
    // Advanced settings toggle
    const advancedToggle = document.getElementById('advancedToggle');
    const settingsContent = document.getElementById('settingsContent');
    if (advancedToggle && settingsContent) {
        advancedToggle.addEventListener('click', () => {
            const isHidden = settingsContent.style.display === 'none';
            settingsContent.style.display = isHidden ? 'block' : 'none';
            advancedToggle.textContent = isHidden ? 'Advanced Settings ▲' : 'Advanced Settings ▼';
        });
    }
    
    // Max members checkbox
    const maxMembersCheck = document.getElementById('maxMembersCheck');
    const maxMembersInput = document.getElementById('maxMembersInput');
    if (maxMembersCheck && maxMembersInput) {
        maxMembersCheck.addEventListener('change', () => {
            maxMembersInput.disabled = !maxMembersCheck.checked;
        });
    }
    
    // Create room button
    const createRoomBtn = document.getElementById('createRoomBtn');
    if (createRoomBtn) {
        createRoomBtn.addEventListener('click', handleCreateRoom);
    }
    
    // Room ID search (Team-ups)
    const roomIdInput = document.getElementById('roomIdInput');
    if (roomIdInput) {
        roomIdInput.addEventListener('input', handleRoomSearch);
    }
    
    // Send invite button
    const sendInviteBtn = document.getElementById('sendInviteBtn');
    if (sendInviteBtn) {
        sendInviteBtn.addEventListener('click', handleSendInvite);
    }
    
    // Rooms search
    const roomsSearch = document.getElementById('roomsSearch');
    if (roomsSearch) {
        roomsSearch.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            renderRooms(searchTerm);
        });
    }
    
    // Modal OK button
    const modalOkBtn = document.getElementById('modalOkBtn');
    if (modalOkBtn) {
        modalOkBtn.addEventListener('click', () => {
            document.getElementById('confirmModal').style.display = 'none';
        });
    }
}

// Create Room
async function handleCreateRoom() {
    const roomNameInput = document.getElementById('roomNameInput');
    const roomName = roomNameInput.value.trim();
    
    if (!roomName) {
        showModal('Please enter a room name');
        return;
    }
    
    try {
        const response = await api.createRoom(roomName);
        if (response && response.ok) {
            showModal('Room created successfully!');
            roomNameInput.value = '';
            
            // Reset advanced settings
            document.getElementById('maxMembersCheck').checked = false;
            document.getElementById('maxMembersInput').disabled = true;
            document.getElementById('maxMembersInput').value = '';
            document.getElementById('settingsContent').style.display = 'none';
            document.getElementById('advancedToggle').textContent = 'Advanced Settings ▼';
            
            // Reload rooms
            await loadUserData();
        } else {
            showModal('Failed to create room');
        }
    } catch (error) {
        console.error('Error creating room:', error);
        showModal('Could not create room');
    }
}

// Room Search (Team-ups)
function handleRoomSearch(e) {
    const roomId = e.target.value.trim();
    const resultDiv = document.getElementById('roomSearchResult');
    
    if (!roomId) {
        resultDiv.innerHTML = '';
        return;
    }
    
    // Search for room by ID
    const foundRoom = rooms.find(r => r.id.toString() === roomId);
    
    if (foundRoom) {
        resultDiv.innerHTML = `
            <div class="room-result-item">
                <div class="room-result-name">${foundRoom.name}</div>
                <button class="btn-join" onclick="joinRoom(${foundRoom.id})">Join</button>
            </div>
        `;
    } else {
        resultDiv.innerHTML = '<div style="color: var(--text-muted);">No room found with this ID</div>';
    }
}

// Join Room (for Team-ups)
function joinRoom(roomId) {
    showModal('Join room feature coming soon!');
    console.log('Joining room:', roomId);
}

// Render Rooms List
function renderRooms(searchTerm = '') {
    const roomsList = document.getElementById('roomsList');
    if (!roomsList) return;
    
    const filtered = rooms.filter(r => 
        r.name.toLowerCase().includes(searchTerm)
    );
    
    if (filtered.length === 0) {
        roomsList.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-muted);">No rooms found</div>';
        return;
    }
    
    roomsList.innerHTML = filtered.map(room => `
        <div class="room-item" onclick="selectRoom(${room.id})">
            <div class="room-item-name">${room.name}</div>
            <div class="room-item-meta">
                10 Members
                <span class="room-status offline">Offline</span>
            </div>
        </div>
    `).join('');
}

// Select Room (navigate to room page)
function selectRoom(roomId) {
    console.log('Selecting room:', roomId);
    if (typeof navigateTo === 'function') {
        navigateTo('room');
    }
}

// Render Room Dropdown
function renderRoomDropdown() {
    const dropdown = document.getElementById('selectRoomDropdown');
    if (!dropdown) return;
    
    if (rooms.length === 0) {
        dropdown.innerHTML = '<option value="">No rooms available</option>';
        return;
    }
    
    dropdown.innerHTML = rooms.map(room => 
        `<option value="${room.id}">${room.name}</option>`
    ).join('');
}

// Render Team Members
function renderTeamMembers() {
    const membersList = document.getElementById('teamMembersList');
    if (!membersList) return;
    
    if (allMembers.length === 0) {
        membersList.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-muted);">No team members yet</div>';
        return;
    }
    
    membersList.innerHTML = allMembers.map(member => `
        <div class="member-item">
            <input type="checkbox" class="member-checkbox">
            <div class="member-info">
                <div class="member-name">${member.name}</div>
                <div class="member-meta">Mutual rooms: ${member.mutualRooms.length}</div>
            </div>
        </div>
    `).join('');
}

// Send Invite
async function handleSendInvite() {
    const dropdown = document.getElementById('selectRoomDropdown');
    const usernameInput = document.getElementById('inviteUsernameInput');
    
    const roomId = dropdown.value;
    const username = usernameInput.value.trim();
    
    if (!roomId) {
        showModal('Please select a room');
        return;
    }
    
    if (!username) {
        showModal('Please enter a username');
        return;
    }
    
    try {
        const response = await api.inviteUsers(roomId, [username]);
        if (response && response.ok) {
            showModal('Invite sent successfully!');
            usernameInput.value = '';
        } else {
            showModal('Failed to send invite');
        }
    } catch (error) {
        console.error('Error sending invite:', error);
        showModal('Could not send invite');
    }
}

// Show Modal
function showModal(message) {
    const modal = document.getElementById('confirmModal');
    const modalMessage = document.getElementById('modalMessage');
    
    if (modal && modalMessage) {
        modalMessage.textContent = message;
        modal.style.display = 'flex';
    }
}

// Cleanup
window.cleanupPage = function() {
    console.log('Cleaning up landing page');
};

// Auto-initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLanding);
} else {
    initLanding();
}
