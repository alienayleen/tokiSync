/**
 * tokiSync v1.27.0 - Merge Store
 * 합본(소설 범위 합본 / 만화·소설 챕터 묶음) 수집 중간 결과를 회차 단위로 영속 보관하는 저장소입니다.
 *
 * - 소설 본문(text): Tampermonkey GM 스토리지에 보관합니다. 스크립트 전역 저장소이므로 미러 도메인이 바뀌어도 유지됩니다.
 * - 만화 CBZ 등 바이너리(blob): 해당 사이트 origin의 IndexedDB에 보관합니다. (GM 스토리지는 대용량 바이너리에 부적합)
 *   origin이 바뀌면 조회되지 않으므로, 이어받기 시 누락 회차는 다시 수집 대상으로 되돌립니다.
 * - 두 저장소를 모두 쓸 수 없는 환경(Node 테스트 등)에서는 메모리 Map으로 대체합니다.
 */

const TEXT_PREFIX = 'TOKI_MERGE_TXT_';
const DB_NAME = 'tokisync_merge';
const DB_STORE = 'episodes';

const memoryStore = new Map();
let dbPromise = null;

const hasGM = () => typeof GM_getValue !== 'undefined' && typeof GM_setValue !== 'undefined';

function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve) => {
        try {
            if (typeof indexedDB === 'undefined' || !indexedDB || typeof indexedDB.open !== 'function') {
                resolve(null);
                return;
            }
            const req = indexedDB.open(DB_NAME, 1);
            req.onupgradeneeded = () => {
                const db = req.result;
                if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE);
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => {
                console.warn('[MergeStore] IndexedDB open 실패, 메모리 저장소로 대체합니다:', req.error);
                resolve(null);
            };
        } catch (e) {
            console.warn('[MergeStore] IndexedDB 사용 불가, 메모리 저장소로 대체합니다:', e);
            resolve(null);
        }
    });
    return dbPromise;
}

function idbRequest(db, mode, fn) {
    return new Promise((resolve, reject) => {
        try {
            const tx = db.transaction(DB_STORE, mode);
            const store = tx.objectStore(DB_STORE);
            const req = fn(store);
            tx.oncomplete = () => resolve(req ? req.result : undefined);
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error);
        } catch (e) {
            reject(e);
        }
    });
}

export const makeMergeKey = (sessionId, itemId) => `${sessionId}__${itemId}`;

/**
 * 회차 결과 저장
 * @param {string} key makeMergeKey 결과
 * @param {{kind:'text', text:string, title?:string, num?:string} | {kind:'blob', blob:Blob, filename:string, title?:string, num?:string}} record
 */
export async function saveEpisodeData(key, record) {
    if (record.kind === 'text') {
        if (hasGM()) {
            GM_setValue(TEXT_PREFIX + key, { kind: 'text', text: record.text, title: record.title || '', num: record.num || '' });
        } else {
            memoryStore.set(key, record);
        }
        return true;
    }
    const db = await openDb();
    if (db) {
        await idbRequest(db, 'readwrite', (store) => store.put(record, key));
    } else {
        memoryStore.set(key, record);
    }
    return true;
}

/**
 * 회차 결과 조회 (없으면 null)
 */
export async function loadEpisodeData(key) {
    if (hasGM()) {
        const txt = GM_getValue(TEXT_PREFIX + key, null);
        if (txt && txt.kind === 'text') return txt;
    }
    if (memoryStore.has(key)) return memoryStore.get(key);
    const db = await openDb();
    if (!db) return null;
    try {
        const rec = await idbRequest(db, 'readonly', (store) => store.get(key));
        return rec || null;
    } catch (e) {
        console.warn('[MergeStore] 조회 실패:', key, e);
        return null;
    }
}

export async function hasEpisodeData(key) {
    const rec = await loadEpisodeData(key);
    return !!rec;
}

/**
 * 회차 결과 일괄 삭제
 */
export async function deleteEpisodeData(keys = []) {
    if (!keys.length) return;
    for (const key of keys) {
        memoryStore.delete(key);
        if (hasGM() && typeof GM_deleteValue !== 'undefined') {
            try { GM_deleteValue(TEXT_PREFIX + key); } catch (e) {}
        }
    }
    const db = await openDb();
    if (!db) return;
    try {
        await idbRequest(db, 'readwrite', (store) => {
            let last = null;
            keys.forEach(k => { last = store.delete(k); });
            return last;
        });
    } catch (e) {
        console.warn('[MergeStore] 삭제 실패:', e);
    }
}

/** 테스트 전용: 메모리 저장소 초기화 */
export function _resetMergeStoreForTest() {
    memoryStore.clear();
}
