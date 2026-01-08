const API_BASE = window.location.origin;
let userRooms = [];

// Debug logging utility
function debugLog(section, message, data = null) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${section}] ${message}`;
    console.log(logMessage, data || '');
}

function init() {
    debugLog('INIT', 'Landing page initialization started');
    displayUsername();
    loadUserRooms();
    setupEventListeners();
    debugLog('INIT', 'Landing page initialization completed');
}

function displayUsername() {
    debugLog('USERNAME', 'Attempting to display username');
    const username = window.getCurrentUser();
    debugLog('USERNAME', 'Retrieved username', username);
    
    document.querySelectorAll('.username').forEach(el => {
        el.textContent = username;
        debugLog('USERNAME', 'Updated username element', el);
    });
}

async function loadUserRooms() {
    debugLog('ROOMS', '=== LOADING USER ROOMS ===');
    
    try {
        const token = sessionStorage.getItem('authToken') || localStorage.getItem('authToken');
        debugLog('ROOMS', 'Retrieved token', token ? `${token.substring(0, 20)}...` : 'NO TOKEN');
        
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
            ok: response.ok,
            headers: Object.fromEntries(response.headers.entries())
        });
        
        if (response.ok) {
            const data = await response.json();
            debugLog('ROOMS', 'Rooms data parsed successfully', data);
            userRooms = data;
            debugLog('ROOMS', `Total rooms loaded: ${userRooms.length}`);
            
            displayRooms();
            populateRoomDropdown();
        } else {
            const errorText = await response.text();
            debugLog('ROOMS', 'ERROR: Failed to load rooms', {
                status: response.status,
                statusText: response.statusText,
                errorBody: errorText
            });
        }
    } catch (err) {
        debugLog('ROOMS', 'EXCEPTION: Failed to load rooms', {
            error: err.message,
            stack: err.stack
        });
        console.error('Full error object:', err);
    }
}

function displayRooms() {
    debugLog('DISPLAY_ROOMS', 'Starting to display rooms');
    const roomsList = document.getElementById('roomsList');
    
    if (!roomsList) {
        debugLog('DISPLAY_ROOMS', 'ERROR: roomsList element not found in DOM');
        return;
    }
    
    debugLog('DISPLAY_ROOMS', `Rendering ${userRooms.length} rooms`);
    
    if (userRooms.length === 0) {
        const emptyMessage = '<div style="padding: 20px; text-align: center; color: #66506D; font-size: 12px;">No rooms yet. Create one!</div>';
        roomsList.innerHTML = emptyMessage;
        debugLog('DISPLAY_ROOMS', 'Displayed empty state message');
        return;
    }
    
    const roomsHTML = userRooms.map((room, index) => {
        debugLog('DISPLAY_ROOMS', `Rendering room ${index + 1}`, {
            id: room.id,
            name: room.name,
            description: room.description
        });
        
        return `
            <div class="room-item" onclick="enterRoom(${room.id})">
                <div class="room-item-name">${escapeHtml(room.name)}</div>
            </div>
        `;
    }).join('');
    
    roomsList.innerHTML = roomsHTML;
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
        debugLog('DROPDOWN', 'Displayed no rooms message');
        return;
    }
    
    dropdown.innerHTML = userRooms.map(room => {
        debugLog('DROPDOWN', `Adding room to dropdown: ${room.name} (ID: ${room.id})`);
        return `<div class="dropdown-option" data-room-id="${room.id}">${escapeHtml(room.name)}</div>`;
    }).join('');
    
    dropdown.querySelectorAll('.dropdown-option').forEach(option => {
        if (option.dataset.roomId) {
            option.addEventListener('click', () => {
                debugLog('DROPDOWN', `Room selected: ${option.dataset.roomId}`);
                selectRoom(option);
            });
        }
    });
    
    debugLog('DROPDOWN', 'Dropdown populated successfully');
}

function selectRoom(option) {
    const roomId = option.dataset.roomId;
    const roomName = option.textContent;
    
    debugLog('SELECT_ROOM', 'Room selection', { roomId, roomName });
    
    const selectedText = document.getElementById('dropdownSelected').querySelector('.dropdown-text');
    if (selectedText) {
        selectedText.textContent = roomName;
        debugLog('SELECT_ROOM', 'Updated selected text');
    }
    
    document.getElementById('dropdownSelected').dataset.selectedRoom = roomId;
    document.getElementById('dropdownOptions').classList.remove('show');
    
    const arrow = document.getElementById('dropdownArrow');
    if (arrow) arrow.classList.remove('open');
    
    debugLog('SELECT_ROOM', 'Room selection completed');
}

async function createRoom() {
    debugLog('CREATE_ROOM', '=== CREATING NEW ROOM ===');
    const roomName = document.getElementById('roomNameInput').value.trim();
    
    debugLog('CREATE_ROOM', 'Room name input', roomName);
    
    if (!roomName) {
        debugLog('CREATE_ROOM', 'ERROR: Empty room name');
        showModal('Please enter a room name');
        return;
    }
    
    try {
        const token = sessionStorage.getItem('authToken') || localStorage.getItem('authToken');
        debugLog('CREATE_ROOM', 'Token retrieved', token ? `${token.substring(0, 20)}...` : 'NO TOKEN');
        
        const url = `${API_BASE}/rooms`;
        const payload = { name: roomName, description: '' };
        
        debugLog('CREATE_ROOM', 'Making POST request', {
            url,
            payload
        });
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            credentials: 'include',
            body: JSON.stringify(payload)
        });
        
        debugLog('CREATE_ROOM', 'Response received', {
            status: response.status,
            ok: response.ok
        });
        
        if (response.ok) {
            debugLog('CREATE_ROOM', 'Room created successfully');
            showModal('Room created successfully!');
            document.getElementById('roomNameInput').value = '';
            
            const maxMembersCheck = document.getElementById('maxMembersCheck');
            const adminOnlyCheck = document.getElementById('adminOnlyCheck');
            const maxMembersInput = document.getElementById('maxMembersInput');
            
            if (maxMembersCheck) maxMembersCheck.checked = false;
            if (adminOnlyCheck) adminOnlyCheck.checked = false;
            if (maxMembersInput) {
                maxMembersInput.disabled = true;
                maxMembersInput.value = '';
            }
            
            await loadUserRooms();
        } else {
            const errorText = await response.text();
            debugLog('CREATE_ROOM', 'ERROR: Failed to create room', {
                status: response.status,
                error: errorText
            });
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
    
    debugLog('SEARCH_ROOM', 'Search room ID', roomId);
    
    if (!roomId) {
        resultDiv.innerHTML = '';
        debugLog('SEARCH_ROOM', 'Empty search query');
        return;
    }
    
    try {
        const token = sessionStorage.getItem('authToken') || localStorage.getItem('authToken');
        const url = `${API_BASE}/rooms/${roomId}`;
        
        debugLog('SEARCH_ROOM', 'Fetching room', url);
        
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` },
            credentials: 'include'
        });
        
        debugLog('SEARCH_ROOM', 'Response', {
            status: response.status,
            ok: response.ok
        });
        
        if (response.ok) {
            const members = await response.json();
            debugLog('SEARCH_ROOM', 'Room found with members', members);
            
            resultDiv.innerHTML = `
                <div class="team-result-item" onclick="joinRoom(${roomId})">
                    <div class="team-result-info">
                        <div class="team-result-name">Room #${roomId}</div>
                    </div>
                </div>
            `;
        } else {
            debugLog('SEARCH_ROOM', 'Room not found');
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
    debugLog('JOIN_ROOM', '=== JOINING ROOM ===', { roomId });
    const username = window.getCurrentUser();
    
    debugLog('JOIN_ROOM', 'Current user', username);
    
    try {
        const token = sessionStorage.getItem('authToken') || localStorage.getItem('authToken');
        const url = `${API_BASE}/rooms/${roomId}/invite`;
        const payload = [username];
        
        debugLog('JOIN_ROOM', 'Sending invite request', {
            url,
            payload
        });
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            credentials: 'include',
            body: JSON.stringify(payload)
        });
        
        debugLog('JOIN_ROOM', 'Response', {
            status: response.status,
            ok: response.ok
        });
        
        if (response.ok) {
            debugLog('JOIN_ROOM', 'Successfully joined room');
            showModal('Successfully joined room!');
            await loadUserRooms();
            document.getElementById('roomIdInput').value = '';
            document.getElementById('roomSearchResult').innerHTML = '';
        } else {
            const errorText = await response.text();
            debugLog('JOIN_ROOM', 'ERROR', {
                status: response.status,
                error: errorText
            });
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
    debugLog('ADD_MEMBER', '=== ADDING MEMBER TO ROOM ===');
    const selectedRoom = document.getElementById('dropdownSelected').dataset.selectedRoom;
    const username = document.getElementById('addMemberInput').value.trim();
    
    debugLog('ADD_MEMBER', 'Input data', {
        selectedRoom,
        username
    });
    
    if (!selectedRoom) {
        debugLog('ADD_MEMBER', 'ERROR: No room selected');
        showModal('Please select a room');
        return;
    }
    
    if (!username) {
        debugLog('ADD_MEMBER', 'ERROR: No username entered');
        showModal('Please enter a username');
        return;
    }
    
    try {
        const token = sessionStorage.getItem('authToken') || localStorage.getItem('authToken');
        const url = `${API_BASE}/rooms/${selectedRoom}/invite`;
        const payload = [username];
        
        debugLog('ADD_MEMBER', 'Sending request', {
            url,
            payload
        });
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            credentials: 'include',
            body: JSON.stringify(payload)
        });
        
        debugLog('ADD_MEMBER', 'Response', {
            status: response.status,
            ok: response.ok
        });
        
        if (response.ok) {
            debugLog('ADD_MEMBER', 'Member added successfully');
            showModal('Member added successfully!');
            document.getElementById('addMemberInput').value = '';
        } else {
            const errorText = await response.text();
            debugLog('ADD_MEMBER', 'ERROR', {
                status: response.status,
                error: errorText
            });
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

function enterRoom(roomId) {
    debugLog('ENTER_ROOM', 'Entering room', { roomId });
    sessionStorage.setItem('currentRoomId', roomId);
    window.navigateTo('room');
}

function showModal(message) {
    debugLog('MODAL', 'Showing modal', message);
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
    
    if (advancedToggle && settingsContent && dropdownIcon) {
        advancedToggle.addEventListener('click', () => {
            const isOpen = settingsContent.style.display === 'block';
            settingsContent.style.display = isOpen ? 'none' : 'block';
            dropdownIcon.classList.toggle('open');
            debugLog('EVENTS', 'Advanced settings toggled', { isOpen: !isOpen });
        });
    }
    
    const maxMembersCheck = document.getElementById('maxMembersCheck');
    const maxMembersInput = document.getElementById('maxMembersInput');
    if (maxMembersCheck && maxMembersInput) {
        maxMembersCheck.addEventListener('change', (e) => {
            maxMembersInput.disabled = !e.target.checked;
            debugLog('EVENTS', 'Max members checkbox changed', { checked: e.target.checked });
        });
    }
    
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
            debugLog('EVENTS', 'Dropdown toggled', { isOpen: !isOpen });
        });
    }
    
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#roomDropdown') && dropdownOptions) {
            dropdownOptions.classList.remove('show');
            if (dropdownArrow) dropdownArrow.classList.remove('open');
        }
    });
    
    const createRoomBtn = document.getElementById('createRoomBtn');
    if (createRoomBtn) {
        createRoomBtn.addEventListener('click', createRoom);
        debugLog('EVENTS', 'Create room button listener attached');
    }
    
    const searchRoomBtn = document.getElementById('searchRoomBtn');
    if (searchRoomBtn) {
        searchRoomBtn.addEventListener('click', searchRoom);
        debugLog('EVENTS', 'Search room button listener attached');
    }
    
    const addMemberBtn = document.getElementById('addMemberBtn');
    if (addMemberBtn) {
        addMemberBtn.addEventListener('click', addMemberToRoom);
        debugLog('EVENTS', 'Add member button listener attached');
    }
    
    const modalOkBtn = document.getElementById('modalOkBtn');
    if (modalOkBtn) {
        modalOkBtn.addEventListener('click', () => {
            const modal = document.getElementById('confirmModal');
            if (modal) modal.style.display = 'none';
        });
    }
    
    const homeBtn = document.querySelector('.icon-btn[title="Home"]');
    if (homeBtn) {
        homeBtn.addEventListener('click', () => {
            debugLog('EVENTS', 'Home button clicked');
            window.navigateTo('dashboard');
        });
    }
    
    const notifBtn = document.querySelector('.icon-btn[title="Notifications"]');
    if (notifBtn) {
        notifBtn.addEventListener('click', () => alert('Notifications feature coming soon!'));
    }
    
    debugLog('EVENTS', 'All event listeners setup completed');
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

window.enterRoom = enterRoom;
window.joinRoom = joinRoom;

init();

window.cleanupPage = function() {
    debugLog('CLEANUP', 'Landing page cleanup');
};