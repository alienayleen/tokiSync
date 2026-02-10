# TokiSync CORE CONTEXT (Ground Truth)

> [!IMPORTANT]
> **READ THIS FIRST BEFORE ANY ACTION.**
> This document contains the absolute architectural truths of the project. If any existing file or your internal knowledge contradicts this, **THIS DOCUMENT WINS.**

## 1. Project Identity & Status

- **Current Version**: v1.4.0 (Stable) -> Moving towards v1.5.0.
- **Legacy Warning**: Ignore any references to "v3.0.0" or "v3.1" in old documents. They are discarded architecture.
- **Architecture**:
  - **Backend**: Google Apps Script (Stateless API).
  - **Bridge**: Tampermonkey UserScript (Core logic & DOM Scraping).
  - **Frontend**: GitHub Pages (Headless Viewer).

## 2. Architectural Ground Truths

- **Statelessness**: The GAS backend DOES NOT store user settings (e.g., folderId) in `PropertiesService`. Everything must be passed in the request payload.
- **Network Layer**:
  - **Primary**: `GM_xmlhttpRequest` for Direct Google Drive API access (bypasses GAS 6min limit).
  - **Fallback**: GAS Relay (`init` -> `upload` chunking).
- **Naming Standard**: `[ID] Series Title` for folders, `Number - Title` for files.

## 3. Anti-Hallucination Guardrails

- **DO NOT** assume `PropertiesService.getUserProperties()` exists for storage.
- **DO NOT** suggest `clasp deploy` unless you explicitly verify the `.clasp.json` and deployment ID.
- **DO NOT** hallucinate site DOM selectors. Always verify via `parser.js`.
- **DO NOT** confuse `TokiSync` (Downloader/Sync) with `TokiView` (Viewer). They are separate modules.

## 4. Key Logic Paths

- **Upload**: `downloader.js` -> `utils.js` (saveFile) -> `gas.js` (uploadToGAS) -> `network.js` (uploadDirect).
- **Metadata**: Managed via `info.json` in each series folder on Drive.
- **Thumbnail**: Centralized in `_Thumbnails` folder, named `{SeriesID}.jpg`.

## 5. Development Rules

- **Analysis First**: Always analyze the current codebase state before performing any work. Do not assume logic.
- **Explicit Documentation**: Every code change MUST include clear comments explaining the **Purpose** (Why) and the **Result** (How/What) to ensure clarity for other agents and users.
- **Language**: JavaScript (ES6+ for Client, GAS for Server).
- **Language Policy**: Communication and Git Commits must be in **Korean**.
- **Versioning**: Semantic Versioning (`MAJOR.MINOR.PATCH`).
