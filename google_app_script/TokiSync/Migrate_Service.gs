/**
 * 🛠️ Migration Service
 * Handles one-time data migration tasks for system updates.
 */

// Centralized Thumbnail Folder Name provided by View_LibraryService.gs
// const THUMB_FOLDER_NAME = "_Thumbnails";

/**
 * [Migration] Moves 'cover.jpg' from series folders to '_Thumbnails/{SeriesID}.jpg'
 * This is a heavy operation and should be run carefully.
 *
 * @param {string} rootFolderId - Root folder ID of the library
 */
function Migrate_MoveThumbnails(rootFolderId) {
  const root = DriveApp.getFolderById(rootFolderId);
  let thumbFolder;

  // 1. Get or Create '_Thumbnails' folder
  const thumbFolders = root.getFoldersByName(THUMB_FOLDER_NAME);
  if (thumbFolders.hasNext()) {
    thumbFolder = thumbFolders.next();
  } else {
    thumbFolder = root.createFolder(THUMB_FOLDER_NAME);
  }

  const logs = [];
  logs.push(`[Start] Migration started... Target: ${thumbFolder.getName()}`);

  const CATS = ["Webtoon", "Manga", "Novel"];
  const folders = root.getFolders();

  // Iterate Categories
  while (folders.hasNext()) {
    const catFolder = folders.next();
    if (!CATS.includes(catFolder.getName())) continue;

    logs.push(`[Scan] Category: ${catFolder.getName()}`);

    // Iterate Series
    const seriesFolders = catFolder.getFolders();
    while (seriesFolders.hasNext()) {
      const sFolder = seriesFolders.next();
      const sName = sFolder.getName();

      // Extract Series ID: "[12345] Title" -> "12345"
      const match = sName.match(/^\[(\d+)\]/);
      if (!match) continue;

      const seriesId = match[1];

      // Check for 'cover.jpg'
      const covers = sFolder.getFilesByName("cover.jpg");
      if (covers.hasNext()) {
        const coverFile = covers.next();
        try {
          // Move & Rename
          // moveTo(destination) is File.moveTo(folder)
          coverFile.moveTo(thumbFolder);
          coverFile.setName(`${seriesId}.jpg`);
          logs.push(`  ✅ Moved: ${sName} -> ${seriesId}.jpg`);
        } catch (e) {
          logs.push(`  ❌ Failed: ${sName} - ${e.toString()}`);
        }
      }
    }
  }

  logs.push("[Done] Migration completed.");
  return logs;
}

/**
 * [Migration] Rename files to include Series Title
 * Target: "0001 - 1화.cbz" -> "0001 - SeriesTitle 1화.cbz"
 *
 * @param {string} seriesId
 * @param {string} rootFolderId
 */
function Migrate_RenameFiles(seriesId, rootFolderId) {
  const root = DriveApp.getFolderById(rootFolderId);
  let targetSeriesFolder = null;
  let seriesTitle = "";

  // 1. Find Series Folder: "[ID] Title"
  // Search recursively in Category folders (Novel, Webtoon, Manga)
  const CATS = ["Webtoon", "Manga", "Novel"];
  const folders = root.getFolders();

  // Search loop
  while (folders.hasNext()) {
    const catFolder = folders.next();
    if (!CATS.includes(catFolder.getName())) continue;

    const seriesFolders = catFolder.getFolders();
    while (seriesFolders.hasNext()) {
      const sFolder = seriesFolders.next();
      if (sFolder.getName().includes(`[${seriesId}]`)) {
        targetSeriesFolder = sFolder;
        // Extract Title: "[12345] Title" -> "Title"
        seriesTitle = sFolder
          .getName()
          .replace(/^\[\d+\]\s*/, "")
          .trim();
        break;
      }
    }
    if (targetSeriesFolder) break;
  }

  if (!targetSeriesFolder) return ["Error: Series Folder Not Found"];

  const logs = [];
  logs.push(
    `[Start] Renaming files in: ${targetSeriesFolder.getName()} (Title: ${seriesTitle})`,
  );

  const files = targetSeriesFolder.getFiles();
  let count = 0;

  while (files.hasNext()) {
    const file = files.next();
    const name = file.getName(); // "0001 - 1화.cbz"

    // Pattern Check: Starts with 4 digits, contains " - ", but NOT seriesTitle
    // Matches: "0001 - 1화.cbz"
    // Ignores: "0001 - Title 1화.cbz"
    if (name.match(/^\d{4}\s-\s/) && !name.includes(seriesTitle)) {
      // "0001 - 1화.cbz" -> "0001 - Title 1화.cbz"
      // Split by " - "
      const parts = name.split(" - ");
      if (parts.length >= 2) {
        const numPart = parts[0]; // "0001"
        const restPart = parts.slice(1).join(" - "); // "1화.cbz"

        const newName = `${numPart} - ${seriesTitle} ${restPart}`;
        file.setName(newName);
        logs.push(`  Renamed: ${name} -> ${newName}`);
        count++;
      }
    }
  }

  logs.push(`[Done] ${count} files renamed.`);
  return logs;
}
