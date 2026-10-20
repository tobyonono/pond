import { describe, expect, it } from "vitest";
import {
  type BookmarkNode,
  bookmarkFolderChoices,
  drainBookmarkQueue,
  planBookmarkQueue,
  selectedBookmarks,
} from "./bookmark-plan";

const tree: BookmarkNode[] = [
  {
    id: "0",
    title: "",
    children: [
      {
        id: "1",
        title: "Bookmarks bar",
        children: [
          {
            id: "2",
            title: "References",
            children: [
              { id: "3", title: "Book", url: "https://example.com/book" },
              {
                id: "4",
                title: "Films",
                children: [
                  { id: "5", title: "Film", url: "https://example.com/film" },
                ],
              },
              { id: "6", title: "Internal", url: "chrome://settings" },
            ],
          },
          {
            id: "7",
            title: "Private",
            children: [
              { id: "8", title: "Other", url: "https://example.com/private" },
            ],
          },
        ],
      },
    ],
  },
];

describe("browser bookmark sync", () => {
  it("lists folder paths and captures only the chosen subtree's web URLs", () => {
    expect(bookmarkFolderChoices(tree)).toContainEqual({
      id: "4",
      label: "Bookmarks bar / References / Films",
    });
    expect(selectedBookmarks(tree, ["2"]).map((capture) => capture.id)).toEqual(
      ["3", "5"],
    );
    expect(selectedBookmarks(tree, ["4"])).toEqual([
      {
        id: "5",
        title: "Film",
        url: "https://example.com/film",
        folderPath: ["Bookmarks bar", "References", "Films"],
      },
    ]);
    expect(selectedBookmarks(tree, [])).toEqual([]);
  });

  it("retains unacknowledged bookmarks and resumes without resending acknowledged ones", async () => {
    const captures = selectedBookmarks(tree, ["2"]);
    const initial = planBookmarkQueue(captures, {});
    let requests = 0;
    const offline = await drainBookmarkQueue(
      initial,
      async () => ++requests === 1,
    );
    expect(offline.pending.map((capture) => capture.id)).toEqual(["5"]);
    const resumed = planBookmarkQueue(captures, offline.synced);
    expect(resumed.pending.map((capture) => capture.id)).toEqual(["5"]);
    const complete = await drainBookmarkQueue(resumed, async () => true);
    expect(complete.pending).toEqual([]);
    expect(planBookmarkQueue(captures, complete.synced).pending).toEqual([]);
  });

  it("requeues a moved bookmark and drops bookmarks outside the current selection", async () => {
    const captures = selectedBookmarks(tree, ["2"]);
    const first = await drainBookmarkQueue(
      planBookmarkQueue(captures, {}),
      async () => true,
    );
    const moved = captures.map((capture) => ({
      ...capture,
      folderPath: ["New folder"],
    }));
    expect(planBookmarkQueue(moved, first.synced).pending).toHaveLength(2);
    expect(planBookmarkQueue([], first.synced)).toEqual({
      pending: [],
      synced: {},
    });
  });

  it("bounds each drain so large imports yield between batches", async () => {
    const initial = planBookmarkQueue(selectedBookmarks(tree, ["2"]), {});
    expect(
      (await drainBookmarkQueue(initial, async () => true, 1)).pending,
    ).toHaveLength(1);
  });
});
