import { ExtensionSettingsSchema } from "@pond/schema/browser-extension";
import { nativeRequestSchema } from "@pond/schema/native";
import { describe, expect, it, vi } from "vitest";
import { UnsupportedError } from "../core/pipeline/extractors/errors";
import { dispatchNative, type NativePorts } from "./rpc";

function ports(overrides: Partial<NativePorts> = {}): NativePorts {
  return {
    enqueue: vi.fn(),
    libraryInfo: vi.fn(),
    sessionPending: vi.fn(() => null),
    sessionImport: vi.fn(),
    appVersion: () => "0.0.1",
    ...overrides,
  };
}

describe("nativeRequestSchema", () => {
  it("accepts hello", () => {
    expect(nativeRequestSchema.parse({ type: "hello" })).toEqual({
      type: "hello",
    });
  });

  it("accepts an enqueue from a site intercept", () => {
    const row = nativeRequestSchema.parse({
      type: "enqueue",
      url: "https://x.com/i/web/status/1",
      trigger: "twitter:bookmark",
    });
    expect(row).toMatchObject({ type: "enqueue", trigger: "twitter:bookmark" });
  });
});

describe("dispatchNative", () => {
  it("queues a reference source refresh without creating an account or accepting another source", async () => {
    const sourceChanged = vi.fn();
    const services = ports({ sourceChanged });
    await expect(
      dispatchNative({ type: "source.changed", source: "goodreads" }, services),
    ).resolves.toEqual({ ok: true, data: { queued: true } });
    expect(sourceChanged).toHaveBeenCalledExactlyOnceWith("goodreads");
    await expect(
      dispatchNative({ type: "source.changed", source: "instagram" }, services),
    ).resolves.toEqual({ ok: false, error: "invalid" });
    expect(sourceChanged).toHaveBeenCalledTimes(1);
    expect(services.sessionImport).not.toHaveBeenCalled();
  });
  it("rejects automatic bookmarks when a different Library is active", async () => {
    const captureBookmark = vi
      .fn()
      .mockResolvedValue({ id: "01", created: true });
    const result = await dispatchNative(
      {
        type: "bookmarks.capture",
        libraryPath: "/wanted.pond",
        url: "https://example.com/book",
        title: "Book",
        folderPath: ["References"],
      },
      ports({
        captureBookmark,
        libraryInfo: vi.fn().mockResolvedValue({ path: "/other.pond" }),
      }),
    );
    expect(result).toEqual({ ok: false, error: "library_changed" });
    expect(captureBookmark).not.toHaveBeenCalled();
  });

  it("passes a selected bookmark to the Library capture operation", async () => {
    const captureBookmark = vi
      .fn()
      .mockResolvedValue({ id: "01", created: true });
    const input = {
      type: "bookmarks.capture",
      libraryPath: "/wanted.pond",
      url: "https://example.com/book",
      title: "Book",
      folderPath: ["References"],
    };
    expect(
      await dispatchNative(
        input,
        ports({
          captureBookmark,
          libraryInfo: vi.fn().mockResolvedValue({ path: "/wanted.pond" }),
        }),
      ),
    ).toEqual({ ok: true, data: { id: "01", created: true } });
    expect(captureBookmark).toHaveBeenCalledWith(input);
  });
  it("rejects an invalid payload", async () => {
    await expect(dispatchNative({ type: "nope" }, ports())).resolves.toEqual({
      ok: false,
      error: "invalid",
    });
  });

  it("answers hello with the app version", async () => {
    await expect(dispatchNative({ type: "hello" }, ports())).resolves.toEqual({
      ok: true,
      data: { app: "pond", version: "0.0.1" },
    });
  });

  it("enqueues through the injected port", async () => {
    const enqueue = vi.fn().mockResolvedValue({ id: "01", created: true });
    const result = await dispatchNative(
      {
        type: "enqueue",
        url: "https://x.com/i/web/status/1",
        trigger: "toolbar",
      },
      ports({ enqueue }),
    );
    expect(result).toEqual({ ok: true, data: { id: "01", created: true } });
    expect(enqueue).toHaveBeenCalledWith("https://x.com/i/web/status/1", {
      trigger: "toolbar",
    });
  });

  it("maps UnsupportedError to unsupported_url", async () => {
    const enqueue = vi
      .fn()
      .mockRejectedValue(new UnsupportedError("no extractor matches url"));
    await expect(
      dispatchNative(
        { type: "enqueue", url: "https://example.invalid/x" },
        ports({ enqueue }),
      ),
    ).resolves.toEqual({ ok: false, error: "unsupported_url" });
  });

  it("returns library.info from the injected port", async () => {
    const libraryInfo = vi.fn().mockResolvedValue({ name: "Library" });
    await expect(
      dispatchNative({ type: "library.info" }, ports({ libraryInfo })),
    ).resolves.toEqual({ ok: true, data: { name: "Library" } });
  });

  it("returns folders.list from the injected port", async () => {
    const folder = { id: "refs", name: "Refs", parentId: null, color: null };
    const foldersList = vi.fn().mockResolvedValue([folder]);
    await expect(
      dispatchNative({ type: "folders.list" }, ports({ foldersList })),
    ).resolves.toEqual({ ok: true, data: [folder] });
  });

  it("returns tags.list from the injected port", async () => {
    const tag = { name: "pond", starred: true, usageCount: 3, lastUsedAt: 1 };
    const tagsList = vi.fn().mockResolvedValue([tag]);
    await expect(
      dispatchNative({ type: "tags.list" }, ports({ tagsList })),
    ).resolves.toEqual({ ok: true, data: [tag] });
  });

  it("reports tags.list as unavailable without a port", async () => {
    await expect(
      dispatchNative({ type: "tags.list" }, ports()),
    ).resolves.toEqual({ ok: false, error: "tags_unavailable" });
  });

  it("returns the browser extension settings from the injected port", async () => {
    const settings = ExtensionSettingsSchema.parse({ altClick: false });
    const extensionSettings = vi.fn().mockResolvedValue(settings);
    await expect(
      dispatchNative(
        { type: "extension.settings" },
        ports({ extensionSettings }),
      ),
    ).resolves.toEqual({ ok: true, data: settings });
  });

  it("reports extension.settings as unavailable without a port", async () => {
    await expect(
      dispatchNative({ type: "extension.settings" }, ports()),
    ).resolves.toEqual({ ok: false, error: "settings_unavailable" });
  });

  it("reads a capture receipt by draft id", async () => {
    const receipt = {
      id: "draft-1",
      library: "/library",
      state: "complete" as const,
      completed: 1,
      total: 1,
      saveIds: ["save-1"],
      duplicateCount: 0,
    };
    const captureStatus = vi.fn().mockResolvedValue(receipt);
    await expect(
      dispatchNative(
        { type: "capture.status", id: "draft-1" },
        ports({ captureStatus }),
      ),
    ).resolves.toEqual({ ok: true, data: receipt });
    expect(captureStatus).toHaveBeenCalledWith("draft-1");
  });

  it("rejects a capture status id outside the draft id format", async () => {
    await expect(
      dispatchNative({ type: "capture.status", id: "../x" }, ports()),
    ).resolves.toEqual({ ok: false, error: "invalid" });
  });
});
