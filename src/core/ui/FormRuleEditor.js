/**
 * FormRuleEditor Module for TokiSync
 * Specialist UI for managing parsing rules with a sleek Form-Tree Hybrid interface.
 */

import { RuleManager } from '../parsers/RuleManager.js';
import { GenericParser } from '../parsers/GenericParser.js';
import { extractEpisodeData } from '../extractor.js';
import { EventBus, EVT } from '../EventBus.js';

export class FormRuleEditor {
    constructor() {
        this.rules = RuleManager.getParserRules() || [];
        this.overlay = null;
        this.currentRuleIndex = 0;
        this.isDropperActive = false;
        this.targetDropperInputId = null;
        
        // Ensure at least one rule exists
        if (this.rules.length === 0) {
            this.rules.push(this.createNewRuleDraft());
        }
    }

    createNewRuleDraft() {
        return {
            id: 'new_site_rule',
            name: '신규 사이트 규칙',
            urlPattern: '.*example\\\\.com/.*',
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
        };
    }

    show(popupDoc = document) {
        const doc = popupDoc;
        if (doc.getElementById('toki-form-editor-overlay')) return;

        this.overlay = doc.createElement('div');
        this.overlay.id = 'toki-form-editor-overlay';
        this.overlay.className = 'toki-modal-overlay';
        this.overlay.style.zIndex = '10001';
        
        this.render();
        doc.body.appendChild(this.overlay);
        this.bindEvents(doc);
        this.loadRuleIntoForm();
    }

