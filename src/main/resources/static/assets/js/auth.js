const API_BASE = window.location.origin;

let selectedCharacter = 'default';
let stompClient = null;

// Debug logging
function debugLog(section, message, data = null) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [AUTH-${section}] ${message}`, data || '');
}

// Auth guard - redirect if already logged in
function authGuard() {
    const authToken = sessionStorage.getItem('authToken') || localStorage.getItem('authToken');
    if (authToken) {
        debugLog('GUARD', 'User already authenticated, redirecting to landing');
        window.location.href = 'landing.html';
    }
}

// Toast notification
function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    toast.style.cssText = `
        padding: 12px 24px;
        margin-bottom: 10px;
        border-radius: 4px;
        background: ${type === 'success' ? '#4caf50' : '#f44336'};
        color: white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        animation: slideIn 0.3s ease;
    `;
    container.appendChild(toast);
    
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function switchToSignup() {
    debugLog('SWITCH', 'Switching to signup form');
    document.getElementById('login').style.display = 'none';
    document.getElementById('signup').style.display = 'flex';
}

function switchToLogin() {
    debugLog('SWITCH', 'Switching to login form');
    document.getElementById('signup').style.display = 'none';
    document.getElementById('login').style.display = 'flex';
}

function showCharacterSelect() {
    debugLog('CHARACTER', 'Showing character selection');
    document.getElementById('signup').style.display = 'none';
    document.getElementById('characterSelect').style.display = 'flex';
    initializeCharacterCarousel();
}

function initializeCharacterCarousel() {
    debugLog('CAROUSEL', 'Initializing character carousel');
    const track = document.querySelector('.carousel-track');
    const slides = document.querySelectorAll('.character-slide');
    const prevBtn = document.getElementById('prevChar');
    const nextBtn = document.getElementById('nextChar');
    
    let currentIndex = 0;
    
    function updateCarousel() {
        slides.forEach((slide, idx) => {
            slide.classList.toggle('active', idx === currentIndex);
        });
        selectedCharacter = slides[currentIndex].dataset.characterId;
        debugLog('CAROUSEL', 'Character selected', selectedCharacter);
    }
    
    prevBtn.addEventListener('click', () => {
        currentIndex = currentIndex > 0 ? currentIndex - 1 : slides.length - 1;
        updateCarousel();
    });
    
    nextBtn.addEventListener('click', () => {
        currentIndex = currentIndex < slides.length - 1 ? currentIndex + 1 : 0;
        updateCarousel();
    });
    
    slides.forEach((slide, idx) => {
        slide.addEventListener('click', () => {
            currentIndex = idx;
            updateCarousel();
        });
    });
    
    updateCarousel();
}

async function handleLogin(e) {
    e.preventDefault();
    debugLog('LOGIN', '=== ATTEMPTING LOGIN ===');
    
    const form = e.target;
    const username = form.username.value.trim();
    const password = form.password.value;
    const keepLoggedIn = document.getElementById('keep_me_login_input').checked;
    
    if (!username || !password) {
        showToast('Please fill in all fields', 'error');
        return;
    }
    
    debugLog('LOGIN', 'Credentials', { username, keepLoggedIn });
    
    try {
        const response = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
            credentials: 'include'
        });
        
        debugLog('LOGIN', 'Response', {
            status: response.status,
            ok: response.ok
        });
        
        if (response.ok) {
            const token = await response.text();
            sessionStorage.setItem('currentUser', username);
            sessionStorage.setItem('authToken', token);
            
            if (keepLoggedIn) {
                localStorage.setItem('authToken', token);
                localStorage.setItem('rememberedUser', username);
                debugLog('LOGIN', 'Saved to localStorage for persistent login');
            }
            
            // Connect WebSocket
            connectWebSocket(token);
            
            showToast('Login successful!');
            debugLog('LOGIN', 'Login successful, redirecting to landing');
            
            setTimeout(() => {
                window.location.href = 'landing.html';
            }, 500);
        } else {
            showToast('Invalid username or password', 'error');
            debugLog('LOGIN', 'Login failed', response.status);
        }
    } catch (err) {
        debugLog('LOGIN', 'EXCEPTION', {
            error: err.message,
            stack: err.stack
        });
        showToast('Connection error', 'error');
    }
}

async function handleSignup(e) {
    e.preventDefault();
    debugLog('SIGNUP', '=== ATTEMPTING SIGNUP ===');
    
    const form = e.target;
    const username = form.username.value.trim();
    const password = form.password.value;
    
    if (!username || !password) {
        showToast('Please fill in all fields', 'error');
        return;
    }
    
    if (password.length < 6) {
        showToast('Password must be at least 6 characters', 'error');
        return;
    }
    
    debugLog('SIGNUP', 'Registration data', { username });
    
    try {
        const response = await fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        debugLog('SIGNUP', 'Response', {
            status: response.status,
            ok: response.ok
        });
        
        if (response.ok) {
            sessionStorage.setItem('pendingUsername', username);
            sessionStorage.setItem('pendingPassword', password);
            showToast('Registration successful! Choose your character');
            debugLog('SIGNUP', 'Registration successful');
            setTimeout(showCharacterSelect, 500);
        } else if (response.status === 409) {
            showToast('Username already exists', 'error');
            debugLog('SIGNUP', 'Username conflict');
        } else {
            showToast('Registration failed', 'error');
            debugLog('SIGNUP', 'Registration failed', response.status);
        }
    } catch (err) {
        debugLog('SIGNUP', 'EXCEPTION', {
            error: err.message,
            stack: err.stack
        });
        showToast('Connection error', 'error');
    }
}

async function handleCharacterSelect() {
    debugLog('CHARACTER', '=== CHARACTER SELECTED ===', selectedCharacter);
    
    const username = sessionStorage.getItem('pendingUsername');
    const password = sessionStorage.getItem('pendingPassword');
    
    if (!username || !password) {
        showToast('Session expired, please sign up again', 'error');
        switchToSignup();
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
            credentials: 'include'
        });
        
        if (response.ok) {
            const token = await response.text();
            sessionStorage.setItem('currentUser', username);
            sessionStorage.setItem('authToken', token);
            sessionStorage.setItem('selectedCharacter', selectedCharacter);
            sessionStorage.removeItem('pendingUsername');
            sessionStorage.removeItem('pendingPassword');
            
            // Connect WebSocket
            connectWebSocket(token);
            
            showToast('Welcome to MeeTeams!');
            debugLog('CHARACTER', 'Auto-login successful, redirecting');
            
            setTimeout(() => {
                window.location.href = 'landing.html';
            }, 500);
        }
    } catch (err) {
        debugLog('CHARACTER', 'EXCEPTION', {
            error: err.message,
            stack: err.stack
        });
        showToast('Connection error', 'error');
    }
}

function connectWebSocket(token) {
    debugLog('WEBSOCKET', 'Connecting to WebSocket');
    
    if (typeof SockJS === 'undefined' || typeof Stomp === 'undefined') {
        debugLog('WEBSOCKET', 'ERROR: Libraries not loaded');
        return;
    }
    
    try {
        const socket = new SockJS(`${window.location.origin}/ws`);
        stompClient = Stomp.over(socket);
        stompClient.debug = null;
        
        stompClient.connect({}, 
            () => {
                debugLog('WEBSOCKET', '✓ Connected successfully');
            },
            (error) => {
                debugLog('WEBSOCKET', 'ERROR: Connection failed', error);
            }
        );
    } catch (err) {
        debugLog('WEBSOCKET', 'EXCEPTION', {
            error: err.message,
            stack: err.stack
        });
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    debugLog('INIT', 'Auth page loaded');
    authGuard();
    
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    document.getElementById('signupForm').addEventListener('submit', handleSignup);
    document.getElementById('switchToSignup').addEventListener('click', switchToSignup);
    document.getElementById('switchToLogin').addEventListener('click', switchToLogin);
    document.getElementById('selectCharacterBtn').addEventListener('click', handleCharacterSelect);
    
    debugLog('INIT', 'Event listeners attached');
});

debugLog('INIT', '✓ Auth.js loaded');