/**
 * TreeRuleEditor Module for TokiSync
 * Specialist UI for managing parsing rules with a tree view JSON editor
 */

import { RuleManager } from '../parsers/RuleManager.js';
import { GenericParser } from '../parsers/GenericParser.js';
import { extractEpisodeData } from '../extractor.js';

export class TreeRuleEditor {
    constructor() {
        this.rules = RuleManager.getParserRules();
        this.overlay = null;
        this.hints = {
            'id': '사이트 고유 ID (영문/숫자)',
            'name': '표시용 이름',
            'urlPattern': '적용할 URL 정규표현식',
            'category': 'Webtoon / Manga / Novel',
            'meta': '작품 정보를 추출하는 규칙 그룹',
            'selector': 'CSS 셀렉터 (예: .title, #info)',
            'attr': '추출할 속성 (비워두면 텍스트)',
            'regex': '데이터 정제용 정규식 그룹',
            'list': '회차 목록을 추출하는 규칙 그룹',
            'container': '목록 전체를 감싸는 부모 요소',
            'item': '각 회차 줄 요소 (li 등)',
            'viewer': '본문 내용을 추출하는 규칙 그룹',
            'images': '웹툰 이미지 또는 소설 본문 요소',
            'exclude': '제외할 요소의 CSS 셀렉터 (반점 구분 또는 배열)'
        };
    }

