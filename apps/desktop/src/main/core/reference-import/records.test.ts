import { describe, expect, it } from "vitest";
import {
  csvRecords,
  parseGoodreadsExport,
  parseLetterboxdExport,
  parseLetterboxdRss,
} from "./records";

describe("reference exports", () => {
  it("reads BOM, multiline reviews, escaped quotes and ISBN formula wrappers", () => {
    const records = parseGoodreadsExport(
      '\uFEFFBook Id,Title,Author,ISBN13,My Rating,Exclusive Shelf,Bookshelves,My Review,Date Added\r\n4671,"The Great, Gatsby",Fitzgerald,"=""9780743273565""",4,read,"read, favourites","A ""quiet""\nnight",2026/10/20',
    );
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      capture: {
        id: "4671",
        title: "The Great, Gatsby",
        author: { name: "Fitzgerald" },
        extras: { book: { isbn: "9780743273565" } },
      },
      folders: ["Goodreads/read", "Goodreads/favourites"],
      rating: 4,
      note: 'A "quiet"\nnight',
      savedAt: new Date("2026-10-20T00:00:00Z"),
    });
  });

  it("rejects the wrong export and truncated quoted data", () => {
    expect(() =>
      parseGoodreadsExport("Name,URL\nA,https://example.com"),
    ).toThrow("Book Id");
    expect(() => csvRecords('Title\n"unfinished', ["Title"])).toThrow(
      "unterminated",
    );
  });

  it("ignores invalid rows and deduplicates books while retaining shelf membership", () => {
    const records = parseGoodreadsExport(
      "Book Id,Title,Author,Exclusive Shelf,My Rating\n1,Book,Author,read,6\n1,Book,Author,favourites,4\ninvalid,Other,Author,read,3\n2,,Author,read,3",
    );
    expect(records).toHaveLength(1);
    expect(records[0]?.folders).toEqual([
      "Goodreads/read",
      "Goodreads/favourites",
    ]);
    expect(records[0]?.rating).toBe(4);
  });

  it("merges films across watched, watchlist and ratings without collapsing remakes", () => {
    const header = "Date,Name,Year,Letterboxd URI";
    const records = parseLetterboxdExport([
      {
        name: "watched.csv",
        text: `${header}\n2026-10-20,Suspiria,1977,https://boxd.it/one\n2026-10-20,Suspiria,2018,https://boxd.it/two`,
      },
      {
        name: "watchlist.csv",
        text: `${header}\n2026-10-20,Suspiria,1977,https://boxd.it/one`,
      },
      {
        name: "ratings.csv",
        text: `${header},Rating\n2026-10-20,Suspiria,1977,https://boxd.it/one,4.5`,
      },
    ]);
    expect(records).toHaveLength(2);
    expect(records[0]).toMatchObject({
      folders: [
        "Letterboxd/watched",
        "Letterboxd/watchlist",
        "Letterboxd/rated",
      ],
      rating: 4.5,
      capture: { extras: { film: { year: "1977" } } },
    });
  });

  it("reads custom-list metadata before the CSV header and ignores non-web URLs", () => {
    const records = parseLetterboxdExport([
      {
        name: "lists/Favourites.csv",
        text: "Letterboxd list export\nName,Year,Letterboxd URI\nFilm,2020,https://letterboxd.com/film/film/\nBad,2020,javascript:alert(1)",
      },
    ]);
    expect(records).toHaveLength(1);
    expect(records[0]?.folders).toEqual(["Letterboxd/Favourites"]);
  });

  it("extracts RSS film identity, TMDB ID and poster without treating a list as a film", () => {
    const records = parseLetterboxdRss(
      `<rss><channel><item><link>https://letterboxd.com/person/film/perfect-days-2023/</link><letterboxd:filmTitle><![CDATA[Perfect Days]]></letterboxd:filmTitle><letterboxd:filmYear>2023</letterboxd:filmYear><tmdb:movieId>976893</tmdb:movieId><letterboxd:memberRating>4.5</letterboxd:memberRating><letterboxd:watchedDate>2026-10-20</letterboxd:watchedDate><description><![CDATA[<img src="https://example.com/poster.jpg">]]></description></item><item><title>A list</title></item></channel></rss>`,
    );
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      capture: {
        title: "Perfect Days",
        extras: { film: { tmdbId: 976893, year: "2023" } },
        media: [{ type: "image", url: "https://example.com/poster.jpg" }],
      },
      rating: 4.5,
    });
  });

  it("rejects unexpected feeds and entity declarations", () => {
    expect(() => parseLetterboxdRss("<html>Login</html>")).toThrow("RSS");
    expect(() =>
      parseLetterboxdRss(
        '<!DOCTYPE rss [<!ENTITY test SYSTEM "file:///etc/passwd">]><rss/>',
      ),
    ).toThrow("RSS");
  });
});
