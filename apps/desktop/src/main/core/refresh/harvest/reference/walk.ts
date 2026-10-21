import type { ImportCollection } from "@pond/schema/db";
import { z } from "zod";
import type {
  ListEntry,
  ListHarvestArgs,
  ListHarvestResult,
} from "../list-types";
import type { ReferenceReply, ReferenceSyncSource } from "./listing";

const PAGE_SIZE = 100;
const PAGE_BUDGET = 20;
const CursorSchema = z.object({ list: z.string(), url: z.url() });
const FILM_LISTS = [
  { id: "watchlist", name: "Watchlist", path: "watchlist/" },
  { id: "watched", name: "Watched", path: "films/" },
  { id: "diary", name: "Diary / Logged", path: "diary/" },
  { id: "liked", name: "Liked Films", path: "likes/films/" },
] as const;

export function referenceCollections(): Array<
  ImportCollection & { itemCount: null }
> {
  return FILM_LISTS.map(({ id, name }) => ({ id, name, itemCount: null }));
}

export function referenceListingUrl(
  source: ReferenceSyncSource,
  handle: string,
  list: string,
): string {
  if (source === "goodreads") {
    if (!/^\d+$/.test(handle)) throw new Error("Invalid Goodreads account id");
    if (list === "collections")
      return `https://www.goodreads.com/review/list/${handle}?shelf=all`;
    const url = new URL(`https://www.goodreads.com/review/list_rss/${handle}`);
    url.search = new URLSearchParams({
      shelf: list,
      sort: "date_updated",
      order: "d",
      per_page: String(PAGE_SIZE),
      page: "1",
    }).toString();
    return url.href;
  }
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(handle))
    throw new Error("Invalid Letterboxd username");
  const path = FILM_LISTS.find((item) => item.id === list)?.path;
  if (!path) throw new Error("Unknown Letterboxd list");
  return `https://letterboxd.com/${handle}/${path}`;
}

export function validReferencePageUrl(
  source: ReferenceSyncSource,
  handle: string,
  input: string,
): boolean {
  try {
    const url = new URL(input);
    if (url.username || url.password || url.protocol !== "https:") return false;
    if (source === "goodreads")
      return (
        url.origin === "https://www.goodreads.com" &&
        (url.pathname === `/review/list_rss/${handle}` ||
          url.pathname === `/review/list/${handle}`)
      );
    return (
      url.origin === "https://letterboxd.com" &&
      url.pathname.startsWith(`/${handle}/`) &&
      /^\/(?:films|watchlist|diary|likes\/films)(?:\/|$)/.test(
        url.pathname.slice(handle.length + 1),
      )
    );
  } catch {
    return false;
  }
}

export async function walkReferenceLibrary(
  source: ReferenceSyncSource,
  handle: string,
  args: ListHarvestArgs & { freshLimit?: number },
  read: (url: string, list: string) => Promise<ReferenceReply>,
  selected?: readonly ImportCollection[],
): Promise<ListHarvestResult> {
  const lists =
    selected?.map((item) => item.id) ??
    (source === "goodreads" ? ["all"] : FILM_LISTS.map((item) => item.id));
  let cursor: z.infer<typeof CursorSchema> | null = null;
  if (args.resumeCursor) {
    try {
      cursor = CursorSchema.parse(JSON.parse(args.resumeCursor));
    } catch {
      cursor = null;
    }
    if (
      cursor &&
      (!lists.includes(cursor.list) ||
        !validReferencePageUrl(source, handle, cursor.url))
    )
      cursor = null;
  }
  const known = new Set(args.knownIds);
  const entries = new Map<string, ListEntry>();
  let pagesRead = 0;
  let freshRead = 0;
  for (
    let index = cursor ? lists.indexOf(cursor.list) : 0;
    index < lists.length;
    index++
  ) {
    const list = lists[index];
    if (!list) continue;
    let url =
      cursor?.list === list
        ? cursor.url
        : referenceListingUrl(source, handle, list);
    let knownPages = 0;
    const visited = new Set<string>();
    for (;;) {
      if (!validReferencePageUrl(source, handle, url) || visited.has(url))
        return { ok: false, reason: "no_match" };
      if (
        pagesRead >= PAGE_BUDGET ||
        (args.freshLimit !== undefined && freshRead >= args.freshLimit)
      )
        return {
          ok: true,
          entries: [...entries.values()],
          reachedEnd: false,
          resumeCursor: JSON.stringify({ list, url }),
        };
      visited.add(url);
      const result = await read(url, list);
      if (!result.ok) return result;
      pagesRead++;
      let fresh = 0;
      for (const item of result.entries) {
        if (!known.has(item.sourceId)) {
          fresh++;
          if (!entries.has(item.sourceId)) freshRead++;
        }
        const previous = entries.get(item.sourceId);
        entries.set(item.sourceId, {
          ...item,
          listKinds: [
            ...new Set([
              ...(previous?.listKinds ?? []),
              ...(item.listKinds ?? ["saved" as const]),
            ]),
          ],
          collectionIds: [
            ...new Set([
              ...(previous?.collectionIds ?? []),
              ...item.collectionIds,
            ]),
          ],
        });
      }
      knownPages =
        result.entries.length > 0 && fresh === 0 ? knownPages + 1 : 0;
      if (args.earlyStop && knownPages >= 2) break;
      let next = result.nextUrl;
      if (source === "goodreads" && result.entries.length >= PAGE_SIZE) {
        const nextUrl = new URL(url);
        nextUrl.searchParams.set(
          "page",
          String(Number(nextUrl.searchParams.get("page") ?? "1") + 1),
        );
        next = nextUrl.href;
      }
      if (!next) break;
      url = next;
    }
  }
  return { ok: true, entries: [...entries.values()], reachedEnd: true };
}
