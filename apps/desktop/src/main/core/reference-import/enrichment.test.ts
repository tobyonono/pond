import type { Capture } from "@pond/schema/raw";
import { describe, expect, it } from "vitest";
import { enrichBook, enrichFilm } from "./enrichment";

const film: Capture = {
  id: "perfect-days-2023",
  source: "letterboxd",
  url: "https://letterboxd.com/film/perfect-days-2023/",
  title: "Perfect Days",
  media: [],
  extras: { film: { year: "2023" } },
};

function service(responses: Record<string, Response>) {
  const requests: URL[] = [];
  const fetcher: typeof fetch = async (input) => {
    const url = new URL(String(input));
    requests.push(url);
    const response = responses[url.pathname];
    if (!response) throw new Error(`Unexpected request ${url.pathname}`);
    return response;
  };
  return { fetch: fetcher, requests, tmdbKey: "example-key" };
}

describe("reference enrichment", () => {
  it("uses the supplied TMDB ID without searching and retains enriched film identity", async () => {
    const dependencies = service({
      "/3/movie/976893": Response.json({
        id: 976893,
        title: "Perfect Days",
        release_date: "2023-11-10",
        overview: "An ordinary day.",
        poster_path: "/poster.jpg",
        runtime: 124,
        credits: { crew: [{ name: "Wim Wenders", job: "Director" }] },
      }),
    });
    const result = await enrichFilm(
      { ...film, extras: { film: { tmdbId: 976893 } } },
      dependencies,
    );
    expect(dependencies.requests.map((url) => url.pathname)).toEqual([
      "/3/movie/976893",
    ]);
    expect(result).toMatchObject({
      author: { name: "Wim Wenders" },
      description: "An ordinary day.",
      extras: {
        film: { tmdbId: 976893, runtime: 124, year: "2023", match: "matched" },
      },
      media: [{ url: "https://image.tmdb.org/t/p/w780/poster.jpg" }],
    });
  });

  it("selects only a unique title/year match, not the first search result", async () => {
    const dependencies = service({
      "/3/search/movie": Response.json({
        results: [
          { id: 1, title: "Perfect Days", release_date: "1999-01-01" },
          { id: 2, title: "Perfect Days", release_date: "2023-11-10" },
        ],
      }),
      "/3/movie/2": Response.json({
        id: 2,
        title: "Perfect Days",
        release_date: "2023-11-10",
      }),
    });
    expect((await enrichFilm(film, dependencies)).extras?.film?.tmdbId).toBe(2);
  });

  it("does not choose between ambiguous matches", async () => {
    const dependencies = service({
      "/3/search/movie": Response.json({
        results: [
          { id: 1, title: "Perfect Days", release_date: "2023-01-01" },
          { id: 2, title: "Perfect Days", release_date: "2023-12-01" },
        ],
      }),
    });
    expect((await enrichFilm(film, dependencies)).extras?.film?.match).toBe(
      "ambiguous",
    );
    expect(dependencies.requests).toHaveLength(1);
  });

  it("keeps the source metadata without a TMDB credential", async () => {
    const dependencies = service({});
    expect(await enrichFilm(film, { ...dependencies, tmdbKey: null })).toEqual(
      film,
    );
    expect(dependencies.requests).toHaveLength(0);
  });

  it("reports optional provider failures to the caller without exposing the key", async () => {
    const dependencies = service({
      "/3/search/movie": new Response("bad key", { status: 401 }),
    });
    await expect(enrichFilm(film, dependencies)).rejects.toThrow("HTTP 401");
  });

  it("reads Open Library's work description and preserves the ISBN cover", async () => {
    const dependencies = service({
      "/isbn/9780743273565.json": Response.json({
        works: [{ key: "/works/OL468516W" }],
      }),
      "/works/OL468516W.json": Response.json({
        description: { value: "A summer on Long Island." },
      }),
    });
    const book: Capture = {
      id: "4671",
      source: "goodreads",
      url: "https://www.goodreads.com/book/show/4671",
      media: [{ type: "image", url: "https://example.com/cover.jpg" }],
      extras: { book: { isbn: "9780743273565" } },
    };
    expect(await enrichBook(book, dependencies)).toMatchObject({
      description: "A summer on Long Island.",
      media: book.media,
    });
  });
});
