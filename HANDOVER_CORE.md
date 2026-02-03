# Core Module Handover Report

**Role:** Core Developer
**Scope:** `downloader.js`, `epub.js`, `cbz.js`, `gas.js`, `utils.js`
**Status:** Stable (Refactoring Complete)

## 1. Module Status

### `downloader.js` (Main Controller)

- **Functions:** `tokiDownload(startIndex, lastIndex)`
- **Dependencies:** `utils.js`, `parser.js`, `epub.js`, `cbz.js`
- **Recent Changes:**
  - **Refactored:** Integrated `CbzBuilder` for unified build process.
  - **Refactored:** Added `getCommonPrefix` integration to clean redundant series titles from filenames.
  - **Refactored:** Extracted `fetchImages` helper for better async control and metadata (extension) handling.
  - **Refactored:** Implemented 4 Download Policies (`folderInCbz`, `zipOfCbzs`, `individual`, `gasUpload`) for flexible output structure and destination.
- **Current Logic:**
  1. Detects site type (Novel vs Image).
  2. Initializes Builders based on `policy`.
     - `folderInCbz`: Shared Builder
     - `zipOfCbzs` / `individual` / `gasUpload`: Per-item Builder
  3. Calculates `commonPrefix` (Series Title) and extracts `SeriesID` from URL.
  4. Iterates list:
     - Calls `processItem` to build content.
     - If policy is `gasUpload`: Destination='drive', Saves to `[ID] SeriesTitle` folder.
     - If policy is `individual`/`zipOfCbzs`: Destination='local', Handled per item/zip.
  5. Finalizes output (Save Shared Builder OR Save Master Zip for `zipOfCbzs`).

### `cbz.js` (CBZ Builder)

- **Role:** Handles creation of Image ZIP files (Webtoon/Manga).
- **Recent Changes:**
  - **New Class:** Created from scratch to replace inline `JSZip` logic.
  - **Optimization:** Implements folder structure simplification (removes redundant series title from internal filenames).
- **Structure:** `Series Title ~ Chapter.cbz` > `Chapter Title/` > `image0001.jpg`

### `epub.js` (EPUB Builder)

- **Role:** Handles creation of Novel EPUB files.
- **Status:** Ported from legacy, basic functionality active.

## Pending Feature Request: UI & Feedback System

**Objective:** Replace intrusive `alert()` calls and console logs with a proper UI and system notification system.

### 1. New Module: `src/new_core/ui.js`

The "Common Part" developer needs to implement this module.

#### **Specs:**

1.  **LogBox Component:**
    - **Visual:** Fixed overlay (bottom-right or bottom-center), semi-transparent dark background.
    - **Content:** Scrollable list of log messages (e.g., `[Local] Processing items...`).
    - **Controls:** Toggle visibility (Minimize/Expand), Clear logs.
    - **API:** `LogBox.log(message)`, `LogBox.error(message)`.

2.  **Notifier Service:**
    - **Function:** Send OS-level notifications for major events (Batch Complete, Critical Error).
    - **Implementation:** Use `GM_notification` (Tampermonkey API) with fallback to `console.log`.
    - **API:** `Notifier.notify(title, body)`.

### 2. Integration Points

Once `ui.js` is created, refactor the following:

- **`downloader.js`:**
  - Initialize `LogBox` at start of `tokiDownload`.
  - Log progress in `processItem` loop.
  - Call `Notifier.notify` when download completes.
- **`utils.js`:**
  - Modify `saveFile` to log "Upload Started/Finished" to `LogBox`.
  - **REMOVE** `alert()` calls in `saveFile` (GAS Upload) to prevent popup spam.
- **Status:** Stable. Uses `JSZip` to bundle XHTML OEBPS structure.
- **Note:** Maintains internal `chapters` array and generates `content.opf`, `toc.ncx` on build.

### `utils.js` (Shared Utilities)

- **Role:** Common helper functions.
- **Functions:**
  - `sleep(ms, randomRange)`: Async delay execution.
  - `waitIframeLoad(iframe, url)`: Promisified iframe loading.
  - `saveFile(zip, filename, type, ext)`: Handles download triggers (Local vs Drive).
  - `getCommonPrefix(str1, str2)`: Finds common start string (used for series title extraction).

### `gas.js` (Google Drive Upload)

- **Role:** Handles chunked upload to Google Apps Script.
- **Status:** Stable.
- **Key Logic:** `uploadToGAS` function using `GM_xmlhttpRequest`. Supports large file chunking (20MB chunks).

## 2. To-Do / Known Issues

- **None active.** All recent refactoring tasks (Builder pattern, Filename cleaning) are complete and verified.

## 3. Interface for Other Agents

- **To Parser Agent:**
  - `downloader.js` heavily relies on `parser.js` returning correct `{ num, title, src }`.
  - If title format changes (e.g. site UI update), `downloader.js`'s title cleaning logic might need strict validation.

- **To UI Agent:**
  - `downloader` uses simple `alert` and `console.log`. Future UI improvements might require callbacks for progress bars instead of console logs.
