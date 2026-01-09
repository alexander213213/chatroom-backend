const API_BASE = window.location.origin;
let userRooms = [];
let connections = [];

function displayUsername() {
    const username = window.getCurrentUser();
    document.querySelectorAll('.username').forEach(el => {
        el.textContent = username;
    });
    const profileHeader = document.querySelector('.profile-details h2');
    if (profileHeader) profileHeader.textContent = username;
}

async function loadDashboardData() {
    await Promise.all([
        loadUserRooms(),
        loadConnections()
    ]);
    updateStats();
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
            displayFeaturedTeams();
        }
    } catch (err) {
        console.error('Failed to load rooms:', err);
    }
}

async function loadConnections() {
    try {
        const token = sessionStorage.getItem('authToken') || localStorage.getItem('authToken');
        connections = [];
        
        for (const room of userRooms) {
            const response = await fetch(`${API_BASE}/rooms/${room.id}`, {
                headers: { 'Authorization': `Bearer ${token}` },
                credentials: 'include'
            });
            
            if (response.ok) {
                const members = await response.json();
                members.forEach(member => {
                    if (member !== window.getCurrentUser() && !connections.includes(member)) {
                        connections.push(member);
                    }
                });
            }
        }
        
        displayConnections();
    } catch (err) {
        console.error('Failed to load connections:', err);
    }
}

function displayFeaturedTeams() {
    const teamsGrid = document.querySelector('.teams-grid');
    if (!teamsGrid) return;
    
    if (userRooms.length === 0) {
        teamsGrid.querySelector('.team-card').innerHTML = `
            <div class="team-info">
                <div class="team-name">No teams yet</div>
                <div class="team-meta">Create a room to get started</div>
            </div>
        `;
        return;
    }
    
    const featuredRoom = userRooms[0];
    const teamName = teamsGrid.querySelector('.team-name');
    const teamMetas = teamsGrid.querySelectorAll('.team-meta');
    
    if (teamName) teamName.textContent = featuredRoom.name;
    if (teamMetas.length >= 2) {
        teamMetas[0].textContent = `Room ID: ${featuredRoom.id}`;
        teamMetas[1].textContent = featuredRoom.description || 'No description';
    }
}

function displayConnections() {
    const connectionsList = document.querySelector('.connections-list');
    if (!connectionsList) return;
    
    if (connections.length === 0) {
        connectionsList.innerHTML = `
            <div style="text-align: center; padding: 20px; color: #2a1810; opacity: 0.5;">
                No connections yet
            </div>
        `;
        return;
    }
    
    connectionsList.innerHTML = connections.map(username => `
        <div class="connection-item">
            <div class="connection-profile">👤</div>
            <div class="connection-name">${username}</div>
        </div>
    `).join('');
}

function updateStats() {
    const stats = document.querySelectorAll('.profile-stat');
    if (stats.length >= 2) {
        stats[0].textContent = `Teams: ${userRooms.length}`;
        stats[1].textContent = `${connections.length} Connections`;
    }
}

function filterConnections(searchTerm) {
    const filtered = connections.filter(name => 
        name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    const connectionsList = document.querySelector('.connections-list');
    if (!connectionsList) return;
    
    if (filtered.length === 0) {
        connectionsList.innerHTML = `
            <div style="text-align: center; padding: 20px; color: #2a1810; opacity: 0.5;">
                No matches found
            </div>
        `;
        return;
    }
    
    connectionsList.innerHTML = filtered.map(username => `
        <div class="connection-item">
            <div class="connection-profile">👤</div>
            <div class="connection-name">${username}</div>
        </div>
    `).join('');
}

function initializeUI() {
    const searchBox = document.querySelector('.search-box');
    if (searchBox) {
        searchBox.addEventListener('input', (e) => {
            filterConnections(e.target.value);
        });
    }
    
    const logoutBtn = document.querySelector('.logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to logout?')) {
                window.logout();
            }
        });
    }
    
    const viewProfile = document.querySelector('.view-profile');
    if (viewProfile) {
        viewProfile.addEventListener('click', () => {
            alert('Profile feature coming soon!');
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    displayUsername();
    loadDashboardData();
    initializeUI();
});