import { describe, expect, it, vi } from "vitest";
import type { ReferencePage } from "./listing";
import {
  referenceListingUrl,
  validReferencePageUrl,
  walkReferenceLibrary,
} from "./walk";

const page = (
  ids: string[],
  list: string,
  nextUrl: string | null = null,
): ReferencePage => ({
  ok: true,
  entries: ids.map((sourceId) => ({
    sourceId,
    url: `https://letterboxd.com/film/${sourceId}/`,
    collectionIds: [list],
  })),
  nextUrl,
  collections: [],
});

describe("reference account sync", () => {
  it("walks every source list and merges memberships of a film seen more than once", async () => {
    const read = vi.fn(async (_url: string, list: string) =>
      page([list === "diary" ? "watched" : list], list),
    );
    const result = await walkReferenceLibrary(
      "letterboxd",
      "person",
      { knownIds: [] },
      read,
    );
    expect(read.mock.calls.map((call) => call[1])).toEqual([
      "watchlist",
      "watched",
      "diary",
      "liked",
    ]);
    expect(result).toMatchObject({ ok: true, reachedEnd: true });
    if (result.ok)
      expect(
        result.entries.find((item) => item.sourceId === "watched")
          ?.collectionIds,
      ).toEqual(["watched", "diary"]);
  });
  it("respects selected lists and stops incremental reads separately for each list", async () => {
    const read = vi.fn(async (_url: string, list: string) =>
      page(["known"], list),
    );
    await walkReferenceLibrary(
      "letterboxd",
      "person",
      { knownIds: ["known"], earlyStop: true },
      read,
      [{ id: "watchlist", name: "Watchlist" }],
    );
    expect(read).toHaveBeenCalledTimes(1);
    expect(read.mock.calls[0]?.[1]).toBe("watchlist");
  });
  it("checkpoints an unfinished history and continues without skipping the next page", async () => {
    const read = vi.fn(async (url: string, list: string) => {
      const n = Number(url.match(/page\/(\d+)/)?.[1] ?? 1);
      return page(
        [`film${n}`],
        list,
        n < 22
          ? `https://letterboxd.com/person/watchlist/page/${n + 1}/`
          : null,
      );
    });
    const selected = [{ id: "watchlist", name: "Watchlist" }];
    const first = await walkReferenceLibrary(
      "letterboxd",
      "person",
      { knownIds: [] },
      read,
      selected,
    );
    expect(first).toMatchObject({ ok: true, reachedEnd: false });
    if (!first.ok || !first.resumeCursor)
      throw new Error("Expected checkpoint");
    const second = await walkReferenceLibrary(
      "letterboxd",
      "person",
      { knownIds: [], resumeCursor: first.resumeCursor },
      read,
      selected,
    );
    expect(second).toMatchObject({
      ok: true,
      reachedEnd: true,
      entries: [{ sourceId: "film21" }, { sourceId: "film22" }],
    });
  });
  it("surfaces sign-outs and rate limits without marking the history complete", async () => {
    for (const reason of ["auth_required", "rate_limited"] as const) {
      await expect(
        walkReferenceLibrary(
          "goodreads",
          "123",
          { knownIds: [] },
          async () => ({ ok: false, reason }),
        ),
      ).resolves.toEqual({ ok: false, reason });
    }
  });
  it("rejects cross-account, off-site and local-file pagination", () => {
    expect(
      validReferencePageUrl(
        "letterboxd",
        "person",
        "https://letterboxd.com/other/watchlist/page/2/",
      ),
    ).toBe(false);
    expect(
      validReferencePageUrl(
        "letterboxd",
        "person",
        "https://example.com/person/films/",
      ),
    ).toBe(false);
    expect(
      validReferencePageUrl("goodreads", "123", "file:///review/list_rss/123"),
    ).toBe(false);
    expect(referenceListingUrl("goodreads", "123", "to-read")).toContain(
      "shelf=to-read",
    );
  });
});
