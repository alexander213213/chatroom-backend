console.log('Dashboard page loaded');

// ============================================
// CONFIG - Using existing CONFIG from app.js
// ============================================
// CONFIG is already available globally from app.js

// ============================================
// API FUNCTIONS (Extracted from working codebase)
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
            // Use global logout function
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
    
    async getRoomMembers(roomId) {
        return await this.request(`/rooms/${roomId}`);
    },
    
    async logout() {
        return await this.request('/auth/logout', {
            method: 'POST'
        });
    }
};

// ============================================
// STATE MANAGEMENT
// ============================================
let currentUsername = null;
let currentTeamIndex = 0;
let currentFileIndex = 0;
let expandedConnection = null;
let rooms = [];
let notifications = []; // Real notifications from WebSocket

// Mock data for features not yet in API
const mockFiles = [
    { name: 'Wahoo.pdf', type: 'pdf' },
    { name: 'Report.xlsx', type: 'xlsx' },
    { name: 'Photo.jpg', type: 'jpg' },
    { name: 'Notes.txt', type: 'txt' },
    { name: 'Presentation.pptx', type: 'pptx' }
];

let connections = [];

// ============================================
// UTILITY FUNCTIONS
// ============================================

// Get file icon based on extension
function getFileIcon(fileType) {
    const icons = {
        'pdf': '📄',
        'pptx': '📄',
        'xlsx': '📊',
        'jpg': '📷',
        'jpeg': '📷',
        'png': '📷',
        'txt': '📋',
        'doc': '📄',
        'docx': '📄'
    };
    return icons[fileType.toLowerCase()] || '📁';
}

// Truncate long filenames with ellipsis
function truncateFilename(filename, maxLength = 15) {
    if (filename.length <= maxLength) return filename;
    const ext = filename.split('.').pop();
    const name = filename.substring(0, filename.lastIndexOf('.'));
    const truncated = name.substring(0, maxLength - ext.length - 4) + '...';
    return `${truncated}.${ext}`;
}

// Calculate total connections from all teams
function getTotalConnections() {
    // Count unique members from connections list (excluding current user)
    return connections.length;
}

// ============================================
// INITIALIZATION
// ============================================
function initDashboard() {
    console.log('Initializing dashboard...');
    
    // Check authentication (using global checkAuth)
    if (typeof checkAuth === 'function' && !checkAuth()) {
        console.log('Not authenticated, redirecting...');
        if (typeof navigateTo === 'function') {
            navigateTo('auth');
        }
        return;
    }
    
    // Get current username from session/localStorage
    currentUsername = sessionStorage.getItem('currentUser') || 
                     localStorage.getItem('rememberedUser') || 
                     localStorage.getItem('username') || 
                     'User';
    
    // Connect to WebSocket for real-time notifications
    connectWebSocketForNotifications();
    
    // Load data and setup
    loadUserData();
    setupEventListeners();
    
    console.log('✓ Dashboard initialized');
}

// ============================================
// DATA LOADING
// ============================================
async function loadUserData() {
    try {
        // Load rooms from API
        const response = await api.getRooms();
        if (response && response.ok) {
            rooms = await response.json();
            console.log('Loaded rooms:', rooms);
            
            // Load members from all rooms to build connections
            await loadAllConnections();
        } else {
            rooms = [];
            console.log('No rooms loaded or error occurred');
        }
    } catch (error) {
        console.error('Error loading rooms:', error);
        rooms = [];
    }
    
    // Populate UI with loaded data
    populateUserData();
    renderCurrentTeam();
    renderCurrentFile();
    renderConnections();
}

