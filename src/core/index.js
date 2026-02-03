
import { main } from './main.js';
import { getConfig } from './config.js';

(function () {
    'use strict';
    
    // Viewer Config Injection (Zero-Config)
    if (location.hostname.includes('github.io') || location.hostname.includes('localhost') || location.hostname.includes('127.0.0.1')) {
        console.log("📂 TokiView (Frontend) detected. Injecting Config...");
        
        const config = getConfig();
        
        if (config.gasUrl && config.folderId) {
            setTimeout(() => {
                window.postMessage({ 
                    type: 'TOKI_CONFIG', 
                    url: config.gasUrl,
                    folderId: config.folderId,
                    apiKey: config.apiKey  // ✅ API Key 추가
                }, '*');
                console.log("✅ Config Injected to Frontend:", { 
                    gasUrl: config.gasUrl, 
                    folderId: config.folderId,
                    apiKey: config.apiKey ? '***' : '(empty)'
                });
            }, 500);
        } else {
            console.warn("⚠️ GAS URL or Folder ID missing. Please configure via menu.");
        }
        
        // API Proxy (CORS Bypass using GM_xmlhttpRequest)
        window.addEventListener('message', (event) => {
            // Security: Only accept from same origin
            if (event.source !== window) return;
            
            const msg = event.data;
            if (msg.type === 'TOKI_API_REQUEST') {
                console.log('[Proxy] Received API request:', msg.payload);
                
                GM_xmlhttpRequest({
                    method: 'POST',
                    url: config.gasUrl,
                    data: JSON.stringify(msg.payload),
                    headers: { 'Content-Type': 'text/plain' },
                    onload: (response) => {
                        try {
                            const result = JSON.parse(response.responseText);
                            window.postMessage({
                                type: 'TOKI_API_RESPONSE',
                                requestId: msg.requestId,
                                result: result
                            }, '*');
                        } catch (e) {
                            window.postMessage({
                                type: 'TOKI_API_RESPONSE',
                                requestId: msg.requestId,
                                error: 'Parse error: ' + e.message
                            }, '*');
                        }
                    },
                    onerror: () => {
                        window.postMessage({
                            type: 'TOKI_API_RESPONSE',
                            requestId: msg.requestId,
                            error: 'Network error'
                        }, '*');
                    }
                });
            }
        });
        
        console.log("✅ API Proxy initialized (CORS bypass)");
    }
    
    main();
})();