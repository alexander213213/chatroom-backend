const API_BASE = window.location.origin;
let userRooms = [];

// Debug logging utility
function debugLog(section, message, data = null) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [LANDING-${section}] ${message}`, data || '');
}

// Auth guard - redirect if not logged in
function authGuard() {
    const authToken = sessionStorage.getItem('authToken') || localStorage.getItem('authToken');
    if (!authToken) {
        debugLog('GUARD', 'User not authenticated, redirecting to auth');
        window.location.href = 'auth.html';
        return false;
    }
    return true;
}

// Get current user
function getCurrentUser() {
    return sessionStorage.getItem('currentUser') || 
           localStorage.getItem('rememberedUser') || 
           'Anonymous';
}

// Navigate to room page
function enterRoom(roomId) {
    debugLog('NAVIGATE', 'Entering room', { roomId });
    sessionStorage.setItem('currentRoomId', roomId);
    window.location.href = 'room.html';
}

// Logout function
function logout() {
    debugLog('LOGOUT', 'Logging out user');
    sessionStorage.clear();
    localStorage.removeItem('authToken');
    localStorage.removeItem('rememberedUser');
    window.location.href = 'auth.html';
}

function init() {
    debugLog('INIT', '=== LANDING PAGE INITIALIZATION ===');
    
    if (!authGuard()) return;
    
    displayUsername();
    loadUserRooms();
    setupEventListeners();
    
    debugLog('INIT', 'Initialization completed');
}

function displayUsername() {
    debugLog('USERNAME', 'Displaying username');
    const username = getCurrentUser();
    document.querySelectorAll('.username').forEach(el => {
        el.textContent = username;
    });
}

async function loadUserRooms() {
    debugLog('ROOMS', '=== LOADING USER ROOMS ===');
    
    try {
        const token = sessionStorage.getItem('authToken') || localStorage.getItem('authToken');
        debugLog('ROOMS', 'Token retrieved', token ? `${token.substring(0, 20)}...` : 'NO TOKEN');
        
        if (!token) {
            debugLog('ROOMS', 'ERROR: No authentication token found');
            return;
        }
        
        const url = `${API_BASE}/rooms`;
        debugLog('ROOMS', 'Making fetch request to', url);
        
        const response = await fetch(url, {
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            credentials: 'include'
        });
        
        debugLog('ROOMS', 'Response received', {
            status: response.status,
            statusText: response.statusText,
            ok: response.ok
        });
        
        if (response.ok) {
            const data = await response.json();
            debugLog('ROOMS', 'Rooms data parsed successfully', data);
            userRooms = data;
            debugLog('ROOMS', `Total rooms loaded: ${userRooms.length}`);
            
            displayRooms();
            populateRoomDropdown();
        } else if (response.status === 401) {
            debugLog('ROOMS', 'Unauthorized - redirecting to login');
            logout();
        } else {
            const errorText = await response.text();
            debugLog('ROOMS', 'ERROR: Failed to load rooms', {
                status: response.status,
                errorBody: errorText
            });
        }
    } catch (err) {
        debugLog('ROOMS', 'EXCEPTION', {
            error: err.message,
            stack: err.stack
        });
    }
}

function displayRooms() {
    debugLog('DISPLAY_ROOMS', `Rendering ${userRooms.length} rooms`);
    const roomsList = document.getElementById('roomsList');
    
    if (!roomsList) {
        debugLog('DISPLAY_ROOMS', 'ERROR: roomsList element not found');
        return;
    }
    
    if (userRooms.length === 0) {
        roomsList.innerHTML = '<div style="padding: 20px; text-align: center; color: #66506D; font-size: 12px;">No rooms yet. Create one!</div>';
        return;
    }
    
    roomsList.innerHTML = userRooms.map(room => `
        <div class="room-item" onclick="enterRoom(${room.id})">
            <div class="room-item-name">${escapeHtml(room.name)}</div>
        </div>
    `).join('');
    
    debugLog('DISPLAY_ROOMS', 'Rooms rendered successfully');
}

function populateRoomDropdown() {
    debugLog('DROPDOWN', 'Populating room dropdown');
    const dropdown = document.getElementById('dropdownOptions');
    
    if (!dropdown) {
        debugLog('DROPDOWN', 'ERROR: dropdownOptions element not found');
        return;
    }
    
    if (userRooms.length === 0) {
        dropdown.innerHTML = '<div class="dropdown-option" style="opacity: 0.5;">No rooms available</div>';
        return;
    }
    
    dropdown.innerHTML = userRooms.map(room => 
        `<div class="dropdown-option" data-room-id="${room.id}">${escapeHtml(room.name)}</div>`
    ).join('');
    
    dropdown.querySelectorAll('.dropdown-option').forEach(option => {
        if (option.dataset.roomId) {
            option.addEventListener('click', () => selectRoom(option));
        }
    });
}

function selectRoom(option) {
    const roomId = option.dataset.roomId;
    const roomName = option.textContent;
    
    const selectedText = document.getElementById('dropdownSelected').querySelector('.dropdown-text');
    if (selectedText) selectedText.textContent = roomName;
    
    document.getElementById('dropdownSelected').dataset.selectedRoom = roomId;
    document.getElementById('dropdownOptions').classList.remove('show');
    
    const arrow = document.getElementById('dropdownArrow');
    if (arrow) arrow.classList.remove('open');
}

async function createRoom() {
    debugLog('CREATE_ROOM', '=== CREATING NEW ROOM ===');
    const roomName = document.getElementById('roomNameInput').value.trim();
    
    if (!roomName) {
        showModal('Please enter a room name');
        return;
    }
    
    try {
        const token = sessionStorage.getItem('authToken') || localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}/rooms`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            credentials: 'include',
            body: JSON.stringify({ name: roomName, description: '' })
        });
        
        debugLog('CREATE_ROOM', 'Response', {
            status: response.status,
            ok: response.ok
        });
        
        if (response.ok) {
            showModal('Room created successfully!');
            document.getElementById('roomNameInput').value = '';
            await loadUserRooms();
        } else {
            showModal('Failed to create room');
        }
    } catch (err) {
        debugLog('CREATE_ROOM', 'EXCEPTION', {
            error: err.message,
            stack: err.stack
        });
        showModal('Connection error');
    }
}

