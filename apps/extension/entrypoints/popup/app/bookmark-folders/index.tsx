import { Button } from "@pond/ui/button";
import { Checkbox } from "@pond/ui/checkbox";
import { useEffect, useState } from "react";
import { z } from "zod";
import {
  type BookmarkFolderChoice,
  bookmarkFolderChoices,
} from "@/utils/bookmark-plan";
import { bookmarkSettings, bookmarkStatus } from "@/utils/bookmark-settings";
import { nativeCall } from "@/utils/native";
import styles from "./styles.module.css";

export function BookmarkFoldersPanel({ onBack }: { onBack: () => void }) {
  const [choices, setChoices] = useState<BookmarkFolderChoice[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [permission, setPermission] = useState(false);
  const [libraryName, setLibraryName] = useState("");
  const [status, setStatus] = useState<{
    pending: number;
    error: string | null;
    lastSync: number | null;
  }>({ pending: 0, error: null, lastSync: null });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void Promise.all([
      bookmarkSettings.getValue(),
      bookmarkStatus.getValue(),
      browser.permissions.contains({ permissions: ["bookmarks"] }),
    ])
      .then(async ([settings, current, allowed]) => {
        const folders = allowed
          ? bookmarkFolderChoices(await browser.bookmarks.getTree())
          : [];
        if (!active) return;
        setSelected(settings.folderIds);
        setEnabled(settings.enabled);
        setLibraryName(settings.libraryName);
        setStatus(current);
        setPermission(allowed);
        setChoices(folders);
      })
      .catch(() => {
        if (active) setError("Bookmark settings could not be loaded.");
      });
    const stop = bookmarkStatus.watch((current) => {
      if (active) setStatus(current);
    });
    return () => {
      active = false;
      stop();
    };
  }, []);

  async function allowBookmarks() {
    // Call directly from the click so Chrome retains the user gesture required for optional permissions.
    const granted = await browser.permissions.request({
      permissions: ["bookmarks"],
    });
    setPermission(granted);
    if (granted)
      setChoices(bookmarkFolderChoices(await browser.bookmarks.getTree()));
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const response = await nativeCall({ type: "library.info" });
      if (!response.ok)
        throw new Error("Open your destination Library in Pond first.");
      const library = z
        .object({ name: z.string(), path: z.string().min(1) })
        .parse(response.data);
      await bookmarkSettings.setValue({
        enabled: true,
        folderIds: selected,
        libraryPath: library.path,
        libraryName: library.name,
        generation: crypto.randomUUID(),
      });
      setEnabled(true);
      setLibraryName(library.name);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not enable bookmark sync.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function pause() {
    await bookmarkSettings.setValue({
      ...(await bookmarkSettings.getValue()),
      enabled: false,
    });
    setEnabled(false);
  }

  return (
    <div className={styles.panel}>
      <Button size="sm" variant="ghost" onClick={onBack}>
        Back
      </Button>
      <h1 className={styles.title}>Bookmark Folders</h1>
      <p>
        Select the Chrome folders to sync into Pond. Subfolders are included.
        Existing bookmarks are imported when you enable sync.
      </p>
      {!permission ? (
        <Button
          variant="secondary"
          onClick={() =>
            void allowBookmarks().catch(() =>
              setError("Bookmark access was not granted."),
            )
          }
        >
          Allow Bookmark Access
        </Button>
      ) : (
        <>
          <fieldset className={styles.folders}>
            <legend>Folders to sync</legend>
            {choices.map((folder) => (
              <label
                htmlFor={`bookmark-folder-${folder.id}`}
                key={folder.id}
                className={styles.folder}
              >
                <Checkbox.Root
                  id={`bookmark-folder-${folder.id}`}
                  checked={selected.includes(folder.id)}
                  disabled={busy}
                  onCheckedChange={(checked) =>
                    setSelected((current) =>
                      checked
                        ? [...current, folder.id]
                        : current.filter((id) => id !== folder.id),
                    )
                  }
                >
                  <Checkbox.Indicator />
                </Checkbox.Root>
                <span>{folder.label}</span>
              </label>
            ))}
          </fieldset>
          <Button
            disabled={!selected.length || busy}
            loading={busy}
            onClick={() => void save()}
          >
            Sync Selected Folders
          </Button>
        </>
      )}
      {enabled ? (
        <>
          <p role="status">
            Syncing to {libraryName}. {status.pending} pending.
          </p>
          <Button
            variant="secondary"
            onClick={() =>
              void pause().catch(() =>
                setError("Could not pause bookmark sync. Try again."),
              )
            }
          >
            Pause Sync
          </Button>
        </>
      ) : (
        <p>Automatic bookmark sync is paused.</p>
      )}
      {error || status.error ? (
        <p role="alert" className={styles.error}>
          {error ?? status.error}
        </p>
      ) : null}
      <p>
        Uses the updated Pond desktop app. Saved copies remain in Pond if you
        later remove a browser bookmark.
      </p>
    </div>
  );
}
