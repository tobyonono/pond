import { describe, expect, it } from "vitest";
import { letterboxdSavedIds } from "./save-request";

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
