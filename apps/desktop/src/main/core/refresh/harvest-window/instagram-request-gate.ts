import type { HeaderBag } from "../../pipeline/rate-headers";

interface RequestDetails {
  webContentsId?: number;
  resourceType: string;
}

/** Serializes actual API pages, including requests made by Instagram's own UI. */
export function createInstagramRequestGate(deps: {
  acquire: (signal: AbortSignal) => Promise<void>;
  rateLimited: (headers: HeaderBag) => void;
}) {
  const captures = new Map<number, AbortController>();
  let tail = Promise.resolve();
  return {
    register(webContentsId: number): () => void {
      const controller = new AbortController();
      captures.set(webContentsId, controller);
      return () => {
        controller.abort();
        if (captures.get(webContentsId) === controller)
          captures.delete(webContentsId);
      };
    },
    beforeRequest(
      details: RequestDetails,
      callback: (result: { cancel: boolean }) => void,
    ): void {
      const controller =
        details.webContentsId === undefined
          ? undefined
          : captures.get(details.webContentsId);
      if (!controller || details.resourceType !== "xhr") {
        callback({ cancel: false });
        return;
      }
      const pending = tail.then(async () => {
        const { signal } = controller;
        if (signal.aborted) throw new Error("Instagram capture released");
        await deps.acquire(signal);
        if (signal.aborted) throw new Error("Instagram capture released");
      });
      tail = pending.catch(() => {});
      void pending.then(
        () => callback({ cancel: false }),
        () => callback({ cancel: true }),
      );
    },
    headersReceived(
      details: RequestDetails & {
        statusCode: number;
        responseHeaders?: Record<string, string[]>;
      },
    ): void {
      if (
        details.webContentsId === undefined ||
        !captures.has(details.webContentsId) ||
        details.statusCode !== 429
      )
        return;
      const headers: Record<string, string> = {};
      for (const [key, values] of Object.entries(details.responseHeaders ?? {}))
        headers[key] = values.join(", ");
      deps.rateLimited(headers);
    },
  };
}
