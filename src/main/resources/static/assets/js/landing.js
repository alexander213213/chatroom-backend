const API_BASE = window.location.origin;
let userRooms = [];

function debugLog(section, message, data = null) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [LANDING-${section}] ${message}`, data || '');
}

function init() {
    debugLog('INIT', 'Landing page initialization');
    displayUsername();
    loadUserRooms();
    setupEventListeners();
}

function displayUsername() {
    const username = window.getCurrentUser();
    document.querySelectorAll('.username').forEach(el => {
        el.textContent = username;
    });
}

async function loadUserRooms() {
    debugLog('ROOMS', 'Loading user rooms');
    
    try {
        const token = sessionStorage.getItem('authToken') || localStorage.getItem('authToken');
        
        if (!token) {
            debugLog('ROOMS', 'ERROR: No token found');
            return;
        }
        
        const response = await fetch(`${API_BASE}/rooms`, {
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            credentials: 'include'
        });
        
        if (response.ok) {
            userRooms = await response.json();
            debugLog('ROOMS', `Loaded ${userRooms.length} rooms`);
            displayRooms();
            populateRoomDropdown();
        } else {
            debugLog('ROOMS', 'ERROR: Failed to load', response.status);
        }
    } catch (err) {
        debugLog('ROOMS', 'EXCEPTION', err);
    }
}

function displayRooms() {
    const roomsList = document.getElementById('roomsList');
    if (!roomsList) return;
    
    if (userRooms.length === 0) {
        roomsList.innerHTML = '<div style="padding: 20px; text-align: center; color: #66506D; font-size: 12px;">No rooms yet. Create one!</div>';
        return;
    }
    
    roomsList.innerHTML = userRooms.map(room => `
        <div class="room-item" onclick="enterRoom(${room.id})">
            <div class="room-item-name">${escapeHtml(room.name)}</div>
        </div>
    `).join('');
}

function populateRoomDropdown() {
    const dropdown = document.getElementById('dropdownOptions');
    if (!dropdown) return;
    
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
    if (selectedText) {
        selectedText.textContent = roomName;
    }
    
    document.getElementById('dropdownSelected').dataset.selectedRoom = roomId;
    document.getElementById('dropdownOptions').classList.remove('show');
    
    const arrow = document.getElementById('dropdownArrow');
    if (arrow) arrow.classList.remove('open');
}

async function createRoom() {
    debugLog('CREATE_ROOM', 'Creating room');
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
        
        if (response.ok) {
            debugLog('CREATE_ROOM', 'Success');
            showModal('Room created successfully!');
            document.getElementById('roomNameInput').value = '';
            await loadUserRooms();
        } else {
            debugLog('CREATE_ROOM', 'ERROR', response.status);
            showModal('Failed to create room');
        }
    } catch (err) {
        debugLog('CREATE_ROOM', 'EXCEPTION', err);
        showModal('Connection error');
    }
}

async function searchRoom() {
    debugLog('SEARCH_ROOM', 'Searching');
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
        debugLog('SEARCH_ROOM', 'EXCEPTION', err);
        resultDiv.innerHTML = '<div class="search-result-empty">Search failed</div>';
    }
}

async function joinRoom(roomId) {
    debugLog('JOIN_ROOM', roomId);
    const username = window.getCurrentUser();
    
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
        debugLog('JOIN_ROOM', 'EXCEPTION', err);
        showModal('Failed to join room');
    }
}

async function addMemberToRoom() {
    debugLog('ADD_MEMBER', 'Adding member');
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
        debugLog('ADD_MEMBER', 'EXCEPTION', err);
        showModal('Connection error');
    }
}

function enterRoom(roomId) {
    debugLog('ENTER_ROOM', roomId);
    sessionStorage.setItem('currentRoomId', roomId);
    window.location.href = 'room.html';
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
    debugLog('EVENTS', 'Setting up listeners');
    
    const dropdownSelected = document.getElementById('dropdownSelected');
    const dropdownOptions = document.getElementById('dropdownOptions');
    const dropdownArrow = document.getElementById('dropdownArrow');
    
    if (dropdownSelected && dropdownOptions && dropdownArrow) {
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
    
    const homeBtn = document.querySelector('.icon-btn[title="Home"]');
    if (homeBtn) {
        homeBtn.addEventListener('click', () => window.location.href = 'dashboard.html');
    }
    
    const notifBtn = document.querySelector('.icon-btn[title="Notifications"]');
    if (notifBtn) {
        notifBtn.addEventListener('click', () => alert('Notifications feature coming soon!'));
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

window.enterRoom = enterRoom;
window.joinRoom = joinRoom;

document.addEventListener('DOMContentLoaded', init);