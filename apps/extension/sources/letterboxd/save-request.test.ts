import { describe, expect, it } from "vitest";
import { letterboxdActivityIds, letterboxdSavedIds } from "./save-request";

describe("Letterboxd watchlist capture", () => {
  it("captures current watchlist additions and ignores removals", () => {
    const url = "https://api.letterboxd.com/api/v0/me/watchlist/ATh8";
    expect(
      letterboxdSavedIds(url, "PATCH", '{"inWatchlist":true}', {}),
    ).toEqual(["ATh8"]);
    expect(
      letterboxdSavedIds(url, "PATCH", '{"inWatchlist":false}', {}),
    ).toEqual([]);
    expect(letterboxdSavedIds(url, "GET", null, {})).toEqual([]);
    expect(
      letterboxdSavedIds(url, "PATCH", '{"inWatchlist":true}', {
        errors: ["rejected"],
      }),
    ).toEqual([]);
  });

  it("captures batch additions without recording a failed response", () => {
    const body = new URLSearchParams({
      entries: JSON.stringify([
        { production: { lid: "ATh8" } },
        { production: "2b0E" },
      ]),
    }).toString();
    expect(
      letterboxdSavedIds("/watchlist/add-films/", "POST", body, {
        result: true,
      }),
    ).toEqual(["ATh8", "2b0E"]);
    expect(
      letterboxdSavedIds("/watchlist/add-films/", "POST", body, {
        result: false,
      }),
    ).toEqual([]);
  });

  it("ignores unrelated or malformed mutations", () => {
    expect(
      letterboxdSavedIds(
        "/watchlist/add-films/",
        "POST",
        "entries=invalid",
        {},
      ),
    ).toEqual([]);
    expect(
      letterboxdSavedIds(
        "/me/watchlist/ATh8",
        "PATCH",
        '{"somethingElse":true}',
        {},
      ),
    ).toEqual([]);
    expect(
      letterboxdSavedIds("/me/likes/ATh8", "PATCH", '{"inWatchlist":true}', {}),
    ).toEqual([]);
  });
});

describe("Letterboxd watched and logged capture", () => {
  it("captures a confirmed watched toggle and ignores unwatch and failed requests", () => {
    expect(
      letterboxdActivityIds("/s/film:738292/watch/", "POST", "watched=true", {
        result: true,
        watched: true,
      }),
    ).toEqual([{ id: "film:738292", trigger: "watched" }]);
    expect(
      letterboxdActivityIds("/s/film:738292/watch/", "POST", "watched=false", {
        result: true,
        watched: false,
      }),
    ).toEqual([]);
    expect(
      letterboxdActivityIds("/s/film:738292/watch/", "POST", "watched=true", {
        result: false,
      }),
    ).toEqual([]);
  });
  it("captures a logged film and excludes drafts and non-film productions", () => {
    expect(
      letterboxdActivityIds(
        "/s/save-diary-entry",
        "POST",
        "viewingableUid=film%3A738292&specifiedDate=true",
        { result: true },
      ),
    ).toEqual([{ id: "film:738292", trigger: "diary" }]);
    expect(
      letterboxdActivityIds(
        "/s/save-diary-entry",
        "POST",
        "viewingableUid=film%3A738292&draft=true",
        { result: true },
      ),
    ).toEqual([]);
    expect(
      letterboxdActivityIds(
        "/s/save-diary-entry",
        "POST",
        "viewingableUid=series%3A738292",
        { result: true },
      ),
    ).toEqual([]);
  });
});
