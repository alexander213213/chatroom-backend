//Dynamic Loader with Debug Logging

// Debug logging utility
function debugLog(section, message, data = null) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [APP-${section}] ${message}`;
    console.log(logMessage, data || '');
}

//Configuration of each pages of the website
const pages = {
    'landing': {
        html: 'pages/landing.html',
        css: 'assets/css/landing.css',
        js: 'assets/js/landing.js'
    },
    'auth': {
        html: 'pages/auth.html',
        css: 'assets/css/auth.css',
        js: 'assets/js/auth.js'
    },
    'dashboard': {
        html: 'pages/dashboard.html',
        css: 'assets/css/dashboard.css',
        js: 'assets/js/dashboard.js'
    },
    'room': {
        html: 'pages/room.html',
        css: 'assets/css/room.css',
        js: 'assets/js/room.js'
    }
};
const DEFAULT_PAGE = 'auth'; //this is the default page
const PAGES_WITHOUT_COMPONENTS = ['auth']; //no navbar & footer

//Dynamic URL
const CONFIG = {
    API_BASE: window.location.origin,
    WS_BASE: window.location.origin + '/ws'
};

//State management
let currentPageScript = null;
let currentPage = null;
let isAuthenticated = false;

//Websocket state
let stompClient = null;
let currentRoomSubscription = null;
let reactionSubscription = null;

//Checks if user has a token (log in authentication)
function checkAuth(){
    debugLog('AUTH', 'Checking authentication status');
    const authToken = sessionStorage.getItem('authToken') || localStorage.getItem('authToken');
    isAuthenticated = !!authToken;
    debugLog('AUTH', 'Authentication status', {
        isAuthenticated,
        hasSessionToken: !!sessionStorage.getItem('authToken'),
        hasLocalToken: !!localStorage.getItem('authToken')
    });
    return isAuthenticated;
}

//Successful log in or sign up
function setAuthenticated(token = 'authenticated') {
    debugLog('AUTH', 'Setting authenticated', { tokenLength: token.length });
    sessionStorage.setItem('authToken', token);
    isAuthenticated = true;
    connectWebSocket();
    debugLog('AUTH', 'User authenticated successfully');
}

//Log out
function logout(){
    debugLog('AUTH', 'Logging out user');
    disconnectWebSocket();
    sessionStorage.removeItem('authToken');
    localStorage.removeItem('authToken');
    sessionStorage.removeItem('currentUser');
    localStorage.removeItem('rememberedUser');
    isAuthenticated = false;
    debugLog('AUTH', 'User logged out, navigating to auth page');
    navigateTo('auth');
}

//Websocket management

//Connect to server
function connectWebSocket() {
    debugLog('WEBSOCKET', '=== CONNECTING TO WEBSOCKET ===');
    
    //Don't connect if already connected
    if(stompClient && stompClient.connected){
        debugLog('WEBSOCKET', 'Already connected, skipping');
        return;
    }
    
    //Check if SockJS and Stomp are loaded
    if(typeof SockJS === 'undefined' || typeof Stomp === 'undefined'){
        debugLog('WEBSOCKET', 'ERROR: SockJS or Stomp library not loaded');
        console.error('SockJS or Stomp library not loaded');
        return;
    }
    
    try{
        const wsUrl = CONFIG.WS_BASE;
        debugLog('WEBSOCKET', 'Creating SockJS connection to', wsUrl);
        
        const socket = new SockJS(wsUrl);
        stompClient = Stomp.over(socket);
        
        //Disable debug logs in production
        stompClient.debug = null;

        debugLog('WEBSOCKET', 'Attempting STOMP connection...');
        
        stompClient.connect({}, 
            //Success callback
            () => {
                debugLog('WEBSOCKET', '✓ WebSocket connected successfully');
                //Update global reference
                window.stompClient = stompClient;
            }, 
            //Error callback
            (error) => {
                debugLog('WEBSOCKET', 'ERROR: WebSocket connection failed', {
                    error: error.toString(),
                    stack: error.stack
                });
                console.error('WebSocket connection error:', error);
            }
        );
    }catch (err){
        debugLog('WEBSOCKET', 'EXCEPTION: Failed to initialize WebSocket', {
            error: err.message,
            stack: err.stack
        });
        console.error('Failed to initialize WebSocket:', err);
    }
}

//Disconnect from server
function disconnectWebSocket(){
    debugLog('WEBSOCKET', 'Disconnecting WebSocket');
    
    // Unsubscribe from all topics
    if(currentRoomSubscription){
        currentRoomSubscription.unsubscribe();
        currentRoomSubscription = null;
        debugLog('WEBSOCKET', 'Unsubscribed from room messages');
    }
    if(reactionSubscription){
        reactionSubscription.unsubscribe();
        reactionSubscription = null;
        debugLog('WEBSOCKET', 'Unsubscribed from reactions');
    }
    
    //Disconnect the client
    if(stompClient && stompClient.connected){
        stompClient.disconnect(() => {
            debugLog('WEBSOCKET', '✓ WebSocket disconnected');
        });
        stompClient = null;
        window.stompClient = null;
    }
}

//check if connected
function isWebSocketConnected(){
    const connected = stompClient && stompClient.connected;
    debugLog('WEBSOCKET', 'Connection status check', { connected });
    return connected;
}

//Injection Functions

//HTML injection 
async function injectHTML(filePath, elem){
    debugLog('INJECT_HTML', 'Injecting HTML from', filePath);
    
    try{
        const response = await fetch(filePath);
        if (!response.ok){
            debugLog('INJECT_HTML', `ERROR: Failed to load ${filePath}`, response.status);
            console.error(`Failed to load ${filePath}: ${response.status}`);
            return;
        }
        const text = await response.text();
        elem.innerHTML = text;
        
        debugLog('INJECT_HTML', 'HTML injected, reinjecting scripts');
        
        // Reinject all <script> tags
        elem.querySelectorAll("script").forEach(script =>{
            const newScript = document.createElement("script");
            Array.from(script.attributes).forEach(attr =>
                newScript.setAttribute(attr.name, attr.value)
            );
            newScript.appendChild(
                document.createTextNode(script.innerHTML)
            );
            script.parentNode.replaceChild(newScript, script);
        });
        
        debugLog('INJECT_HTML', 'HTML injection completed successfully');
    }catch (err){
        debugLog('INJECT_HTML', 'EXCEPTION', {
            error: err.message,
            stack: err.stack
        });
        console.error(`Error injecting HTML: ${err.message}`);
    }
}

//Injects Navbar, Footer to pages needing it (anything with <div include =>)
function injectAll(){
    debugLog('INJECT_ALL', 'Injecting all components (navbar, footer, etc.)');
    document.querySelectorAll("div[include]")
        .forEach((elem) => {
            const includePath = elem.getAttribute("include");
            debugLog('INJECT_ALL', 'Injecting component from', includePath);
            injectHTML(includePath, elem);
        });
}

//Loads the CSS by changing the <link id="page.css"> of index.html to a specific file
function loadCSS(cssPath){
    debugLog('CSS', 'Loading CSS from', cssPath);
    const pageCssLink = document.getElementById('page-css');
    if(pageCssLink){
        pageCssLink.href = `${cssPath}?v=${Date.now()}`;
        debugLog('CSS', 'CSS loaded successfully');
    }else{
        debugLog('CSS', 'ERROR: page-css link element not found in HTML');
        console.warn('page-css link element not found in HTML');
    }
}

//Unloads the CSS file
function unloadCSS(){
    debugLog('CSS', 'Unloading CSS');
    const pageCssLink = document.getElementById('page-css');
    if(pageCssLink){
        pageCssLink.href = '';
    }
}

//Loads specific JavaScript files to the index.html and unloads old ones
function loadJS(jsPath){
    debugLog('JS', 'Loading JavaScript from', jsPath);
    
    return new Promise((resolve, reject) => {
        //Remove previous page script if exists
        if(currentPageScript){
            debugLog('JS', 'Removing previous page script');
            currentPageScript.remove();
            currentPageScript = null;
        }
        
        const script = document.createElement('script');
        script.src = `${jsPath}?v=${Date.now()}`;
        script.onload = () => {
            debugLog('JS', `✓ Loaded: ${jsPath}`);
            resolve();
        };
        script.onerror = () => {
            debugLog('JS', `ERROR: Failed to load: ${jsPath}`);
            console.error(`Failed to load: ${jsPath}`);
            reject(new Error(`Failed to load script: ${jsPath}`));
        };
        
        document.body.appendChild(script);
        currentPageScript = script;
    });
}

//Clean 
function cleanupPreviousPage(){
    debugLog('CLEANUP', 'Cleaning up previous page');
    
    //Call cleanup function if page defined one
    if(window.cleanupPage && typeof window.cleanupPage === 'function'){
        try {
            debugLog('CLEANUP', 'Calling page cleanup function');
            window.cleanupPage();
        } catch (err) {
            debugLog('CLEANUP', 'ERROR during page cleanup', {
                error: err.message,
                stack: err.stack
            });
            console.error('Error during page cleanup:', err);
        }
        window.cleanupPage = null;
    }
    
    //Remove previous script
    if(currentPageScript){
        currentPageScript.remove();
        currentPageScript = null;
        debugLog('CLEANUP', 'Previous script removed');
    }
}

//Main Page loader
async function loadPage(pageName){
    debugLog('LOAD_PAGE', `=== LOADING PAGE: ${pageName} ===`);
    const page = pages[pageName];
    
    //Checks if page exists
    if(!page){
        debugLog('LOAD_PAGE', `ERROR: Page '${pageName}' not found in configuration`);
        console.error(`Page '${pageName}' not found in configuration`);
        // Fallback to default page
        if(pageName !== DEFAULT_PAGE){
            loadPage(DEFAULT_PAGE);
        }
        return;
    }
    
    //Checks authentication
    if(pageName !== 'auth' && !checkAuth()){
        debugLog('LOAD_PAGE', 'Not authenticated, redirecting to auth page');
        loadPage('auth');
        return;
    }
    
    const appContent = document.getElementById('app-content');
    
    if(!appContent){
        debugLog('LOAD_PAGE', 'ERROR: Element with id="app-content" not found');
        console.error('Element with id="app-content" not found');
        return;
    }
    
    //Prevent loading the same page twice
    if(currentPage === pageName){
        debugLog('LOAD_PAGE', `Page '${pageName}' is already loaded, skipping`);
        return;
    }
    
    try{
        //Clean up previous page
        cleanupPreviousPage();
        
        //Show loading state
        appContent.innerHTML = `
            <div style="display: flex; justify-content: center; align-items: center; min-height: 50vh;">
                <div style="text-align: center;">
                    <div style="font-size: 2rem;">🔄 Loading... </div>
                </div>
            </div>
        `;
        
        //Unload previous CSS
        unloadCSS();
        
        //Load CSS first for better visual experience
        if(page.css){
            debugLog('LOAD_PAGE', 'Loading page CSS', page.css);
            loadCSS(page.css);
        }
        await new Promise(resolve => setTimeout(resolve, 50));
        
        //Load HTML content
        if(page.html){
            debugLog('LOAD_PAGE', 'Loading page HTML', page.html);
            await injectHTML(page.html, appContent);
        }
        
        //After HTML is loaded, inject any components (navbar, footer) if needed
        if(!PAGES_WITHOUT_COMPONENTS.includes(pageName)){
            debugLog('LOAD_PAGE', 'Injecting page components');
            injectAll();
        } else {
            debugLog('LOAD_PAGE', 'Skipping components for this page');
        }
        
        //Load and execute page-specific JavaScript
        if(page.js){
            debugLog('LOAD_PAGE', 'Loading page JavaScript', page.js);
            await loadJS(page.js);
        }
        
        //Update current page & URL
        currentPage = pageName;

        if(window.location.hash !== `#${pageName}`){
            window.history.pushState({ page: pageName }, '', `#${pageName}`);
            debugLog('LOAD_PAGE', 'Updated URL hash', `#${pageName}`);
        }
        
        //Scroll to top
        window.scrollTo(0, 0);
        
        debugLog('LOAD_PAGE', `✓ Page '${pageName}' loaded successfully`);
        
    }catch (err){
        debugLog('LOAD_PAGE', `EXCEPTION: Error loading page '${pageName}'`, {
            error: err.message,
            stack: err.stack
        });
        console.error(`Error loading page '${pageName}':`, err);
        appContent.innerHTML = `
            <div style="display: flex; justify-content: center; align-items: center; min-height: 50vh;">
                <div style="text-align: center; color: #e74c3c;">
                    <div>❌ Failed to load page</div>
                    <div style="margin-top: 10px; font-size: 14px;">Error: ${err.message}</div>
                    <button onclick="navigateTo('${DEFAULT_PAGE}')" 
                            style="margin-top: 1rem; padding: 0.5rem 1rem; cursor: pointer;">
                        Go to Home
                    </button>
                </div>
            </div>
        `;
    }
}

