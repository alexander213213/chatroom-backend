// WebSocket connection manager
(function() {
    const WS_BASE = window.location.origin + '/ws';
    let stompClient = null;
    let reconnectTimeout = null;
    
    function debugLog(section, message, data = null) {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [WS-${section}] ${message}`, data || '');
    }
    
    function connectWebSocket() {
        debugLog('CONNECT', 'Attempting to connect to WebSocket');
        
        if (stompClient && stompClient.connected) {
            debugLog('CONNECT', 'Already connected');
            return Promise.resolve(stompClient);
        }
        
        if (typeof SockJS === 'undefined' || typeof Stomp === 'undefined') {
            debugLog('CONNECT', 'ERROR: SockJS or Stomp not loaded');
            return Promise.reject(new Error('WebSocket libraries not loaded'));
        }
        
        return new Promise((resolve, reject) => {
            try {
                const socket = new SockJS(WS_BASE);
                stompClient = Stomp.over(socket);
                stompClient.debug = null;
                
                stompClient.connect({}, 
                    () => {
                        debugLog('CONNECT', '✓ Connected successfully');
                        window.stompClient = stompClient;
                        resolve(stompClient);
                    },
                    (error) => {
                        debugLog('CONNECT', 'ERROR: Connection failed', error);
                        reject(error);
                        
                        // Auto-reconnect after 3 seconds
                        reconnectTimeout = setTimeout(() => {
                            debugLog('CONNECT', 'Attempting reconnect...');
                            connectWebSocket();
                        }, 3000);
                    }
                );
            } catch (err) {
                debugLog('CONNECT', 'EXCEPTION', err);
                reject(err);
            }
        });
    }
    
    function disconnectWebSocket() {
        debugLog('DISCONNECT', 'Disconnecting WebSocket');
        
        if (reconnectTimeout) {
            clearTimeout(reconnectTimeout);
            reconnectTimeout = null;
        }
        
        if (stompClient && stompClient.connected) {
            stompClient.disconnect(() => {
                debugLog('DISCONNECT', '✓ Disconnected');
            });
            stompClient = null;
            window.stompClient = null;
        }
    }
    
    function isWebSocketConnected() {
        return stompClient && stompClient.connected;
    }
    
    function getStompClient() {
        return stompClient;
    }
    
    // Auto-connect on load for authenticated pages
    if (window.checkAuth && window.checkAuth()) {
        connectWebSocket().catch(err => {
            console.error('Failed to connect WebSocket:', err);
        });
    }
    
    // Export functions
    window.connectWebSocket = connectWebSocket;
    window.disconnectWebSocket = disconnectWebSocket;
    window.isWebSocketConnected = isWebSocketConnected;
    window.getStompClient = getStompClient;
    window.stompClient = stompClient;
})();