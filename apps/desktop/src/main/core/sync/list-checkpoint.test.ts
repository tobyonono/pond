import { describe, expect, it } from "vitest";
import { listSyncCheckpoint } from "./list-checkpoint";

describe("list sync checkpoint", () => {
  it("keeps the current cursor and full-history flag while a batch still has unqueued items", () => {
    expect(listSyncCheckpoint({ reachedEnd: true }, 150, 200)).toEqual({
      reachedEnd: false,
      resumeCursor: undefined,
    });
    expect(
      listSyncCheckpoint({ reachedEnd: false, resumeCursor: "next" }, 150, 200),
    ).toEqual({ reachedEnd: false, resumeCursor: undefined });
  });
  it("advances only after all fresh items in the page were queued", () => {
    expect(
      listSyncCheckpoint({ reachedEnd: false, resumeCursor: "next" }, 150, 150),
    ).toEqual({ reachedEnd: false, resumeCursor: "next" });
    expect(listSyncCheckpoint({ reachedEnd: true }, 0, 0)).toEqual({
      reachedEnd: true,
      resumeCursor: null,
    });
  });
});
