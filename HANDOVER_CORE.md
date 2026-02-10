# Core Module Handover Report

## 🚀 Status: v1.4.0 Released (Standardized & Stabilized)

### Major Accomplishments

#### 1. Naming Standardization & Migration (v1.4.0)

- **Universal Naming**: All files now follow `Number - Series Title Episode` format (e.g., `0001 - Re:Zero 1.cbz`), unifying Drive and Local conventions.
- **Title Normalization**: Automatically replaces inconsistent list titles with the official metadata title (`meta[name="subject"]` or `og:title`) to ensure clean filenames.
- **Migration Tool**: Added `📂 파일명 표준화` menu command. Triggers server-side renaming (GAS) to update legacy files to the new standard.
- **Robust Folder Search**: Modified upload logic (`network.js`) to search folders by `[ID]` prefix instead of exact name match, preventing duplicate folders when series titles change.

#### 2. Thumbnail Optimization (v1.4.0)

- **Centralized Storage**: All thumbnails moved to `_Thumbnails` folder for faster loading.
- **Auto-Redirect**: Uploads to `cover.jpg` are automatically moved to `_Thumbnails/{SeriesID}.jpg`.
- **Deduplication**: Checks and removes existing thumbnails before uploading new ones.

#### 3. Direct Drive Access (v1.3.5)

- **Mechanism**: UserScript gets OAuth Token from GAS, then uploads/downloads directly via `GM_xmlhttpRequest`.
- **Impact**: Bypassed GAS execution time limit (6 min) and significantly improved large file transfer speed.
- **Components**: `src/core/network.js` (Upload), `docs/js/bridge.js` (Viewer Proxy).

#### 4. Viewer Optimization (v1.3.5)

- **Script Bridge**: Solved CORS issue by proxying Viewer requests through UserScript.
- **Thumbnails**: Lazy Loading, Queue System, Blob Cleanup.
- **Standalone Mode**: Graceful fallback when running Viewer without UserScript.

#### 5. Server Stability (GAS)

- **Progressive Indexing**: Time-Sliced Rebuild (20s chunks) to fix timeouts.
- **API Key Enforcement**: All viewer requests now secured.

---

## 📋 Plan: Future (v1.5.0 Candidates)

### 1. Advanced Metadata

- **Tags/Genres**: Parse and utilize tags for filtering.

### 2. UI/UX Refinement

- **Unified Menu Modal**: Consolidate scattered menu buttons into a single, accessible modal interface.
- **Dark Mode Polish**: Consistent theme across all modals.
- **Mobile Touch**: Enhanced swipe gestures for Viewer.

---

## 🛠️ Technical Analysis for v1.5.0 (Metadata)

### Parsing & Storage Gaps

- **Client (`parser.js`)**: Currently only extracts `Series Title` and `Images`. Needs extension to scrape `Author`, `Genre`, `Tags`, and `Status` from the DOM.
- **Server (`SyncService.gs`)**: The `saveSeriesInfo` function currently **ignores** `tags`. It only maps `authors`, `status`, `category`, and `publisher`.
  - **Action Required**: Must update `infoData.metadata` object construction in `SyncService.gs` to include `tags: data.tags`.

---

## 📂 Key Documents

- **`walkthrough.md`**: Detailed v1.3.5 feature walkthrough.
- **`task.md`**: Complete task history.
