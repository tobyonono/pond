import { userError } from "@shared/user-error";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { ReferenceImportDialog } from ".";

it("imports only the checked folders and retains selection after a failed import", async () => {
  const query = vi.fn(async (name: string) => {
    if (name === "sources.previewImport")
      return {
        path: "/fixture/Bookmarks",
        name: "Bookmarks",
        count: 2,
        rootCount: 0,
        tmdbConfigured: false,
        folders: [
          { id: "art", name: "Art", parentId: null },
          { id: "work", name: "Work", parentId: null },
        ],
      };
    if (name === "sources.importReferences")
      throw userError("The Library changed. Choose again.");
    throw new Error(`Unexpected query ${name}`);
  });
  vi.stubGlobal("pond", { query });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  function button(label: string): HTMLButtonElement {
    const found = [...document.querySelectorAll("button")].find(
      (element) => element.textContent === label,
    );
    if (!found) throw new Error(`Missing button: ${label}`);
    return found;
  }
  try {
    await act(async () =>
      root.render(
        <ReferenceImportDialog source="bookmarks" open onClose={() => {}} />,
      ),
    );
    expect(button("Import Selected").disabled).toBe(true);
    await act(async () => button("Choose Export").click());
    const work = document.getElementById("reference-folder-work");
    if (!(work instanceof HTMLElement))
      throw new Error("Missing Work checkbox");
    await act(async () => work.click());
    await act(async () => button("Import Selected").click());
    expect(query).toHaveBeenCalledWith("sources.importReferences", {
      source: "bookmarks",
      path: "/fixture/Bookmarks",
      folderIds: ["art"],
      includeRoot: true,
    });
    expect(document.querySelector('[role="alert"]')?.textContent).toContain(
      "Library changed",
    );
    expect(work).toHaveProperty("checked", false);
    expect(button("Import Selected").disabled).toBe(false);
    expect(
      query.mock.calls.some(([name]) => name === "sources.setTmdbKey"),
    ).toBe(false);
  } finally {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  }
});
