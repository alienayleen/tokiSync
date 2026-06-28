/**
 * DomInspector Module for TokiSync (Prototype v2)
 * Chrome DevTools-style DOM tree visualizer.
 * Click an element in the tree → highlights on real page + generates CSS selector.
 * No z-index / overlay issues — works entirely in a dedicated panel.
 */

export class DomInspector {
    constructor() {
        this.root = document.body;
        this.treeData = null;
        this.nodeMap = [];
        this.filterText = '';
        this.onApply = null;
        this.lastSelector = '';
        this.maxDepth = 12;
        this.selectedNode = null;
    }

    /**
     * Walk the DOM and build a simplified tree.
     */
    simplify(element, depth = 0) {
        if (depth > this.maxDepth) return null;

        if (element.nodeType === Node.TEXT_NODE) {
            const text = element.textContent.replace(/\s+/g, ' ').trim();
            if (!text || text.length < 2) return null;
            return { type: 'text', value: text };
        }

        if (element.nodeType !== Node.ELEMENT_NODE) return null;

        const tag = element.tagName.toLowerCase();
        const skip = ['script','style','link','meta','noscript','iframe','svg','path','br','hr','wbr'];
        if (skip.includes(tag)) return null;

        const rect = element.getBoundingClientRect();
        const noLayout = rect.width === 0 && rect.height === 0 && tag !== 'img' && tag !== 'input' && tag !== 'br';
        if (noLayout) return null;

        const node = {
            type: 'element',
            tag,
            id: element.id || null,
            classes: [],
            attrs: {},
            text: null,
            hidden: false,
            children: [],
            elementRef: element,
            matched: false
        };

        for (const c of element.classList) {
            if (!c.startsWith('toki-') && !c.startsWith('sc-')) {
                node.classes.push(c);
            }
        }

        const style = window.getComputedStyle(element);
        node.hidden = style.display === 'none' || style.visibility === 'hidden';

        const important = ['href','src','data-num','data-src','data-lazy','data-original','alt','title','value','type','name','data-id'];
        for (const a of important) {
            const v = element.getAttribute(a);
            if (v) node.attrs[a] = v.length > 80 ? v.substring(0, 80) + '…' : v;
        }

        const directText = element.childNodes.length === 1 && element.childNodes[0].nodeType === Node.TEXT_NODE;
        const noChildren = element.children.length === 0;
        if (directText || noChildren) {
            const t = element.textContent.replace(/\s+/g, ' ').trim();
            if (t) node.text = t.length > 80 ? t.substring(0, 80) + '…' : t;
        }

        for (const child of element.childNodes) {
            const s = this.simplify(child, depth + 1);
            if (s) node.children.push(s);
        }

        if (node.children.length === 1 && node.children[0].type === 'text' && !node.text) {
            node.text = node.children[0].value;
            node.children = [];
        }

        return node;
    }

    build() {
        this.nodeMap = [];
        this.treeData = this.simplify(this.root);
    }

    /**
     * Render the tree as DevTools-style HTML.
     */
    renderTree(node, depth = 0) {
        if (!node) return '';
        if (node.type === 'text') return '';

        const idx = this.nodeMap.length;
        this.nodeMap.push(node);
        node._idx = idx;

        const hasChildren = node.children.some(c => c.type === 'element');
        const expandByDefault = depth < 3;
        const arrow = hasChildren ? (expandByDefault ? '▼' : '▶') : '  ';

        const tagHtml = `<span class="di-tag">${node.tag}</span>`;
        const idHtml = node.id ? `<span class="di-id">#${node.id}</span>` : '';
        const clsHtml = node.classes.length > 0
            ? node.classes.map(c => `<span class="di-class">.${c}</span>`).join('')
            : '';
        const attrHtml = Object.entries(node.attrs).map(([k, v]) =>
            ` <span class="di-attr">${k}</span>="${v}"`
        ).join('');
        const textHtml = node.text
            ? ` <span class="di-text">"${node.text}"</span>`
            : '';
        const hiddenAttr = node.hidden ? ' di-dimmed' : '';

        let html = `<div class="di-line${hiddenAttr}" data-idx="${idx}" style="padding-left:${depth * 20}px">
            <span class="di-arrow">${arrow}</span>
            ${tagHtml}${idHtml}${clsHtml}${attrHtml}${textHtml}
        </div>`;

        if (hasChildren && expandByDefault) {
            const childrenHtml = node.children
                .filter(c => c.type === 'element')
                .map(c => this.renderTree(c, depth + 1))
                .join('');
            html += `<div class="di-children" data-parent="${idx}">${childrenHtml}</div>`;
        } else if (hasChildren) {
            const childrenHtml = node.children
                .filter(c => c.type === 'element')
                .map(c => this.renderTree(c, depth + 1))
                .join('');
            html += `<div class="di-children di-collapsed" data-parent="${idx}">${childrenHtml}</div>`;
        }

        return html;
    }