async function searchRoom() {
    debugLog('SEARCH_ROOM', '=== SEARCHING FOR ROOM ===');
    const roomId = document.getElementById('roomIdInput').value.trim();
    const resultDiv = document.getElementById('roomSearchResult');
    
    if (!roomId) {
        resultDiv.innerHTML = '';
        return;
    }
    
    try {
        const token = sessionStorage.getItem('authToken') || localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}/rooms/${roomId}`, {
            headers: { 'Authorization': `Bearer ${token}` },
            credentials: 'include'
        });
        
        if (response.ok) {
            const members = await response.json();
            debugLog('SEARCH_ROOM', 'Room found', members);
            
            resultDiv.innerHTML = `
                <div class="team-result-item" onclick="joinRoom(${roomId})">
                    <div class="team-result-info">
                        <div class="team-result-name">Room #${roomId}</div>
                    </div>
                </div>
            `;
        } else {
            resultDiv.innerHTML = '<div class="search-result-empty">Room not found</div>';
        }
    } catch (err) {
        debugLog('SEARCH_ROOM', 'EXCEPTION', {
            error: err.message,
            stack: err.stack
        });
        resultDiv.innerHTML = '<div class="search-result-empty">Search failed</div>';
    }
}

async function joinRoom(roomId) {
    debugLog('JOIN_ROOM', 'Joining room', { roomId });
    const username = getCurrentUser();
    
    try {
        const token = sessionStorage.getItem('authToken') || localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}/rooms/${roomId}/invite`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            credentials: 'include',
            body: JSON.stringify([username])
        });
        
        if (response.ok) {
            showModal('Successfully joined room!');
            await loadUserRooms();
            document.getElementById('roomIdInput').value = '';
            document.getElementById('roomSearchResult').innerHTML = '';
        } else {
            showModal('Failed to join room');
        }
    } catch (err) {
        debugLog('JOIN_ROOM', 'EXCEPTION', {
            error: err.message,
            stack: err.stack
        });
        showModal('Failed to join room');
    }
}

