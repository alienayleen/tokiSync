/**
 * Anti-Sleep Module
 * Prevents browser tab throttling by playing silent audio
 */

import { EventBus, EVT } from './EventBus.js';

let audioContext = null;
let audioEl = null;
let oscillator = null;

// [v1.27.0] 실제 재생 상태 추적: 'off' | 'starting' | 'running' | 'blocked'
let antiSleepState = 'off';
let gestureRetryBound = false;

function setState(next) {
    if (antiSleepState === next) return;
    antiSleepState = next;
    try { EventBus.emit(EVT.UPDATE_PROGRESS); } catch (e) {}
}

/**
 * 현재 Anti-Sleep(무음 오디오) 상태 조회
 * @returns {'off'|'starting'|'running'|'blocked'}
 */
export function getAntiSleepState() {
    return antiSleepState;
}

/**
 * 자동재생이 차단된 경우, 사용자의 다음 클릭/키 입력 시 1회 재시도하도록 리스너를 등록합니다.
 */
function bindGestureRetry() {
    if (gestureRetryBound || typeof document === 'undefined' || typeof document.addEventListener !== 'function') return;
    gestureRetryBound = true;
    const retry = () => {
        document.removeEventListener('pointerdown', retry, true);
        document.removeEventListener('keydown', retry, true);
        gestureRetryBound = false;
        if (antiSleepState === 'blocked') {
            startSilentAudio();
        }
    };
    document.addEventListener('pointerdown', retry, true);
    document.addEventListener('keydown', retry, true);
}

/**
 * 무음 오디오를 재생하여 탭 백그라운드 스로틀링을 완화합니다.
 * - 비동기 재생 실패(자동재생 차단)도 예외를 던지지 않고 false로 resolve 합니다.
 *   (기존 구현은 .catch 안에서 다시 throw하여 호출부 try/catch가 잡지 못하고 거짓 성공 로그가 출력되었습니다)
 * @returns {Promise<boolean>} 실제 재생 성공 여부
 */
export function startSilentAudio() {
    if (audioContext && audioContext.state === 'running' && antiSleepState === 'running') {
        return Promise.resolve(true);
    }
    if (typeof window === 'undefined' || typeof document === 'undefined') {
        return Promise.resolve(false);
    }

    try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) {
            setState('blocked');
            return Promise.resolve(false);
        }
        setState('starting');
        if (!audioContext) {
            audioContext = new Ctx();
        }
        const resumePromise = (audioContext.state === 'suspended' && typeof audioContext.resume === 'function')
            ? audioContext.resume().catch(() => {})
            : Promise.resolve();

        const dest = audioContext.createMediaStreamDestination();
        const gain = audioContext.createGain();

        if (oscillator) {
            try { oscillator.stop(); oscillator.disconnect(); } catch (e) {}
        }
        oscillator = audioContext.createOscillator();
        oscillator.frequency.value = 1; // 1Hz (Inaudible)
        oscillator.type = 'sine';
        gain.gain.value = 0.001; // Near silence

        oscillator.connect(gain);
        gain.connect(dest);
        oscillator.start();

        if (!audioEl) {
            audioEl = document.createElement('audio');
            audioEl.classList.add('toki-hidden');
            (document.body || document.documentElement).appendChild(audioEl);
        }
        audioEl.srcObject = dest.stream;

        return resumePromise
            .then(() => audioEl.play())
            .then(() => {
                const ok = !!audioContext && audioContext.state === 'running';
                setState(ok ? 'running' : 'blocked');
                if (ok) {
                    console.log('🔊 [Anti-Sleep] Audio started successfully');
                } else {
                    console.warn('🚫 [Anti-Sleep] AudioContext가 running 상태가 아닙니다 (사용자 상호작용 필요)');
                    bindGestureRetry();
                }
                return ok;
            })
            .catch(e => {
                console.warn('🚫 [Anti-Sleep] Autoplay blocked:', e);
                setState('blocked');
                bindGestureRetry();
                return false;
            });
    } catch (e) {
        console.error('[Anti-Sleep] Failed to start:', e);
        setState('blocked');
        bindGestureRetry();
        return Promise.resolve(false);
    }
}

export function stopSilentAudio() {
    try {
        if (oscillator) {
            oscillator.stop();
            oscillator.disconnect();
            oscillator = null;
        }
        
        if (audioEl) {
            audioEl.pause();
            audioEl.srcObject = null;
        }
        
        setState('off');
        if (audioContext) {
            const ctx = audioContext;
            audioContext = null;
            ctx.close().then(() => {
                console.log('🔇 [Anti-Sleep] Audio stopped');
            }).catch(e => {
                console.warn('[Anti-Sleep] close error:', e);
            });
        }
    } catch (e) {
        console.error('[Anti-Sleep] Failed to stop:', e);
    }
}

export function isAudioRunning() {
    return audioContext && audioContext.state === 'running';
}
