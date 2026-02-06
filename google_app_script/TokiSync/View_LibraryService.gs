// =======================================================
// 🚀 Viewer Library Service (Isolated)
// =======================================================

/**
 * 해당 폴더(Libraries)의 시리즈 목록을 반환합니다.
 * 성능을 위해 `index.json` 캐시 파일을 우선 확인하고, 없으면 재구축합니다.
 *
 * @param {string} folderId - 라이브러리 루트 폴더 ID
 * @returns {Array<Object>} 시리즈 목록 (JSON)
 */
function View_getSeriesList(
  folderId,
  bypassCache = false,
  continuationToken = null,
) {
  if (!folderId) throw new Error("Folder ID is required");

  // 1. Check Cache (Only if clean start)
  if (!bypassCache && !continuationToken) {
    const root = DriveApp.getFolderById(folderId);
    const files = root.getFilesByName(INDEX_FILE_NAME);

    if (files.hasNext()) {
      const file = files.next();
      const content = file.getBlob().getDataAsString();
      if (content && content.trim() !== "") {
        try {
          return JSON.parse(content);
        } catch (e) {}
      }
    }
  }

  // 2. Rebuild (Paged)
  return View_rebuildLibraryIndex(folderId, continuationToken);
}

/**
 * 라이브러리 폴더 구조를 스캔하여 인덱스(시리즈 목록)를 생성합니다. (Time-Sliced Pagination)
 * 20초 단위로 끊어서 실행하며, 클라이언트가 continuationToken을 관리합니다.
 * 완료 시 'completed' 상태와 마지막 청크를 반환합니다. 클라이언트는 'view_save_index'로 저장해야 합니다.
 */
function View_rebuildLibraryIndex(folderId, continuationToken) {
  const root = DriveApp.getFolderById(folderId);
  const startTime = new Date().getTime();
  const TIME_LIMIT = 20000; // 20 Seconds
  const seriesList = [];

  // State: Phases (Root -> Cats)
  let state = continuationToken
    ? JSON.parse(continuationToken)
    : {
        step: 0,
        targets: [],
        driveToken: null,
      };

  // Phase 0: Plan Targets
  if (state.targets.length === 0) {
    state.targets.push({ id: folderId, category: "Uncategorized" }); // Root

    const CATS = ["Webtoon", "Manga", "Novel"];
    const folders = root.getFolders();
    while (folders.hasNext()) {
      const f = folders.next();
      if (CATS.includes(f.getName())) {
        state.targets.push({ id: f.getId(), category: f.getName() });
      }
    }
  }

  let hasMore = false;

  // Execution Loop
  while (state.step < state.targets.length) {
    const current = state.targets[state.step];
    let iterator;

    try {
      if (state.driveToken) {
        iterator = DriveApp.continueFolderIterator(state.driveToken);
      } else {
        iterator = DriveApp.getFolderById(current.id).getFolders();
      }

      while (iterator.hasNext()) {
        if (new Date().getTime() - startTime > TIME_LIMIT) {
          hasMore = true;
          break;
        }

        const folder = iterator.next();
        const name = folder.getName();

        // Skip Index & Categories (if in Root)
        if (name === INDEX_FILE_NAME) continue;
        if (
          ["Webtoon", "Manga", "Novel"].includes(name) &&
          current.category === "Uncategorized"
        )
          continue;

        try {
          const s = processSeriesFolder(folder, current.category);
          if (s) seriesList.push(s);
        } catch (e) {}
      }

      if (hasMore) {
        state.driveToken = iterator.getContinuationToken();
        return {
          status: "continue",
          continuationToken: JSON.stringify(state),
          list: seriesList,
        };
      } else {
        // Step Finished
        state.step++;
        state.driveToken = null;
      }
    } catch (e) {
      Debug.log(`Error in step ${state.step}: ${e}`);
      state.step++;
      state.driveToken = null;
    }
  }

  // All Done
  return { status: "completed", list: seriesList };
}