    filterNodes(node, text) {
        if (!node || node.type === 'text') return false;
        const lower = text.toLowerCase();
        let match = node.tag.includes(lower) ||
            node.classes.some(c => c.includes(lower)) ||
            (node.text && node.text.toLowerCase().includes(lower)) ||
            Object.values(node.attrs).some(v => v.toLowerCase().includes(lower));
        for (const child of node.children) {
            if (this.filterNodes(child, text)) match = true;
        }
        node.matched = match;
        return match;
    }

    renderTreeFiltered(node, depth = 0) {
        if (!node || node.type === 'text') return '';
        if (!node.matched) {
            for (const child of node.children) {
                if (child.type === 'element' && child.matched) {
                    return this.renderTreeFiltered(child, depth);
                }
            }
            return '';
        }

        const idx = this.nodeMap.length;
        this.nodeMap.push(node);
        node._idx = idx;

        const hasVisibleChildren = node.children.some(c => c.type === 'element' && c.matched);
        const arrow = hasVisibleChildren ? '▼' : '  ';

        const tagHtml = `<span class="di-tag">${node.tag}</span>`;
        const idHtml = node.id ? `<span class="di-id">#${node.id}</span>` : '';
        const clsHtml = node.classes.length > 0
            ? node.classes.map(c => `<span class="di-class">.${c}</span>`).join('')
            : '';
        const attrHtml = Object.entries(node.attrs).map(([k, v]) =>
            ` <span class="di-attr">${k}</span>="${v}"`
        ).join('');
        const textHtml = node.text
            ? ` <span class="di-text">"${node.text}"</span>`
            : '';
        const hiddenAttr = node.hidden ? ' di-dimmed' : '';
        const matchedAttr = node.matched ? ' di-highlight' : '';

        let html = `<div class="di-line${hiddenAttr}${matchedAttr}" data-idx="${idx}" style="padding-left:${depth * 20}px">
            <span class="di-arrow">${arrow}</span>
            ${tagHtml}${idHtml}${clsHtml}${attrHtml}${textHtml}
        </div>`;

        const childrenHtml = node.children
            .filter(c => c.type === 'element' && c.matched)
            .map(c => this.renderTreeFiltered(c, depth + 1))
            .join('');

        if (childrenHtml) {
            html += `<div class="di-children" data-parent="${idx}">${childrenHtml}</div>`;
        }

        return html;
    }

    /**
     * Generate a robust CSS selector from a node.
     */
    toSelector(node) {
        if (!node || node.type !== 'element') return '';

        if (node.id) {
            const s = `#${node.id}`;
            if (document.querySelectorAll(s).length === 1) return s;
        }

        if (node.classes.length > 0) {
            const s = `${node.tag}.${node.classes.join('.')}`;
            if (document.querySelectorAll(s).length === 1) return s;
        }

        const path = [];
        let el = node.elementRef;
        while (el && el !== document.body && el !== document.documentElement) {
            const tag = el.tagName.toLowerCase();
            const id = el.id;
            const classes = Array.from(el.classList).filter(c => !c.startsWith('toki-') && !c.startsWith('sc-'));

            let seg = tag;
            if (id) { path.unshift(`#${id}`); break; }
            if (classes.length > 0) seg += `.${classes.join('.')}`;

            const parent = el.parentElement;
            if (parent) {
                const sameTag = Array.from(parent.children).filter(c => c.tagName === el.tagName);
                if (sameTag.length > 1) {
                    const nth = sameTag.indexOf(el) + 1;
                    seg += `:nth-child(${nth})`;
                }
            }

            path.unshift(seg);
            el = el.parentElement;
        }

        let sel = path.join(' > ');
        if (node.classes.length > 0) {
            const s = `${node.tag}.${node.classes.join('.')}`;
            if (document.querySelectorAll(s).length === 1) return s;
        }

        return sel;
    }

    /**
     * Show inspector panel.
     */
    show(container, onApply) {
        this.onApply = onApply;
        this.build();
        this._render(container);
    }

    _render(container) {
        this.nodeMap = [];
        const treeHtml = this.renderTree(this.treeData);

        container.innerHTML = `
            <div class="di-panel">
                <div class="di-toolbar">
                    <div class="di-title">🧬 DOM 검사기</div>
                    <div class="di-toolbar-right">
                        <span class="di-count">${this.nodeMap.length} elements</span>
                        <button class="di-refresh" title="DOM 새로고침">↻</button>
                    </div>
                </div>
                <div class="di-filter-bar">
                    <input type="text" class="di-filter" placeholder="🔍 태그 / 클래스 / 텍스트 검색..." />
                </div>
                <div class="di-tree-wrap">
                    <div class="di-tree">${treeHtml}</div>
                </div>
                <div class="di-detail" id="di-detail">
                    <div class="di-detail-header">📋 요소 정보</div>
                    <div class="di-detail-body" id="di-detail-body">
                        <span class="di-detail-placeholder">트리에서 요소를 클릭하세요</span>
                    </div>
                </div>
            </div>
        `;

        this._bindEvents(container);
    }

