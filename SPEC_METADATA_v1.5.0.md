# v1.5.0 Metadata Specification

## 🎯 Objective

Enrich `info.json` with detailed metadata (Authors, Tags, Status) to enable advanced filtering and organization in TokiView.

## 📊 Data Structure (`info.json`)

```json
{
  "id": "12345",
  "title": "Example Title",
  "url": "https://...",
  "thumbnail": "",
  "metadata": {
    "authors": ["Author Name"],
    "status": "Ongoing", // "Ongoing" | "Completed"
    "category": "Webtoon", // "Webtoon" | "Novel" | "Manga"
    "publisher": "Site Name",
    "tags": ["Fantasy", "Action"] // [NEW] Target Field
  },
  "last_updated": "2024-01-01T00:00:00.000Z"
}
```

## 🛠️ Required Changes

### 1. Server Side (GAS)

**File**: `SyncService.gs` -> `saveSeriesInfo`

**Current State**:

- Ignores `data.tags`.
- Manually constructs `infoData.metadata`.

**Requirement**:

- Update `infoData.metadata` construction to include `tags`.
- **Logic**:
  ```javascript
  metadata: {
      authors: [data.author || "Unknown"],
      status: data.status || "Unknown",
      category: data.category || "Unknown",
      publisher: data.site || "",
      tags: data.tags || [] // <--- ADD THIS
  }
  ```

### 2. Client Side (Tampermonkey)

**File**: `src/core/parser.js`

**Requirement**:

- **`getAuthors()`**: Extract from `.view-content` (or meta tags).
- **`getTags()`**: Extract from `.view-content` (look for hash tags or specific classes).
- **`getStatus()`**: Extract publishing status (e.g., "연재중", "완결").

**File**: `src/core/gas.js`

- Update `saveSeriesInfo` payload to include `tags` array.

## 🧪 Verification

- **Success Criteria**:
  1. `tokiDownload` triggers `save_info` request.
  2. Google Drive `info.json` contains `"tags": [...]`.
  3. No regression in existing fields.