/**
 * 클라이언트가 업로드한 전체 인덱스를 저장합니다.
 */
function View_saveIndex(folderId, list) {
  if (!list || !Array.isArray(list)) return;

  // Sort by Recent
  list.sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));

  const root = DriveApp.getFolderById(folderId);
  const jsonString = JSON.stringify(list);
  const files = root.getFilesByName(INDEX_FILE_NAME);
  if (files.hasNext()) files.next().setContent(jsonString);
  else root.createFile(INDEX_FILE_NAME, jsonString, MimeType.PLAIN_TEXT);
}

/**
 * [Helper] 단일 시리즈 폴더를 처리하여 메타데이터 객체를 반환합니다.
 */
function processSeriesFolder(folder, categoryContext) {
  const folderName = folder.getName();
  // Debug.log(`[Scan] Processing: ${folderName}`); // Too noisy for all, maybe enable if needed

  let metadata = {
    status: "ONGOING",
    authors: [],
    summary: "",
    category: categoryContext,
  };
  let seriesName = folderName;
  let thumbnailId = "";
  let thumbnailOld = "";
  let sourceId = "";
  let booksCount = 0;

  // ID Parsing
  const idMatch = folderName.match(/^\[(\d+)\]/);
  if (idMatch) sourceId = idMatch[1];

  // 1. Check for 'cover.jpg'
  // Try exact match first
  let coverFiles = folder.getFilesByName("cover.jpg");
  if (coverFiles.hasNext()) {
    const f = coverFiles.next();
    thumbnailId = f.getId();
    // Debug.log(`  -> Found cover.jpg: ${thumbnailId}`);
  } else {
    // Try Case-Insensitive / Alternative names
    const altNames = ["Cover.jpg", "cover.png", "Cover.png", "cover.jpeg"];
    for (const alt of altNames) {
      const alts = folder.getFilesByName(alt);
      if (alts.hasNext()) {
        thumbnailId = alts.next().getId();
        break;
      }
    }
  }

  // 2. Parse info.json
  const infoFiles = folder.getFilesByName("info.json");
  if (infoFiles.hasNext()) {
    try {
      const content = infoFiles.next().getBlob().getDataAsString();
      const parsed = JSON.parse(content);

      if (parsed.title) seriesName = parsed.title;
      if (parsed.id) sourceId = parsed.id;
      if (parsed.file_count) booksCount = parsed.file_count;

      if (
        parsed.category &&
        (!categoryContext || categoryContext === "Uncategorized")
      ) {
        metadata.category = parsed.category;
      }
      if (parsed.status) metadata.status = parsed.status;
      if (parsed.metadata && parsed.metadata.authors)
        metadata.authors = parsed.metadata.authors;
      else if (parsed.author) metadata.authors = [parsed.author];

      // Dual Strategy: Base64 from info.json (temp store in thumbnailId if we want, but let's use separate field)
      if (parsed.thumbnail) thumbnailOld = parsed.thumbnail; // Base64 or URL
    } catch (e) {}
  } else {
    const match = folderName.match(/^\[(\d+)\]\s*(.+)/);
    if (match) seriesName = match[2];
  }

  // Refine Dual Strategy Return
  let base64Thumb = "";
  // Optimization: Only include Base64 if we DO NOT have a Drive ID (cover.jpg)
  // This prevents index.json from bloating with heavy strings.
  if (!thumbnailId && thumbnailOld && thumbnailOld.startsWith("data:image")) {
    base64Thumb = thumbnailOld;
  }
  // If thumbnailOld is http url, we keep it in 'thumbnail' field anyway.

  return {
    id: folder.getId(),
    sourceId: sourceId,
    name: seriesName,
    booksCount: booksCount,
    metadata: metadata,
    thumbnail: base64Thumb || thumbnailOld, // Base64 or External URL
    thumbnailId: thumbnailId, // Drive ID (cover.jpg)
    hasCover: !!thumbnailId,
    lastModified: folder.getLastUpdated(),
    category: metadata.category,
  };
}
