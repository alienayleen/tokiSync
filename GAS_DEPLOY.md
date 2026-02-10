# Google Apps Script (GAS) 자동 배포 가이드

Google에서 제공하는 공식 CLI 도구인 **`clasp`**를 사용하여 GAS 프로젝트를 로컬에서 관리하고 배포할 수 있습니다.

## 1. 사전 준비 (Prerequisites)

이 프로젝트에는 이미 `clasp`가 개발 의존성으로 추가되어 있습니다.
터미널에서 아래 명령어로 설치를 확인하세요.

```bash
npm install
```

## 2. 초기 설정 (First Time Setup)

### 2.1 Google 로그인

GAS 계정과 연동하기 위해 로그인이 필요합니다.
브라우저가 열리면 허용(Allow)을 클릭하세요.

```bash
npx clasp login
```

### 2.2 프로젝트 연결 (Clone)

기존에 생성한 GAS 프로젝트를 로컬로 가져옵니다.
**[Script ID]**는 GAS 편집기 주소창에서 확인 가능합니다.
`https://script.google.com/home/projects/[SCRIPT_ID]/edit`

```bash
# google_app_script 폴더로 이동 (이미 코드가 있다면 백업 권장)
cd google_app_script
mv TokiSync backup_tokisync_manual
mkdir TokiSync
cd TokiSync

# 프로젝트 복제
npx clasp clone "YOUR_SCRIPT_ID_HERE"
```

> **주의**: 기존에 수동으로 작성한 `.gs` 파일들이 덮어씌워질 수 있으므로, 반드시 백업하거나 빈 폴더에서 clone 후 로컬 코드를 덮어씌우세요.

## 3. 배포 워크플로우 (Workflow)

### 3.1 코드 수정 및 업로드 (Push)

로컬에서 수정한 코드를 GAS 편집기로 업로드합니다.

```bash
npx clasp push
```

- `push`를 하면 GAS 편집기의 코드가 로컬 코드로 교체됩니다.
- 무시할 파일은 `.claspignore`에 정의할 수 있습니다.

### 3.2 버전 배포 (Deploy)

새로운 버전을 배포하여 라이브(Production) 환경에 반영합니다.

```bash
npx clasp deploy --description "v1.4.0 Release"
```

### 3.3 배포 목록 확인

```bash
npx clasp deployments
```

## 4. 자동화 스크립트 (package.json)

편의를 위해 `package.json`에 단축 명령어를 추가할 수 있습니다.

```json
"scripts": {
  "gas:login": "clasp login",
  "gas:push": "clasp push",
  "gas:deploy": "clasp deploy"
}
```

이제 `npm run gas:push` 만으로 업로드가 가능합니다.
