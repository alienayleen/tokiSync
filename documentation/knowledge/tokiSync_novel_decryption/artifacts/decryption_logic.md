# tokiSync Novel Decryption & Popup IPC Core Logic (v1.20.0)

## Overview
TokiSync v1.20.0은 서버의 AES-GCM 및 토큰 보안 기제를 극복하기 위해 기존 API Fetch 복호화 모델을 뛰어넘는 **"차세대 다형성 팝업 IPC 및 이중 폴백(플랜 B + 플랜 C)"** 아키텍처를 도입했습니다. 

기본적으로 브라우저 렌더링 결과물에 직접 개입하는 팝업 우회 훅을 메인으로 사용하되, 긴급 비상용 API 직접 복호화 카드를 코드 내에 장전하여 최강의 영구 가용성을 갖췄습니다.

---

## 🏛️ 1. 플랜 B: 다형성 팝업 IPC 수집 엔진 (액티브)
가장 우아하고 안전하게 평문을 확보하기 위해, 브라우저가 본문 렌더링을 마친 최종 DOM 결과를 IPC(Inter-Process Communication) 브릿지로 갈취합니다.

### 1) 팝업 기동 및 수명 주기 제어 (Controller)
* 다운로드 매니저 실행 시 `window.open`으로 백그라운드 자식 팝업(`tokisync-novel-worker`)을 생성합니다.
* 팝업을 매 화차마다 닫지 않고 `popupRef.location.href = nextUrl`로 갱신하여 팝업 생성 오버헤드와 브라우저 부하를 획기적으로 낮춥니다.
* 수집 완료 또는 취소 시 `closeActivePopup()`이 팝업 창 리소스를 자동으로 클린업합니다.

### 2) 3대 보안 위장 및 격리 가드 (Anti-Blocking)
* **네이티브 함수 변조 탐지 위장 (toString Spoofing)**:
  * 사이트 내부 안티 디버그 모듈이 가로채기(Hooking)를 감지하지 못하도록, `@run-at document-start` 극초기 타이밍에 `attachShadow` 함수를 덮어씀과 동시에 `Function.prototype.toString`까지 가로채어 `'function attachShadow() { [native code] }'`를 완벽히 Spoofing 합니다.
* **부모 창 관계 단절 (Opener Isolation)**:
  * 자식 창이 실행되는 즉시 부모 창의 postMessage 통신 채널을 가상 스토리지에 백업한 후, `window.opener = null` (또는 Object defineProperty) 처리를 감행하여 사이트 스크립트의 역추적을 단절시킵니다.
* **행동 패턴 탐지 무력화 (Jitter Delay)**:
  * 초인적인 수집 속도로 인해 IP/계정이 영구 정지당하는 것을 막기 위해, 데이터 추출 완료 후 다음 화 갱신 전 **3~5초 범위의 무작위 지터(Jitter Delay)**를 강제 대기시켜 사람의 자연스러운 독서 행동을 완벽하게 시뮬레이션합니다.

### 3) 텍스트 노이즈 정제 (Cleansing)
* 단순 `textContent` 수집 시 발생하는 `<style>` 태그(CSS 스타일 코드) 유입 및 돔 오염을 차단하기 위해, 1차적으로 본문 전용 정밀 셀렉터(`.novel-epub-rendered`)를 직접 조준 타겟팅합니다.
* 실패 시, 임시 DOM 클로닝 버퍼를 생성해 `<style>` 및 `<script>` 요소를 강제 제거(`remove()`)한 후 `textContent`를 추출해 맑고 투명한 본문을 100% 보장합니다.

### 4) 미디어 다형성 (Novel/Comic)
* 팝업 Worker가 동작할 때 현재 도메인 및 에피소드 타입을 분석하여 미디어 유형(`novel` 또는 `comic`)을 자동 판단하여 듀얼 분기 수집을 진행합니다.
* 만화/웹툰 수집 모드 시 Shadow DOM 내부의 모든 `<img>` 리스트를 추출하고 `Triple Defense` 물리 필터링을 팝업 내에서 거친 뒤 부모 창에 일괄 전달합니다.

---

## 🏛️ 2. 플랜 C: 예비 API 직접 복호화 엔진 (페이퍼 플랜)
신형 보안 장벽(토큰 내 Nonce 강제화) 및 암호화 명세를 완벽히 해결하는 소스코드 전문을 파일 내부에 보존 및 비활성 장전해둔 비상용 카드입니다.

### 1) 텍스트/이미지 다형성 동적 Nonce 추출
* JWT 토큰의 Payload 파트(`token.split('.')[0]`)를 Base64URL 디코딩하여 내부 JSON 데이터를 디코딩합니다.
* **신형 토큰**: 토큰 내부에 고정된 `nonce`가 박혀 있다면 랜덤 생성을 건너뛰고 **그 고정 Nonce를 그대로 서명 및 요청에 투입**합니다.
* **구형 토큰**: `nonce`가 없을 시 기존과 동일하게 랜덤 24바이트를 생성하는 지능형 `getValidNonce` 엔진을 활용합니다.

### 2) HMAC-SHA256 증명 & XOR 복호화
* 쿠키(`nv`)를 비밀키로 사용하여 `${token}.${nonce}.${userAgent}` 서명을 만들고 `/api/novel-content`로 직접 요청합니다.
* 수신한 payload를 **토큰 헤더(`token.split('.')[0]`)를 UTF-8 바이트 배열로 인코딩한 XOR 키**로 복호화합니다.
* 만약 복호화된 문자열이 `%`로 시작한다면 `decodeURIComponent`로 일괄 디코딩하여 깔끔하게 평문을 복원합니다.

### 3) 런타임 교대 스위치 (Paper Plan Gateway)
* `fetchNovelText` 게이트웨이 내부에 `EMERGENCY_API_FALLBACK = false;` 변수 가드가 셋업되어 있어, 최악의 경우 주석 변수를 `true`로 뒤집는 순간 즉시 실시간 복구 가동이 일어납니다.
