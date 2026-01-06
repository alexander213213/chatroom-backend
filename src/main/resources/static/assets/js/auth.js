console.log('Auth page loaded');

// Use CONFIG from app.js (already declared globally)

// Carousel state
let currentCharacterIndex = 0;
let selectedCharacterId = null;

//Toast Notification Function
function showToast(message, type = 'info'){
  // Create container if it doesn't exist
  let container = document.getElementById('toastContainer');
  if(!container){
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.style.cssText = 'position: fixed; bottom: 24px; right: 24px; z-index: 9999;';
    document.body.appendChild(container);
  }
  
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.style.cssText = `
    background: #1e2128;
    border-radius: 12px;
    padding: 16px 20px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.3);
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 300px;
    color: #e0e0e0;
    border: 1px solid #3a3d45;
    margin-bottom: 12px;
    animation: slideIn 0.3s ease;
  `;
  
  const icons = {
    success: '✓',
    error: '✕',
    info: 'ℹ'
  };

  const borderColors = {
    success: '#7dd3c0',
    error: '#ff6b6b',
    info: '#4ecdc4'
  };

  toast.style.borderLeft = `4px solid ${borderColors[type]}`;

  toast.innerHTML = `
    <div style="font-size: 20px;">${icons[type]}</div>
    <div style="flex: 1;">
      <div style="font-size: 14px;">${message}</div>
    </div>
  `;
  
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 5000);
}

//Toggle between Login, Signup, and Character Select
function showSignup(){
  const loginDiv = document.getElementById('login');
  const signupDiv = document.getElementById('signup');
  const characterSelectDiv = document.getElementById('characterSelect');
  
  if(loginDiv) loginDiv.style.display = 'none';
  if(signupDiv) signupDiv.style.display = 'flex';
  if(characterSelectDiv) characterSelectDiv.style.display = 'none';
  console.log('Switched to signup form');
}

function showLogin(){
  const loginDiv = document.getElementById('login');
  const signupDiv = document.getElementById('signup');
  const characterSelectDiv = document.getElementById('characterSelect');
  
  if(loginDiv) loginDiv.style.display = 'flex';
  if(signupDiv) signupDiv.style.display = 'none';
  if(characterSelectDiv) characterSelectDiv.style.display = 'none';
  console.log('Switched to login form');
}

function showCharacterSelect(){
  const loginDiv = document.getElementById('login');
  const signupDiv = document.getElementById('signup');
  const characterSelectDiv = document.getElementById('characterSelect');
  
  if(loginDiv) loginDiv.style.display = 'none';
  if(signupDiv) signupDiv.style.display = 'none';
  if(characterSelectDiv) characterSelectDiv.style.display = 'flex';
  
  // Reset to first character
  currentCharacterIndex = 0;
  updateCharacterDisplay();
  
  console.log('Switched to character select');
}

//Character Navigation Functions
function updateCharacterDisplay(){
  const slides = document.querySelectorAll('.character-slide');
  
  if(slides.length === 0) return;
  
  // Remove active class from all slides
  slides.forEach(slide => slide.classList.remove('active'));
  
  // Add active class to current slide
  if(slides[currentCharacterIndex]){
    slides[currentCharacterIndex].classList.add('active');
    selectedCharacterId = slides[currentCharacterIndex].getAttribute('data-character-id');
    console.log('Showing character:', selectedCharacterId, 'at index:', currentCharacterIndex);
  }
}

function nextCharacter(){
  const slides = document.querySelectorAll('.character-slide');
  if(currentCharacterIndex < slides.length - 1){
    currentCharacterIndex++;
  } else {
    // Loop back to first character
    currentCharacterIndex = 0;
  }
  updateCharacterDisplay();
}

function prevCharacter(){
  const slides = document.querySelectorAll('.character-slide');
  if(currentCharacterIndex > 0){
    currentCharacterIndex--;
  } else {
    // Loop to last character
    currentCharacterIndex = slides.length - 1;
  }
  updateCharacterDisplay();
}

