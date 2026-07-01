# TokiSync Project Master Handover Document (v1.26.4)

> [!IMPORTANT]
> 이 문서는 프로젝트의 **현재 진행 상태, 최신 버전 사양, 미결 이슈**를 관리하는 동적 문서입니다.
> - **정적 아키텍처 및 규칙**: [AI_AGENT_CONTEXT.md](file:///Users/pray4skylark/Documents/WorkSpace/tokiSync/AI_AGENT_CONTEXT.md) 참조.
> - **상세 기술 이력 (v1.6.0 이전)**: [CHANGELOG.md](file:///Users/pray4skylark/Documents/WorkSpace/tokiSync/CHANGELOG.md) 참조.

---

## 1. Project Status Report (v1.26.4)

### 🚀 Major Milestones

- **v1.4.0**: 썸네일 최적화 및 Direct Drive Access 도입.
- **v1.5.0**: Viewer 2.0 (Vue 3 + Tailwind) 시네마틱 UI 전환.
- **v1.6.0**: Fast Path (File ID Tracking) 및 Background Merge 자동화.
- **v1.7.0**: 고성능 엔진 (Virtual Scroll), 하이브리드 동기화 및 Smart Skip 덮어쓰기 로직 고도화.
- **v1.7.4**: 레이지 로딩 고속화 (Hybrid Jump Engine) 도입 및 **스크롤 대기 시간 1/7 단축**.
- **v1.7.5**: 다운로드 매니저 모달 UI 개편 및 백그라운드 전송 안정화.
- **v1.8.0**: 뷰어 V1/V2 정합성 복구 및 V1-Logic 기반 정밀 텍스트 렌더러(Option A) 도입.
- **v1.8.3**: UI/UX 전면 개편(탭 시스템), 소설 TXT 포맷 지원, 다운로드 속도 정책 자율화.
- **v1.10.0**: 규칙 가져오기(Import) 모달화 및 초기 데드락 해결.
- **v1.20.0**: **🔒 신형 소설 복호화 엔진**, **팝업 IPC 미디어 수집 체계** 및 **📐 뷰어 이미지 비율 보정** 통합 안착.
- **v1.22.1**: tokiSync 뷰어 정렬 필터, 오프라인 GC 탭 추가 및 대기열 스마트 필터 패치.
- **v1.22.2**: **🔒 소설 본문 정제 괄호 구문(<...>) 복구** 및 **sem 의미론적 검증 체계** 연동.
- **v1.23.0**: **⚡ 속도 정책 가변 배율화** 및 **🔒 큐 스토리지 경쟁 조건 해소**.
- **v1.26.0**: 비동기 Promise 기반 요청-응답 패턴 통합, 로거 추상화 및 파서 에디터 UI/UX 리뉴얼.
- **v1.26.1**: C4/H12 IPC 보안 강화를 위한 Nonce 세션 토큰 모델 도입 (3계층 방어막).
- **v1.26.2**: H1 Queue Write Monopoly 위반 및 H2 Dual-writer race 해결.
- **v1.26.3**: 로그 템플릿 필터링, 스크롤 조기 Exit 최적화 및 크로스 윈도우 스코프 큐 액션 통합.
- **v1.26.4**: 로컬/드라이브 다운로드 파이프라인 배치 큐로의 일원화 통합 및 READY 수신 시 활동 타임아웃 핫픽스.

### ✅ v1.26.4 완료 및 안정화 내역

- [x] **로컬/드라이브 다운로드 파이프라인 일원화 통합**:
    - 소설 합본 모드를 제외한 모든 로컬 다운로드 정책을 구글 드라이브 수집용 배치 큐 파이프라인으로 일원화 통합하여 sequential iframe 팝업 루프를 전면 제거.
- [x] **동적 파일명 템플릿 파싱**:
    - 배치 성공 시 `localNameTemplate`을 동적 파싱 적용하도록 개선하여 사용자의 로컬 저장 이름 템플릿 규칙 준수.
- [x] **READY 수신 시 lastActivity 리셋 핫픽스**:
    - 워커 로딩 및 안전 대기 딜레이(지터) 도중 60초 타임아웃 오발사 현상을 차단하기 위해 `WORKER_READY` 수신 즉시 큐 아이템 활동 타임스탬프(`lastActivity`)를 동기식 리셋.

### ✅ v1.26.3 완료 및 안정화 내역

- [x] **워커 로그 중계 프록시 및 디버그 태그 필터링**:
    - 자식 워커 콘솔의 상세 스크롤 로그를 부모 대시보드 UI에 실시간 중계하도록 중계 이벤트 프록시 구현.
    - 일반 로그창 가독성을 확보하기 위해 로깅 템플릿 및 debug 태그 필터 탑재.
- [x] **비이미지 노드 조기 스킵 가상 스크롤 최적화**:
    - 가상화 컨테이너 내 비이미지 요소(댓글, 광고, 레이아웃 공간 등) 감지 시 4초를 기다리는 대신 1초 조기 exit하여 수집 스크롤 속도를 극대화.
- [x] **팝업 Sandbox confirm 차단 해결 및 큐 액션 직접 호출화**:
    - 크로스 윈도우 샌드박스로 인해 EventBus 제어 신호 유실을 막기 위해 모든 큐 액션(초기화, 일시정지, 중지, 삭제)을 EventBus 경유 방식에서 코어 모듈(queue.js) 직접 동기 호출 방식으로 전면 전환.

### ✅ v1.26.1 - v1.26.2 완료 및 안정화 내역

- [x] **Nonce 기반 세션 토큰 보안 강화 (C4/H12)**:
    - Tampermonkey `about:blank` 팝업(origin="null") 환경에서 메시지 위변조를 차단하기 위해 cryptographically random 64-char hex nonce 세션 토큰 설계.
    - (1) Origin 검증, (2) Nonce 검증, (3) `event.source` 참조 매칭의 3계층 가드 탑재.
- [x] **Queue Write Monopoly (H1) 및 Dual-writer Race (H2) 수정**:
    - downloader의 진행률/완료 직접 쓰기 권한을 회수하고 부모 컨트롤러 단일 채널로 큐 쓰기 권한을 일원화하여 스토리지 롤백 및 동기화 충돌 해소.

### ✅ v1.26.0 완료 및 안정화 내역

- [x] **비동기 Promise 기반 요청-응답 패턴 통합**:
    - EventBus.request() / respond() 신설로 검증 및 테스트 통신 트랜잭션을 간결한 동기식으로 일원화하고 타임아웃 해제 가드로 데드락 봉쇄.
- [x] **로거(logger.js) 추상화 및 레이어 디커플링**:
    - 코어 비즈니스 모듈이 UI(LogBox)에 직접 의존하지 않고 logger 인터페이스와 EventBus를 거쳐 우회하도록 계층 결합 분리.
- [x] **파서 에디터 전면 리뉴얼 및 시각화 인스펙터**:
    - 구형 트리뷰 에디터를 폐기하고 FormRuleEditor 폼 리뉴얼 적용.
    - 크롬 DevTools 스타일로 대상을 클릭하여 CSS 셀렉터를 즉시 자동 생성하는 `DomInspector.js` 개발 및 원격 규칙 `SubscriptionManager.js` 도입.

### ✅ v1.23.0 완료 및 안정화 내역

- [x] **속도 정책 가변 배율화 및 지터 시간 격리**:
    - 기존 고정 대기 시간(`SLEEP_POLICIES`) 대신 사용자가 설정한 모드(신중, 철저, 느림, 매우 느림)에 따라 적용되는 **속도 배율(Multiplier)** 체계로 개편.
    - 팝업 첫 통신, 가상 스크롤, 본문 감지 폴링, 에피소드 이동 등의 대기 시간에 동적 가변 배율 적용.
    - 스케줄러 기동 지터는 배율의 영향을 받지 않는 **2.0~4.0초**로 격리하여 연속 기동에 대한 보안 필터 방어력 강화.
- [x] **큐 업데이트 경쟁 조건(Race Condition) 해소**:
    - 자식 워커(`worker-extractor.js`)가 수행 완료 및 진행률을 브라우저 로컬 스토리지(`GM_setValue`)에 직접 쓰던 구조를 폐기.
    - 부모 컨트롤러(`worker-controller.js`) 단일 채널로 큐 쓰기 권한을 일원화하여, 다중 팝업창에서 데이터를 동시에 덮어써 완료된 항목이 롤백되던 크래시 결함 차단.

### ✅ v1.22.2 완료 및 안정화 내역

- [x] **소설 본문 정제 정규식 개선 (괄호 구문 유실 버그 해결)**:
    - **화이트리스트 필터링 도입**: 모든 `<...>`를 지우던 정규식을 소설 레이아웃 관련 표준 HTML 태그만 정확하게 선별 제거하도록 수정하여 `<system>`, `<용사>` 등의 텍스트 유실 방지.
- [x] **sem 의존성 및 변경 검증 파이프라인 정립**:
    - **에이전트 rules/workflows 정의**: 변경 전 영향도 분석(`sem impact`) 및 변경 후 구조 변화 검증(`sem diff`) 절차 규칙화.

### ✅ v1.20.0 완료 및 안정화 내역

- [x] **스크롤 뷰어 이미지 왜곡(Layout Shift) 완벽 해소**:
    - **동적 min-height 복원**: 뷰어 스크롤 모드에서 플레이스홀더로 사용된 `minHeight` 제약이 로딩 후에도 남아 이미지가 찌그러지는 현상 해결.
    - **개별 이미지 로드 상태 감지**: `ImageRenderer.vue` 내부에 `loadedImages` Set 상태를 도입하여 로드 성공/실패 여부를 격리 추적.
    - **플레이스홀더 동적 스위칭**: 이미지 로드 즉시 `minHeight`를 `auto`로 전환해 원본의 세로 폭 비율 복원.
- [x] **신형 소설 복호화 엔진 구현**: JWT 토큰 및 동적 Nonce XOR 디코딩 대응, 네이티브 호환 3단계 정밀 문단 복원 구현.
- [x] **다형성 팝업 IPC 미디어 수집 엔진**: Controller-Worker 팝업 IPC 통신 모델 도입으로 봇 차단 완벽 우회 및 Shadow DOM 오염 텍스트 완벽 정제.
- [x] **보안 우회 설계**: attachShadow 위장 스푸핑, Opener 은폐 격리 및 Jitter Delay 적용.

- [x] **다운로드 안정성 최적화**: 5단계 속도 정책(최대 30초 대기) 도입.
- [x] **부분 다운로드 오름차순 정렬**: 에피소드 번호 기준 오름차순 정렬 로직을 추가하여 순차적 다운로드 보장.
- [x] **GAS 전역 스코프 버그 해결**: V8 런타임 환경의 `Temporal Dead Zone` 방지를 위해 모든 공유 최상위 변수를 `const`에서 `var`로 일괄 교체.
- [x] **V1 툴바 기능 이식**: 테마, 폰트, 줄간격 설정을 V2 뷰어에 통합.
- [x] **정밀 Locator 엔진**: `offsetLeft` 기반 페이지 계산으로 설정 변경 시 진도 유지 완벽 구현.
- [x] **상세 리포트 작성**: `v2_reader_sync_optimization.md`, `download_optimization_report.md` 및 `gas_v8_reference_error_fix.md` 요약 문서화 완료.

### ✅ v1.7.0 완료 및 안정화 내역

- [x] **Smart Skip (결함 검증)**: 단순 이름 비교 대신, Drive API를 거쳐 폴더 내 최고 용량(Max) 대비 % 비율을 통해 손상(캡처 미스)된 파일 자동 재다운로드 수행.
- [x] **Smart Skip 민감도 & 강제 덮어쓰기**: 유저가 직접 결함 감지 민감도(90%~50%)를 조절할 수 있도록 설정 부여 및 수동 강제 덮어쓰기(Force Overwrite) 기능 추가.
- [x] **Fast Path 권한 검증 누락 수정**: `getBooksByCacheId`, `init_update`, `upload` 페이로드에 누락된 `folderId` 추가 (500 에러 해결).
- [x] **고성능 뷰어 엔진**: `VirtualScroll` (IntersectionObserver 기반 렌더링 최적화).
- [x] **가상 스크롤 튐 방지**: `aspect-ratio` 캐싱으로 DOM 해제 시에도 레이아웃 높이 1px 단위 보존.
- [x] **Smart Double Spread**: 지능형 2쪽 보기 알고리즘 (`useSpread.js`).
- [x] **Auto-Crop Engine**: OffscreenCanvas 기반 픽셀 분석 및 여백 제거.
- [x] **크로스 탭 실시간 동기화**: `visibilitychange` 이벤트를 통한 새로고침 없는 이력 동기화.
- [x] **데이터 유실 방지 (Merge-First)**: 업로드 전 서버 데이터를 자동 병합하는 무결성 정책 수립.
- [x] **메타데이터 영속화**: `viewerDefaults` 및 유저 인터페이스 상태 `localStorage` 동기화.
- [x] **읽기 이력 클라우드 동기화**: Dexie(로컬)와 Drive(원격) 이력 Merge 시스템.
- [x] **Triple Defense Filtering**: 이미지 추출 시 경로/확장자/물리적 차원의 3단계 검증.
- [x] **Double-Ended Image Fetching**: 렌더링 전 메타데이터 선점과 스크롤 후 실물 URL의 하이브리드 병합 시스템 구축.
- [x] **Parser Decoupling**: UI와 비즈니스 로직에서 하드코딩된 파싱 로직 제거 및 `ParserFactory` 싱글톤 패턴 도입.
- [x] **Unified Folder Naming**: `BaseParser`를 통한 모든 모듈의 폴더명/제목 생성 로직 단일 진실 소스(SSOT)화.

- [x] **Dynamic LazyKey Detection (v1.7.3)**: 스크립트 파싱 및 요소 역추적을 통한 랜덤 이미지 속성명 자동 추적.
- [x] **Container Selection Logic (v1.7.3)**: 복수 컨테이너 환경에서 이미지 밀도를 기반으로 진짜 본문을 판별하는 지능형 선별 기능.
- [x] **Placeholder GIF Defense (v1.7.3)**: `loading-image.gif` 등 최신 안티 봇 미끼 이미지 필터링 강화.
- [x] **Sync Guard (v1.7.6)**: 슬라이더-스크롤 간 무한 루프 차단 및 20px 위치 가드 적용.
- [x] **Smart Preload (v1.7.6)**: 50% 읽기 진행 시점 트리거를 통한 리소스 부하 최적화.
- [x] **v1.7.5/1.7.6 문서 최신화**: `documentation/reports/walkthrough.md` 및 `AI_AGENT_CONTEXT.md` 동기화 완료 (2026-04-17).

## 2. 알려진 이슈 & 로드맵

> [!NOTE]
> Image Extraction 핵심 로직(`Triple Defense Filtering`) 전체 상세 사양은 **섹션 11**을 참조하세요.

| 일부 사이트 레이지 로딩 방어 | 진행중 | `naturalWidth > 100` 체크 및 더미 패턴 필터링 고도화 필요 |
| 다국어(i18n) 지원 | 로드맵 | 한국어 외 영어/일본어 UI 대응 준비 |
| **GAS Drive Access Layering** | **다음 과제** | `DriveApp` 완전 제거 및 V3 전면 도입, `DriveAccessService` 독립 계층 구축 |

| `npm run build:viewer` EPERM 오류 | ✅ 해결 | dev 서버 종료 + Vite 캐시 삭제 후 정상 빌드 확인                                                                                                                                                                                                       |
| `useTouch.js` 미삭제              | ✅ 해결 | v1.5.5에서 파일 삭제 완료                                                                                                                                                                                                                              |
| `@tailwind` lint warning          | 무해    | VS Code CSS 언어 서버가 Tailwind at-rule 미인식 (빌드 무관)                                                                                                                                                                                            |
| **이어보기 위치 고착 버그**       | ✅ 해결 | 연달아 보기 시 `lastReadEpisode`가 첫 화에 고착됨. `startReading()` 내 `await refreshLastReadEpisode()` 추가 완료 (`useStore.js`) |
| **이력 Merge 후 Drive 미업로드**  | ✅ 해결 | `syncHistoryFromDrive()` merge 결과를 Dexie에만 저장, Drive에 재업로드 안 함. `bulkPut` 이후 `await saveReadHistory(merged)` 즉시 호출 적용 완료 (`useStore.js`)            |
| **Fast Path 신규 시리즈 미매칭** | ✅ 해결 | 첫 업로드 시 `_MergeIndex` 파편이 아직 없어 Fast Path 실패 → `getMergeIndexFragment()` 폴백 로직 추가 (v1.6.1) |
| **`SyncService` `library_index.json` 참조** | ✅ 해결 | `index.json`으로 통일하여 Fast Path 정합성 복구 (v1.6.0) |

---

## 8. 빌드 & 배포

```bash
# 개발 서버
npm run dev:viewer

# 프로덕션 빌드
npm run build:viewer

# UserScript 빌드
npm run build:userscript

# GAS 배포 (⚠️ Human 직접 실행 필요)
npm run build:gas
npm run gas:push
```

**배포**: GitHub Actions `build-release.yml` → `peaceiris/actions-gh-pages` → `gh-pages` 브랜치 자동 배포.

---

### 10.4. 고성능 뷰어 엔진 (Virtual Scroll & UI Optimization)

**배경**: 100~300장의 고해상도 이미지가 포함된 웹툰/만화 로드 시 브라우저 메모리 부족 및 스크롤 끊김 현상 발생.

**구현** (`useVirtualScroll.js`):

- **IntersectionObserver**를 활용하여 Viewport 내외의 이미지 렌더링 동적 제어.
- `rootMargin: '1000px 0px'`: 상하 1000px 버퍼를 두어 스크롤 시 이미지 로딩 지연 최소화.
- `visibleIndices` Set 기반의 반응형 렌더링 트리거.
- `ReaderView.vue`: 가상 스크롤 활성화 시 이미 로드된 이미지만 DOM에 유지, 나머지는 지연 렌더링.

### 10.5. Smart Double Spread (지능형 2쪽 보기)

**배경**: 가로형(책) 만화 감상 시 비율이 제각각인 이미지들을 일관되게 2쪽씩 배치해야 함.

**핵심 알고리즘** (`useSpread.js`):

- `Slot-based Layout`: 이미지를 단순히 나열하지 않고 `Slot` 단위로 묶어 관리.
- **자동 비율 감지**: 이미지 가로/세로 비율이 `1.15`를 초과하면 '와이드(Spread)' 이미지로 판단하여 단독 슬롯 할당.
- **RTL(Right-to-Left) 지원**: 일본 만화 등 우측에서 좌측으로 읽는 연출 대응.
- **Cover First**: 첫 페이지(표지)를 단독 슬롯으로 고정하는 옵션 제공.

### 10.6. Auto-Crop Margin Detection (자동 여백 제거)

**배경**: 스캔본이나 특정 사이트의 이미지에 포함된 불필요한 상하좌우 여백(White/Black Space) 제거 필요.

**구현** (`useAutoCrop.js`):

- **OffscreenCanvas** 분석: 이미지를 디코딩한 후 Canvas에 그려 픽셀 단위 스캔.
- **배경색 감지**: 흰색(RGB > 250), 검은색(RGB < 5), 투명도(Alpha < 10)를 배경으로 간주하여 유효 영역 추출.
- **Dexie Cache**: 분석된 여백 정보(`bounds`)를 `imageMeta` 테이블에 캐싱하여 재열람 시 지연 시간 Zero화.

### 10.7. Metadata Persistence & History Sync (v1.7.0 Final)

**배경**: 뷰어 설정(테마, 뷰 모드, 스크롤 방향 등) 영속화 및 기기 간 이력 덮어쓰기(Conflict)로 인한 데이터 소실 문제 해결.

**구현 및 개선** (`useStore.js`, `main.js`):

- **Cross-Tab Realtime Sync**: 브라우저 탭 복귀 시 `visibilitychange` 이벤트를 감지하여, `GM_setValue`로 마킹된 `TOKI_HISTORY_DIRTY` 플래그 확인 후 새로고침 없이 비동기 이력 갱신.
- **Merge-First Policy**: 이력 업로드 전 서버 데이터를 Pull 하여 로컬과 합친 후 저장하도록 구조 개선 (다중 기기 동기화 안정성 확보).
- **Manual Sync Button**: `EpisodesView.vue`에 수동 동기화 버튼을 배치하여 언제든 클라우드 최신 이력을 덮어쓰기 없이 머지 가능.
- **설정 영속화**: `viewerDefaults` 객체를 `localStorage`에 즉시 동기화.

### 10.8. Viewer Stability Optimization (v1.7.0 Final)

**배경**: 고해상도 웹툰 스크롤 시 레이아웃 튐 현상 및 고속 스크롤 시 이미지 렌더링 지연 해결.

**구현** (`useVirtualScroll.js`, `ReaderView.vue`):

- **Aspect-Ratio Preserving**: 이미지 로드 시점의 비율을 캐싱하여, 가상 스크롤로 인해 DOM에서 해제되어도 `aspect-ratio` 스타일로 높이를 1px 단위까지 보존.
- **Pending Element Queue**: Vue 렌더링 타이밍 이슈로 인해 `IntersectionObserver`에 등록되지 못하는 엘리먼트들을 큐로 관리하여 누락 없는 렌더링 보장.
- **Scroll Mode Exclusion**: 연속된 웹툰 연출을 위해 스크롤 모드에서는 Auto-Crop(`clip-path`) 기능을 전적으로 무효화하여 레이아웃 왜곡 방지.
- **RootMargin Expansion**: 고속 스크롤 대응을 위해 마진을 `3000px`로 확장.

### 10.9. v1.7.0 통합 엔진 최적화 및 안정화 (Final Specs)

**배경**: 고해상도 이미지 로드 시 발생하는 메모리 이슈 및 일부 사이트의 레이지 로딩 더미 이미지(플레이스홀더) 문제를 해결하고, 전체적인 다운로드 성능을 극대화했습니다.

**주요 성과**:
- **Lazy Load Defense (v1.7.0)**: 
    - `utils.js`: `img.naturalWidth > 100` 체크를 통해 물리적으로 로드된 이미지만 수락.
    - `parser.js`: `blank.gif`, `loading.gif` 등 알려진 더미 패턴 자동 필터링.
- **Fast Path (v1.7.0)**: 폴링 간격 단축(200ms) 및 지능형 조기 종료(95%)를 통해 다운로드 속도를 업계 최고 수준으로 끌어올렸습니다.
- **Triple Defense Image Extraction (v1.7.0)**: 뷰어 이미지 추출 시 경로(Blacklist), 확장자(Whitelist), 물리적 차원(Validation)의 3단계 검증 시스템을 도입하여 정합성을 확보했습니다.
- [x] **Stale Cache Purge & UI Cleanup (v1.7.0)**: 뷰어와 드라이브 상태의 완벽한 동기화를 위해 IndexedDB 강제 갱신 로직을 추가하고, 불필요해진 수동 등록('+ ADD NEW') 기능을 제거했습니다.

### 10.10. 레이지 로딩 고속화 (Hybrid Jump Engine - v1.7.4)

**배경**: 기존의 픽셀 단위 선형 스크롤 방식은 50,000px 이상의 웹툰 스캔 시 30초 이상의 긴 대기 시간이 발생하며, 백그라운드 스로틀링 환경에서 렌더링 누락 리스크가 있었습니다.

**구현** (`utils.js`):
- **Element-based Hybrid Jump (EBHJ)**: 픽셀 연산을 폐기하고, DOM 내 이미지 요소를 직접 타격하여 `scrollIntoView({ block: 'center' })`로 점프시킵니다.
- **Sampling Strategy**: 모든 이미지를 방문하지 않고 4개 단위로 샘플링 도약하여 `IntersectionObserver`의 `rootMargin`을 지능적으로 활용합니다.
- **Hybrid Fallback (Bottom Slam)**: 요소 추적이 불가능한 구조에 대비하여 마지막에 물리적 최하단 스크롤을 수행하는 이중 안전장치를 탑재했습니다.
- **성능 개선**: 웹툰 평균 스캔 시간을 30초 ➡️ **4~5초**로 7배 이상 단축했습니다.
- **성능 개선**: 웹툰 평균 스캔 시간을 30초 ➡️ **4~5초**로 7배 이상 단축했습니다.

### 10.11. V1-Logic 기반 정밀 텍스트 렌더러 (Option A - v1.8.0)

**배경**: V2 뷰어의 페이지 모드가 `vw` 단위를 사용하여 스크롤바 유무에 따라 누적 오차가 발생하고, 텍스트가 조금씩 밀리는 현상 해결.

**구현** (`TextRenderer.vue`):
- **Self-Pagination Engine**: 부모의 레이아웃 의존성을 탈피하고, 컴포넌트가 직접 `clientWidth`를 측정하여 `column-width`를 `px` 단위로 고정(Lock).
- **Percentage-based Transform**: 이동 단위를 `%`로 통일(`translateX(-N * 100%)`)하여 렌더링 오차를 0으로 수렴시킴.
- **Backwards Compatibility**: `useFetcher.js` 인터페이스를 `content` 필드로 원복하여 V1 렌더러의 가동성을 보장하면서, V2 전용 `paragraphs` 배열을 병렬 추출하도록 파이프라인 정비.
- **Memory Optimization**: 대용량 EPUB 처리를 위해 원본 HTML 문자열은 하나만 유지하고 V1/V2가 공유하도록 설계.

---

## 11. [CRITICAL] Core Engine: Image Extraction Logic (v1.7.0)

> [!IMPORTANT]
> `src/viewer/composables/useFetcher.js` 내의 `extractImages` 함수는 프로젝트의 정합성을 유지하는 가장 중요한 핵심 로직입니다. 이 로직은 v1.7.0 안정성 확보의 중추적인 역할을 담당하므로, 사이트 구조나 메타데이터 포맷이 변경되어도 반드시 유지되어야 합니다.

### 11.1. Triple Defense Filtering (3중 방어막)

뷰어에서 이미지를 로드할 때 다음 3단계를 거치지 않으면 시스템 파일이 이미지로 오인되어 렌더링 품질을 저하시킵니다.

1.  **1단계: 경로 필터 (Blacklist)**
    - macOS 전용 숨김 파일(`._*`) 및 시스템 폴더(`__MACOSX`)를 파일명 split 분석을 통해 제거합니다.
2.  **2단계: 확장자 필터 (Whitelist)**
    - 정규식 `/\.(jpg|jpeg|png|webp|gif)$/i`를 사용하여 허용된 이미지 포맷만 수락합니다.
3.  **3단계: 물리적 차원 검증 (Validation)**
    - 확장자가 이미지일지라도, `naturalWidth`가 0인 경우(손상된 파일이거나 이미지로 위장한 JSON/XML 파일) 최종 목록에서 즉시 제외합니다.

### 11.2. Stale Cache Purge & Feature Cleanup (v1.7.0)

- 구글 드라이브에서 파일을 삭제했음에도 뷰어 목록에 남는 현상을 해결하기 위해, 에피소드 목록 '새로고침' 시 로컬 IndexedDB(Dexie)를 강제로 Purge한 후 다시 Sync하는 로직을 탑재했습니다.
- 자동 스캔 방식이 안착됨에 따라, 불필요해진 수동 등록('+ ADD NEW') 기능을 완전히 제거하여 안정성을 확보했습니다.

---

## 11. 빌드 & 배포 및 체크리스트

- [x] **EpisodesView 레퍼런스 디자인 적용** (v1.5.5)
- [x] **전역 테마 시스템 구축 및 전파** (v1.5.5)
- [x] **뷰어 이벤트 로직 전면 재설계** (`useViewerInput.js`) (v1.5.5)
- [x] **리더 툴바 테마 대응** (v1.5.5)
- [x] **모바일 터치 불가 버그 3종 수정** (v1.5.5)
- [x] **마지막 화 다음 에피소드 안내 화면** (v1.5.5)
- [x] `useTouch.js` 파일 삭제 (정리 완료)
- [x] `npm run build:viewer` EPERM 오류 해결 (Vite 캐시 삭제)
- [x] **CHANGELOG.md 업데이트 및 v1.5.5 릴리즈** (완료)
- [x] **[BUG] 이어보기 위치 고착 수정** (`useStore.js`)
- [x] **[BUG] 이력 Merge 후 Drive 즉시 업로드** (`useStore.js`)
- [x] **배포 파이프라인(`gh-pages`) 개편** (v1.5.6)
- [x] **GAS 스토리지 중복 파일 누수 무한 증식 픽스** (v1.5.6)
- [x] **Tampermonkey 업데이트 링크 안정화** (v1.5.6)
- [x] **네트워크 타임아웃 및 업로드 안정화 (Anti-Hang)** (v1.6.0)
- [x] **DOM 폴링 강화** — `waitForContent` + `scrollToLoad` 도입 (v1.6.0)
- [x] **커스텀 범위 선택 UI/Logic 구현** — `parseRangeSpec` (v1.6.0)
- [x] **Fast Path (File ID Tracking System) 도입** (v1.6.0)
- [x] **Background Merge Automation** — `SweepMergeIndex` + `TimeDriven` 트리거 (v1.6.0)
- [x] **Kavita 호환 CBZ + ComicInfo.xml** 도입 (v1.6.0)
- [x] **5화 단위 배치 다운로드 및 메모리 최적화** (v1.6.0)
- [x] **Native GM_download 서브폴더 자동 분류 저장** (v1.6.0)
- [x] **GAS SyncService `index.json` 정합성 수정** (v1.6.0)
- [x] **v1.6.2 신규 시리즈 INSERT 지원** — `SweepMergeIndex` 중복 방지 가드 포함 (v1.6.0)
- [x] **documentation/guides/INSTALL_GUIDE.md 및 마스터 문서 업데이트** (v1.6.0)
- [x] **수동 버그 리포트 생성기 도입** — 인메모리 로그 기록 및 GitHub Issues 복사 안내 (v1.6.x)
- [x] **3단계 심속도 정밀 로깅 및 Export 기능 고도화** (v1.7.0)
- [x] **레이지 로딩 이미지 수집 방어 로직 (이중 필터)** (v1.7.0)
- [x] **GAS 배경 인덱스 병합 시 카테고리 유입 구멍 수정** (v1.7.0)
- [x] **README.md / documentation/guides/INSTALL_GUIDE.md 채널 분리 개편** (v1.7.0)
- [x] **고성능 뷰어 엔진 및 가상 스크롤 최적화** (v1.7.0)
- [x] **스마트 더블 스프레드 및 오토 크롭 알고리즘 안착** (v1.7.0)
- [x] **메타데이터 영속화 및 클라우드 이력 동기화 시스템** (v1.7.0)
- [x] **v1.7.0 공식 통합 릴리즈 준비 (Stability & Optimization 통합)** (v1.7.0)
  - [x] 가상 스크롤 튐 방지 및 레이아웃 보존 (`aspect-ratio` 캐싱)
  - [x] 데이터 유실 방지 동기화 정책 (`Merge-First Policy`)
  - [x] 크로스 탭 실시간 이력 동기화 (`visibilitychange` 감지)
  - [x] 레이지 로딩 이미지 수집 방어 로직 (이중 필터)
  - [x] 뷰어 이미지 3중 방어막 (Triple Defense)
  - [x] Fast Path (95% 조기 종료) 다운로드 가속
  - [x] 삭제된 에피소드 로컬 캐시 자동 정리 로직
- [x] **v1.7.4 공식 통합 릴리즈 준비 (EBHJ 엔진 고속화)**
  - [x] 픽셀 기반 루프를 요소 추적 점프(scrollIntoView) 루프로 개편
  - [x] 사이트별 레이지 로딩 센서 특성 대응 (Sampling 4-Step)
  - [x] 백그라운드 탭 렌더링 누락 방지 (Bottom Slam 폴백)
  - [x] 스크롤 인터벌 최적화 (100ms/200ms) 및 CHANGELOG 반영
- [x] **v1.8.0 공식 통합 릴리즈 (Viewer Compatibility & Precision)**
  - [x] 뷰어 V1 소설 렌더링 복구 (`content` 필드 원복)
  - [x] V1-Logic 기반 정밀 텍스트 렌더러 (Option A) 자가 제어 로직 이식
  - [x] `vw` 단위 이동 로직 폐기 및 `%` 단위 정밀 이동 전환
  - [x] 텍스트 크기/줄간격 변경 시 실시간 페이지 재계산 로직 강화
  - [x] 프로덕션 빌드 및 V1/V2 크로스 체크 완료
- [x] **v1.8.2 공식 통합 릴리즈 (Stability & Bug Fix)**
  - [x] 다운로드 속도 5단계 옵션 및 API 복호화 보호 모드(`very_slow`) 강제 적용
  - [x] 범위 다운로드 에피소드 번호 기준 오름차순 정렬 로직 내장
  - [x] GAS V8 런타임 ReferenceError 해결 (최상위 const -> var 교체)
- [x] **v1.8.3 공식 통합 릴리즈 (UI Modernization & Novel Engine)**
  - [x] 상단 탭 기반 UI 개편 및 520px 확장 레이아웃 적용
  - [x] 소설 수집 시 TXT 포맷 지원 (TxtBuilder 통합)
  - [x] 소설 API 복호화 시 강제 속도 제한 제거 및 사용자 정책 반영
  - [x] 상세 실패 리포트(.txt) 자동 생성 로직 안착
  - [x] README, INSTALL_GUIDE 등 전체 문서 현행화 완료
- [x] **v1.23.0 공식 통합 릴리즈 (Jitter Scale & IPC Queue Race Condition Fix)**
  - [x] 지터 대기 시간 고정(2~4초) 및 통신 종류별 가변 배율 적용
  - [x] 소설 스크롤 고정 및 본문 감지 폴링에 가변 배율 연동
  - [x] 자식 워커의 `GM_setValue` 직접 쓰기 제거 및 부모 컨트롤러로 큐 업데이트 단일화
  - [x] 빌드 안정성 테스트 및 패키지/문서 버전 정보(v1.23.0) 갱신
- [x] **v1.20.0 공식 통합 릴리즈 (Decryption, IPC & Height Calibration)**
  - [x] JWT 토큰 및 동적 Nonce XOR 소설 디코딩 분석 엔진 구현
  - [x] Controller-Worker 팝업 IPC 통신 수집 모델 구현
  - [x] attachShadow 위장 스푸핑, Opener 격리, Jitter Delay 봇 회피 구현
  - [x] 3단계 소설 정밀 문단 복원 구현
  - [x] 스크롤 뷰어 이미지 왜곡(Layout Shift) 방지를 위한 동적 min-height 환원 기능 구현
  - [x] 개별 이미지 로드 완료 상태 관리 및 min-height: auto 전환 고도화