async function addMemberToRoom() {
    debugLog('ADD_MEMBER', '=== ADDING MEMBER ===');
    const selectedRoom = document.getElementById('dropdownSelected').dataset.selectedRoom;
    const username = document.getElementById('addMemberInput').value.trim();
    
    if (!selectedRoom) {
        showModal('Please select a room');
        return;
    }
    
    if (!username) {
        showModal('Please enter a username');
        return;
    }
    
    try {
        const token = sessionStorage.getItem('authToken') || localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}/rooms/${selectedRoom}/invite`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            credentials: 'include',
            body: JSON.stringify([username])
        });
        
        if (response.ok) {
            showModal('Member added successfully!');
            document.getElementById('addMemberInput').value = '';
        } else {
            showModal('Failed to add member');
        }
    } catch (err) {
        debugLog('ADD_MEMBER', 'EXCEPTION', {
            error: err.message,
            stack: err.stack
        });
        showModal('Connection error');
    }
}

function showModal(message) {
    const modal = document.getElementById('confirmModal');
    const messageEl = document.getElementById('modalMessage');
    if (modal && messageEl) {
        messageEl.textContent = message;
        modal.style.display = 'flex';
    }
}

function setupEventListeners() {
    debugLog('EVENTS', 'Setting up event listeners');
    
    const advancedToggle = document.getElementById('advancedToggle');
    const settingsContent = document.getElementById('settingsContent');
    const dropdownIcon = document.getElementById('dropdownIcon');
    
    if (advancedToggle) {
        advancedToggle.addEventListener('click', () => {
            const isOpen = settingsContent.style.display === 'block';
            settingsContent.style.display = isOpen ? 'none' : 'block';
            dropdownIcon.classList.toggle('open');
        });
    }
    
    const maxMembersCheck = document.getElementById('maxMembersCheck');
    const maxMembersInput = document.getElementById('maxMembersInput');
    if (maxMembersCheck && maxMembersInput) {
        maxMembersCheck.addEventListener('change', (e) => {
            maxMembersInput.disabled = !e.target.checked;
        });
    }
    
    const dropdownSelected = document.getElementById('dropdownSelected');
    const dropdownOptions = document.getElementById('dropdownOptions');
    const dropdownArrow = document.getElementById('dropdownArrow');
    
    if (dropdownSelected) {
        dropdownSelected.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = dropdownOptions.classList.contains('show');
            if (isOpen) {
                dropdownOptions.classList.remove('show');
                dropdownArrow.classList.remove('open');
            } else {
                dropdownOptions.classList.add('show');
                dropdownArrow.classList.add('open');
            }
        });
    }
    
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#roomDropdown') && dropdownOptions) {
            dropdownOptions.classList.remove('show');
            if (dropdownArrow) dropdownArrow.classList.remove('open');
        }
    });
    
    const createRoomBtn = document.getElementById('createRoomBtn');
    if (createRoomBtn) createRoomBtn.addEventListener('click', createRoom);
    
    const searchRoomBtn = document.getElementById('searchRoomBtn');
    if (searchRoomBtn) searchRoomBtn.addEventListener('click', searchRoom);
    
    const addMemberBtn = document.getElementById('addMemberBtn');
    if (addMemberBtn) addMemberBtn.addEventListener('click', addMemberToRoom);
    
    const modalOkBtn = document.getElementById('modalOkBtn');
    if (modalOkBtn) {
        modalOkBtn.addEventListener('click', () => {
            const modal = document.getElementById('confirmModal');
            if (modal) modal.style.display = 'none';
        });
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Global functions
window.enterRoom = enterRoom;
window.joinRoom = joinRoom;
window.getCurrentUser = getCurrentUser;

// Initialize on page load
document.addEventListener('DOMContentLoaded', init);

debugLog('INIT', '✓ Landing.js loaded');