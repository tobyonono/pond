import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { NewSave } from "@pond/schema/db";
import type { Capture } from "@pond/schema/raw";
import { sourceIdFromUrl } from "@pond/schema/sources";
import { userError } from "../../../shared/user-error";
import { getSecret } from "../../keychain";
import { libraryRoot } from "../../paths";
import { withMutationScope } from "../executor";
import { addSavesToFolder, importFolderTree } from "../folders";
import { persistSave } from "../persist-save";
import { type EnqueueOneResult, enqueue } from "../pipeline/enqueue";
import { acquire } from "../pipeline/rate-governor";
import type { EnqueueSeed } from "../pipeline/seed";
import { enrichBook, enrichFilm } from "./enrichment";
import {
  parseGoodreadsExport,
  parseLetterboxdExport,
  parseLetterboxdRss,
  type ReferenceRecord,
} from "./records";

export interface ReferenceImportResult {
  imported: number;
  skipped: number;
  failed: number;
  warnings: string[];
}

export interface ReferenceImportDependencies {
  library: () => string;
  write: <T>(operation: () => Promise<T>) => Promise<T>;
  enqueue: (capture: Capture, seed: EnqueueSeed) => Promise<EnqueueOneResult>;
  persist: (id: string, patch: Partial<NewSave>) => Promise<void>;
  file: (id: string, folders: string[]) => Promise<void>;
  enrich: (capture: Capture) => Promise<Capture>;
}

async function fileReference(id: string, paths: string[]): Promise<void> {
  const nodes = new Map<
    string,
    { id: string; name: string; parentId: string | null; sortOrder: number }
  >();
  for (const path of paths) {
    let parentId: string | null = null;
    // Shelf/list names are labels, not filesystem paths; only the Source prefix is hierarchical.
    const slash = path.indexOf("/");
    for (const name of [path.slice(0, slash), path.slice(slash + 1)]) {
      const key: string = parentId ? `${parentId}/${name}` : name;
      nodes.set(key, { id: key, name, parentId, sortOrder: nodes.size });
      parentId = key;
    }
  }
  const mapping = await importFolderTree([...nodes.values()], true);
  for (const path of paths) {
    const folderId = mapping.get(path);
    if (folderId) await addSavesToFolder(folderId, [id]);
  }
}

