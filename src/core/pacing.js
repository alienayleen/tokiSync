/**
 * tokiSync v1.27.0 - Adaptive Pacing (자동 속도 조절)
 *
 * 목표: 평소에는 사람보다 빠르게 받되, 사이트가 제한 신호를 보내면 즉시 물러서서 차단이 길어지지 않게 합니다.
 *
 * - 속도 단계(level 0~4): 연속 성공 시 한 단계씩 빨라지고(additive), 차단 신호 시 두 단계씩 느려집니다(multiplicative 성격).
 * - 차단 신호(403/429/캡차/빈 결과): 대기열 전체에 쿨다운(1분 → 3분 → 10분 → 15분)을 걸어 새 회차 기동을 멈춥니다.
 * - 일반 실패 재시도: 30초 → 2분 → 5분 간격으로 늦춰서 다시 시도합니다(그동안 다른 회차를 먼저 진행).
 * - 장기 휴식: 연속 30회차마다 1~2분 쉽니다.
 *
 * 상태는 GM 스토리지(스크립트 전역)에 두어 부모 탭과 수집 팝업(워커)이 함께 읽고 씁니다.
 */

import { getConfig, SLEEP_MULTIPLIERS } from './config.js';

const STATE_KEY = 'TOKI_PACING_STATE';

export const PACING_LEVELS = [
    { name: '빠름', gap: [1500, 3000], imageConcurrency: 5 },
    { name: '보통', gap: [2500, 4500], imageConcurrency: 4 },
    { name: '신중', gap: [5000, 9000], imageConcurrency: 3 },
    { name: '느림', gap: [10000, 16000], imageConcurrency: 2 },
    { name: '매우 느림', gap: [20000, 30000], imageConcurrency: 1 },
];
export const MAX_LEVEL = PACING_LEVELS.length - 1;
const DEFAULT_LEVEL = 1;

const SPEEDUP_STREAK = 8;                      // 이만큼 연속 성공하면 한 단계 빨라짐
const COOLDOWN_STEPS_MS = [60000, 180000, 600000, 900000];
const BACKOFF_DECAY_MS = 15 * 60 * 1000;       // 15분간 신호가 없으면 쿨다운 단계 초기화
export const RETRY_BACKOFF_MS = [30000, 120000, 300000];
const LONG_REST_EVERY = 30;
const LONG_REST_MS = [60000, 120000];

const now = () => Date.now();
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const defaultState = () => ({
    level: DEFAULT_LEVEL,
    okStreak: 0,
    softFailStreak: 0,
    backoffCount: 0,
    cooldownUntil: 0,
    cooldownReason: '',
    lastSignalAt: 0,
    sinceRest: 0,
    restUntil: 0
});

export const getPacingState = () => {
    try {
        let raw = null;
        if (typeof GM_getValue !== 'undefined') raw = GM_getValue(STATE_KEY, null);
        else if (typeof localStorage !== 'undefined') {
            const v = localStorage.getItem(STATE_KEY);
            raw = v ? JSON.parse(v) : null;
        }
        return { ...defaultState(), ...(raw || {}) };
    } catch (e) {
        return defaultState();
    }
};

const saveState = (state) => {
    try {
        if (typeof GM_setValue !== 'undefined') GM_setValue(STATE_KEY, state);
        else if (typeof localStorage !== 'undefined') localStorage.setItem(STATE_KEY, JSON.stringify(state));
    } catch (e) {}
    return state;
};

const update = (fn) => saveState(fn(getPacingState()));

/**
 * 회차 수집 성공 보고
 */
export const reportPacingSuccess = () => update(s => {
    const okStreak = s.okStreak + 1;
    let level = s.level;
    let streak = okStreak;
    if (okStreak >= SPEEDUP_STREAK && level > 0) {
        level -= 1;
        streak = 0;
    }
    const decayed = s.lastSignalAt && (now() - s.lastSignalAt) > BACKOFF_DECAY_MS;
    const sinceRest = s.sinceRest + 1;
    const needRest = sinceRest >= LONG_REST_EVERY;
    return {
        ...s,
        level,
        okStreak: streak,
        softFailStreak: 0,
        backoffCount: decayed ? 0 : s.backoffCount,
        sinceRest: needRest ? 0 : sinceRest,
        restUntil: needRest ? now() + rand(LONG_REST_MS[0], LONG_REST_MS[1]) : s.restUntil
    };
});

/**
 * 사이트 제한 신호 보고 (403/429/캡차/빈 결과 등)
 * @param {string} reason 사용자에게 보여줄 사유
 * @param {{ retryAfterMs?: number }} options 서버가 Retry-After를 준 경우 우선 반영
 */
