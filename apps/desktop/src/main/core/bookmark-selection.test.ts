import { expect, it } from "vitest";
import { parseNetscapeBookmarks, selectBookmarkFolders } from "./bookmarks";

const html = `<DL><H3>Other</H3><DL><A HREF="https://example.com/shared">Other copy</A></DL><H3>Selected</H3><DL><H3>Child</H3><DL><A HREF="https://example.com/shared">Selected copy</A></DL></DL><A HREF="https://example.com/root">Root</A></DL>`;

it("includes descendants and retains a selected URL seen earlier in an excluded folder", () => {
  const file = parseNetscapeBookmarks(html);
  const selected = file.folders.find((folder) => folder.name === "Selected");
  const child = file.folders.find((folder) => folder.name === "Child");
  const result = selectBookmarkFolders(file, [selected?.id ?? ""]);
  expect(result.bookmarks).toEqual([
    {
      url: "https://example.com/shared",
      addedAt: null,
      folderIds: [child?.id],
    },
  ]);
});

it("imports only unfiled bookmarks when requested", () => {
  expect(
    selectBookmarkFolders(parseNetscapeBookmarks(html), [], true).bookmarks.map(
      (bookmark) => bookmark.url,
    ),
  ).toEqual(["https://example.com/root"]);
});

it("rejects stale folder selections and treats an empty selection as empty", () => {
  const file = parseNetscapeBookmarks(html);
  expect(selectBookmarkFolders(file, []).bookmarks).toEqual([]);
  expect(() => selectBookmarkFolders(file, ["missing"])).toThrow("changed");
});
