import type { NewSave } from "@pond/schema/db";
import { describe, expect, it } from "vitest";
import { importReferences, type ReferenceImportDependencies } from ".";
import { parseGoodreadsExport } from "./records";

function library() {
  const urls = new Map<string, string>();
  const patches = new Map<string, Partial<NewSave>>();
  const folders = new Map<string, string[]>();
  const dependencies: ReferenceImportDependencies = {
    library: () => "fixture-library",
    write: (operation) => operation(),
    enqueue: async (capture) => {
      const existing = urls.get(capture.url);
      if (existing) return { id: existing, created: false };
      const id = `save-${urls.size}`;
      urls.set(capture.url, id);
      return { id, created: true };
    },
    persist: async (id, patch) => {
      patches.set(id, patch);
    },
    file: async (id, paths) => {
      folders.set(id, [...new Set([...(folders.get(id) ?? []), ...paths])]);
    },
    enrich: async (capture) => capture,
  };
  return { dependencies, patches, folders };
}

describe("reference imports", () => {
  it("stops writes when the Library changes during enrichment", async () => {
    const store = library();
    let active = "original";
    const result = await importReferences(
      parseGoodreadsExport(
        "Book Id,Title,Author\n1,Book,Author\n2,Other,Author",
      ),
      {
        ...store.dependencies,
        library: () => active,
        enrich: async (capture) => {
          active = "other";
          return capture;
        },
      },
    );
    expect(result).toMatchObject({ imported: 0, failed: 2 });
    expect(store.patches.size).toBe(0);
    expect(store.folders.size).toBe(0);
  });
  it("keeps personal edits on re-import while adding a new shelf membership", async () => {
    const store = library();
    const records = parseGoodreadsExport(
      "Book Id,Title,Author,My Rating,My Review,Exclusive Shelf\n1,Book,Author,4,Original,read",
    );
    expect(await importReferences(records, store.dependencies)).toMatchObject({
      imported: 1,
      failed: 0,
    });
    store.patches.set("save-0", { notes: "My corrected note", rating: 5 });
    const updated = parseGoodreadsExport(
      "Book Id,Title,Author,My Rating,My Review,Exclusive Shelf\n1,Book,Author,2,New source review,favourites",
    );
    expect(await importReferences(updated, store.dependencies)).toMatchObject({
      imported: 0,
      skipped: 1,
      failed: 0,
    });
    expect(store.patches.get("save-0")).toEqual({
      notes: "My corrected note",
      rating: 5,
    });
    expect(store.folders.get("save-0")).toEqual([
      "Goodreads/read",
      "Goodreads/favourites",
    ]);
  });

  it("retains valid source records when enrichment is unavailable", async () => {
    const store = library();
    const result = await importReferences(
      parseGoodreadsExport("Book Id,Title,Author\n1,Book,Author"),
      {
        ...store.dependencies,
        enrich: async () => {
          throw new Error("offline");
        },
      },
    );
    expect(result).toMatchObject({ imported: 1, failed: 0 });
    expect(result.warnings).toHaveLength(1);
  });

  it("continues after an individual save fails", async () => {
    const store = library();
    const result = await importReferences(
      parseGoodreadsExport("Book Id,Title,Author\n1,One,Author\n2,Two,Author"),
      {
        ...store.dependencies,
        enqueue: async (capture, seed) => {
          if (capture.id === "1") throw new Error("failed save");
          return store.dependencies.enqueue(capture, seed);
        },
      },
    );
    expect(result).toMatchObject({ imported: 1, failed: 1 });
  });
});
