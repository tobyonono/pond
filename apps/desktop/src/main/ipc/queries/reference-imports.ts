import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { ReferenceImportSourceSchema } from "@shared/reference-import-contracts";
import { userError } from "@shared/user-error";
import { BrowserWindow, dialog } from "electron";
import { z } from "zod";
import {
  importBookmarkFile,
  parseBookmarkFile,
  selectBookmarkFolders,
} from "../../core/bookmarks";
import { withMutationScope } from "../../core/executor";
import { currentLibraryId } from "../../core/prefs-scope";
import {
  importReferences,
  readLetterboxdFeed,
  readReferenceExport,
} from "../../core/reference-import";
import { deleteSecret, getSecret, setSecret } from "../../keychain";
import { type QueryHandlerMap, query } from "./params";

// An import preview grants access only to the picked file and its current Library.
const picked = new Map<
  string,
  { source: string; libraryId: string; expires: number }
>();
function assertPicked(path: string, source: string): void {
  const grant = picked.get(path);
  if (
    !grant ||
    grant.source !== source ||
    grant.libraryId !== currentLibraryId() ||
    grant.expires < Date.now()
  )
    throw userError("Choose the export again before importing.");
}

export const referenceImportsQueries = {
  "sources.previewImport": query(
    z.object({ source: ReferenceImportSourceSchema }),
    async ({ source }) => {
      const win = BrowserWindow.getFocusedWindow();
      const options =
        source === "letterboxd"
          ? {
              properties: ["openDirectory" as const],
              message: "Choose your unzipped Letterboxd export",
            }
          : {
              properties: ["openFile" as const],
              message:
                source === "goodreads"
                  ? "Choose your Goodreads library CSV"
                  : "Choose a browser bookmark export or Chromium Bookmarks file",
            };
      const result = win
        ? await dialog.showOpenDialog(win, options)
        : await dialog.showOpenDialog(options);
      const path = result.filePaths[0];
      if (result.canceled || !path) return null;
      const libraryId = currentLibraryId();
      let count = 0;
      let rootCount = 0;
      let folders: { id: string; name: string; parentId: string | null }[] = [];
      if (source === "bookmarks") {
        const file = parseBookmarkFile(await readFile(path, "utf8"));
        if (!file?.bookmarks.length)
          throw userError("That file has no web bookmarks.");
        count = file.bookmarks.length;
        rootCount = file.bookmarks.filter(
          (bookmark) => !bookmark.folderIds.length,
        ).length;
        folders = file.folders;
      } else {
        const records = await readReferenceExport(source, path);
        count = records.length;
        folders = [...new Set(records.flatMap((record) => record.folders))].map(
          (name) => ({ id: name, name, parentId: null }),
        );
        rootCount = records.filter((record) => !record.folders.length).length;
      }
      for (const [key, grant] of picked)
        if (grant.expires < Date.now()) picked.delete(key);
      picked.set(path, {
        source,
        libraryId,
        expires: Date.now() + 30 * 60_000,
      });
      return {
        path,
        name: basename(path),
        count,
        folders,
        rootCount,
        tmdbConfigured: Boolean(
          (await getSecret("reference:tmdb")) ?? process.env.TMDB_API_KEY,
        ),
      };
    },
  ),
  "sources.importReferences": query(
    z.object({
      source: ReferenceImportSourceSchema,
      path: z.string().min(1),
      folderIds: z.array(z.string()).optional(),
      includeRoot: z.boolean().optional(),
    }),
    async ({ source, path, folderIds, includeRoot }) => {
      assertPicked(path, source);
      const libraryId = currentLibraryId();
      if (source === "bookmarks") {
        const file = parseBookmarkFile(await readFile(path, "utf8"));
        if (!file) throw userError("The bookmark file could not be read.");
        if (libraryId !== currentLibraryId())
          throw userError("The Library changed. Import again.");
        const result = await withMutationScope(async () => {
          if (libraryId !== currentLibraryId())
            throw userError("The Library changed. Import again.");
          return importBookmarkFile(
            folderIds
              ? selectBookmarkFolders(file, folderIds, includeRoot)
              : file,
          );
        });
        return {
          imported: result.imported,
          skipped: result.skipped,
          failed: 0,
          warnings: [],
        };
      }
      const records = await readReferenceExport(source, path);
      if (libraryId !== currentLibraryId())
        throw userError("The Library changed. Import again.");
      const selected = folderIds ? new Set(folderIds) : null;
      return importReferences(
        records
          .filter(
            (record) =>
              !selected ||
              record.folders.some((folder) => selected.has(folder)) ||
              (includeRoot && !record.folders.length),
          )
          .map((record) =>
            selected
              ? {
                  ...record,
                  folders: record.folders.filter((folder) =>
                    selected.has(folder),
                  ),
                }
              : record,
          ),
      );
    },
  ),
  "sources.importLetterboxdRss": query(
    z.object({ username: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/) }),
    async ({ username }) => {
      const libraryId = currentLibraryId();
      const records = await readLetterboxdFeed(username);
      if (libraryId !== currentLibraryId())
        throw userError("The Library changed. Import again.");
      return importReferences(records);
    },
  ),
  "sources.setTmdbKey": query(
    z.object({ key: z.string().trim().max(4096) }),
    async ({ key }) => {
      if (key) await setSecret("reference:tmdb", key);
      else await deleteSecret("reference:tmdb");
      return { configured: Boolean(key || process.env.TMDB_API_KEY) };
    },
  ),
} satisfies QueryHandlerMap;
