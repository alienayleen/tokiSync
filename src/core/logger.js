import { getConfig } from './config.js';
import { bus, EVENTS } from './events.js';

export function log(msg, type = 'info') {
    const config = getConfig();
    if (config.debug || type === 'error') {
        console.log(`[TokiSync][${type.toUpperCase()}] ${msg}`);
    }
}

export function updateStatus(msg) {
    // [Changed] Emit event instead of direct DOM manipulation
    bus.emit(EVENTS.UI_UPDATE_STATUS, msg);
    
    // Check for "Resume Button" trigger logic inside msg?
    // The previous logic for resume button was inside downloader's UI manipulation or logger?
    // Actually the resume button check was inside tokiDownloaderSingle's pause logic, 
    // but ui.js's renderStatus creates the button hidden.
    
    // Strip HTML tags for console log
    log(msg.replace(/<[^>]*>/g, ''));
}

export function setListItemStatus(li, message, bgColor = '#fff9c4', textColor = '#d32f2f') {
    if (!li) return;
    if (!li.classList.contains('toki-downloaded')) li.style.backgroundColor = bgColor;
    const link = li.querySelector('a');
    if (!link) return;
    let s = link.querySelector('.toki-status-msg');
    if (!s) {
        s = document.createElement('span');
        s.className = 'toki-status-msg';
        s.style.fontSize = '12px'; s.style.fontWeight = 'bold'; s.style.marginLeft = '10px';
        link.appendChild(s);
    }
    s.innerText = message; s.style.color = textColor;
}
