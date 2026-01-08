const API_BASE = window.location.origin;
let userRooms = [];
let connections = [];

function displayUsername() {
    const username = window.getCurrentUser();
    document.querySelectorAll('.username').forEach(el => {
        el.textContent = username;
    });
    document.querySelector('.profile-details h2').textContent = username;
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
    teamsGrid.querySelector('.team-name').textContent = featuredRoom.name;
    teamsGrid.querySelector('.team-meta:first-of-type').textContent = `Room ID: ${featuredRoom.id}`;
    teamsGrid.querySelector('.team-meta:last-of-type').textContent = featuredRoom.description || 'No description';
}

function displayConnections() {
    const connectionsList = document.querySelector('.connections-list');
    
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
            <div class="connection-avatar">👤</div>
            <div class="connection-name">${username}</div>
        </div>
    `).join('');
}

function updateStats() {
    document.querySelector('.profile-stat:first-child').textContent = `Teams: ${userRooms.length}`;
    document.querySelector('.profile-stat:last-child').textContent = `${connections.length} Connections`;
}

function filterConnections(searchTerm) {
    const filtered = connections.filter(name => 
        name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    const connectionsList = document.querySelector('.connections-list');
    
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
            <div class="connection-avatar">👤</div>
            <div class="connection-name">${username}</div>
        </div>
    `).join('');
}

function initializeUI() {
    const searchBox = document.querySelector('.search-box');
    searchBox.addEventListener('input', (e) => {
        filterConnections(e.target.value);
    });
    
    document.querySelector('.logout-btn').addEventListener('click', () => {
        if (confirm('Are you sure you want to logout?')) {
            window.logout();
        }
    });
    
    document.querySelector('.icon-btn[title="Home"]').addEventListener('click', () => {
        window.navigateTo('landing');
    });
    
    document.querySelector('.view-profile').addEventListener('click', () => {
        alert('Profile feature coming soon!');
    });
}

displayUsername();
loadDashboardData();
initializeUI();

window.cleanupPage = function() {
    console.log('Dashboard page cleanup');
};