//Register Function
async function handleRegister(event){
  event.preventDefault();
  console.log('Register button clicked');
  
  // Get inputs from the SIGNUP form specifically
  const signupDiv = document.getElementById('signup');
  if(!signupDiv){
    console.error('Signup div not found');
    return;
  }
  
  const usernameInput = signupDiv.querySelector('input[name="username"]');
  const passwordInput = signupDiv.querySelector('input[name="password"]');
  
  if(!usernameInput || !passwordInput){
    console.error('Signup form inputs not found');
    showToast('Form inputs not found', 'error');
    return;
  }
  
  const username = usernameInput.value.trim();
  const password = passwordInput.value;

  if(!username || !password){
    showToast('Please enter username and password', 'error');
    return;
  }

  console.log('Attempting registration for:', username);

  try{
    const response = await fetch(`${CONFIG.API_BASE}/auth/register`,{
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    if(response.ok){
      showToast('Account created! Please select your character.', 'success');
      
      //Clear form
      usernameInput.value = '';
      passwordInput.value = '';
      
      //Save username temporarily for character selection
      sessionStorage.setItem('newUserUsername', username);
      
      //Switch to character select
      setTimeout(() => {
        showCharacterSelect();
      }, 1000);
    }else{
      const text = await response.text();
      showToast(text || 'Registration failed', 'error');
    }
  }catch (err){
    console.error('Registration error:', err);
    showToast('Error: ' + err.message, 'error');
  }
}

//Character Selection Function
async function handleCharacterSelect(){
  console.log('Character select button clicked');
  
  if(!selectedCharacterId){
    showToast('Please select a character', 'error');
    return;
  }
  
  const username = sessionStorage.getItem('newUserUsername');
  
  if(!username){
    showToast('Session expired. Please log in.', 'error');
    showLogin();
    return;
  }

  console.log('Selected character:', selectedCharacterId);

  try{
    // Save character selection to backend
    const response = await fetch(`${CONFIG.API_BASE}/user/character`,{
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, characterId: selectedCharacterId })
    });

    if(response.ok){
      showToast('Character selected!', 'success');
      
      // Save to session
      sessionStorage.setItem('currentUser', username);
      sessionStorage.setItem('selectedCharacter', selectedCharacterId);
      
      // Clear temporary storage
      sessionStorage.removeItem('newUserUsername');
      
      //Use the global authentication function from app.js
      if(typeof setAuthenticated === 'function'){
        setAuthenticated('user-token-' + Date.now());
      }
      
      //Navigate to landing page
      setTimeout(() => {
        if(typeof navigateTo === 'function'){
          navigateTo('landing');
        }
      }, 1000);
    }else{
      const text = await response.text();
      showToast(text || 'Failed to save character', 'error');
    }
  }catch (err){
    console.error('Character selection error:', err);
    showToast('Error: ' + err.message, 'error');
  }
}

