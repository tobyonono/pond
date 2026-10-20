import type { Capture } from "@pond/schema/raw";
import { sourceIdFromUrl } from "@pond/schema/sources";
import { describe, expect, it } from "vitest";
import { ReferenceExtractor } from "./reference";

describe("reference page capture", () => {
  it("uses Goodreads' numeric identity across slugged URLs", async () => {
    const url = "https://www.goodreads.com/book/show/4671.The_Great_Gatsby";
    const extractor = new ReferenceExtractor("goodreads", {
      page: async () => ({
        id: url,
        source: "web",
        url,
        title: "The Great Gatsby",
        media: [],
      }),
      tmdbKey: async () => null,
    });
    expect(await extractor.extract({ url: new URL(url) })).toMatchObject({
      id: "4671",
      source: "goodreads",
      title: "The Great Gatsby",
    });
    expect(
      sourceIdFromUrl("goodreads", "https://goodreads.com/book/show/4671"),
    ).toBe("4671");
  });

  it("collapses a member film URL and preserves the exact TMDB identity without a credential", async () => {
    const url = "https://letterboxd.com/member/film/perfect-days-2023/";
    const page: Capture = {
      id: url,
      source: "web",
      url,
      title: "Perfect Days (2023) directed by Wim Wenders",
      media: [],
      extras: { film: { tmdbId: 976893 } },
    };
    const extractor = new ReferenceExtractor("letterboxd", {
      page: async () => page,
      tmdbKey: async () => null,
    });
    expect(await extractor.extract({ url: new URL(url) })).toMatchObject({
      source: "letterboxd",
      id: "perfect-days-2023",
      url: "https://letterboxd.com/film/perfect-days-2023/",
      title: "Perfect Days",
      extras: { film: { tmdbId: 976893, year: "2023" } },
    });
  });

  it("rejects unrelated domains and a redirect to a non-film page", async () => {
    const extractor = new ReferenceExtractor("letterboxd", {
      page: async () => ({
        id: "home",
        source: "web",
        url: "https://letterboxd.com/",
        media: [],
      }),
      tmdbKey: async () => null,
    });
    expect(
      extractor.suitable(
        new URL("https://letterboxd.com.example.org/film/book/"),
      ),
    ).toBe(false);
    expect(
      extractor.suitable(new URL("https://letterboxd.com/member/watchlist/")),
    ).toBe(false);
    await expect(
      extractor.extract({ url: new URL("https://boxd.it/abcd") }),
    ).rejects.toThrow("did not resolve");
  });
});
