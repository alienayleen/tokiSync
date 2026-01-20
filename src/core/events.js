class EventBus {
    constructor() {
        this.listeners = {};
    }

    on(event, fn) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(fn);
    }

    off(event, fn) {
        if (!this.listeners[event]) return;
        this.listeners[event] = this.listeners[event].filter(l => l !== fn);
    }

    emit(event, data) {
        if (!this.listeners[event]) return;
        this.listeners[event].forEach(fn => {
            try {
                fn(data);
            } catch (e) {
                console.error(`[EventBus] Error in listener for ${event}:`, e);
            }
        });
    }
}

export const bus = new EventBus();

// Core Events
export const EVENTS = {
    // Commands (Request Action)
    CMD_ENQUEUE_TASK: 'CMD_ENQUEUE_TASK',
    CMD_START_BATCH: 'CMD_START_BATCH',
    
    // Status Updates (Notification)
    UI_UPDATE_STATUS: 'UI_UPDATE_STATUS',
    TASK_COMPLETE: 'TASK_COMPLETE', // Replaces custom window event
};