    render() {
        const scriptVer = typeof __SCRIPT_VERSION__ !== 'undefined' ? __SCRIPT_VERSION__ : '1.22.0';
        this.overlay.innerHTML = `
            <div class="toki-modal toki-form-editor-modal">
                <div class="toki-modal-header">
                    <div class="toki-modal-title">📝 간편 규칙 편집기 (Form Editor) <span class="toki-text-xs">v${scriptVer}</span></div>
                    <div class="toki-flex-row-8">
                        <button class="toki-btn-rule" id="form-btn-export">📤 내보내기</button>
                        <button class="toki-btn-rule" id="form-btn-import">📥 가져오기</button>
                        <button class="toki-modal-close" id="form-close-btn">&times;</button>
                    </div>
                </div>
                <div class="toki-form-editor-container">
                    <!-- Left Column: Input Form -->
                    <div class="toki-form-editor-left">
                        <!-- 1. 기본 정보 카드 -->
                        <div class="toki-form-card">
                            <div class="toki-form-card-title">
                                <span>🌐 기본 사이트 정보</span>
                                <select id="form-rule-selector" class="toki-select toki-btn-sm" style="width: auto; padding: 4px 24px 4px 10px; margin: 0;">
                                    ${this.rules.map((r, i) => `<option value="${i}">${r.name} (${r.id})</option>`).join('')}
                                    <option value="new">+ 신규 규칙 추가</option>
                                </select>
                            </div>
                            <div class="toki-form-grid">
                                <div class="toki-form-row">
                                    <span class="toki-form-row-label">규칙 ID</span>
                                    <input type="text" id="rule-id" class="toki-input-compact" placeholder="예: blacktoon_webtoon">
                                </div>
                                <div class="toki-form-row">
                                    <span class="toki-form-row-label">규칙 이름</span>
                                    <input type="text" id="rule-name" class="toki-input-compact" placeholder="예: 블랙툰 웹툰 규칙">
                                </div>
                            </div>
                            <div class="toki-form-grid">
                                <div class="toki-form-row">
                                    <span class="toki-form-row-label">URL 패턴 (정규식)</span>
                                    <input type="text" id="rule-urlPattern" class="toki-input-compact" placeholder="예: .*/webtoon/.*">
                                </div>
                                <div class="toki-form-row">
                                    <span class="toki-form-row-label">카테고리</span>
                                    <select id="rule-category" class="toki-select" style="padding: 10px 14px; font-size:13px; height:38px;">
                                        <option value="Webtoon">Webtoon (웹툰)</option>
                                        <option value="Manga">Manga (만화)</option>
                                        <option value="Novel">Novel (소설)</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <!-- 2. 작품 정보(Meta) 카드 -->
                        <div class="toki-form-card">
                            <div class="toki-form-card-title">📖 작품 정보 추출 (Meta)</div>
                            <div class="toki-form-grid">
                                <div class="toki-form-row">
                                    <div class="toki-form-row-header">
                                        <span class="toki-form-row-label">제목 셀렉터</span>
                                        <span class="toki-form-dropper-btn" data-target="rule-meta-title" title="화면에서 스포이드로 선택">🎯</span>
                                    </div>
                                    <div class="toki-flex-row-8">
                                        <input type="text" id="rule-meta-title" class="toki-input-compact toki-flex-1" placeholder="예: h1.hero-v2-title">
                                        <span class="toki-badge-match zero" id="match-rule-meta-title">0</span>
                                    </div>
                                </div>
                                <div class="toki-form-row">
                                    <div class="toki-form-row-header">
                                        <span class="toki-form-row-label">작가 셀렉터</span>
                                        <span class="toki-form-dropper-btn" data-target="rule-meta-author" title="화면에서 스포이드로 선택">🎯</span>
                                    </div>
                                    <div class="toki-flex-row-8">
                                        <input type="text" id="rule-meta-author" class="toki-input-compact toki-flex-1" placeholder="예: div.hero-v2-author">
                                        <span class="toki-badge-match zero" id="match-rule-meta-author">0</span>
                                    </div>
                                </div>
                            </div>
                            <div class="toki-form-grid">
                                <div class="toki-form-row">
                                    <div class="toki-form-row-header">
                                        <span class="toki-form-row-label">썸네일 이미지 셀렉터</span>
                                        <span class="toki-form-dropper-btn" data-target="rule-meta-thumb-selector" title="화면에서 스포이드로 선택">🎯</span>
                                    </div>
                                    <div class="toki-flex-row-8">
                                        <input type="text" id="rule-meta-thumb-selector" class="toki-input-compact toki-flex-1" placeholder="예: div.hero-v2-thumb img">
                                        <span class="toki-badge-match zero" id="match-rule-meta-thumb-selector">0</span>
                                    </div>
                                </div>
                                <div class="toki-form-row">
                                    <span class="toki-form-row-label">썸네일 추출 속성</span>
                                    <input type="text" id="rule-meta-thumb-attr" class="toki-input-compact" placeholder="기본값: src (비워두면 src)">
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Left Column (continued): List & Viewer cards -->
                    <div class="toki-form-editor-left">
                        <!-- 3. 회차 목록(List) 카드 -->
                        <div class="toki-form-card" style="margin-top: 15px;">
                            <div class="toki-form-card-title">📜 회차 목록 추출 (List)</div>
                            <div class="toki-form-grid">
                                <div class="toki-form-row">
                                    <div class="toki-form-row-header">
                                        <span class="toki-form-row-label">목록 부모 컨테이너</span>
                                        <span class="toki-form-dropper-btn" data-target="rule-list-container" title="화면에서 스포이드로 선택">🎯</span>
                                    </div>
                                    <div class="toki-flex-row-8">
                                        <input type="text" id="rule-list-container" class="toki-input-compact toki-flex-1" placeholder="예: ul.ep-list-v2">
                                        <span class="toki-badge-match zero" id="match-rule-list-container">0</span>
                                    </div>
                                </div>
                                <div class="toki-form-row">
                                    <div class="toki-form-row-header">
                                        <span class="toki-form-row-label">회차 아이템 (개별 행)</span>
                                        <span class="toki-form-dropper-btn" data-target="rule-list-item" title="화면에서 스포이드로 선택">🎯</span>
                                    </div>
                                    <div class="toki-flex-row-8">
                                        <input type="text" id="rule-list-item" class="toki-input-compact toki-flex-1" placeholder="예: li.ep-row-v2">
                                        <span class="toki-badge-match zero" id="match-rule-list-item">0</span>
                                    </div>
                                </div>
                            </div>
                            <div class="toki-form-grid">
                                <div class="toki-form-row">
                                    <div class="toki-form-row-header">
                                        <span class="toki-form-row-label">회차 링크 셀렉터</span>
                                        <span class="toki-form-dropper-btn" data-target="rule-list-link-selector" title="화면에서 스포이드로 선택">🎯</span>
                                    </div>
                                    <div class="toki-flex-row-8">
                                        <input type="text" id="rule-list-link-selector" class="toki-input-compact toki-flex-1" placeholder="예: a.ep-row-v2-link">
                                        <span class="toki-badge-match zero" id="match-rule-list-link-selector">0</span>
                                    </div>
                                </div>
                                <div class="toki-form-row">
                                    <div class="toki-form-row-header">
                                        <span class="toki-form-row-label">회차 제목 셀렉터</span>
                                        <span class="toki-form-dropper-btn" data-target="rule-list-title" title="화면에서 스포이드로 선택">🎯</span>
                                    </div>
                                    <div class="toki-flex-row-8">
                                        <input type="text" id="rule-list-title" class="toki-input-compact toki-flex-1" placeholder="예: .ep-row-v2-title strong">
                                        <span class="toki-badge-match zero" id="match-rule-list-title">0</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- 4. 본문/뷰어(Viewer) 카드 -->
                        <div class="toki-form-card">
                            <div class="toki-form-card-title">🖼️ 본문/이미지 추출 (Viewer)</div>
                            <div class="toki-form-grid">
                                <div class="toki-form-row">
                                    <span class="toki-form-row-label">수집 방식 (fetchMethod)</span>
                                    <select id="rule-viewer-fetchMethod" class="toki-select" style="padding: 10px 14px; font-size:13px; height:38px;">
                                        <option value="iframe">iframe (정적/동적 DOM 수집)</option>
                                        <option value="api">api (소설 및 암호화 API)</option>
                                        <option value="direct">direct (단일 다이렉트 패치)</option>
                                    </select>
                                </div>
                                <div class="toki-form-row">
                                    <div class="toki-form-row-header">
                                        <span class="toki-form-row-label">뷰어 본문/이미지 부모 컨테이너</span>
                                        <span class="toki-form-dropper-btn" data-target="rule-viewer-imageContainer" title="화면에서 스포이드로 선택">🎯</span>
                                    </div>
                                    <div class="toki-flex-row-8">
                                        <input type="text" id="rule-viewer-imageContainer" class="toki-input-compact toki-flex-1" placeholder="예: div.vw-imgs, article.viewer">
                                        <span class="toki-badge-match zero" id="match-rule-viewer-imageContainer">0</span>
                                    </div>
                                </div>
                            </div>
                            <div class="toki-form-grid">
                                <div class="toki-form-row">
                                    <div class="toki-form-row-header">
                                        <span class="toki-form-row-label">뷰어 이미지/문단 태그</span>
                                        <span class="toki-form-dropper-btn" data-target="rule-viewer-imageItem" title="화면에서 스포이드로 선택">🎯</span>
                                    </div>
                                    <div class="toki-flex-row-8">
                                        <input type="text" id="rule-viewer-imageItem" class="toki-input-compact toki-flex-1" placeholder="예: img 또는 p">
                                        <span class="toki-badge-match zero" id="match-rule-viewer-imageItem">0</span>
                                    </div>
                                </div>
                                <div class="toki-form-row">
                                    <span class="toki-form-row-label">레이지로드 속성 후보 (반점 구분)</span>
                                    <input type="text" id="rule-viewer-lazyAttrOptions" class="toki-input-compact" placeholder="예: data-src, data-lazy, src">
                                </div>
                            </div>
                            <div class="toki-form-grid">
                                <div class="toki-form-row" style="grid-column: span 2;">
                                    <div class="toki-form-row-header">
                                        <span class="toki-form-row-label">제외 셀렉터 (exclude) (반점 구분)</span>
                                        <span class="toki-form-dropper-btn" data-target="rule-viewer-exclude" title="화면에서 스포이드로 선택">🎯</span>
                                    </div>
                                    <div class="toki-flex-row-8">
                                        <input type="text" id="rule-viewer-exclude" class="toki-input-compact toki-flex-1" placeholder="예: .ad-banner, #sponsored-bottom">
                                        <span class="toki-badge-match zero" id="match-rule-viewer-exclude">0</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Right Column: JSON Preview & Sandbox -->
                    <div class="toki-form-editor-right">
                        <div class="toki-flex-between">
                            <span class="toki-form-row-label" style="font-weight: 800;">⚙️ 실시간 완성 JSON 규칙</span>
                            <span id="form-json-status" class="toki-badge-match ok">✓ Valid</span>
                        </div>
                        <textarea class="toki-tree-json-preview toki-flex-1" id="form-json-editor" spellcheck="false" style="font-size: 11px; line-height:1.4;"></textarea>
                        
                        <div class="toki-form-card" style="margin: 0; padding: 12px; background: rgba(0,0,0,0.02);">
                            <div class="toki-form-row-label" style="font-weight: 800; color: var(--toki-primary);">🧪 로컬 셀렉터 가상 테스트</div>
                            <div class="toki-flex-row-8">
                                <input type="text" id="form-test-url" class="toki-input-compact toki-flex-1" style="height:32px; font-size:12px; padding: 4px 10px;" value="${window.location.href}">
                                <button class="toki-btn-rule toki-text-success" id="form-btn-test" style="height:32px; padding:0 12px;">테스트</button>
                            </div>
                            <div id="form-test-result" class="toki-text-xs" style="margin-top: 4px; color: var(--toki-text-muted);">
                                현재 페이지 또는 지정한 URL 주소의 DOM 파싱 검증을 원클릭으로 가상 작동해보세요.
                            </div>
                        </div>
                        
                        <button class="toki-btn-action toki-btn-lavender" id="form-btn-save" style="height: 48px; border-radius:14px; box-shadow: 0 4px 12px rgba(106, 90, 205, 0.2);">
                            저장 및 즉시 스케줄러 적용
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    loadRuleIntoForm() {
        const rule = this.rules[this.currentRuleIndex];
        if (!rule) return;

        // Base
        this.setValue('rule-id', rule.id || '');
        this.setValue('rule-name', rule.name || '');
        this.setValue('rule-urlPattern', rule.urlPattern || '');
        this.setValue('rule-category', rule.category || 'Webtoon');

        // Meta
        this.setValue('rule-meta-title', typeof rule.meta?.title === 'string' ? rule.meta.title : rule.meta?.title?.selector || '');
        this.setValue('rule-meta-author', typeof rule.meta?.author === 'string' ? rule.meta.author : rule.meta?.author?.selector || '');
        this.setValue('rule-meta-thumb-selector', rule.meta?.thumb?.selector || (typeof rule.meta?.thumb === 'string' ? rule.meta.thumb : ''));
        this.setValue('rule-meta-thumb-attr', rule.meta?.thumb?.attr || '');

        // List
        this.setValue('rule-list-container', rule.list?.container || '');
        this.setValue('rule-list-item', rule.list?.item || '');
        this.setValue('rule-list-link-selector', rule.list?.link?.selector || (typeof rule.list?.link === 'string' ? rule.list.link : ''));
        this.setValue('rule-list-title', rule.list?.title || '');

        // Viewer
        this.setValue('rule-viewer-fetchMethod', rule.viewer?.fetchMethod || 'iframe');
        this.setValue('rule-viewer-imageContainer', rule.viewer?.imageContainer || '');
        this.setValue('rule-viewer-imageItem', rule.viewer?.imageItem || '');
        this.setValue('rule-viewer-lazyAttrOptions', Array.isArray(rule.viewer?.lazyAttrOptions) ? rule.viewer.lazyAttrOptions.join(', ') : '');
        
        const excludeRule = rule.viewer?.exclude || rule.viewer?.remove || '';
        const excludeStr = Array.isArray(excludeRule) ? excludeRule.join(', ') : excludeRule;
        this.setValue('rule-viewer-exclude', excludeStr);

        this.updateJsonPreview();
        this.runRealtimeDomMatchCount();
    }

    setValue(id, val) {
        const el = this.overlay.querySelector('#' + id);
        if (el) el.value = val;
    }

    getValue(id) {
        const el = this.overlay.querySelector('#' + id);
        return el ? el.value.trim() : '';
    }

    updateJsonPreview() {
        const rule = this.rules[this.currentRuleIndex];
        if (!rule) return;

        // Sync form values into rule object
        rule.id = this.getValue('rule-id');
        rule.name = this.getValue('rule-name');
        rule.urlPattern = this.getValue('rule-urlPattern');
        rule.category = this.getValue('rule-category');

        rule.meta = {
            title: this.getValue('rule-meta-title'),
            author: this.getValue('rule-meta-author'),
            thumb: {
                selector: this.getValue('rule-meta-thumb-selector'),
                attr: this.getValue('rule-meta-thumb-attr') || 'src'
            }
        };

        rule.list = {
            container: this.getValue('rule-list-container'),
            item: this.getValue('rule-list-item'),
            num: 'span.no', // Default baseline fallback
            title: this.getValue('rule-list-title'),
            link: {
                selector: this.getValue('rule-list-link-selector'),
                attr: 'href'
            }
        };

        const lazyStr = this.getValue('rule-viewer-lazyAttrOptions');
        const excludeStr = this.getValue('rule-viewer-exclude');
        const excludeArray = excludeStr ? excludeStr.split(',').map(s => s.trim()).filter(s => s) : [];

        rule.viewer = {
            fetchMethod: this.getValue('rule-viewer-fetchMethod'),
            imageRegex: rule.viewer?.imageRegex || 'https?:\\\\/\\\\/[a-zA-Z0-9_\\\\.\\\\/-]+\\\\.(?:jpg|png|webp|gif)',
            imageContainer: this.getValue('rule-viewer-imageContainer'),
            imageItem: this.getValue('rule-viewer-imageItem'),
            lazyAttrOptions: lazyStr ? lazyStr.split(',').map(s => s.trim()) : []
        };

        if (excludeArray.length > 0) {
            rule.viewer.exclude = excludeArray;
            if (rule.viewer.remove) delete rule.viewer.remove;
        } else {
            if (rule.viewer.exclude) delete rule.viewer.exclude;
            if (rule.viewer.remove) delete rule.viewer.remove;
        }

        const editor = this.overlay.querySelector('#form-json-editor');
        if (editor) {
            editor.value = JSON.stringify(rule, null, 2);
        }
    }

    runRealtimeDomMatchCount() {
        const selectors = [
            'rule-meta-title',
            'rule-meta-author',
            'rule-meta-thumb-selector',
            'rule-list-container',
            'rule-list-item',
            'rule-list-link-selector',
            'rule-list-title',
            'rule-viewer-imageContainer',
            'rule-viewer-imageItem',
            'rule-viewer-exclude'
        ];

        selectors.forEach(id => {
            const selector = this.getValue(id);
            const badge = this.overlay.querySelector('#match-' + id);
            if (!badge) return;

            if (!selector) {
                badge.textContent = '0';
                badge.className = 'toki-badge-match zero';
                return;
            }

            try {
                const count = document.querySelectorAll(selector).length;
                badge.textContent = count;
                if (count > 0) {
                    badge.className = 'toki-badge-match ok';
                } else {
                    badge.className = 'toki-badge-match zero';
                }
            } catch (e) {
                badge.textContent = 'Err';
                badge.className = 'toki-badge-match error';
            }
        });
    }

    bindEvents(popupDoc = document) {
        const doc = popupDoc;
        
        // Close
        this.overlay.querySelector('#form-close-btn').onclick = () => this.overlay.remove();

        // 룰 셀렉터 체인지
        const selector = this.overlay.querySelector('#form-rule-selector');
        selector.onchange = () => {
            if (selector.value === 'new') {
                const newRule = this.createNewRuleDraft();
                newRule.id = 'custom_rule_' + Date.now();
                newRule.name = '새로운 규칙 ' + (this.rules.length + 1);
                this.rules.push(newRule);
                this.currentRuleIndex = this.rules.length - 1;
                
                // Re-render select options
                selector.innerHTML = `
                    ${this.rules.map((r, i) => `<option value="${i}">${r.name} (${r.id})</option>`).join('')}
                    <option value="new">+ 신규 규칙 추가</option>
                `;
                selector.value = this.currentRuleIndex;
            } else {
                this.currentRuleIndex = parseInt(selector.value);
            }
            this.loadRuleIntoForm();
        };

        // Form inputs -> JSON Preview & Match Count
        const inputs = this.overlay.querySelectorAll('.toki-input-compact, .toki-select');
        inputs.forEach(el => {
            el.oninput = () => {
                this.updateJsonPreview();
                this.runRealtimeDomMatchCount();
            };
        });

        // JSON Preview -> Form (Reverse binding)
        const jsonEditor = this.overlay.querySelector('#form-json-editor');
        jsonEditor.oninput = () => {
            const status = this.overlay.querySelector('#form-json-status');
            try {
                const parsed = JSON.parse(jsonEditor.value);
                status.textContent = '✓ Valid';
                status.className = 'toki-badge-match ok';
                this.rules[this.currentRuleIndex] = parsed;
                // Re-populate without recursive oninput loop
                this.loadFormFromData(parsed);
            } catch (e) {
                status.textContent = '⚠️ Invalid';
                status.className = 'toki-badge-match error';
            }
        };

        // Dropper Buttons
        const droppers = this.overlay.querySelectorAll('.toki-form-dropper-btn');
        droppers.forEach(btn => {
            btn.onclick = () => {
                const targetId = btn.getAttribute('data-target');
                this.activateDropper(targetId);
            };
        });

        // Test button
        this.overlay.querySelector('#form-btn-test').onclick = async () => {
            const res = this.overlay.querySelector('#form-test-result');
            res.textContent = '⏳ 파싱 테스트 작동 중...';
            try {
                const url = this.overlay.querySelector('#form-test-url').value;
                const domain = new URL(url).origin;
                const rule = this.rules[this.currentRuleIndex];

                const parser = new GenericParser(domain, rule);
                const result = await extractEpisodeData(document, parser, { site: 'test', category: rule.category }, false);

                res.innerHTML = `
                    <div class="toki-text-success" style="font-weight:800;">성공! (Virtual Match)</div>
                    <div>• 제목: <strong>${result.title || '미추출'}</strong></div>
                    <div>• 총 에피소드 수: <strong>${result.urls?.length || (result.content ? '1 (Text)' : '0')}개</strong></div>
                `;
            } catch (e) {
                res.innerHTML = `<div class="toki-text-danger">❌ 실패: ${e.message}</div>`;
            }
        };

        // Save Button
        this.overlay.querySelector('#form-btn-save').onclick = () => {
            this.updateJsonPreview();
            RuleManager.saveParserRules(this.rules);
            const status = this.overlay.querySelector('#form-json-status');
            status.textContent = '💾 저장됨!';
            status.className = 'toki-badge-match ok';
            setTimeout(() => {
                status.textContent = '✓ Valid';
            }, 1500);
            
            // Notify EventBus of parser reload (LogBox will catch this)
            EventBus.emit(EVT.LOG, {
                msg: '[FormEditor] 새로운 파싱 규칙이 디스크 큐 세마포어에 즉시 영속 반영되었습니다.',
                level: 'success'
            });
        };

        // Export & Import
        this.overlay.querySelector('#form-btn-export').onclick = () => {
            const blob = new Blob([JSON.stringify(this.rules, null, 2)], {type: 'application/json'});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `tokisync_custom_rules_${Date.now()}.json`;
            a.click();
        };

        this.overlay.querySelector('#form-btn-import').onclick = () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            input.onchange = (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (evt) => {
                    try {
                        const parsed = JSON.parse(evt.target.result);
                        const list = Array.isArray(parsed) ? parsed : (parsed.rules || [parsed]);
                        this.rules = list;
                        RuleManager.saveParserRules(this.rules);
                        this.currentRuleIndex = 0;
                        
                        // Reset select box options
                        const selector = this.overlay.querySelector('#form-rule-selector');
                        selector.innerHTML = `
                            ${this.rules.map((r, i) => `<option value="${i}">${r.name} (${r.id})</option>`).join('')}
                            <option value="new">+ 신규 규칙 추가</option>
                        `;
                        selector.value = 0;
                        this.loadRuleIntoForm();
                    } catch (err) {
                        alert('잘못된 규칙 JSON 파일입니다: ' + err.message);
                    }
                };
                reader.readAsText(file);
            };
            input.click();
        };
    }

    loadFormFromData(rule) {
        this.setValue('rule-id', rule.id || '');
        this.setValue('rule-name', rule.name || '');
        this.setValue('rule-urlPattern', rule.urlPattern || '');
        this.setValue('rule-category', rule.category || 'Webtoon');

        this.setValue('rule-meta-title', typeof rule.meta?.title === 'string' ? rule.meta.title : rule.meta?.title?.selector || '');
        this.setValue('rule-meta-author', typeof rule.meta?.author === 'string' ? rule.meta.author : rule.meta?.author?.selector || '');
        this.setValue('rule-meta-thumb-selector', rule.meta?.thumb?.selector || '');
        this.setValue('rule-meta-thumb-attr', rule.meta?.thumb?.attr || '');

        this.setValue('rule-list-container', rule.list?.container || '');
        this.setValue('rule-list-item', rule.list?.item || '');
        this.setValue('rule-list-link-selector', rule.list?.link?.selector || '');
        this.setValue('rule-list-title', rule.list?.title || '');

        this.setValue('rule-viewer-fetchMethod', rule.viewer?.fetchMethod || 'iframe');
        this.setValue('rule-viewer-imageContainer', rule.viewer?.imageContainer || '');
        this.setValue('rule-viewer-imageItem', rule.viewer?.imageItem || '');
        this.setValue('rule-viewer-lazyAttrOptions', Array.isArray(rule.viewer?.lazyAttrOptions) ? rule.viewer.lazyAttrOptions.join(', ') : '');
        
        const excludeRule = rule.viewer?.exclude || rule.viewer?.remove || '';
        const excludeStr = Array.isArray(excludeRule) ? excludeRule.join(', ') : excludeRule;
        this.setValue('rule-viewer-exclude', excludeStr);

        this.runRealtimeDomMatchCount();
    }

    activateDropper(targetInputId) {
        if (this.isDropperActive) return;

        this.isDropperActive = true;
        this.targetDropperInputId = targetInputId;

        // Hide form editor and main logbox completely (physical display none to bypass CSS animation forwards)
        const formOverlay = document.getElementById('toki-form-editor-overlay');
        const logBox = document.getElementById('toki-logbox');
        
        if (formOverlay) {
            formOverlay.style.display = 'none';
            formOverlay.style.pointerEvents = 'none';
        }
        if (logBox) {
            logBox.style.display = 'none';
        }

        const style = document.createElement('style');
        style.id = 'toki-dropper-style';
        style.innerHTML = `
            .toki-dropper-hover {
                outline: 3px dashed #7c3aed !important;
                outline-offset: 2px !important;
                background-color: rgba(124, 58, 237, 0.15) !important;
                cursor: crosshair !important;
                transition: outline 0.1s ease !important;
            }
        `;
        document.head.appendChild(style);

        const onMouseOver = (e) => {
            e.stopPropagation();
            if (e.target.closest('#toki-form-editor-overlay') || e.target.closest('#toki-logbox')) return;
            e.target.classList.add('toki-dropper-hover');
        };

        const onMouseOut = (e) => {
            e.stopPropagation();
            e.target.classList.remove('toki-dropper-hover');
        };

        const onClick = (e) => {
            e.preventDefault();
            e.stopPropagation();

            const element = e.target;
            element.classList.remove('toki-dropper-hover');

            const selector = this.getUniqueSelector(element);
            this.setValue(this.targetDropperInputId, selector);

            // Clean up
            document.removeEventListener('mouseover', onMouseOver, true);
            document.removeEventListener('mouseout', onMouseOut, true);
            document.removeEventListener('click', onClick, true);
            
            const styleNode = document.getElementById('toki-dropper-style');
            if (styleNode) styleNode.remove();

            // Restore form editor and logbox visibility to their default stylesheet/class states
            const restoredFormOverlay = document.getElementById('toki-form-editor-overlay');
            const restoredLogBox = document.getElementById('toki-logbox');
            
            if (restoredFormOverlay) {
                restoredFormOverlay.style.display = '';
                restoredFormOverlay.style.pointerEvents = 'auto';
            }
            if (restoredLogBox) {
                restoredLogBox.style.display = '';
            }
            this.isDropperActive = false;

            this.updateJsonPreview();
            this.runRealtimeDomMatchCount();
            
            EventBus.emit(EVT.LOG, {
                msg: `[Dropper] 자동 CSS 셀렉터 감지 완료: ${selector}`,
                level: 'success',
                tag: 'Dropper'
            });
        };

        document.addEventListener('mouseover', onMouseOver, true);
        document.addEventListener('mouseout', onMouseOut, true);
        document.addEventListener('click', onClick, true);
    }

    getUniqueSelector(el) {
        if (!(el instanceof Element)) return '';
        const path = [];
        let current = el;

        while (current && current.nodeType === Node.ELEMENT_NODE) {
            let selector = current.nodeName.toLowerCase();
            
            if (current.id) {
                selector += '#' + current.id;
                path.unshift(selector);
                break; // IDs are unique enough
            } else {
                let className = '';
                if (current.className) {
                    // Extract classes ignoring toki specific classes
                    const classes = current.className.split(/\\s+/).filter(c => c && !c.startsWith('toki-'));
                    if (classes.length > 0) {
                        className = '.' + classes.join('.');
                    }
                }
                selector += className;
                
                // If not unique among siblings, add nth-of-type
                let sibling = current;
                let nth = 1;
                while (sibling = sibling.previousElementSibling) {
                    if (sibling.nodeName.toLowerCase() === current.nodeName.toLowerCase()) nth++;
                }
                if (nth > 1) {
                    // Avoid nth-of-type for generic structural wrappers unless required
                    if (!className && (selector === 'div' || selector === 'li')) {
                        selector += `:nth-of-type(${nth})`;
                    }
                }
            }
            path.unshift(selector);
            current = current.parentNode;
        }

        // Refine path to make it shorter and cleaner
        let finalPath = path.join(' > ');
        // If too long, try to simplify
        if (path.length > 3) {
            const lastThree = path.slice(-3);
            finalPath = lastThree.join(' > ');
            // If still unique in document, use it
            if (document.querySelectorAll(finalPath).length === 1) {
                return finalPath;
            }
            // Otherwise try query with class of last item
            const lastItem = path[path.length - 1];
            if (lastItem.includes('.') && document.querySelectorAll(lastItem).length === 1) {
                return lastItem;
            }
        }
        return finalPath;
    }
}
