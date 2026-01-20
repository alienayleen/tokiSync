export function sleep(ms) {
    return new Promise(resolve => {
        setTimeout(() => resolve(), ms);
    });
}

export function waitIframeLoad(iframe, url) {
    return new Promise((resolve) => {
        const handler = () => {
            iframe.removeEventListener('load', handler);
            resolve();
        };
        iframe.addEventListener('load', handler);
        iframe.src = url;
    });
}
