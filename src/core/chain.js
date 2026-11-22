/**
 * tokiSync v1.27.0 - Sequential Chain Download (순차 연속 받기)
 *
 * 1화(또는 지정한 화)를 열어 받은 뒤, 같은 수집 창에서 뷰어의 "다음화" 링크로 넘어가 다음 회차를 받는 과정을
 * 마지막 화까지 반복합니다. 목록 페이지의 페이지네이션 구조와 무관하게 전체 회차를 받을 수 있습니다.
 *
 * - 다음 회차는 수집 창(워커)이 현재 페이지에서 찾은 "다음화" 링크로 결정됩니다.
 * - 현재 회차가 끝나기 전에 다음 회차를 대기열에 먼저 등록하므로, 합본 세션이 중간에 완료로 오인되지 않습니다.
 * - 실패한 회차는 일반 재시도/이어받기로 다시 받으며, 성공하는 순간 연속 받기가 그 지점부터 이어집니다.
 */

import { getQueue, addEpisodesToQueue, updateQueueItem, getQueueItemId, getQueuePaused, WORKER_STAGE } from './queue.js';
import { getMergeSession, appendMergeItems } from './merge-session.js';
import { getPacingWait, getEpisodeGapMs } from './pacing.js';
import { logger } from './logger.js';
import { EventBus, EVT } from './EventBus.js';

const CHAINS_KEY = 'TOKI_CHAINS';
const MAX_CHAIN_LENGTH = 5000;

const readAll = () => {
    try {
        if (typeof GM_getValue !== 'undefined') return GM_getValue(CHAINS_KEY, {}) || {};
        if (typeof localStorage !== 'undefined') {
            const v = localStorage.getItem(CHAINS_KEY);
            return v ? JSON.parse(v) : {};
        }
    } catch (e) {}
    return {};
};
const writeAll = (all) => {
    try {
        if (typeof GM_setValue !== 'undefined') GM_setValue(CHAINS_KEY, all);
        else if (typeof localStorage !== 'undefined') localStorage.setItem(CHAINS_KEY, JSON.stringify(all));
    } catch (e) {}
    try { EventBus.emit(EVT.UPDATE_PROGRESS); } catch (e) {}
};

export const getChain = (id) => (id ? readAll()[id] || null : null);
export const getChains = () => Object.values(readAll());
const patchChain = (id, patch) => {
    const all = readAll();
    if (!all[id]) return null;
    all[id] = { ...all[id], ...(typeof patch === 'function' ? patch(all[id]) : patch), updatedAt: Date.now() };
    writeAll(all);
    return all[id];
};
export const removeChain = (id) => {
    const all = readAll();
    if (all[id]) {
        delete all[id];
        writeAll(all);
    }
};

/**
 * URL 비교용 정규화 (해시·끝 슬래시 제거, 디코딩)
 * [v1.27.0] 도메인을 바꿔 이어받아도 같은 회차로 인식하도록 경로+쿼리만 비교합니다.
 */
export const normalizeEpisodeUrl = (url, base) => {
    try {
        const u = new URL(url, base || (typeof location !== 'undefined' ? location.href : undefined));
        u.hash = '';
        let s = `${u.pathname.replace(/\/+$/, '')}${u.search}`;
        try { s = decodeURIComponent(s); } catch (e) {}
        return s;
    } catch (e) {
        return String(url || '');
    }
};

/**
 * 순차 연속 받기 체인 생성 + 첫 회차 대기열 등록
 * @returns {{ chain: object, firstItemId: string }}
 */