async function defaultEnrichment(capture: Capture): Promise<Capture> {
  if (capture.source === "goodreads") return enrichBook(capture, { fetch });
  let url = capture.url;
  await acquire("letterboxd", { maxWaitMs: 15_000 });
  // Exports use short links; RSS links point at a user's review. Both resolve to one film URL.
  const response = await fetch(url, {
    signal: AbortSignal.timeout(15_000),
    redirect: "follow",
  });
  if (!response.ok)
    throw new Error(`Letterboxd returned HTTP ${response.status}.`);
  const html = await response.text();
  const canonical = html.match(
    /<link\b[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)/i,
  )?.[1];
  url = canonical ?? response.url;
  url = url.replace(
    /^(https?:\/\/(?:www\.)?letterboxd\.com)\/[^/]+\/film\//,
    "$1/film/",
  );
  if (!/^https:\/\/(?:www\.)?letterboxd\.com\/film\//.test(url))
    throw new Error("The film URL could not be resolved.");
  const tmdbId =
    capture.extras?.film?.tmdbId ??
    Number(
      /data-tmdb-type=["']movie["']/.test(html)
        ? html.match(/data-tmdb-id=["'](\d+)/)?.[1]
        : undefined,
    );
  const resolved: Capture = {
    ...capture,
    url,
    id: sourceIdFromUrl("letterboxd", url) ?? capture.id,
    extras: {
      ...capture.extras,
      film: {
        ...capture.extras?.film,
        tmdbId: Number.isInteger(tmdbId) && tmdbId > 0 ? tmdbId : undefined,
      },
    },
  };
  try {
    return await enrichFilm(resolved, {
      fetch,
      tmdbKey: (await getSecret("reference:tmdb")) ?? process.env.TMDB_API_KEY,
    });
  } catch {
    return resolved;
  }
}

const defaults: ReferenceImportDependencies = {
  library: libraryRoot,
  write: withMutationScope,
  enqueue: (capture, seed) =>
    enqueue(capture.url, {
      seed,
      trigger: `user:import:${capture.source}`,
      listKinds: ["saved"],
    }),
  persist: async (id, patch) => {
    await persistSave(id, patch, { actorReason: "reference:import" });
  },
  file: fileReference,
  enrich: defaultEnrichment,
};

export async function importReferences(
  records: ReferenceRecord[],
  dependencies = defaults,
): Promise<ReferenceImportResult> {
  const library = dependencies.library();
  const result: ReferenceImportResult = {
    imported: 0,
    skipped: 0,
    failed: 0,
    warnings: [],
  };
  for (const record of records) {
    if (dependencies.library() !== library) {
      result.failed +=
        records.length - result.imported - result.skipped - result.failed;
      result.warnings.push(
        "The active Library changed. Import stopped; select the export again in the intended Library.",
      );
      break;
    }
    let capture = record.capture;
    try {
      capture = await dependencies.enrich(capture);
    } catch {
      result.warnings.push(
        `Optional enrichment unavailable for ${capture.title ?? capture.url}.`,
      );
    }
    // A short link is a valid source identity, but a user-review URL must collapse to its film.
    const identity = sourceIdFromUrl(capture.source, capture.url);
    if (!identity) {
      result.failed += 1;
      continue;
    }
    const seed: EnqueueSeed = {
      rawJson: {
        capture: { ...capture, id: identity },
        extractorId: `${capture.source}-reference`,
        extractedAt: new Date().toISOString(),
      },
      title: capture.title,
      description: capture.description,
      author: capture.author?.name,
      mediaUrl: capture.media[0]?.url,
      mediaType: "link",
    };
    try {
      const created = await dependencies.write(async () => {
        if (dependencies.library() !== library)
          throw new Error("The active Library changed.");
        const saved = await dependencies.enqueue(capture, seed);
        if (saved.created) {
          const patch: Partial<NewSave> = {};
          if (record.rating !== undefined) patch.rating = record.rating;
          if (record.note) patch.notes = record.note;
          if (record.savedAt) {
            patch.savedAt = record.savedAt;
            patch.createdAt = record.savedAt;
          }
          if (Object.keys(patch).length)
            await dependencies.persist(saved.id, patch);
        }
        // Re-imports may add a newly discovered shelf without replacing user memberships.
        await dependencies.file(saved.id, record.folders);
        return saved.created;
      });
      if (created) result.imported += 1;
      else result.skipped += 1;
    } catch {
      result.failed += 1;
    }
  }
  return result;
}

export async function readReferenceExport(
  source: "goodreads" | "letterboxd",
  path: string,
): Promise<ReferenceRecord[]> {
  if (source === "goodreads")
    return parseGoodreadsExport(await readFile(path, "utf8"));
  const files: { name: string; text: string }[] = [];
  for (const name of [
    "watched.csv",
    "watchlist.csv",
    "diary.csv",
    "ratings.csv",
    "likes/films.csv",
  ]) {
    try {
      files.push({ name, text: await readFile(join(path, name), "utf8") });
    } catch (error) {
      if (
        !(error instanceof Error && "code" in error && error.code === "ENOENT")
      )
        throw error;
    }
  }
  try {
    for (const entry of await readdir(join(path, "lists"), {
      withFileTypes: true,
    })) {
      if (entry.isFile() && entry.name.endsWith(".csv"))
        files.push({
          name: `lists/${entry.name}`,
          text: await readFile(join(path, "lists", entry.name), "utf8"),
        });
    }
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT"))
      throw error;
  }
  if (!files.length)
    throw userError(
      "Choose the unzipped Letterboxd export folder containing watched.csv or watchlist.csv.",
    );
  return parseLetterboxdExport(files);
}

export async function readLetterboxdFeed(
  username: string,
): Promise<ReferenceRecord[]> {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(username))
    throw userError("Enter a Letterboxd username.");
  await acquire("letterboxd", { maxWaitMs: 15_000 });
  const response = await fetch(`https://letterboxd.com/${username}/rss/`, {
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok)
    throw userError(`The Letterboxd feed returned HTTP ${response.status}.`);
  return parseLetterboxdRss(await response.text());
}
