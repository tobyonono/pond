import { describe, expect, it, vi } from "vitest";
import { createInstagramRequestGate } from "./instagram-request-gate";

const request = { webContentsId: 7, resourceType: "xhr" };

describe("Instagram capture request gate", () => {
  it("waits for the governor on every page and serializes concurrent pages", async () => {
    const first = Promise.withResolvers<void>();
    const acquire = vi
      .fn()
      .mockImplementationOnce(() => first.promise)
      .mockResolvedValue(undefined);
    const gate = createInstagramRequestGate({ acquire, rateLimited: vi.fn() });
    gate.register(7);
    const replies = [vi.fn(), vi.fn()] as const;
    gate.beforeRequest(request, replies[0]);
    gate.beforeRequest(request, replies[1]);
    await Promise.resolve();
    expect(acquire).toHaveBeenCalledTimes(1);
    expect(replies[0]).not.toHaveBeenCalled();
    first.resolve();
    await vi.waitFor(() =>
      expect(replies[1]).toHaveBeenCalledExactlyOnceWith({ cancel: false }),
    );
    expect(acquire).toHaveBeenCalledTimes(2);
    expect(replies[0]).toHaveBeenCalledExactlyOnceWith({ cancel: false });
  });

  it("cancels a waiting request when its capture window is released", async () => {
    const waiting = Promise.withResolvers<void>();
    const gate = createInstagramRequestGate({
      acquire: () => waiting.promise,
      rateLimited: vi.fn(),
    });
    const release = gate.register(7);
    const reply = vi.fn();
    gate.beforeRequest(request, reply);
    await Promise.resolve();
    release();
    waiting.resolve();
    await vi.waitFor(() =>
      expect(reply).toHaveBeenCalledExactlyOnceWith({ cancel: true }),
    );
  });

  it("leaves normal browsing and image downloads alone", () => {
    const acquire = vi.fn();
    const gate = createInstagramRequestGate({ acquire, rateLimited: vi.fn() });
    gate.register(7);
    const reply = vi.fn();
    gate.beforeRequest({ ...request, webContentsId: 8 }, reply);
    gate.beforeRequest({ ...request, resourceType: "image" }, reply);
    expect(reply).toHaveBeenCalledTimes(2);
    expect(acquire).not.toHaveBeenCalled();
  });

  it("reports 429s and Retry-After even when a list already has partial results", () => {
    const rateLimited = vi.fn();
    const gate = createInstagramRequestGate({
      acquire: async () => {},
      rateLimited,
    });
    gate.register(7);
    gate.headersReceived({
      ...request,
      statusCode: 429,
      responseHeaders: { "Retry-After": ["3600"] },
    });
    gate.headersReceived({ ...request, statusCode: 200 });
    gate.headersReceived({ ...request, webContentsId: 8, statusCode: 429 });
    expect(rateLimited).toHaveBeenCalledExactlyOnceWith({
      "Retry-After": "3600",
    });
  });
});
