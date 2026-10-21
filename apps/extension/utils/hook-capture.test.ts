import { describe, expect, it } from "vitest";
import {
  acceptHookCapture,
  acceptHookSourceChange,
  createRateLimit,
} from "./hook-capture";
import { DEFAULT_SETTINGS, type PondSettings } from "./types";

const POST = "https://x.com/pond/status/1";

function settings(change: Partial<PondSettings> = {}): PondSettings {
  return { ...DEFAULT_SETTINGS, ...change };
}

describe("acceptHookCapture", () => {
  it("passes a save from the site's own hook", () => {
    expect(
      acceptHookCapture(
        "twitter",
        { url: POST, trigger: "twitter:bookmark" },
        settings(),
      ),
    ).toEqual({ url: POST, trigger: "twitter:bookmark" });
  });

  it("rejects an item URL from another site", () => {
    expect(
      acceptHookCapture(
        "twitter",
        { url: "https://evil.example/x", trigger: "twitter:bookmark" },
        settings(),
      ),
    ).toBeNull();
  });

  it("rejects a trigger that belongs to another source", () => {
    expect(
      acceptHookCapture(
        "twitter",
        { url: POST, trigger: "reddit:save" },
        settings(),
      ),
    ).toBeNull();
    expect(acceptHookCapture("twitter", { url: POST }, settings())).toBeNull();
  });

  it("rejects plain http", () => {
    expect(
      acceptHookCapture(
        "twitter",
        { url: "http://x.com/pond/status/1", trigger: "twitter:bookmark" },
        settings(),
      ),
    ).toBeNull();
  });

  it("respects the source and likes settings", () => {
    const off = settings({
      enabled: { ...DEFAULT_SETTINGS.enabled, twitter: false },
    });
    expect(
      acceptHookCapture(
        "twitter",
        { url: POST, trigger: "twitter:bookmark" },
        off,
      ),
    ).toBeNull();

    const noLikes = settings({
      likes: { ...DEFAULT_SETTINGS.likes, twitter: false },
    });
    expect(
      acceptHookCapture(
        "twitter",
        { url: POST, trigger: "twitter:like" },
        noLikes,
      ),
    ).toBeNull();
    expect(
      acceptHookCapture(
        "twitter",
        { url: POST, trigger: "twitter:bookmark" },
        noLikes,
      ),
    ).not.toBeNull();
  });
});

describe("createRateLimit", () => {
  it("allows the limit within a window, then resets", () => {
    const allow = createRateLimit(2, 1000);
    expect(allow(0)).toBe(true);
    expect(allow(10)).toBe(true);
    expect(allow(20)).toBe(false);
    expect(allow(1000)).toBe(true);
  });
});

describe("reference source refresh notifications", () => {
  it("accepts only the enabled source belonging to the current page", () => {
    expect(acceptHookSourceChange("goodreads", "goodreads", settings())).toBe(
      "goodreads",
    );
    expect(
      acceptHookSourceChange("letterboxd", "goodreads", settings()),
    ).toBeNull();
    expect(
      acceptHookSourceChange("twitter", "goodreads", settings()),
    ).toBeNull();
    const disabled = settings();
    disabled.enabled.goodreads = false;
    expect(
      acceptHookSourceChange("goodreads", "goodreads", disabled),
    ).toBeNull();
  });
});
