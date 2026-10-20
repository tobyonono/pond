export interface BookmarkNode {
  id: string;
  title: string;
  url?: string;
  children?: BookmarkNode[];
}

export interface BookmarkCapture {
  id: string;
  url: string;
  title: string;
  folderPath: string[];
}

export interface BookmarkFolderChoice {
  id: string;
  label: string;
}

export function bookmarkFolderChoices(
  tree: BookmarkNode[],
): BookmarkFolderChoice[] {
  const folders: BookmarkFolderChoice[] = [];
  function walk(nodes: BookmarkNode[], parents: string[]) {
    for (const node of nodes) {
      if (node.url) continue;
      const path = node.title ? [...parents, node.title] : parents;
      if (node.title) folders.push({ id: node.id, label: path.join(" / ") });
      walk(node.children ?? [], path);
    }
  }
  walk(tree, []);
  return folders;
}

/** Selection propagates into descendants, but an unselected sibling never enters the plan. */
export function selectedBookmarks(
  tree: BookmarkNode[],
  folderIds: readonly string[],
): BookmarkCapture[] {
  const selected = new Set(folderIds);
  const captures: BookmarkCapture[] = [];
  function walk(nodes: BookmarkNode[], path: string[], inherited: boolean) {
    for (const node of nodes) {
      if (node.url) {
        if (inherited && /^https?:\/\//i.test(node.url))
          captures.push({
            id: node.id,
            url: node.url,
            title: node.title,
            folderPath: path,
          });
        continue;
      }
      walk(
        node.children ?? [],
        node.title ? [...path, node.title] : path,
        inherited || selected.has(node.id),
      );
    }
  }
  walk(tree, [], false);
  return captures;
}

function bookmarkFingerprint(capture: BookmarkCapture): string {
  return JSON.stringify([capture.url, capture.title, capture.folderPath]);
}

export interface BookmarkQueue {
  pending: BookmarkCapture[];
  synced: Record<string, string>;
}

export function planBookmarkQueue(
  captures: BookmarkCapture[],
  synced: Record<string, string>,
): BookmarkQueue {
  const known: Record<string, string> = {};
  const pending: BookmarkCapture[] = [];
  for (const capture of captures) {
    const fingerprint = bookmarkFingerprint(capture);
    if (synced[capture.id] === fingerprint) known[capture.id] = fingerprint;
    else pending.push(capture);
  }
  return { pending, synced: known };
}

/** Only a successful native acknowledgment removes a pending capture. */
export async function drainBookmarkQueue(
  queue: BookmarkQueue,
  send: (capture: BookmarkCapture) => Promise<boolean>,
  limit = 100,
): Promise<BookmarkQueue> {
  const synced = { ...queue.synced };
  const pending = [...queue.pending];
  for (let count = 0; pending.length && count < limit; count += 1) {
    const capture = pending[0];
    if (!capture || !(await send(capture))) break;
    synced[capture.id] = bookmarkFingerprint(capture);
    pending.shift();
  }
  return { pending, synced };
}
