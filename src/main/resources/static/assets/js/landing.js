const API_BASE = window.location.origin;
let userRooms = [];

function displayUsername() {
    const username = window.getCurrentUser();
    document.querySelectorAll('.username').forEach(el => {
        el.textContent = username;
    });
}

async function loadUserRooms() {
    try {
        const token = sessionStorage.getItem('authToken') || localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}/rooms`, {
            headers: { 'Authorization': `Bearer ${token}` },
            credentials: 'include'
        });
        
        if (response.ok) {
            userRooms = await response.json();
            displayRooms();
            populateRoomDropdown();
        }
    } catch (err) {
        console.error('Failed to load rooms:', err);
    }
}

function displayRooms() {
    const roomsList = document.getElementById('roomsList');
    
    if (userRooms.length === 0) {
        roomsList.innerHTML = '<div style="padding: 20px; text-align: center; color: #66506D; font-size: 12px;">No rooms yet. Create one!</div>';
        return;
    }
    
    roomsList.innerHTML = userRooms.map(room => `
        <div class="room-item" onclick="enterRoom(${room.id})">
            <div class="room-item-name">${room.name}</div>
        </div>
    `).join('');
}

function populateRoomDropdown() {
    const dropdown = document.getElementById('dropdownOptions');
    
    if (userRooms.length === 0) {
        dropdown.innerHTML = '<div class="dropdown-option" style="opacity: 0.5;">No rooms available</div>';
        return;
    }
    
    dropdown.innerHTML = userRooms.map(room => `
        <div class="dropdown-option" data-room-id="${room.id}">${room.name}</div>
    `).join('');
    
    dropdown.querySelectorAll('.dropdown-option').forEach(option => {
        if (option.dataset.roomId) {
            option.addEventListener('click', () => selectRoom(option));
        }
    });
}

function selectRoom(option) {
    const roomId = option.dataset.roomId;
    const roomName = option.textContent;
    
    document.getElementById('dropdownSelected').querySelector('.dropdown-text').textContent = roomName;
    document.getElementById('dropdownSelected').dataset.selectedRoom = roomId;
    document.getElementById('dropdownOptions').classList.remove('show');
    document.getElementById('dropdownArrow').classList.remove('open');
}

async function createRoom() {
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
            showModal('Room created successfully!');
            document.getElementById('roomNameInput').value = '';
            document.getElementById('maxMembersCheck').checked = false;
            document.getElementById('adminOnlyCheck').checked = false;
            document.getElementById('maxMembersInput').disabled = true;
            document.getElementById('maxMembersInput').value = '';
            await loadUserRooms();
        } else {
            showModal('Failed to create room');
        }
    } catch (err) {
        console.error('Create room error:', err);
        showModal('Connection error');
    }
}

async function searchRoom() {
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
        console.error('Search room error:', err);
        resultDiv.innerHTML = '<div class="search-result-empty">Search failed</div>';
    }
}

async function joinRoom(roomId) {
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
        }
    } catch (err) {
        console.error('Join room error:', err);
        showModal('Failed to join room');
    }
}

async function addMemberToRoom() {
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
        console.error('Add member error:', err);
        showModal('Connection error');
    }
}

function enterRoom(roomId) {
    sessionStorage.setItem('currentRoomId', roomId);
    window.navigateTo('room');
}

function showModal(message) {
    const modal = document.getElementById('confirmModal');
    const messageEl = document.getElementById('modalMessage');
    messageEl.textContent = message;
    modal.style.display = 'flex';
}

function initializeUI() {
    const advancedToggle = document.getElementById('advancedToggle');
    const settingsContent = document.getElementById('settingsContent');
    const dropdownIcon = document.getElementById('dropdownIcon');
    
    advancedToggle.addEventListener('click', () => {
        const isOpen = settingsContent.classList.contains('open');
        if (isOpen) {
            settingsContent.classList.remove('open');
            settingsContent.style.display = 'none';
            dropdownIcon.classList.remove('open');
        } else {
            settingsContent.classList.add('open');
            settingsContent.style.display = 'block';
            dropdownIcon.classList.add('open');
        }
    });
    
    document.getElementById('maxMembersCheck').addEventListener('change', (e) => {
        document.getElementById('maxMembersInput').disabled = !e.target.checked;
    });
    
    const dropdownSelected = document.getElementById('dropdownSelected');
    const dropdownOptions = document.getElementById('dropdownOptions');
    const dropdownArrow = document.getElementById('dropdownArrow');
    
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
    
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#roomDropdown')) {
            dropdownOptions.classList.remove('show');
            dropdownArrow.classList.remove('open');
        }
    });
    
    document.getElementById('createRoomBtn').addEventListener('click', createRoom);
    document.getElementById('searchRoomBtn').addEventListener('click', searchRoom);
    document.getElementById('addMemberBtn').addEventListener('click', addMemberToRoom);
    document.getElementById('modalOkBtn').addEventListener('click', () => {
        document.getElementById('confirmModal').style.display = 'none';
    });
    
    const homeBtn = document.querySelector('.icon-btn[title="Home"]');
    if (homeBtn) {
        homeBtn.addEventListener('click', () => window.navigateTo('dashboard'));
    }
    
    const notifBtn = document.querySelector('.icon-btn[title="Notifications"]');
    if (notifBtn) {
        notifBtn.addEventListener('click', () => alert('Notifications feature coming soon!'));
    }
}

window.enterRoom = enterRoom;
window.joinRoom = joinRoom;

displayUsername();
loadUserRooms();
initializeUI();

window.cleanupPage = function() {
    console.log('Landing page cleanup');
};