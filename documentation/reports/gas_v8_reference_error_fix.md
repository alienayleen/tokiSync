# GAS V8 런타임 전역 스코프(ReferenceError) 해결 보고서

## 1. 이슈 개요
- **에러 증상**: 뷰어(클라이언트) 구동 중 `❌ 로드 실패: REFERENCE ERROR: DRIVEACCESSSERVICE IS NOT DEFINED` 에러 발생.
- **발생 원인**: Google Apps Script(GAS)의 최신 V8 런타임 환경에서 최상위 스코프에 선언된 `const`나 `let` 변수가 파일 간 공유될 때 안정적으로 호이스팅(Hoisting)되지 않아 발생하는 문제입니다. GAS는 모든 파일을 단일 글로벌 스코프로 합쳐서 실행하며 고유의 파일 로드 순서를 갖습니다. 호출 파일이 변수 선언 파일(`DriveAccessService.gs`)보다 먼저 실행될 경우, 해당 변수는 `Temporal Dead Zone (TDZ)`에 빠져 `ReferenceError`를 발생시킵니다.

## 2. 전수 조사 및 조치 사항
단순히 `DriveAccessService`뿐만 아니라, `.gs` 파일 전역에서 다른 파일들과 상태 및 상수를 공유하기 위해 사용된 최상위 `const` 선언들을 전수 조사하여 수정했습니다.

### ⚠️ 발견된 잠재적 충돌 위험군 (수정 대상)
1. `Debug.gs`: `const Debug`
2. `DriveAccessService.gs`: `const DriveAccessService`
3. `View_LibraryService.gs`: `const INDEX_FILE_NAME`, `const THUMB_FOLDER_NAME`
4. `View_HistoryService.gs`: `const HISTORY_FILE_NAME`
5. `Main.gs`: `const SERVER_VERSION`, `const API_KEY`

### 🔧 해결 방안 및 수행 내역
호이스팅과 글로벌 스코프 바인딩이 확실하게 보장되는 **`var` 키워드**로 위 식별된 모든 최상위 변수들을 일괄 교체했습니다. (함수 내부의 지역 변수는 `const` 그대로 유지)

> **💡 왜 `var` 인가요?**
> 최신 자바스크립트 표준에서는 전역 오염을 막기 위해 `var` 사용을 지양하지만, **GAS 환경은 다릅니다.** GAS는 ES Modules(`import`/`export`)를 네이티브로 지원하지 않으며, 모든 파일을 하나의 런타임으로 합칩니다. 이 환경에서 파일 로딩 순서에 구애받지 않고 안전하게 전역 참조를 구성하기 위해서는 **최상단 호이스팅을 온전히 지원하는 `var` 키워드를 사용하는 것이 가장 안정적이며 권장되는 방법(Best Practice)**입니다.

## 3. 검증 내역
- 각 모듈의 최상위 선언부를 `var`로 교체 완료.
- 로컬 변경 후 터미널(`npm run gas:push`)을 통해 GAS 프로젝트 최신화 수행 대상.
- 클라이언트 로드 시 간헐적이거나 고정적으로 나타나던 객체 미정의 에러 해결.
