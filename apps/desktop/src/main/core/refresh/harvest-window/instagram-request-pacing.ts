import type { BrowserWindow, Session } from "electron";
import { acquire, report } from "../../pipeline/rate-governor";
import { createInstagramRequestGate } from "./instagram-request-gate";

const sessions = new WeakSet<Session>();
const gate = createInstagramRequestGate({
  acquire: (signal) => acquire("instagram", { signal }),
  rateLimited: (headers) => {
    report("instagram", { ok: false, status: 429, headers });
  },
});

/** Owns the request listeners on capture sessions; the normal browser and extension are unaffected. */
export function paceInstagramCapture(win: BrowserWindow): () => void {
  const session = win.webContents.session;
  if (!sessions.has(session)) {
    sessions.add(session);
    const filter = {
      urls: [
        "https://*.instagram.com/api/*",
        "https://*.instagram.com/graphql/*",
        "https://*.instagram.com/async/*",
      ],
    };
    session.webRequest.onBeforeRequest(filter, (details, callback) =>
      gate.beforeRequest(details, callback),
    );
    session.webRequest.onHeadersReceived(filter, (details, callback) => {
      gate.headersReceived(details);
      callback({});
    });
  }
  const contents = win.webContents;
  const stop = gate.register(contents.id);
  contents.once("destroyed", stop);
  return () => {
    contents.removeListener("destroyed", stop);
    stop();
  };
}
