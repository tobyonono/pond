import { app } from "electron";
import log from "electron-log/main.js";
import { sourcesSkippingLikes } from "../../shared/import-scope";
import { attachCaptureCookies, captures } from "../core/captures";
import { enqueue, libraryInfo, sessionImport, sessionPending } from "../ops";
import type { NativePorts } from "./rpc";

export function liveNativePorts(): NativePorts {
  return {
    sourceChanged: (source) => {
      void import("../core/sync")
        .then(({ syncSource }) =>
          syncSource(source, { trigger: "cron", maxItems: 150 }),
        )
        .catch((error) =>
          log.warn("[pond native] activity sync failed", source, error),
        );
    },
    captureBookmark: async (input) => {
      const { captureBrowserBookmark } = await import(
        "../core/browser-bookmarks"
      );
      return captureBrowserBookmark(input);
    },
    capture: async (draft, cookies) => {
      if (cookies?.length) attachCaptureCookies(draft.id, cookies);
      return captures.accept(draft);
    },
    captureStatus: (id) => captures.status(id),
    enqueue: (url, opts) => enqueue(url, opts),
    libraryInfo,
    foldersList: async () => {
      const { listFolders } = await import("../core/folders");
      return (await listFolders()).map((folder) => ({
        id: folder.id,
        name: folder.name,
        parentId: folder.parentId,
        color: folder.color,
      }));
    },
    tagsList: async () => {
      const { listTags } = await import("../core/tags");
      return (await listTags())
        .filter((tag) => !tag.archived)
        .map((tag) => ({
          name: tag.name,
          starred: tag.starred,
          usageCount: tag.usageCount,
          lastUsedAt: tag.lastUsedAt?.getTime() ?? null,
        }));
    },
    extensionSettings: async () => {
      const [{ getPrefs }, { listAccounts }] = await Promise.all([
        import("../core/prefs"),
        import("../core/sync/accounts"),
      ]);
      const [prefs, accounts] = await Promise.all([getPrefs(), listAccounts()]);
      const likes = { ...prefs.extension.likes };
      for (const source of sourcesSkippingLikes(accounts))
        likes[source] = false;
      return {
        ...prefs.extension,
        likes,
      };
    },
    sessionPending,
    sessionImport,
    appVersion: () => app.getVersion(),
  };
}