export const reportBlockSignal = (reason = '사이트 제한 신호', options = {}) => update(s => {
    const decayed = s.lastSignalAt && (now() - s.lastSignalAt) > BACKOFF_DECAY_MS;
    const backoffCount = (decayed ? 0 : s.backoffCount) + 1;
    // 이미 쿨다운 중에 같은 쿨다운을 일으킨 요청들의 신호가 몰려오면 한 번만 반영
    if (s.cooldownUntil > now() && (now() - s.lastSignalAt) < 10000) {
        return { ...s, lastSignalAt: now() };
    }
    const stepMs = COOLDOWN_STEPS_MS[Math.min(backoffCount - 1, COOLDOWN_STEPS_MS.length - 1)];
    const cooldownMs = Math.max(stepMs, options.retryAfterMs || 0);
    return {
        ...s,
        level: Math.min(MAX_LEVEL, s.level + 2),
        okStreak: 0,
        backoffCount,
        lastSignalAt: now(),
        cooldownUntil: now() + cooldownMs,
        cooldownReason: reason
    };
});

/**
 * 일반 실패 보고 (타임아웃·추출 실패 등). 2회 연속이면 한 단계 느려집니다.
 */
export const reportSoftFailure = () => update(s => {
    const softFailStreak = s.softFailStreak + 1;
    const slowDown = softFailStreak >= 2;
    return {
        ...s,
        okStreak: 0,
        softFailStreak: slowDown ? 0 : softFailStreak,
        level: slowDown ? Math.min(MAX_LEVEL, s.level + 1) : s.level
    };
});

/** 사용자가 "지금 재개"를 누른 경우: 쿨다운·휴식만 해제 (속도 단계는 유지) */
export const clearPacingCooldown = () => update(s => ({ ...s, cooldownUntil: 0, restUntil: 0, cooldownReason: '' }));

/** 테스트/초기화용 */
export const resetPacing = () => saveState(defaultState());

/**
 * 새 회차 기동까지 남은 대기 시간 (쿨다운 또는 장기 휴식)
 * @returns {{ waitMs: number, kind: 'cooldown'|'rest'|null, reason: string }}
 */
export const getPacingWait = () => {
    const s = getPacingState();
    const t = now();
    if (s.cooldownUntil > t) return { waitMs: s.cooldownUntil - t, kind: 'cooldown', reason: s.cooldownReason };
    if (s.restUntil > t) return { waitMs: s.restUntil - t, kind: 'rest', reason: `연속 ${LONG_REST_EVERY}회차 수집 후 잠시 휴식` };
    return { waitMs: 0, kind: null, reason: '' };
};

/** 회차 사이 대기 시간 (현재 속도 단계 × 설정의 대기 속도 배율: 신중 1.0 / 철저 1.5 / 느림 2.2 / 매우 느림 3.0) */
export const getEpisodeGapMs = () => {
    const lv = PACING_LEVELS[getPacingState().level] || PACING_LEVELS[DEFAULT_LEVEL];
    let mult = 1;
    try { mult = SLEEP_MULTIPLIERS[getConfig().sleepMode] || 1; } catch (e) {}
    return Math.round(rand(lv.gap[0], lv.gap[1]) * mult);
};

/** 회차 내부 이미지 동시 다운로드 수 */
export const getImageConcurrency = () => {
    const lv = PACING_LEVELS[getPacingState().level] || PACING_LEVELS[DEFAULT_LEVEL];
    return lv.imageConcurrency;
};

/** 동시 수집 창 수: 느린 단계(신중 이상)에서는 설정값과 무관하게 1개로 제한 */
export const getEffectiveMaxWorkers = (configured) => {
    const n = Math.max(1, parseInt(configured, 10) || 1);
    return getPacingState().level >= 2 ? 1 : n;
};

/**
 * 재시도 백오프 시각 계산
 * @param {number} retryCount 1부터 시작
 */
export const getRetryAt = (retryCount) => {
    const idx = Math.min(Math.max(1, retryCount) - 1, RETRY_BACKOFF_MS.length - 1);
    return now() + RETRY_BACKOFF_MS[idx];
};

/**
 * HTTP 상태/오류 메시지가 사이트 제한 신호인지 판별
 */
export const isBlockStatus = (status) => status === 403 || status === 429 || status === 503;

/** 대시보드 표시용 요약 */
export const getPacingSummary = () => {
    const s = getPacingState();
    const wait = getPacingWait();
    return {
        level: s.level,
        levelName: (PACING_LEVELS[s.level] || PACING_LEVELS[DEFAULT_LEVEL]).name,
        maxLevel: MAX_LEVEL,
        waitMs: wait.waitMs,
        waitKind: wait.kind,
        waitReason: wait.reason
    };
};
