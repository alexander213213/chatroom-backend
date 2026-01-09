const API_BASE = window.location.origin;
let selectedCharacter = 'default';

function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    toast.style.cssText = `
        padding: 12px 24px;
        margin: 8px 0;
        border-radius: 4px;
        background: ${type === 'success' ? '#4caf50' : '#f44336'};
        color: white;
        font-family: Pixellari;
        opacity: 0;
        transition: opacity 0.3s;
    `;
    
    container.appendChild(toast);
    setTimeout(() => toast.style.opacity = '1', 10);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function switchToSignup() {
    document.getElementById('login').style.display = 'none';
    document.getElementById('signup').style.display = 'flex';
}

function switchToLogin() {
    document.getElementById('signup').style.display = 'none';
    document.getElementById('login').style.display = 'flex';
}

function showCharacterSelect() {
    document.getElementById('signup').style.display = 'none';
    document.getElementById('characterSelect').style.display = 'flex';
    initializeCharacterCarousel();
}

function initializeCharacterCarousel() {
    const track = document.querySelector('.carousel-track');
    const slides = document.querySelectorAll('.character-slide');
    const prevBtn = document.getElementById('prevChar');
    const nextBtn = document.getElementById('nextChar');
    
    if (!track || !slides.length || !prevBtn || !nextBtn) return;
    
    let currentIndex = 0;
    const slideWidth = slides[0].offsetWidth + 20;
    
    function updateCarousel() {
        track.style.transform = `translateX(-${currentIndex * slideWidth}px)`;
        slides.forEach((slide, idx) => {
            slide.classList.toggle('active', idx === currentIndex);
        });
        selectedCharacter = slides[currentIndex].dataset.characterId;
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
    const form = e.target;
    const username = form.username.value.trim();
    const password = form.password.value;
    const keepLoggedIn = document.getElementById('keep_me_login_input').checked;
    
    if (!username || !password) {
        showToast('Please fill in all fields', 'error');
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
            
            if (keepLoggedIn) {
                localStorage.setItem('authToken', token);
                localStorage.setItem('rememberedUser', username);
            }
            
            showToast('Login successful!');
            setTimeout(() => window.location.href = 'index.html', 500);
        } else {
            showToast('Invalid username or password', 'error');
        }
    } catch (err) {
        console.error('Login error:', err);
        showToast('Connection error', 'error');
    }
}

async function handleSignup(e) {
    e.preventDefault();
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
    
    try {
        const response = await fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        if (response.ok) {
            sessionStorage.setItem('pendingUsername', username);
            sessionStorage.setItem('pendingPassword', password);
            showToast('Registration successful! Choose your character');
            setTimeout(showCharacterSelect, 500);
        } else if (response.status === 409) {
            showToast('Username already exists', 'error');
        } else {
            showToast('Registration failed', 'error');
        }
    } catch (err) {
        console.error('Signup error:', err);
        showToast('Connection error', 'error');
    }
}

async function handleCharacterSelect() {
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
            
            showToast('Welcome to MeeTeams!');
            setTimeout(() => window.location.href = 'index.html', 500);
        }
    } catch (err) {
        console.error('Character select error:', err);
        showToast('Connection error', 'error');
    }
}

// Setup event listeners
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.querySelector('#login form');
    const signupForm = document.querySelector('#signup form');
    const signupBtn = document.querySelector('.signup_btn');
    const loginBtn = document.querySelector('.log_btn');
    const selectCharBtn = document.getElementById('selectCharacterBtn');
    
    if (loginForm) loginForm.addEventListener('submit', handleLogin);
    if (signupForm) signupForm.addEventListener('submit', handleSignup);
    if (signupBtn) signupBtn.addEventListener('click', switchToSignup);
    if (loginBtn) loginBtn.addEventListener('click', switchToLogin);
    if (selectCharBtn) selectCharBtn.addEventListener('click', handleCharacterSelect);
});