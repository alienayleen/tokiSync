/**
 * Notifier Module for TokiSync
 * Handles OS-level notifications using Tampermonkey GM_notification API
 */

export class Notifier {
    static notify(title, text, onclick = null) {
        if (typeof GM_notification === 'function') {
            GM_notification({
                title: title,
                text: text,
                timeout: 5000,
                onclick: onclick
            });
        } else {
            console.log(`[Notification] ${title}: ${text}`);
        }
    }
}
