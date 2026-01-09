// Auth check for protected pages
(function() {
    const publicPages = ['auth.html'];
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    
    function checkAuth() {
        const authToken = sessionStorage.getItem('authToken') || localStorage.getItem('authToken');
        return !!authToken;
    }
    
    function getCurrentUser() {
        return sessionStorage.getItem('currentUser') || 
               localStorage.getItem('rememberedUser') || 
               'Anonymous';
    }
    
    async function logout() {
        try {
            await fetch(`${window.location.origin}/auth/logout`, {
                method: 'POST',
                credentials: 'include'
            });
        } catch (err) {
            console.error('Logout error:', err);
        }
        
        sessionStorage.removeItem('authToken');
        localStorage.removeItem('authToken');
        sessionStorage.removeItem('currentUser');
        localStorage.removeItem('rememberedUser');
        sessionStorage.removeItem('currentRoomId');
        
        window.location.href = 'auth.html';
    }
    
    // Check if page requires authentication
    if (!publicPages.includes(currentPage)) {
        if (!checkAuth()) {
            window.location.href = 'auth.html';
        }
    } else {
        // If on auth page and already logged in, redirect to landing
        if (checkAuth()) {
            window.location.href = 'index.html';
        }
    }
    
    // Export functions globally
    window.checkAuth = checkAuth;
    window.getCurrentUser = getCurrentUser;
    window.logout = logout;
})();