export const createChain = ({ seriesTitle, startUrl, startNum = 1, endNum = null, template = {}, mergeSessionId = '' }) => {
    const id = `chain_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    const startN = parseInt(startNum, 10) || 1;
    const firstNum = String(startN);
    const chain = {
        id,
        seriesTitle,
        startNum: startN,
        endNum: endNum ? parseInt(endNum, 10) : null,
        count: 1,
        seen: [normalizeEpisodeUrl(startUrl)],
        status: 'running',
        mergeSessionId,
        template,
        stopReason: '',
        createdAt: Date.now(),
        updatedAt: Date.now()
    };
    const all = readAll();
    all[id] = chain;
    writeAll(all);

    addEpisodesToQueue([{
        ...template,
        title: `${firstNum}화`,
        url: startUrl,
        episodeNum: firstNum,
        chainId: id,
        chainSeq: 1,
        mergeSessionId
    }], seriesTitle, { mergeSessionId });

    return { chain, firstItemId: getQueueItemId(seriesTitle, firstNum) };
};

const finishChain = (chainId, reason) => {
    const chain = patchChain(chainId, { status: 'done', stopReason: reason });
    if (chain) logger.success(`🏁 [연속 받기] ${chain.seriesTitle}: ${reason} (총 ${chain.count}화)`, 'Chain');
};

/**
 * 회차 수집 성공 시 다음 회차를 이어서 등록합니다.
 * @param {object} item 방금 성공한 큐 아이템 (chainId 보유)
 * @param {object} payload 워커 결과 (nextEpisodeUrl, pageEpisodeNum, pageEpisodeTitle)
 * @param {{ canReuseWindow?: boolean }} options
 * @returns {{ id: string, url: string, gapMs: number } | null} 같은 창에서 바로 이어 받을 다음 회차 (없으면 null)
 */
export const continueChain = (item, payload = {}, options = {}) => {
    const chain = getChain(item.chainId);
    if (!chain || chain.status !== 'running') return null;

    const nextRaw = payload.nextEpisodeUrl;
    if (!nextRaw) {
        finishChain(chain.id, '다음화 링크가 없어 마지막 화로 판단했습니다');
        return null;
    }
    const nextNorm = normalizeEpisodeUrl(nextRaw, item.episodeUrl);
    const seen = new Set(chain.seen || []);
    if (seen.has(nextNorm)) {
        // 실패 후 재시도로 다시 성공한 회차 등: 다음 회차가 이미 등록되어 있으면 그대로 둠.
        // 체인의 다른 회차가 하나도 진행 중이 아닐 때만 "되돌아가는 링크(반복)"로 보고 종료.
        const activeOthers = getQueue().some(q => q.chainId === chain.id && q.id !== item.id && (q.status === 'pending' || q.status === 'processing'));
        if (!activeOthers && !getQueue().some(q => q.chainId === chain.id && normalizeEpisodeUrl(q.episodeUrl) === nextNorm && q.status !== 'completed')) {
            const lastNorm = (chain.seen || [])[chain.seen.length - 1];
            if (lastNorm === normalizeEpisodeUrl(item.episodeUrl) || nextNorm !== lastNorm) {
                finishChain(chain.id, '이미 받은 회차로 되돌아가는 링크를 감지해 멈췄습니다');
            }
        }
        return null;
    }
    if (chain.count >= MAX_CHAIN_LENGTH) {
        finishChain(chain.id, `안전 한도(${MAX_CHAIN_LENGTH}화)에 도달했습니다`);
        return null;
    }

    const nextNum = chain.startNum + chain.count;
    if (chain.endNum && nextNum > chain.endNum) {
        finishChain(chain.id, `지정한 끝 회차(${chain.endNum}화)까지 받았습니다`);
        return null;
    }

    const nextSeq = chain.count + 1;
    const numStr = String(nextNum);
    const nextUrl = new URL(nextRaw, item.episodeUrl).href;
    const nextId = getQueueItemId(chain.seriesTitle, numStr);

    let nextOrigin = chain.template.protocolDomain;
    try { nextOrigin = new URL(nextUrl).origin; } catch (e) {}
    addEpisodesToQueue([{
        ...chain.template,
        protocolDomain: nextOrigin,
        title: `${numStr}화`,
        url: nextUrl,
        episodeNum: numStr,
        chainId: chain.id,
        chainSeq: nextSeq,
        mergeSessionId: chain.mergeSessionId
    }], chain.seriesTitle, { mergeSessionId: chain.mergeSessionId, ownerTabId: item.ownerTabId });

    if (chain.mergeSessionId && getMergeSession(chain.mergeSessionId)) {
        appendMergeItems(chain.mergeSessionId, [{ id: nextId, num: numStr, title: `${numStr}화`, url: nextUrl, seq: nextSeq }]);
    }

    patchChain(chain.id, (c) => ({ count: c.count + 1, seen: [...(c.seen || []), nextNorm], lastUrl: nextUrl }));

    // 같은 창에서 바로 이어 받기: 일시 정지·속도 조절 대기 중이면 창을 닫고 스케줄러가 나중에 새 창으로 이어감
    if (!options.canReuseWindow || getQueuePaused() || getPacingWait().waitMs > 0) return null;
    updateQueueItem(nextId, { status: 'processing', stage: WORKER_STAGE.INIT, startedAt: Date.now() });
    return { id: nextId, url: nextUrl, gapMs: getEpisodeGapMs() };
};

/**
 * 사용자 중단: 다음 회차를 더 이상 등록하지 않음
 */
export const stopChain = (chainId, reason = '사용자가 연속 받기를 중단했습니다') => {
    patchChain(chainId, { status: 'stopped', stopReason: reason });
};

/**
 * 이어받기: 중단/완료된 체인을 다시 진행 상태로 (마지막 회차가 다시 성공하면 다음화부터 이어짐)
 */
export const reopenChain = (chainId) => {
    if (!getChain(chainId)) return;
    patchChain(chainId, { status: 'running', stopReason: '' });
};
