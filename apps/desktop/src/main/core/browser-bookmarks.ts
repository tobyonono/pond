import { libraryRoot } from "../paths";
import { withMutationScope } from "./executor";
import { addSavesToFolder, importFolderTree } from "./folders";
import { persistSave } from "./persist-save";
import { enqueue } from "./pipeline/enqueue";

export interface BrowserBookmarkInput {
  libraryPath: string;
  url: string;
  title: string;
  folderPath: string[];
}

/** A bookmark sync is bound to the Library selected at opt-in, never whichever happens to be open later. */
export async function captureBrowserBookmark(input: BrowserBookmarkInput) {
  return withMutationScope(async () => {
    if (libraryRoot() !== input.libraryPath) throw new Error("library_changed");
    const saved = await enqueue(input.url, {
      trigger: "browser:bookmark",
      listKinds: ["saved"],
    });
    if (saved.created && input.title)
      await persistSave(
        saved.id,
        { title: input.title },
        { actorReason: "bookmarks:capture" },
      );
    let parentId: string | null = null;
    const tree = ["Browser Bookmarks", ...input.folderPath].map(
      (name, index) => {
        const id = `bookmark-${index}`;
        const node = { id, name, parentId, sortOrder: 0 };
        parentId = id;
        return node;
      },
    );
    const mapping = await importFolderTree(tree, true);
    const folderId = mapping.get(tree.at(-1)?.id ?? "");
    if (folderId) await addSavesToFolder(folderId, [saved.id]);
    return saved;
  });
}
