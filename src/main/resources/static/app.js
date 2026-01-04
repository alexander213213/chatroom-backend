//Dynamic Loader

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
    const authToken = sessionStorage.getItem('authToken') || localStorage.getItem('authToken');
    isAuthenticated = !!authToken;
    return isAuthenticated;
}

//Successful log in or sign up
function setAuthenticated(token = 'authenticated') {
    sessionStorage.setItem('authToken', token);
    isAuthenticated = true;
    connectWebSocket();
    console.log('User authenticated');
}

//Log out
function logout(){
    disconnectWebSocket();
    sessionStorage.removeItem('authToken');
    localStorage.removeItem('authToken');
    sessionStorage.removeItem('currentUser');
    localStorage.removeItem('rememberedUser');
    isAuthenticated = false;
    console.log('User logged out');
    navigateTo('auth');
}

//Websocket management

//Connect to server
function connectWebSocket() {
    //Don't connect if already connected
    if(stompClient && stompClient.connected){
        console.log('WebSocket already connected');
        return;
    }
    //Check if SockJS and Stomp are loaded
    if(typeof SockJS === 'undefined' || typeof Stomp === 'undefined'){
        console.error('SockJS or Stomp library not loaded');
        return;
    }
    try{
        //Replace with your actual WebSocket endpoint
        const socket = new SockJS(CONFIG.WS_BASE);
        stompClient = Stomp.over(socket);
        
        //Disable debug logs in production
        stompClient.debug = null;

        stompClient.connect({}, 
            //Success callback
            () => {
                console.log('✓ WebSocket connected');
                //Update global reference
                window.stompClient = stompClient;
            }, 
            //Error callback
            (error) => {
                console.error('WebSocket connection error:', error);
            }
        );
    }catch (err){
        console.error('Failed to initialize WebSocket:', err);
    }
}

//Disconnect from server
function disconnectWebSocket(){
    // Unsubscribe from all topics
    if(currentRoomSubscription){
        currentRoomSubscription.unsubscribe();
        currentRoomSubscription = null;
    }
    if(reactionSubscription){
        reactionSubscription.unsubscribe();
        reactionSubscription = null;
    }
    //Disconnect the client
    if(stompClient && stompClient.connected){
        stompClient.disconnect(() => {
            console.log('✓ WebSocket disconnected');
        });
        stompClient = null;
        window.stompClient = null;
    }
}

//check if connected
function isWebSocketConnected(){
    return stompClient && stompClient.connected;
}

//Injection Functions

//HTML injection 
async function injectHTML(filePath, elem){
    try{
        const response = await fetch(filePath);
        if (!response.ok){
            console.error(`Failed to load ${filePath}: ${response.status}`);
            return;
        }
        const text = await response.text();
        elem.innerHTML = text;
        
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
    }catch (err){
        console.error(`Error injecting HTML: ${err.message}`);
    }
}

//Injects Navbar, Footer to pages needing it (anything with <div include =>)
function injectAll(){
    document.querySelectorAll("div[include]")
        .forEach((elem) => {
            injectHTML(elem.getAttribute("include"), elem);
        });
}

//Loads the CSS by changing the <link id="page.css"> of index.html to a specific file
function loadCSS(cssPath){
    const pageCssLink = document.getElementById('page-css');
    if(pageCssLink){
        pageCssLink.href = `${cssPath}?v=${Date.now()}`;
    }else{
        console.warn('page-css link element not found in HTML');
    }
}

//Unloads the CSS file
function unloadCSS(){
    const pageCssLink = document.getElementById('page-css');
    if(pageCssLink){
        pageCssLink.href = '';
    }
}

//Loads specific JavaScript files to the index.html and unloads old ones
function loadJS(jsPath){
    return new Promise((resolve, reject) => {
        //Remove previous page script if exists
        if(currentPageScript){
            currentPageScript.remove();
            currentPageScript = null;
        }
        
        const script = document.createElement('script');
        script.src = `${jsPath}?v=${Date.now()}`;
        script.onload = () => {
            console.log(`Loaded: ${jsPath}`);
            resolve();
        };
        script.onerror = () => {
            console.error(`Failed to load: ${jsPath}`);
            reject(new Error(`Failed to load script: ${jsPath}`));
        };
        
        document.body.appendChild(script);
        currentPageScript = script;
    });
}