// Load all unique members from all rooms
async function loadAllConnections() {
    const membersByUser = new Map();
    
    try {
        // Fetch members from each room
        for (const room of rooms) {
            const response = await api.getRoomMembers(room.id);
            if (response && response.ok) {
                const members = await response.json();
                
                // Process each member
                members.forEach(memberName => {
                    // Skip current user
                    if (memberName === currentUsername) return;
                    
                    // Add or update member's teams
                    if (!membersByUser.has(memberName)) {
                        membersByUser.set(memberName, {
                            name: memberName,
                            mutualTeams: []
                        });
                    }
                    membersByUser.get(memberName).mutualTeams.push(room.name);
                });
            }
        }
        
        // Convert map to array
        connections = Array.from(membersByUser.values());
        console.log('Loaded connections:', connections);
        
    } catch (error) {
        console.error('Error loading connections:', error);
        connections = [];
    }
}

// ============================================
// USER DATA POPULATION
// ============================================
function populateUserData() {
    // Top bar profile
    const topAvatar = document.querySelector('.top-bar .avatar');
    const topUsername = document.querySelector('.top-bar .username');
    if (topAvatar) topAvatar.textContent = '👨‍💻';
    if (topUsername) topUsername.textContent = currentUsername;
    
    // Profile card
    const profileName = document.querySelector('.profile-details h2');
    const joinedDate = document.querySelector('.profile-meta span');
    const teamCount = document.querySelector('.profile-stat:nth-child(1)');
    const connectionCount = document.querySelector('.profile-stat:nth-child(2)');
    
    if (profileName) profileName.textContent = currentUsername;
    if (joinedDate) joinedDate.innerHTML = `📅 Joined Dec 2025`;
    if (teamCount) teamCount.textContent = `Teams: ${rooms.length}`;
    if (connectionCount) connectionCount.textContent = `${getTotalConnections()} Connections`;
}