    _bindEvents(container) {
        const tree = container.querySelector('.di-tree');
        const filter = container.querySelector('.di-filter');
        const refresh = container.querySelector('.di-refresh');
        const detailBody = container.querySelector('#di-detail-body');

        // Arrow click → toggle expand/collapse only
        tree.addEventListener('click', (e) => {
            const arrow = e.target.closest('.di-arrow');
            if (!arrow) return;
            const line = arrow.closest('.di-line');
            if (!line) return;
            const parent = line.dataset.idx;
            const children = tree.querySelector(`.di-children[data-parent="${parent}"]`);
            if (!children) return;
            const isOpen = !children.classList.contains('di-collapsed');
            children.classList.toggle('di-collapsed');
            arrow.textContent = isOpen ? '▶' : '▼';
        });

        // Line click (not on arrow) → select element
        tree.addEventListener('click', (e) => {
            if (e.target.closest('.di-arrow')) return;
            const line = e.target.closest('.di-line');
            if (!line) return;

            const idx = parseInt(line.dataset.idx);
            const node = this.nodeMap[idx];
            if (!node) return;

            this.selectedNode = node;

            tree.querySelectorAll('.di-line').forEach(l => l.classList.remove('di-selected'));
            line.classList.add('di-selected');

            this._highlightOnPage(node, detailBody);
        });

        // Filter
        let filterTimer;
        filter.oninput = () => {
            clearTimeout(filterTimer);
            filterTimer = setTimeout(() => {
                this._applyFilter(filter.value, tree);
            }, 200);
        };

        // Refresh
        refresh.onclick = () => {
            this._render(container);
        };
    }

    _highlightOnPage(node, detailBody) {
        const el = node.elementRef;
        const selector = this.toSelector(node);
        this.lastSelector = selector;

        // Scroll + glow on page
        try {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.style.outline = '3px solid #6a5acd';
            el.style.outlineOffset = '2px';
            el.style.transition = 'outline 0.2s';
            setTimeout(() => { el.style.outline = ''; }, 2500);
        } catch (e) {}

        // Build detail panel
        const tagStr = node.tag;
        const idStr = node.id ? `#${node.id}` : '-';
        const clsStr = node.classes.length > 0 ? node.classes.join(' ') : '-';
        const textStr = node.text ? node.text.substring(0, 100) : '-';
        const selectorStr = selector;

        // Encode selector safely for the code element
        const encodedSelector = selectorStr.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

        detailBody.innerHTML = `
            <div class="di-detail-grid">
                <div class="di-detail-label">태그</div>
                <div class="di-detail-val"><span class="di-tag">${tagStr}</span></div>
                <div class="di-detail-label">ID</div>
                <div class="di-detail-val"><span class="di-id">${idStr}</span></div>
                <div class="di-detail-label">클래스</div>
                <div class="di-detail-val"><span class="di-class">${clsStr}</span></div>
                <div class="di-detail-label">텍스트</div>
                <div class="di-detail-val di-detail-text">${textStr}</div>
            </div>
            <div class="di-detail-selector">
                <div class="di-detail-label">생성된 셀렉터</div>
                <div class="di-selector-row">
                    <code class="di-selector-code">${encodedSelector}</code>
                    <div class="di-selector-actions">
                        <button class="di-btn-copy">📋</button>
                        <button class="di-btn-apply" title="현재 입력 필드에 셀렉터 적용">📝 적용</button>
                    </div>
                </div>
            </div>
        `;

        // Copy button — closure over selectorStr
        const copyBtn = detailBody.querySelector('.di-btn-copy');
        if (copyBtn) {
            copyBtn.onclick = () => {
                this._copyToClipboard(selectorStr);
                copyBtn.textContent = '✅';
                setTimeout(() => { copyBtn.textContent = '📋'; }, 1500);
            };
        }

        // Apply button → triggers parent callback
        const applyBtn = detailBody.querySelector('.di-btn-apply');
        if (applyBtn) {
            applyBtn.onclick = () => {
                if (this.onApply && selector) {
                    this.onApply(selector);
                    applyBtn.textContent = '✅ 적용됨';
                    setTimeout(() => { applyBtn.textContent = '📝 적용'; }, 1500);
                }
            };
        }
    }

    _applyFilter(text, tree) {
        this.filterText = text;
        this.nodeMap = [];

        if (!text.trim()) {
            this.build();
            tree.innerHTML = this.renderTree(this.treeData);
            return;
        }

        this.filterNodes(this.treeData, text);
        tree.innerHTML = this.renderTreeFiltered(this.treeData);
    }

    _copyToClipboard(text) {
        // 1. GM_setClipboard (Tampermonkey native)
        try {
            if (typeof GM_setClipboard === 'function') {
                GM_setClipboard(text);
                return;
            }
            if (typeof GM !== 'undefined' && GM.setClipboard) {
                GM.setClipboard(text);
                return;
            }
        } catch (e) {}

        // 2. Modern clipboard API (secure context)
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text);
                return;
            }
        } catch (e) {}

        // 3. Legacy fallback (textarea + execCommand)
        try {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.left = '-9999px';
            ta.style.top = '-9999px';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
        } catch (e) {
            console.warn('[DomInspector] 클립보드 복사 실패:', e);
        }
    }

}
