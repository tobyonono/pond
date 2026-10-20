import { storage } from "wxt/utils/storage";
import { z } from "zod";
import {
  type BookmarkQueue,
  drainBookmarkQueue,
  planBookmarkQueue,
  selectedBookmarks,
} from "@/utils/bookmark-plan";
import {
  BookmarkSettingsSchema,
  bookmarkSettings,
  bookmarkStatus,
} from "@/utils/bookmark-settings";
import { nativeCall } from "@/utils/native";

const queueStorage = storage.defineItem<BookmarkQueue & { generation: string }>(
  "local:bookmarkSyncQueue",
  {
    fallback: { generation: "", pending: [], synced: {} },
  },
);
const ALARM = "pond:bookmark-sync";
let running = false;
let requested = false;
let registered = false;

function schedule(): void {
  requested = true;
  if (running) return;
  running = true;
  void (async () => {
    try {
      while (requested) {
        requested = false;
        await syncBookmarks();
      }
    } catch {
      await bookmarkStatus.setValue({
        pending: (await queueStorage.getValue()).pending.length,
        error: "Bookmark sync could not finish. It will retry automatically.",
        lastSync: null,
      });
    } finally {
      running = false;
    }
  })();
}

async function syncBookmarks(): Promise<void> {
  const parsed = BookmarkSettingsSchema.safeParse(
    await bookmarkSettings.getValue(),
  );
  if (!parsed.success || !parsed.data.enabled || !parsed.data.folderIds.length)
    return;
  const settings = parsed.data;
  if (!(await browser.permissions.contains({ permissions: ["bookmarks"] })))
    return;
  const previous = await queueStorage.getValue();
  const tree = await browser.bookmarks.getTree();
  const captures = selectedBookmarks(tree, settings.folderIds);
  const plan = planBookmarkQueue(
    captures,
    previous.generation === settings.generation ? previous.synced : {},
  );
  await queueStorage.setValue({ ...plan, generation: settings.generation });
  let error: string | null = null;
  const result = await drainBookmarkQueue(plan, async (capture) => {
    const current = await bookmarkSettings.getValue();
    if (!current.enabled || current.generation !== settings.generation)
      return false;
    const response = await nativeCall({
      type: "bookmarks.capture",
      libraryPath: settings.libraryPath,
      url: capture.url,
      title: capture.title,
      folderPath: capture.folderPath,
    });
    if (!response.ok) {
      error =
        response.error === "library_changed"
          ? `Open ${settings.libraryName} in Pond to continue syncing.`
          : response.error === "invalid"
            ? "This requires the updated Pond desktop app. Pending bookmarks are retained."
            : "Open Pond to sync pending bookmarks.";
      return false;
    }
    return z.object({ id: z.string() }).safeParse(response.data).success;
  });
  await queueStorage.setValue({ ...result, generation: settings.generation });
  await bookmarkStatus.setValue({
    pending: result.pending.length,
    error,
    lastSync: Date.now(),
  });
}

function registerEvents(): void {
  // Register at startup so Chrome can wake the service worker for bookmark events.
  // Before the optional permission is granted this API may be unavailable.
  if (registered || !browser.bookmarks) return;
  registered = true;
  browser.bookmarks.onCreated.addListener(schedule);
  browser.bookmarks.onChanged.addListener(schedule);
  browser.bookmarks.onMoved.addListener(schedule);
  browser.bookmarks.onRemoved.addListener(schedule);
  browser.bookmarks.onImportEnded.addListener(schedule);
  browser.bookmarks.onChildrenReordered.addListener(schedule);
  schedule();
}

export function startBookmarkSync(): void {
  void browser.alarms.create(ALARM, { periodInMinutes: 1 });
  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM) schedule();
  });
  browser.permissions.onAdded.addListener(registerEvents);
  bookmarkSettings.watch(() => schedule());
  registerEvents();
}