//Navigating the site
function navigateTo(pageName){
    debugLog('NAVIGATE', `Navigating to page: ${pageName}`);
    loadPage(pageName);
}

window.addEventListener('popstate', (event) => {
    debugLog('NAVIGATE', 'Popstate event triggered', event.state);
    if(event.state && event.state.page){
        loadPage(event.state.page);
    }else{
        const hash = window.location.hash.substring(1);
        const page = hash && pages[hash] ? hash : DEFAULT_PAGE;
        debugLog('NAVIGATE', 'Loading page from hash', page);
        loadPage(page);
    }
});

window.addEventListener('hashchange', () => {
    const hash = window.location.hash.substring(1);
    debugLog('NAVIGATE', 'Hashchange event', { hash, currentPage });
    if (hash && pages[hash] && currentPage !== hash) {
        loadPage(hash);
    }
});

//Initialization
function init(){
    debugLog('INIT', '=== INITIALIZING MEETEAMS ===');
    debugLog('INIT', 'Environment', {
        origin: window.location.origin,
        href: window.location.href,
        hash: window.location.hash,
        userAgent: navigator.userAgent
    });
    
    //Check authentication
    checkAuth();
    
    //Determine which page to load based on URL hash and auth status
    const hash = window.location.hash.substring(1);
    
    //If not authenticated, auth page 
    if(!isAuthenticated){
        debugLog('INIT', 'User not authenticated, loading auth page');
        loadPage('auth');
        return;
    }
    
    //If authenticated, check URL hash or go to default authenticated page
    const initialPage = hash && pages[hash] ? hash : 'landing';
    debugLog('INIT', 'User authenticated, loading page', initialPage);
    loadPage(initialPage);
}

