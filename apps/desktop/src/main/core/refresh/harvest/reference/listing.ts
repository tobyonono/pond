/// <reference lib="dom" />

import { z } from "zod";

export const ReferenceSourceSchema = z.enum(["goodreads", "letterboxd"]);
export type ReferenceSyncSource = z.infer<typeof ReferenceSourceSchema>;
export const ReferencePageSchema = z.object({
  ok: z.literal(true),
  entries: z.array(
    z.object({
      sourceId: z.string(),
      url: z.url(),
      title: z.string().optional(),
      savedAt: z.string().optional(),
      collectionIds: z.array(z.string()),
      listKinds: z.array(z.enum(["saved", "liked"])).optional(),
    }),
  ),
  nextUrl: z.string().nullable(),
  collections: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      itemCount: z.number().nullable(),
    }),
  ),
});
export const ReferenceReplySchema = z.union([
  ReferencePageSchema,
  z.object({
    ok: z.literal(false),
    reason: z.enum(["auth_required", "rate_limited", "no_match", "unknown"]),
    retryAfterSec: z.number().optional(),
  }),
]);
export type ReferencePage = z.infer<typeof ReferencePageSchema>;
export type ReferenceReply = z.infer<typeof ReferenceReplySchema>;

export function buildReferenceListingExpression(
  source: ReferenceSyncSource,
  url: string,
  collection: string,
): string {
  return `(${readListing.toString()})(${JSON.stringify(source)}, ${JSON.stringify(url)}, ${JSON.stringify(collection)})`;
}

async function readListing(
  source: ReferenceSyncSource,
  url: string,
  collection: string,
): Promise<ReferenceReply> {
  const response = await fetch(url, { credentials: "include" });
  if (response.status === 401 || response.status === 403)
    return { ok: false, reason: "auth_required" };
  if (response.status === 429) {
    const limited: Extract<ReferenceReply, { ok: false }> = {
      ok: false,
      reason: "rate_limited",
    };
    const header = response.headers.get("retry-after");
    if (header) {
      const value = Number(header);
      const seconds = Number.isFinite(value)
        ? value
        : (Date.parse(header) - Date.now()) / 1000;
      if (Number.isFinite(seconds))
        limited.retryAfterSec = Math.max(0, seconds);
    }
    return limited;
  }
  if (!response.ok) return { ok: false, reason: "unknown" };
  if (
    /\/(?:user\/sign_in|accounts\/login|sign-in)(?:\/|\?|$)/.test(response.url)
  )
    return { ok: false, reason: "auth_required" };
  const body = await response.text();
  if (/<!DOCTYPE\s+[^>]*(?:\[|ENTITY)|<!ENTITY/i.test(body))
    return { ok: false, reason: "no_match" };
  const rss = source === "goodreads" && collection !== "collections";
  const doc = new DOMParser().parseFromString(
    body,
    rss ? "application/xml" : "text/html",
  );
  const entries: ReferencePage["entries"] = [];
  const collections: ReferencePage["collections"] = [];
  if (rss) {
    if (!doc.querySelector("rss > channel") || doc.querySelector("parsererror"))
      return { ok: false, reason: "no_match" };
    for (const item of doc.querySelectorAll("item")) {
      const text = (name: string) =>
        item.getElementsByTagName(name)[0]?.textContent?.trim() ?? "";
      const id = text("book_id");
      if (!/^\d+$/.test(id)) continue;
      const shelves = text("user_shelves")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const entry: ReferencePage["entries"][number] = {
        sourceId: id,
        url: `https://www.goodreads.com/book/show/${id}`,
        title: text("title"),
        collectionIds: shelves.length ? shelves : [collection],
        listKinds: ["saved"],
      };
      const date = new Date(text("user_date_added"));
      if (Number.isFinite(date.getTime())) entry.savedAt = date.toISOString();
      entries.push(entry);
    }
    return { ok: true, entries, nextUrl: null, collections };
  }
  if (source === "goodreads") {
    const names = new Map<string, string>([
      ["to-read", "Want to Read"],
      ["currently-reading", "Currently Reading"],
      ["read", "Read"],
    ]);
    for (const link of doc.querySelectorAll<HTMLAnchorElement>(
      'a[href*="shelf="]',
    )) {
      const target = new URL(link.getAttribute("href") ?? "", url);
      const page = new URL(url);
      const id = target.searchParams.get("shelf");
      const name = link.textContent
        ?.replace(/[\u200e\u200f]/g, "")
        .replace(/\s*\([\d,]+\)\s*$/, "")
        .trim();
      if (
        !id ||
        /^(?:all|#all#)$/i.test(id) ||
        target.origin !== page.origin ||
        target.pathname !== page.pathname ||
        link.closest("#books, #booksBody") ||
        !name ||
        !/[\p{L}\p{N}]/u.test(name) ||
        names.has(id)
      )
        continue;
      names.set(id, name);
    }
    if (
      !doc.querySelector(
        '#books, #booksBody, .shelf, #shelves, a[href*="shelf="]',
      )
    )
      return { ok: false, reason: "no_match" };
    for (const [id, name] of names)
      collections.push({ id, name, itemCount: null });
    return { ok: true, entries, nextUrl: null, collections };
  }
  const seen = new Set<string>();
  for (const node of doc.querySelectorAll<HTMLElement>(
    '[data-item-link^="/film/"], [data-film-slug]',
  )) {
    if (
      !node.closest(
        ".poster-list, .poster-grid, .grid, .diary-table, .diary-entry-row, .film-list, .list-set",
      )
    )
      continue;
    const path =
      node.getAttribute("data-item-link") ??
      `/film/${node.getAttribute("data-film-slug")}/`;
    const id = path.match(/^\/film\/([^/?#]+)\/?$/)?.[1];
    if (!id || seen.has(id)) continue;
    seen.add(id);
    entries.push({
      sourceId: id,
      url: `https://letterboxd.com/film/${id}/`,
      title:
        node.getAttribute("data-item-name") ??
        node.querySelector("img")?.getAttribute("alt") ??
        undefined,
      collectionIds:
        collection === "diary" ? ["diary", "watched"] : [collection],
      listKinds: collection === "liked" ? ["liked"] : ["saved"],
    });
  }
  if (
    entries.length === 0 &&
    !doc.querySelector(
      ".empty-text, .poster-list, .poster-grid, .diary-table, .film-list",
    )
  )
    return { ok: false, reason: "no_match" };
  const next = doc
    .querySelector<HTMLAnchorElement>(
      '.paginate-nextprev a.next, a[rel="next"]',
    )
    ?.getAttribute("href");
  return {
    ok: true,
    entries,
    nextUrl: next ? new URL(next, url).href : null,
    collections,
  };
}
