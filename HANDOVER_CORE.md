# Core Module Handover Report (v1.2.0)

**Role:** Core Developer
**Scope:** `src/core/*` (Integrated `downloader.js`, `gas.js`, `ui.js`, etc.)
**Status:** **v1.2.0 Integrated & Deployed** (Main Branch)

---

## 🚀 Recent Major Changes (v1.2.0)

### 1. Core Integration

- **Merged:** `new_core` and `old_core` logic merged into `src/core`.
- **Single Build:** Webpack config updated to build `tokiSync.user.js` from `src/core/index.js`.

### 2. Security & Auth

- **API Key Enforcement:** All GAS requests (Upload, History, View) require `apiKey`.
- **Properties Service:** API Key is stored in GAS Script Properties (not hardcoded).

### 3. Viewer Integration (Zero-Config)

- **Auto-Injection:** UserScript automatically injects `GAS URL`, `FolderID`, `API Key` to the Viewer via `postMessage`.
- **Retry Logic (Pending):** A fix for timing issues is planned (see below).

---

## ⚡️ Critical Next Steps (For Next Agent)

### 1. [Priority] API Key Injection Fix

- **Issue:** The configuration injection (`postMessage`) from UserScript to Viewer fails due to race conditions (timing).
- **Plan:** **Implement Retry Mechanism**
- **Detailed Plan:** Please refer to **`implementation_plan.md`** in `~/.gemini/antigravity/brain/...`.
- **Action:**
  1. Read `implementation_plan.md`.
  2. Modify `src/core/index.js` to implement the retry loop.
  3. Build & Commit.

### 2. [Optimization] Thumbnail Stability

- **Issue:** The `main` branch viewer handles thumbnails more stably than `v1.2.0` despite the same GAS backend.
- **Reference:** See `task.md` -> **Phase 4**.
- **Action:** Compare legacy vs current viewer code and port stability fixes (e.g., caching, pre-fetching strategies).

---

## 🧹 Cleanup Required (Before Next Release)

**Issue:** Temporary build artifacts and development folders were accidentally committed to GitHub.

### Files/Folders to Delete:

1. `docs/488.tokiSync.user.js` - Temporary build artifact
2. `docs/tokiDownloader.user.js` - Legacy build (replaced by `tokiSync.user.js`)
3. `src/new_core/` - Development folder (merged into `src/core`)

### Action Plan:

```bash
# Remove files from Git
git rm docs/488.tokiSync.user.js
git rm docs/tokiDownloader.user.js
git rm -r src/new_core

# Update .gitignore to prevent future accidents
echo "docs/*Downloader.user.js" >> .gitignore
echo "docs/[0-9]*.user.js" >> .gitignore

# Commit
git commit -m "chore: remove temporary build artifacts and dev folders"
git push origin main
```

---

## 🛠 Module Status Overview

### `src/core/index.js` (Entry Point)

- **Role:** Handshake with Viewer, Config Injection, API Proxy.
- **Status:** **Needs Fix** (Retry logic).

### `src/core/gas.js` (GAS Service)

- **Role:** Handle Uploads & History Check.
- **Status:** Stable. Enforces `apiKey`.

### `src/core/ui.js` (UI System)

- **Role:** `LogBox` (Overlay Logs) & `Notifier` (OS Alerts).
- **Status:** Stable & Implemented.

### `src/core/downloader.js` (Core Logic)

- **Role:** Download Controller.
- **Status:** Stable. Supports 4 policies (`folderInCbz`, `gasUpload` etc).
