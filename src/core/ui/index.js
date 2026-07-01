/**
 * UI Modules Entry Point for TokiSync
 * Re-exports all UI components and defines UI helpers.
 */

import { LogBox } from './LogBox.js';

export { LogBox } from './LogBox.js';
export { Notifier } from './Notifier.js';
export { MenuModal } from './MenuModal.js';
export { FormRuleEditor } from './FormRuleEditor.js';

/**
 * 대기열 진행 모달을 강제로 노출시키는 팝업 헬퍼 함수
 */
export function showProgressModal() {
    const logBox = LogBox.getInstance();
    logBox.openDashboard();
    
    if (logBox.popupWindow) {
        const doc = logBox.popupWindow.document;
        const progressModal = doc.getElementById('toki-modal-progress');
        if (progressModal) {
            progressModal.style.display = 'flex';
        }
    }
}
