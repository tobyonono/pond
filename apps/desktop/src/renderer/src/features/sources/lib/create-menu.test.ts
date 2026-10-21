import { isValidElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { BrandTile } from "@/features/sources/components/sync-monitor-source-tile";
import { menuLabels as labels } from "@/shared/test/menu-labels";
import { buildSourceNewMenuItems } from "./create-menu";

describe("source create menu", () => {
  it("lists every connectable source under New Source", () => {
    const onConnect = vi.fn();
    const items = buildSourceNewMenuItems({
      onConnect,
      onWatch: vi.fn(),
      onFolder: vi.fn(),
      onImport: vi.fn(),
    });
    expect(labels(items)).toEqual([
      "New Source",
      "Goodreads",
      "Letterboxd",
      "Twitter",
      "Instagram",
      "Pinterest",
      "Are.na",
      "Cosmos",
      "TikTok",
      "YouTube",
      "Reddit",
      "Threads",
      "Bookmark Folders",
      "New Watch",
      "Twitter",
      "Instagram",
      "Pinterest",
      "Are.na",
      "Cosmos",
      "TikTok",
      "YouTube",
      "New Folder",
    ]);
  });

  it("starts connect and watch from the chosen source", () => {
    const onConnect = vi.fn();
    const onWatch = vi.fn();
    const items = buildSourceNewMenuItems({
      onConnect,
      onWatch,
      onFolder: vi.fn(),
      onImport: vi.fn(),
    });
    const connect = items.find(
      (item) => item.type === "submenu" && item.id === "new-source",
    );
    const watch = items.find(
      (item) => item.type === "submenu" && item.id === "new-watch",
    );
    if (connect?.type !== "submenu" || watch?.type !== "submenu") {
      throw new Error("Missing source submenus");
    }
    const instagram = connect.items.find(
      (item) => "id" in item && item.id === "connect-instagram",
    );
    const youtube = watch.items.find(
      (item) => "id" in item && item.id === "watch-youtube",
    );
    if (
      !instagram ||
      !("onClick" in instagram) ||
      !youtube ||
      !("onClick" in youtube)
    ) {
      throw new Error("Missing source items");
    }
    instagram.onClick?.();
    youtube.onClick?.();
    expect(onConnect).toHaveBeenCalledExactlyOnceWith("instagram");
    expect(onWatch).toHaveBeenCalledExactlyOnceWith("youtube");
  });

  it("opens reference setup without starting an account login", () => {
    const onImport = vi.fn();
    const onConnect = vi.fn();
    const items = buildSourceNewMenuItems({
      onConnect,
      onImport,
      onWatch: vi.fn(),
      onFolder: vi.fn(),
    });
    const menu = items.find(
      (item) => item.type === "submenu" && item.id === "new-source",
    );
    if (menu?.type !== "submenu") throw new Error("Missing New Source");
    for (const source of ["bookmarks"]) {
      const item = menu.items.find(
        (entry) => "id" in entry && entry.id === `import-${source}`,
      );
      if (!item || !("onClick" in item)) throw new Error(`Missing ${source}`);
      item.onClick?.();
      expect(onImport).toHaveBeenLastCalledWith(source);
    }
    expect(onImport).toHaveBeenCalledTimes(1);
    expect(onConnect).not.toHaveBeenCalled();
  });

  it("connects Goodreads and Letterboxd through the normal account flow", () => {
    const onConnect = vi.fn();
    const onImport = vi.fn();
    const items = buildSourceNewMenuItems({
      onConnect,
      onImport,
      onWatch: vi.fn(),
      onFolder: vi.fn(),
    });
    const menu = items.find(
      (item) => item.type === "submenu" && item.id === "new-source",
    );
    if (menu?.type !== "submenu") throw new Error("Missing sources");
    for (const source of ["goodreads", "letterboxd"]) {
      const item = menu.items.find(
        (item) => "id" in item && item.id === `connect-${source}`,
      );
      if (!item || !("onClick" in item)) throw new Error(`Missing ${source}`);
      item.onClick?.();
      expect(onConnect).toHaveBeenLastCalledWith(source);
    }
    expect(onImport).not.toHaveBeenCalled();
  });

  it("uses source tiles so light logos stay visible on the menu", () => {
    const items = buildSourceNewMenuItems({
      onConnect: vi.fn(),
      onWatch: vi.fn(),
      onFolder: vi.fn(),
      onImport: vi.fn(),
    });
    const connect = items.find(
      (item) => item.type === "submenu" && item.id === "new-source",
    );
    if (connect?.type !== "submenu") throw new Error("Missing New Source");
    const arena = connect.items.find(
      (item) => "id" in item && item.id === "connect-arena",
    );
    if (!arena || !("icon" in arena) || !isValidElement(arena.icon)) {
      throw new Error("Missing Are.na icon");
    }
    expect(arena.icon.type).toBe(BrandTile);
    expect(arena.icon.props).toMatchObject({ source: "arena", size: 16 });
  });
});
