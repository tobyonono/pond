import { Button, Checkbox, Dialog, Field, Input } from "@pond/ui";
import type {
  ReferenceImportCounts,
  ReferenceImportPreview,
  ReferenceImportSource,
} from "@shared/reference-import-contracts";
import { useRef, useState } from "react";
import { folders } from "@/features/library/state/folders";
import { errorCopy } from "@/shared/lib/error-copy";
import styles from "./styles.module.css";

const LABELS = {
  goodreads: "Goodreads",
  letterboxd: "Letterboxd",
  bookmarks: "Bookmark Folders",
};
const HELP = {
  goodreads:
    "Choose your Goodreads library CSV, then pick the shelves to import. Books keep their ratings and reviews.",
  letterboxd:
    "Choose your unzipped Letterboxd export, or import recent activity using your username. RSS does not include your full watchlist.",
  bookmarks:
    "Choose a browser HTML export or Chromium Bookmarks file, then select folders. Selected folders include their subfolders.",
};

function folderLabel(
  folder: ReferenceImportPreview["folders"][number],
  all: ReferenceImportPreview["folders"],
): string {
  const byId = new Map(all.map((entry) => [entry.id, entry]));
  const labels: string[] = [];
  const seen = new Set<string>();
  for (
    let at: typeof folder | undefined = folder;
    at && !seen.has(at.id);
    at = at.parentId ? byId.get(at.parentId) : undefined
  ) {
    seen.add(at.id);
    labels.unshift(at.name);
  }
  return labels.join(" / ");
}

export function ReferenceImportDialog({
  source,
  open,
  onClose,
}: {
  source: ReferenceImportSource;
  open: boolean;
  onClose: () => void;
}) {
  const [preview, setPreview] = useState<ReferenceImportPreview | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [includeRoot, setIncludeRoot] = useState(true);
  const [username, setUsername] = useState("");
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReferenceImportCounts | null>(null);
  const running = useRef(false);

  async function run(action: () => Promise<void>) {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      await action();
    } catch (reason) {
      setError(errorCopy(reason, "The import could not be completed."));
    } finally {
      running.current = false;
      setBusy(false);
    }
  }

  async function choose() {
    await run(async () => {
      const picked = await window.pond.query("sources.previewImport", {
        source,
      });
      if (!picked) return;
      setPreview(picked);
      setSelected(picked.folders.map((folder) => folder.id));
      setIncludeRoot(true);
    });
  }

  async function importSelection(recent = false) {
    await run(async () => {
      if (source === "letterboxd" && key.trim()) {
        await window.pond.query("sources.setTmdbKey", { key: key.trim() });
        setKey("");
      }
      const imported = recent
        ? await window.pond.query("sources.importLetterboxdRss", {
            username: username.trim(),
          })
        : preview
          ? await window.pond.query("sources.importReferences", {
              source,
              path: preview.path,
              folderIds: selected,
              includeRoot,
            })
          : null;
      if (!imported) return;
      setResult(imported);
      await folders.refresh();
    });
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next && !running.current) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop />
        <Dialog.Popup>
          <Dialog.Header>
            <Dialog.Title>Import {LABELS[source]}</Dialog.Title>
          </Dialog.Header>
          <Dialog.Content className={styles.content}>
            <Dialog.Description>{HELP[source]}</Dialog.Description>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => void choose()}
            >
              {preview ? "Choose Another Export" : "Choose Export"}
            </Button>
            {preview ? (
              <div className={styles.selection}>
                <p>
                  {preview.name} · {preview.count}{" "}
                  {source === "goodreads"
                    ? "books"
                    : source === "letterboxd"
                      ? "films"
                      : "bookmarks"}
                </p>
                <div className={styles.actions}>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() =>
                      setSelected(preview.folders.map((folder) => folder.id))
                    }
                  >
                    Select All
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => {
                      setSelected([]);
                      setIncludeRoot(false);
                    }}
                  >
                    Clear
                  </Button>
                </div>
                <fieldset
                  className={styles.folders}
                  aria-label="Folders to import"
                >
                  {preview.folders.map((folder) => (
                    <label
                      className={styles.folder}
                      key={folder.id}
                      htmlFor={`reference-folder-${folder.id}`}
                    >
                      <Checkbox.Root
                        id={`reference-folder-${folder.id}`}
                        disabled={busy}
                        checked={selected.includes(folder.id)}
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
                      <span>{folderLabel(folder, preview.folders)}</span>
                    </label>
                  ))}
                  {preview.rootCount ? (
                    <label
                      className={styles.folder}
                      htmlFor="reference-unfiled"
                    >
                      <Checkbox.Root
                        id="reference-unfiled"
                        checked={includeRoot}
                        disabled={busy}
                        onCheckedChange={(checked) =>
                          setIncludeRoot(Boolean(checked))
                        }
                      >
                        <Checkbox.Indicator />
                      </Checkbox.Root>
                      <span>Outside folders ({preview.rootCount})</span>
                    </label>
                  ) : null}
                </fieldset>
              </div>
            ) : null}
            {source === "letterboxd" ? (
              <>
                <Field.Root>
                  <Field.Label>
                    TMDB API key or read access token (optional)
                  </Field.Label>
                  <Input.Root>
                    <Field.Control
                      render={<Input.Field />}
                      type="password"
                      autoComplete="off"
                      disabled={busy}
                      value={key}
                      onValueChange={setKey}
                      placeholder={
                        preview?.tmdbConfigured
                          ? "A credential is already saved"
                          : "Adds film posters and details"
                      }
                    />
                  </Input.Root>
                  <Field.Description>
                    Stored locally with Pond’s protected credentials. Your
                    existing key is used when this is empty.
                  </Field.Description>
                </Field.Root>
                <Field.Root>
                  <Field.Label>Letterboxd username</Field.Label>
                  <Input.Root>
                    <Field.Control
                      render={<Input.Field />}
                      disabled={busy}
                      value={username}
                      onValueChange={setUsername}
                      placeholder="Your public username"
                    />
                  </Input.Root>
                </Field.Root>
                <Button
                  variant="secondary"
                  disabled={
                    busy || !/^[A-Za-z0-9_-]{1,64}$/.test(username.trim())
                  }
                  onClick={() => void importSelection(true)}
                >
                  Import Recent Activity
                </Button>
              </>
            ) : null}
            {busy ? (
              <p role="status">
                Importing… You can continue browsing when this finishes.
              </p>
            ) : null}
            {error ? (
              <p className={styles.error} role="alert">
                {error}
              </p>
            ) : null}
            {result ? (
              <div role="status">
                <p>
                  {result.imported} imported · {result.skipped} already present
                  · {result.failed} failed
                </p>
                {result.warnings.length ? (
                  <p>
                    {result.warnings[0]}
                    {result.warnings.length > 1
                      ? ` ${result.warnings.length - 1} additional warnings.`
                      : null}
                  </p>
                ) : null}
              </div>
            ) : null}
          </Dialog.Content>
          <Dialog.Footer>
            <Button
              disabled={
                busy ||
                !preview ||
                (!selected.length && !(includeRoot && preview.rootCount))
              }
              loading={busy}
              onClick={() => void importSelection()}
            >
              Import Selected
            </Button>
          </Dialog.Footer>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