//Login Function
async function handleLogin(event){
  event.preventDefault();
  console.log('Login button clicked');
  
  // Get inputs from the LOGIN form specifically
  const loginDiv = document.getElementById('login');
  if(!loginDiv){
    console.error('Login div not found');
    return;
  }
  
  const usernameInput = loginDiv.querySelector('input[name="username"]');
  const passwordInput = loginDiv.querySelector('input[name="password"]');
  const rememberMeCheckbox = document.getElementById('keep_me_login_input');
  
  if(!usernameInput || !passwordInput){
    console.error('Login form inputs not found');
    showToast('Form inputs not found', 'error');
    return;
  }
  
  const username = usernameInput.value.trim();
  const password = passwordInput.value;
  const rememberMe = rememberMeCheckbox ? rememberMeCheckbox.checked : false;

  if(!username || !password){
    showToast('Please enter username and password', 'error');
    return;
  }

  console.log('Attempting login for:', username);

  try{
    const response = await fetch(`${CONFIG.API_BASE}/auth/login`,{
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    if(response.ok){
      //Save to localStorage only if "Keep me logged in" is checked
      if (rememberMe) {
        localStorage.setItem('rememberedUser', username);
      }
      
      //Always save to sessionStorage for current session
      sessionStorage.setItem('currentUser', username);
      
      showToast('Welcome back!', 'success');
      
      //Use the global authentication function from app.js
      if(typeof setAuthenticated === 'function'){
        setAuthenticated('user-token-' + Date.now());
      } else {
        console.error('setAuthenticated function not found');
      }
      
      //Navigate to landing page (existing users already have character)
      setTimeout(() => {
        if(typeof navigateTo === 'function'){
          navigateTo('landing');
        } else {
          console.error('navigateTo function not found');
        }
      }, 1000);
      
    }else{
      const text = await response.text();
      showToast(text || 'Invalid credentials', 'error');
    }
  }catch (err){
    console.error('Login error:', err);
    showToast('Error: ' + err.message, 'error');
  }
}

//Initialize Auth Page
function initAuthPage(){
  console.log('Initializing auth page...');
  
  // Wait for DOM to be ready
  setTimeout(() => {
    // Get forms
    const loginForm = document.querySelector('#login form');
    const signupForm = document.querySelector('#signup form');
    
    // Get buttons
    const loginButton = document.querySelector('#login .login_btn');
    const registerButton = document.querySelector('#signup .register_btn');
    const signupToggleBtn = document.querySelector('#login .signup_btn');
    const loginToggleBtn = document.querySelector('#signup .log_btn');
    
    // Get carousel controls
    const prevBtn = document.getElementById('prevChar');
    const nextBtn = document.getElementById('nextChar');
    const selectCharBtn = document.getElementById('selectCharacterBtn');
    const characterSlides = document.querySelectorAll('.character-slide');
    
    //Debug: Check if elements exist
    console.log('Login form found:', !!loginForm);
    console.log('Signup form found:', !!signupForm);
    console.log('Login button found:', !!loginButton);
    console.log('Register button found:', !!registerButton);
    console.log('Signup toggle found:', !!signupToggleBtn);
    console.log('Login toggle found:', !!loginToggleBtn);
    console.log('Carousel controls found:', !!prevBtn, !!nextBtn, !!selectCharBtn);
    console.log('Character slides found:', characterSlides.length);
    
    // Add event listeners for LOGIN
    if(loginForm){
      loginForm.addEventListener('submit', handleLogin);
      console.log('✓ Login form listener added');
    }
    
    if(loginButton){
      loginButton.addEventListener('click', (e) => {
        e.preventDefault();
        handleLogin(e);
      });
      console.log('✓ Login button listener added');
    }
    
    // Add event listeners for SIGNUP
    if(signupForm){
      signupForm.addEventListener('submit', handleRegister);
      console.log('✓ Signup form listener added');
    }
    
    if(registerButton){
      registerButton.addEventListener('click', (e) => {
        e.preventDefault();
        handleRegister(e);
      });
      console.log('✓ Register button listener added');
    }
    
    // Add event listeners for TOGGLE buttons
    if(signupToggleBtn){
      signupToggleBtn.addEventListener('click', (e) => {
        e.preventDefault();
        showSignup();
      });
      console.log('✓ Signup toggle listener added');
    }
    
    if(loginToggleBtn){
      loginToggleBtn.addEventListener('click', (e) => {
        e.preventDefault();
        showLogin();
      });
      console.log('✓ Login toggle listener added');
    }
    
    // Add event listeners for CHARACTER NAVIGATION
    if(prevBtn){
      prevBtn.addEventListener('click', prevCharacter);
      console.log('✓ Previous button listener added');
    }
    
    if(nextBtn){
      nextBtn.addEventListener('click', nextCharacter);
      console.log('✓ Next button listener added');
    }
    
    if(selectCharBtn){
      selectCharBtn.addEventListener('click', handleCharacterSelect);
      console.log('✓ Select character button listener added');
    }
    
    // Initialize character display
    if(characterSlides.length > 0){
      updateCharacterDisplay();
      console.log('✓ Character display initialized');
    }
    
    // Make sure login is shown by default
    showLogin();
    
    console.log('✓ Auth page initialized successfully');
    
    // Check for existing session after initialization
    checkExistingSession();
  }, 150);
}

//Check for Existing Session
async function checkExistingSession(){
  //Check localStorage first (if "Keep me logged in" was checked)
  let savedUser = localStorage.getItem('rememberedUser');
  
  //If not in localStorage, check sessionStorage (current session only)
  if(!savedUser){
    savedUser = sessionStorage.getItem('currentUser');
  }
  
  if(savedUser){
    console.log('Found saved session for:', savedUser);
    //Verify session is still valid with backend
    try{
      const response = await fetch(`${CONFIG.API_BASE}/auth/verify`, {
        method: 'GET',
        credentials: 'include'
      });
      
      if(response.ok){
        //Session is valid, redirect to landing page
        console.log('Valid session found, redirecting...');
        if(typeof setAuthenticated === 'function'){
          setAuthenticated('existing-session');
        }
        if(typeof navigateTo === 'function'){
          navigateTo('landing');
        }
      }else{
        //Session expired, clear storage
        console.log('Session expired');
        sessionStorage.removeItem('currentUser');
        localStorage.removeItem('rememberedUser');
      }
    }catch (err){
      //If verification fails, clear storage
      sessionStorage.removeItem('currentUser');
      localStorage.removeItem('rememberedUser');
      console.error('Session verification failed:', err);
    }
  }
}

//Initialize immediately
initAuthPage();

//Cleanup function (called when leaving the page)
window.cleanupPage = function(){
  console.log('Cleaning up auth page');
  
  // Get all elements
  const loginForm = document.querySelector('#login form');
  const signupForm = document.querySelector('#signup form');
  const loginButton = document.querySelector('#login .login_btn');
  const registerButton = document.querySelector('#signup .register_btn');
  const signupToggleBtn = document.querySelector('#login .signup_btn');
  const loginToggleBtn = document.querySelector('#signup .log_btn');
  
  // Remove event listeners
  if(loginForm){
    const newLoginForm = loginForm.cloneNode(true);
    loginForm.parentNode.replaceChild(newLoginForm, loginForm);
  }
  
  if(signupForm){
    const newSignupForm = signupForm.cloneNode(true);
    signupForm.parentNode.replaceChild(newSignupForm, signupForm);
  }
  
  console.log('✓ Auth page cleaned up');
};