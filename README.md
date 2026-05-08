# ⚡️ TokiSync (토끼싱크) v1.8.1

**북토끼, 뉴토끼, 마나토끼**의 콘텐츠를 **구글 드라이브로 직접 업로드**하고, **전용 웹 뷰어**를 통해 편리하게 관리/열람할 수 있는 올인원 솔루션입니다.

> **🚀 v1.8.1 업데이트 요약:**
> **V2 소설 독서 경험 혁신 및 핫픽스**: V1 텍스트 툴바 완벽 이식 및 정밀 위치 동기화(Locator) 시스템을 통해 폰트/레이아웃 변경 시에도 읽던 문단을 1px 오차 없이 유지합니다. 아울러 다운로드 속도 정책을 5단계로 세분화하여 안정성을 높였고, GAS V8 엔진의 고질적인 `ReferenceError` 문제를 해결하여 뷰어 로딩을 완벽히 안정화했습니다.

---

## ✨ 주요 기능

### 📥 수집기 (UserScript) - v1.8.1

- **📱 통합 메뉴 모달**: `Ctrl+Shift+T` 또는 우측 하단 버튼으로 모든 기능을 한 곳에서 제어.
- **⚙️ 동적 파서 시스템 (New)**: 하드코딩 대신 JSON 기반 동적 규칙을 사용하여 새로운 사이트에도 즉시 대응.
- **🛡️ 콘텐츠 복호화 엔진 (New)**: 최신 보안 기술이 적용된 소설 콘텐츠를 API를 통해 완벽히 복호화 및 추출.
- **🚀 Direct Drive Access**: GAS 서버의 병목 없이 **구글 드라이브 API로 직접 데이터를 전송**합니다.
- **🛡️ 안티 스크래핑 보안**: 
  - **Dynamic LazyKey**: 랜덤하게 변하는 이미지 속성명을 실시간 탐지.
  - **Heuristic Container**: 미끼 광고 영역을 피하고 진짜 본문만 선별 추출.

### 📡 서버 (GAS API) - v1.8.1

- **📚 읽기 이력 동기화**: `read_history.json`을 통한 기기 간 열람 이력 공유.
- **🔑 OAuth 토큰 발급**: 클라이언트의 Direct Access를 위한 권한 위임.
- **📦 대용량 Resumable Upload**: 5GB+ 파일 지원.

### 📊 뷰어 2.0 (Cinematic & Refined) - v1.8.1

- **📖 소설 전용 설정 (v2.9.2)**: 테마(Light/Sepia/Dark), 폰트 크기, 줄 간격 조절 기능을 포함한 플로팅 툴바 이식.
- **🎯 정밀 위치 동기화 (Locator)**: DOM 기반 정밀 트래킹으로 설정 변경이나 에피소드 전환 후에도 읽던 문단을 정확히 유지.
- **📏 가독성 최적화**: 표준 소설책 기준인 720px 가로폭 고정 및 반응형 레이아웃 적용.
- **🚀 Download Manager (Modal UI)**: 시청 중에도 진행 상황을 즉시 확인하고 제어할 수 있는 슬라이드업 모달 전용 UI.
- **⚡️ Zero-Waste Network**: 뷰어 종료/이동 시 지연 없는 즉시 저장(Flush) 및 불필요한 요청 중단.


---

## ⚙️ 설치 가이드 (Quick Start)

자세한 단계별 설치 방법은 **[설치 가이드 (INSTALL_GUIDE.md)](./documentation/guides/INSTALL_GUIDE.md)** 문서를 참고하세요.

### 1. 📡 GAS 서버 배포

1. **[TokiSync_Server_Bundle.gs (정식 버전)](https://pray4skylark.github.io/tokiSync/TokiSync_Server_Bundle.gs)** 코드를 복사하여 [Google Apps Script](https://script.google.com/)에 붙여넣습니다.
   - 🧪 *(선택 사항)* 최신 기능 사전 테스트를 원하시면 **[개발 빌드(Dev)](https://pray4skylark.github.io/tokiSync/dev/TokiSync_Server_Bundle.gs)** 코드를 사용하세요.
2. **프로젝트 설정** > **스크립트 속성**에서 `API_KEY`를 추가하고 원하는 비밀번호를 입력합니다.
3. `배포` > `새 배포` > `웹 앱` 선택 후 `Anyone (모든 사용자)` 권한으로 배포합니다.

### 2. 📥 UserScript (수집기) 설치

1. 브라우저에 [Tampermonkey](https://www.tampermonkey.net/) 확장 프로그램을 설치합니다.
2. 다음 링크 중 하나를 선택하여 UserScript를 설치합니다:
   - 🌟 **[TokiSync UserScript (Stable 정식 버전)](https://pray4skylark.github.io/tokiSync/tokiSync.user.js)** (권장)
   - 🧪 **[TokiSync UserScript (Dev 개발 빌드)](https://pray4skylark.github.io/tokiSync/dev/tokiSync.user.js)** (최신 기능 테스트)
3. 웹툰 사이트 접속 후 메뉴에서 **설정**을 열고 `GAS URL`, `Folder ID`, `API Key`를 입력합니다.

### 3. 📊 뷰어 실행

- 🌟 **[TokiSync 웹 뷰어 (Stable 정식 버전)](https://pray4skylark.github.io/tokiSync/)** (권장)
- 🧪 **[TokiSync 웹 뷰어 (Dev 개발 빌드)](https://pray4skylark.github.io/tokiSync/dev/)** (최신 기능 테스트)

---

## 📖 사용 방법

### ☁️ 다운로드

1. 웹툰/소설 리스트 페이지에 접속합니다.
2. Tampermonkey 메뉴에서 `☁️ 전체 다운로드` 또는 `N번째 회차부터`를 클릭합니다.
3. 우측 하단 로그창에서 진행 상황을 확인합니다.

### 👁️ 뷰어 감상

1. 뷰어 URL로 접속합니다.
2. (첫 접속 시) UserScript가 없다면 **설정 모달**에 API Key 등을 입력합니다.
3. 라이브러리에서 표지를 클릭하여 감상합니다.

---

## 📂 문서 지도 (Documentation Map)

프로젝트에 대한 더 자세한 정보는 `documentation/` 폴더 내의 문서들을 확인하세요.

- **[가이드 (Guides)](./documentation/guides/)**: [설치 방법](./documentation/guides/INSTALL_GUIDE.md), [동적 파싱 규칙 작성](./documentation/guides/DYNAMIC_RULE_GUIDE.md) 등
- **[보고서 (Reports)](./documentation/reports/)**: 최신 릴리즈 분석, 리팩토링 보고서, 워크스루 등
- **[아카이브 (Archive)](./documentation/archive/)**: 과거 업데이트 이력, 참고 자료 등

---

## 📜 라이선스

[MIT License](./LICENSE). Use responsibly.