// ============================================
// EVENT LISTENERS SETUP
// ============================================
function setupEventListeners() {
    // Notification button
    const notifBtn = document.querySelectorAll('.icon-btn')[0];
    if (notifBtn) {
        notifBtn.addEventListener('click', toggleNotificationModal);
    }
    
    // Home button
    const homeBtn = document.querySelectorAll('.icon-btn')[1];
    if (homeBtn) {
        homeBtn.addEventListener('click', () => {
            if (typeof navigateTo === 'function') {
                navigateTo('landing');
            }
        });
    }
    
    // View Profile link (already on profile, scroll to top)
    const viewProfile = document.querySelector('.view-profile');
    if (viewProfile) {
        viewProfile.addEventListener('click', (e) => {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }
    
    // Team navigation arrows
    const teamArrows = document.querySelectorAll('.nav-arrows .arrow-btn');
    if (teamArrows.length >= 2) {
        teamArrows[0].addEventListener('click', () => navigateTeams('prev'));
        teamArrows[1].addEventListener('click', () => navigateTeams('next'));
    }
    
    // File navigation arrows
    const fileArrows = document.querySelectorAll('.filenav-arrows .arrow-btn');
    if (fileArrows.length >= 2) {
        fileArrows[0].addEventListener('click', () => navigateFiles('prev'));
        fileArrows[1].addEventListener('click', () => navigateFiles('next'));
    }
    
    // Search box
    const searchBox = document.querySelector('.search-box');
    if (searchBox) {
        // Clear placeholder on focus
        searchBox.addEventListener('focus', function() {
            if (this.value === '🔍 John Doe') {
                this.value = '';
            }
        });
        searchBox.addEventListener('input', handleSearch);
    }
    
    // Logout button
    const logoutBtn = document.querySelector('.logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
}

// ============================================
// NOTIFICATION MODAL
// ============================================
function createNotificationModal() {
    if (document.getElementById('notificationModal')) return;
    
    const modal = document.createElement('div');
    modal.id = 'notificationModal';
    modal.style.cssText = `
        position: fixed;
        top: 120px;
        right: 30px;
        width: 350px;
        max-height: 500px;
        background: #654E66;
        border: 3px solid #f5f3e5;
        border-radius: 3px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.3);
        z-index: 1000;
        display: none;
        overflow: hidden;
    `;
    
    modal.innerHTML = `
        <div style="padding: 20px; border-bottom: 2px solid #f5f3e5;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <h3 style="color: #f5f3e5; font-size: 18px; margin: 0;">Notifications</h3>
                <button id="closeNotifModal" style="
                    background: transparent;
                    border: none;
                    color: #f5f3e5;
                    font-size: 24px;
                    cursor: pointer;
                    padding: 0;
                    width: 30px;
                    height: 30px;
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

function renderNotifications() {
    const notifList = document.getElementById('notificationList');
    if (!notifList) return;
    
    if (notifications.length === 0) {
        notifList.innerHTML = `
            <div style="text-align: center; padding: 40px 20px; color: #f5f3e5; opacity: 0.7;">
                No new notifications
            </div>
        `;
        return;
    }
    
    notifList.innerHTML = notifications.map(notif => `
        <div class="notification-item" data-id="${notif.id}" style="
            background: rgba(245, 243, 229, 0.1);
            border: 2px solid #f5f3e5;
            border-radius: 3px;
            padding: 15px;
            margin-bottom: 10px;
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            cursor: pointer;
            transition: all 0.2s;
        ">
            <div style="flex: 1;">
                <div style="color: #f5f3e5; font-size: 14px; margin-bottom: 5px;">
                    ${notif.type === 'invite' ? '📨' : '💬'} ${notif.text}
                </div>
                <div style="color: #f5f3e5; opacity: 0.7; font-size: 12px;">
                    ${notif.time || formatNotificationTime(notif.timestamp)}
                </div>
            </div>
            <button class="delete-notif" data-id="${notif.id}" style="
                background: transparent;
                border: 2px solid #f5f3e5;
                color: #f5f3e5;
                width: 24px;
                height: 24px;
                border-radius: 50%;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 16px;
                padding: 0;
                margin-left: 10px;
            ">×</button>
        </div>
    `).join('');
    
    notifList.querySelectorAll('.delete-notif').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteNotification(parseInt(btn.dataset.id));
        });
    });
}

function formatNotificationTime(timestamp) {
    if (!timestamp) return 'Just now';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
}

function toggleNotificationModal() {
    const modal = document.getElementById('notificationModal');
    if (!modal) {
        createNotificationModal();
        document.getElementById('notificationModal').style.display = 'block';
    } else {
        modal.style.display = modal.style.display === 'none' ? 'block' : 'none';
    }
}

function deleteNotification(notifId) {
    const index = notifications.findIndex(n => n.id === notifId);
    if (index !== -1) {
        notifications.splice(index, 1);
        renderNotifications();
        updateNotificationBadge();
    }
}

// ============================================
// WEBSOCKET FOR NOTIFICATIONS
// ============================================
function connectWebSocketForNotifications() {
    // Use global stompClient if available, otherwise create new connection
    if (typeof window.stompClient !== 'undefined' && window.stompClient && window.stompClient.connected) {
        console.log('Using existing WebSocket connection');
        subscribeToNotifications();
        return;
    }
    
    // Check if SockJS and Stomp are available
    if (typeof SockJS === 'undefined' || typeof Stomp === 'undefined') {
        console.warn('WebSocket libraries not loaded, notifications will not work in real-time');
        return;
    }
    
    try {
        const token = localStorage.getItem('token');
        const socket = new SockJS(CONFIG.WS_BASE);
        const stompClient = Stomp.over(socket);
        
        stompClient.connect(
            { Authorization: `Bearer ${token}` },
            (frame) => {
                console.log('✓ WebSocket connected for notifications');
                subscribeToNotifications();
            },
            (error) => {
                console.error('WebSocket connection error:', error);
                // Retry after 5 seconds
                setTimeout(connectWebSocketForNotifications, 5000);
            }
        );
        
        // Save to global scope if needed
        if (!window.stompClient) {
            window.stompClient = stompClient;
        }
    } catch (error) {
        console.error('Failed to connect WebSocket:', error);
    }
}

function subscribeToNotifications() {
    const stompClient = window.stompClient;
    
    if (!stompClient || !stompClient.connected) {
        console.error('Cannot subscribe to notifications: WebSocket not connected');
        return;
    }
    
    // Subscribe to user-specific notifications
    stompClient.subscribe(`/user/${currentUsername}/notifications`, (message) => {
        const notification = JSON.parse(message.body);
        handleIncomingNotification(notification);
    });
    
    console.log(`✓ Subscribed to notifications for ${currentUsername}`);
}

function handleIncomingNotification(notification) {
    console.log('📨 New notification received:', notification);
    
    // Add to notifications array (newest first)
    notifications.unshift(notification);
    
    // Keep only last 50 notifications
    if (notifications.length > 50) {
        notifications = notifications.slice(0, 50);
    }
    
    // Update UI if modal is open
    if (document.getElementById('notificationModal')?.style.display === 'block') {
        renderNotifications();
    }
    
    // Update notification badge
    updateNotificationBadge();
    
    // Optional: Show toast notification
    showToastNotification(notification);
}

function updateNotificationBadge() {
    // Optional: Add a badge count to the notification bell
    const notifBtn = document.querySelectorAll('.icon-btn')[0];
    if (!notifBtn) return;
    
    const count = notifications.length;
    
    // Remove existing badge
    const existingBadge = notifBtn.querySelector('.notification-badge');
    if (existingBadge) {
        existingBadge.remove();
    }
    
    // Add new badge if there are notifications
    if (count > 0) {
        const badge = document.createElement('span');
        badge.className = 'notification-badge';
        badge.textContent = count > 9 ? '9+' : count;
        badge.style.cssText = `
            position: absolute;
            top: 5px;
            right: 5px;
            background: #ff4444;
            color: white;
            font-size: 10px;
            font-weight: bold;
            border-radius: 50%;
            width: 18px;
            height: 18px;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 2px solid #f5d6bc;
        `;
        notifBtn.style.position = 'relative';
        notifBtn.appendChild(badge);
    }
}

function showToastNotification(notification) {
    // Optional: Show a small toast/popup for new notifications
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        top: 120px;
        right: 30px;
        background: #654E66;
        border: 3px solid #f5f3e5;
        border-radius: 3px;
        padding: 15px 20px;
        color: #f5f3e5;
        font-size: 14px;
        z-index: 9999;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        animation: slideInRight 0.3s ease;
        max-width: 300px;
    `;
    toast.innerHTML = `
        ${notification.type === 'invite' ? '📨' : '💬'} ${notification.text}
    `;
    
    document.body.appendChild(toast);
    
    // Remove after 4 seconds
    setTimeout(() => {
        toast.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// ============================================
// TEAM CAROUSEL
// ============================================
function renderCurrentTeam() {
    const teamsGrid = document.querySelector('.teams-grid');
    if (!teamsGrid) return;
    
    teamsGrid.querySelectorAll('.team-card').forEach(card => card.remove());
    
    if (rooms.length === 0) {
        const emptyCard = document.createElement('div');
        emptyCard.className = 'team-card';
        emptyCard.innerHTML = `
            <div class="team-info">
                <div class="team-name">No Teams</div>
                <div class="team-meta">Create a team to get started</div>
            </div>
        `;
        teamsGrid.insertBefore(emptyCard, teamsGrid.querySelector('.nav-arrows'));
        return;
    }
    
    const team = rooms[currentTeamIndex];
    const teamCard = document.createElement('div');
    teamCard.className = 'team-card';
    teamCard.innerHTML = `
        <div class="team-info">
            <div class="team-name">${team.name}</div>
            <div class="team-meta">Created by: ${team.user?.username || 'Unknown'}</div>
        </div>
    `;
    
    teamsGrid.insertBefore(teamCard, teamsGrid.querySelector('.nav-arrows'));
}

function navigateTeams(direction) {
    if (rooms.length === 0) return;
    
    if (direction === 'prev') {
        currentTeamIndex = (currentTeamIndex - 1 + rooms.length) % rooms.length;
    } else {
        currentTeamIndex = (currentTeamIndex + 1) % rooms.length;
    }
    renderCurrentTeam();
}

// ============================================
// FILE CAROUSEL
// ============================================
function renderCurrentFile() {
    const filesArea = document.querySelector('.files-area');
    if (!filesArea) return;
    
    if (mockFiles.length === 0) {
        filesArea.innerHTML = `
            <div class="files-content">
                <div class="file-icon">📁</div>
                <div class="file-name">No files uploaded</div>
            </div>
        `;
        return;
    }
    
    const file = mockFiles[currentFileIndex];
    const icon = getFileIcon(file.type);
    const displayName = truncateFilename(file.name, 15);
    
    filesArea.innerHTML = `
        <div class="files-content">
            <div class="file-icon">${icon}</div>
            <div class="file-name" title="${file.name}">${displayName}</div>
        </div>
    `;
}

function navigateFiles(direction) {
    if (mockFiles.length === 0) return;
    
    if (direction === 'prev') {
        currentFileIndex = (currentFileIndex - 1 + mockFiles.length) % mockFiles.length;
    } else {
        currentFileIndex = (currentFileIndex + 1) % mockFiles.length;
    }
    renderCurrentFile();
}

// ============================================
// CONNECTIONS PANEL
// ============================================
function renderConnections(filter = '') {
    const connectionsList = document.querySelector('.connections-list');
    if (!connectionsList) return;
    
    const filtered = connections.filter(conn => 
        conn.name.toLowerCase().includes(filter.toLowerCase())
    );
    
    if (filtered.length === 0) {
        connectionsList.innerHTML = `
            <div style="text-align: center; padding: 20px; color: #2a1810; opacity: 0.5;">
                ${filter ? 'No connections found' : 'No connections yet'}
            </div>
        `;
        return;
    }
    
    connectionsList.innerHTML = filtered.map((conn, index) => `
        <div class="connection-wrapper" data-index="${index}">
            <div class="connection-item" data-name="${conn.name}">
                <div class="connection-profile">${conn.name.charAt(0).toUpperCase()}</div>
                <div class="connection-name">${conn.name}</div>
            </div>
            <div class="mutual-teams" style="
                display: none;
                background: rgba(245, 243, 229, 0.3);
                padding: 10px;
                margin-top: 5px;
                border-radius: 3px;
                font-size: 12px;
                color: #2a1810;
            ">
                <div style="font-weight: bold; margin-bottom: 5px;">Mutual Teams:</div>
                ${conn.mutualTeams.map(team => `<div>• ${team}</div>`).join('')}
            </div>
        </div>
    `).join('');
    
    connectionsList.querySelectorAll('.connection-item').forEach(item => {
        item.addEventListener('click', () => {
            const wrapper = item.parentElement;
            const mutualTeams = wrapper.querySelector('.mutual-teams');
            const isExpanded = mutualTeams.style.display === 'block';
            
            connectionsList.querySelectorAll('.mutual-teams').forEach(mt => {
                mt.style.display = 'none';
            });
            
            if (!isExpanded) {
                mutualTeams.style.display = 'block';
            }
        });
    });
}

function handleSearch(e) {
    const searchTerm = e.target.value.replace('🔍', '').trim();
    renderConnections(searchTerm);
}

// ============================================
// LOGOUT
// ============================================
async function handleLogout() {
    if (!confirm('Are you sure you want to logout?')) return;
    
    try {
        await api.logout();
    } catch (error) {
        console.error('Logout error:', error);
    }
    
    // Use global logout function if available
    if (typeof logout === 'function') {
        logout();
    } else {
        // Fallback manual logout
        sessionStorage.removeItem('authToken');
        sessionStorage.removeItem('currentUser');
        localStorage.removeItem('authToken');
        localStorage.removeItem('rememberedUser');
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        
        if (typeof navigateTo === 'function') {
            navigateTo('auth');
        }
    }
}

// ============================================
// CLEANUP
// ============================================
window.cleanupPage = function() {
    console.log('Cleaning up dashboard page');
    
    const modal = document.getElementById('notificationModal');
    if (modal) modal.remove();
    
    console.log('✓ Dashboard page cleaned up');
};

// ============================================
// AUTO-INITIALIZE
// ============================================
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDashboard);
} else {
    initDashboard();
}