    show(popupDoc = document) {
        const doc = popupDoc;
        this.overlay = doc.createElement('div');
        this.overlay.className = 'toki-modal-overlay';
        // z-index handled by .toki-tree-modal in ui.css
        
        this.overlay.innerHTML = `
            <div class="toki-modal toki-tree-modal">
                <div class="toki-modal-header">
                    <div class="toki-modal-title">🧩 파싱 규칙 관리자 (Tree Editor)</div>
                    <div class="toki-flex-row-8">
                        <button class="toki-btn-rule" id="tree-btn-export">📤 내보내기</button>
                        <button class="toki-btn-rule" id="tree-btn-import">📥 가져오기</button>
                        <button class="toki-modal-close" id="tree-close-btn">&times;</button>
                    </div>
                </div>
                <div class="toki-tree-container">
                    <div class="toki-tree-view" id="tree-root"></div>
                    
                    <div class="toki-tree-right-panel">
                        <div class="toki-flex-between toki-text-xs">
                            <span>📄 JSON 미리보기</span>
                            <span id="tree-json-status" class="toki-text-success">✓ Valid</span>
                        </div>
                        <textarea class="toki-tree-json-preview" id="tree-json-editor" spellcheck="false"></textarea>
                        
                        <div class="toki-test-bench toki-mt-0">
                            <div class="toki-label toki-mb-5">🧪 즉시 테스트</div>
                            <div class="toki-flex-row-8">
                                <input type="text" id="tree-test-url" class="toki-input-compact toki-flex-1" placeholder="주소 입력" value="${window.location.href}">
                                <button class="toki-btn-rule toki-text-success" id="tree-btn-test">실행</button>
                            </div>
                            <div id="tree-test-result" class="toki-test-result">규칙 수정 후 바로 테스트해보세요.</div>
                        </div>
                        
                        <div class="toki-flex-row-10">
                            <button class="toki-btn-action toki-btn-lavender" id="tree-btn-save">저장 및 적용</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        doc.body.appendChild(this.overlay);
        this.render(doc);
        this.bindEvents(doc);
    }

    render(popupDoc = document) {
        const doc = popupDoc;
        const root = this.overlay.querySelector('#tree-root');
        root.innerHTML = '';
        
        const mainNode = doc.createElement('div');
        mainNode.innerHTML = `<div class="toki-tree-item"><span class="toki-tree-key">Rules [Array]</span><button class="toki-tree-btn-small" id="tree-add-rule">➕ 룰 추가</button></div>`;
        root.appendChild(mainNode);

        const listNode = doc.createElement('div');
        listNode.className = 'toki-tree-node';
        this.rules.forEach((rule, idx) => {
            listNode.appendChild(this.renderNode(rule, `[${idx}]`, rule.name || rule.id || `Rule ${idx + 1}`));
        });
        root.appendChild(listNode);

        this.updateJsonPreview();
    }

    renderNode(data, path, label = '', doc = document) {
        const wrapper = doc.createElement('div');
        wrapper.className = 'toki-tree-node-wrapper';

        const item = doc.createElement('div');
        item.className = 'toki-tree-item';
        
        const isObject = data !== null && typeof data === 'object';
        const toggle = doc.createElement('span');
        toggle.className = 'toki-tree-toggle';
        toggle.textContent = isObject ? '▼' : '•';
        
        const keySpan = doc.createElement('span');
        keySpan.className = 'toki-tree-key';
        keySpan.textContent = label || path.split('.').pop();
        if (this.hints[keySpan.textContent]) {
            keySpan.title = this.hints[keySpan.textContent];
        }

        item.appendChild(toggle);
        item.appendChild(keySpan);

        if (!isObject) {
            const input = doc.createElement('input');
            input.className = 'toki-tree-val';
            input.value = data;
            input.dataset.path = path;
            input.oninput = (e) => this.updateValue(path, e.target.value);
            item.appendChild(input);
        } else {
            const actions = doc.createElement('div');
            actions.className = 'toki-tree-actions';
            
            const btnDel = doc.createElement('button');
            btnDel.className = 'toki-tree-btn-small';
            btnDel.textContent = '🗑️';
            btnDel.onclick = () => this.removeNode(path);
            actions.appendChild(btnDel);
            
            item.appendChild(actions);
        }

        wrapper.appendChild(item);

        if (isObject) {
            const children = doc.createElement('div');
            children.className = 'toki-tree-node';
            Object.keys(data).forEach(key => {
                children.appendChild(this.renderNode(data[key], `${path}.${key}`, key, doc));
            });
            wrapper.appendChild(children);

            // [v1.21.9] isHidden 변수가 미정의된 버그가 있었을 수 있으나 
            // 사이드이펙트 최소화를 위해 기존 로직과 동일하게 분리 처리합니다.
            toggle.onclick = () => {
                const isHidden = children.classList.toggle('toki-hidden');
                toggle.textContent = isHidden ? '▶' : '▼';
            };
        }

        return wrapper;
    }

    updateValue(path, val) {
        const parts = path.split('.');
        let current = this.rules;
        
        for (let i = 0; i < parts.length; i++) {
            let p = parts[i];
            if (p.startsWith('[') && p.endsWith(']')) {
                p = parseInt(p.substring(1, p.length - 1));
            }
            
            if (i === parts.length - 1) {
                current[p] = val;
            } else {
                current = current[p];
            }
        }
        this.updateJsonPreview();
    }

    removeNode(path) {
        if (!confirm(`노드(${path})를 삭제하시겠습니까?`)) return;
        
        const parts = path.split('.');
        if (parts.length === 1) { // Root rule
            const idx = parseInt(parts[0].substring(1, parts[0].length - 1));
            this.rules.splice(idx, 1);
        } else {
            let current = this.rules;
            for (let i = 0; i < parts.length - 1; i++) {
                let p = parts[i];
                if (p.startsWith('[') && p.endsWith(']')) p = parseInt(p.substring(1, p.length - 1));
                current = current[p];
            }
            const last = parts[parts.length - 1];
            delete current[last];
        }
        this.render();
    }

    updateJsonPreview() {
        const editor = this.overlay.querySelector('#tree-json-editor');
        editor.value = JSON.stringify(this.rules, null, 2);
    }

    bindEvents(popupDoc = document) {
        const overlay = this.overlay;
        
        overlay.querySelector('#tree-close-btn').onclick = () => overlay.remove();
        
        overlay.querySelector('#tree-add-rule').onclick = () => {
            this.rules.push({
                id: 'new_site_' + Date.now(),
                name: '새 사이트',
                urlPattern: '',
                category: 'Webtoon',
                meta: {
                    title: 'h1.title',
                    author: 'span.author',
                    thumb: { selector: 'div.thumb > img', attr: 'src' }
                },
                list: {
                    container: 'ul.list',
                    item: 'li.item',
                    num: 'span.no',
                    title: 'a.link',
                    link: { selector: 'a.link', attr: 'href' }
                },
                viewer: {
                    fetchMethod: 'iframe',
                    imageRegex: 'https?:\\\\/\\\\/[a-zA-Z0-9_\\\\.\\\\/-]+\\\\.(?:jpg|png|webp|gif)',
                    imageContainer: 'div.viewer',
                    imageItem: 'img',
                    lazyAttrOptions: ['data-src', 'src'],
                    exclude: ''
                }
            });
            this.render();
        };

        overlay.querySelector('#tree-json-editor').oninput = (e) => {
            const status = overlay.querySelector('#tree-json-status');
            try {
                const parsed = JSON.parse(e.target.value);
                if (Array.isArray(parsed)) {
                    this.rules = parsed;
                    status.textContent = '✓ Valid';
                    status.classList.add('toki-text-success');
                    status.classList.remove('toki-text-danger');
                    if (this.renderTimer) clearTimeout(this.renderTimer);
                    this.renderTimer = setTimeout(() => this.render(), 1000);
                }
            } catch (err) {
                status.textContent = '⚠ Invalid JSON';
                status.classList.add('toki-text-danger');
                status.classList.remove('toki-text-success');
            }
        };

        overlay.querySelector('#tree-btn-save').onclick = () => {
            RuleManager.saveParserRules(this.rules);
            alert('파싱 규칙이 성공적으로 저장되었습니다.');
            overlay.remove();
        };

        overlay.querySelector('#tree-btn-export').onclick = () => {
            const blob = new Blob([JSON.stringify(this.rules, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `tokisync_rules_${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
        };

        overlay.querySelector('#tree-btn-import').onclick = () => {
            const handleRulesImport = (rules) => {
                const rulesArr = Array.isArray(rules) ? rules : (rules.rules || []);
                if (!Array.isArray(rulesArr) || rulesArr.length === 0) {
                    alert('가져올 규칙이 유효하지 않거나 비어 있습니다.');
                    return;
                }
                const mode = confirm('기존 규칙과 합치시겠습니까? (취소 시 전체 덮어쓰기)') ? 'merge' : 'overwrite';
                if (mode === 'overwrite') {
                    this.rules = rulesArr;
                    RuleManager.saveParserRules(rulesArr);
                } else {
                    RuleManager.bulkImport(rulesArr, 'merge');
                    this.rules = RuleManager.getParserRules();
                }
                this.render();
            };

            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            input.onchange = (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => {
                    try {
                        const imported = JSON.parse(ev.target.result);
                        handleRulesImport(imported);
                    } catch (err) {
                        alert('JSON 파싱 오류: ' + err.message);
                    }
                };
                reader.readAsText(file);
            };
            input.click();
        };

        overlay.querySelector('#tree-btn-test').onclick = async () => {
            const res = overlay.querySelector('#tree-test-result');
            res.textContent = '⏳ 파싱 테스트 중...';
            try {
                const url = overlay.querySelector('#tree-test-url').value;
                const domain = new URL(url).origin;
                const rule = this.rules.find(r => new RegExp(r.urlPattern, 'i').test(url));
                if (!rule) throw new Error('해당 URL에 맞는 규칙이 트리 내에 없습니다.');

                const parser = new GenericParser(domain, rule);
                const result = await extractEpisodeData(document, parser, { site: 'test', category: rule.category }, false);
                
                res.innerHTML = `
                    <div class="toki-text-success">성공!</div>
                    <div>• 제목: ${result.title || 'N/A'}</div>
                    <div>• 항목 수: ${result.urls?.length || (result.content ? '1 (Text)' : '0')}</div>
                `;
            } catch (e) {
                res.textContent = '❌ 실패: ' + e.message;
            }
        };
    }
}