if(document.readyState === 'loading'){
    debugLog('INIT', 'Document still loading, waiting for DOMContentLoaded');
    document.addEventListener('DOMContentLoaded', init);
}else{
    debugLog('INIT', 'Document ready, initializing immediately');
    init();
}

//Navigation
window.navigateTo = navigateTo;
window.getCurrentPage = () => currentPage;
window.pageExists = (pageName) => !!pages[pageName];

//Authentication
window.setAuthenticated = setAuthenticated;
window.logout = logout;
window.checkAuth = checkAuth;

//WebSocket
window.stompClient = stompClient;
window.connectWebSocket = connectWebSocket;
window.disconnectWebSocket = disconnectWebSocket;
window.isWebSocketConnected = isWebSocketConnected;
window.checkWebSocketStatus = function() {
    if (!stompClient) {
        debugLog('WEBSOCKET', 'WebSocket not initialized');
        return false;
    }
    if (stompClient.connected) {
        debugLog('WEBSOCKET', 'WebSocket connected');
        return true;
    } else {
        debugLog('WEBSOCKET', 'WebSocket disconnected');
        return false;
    }
};

//Subscriptions (will be set by room.js)
window.currentRoomSubscription = currentRoomSubscription;
window.reactionSubscription = reactionSubscription;

//User helper
window.getCurrentUser = function() {
    const user = sessionStorage.getItem('currentUser') || 
                 localStorage.getItem('rememberedUser') || 
                 'Anonymous';
    debugLog('USER', 'Getting current user', user);
    return user;
};

debugLog('INIT', '✓ MeeTeams app.js loaded');