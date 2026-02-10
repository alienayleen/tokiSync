# v1.5.0 UI Specification: Unified Menu Modal

## 🎯 Objective

현재 `GM_registerMenuCommand`로 분산된 메뉴 항목들을 하나의 통합 모달로 재구성하여 사용자 경험을 개선합니다.

## 📋 Current State Analysis

### 현재 메뉴 구조 (`src/core/main.js`)

**전역 메뉴 (항상 표시)**:

- 설정
- 로그창 토글
- Viewer 열기 (설정 전송)
- 🔄 썸네일 최적화 변환 (v1.4.0)

**사이트별 메뉴 (작품 페이지에서만 표시)**:

- 전체 다운로드
- N번째 회차부터
- N번째 회차부터 N번째까지
- 📂 파일명 표준화 (v1.4.0)

### 문제점

1. Tampermonkey 메뉴를 열어야만 접근 가능 (접근성 낮음)
2. 메뉴 항목이 많아질수록 관리 어려움
3. 시각적 피드백 부족

## 🎨 Proposed Design

### Modal UI Structure

```
┌─────────────────────────────────────┐
│  TokiSync 메뉴                    [X]│
├─────────────────────────────────────┤
│                                     │
│  📥 다운로드                         │
│    ├─ 전체 다운로드                  │
│    ├─ N번째 회차부터                 │
│    └─ 범위 지정 다운로드              │
│                                     │
│  ⚙️  관리                            │
│    ├─ 설정                          │
│    ├─ 로그창 토글                    │
│    ├─ 파일명 표준화                  │
│    └─ 썸네일 최적화                  │
│                                     │
│  🌐 뷰어                             │
│    └─ Viewer 열기                   │
│                                     │
└─────────────────────────────────────┘
```

### Trigger Mechanism

1. **Floating Action Button (FAB)**: 우측 하단 고정 버튼
2. **Keyboard Shortcut**: `Ctrl+Shift+T` (TokiSync)
3. **Legacy Support**: 기존 `GM_registerMenuCommand`는 유지 (호환성)

## 🛠️ Implementation Plan

### 1. UI Component (`src/core/ui.js`)

- `class MenuModal` 생성
- 다크 모드 스타일 적용
- 카테고리별 아이콘 및 구분선

### 2. Integration (`src/core/main.js`)

- FAB 버튼 생성 및 이벤트 리스너
- 키보드 단축키 등록
- 기존 메뉴 명령 유지 (Fallback)

### 3. Styling

- Glassmorphism 효과
- 애니메이션 (Fade-in/Slide-up)
- 반응형 디자인 (모바일 대응)

## 🧪 Verification

- 모든 기능이 모달에서 정상 작동하는지 확인
- 키보드 단축키 충돌 여부 확인
- 다크 모드 일관성 검증