//Clean 
function cleanupPreviousPage(){
    //Call cleanup function if page defined one
    if(window.cleanupPage && typeof window.cleanupPage === 'function'){
        try {
            window.cleanupPage();
        } catch (err) {
            console.error('Error during page cleanup:', err);
        }
        window.cleanupPage = null;
    }
    
    //Remove previous script
    if(currentPageScript){
        currentPageScript.remove();
        currentPageScript = null;
    }
}

//Main Page loader
async function loadPage(pageName){
    const page = pages[pageName];
    
    //Checks if page exists
    if(!page){
        console.error(`Page '${pageName}' not found in configuration`);
        // Fallback to default page
        if(pageName !== DEFAULT_PAGE){
            loadPage(DEFAULT_PAGE);
        }
        return;
    }
    
    //Checks authentication
    if(pageName !== 'auth' && !checkAuth()){
        console.log('Not authenticated redirect to auth page');
        loadPage('auth');
        return;
    }
    
    const appContent = document.getElementById('app-content');
    
    if(!appContent){
        console.error('Element with id="app-content" not found');
        return;
    }
    
    //Prevent loading the same page twice
    if(currentPage === pageName){
        console.log(`Page '${pageName}' is already loaded`);
        return;
    }
    
    try{
        //Clean up previous page
        cleanupPreviousPage();
        
        //Show loading state
        appContent.innerHTML = `
            <div style="display: flex; justify-content: center; align-items: center; min-height: 50vh;">
                <div style="text-align: center;">
                    <div style="font-size: 2rem;"> Loading... </div>
                </div>
            </div>
        `;
        
        //Unload previous CSS
        unloadCSS();
        
        //Load CSS first for better visual experience
        if(page.css){
            loadCSS(page.css);
        }
        await new Promise(resolve => setTimeout(resolve, 50));
        
        //Load HTML content
        if(page.html){
            await injectHTML(page.html, appContent);
        }
        
        //After HTML is loaded, inject any components (navbar, footer) if needed
        if(!PAGES_WITHOUT_COMPONENTS.includes(pageName)){
            injectAll();
        }
        
        //Load and execute page-specific JavaScript
        if(page.js){
            await loadJS(page.js);
        }
        
        //Update current page & URL
        currentPage = pageName;

        if(window.location.hash !== `#${pageName}`){
            window.history.pushState({ page: pageName }, '', `#${pageName}`);
        }
        
        //Scroll to top
        window.scrollTo(0, 0);
        
        console.log(`✓ Page '${pageName}' loaded successfully`);
        
    }catch (err){
        console.error(`Error loading page '${pageName}':`, err);
        appContent.innerHTML = `
            <div style="display: flex; justify-content: center; align-items: center; min-height: 50vh;">
                <div style="text-align: center; color: #e74c3c;">
                    <div>Failed to load page</div>
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
    loadPage(pageName);
}

window.addEventListener('popstate', (event) => {
    if(event.state && event.state.page){
        loadPage(event.state.page);
    }else{
        const hash = window.location.hash.substring(1);
        const page = hash && pages[hash] ? hash : DEFAULT_PAGE;
        loadPage(page);
    }
});

window.addEventListener('hashchange', () => {
    const hash = window.location.hash.substring(1);
    if (hash && pages[hash] && currentPage !== hash) {
        loadPage(hash);
    }
});

//Initialization
function init(){
    console.log('Initializing MeeTeams...');
    
    //Check authentication
    checkAuth();
    
    //Determine which page to load based on URL hash and auth status
    const hash = window.location.hash.substring(1);
    
    //If not authenticated, auth page 
    if(!isAuthenticated){
        loadPage('auth');
        return;
    }
    
    //If authenticated, check URL hash or go to default authenticated page
    const initialPage = hash && pages[hash] ? hash : 'landing';
    loadPage(initialPage);
    
    console.log('LogIn authenticated');
}

if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
}else{
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
        console.log('WebSocket not initialized');
        return false;
    }
    if (stompClient.connected) {
        console.log('WebSocket connected');
        return true;
    } else {
        console.log('WebSocket disconnected');
        return false;
    }
};

//Subscriptions (will be set by room.js)
window.currentRoomSubscription = currentRoomSubscription;
window.reactionSubscription = reactionSubscription;

//User helper
window.getCurrentUser = function() {
    return sessionStorage.getItem('currentUser') || 
           localStorage.getItem('rememberedUser') || 
           'Anonymous';
};