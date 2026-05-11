export class TxtBuilder {
    constructor() {
        this.content = "";
    }

    addChapter(title, textContent) {
        this.content += `\n\n=== ${title} ===\n\n`;
        this.content += textContent;
    }

    async build(metadata = {}) {
        try {
            // Return an object that duck-types JSZip's generateAsync
            return {
                generateAsync: async () => {
                    // Prepend metadata title at the top if available
                    let finalContent = this.content;
                    if (metadata.title) {
                        finalContent = `[ ${metadata.title} ]\n` + finalContent;
                    }
                    return new Blob([finalContent], { type: 'text/plain;charset=utf-8' });
                }
            };
        } catch (e) {
            const { LogBox } = await import('./ui.js');
            LogBox.getInstance().critical(`TXT 빌드 실패: ${e.message} (${metadata.title || 'unknown'})`, 'Builder:TXT');
            throw e;
        }
    }
}
