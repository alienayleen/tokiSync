let state = {
    siteInfo: null, // { site, workId, detectedCategory, fullTitle, ... }
    gmContext: null,
    workerMode: 'idle', // idle, shared, dedicated
};

export const getState = () => state;

export const setState = (newState) => {
    state = { ...state, ...newState };
};

// Shortcuts
export const getSiteInfo = () => state.siteInfo;
export const getGM = () => state.gmContext;
