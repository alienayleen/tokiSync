# Graph Report - .  (2026-06-29)

## Corpus Check
- 117 files · ~118,657 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 592 nodes · 1127 edges · 31 communities (19 shown, 12 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 2 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_EventBus Listeners|EventBus Listeners]]
- [[_COMMUNITY_Download Engine|Download Engine]]
- [[_COMMUNITY_Viewer Composables|Viewer Composables]]
- [[_COMMUNITY_UI Components|UI Components]]
- [[_COMMUNITY_Parser System|Parser System]]
- [[_COMMUNITY_Parser System|Parser System]]
- [[_COMMUNITY_Parser System|Parser System]]
- [[_COMMUNITY_Download Engine|Download Engine]]
- [[_COMMUNITY_UI Components|UI Components]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_UI Components|UI Components]]
- [[_COMMUNITY_GAS API|GAS API]]
- [[_COMMUNITY_Novel Decryption|Novel Decryption]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Novel Decryption|Novel Decryption]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_EventLog System|Event/Log System]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Parser System|Parser System]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 28|Community 28]]

## God Nodes (most connected - your core abstractions)
1. `tokiDownload()` - 31 edges
2. `FormRuleEditor` - 27 edges
3. `LogBox` - 21 edges
4. `getConfig()` - 20 edges
5. `DomInspector` - 15 edges
6. `GenericParser` - 15 edges
7. `BaseParser` - 14 edges
8. `notify()` - 14 edges
9. `RuleManager` - 13 edges
10. `isConfigValid()` - 12 edges

## Surprising Connections (you probably didn't know these)
- `initApp()` --calls--> `initBridge()`  [EXTRACTED]
  src/viewer/composables/useStore.js → src/viewer/composables/useBridge.js
- `runSchedulerOnce()` --calls--> `startSilentAudio()`  [INFERRED]
  src/core/queue.js → src/core/anti_sleep.js
- `runSchedulerOnce()` --calls--> `stopSilentAudio()`  [INFERRED]
  src/core/queue.js → src/core/anti_sleep.js
- `tokiDownload()` --calls--> `detectSite()`  [EXTRACTED]
  src/core/downloader.js → src/core/detector.js
- `fetchNovelText()` --calls--> `fetchNovelTextViaApi()`  [EXTRACTED]
  src/core/worker-controller.js → src/core/novel-decryptor.js

## Communities (31 total, 12 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.06
Nodes (80): isAudioRunning(), startSilentAudio(), stopSilentAudio(), CbzBuilder, backupToLocalStorage(), getConfig(), isConfigValid(), restoreFromLocalStorage() (+72 more)

### Community 1 - "Community 1"
Cohesion: 0.03
Nodes (61): approxPara, appTheme, cachedEpisodesList, cachedTotalSize, config, container, currentEpisode, currentEpisodeIndex (+53 more)

### Community 2 - "EventBus Listeners"
Cohesion: 0.03
Nodes (58): allCompleted, backupStr, batchNum, changeListeners, cipherBytes, config, createdPopups, customRule (+50 more)

### Community 3 - "Download Engine"
Cohesion: 0.08
Nodes (35): db, downloadQueue, isGCRunning, useDownloadManager(), activeBlobUrls, base64ToBytes(), cancelDownload(), cancelManagerDownload() (+27 more)

### Community 4 - "Viewer Composables"
Cohesion: 0.07
Nodes (16): { currentView, showSettings, showDownloadManager, isAddModalOpen, isSyncing, goBackToLibrary, reloadApp, appTheme, toggleTheme }, useKeyboard(), useStore(), useViewerInput(), { currentView, viewerDefaults, initApp }, arr, d, dd (+8 more)

### Community 5 - "UI Components"
Cohesion: 0.1
Nodes (10): EventBus, EVT, _listeners, logBox, menuModal, originalGM, stopBtn, tests (+2 more)

### Community 9 - "Download Engine"
Cohesion: 0.13
Nodes (13): detectSite(), element, observer, startWorker(), content, firstItem, imgs, parser (+5 more)

### Community 11 - "Community 11"
Cohesion: 0.16
Nodes (19): cleanupBlobUrls(), cleanupEpisodeData(), clearAllEpisodeCaches(), deleteEpisodeCache(), deleteItem(), goToNextEpisode(), goToPrevEpisode(), handlePrev() (+11 more)

### Community 13 - "GAS API"
Cohesion: 0.24
Nodes (11): gasConfig, getBaseUrl(), getBooks(), getChunk(), getLibrary(), getReadHistory(), request(), saveReadHistory() (+3 more)

### Community 14 - "Novel Decryption"
Cohesion: 0.4
Nodes (9): b64urlDecode(), b64urlEncode(), fetchNovelTextViaApi(), getCookie(), getIdsFromUrl(), getValidNonce(), hmacSign(), resetNvCookie() (+1 more)

### Community 15 - "Community 15"
Cohesion: 0.2
Nodes (9): backupPath, bundleContent, bundlePath, __dirname, __filename, hasLogboxStyle, hasModalStyle, modifiedContent (+1 more)

### Community 16 - "Community 16"
Cohesion: 0.25
Nodes (6): bridgeFetch(), generateId(), initBridge(), isConnected, pendingRequests, useBridge()

### Community 17 - "Community 17"
Cohesion: 0.39
Nodes (8): isConfigured(), exitViewer(), forceCloudSync(), goBackToLibrary(), initApp(), pushHistoryToDrive(), syncHistoryFromDrive(), updateSeriesLastReadMap()

### Community 18 - "Novel Decryption"
Cohesion: 0.25
Nodes (6): emit, internalColumnWidth, props, rendererRef, rendererStyle, segmentStyle

### Community 19 - "Community 19"
Cohesion: 0.33
Nodes (5): customDeployId, folderId, GM, match, savedGasUrl

## Knowledge Gaps
- **183 isolated node(s):** `pkg`, `GM`, `folderId`, `customDeployId`, `savedGasUrl` (+178 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `FormRuleEditor` connect `Parser System` to `UI Components`?**
  _High betweenness centrality (0.049) - this node is a cross-community bridge._
- **Why does `EventBus` connect `UI Components` to `Community 0`, `Download Engine`, `EventBus Listeners`?**
  _High betweenness centrality (0.032) - this node is a cross-community bridge._
- **Why does `EVT` connect `UI Components` to `Community 0`, `Download Engine`, `EventBus Listeners`?**
  _High betweenness centrality (0.032) - this node is a cross-community bridge._
- **What connects `pkg`, `GM`, `folderId` to the rest of the system?**
  _183 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.06 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.03 - nodes in this community are weakly interconnected._
- **Should `EventBus Listeners` be split into smaller, more focused modules?**
  _Cohesion score 0.03 - nodes in this community are weakly interconnected._