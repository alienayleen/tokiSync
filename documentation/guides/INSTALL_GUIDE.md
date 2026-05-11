# TokiSync v1.8.3 설치 및 설정 가이드

이 가이드는 **TokiSync v1.8.3**의 설치 및 설정 방법을 안내합니다. 최신 버전은 전면 개편된 UI와 고도화된 소설 엔진을 통해 더욱 쾌적한 수집 환경을 제공합니다.

---

## ✅ 사전 준비

1. **Google 계정**: Google Drive 및 Apps Script 사용을 위해 필요합니다.
2. **Google Drive 저장 폴더**: 콘텐츠를 저장할 폴더를 생성하고 **Folder ID**를 메모해두세요.
   - 폴더 URL `.../folders/1ABC_xE...` 에서 뒷부분의 난수 문자열이 ID입니다.

---

## 1단계: Google Apps Script (서버) 설정

### 1-1. 프로젝트 생성 및 코드 복사

1. [Google Apps Script](https://script.google.com/)에 접속하여 **[새 프로젝트]**를 생성합니다.
2. 프로젝트 이름 예시: `TokiSync Server v1.8.3`.
3. 아래 링크에서 최신 번들 코드를 복사하여 `Code.gs`에 붙여넣습니다:
   - 🌟 **[TokiSync_Server_Bundle.gs (Stable 정식 버전)](https://pray4skylark.github.io/tokiSync/TokiSync_Server_Bundle.gs)** (권장)
   - 🧪 **[TokiSync_Server_Bundle.gs (Dev 개발 빌드)](https://pray4skylark.github.io/tokiSync/dev/TokiSync_Server_Bundle.gs)** (최신 기능 테스트)

### 1-2. appsscript.json 매니페스트 설정 (중요)

> [!IMPORTANT]
> 이 설정이 누락되면 Drive API v3 권한 오류가 발생합니다.

1. 좌측 **[프로젝트 설정]** (톱니바퀴 아이콘) 클릭.
2. **「appsscript.json」 매니페스트 파일을 편집기에 표시** 체크박스 활성화.
3. 편집기 파일 목록에서 `appsscript.json`을 열고 아래 내용으로 교체합니다:

```json
{
  "timeZone": "Asia/Seoul",
  "dependencies": {
    "enabledAdvancedServices": [
      {
        "userSymbol": "Drive",
        "serviceId": "drive",
        "version": "v3"
      }
    ]
  },
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8",
  "oauthScopes": [
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/script.external_request"
  ],
  "webapp": {
    "executeAs": "USER_DEPLOYING",
    "access": "ANYONE_ANONYMOUS"
  }
}
```

### 1-3. 🔒 보안(API Key) 및 배포

1. **[프로젝트 설정]** > **[스크립트 속성]** 섹션에서 아래 항목을 추가합니다.
   - **속성**: `API_KEY`
   - **값**: 본인이 사용할 비밀번호 (예: `toki_secret_9999`)
2. 우측 상단 **[배포]** > **[새 배포]**를 클릭합니다.
   - 유형: **웹 앱**
   - 다음 사용자로 실행: **나 (Me)**
   - 액세스 권한: **모든 사용자 (Anyone)** (⚠️ 필수: 뷰어 접근용)
3. 배포 완료 후 생성된 **웹 앱 URL**을 복사해둡니다.

---

## 2단계: UserScript (수집기) 설치

1. 브라우저에 [Tampermonkey](https://www.tampermonkey.net/)를 설치합니다.
2. 최신 **[TokiSync UserScript](https://pray4skylark.github.io/tokiSync/tokiSync.user.js)**를 설치합니다.
3. 지원 사이트(뉴토끼 등) 접속 후 통합 메뉴를 엽니다.
   - 단축키: **`Ctrl + Shift + T`**
   - 또는 우측 하단 **⚙️ 플로팅 버튼** 클릭.
4. **Settings** 섹션에서 다음 정보를 입력하고 저장합니다:
   - **GAS WebApp URL**: 1-3에서 복사한 URL.
   - **Folder ID**: 저장용 구글 드라이브 폴더 ID.
   - **API Key**: 1-3에서 설정한 비밀번호.

> [!TIP]
> **v1.8.3 UI/UX 업데이트**: 이제 모든 기능이 **상단 탭(다운로드, 설정, 시스템)**으로 분류되어 더 직관적이고 넓은 화면(520px)에서 관리할 수 있습니다.

---

## 3단계: 뷰어 (Viewer) 설정

1. **[TokiSync 공식 웹 뷰어](https://pray4skylark.github.io/tokiSync/)**에 접속합니다.
2. UserScript가 설치된 브라우저라면 설정이 자동으로 주입되어 즉시 라이브러리가 로드됩니다.
3. **소설 뷰어 V2 안내**:
   - 읽기 중 상단/중앙을 터치하여 **플로팅 툴바**를 호출할 수 있습니다.
   - 테마, 폰트 크기, 줄 간격을 실시간으로 변경해도 **Locator 엔진**이 읽던 위치를 정확히 고정해줍니다.

---

## 🔧 문제 해결 (FAQ)

> [!WARNING]
> **Q. 뷰어 로딩 중 'ReferenceError'가 발생해요.**
> A. 구형 GAS 코드를 사용 중일 수 있습니다. 1단계의 최신 번들 코드로 업데이트한 후 다시 배포(새 버전) 해주세요.

**Q. 소설 다운로드 속도가 궁금해요.**
A. v1.8.3부터는 소설 API 복호화 시에도 사용자가 설정한 속도 정책(`빠름` ~ `매우 느림`)이 그대로 적용됩니다. 차단 위험을 줄이려면 `느림` 또는 `보통` 정책을 권장합니다.

**Q. 다운로드 중 일부 에피소드가 실패했어요.**
A. 세션 종료 시 자동으로 생성되는 `[작품명]_다운로드_실패_리포트.txt` 파일을 확인하여 실패 원인과 회차를 파악할 수 있습니다.
