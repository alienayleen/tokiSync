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
function View_getSeriesList(folderId, bypassCache = false) {
  if (!folderId) throw new Error("Folder ID is required");

  // 1. Check Cache (if not bypassed)
  if (!bypassCache) {
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

  // 2. Rebuild if missing or bypassed
  return View_rebuildLibraryIndex(folderId);
}

/**
 * 라이브러리 폴더 구조를 스캔하여 인덱스(시리즈 목록)를 생성합니다.
 * `info.json` 메타데이터를 우선순위로 하며, 폴더명 파싱도 지원합니다.
 * 생성된 인덱스는 `index.json` 파일로 저장됩니다.
 *
 * @param {string} folderId - 라이브러리 루트 폴더 ID
 * @returns {Array<Object>} 생성된 시리즈 목록
 */
/**
 * 라이브러리 폴더 구조를 스캔하여 인덱스(시리즈 목록)를 생성합니다.
 * Root > Category > Series 구조와 Legacy(Root > Series) 구조를 모두 지원합니다.
 */
function View_rebuildLibraryIndex(folderId) {
  if (!folderId) throw new Error("Folder ID is required");

  const root = DriveApp.getFolderById(folderId);
  const folders = root.getFolders();
  const seriesList = [];

  // Known Categories
  const CATEGORIES = ["Webtoon", "Manga", "Novel"];

  while (folders.hasNext()) {
    const folder = folders.next();
    const name = folder.getName();

    if (name === INDEX_FILE_NAME) continue;

    // 1. Check if it's a Category Folder
    if (CATEGORIES.includes(name)) {
      const subFolders = folder.getFolders();
      while (subFolders.hasNext()) {
        try {
          const s = processSeriesFolder(subFolders.next(), name);
          if (s) seriesList.push(s);
        } catch (e) {
          Debug.log(`Error processing series in ${name}: ${e}`);
        }
      }
    }
    // 2. Otherwise/Fallback: Treat as Legacy Series in Root
    else {
      try {
        // Simple check: does it look like a series? (Has [ID] or info.json)
        // We do a full process check, if valid it returns object, else null/partial
        // But for performance, maybe check name pattern first?
        // [ID] pattern is strong indicator.
        if (name.match(/^\[(\d+)\]/)) {
          const s = processSeriesFolder(folder, "Uncategorized");
          if (s) seriesList.push(s);
        }
      } catch (e) {
        Debug.log(`Error processing legacy series: ${e}`);
      }
    }
  }

  seriesList.sort(
    (a, b) => new Date(b.lastModified) - new Date(a.lastModified)
  ); // Sort by Recent

  // Save Lightweight Index
  const jsonString = JSON.stringify(seriesList);
  const indexFiles = root.getFilesByName(INDEX_FILE_NAME);
  if (indexFiles.hasNext()) {
    indexFiles.next().setContent(jsonString);
  } else {
    root.createFile(INDEX_FILE_NAME, jsonString, MimeType.PLAIN_TEXT);
  }

  return seriesList;
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
  if (thumbnailOld && thumbnailOld.startsWith("data:image")) {
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
