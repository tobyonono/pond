import { runInNewContext } from "node:vm";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { ReferenceExtractor } from "./reference";

describe("reference source account identity", () => {
  it("probes the signed-in Goodreads header without mistaking an author's profile for the account", () => {
    const extractor = new ReferenceExtractor("goodreads");
    const dom = new JSDOM(
      '<header><a href="/review/list/123456-person">My Books</a></header><main><a href="/user/show/999-author">Author</a></main>',
    );
    expect(
      runInNewContext(extractor.probeExpression, {
        document: dom.window.document,
        location: { pathname: "/" },
      }),
    ).toBe("123456");
    dom.window.document.querySelector("header")?.remove();
    expect(
      runInNewContext(extractor.probeExpression, {
        document: dom.window.document,
        location: { pathname: "/" },
      }),
    ).toBe("");
    dom.window.close();
  });
  it("requires Letterboxd's authenticated viewer and reads its username", () => {
    const extractor = new ReferenceExtractor("letterboxd");
    expect(
      runInNewContext(extractor.probeExpression, {
        window: { person: { loggedIn: true, username: "member" } },
      }),
    ).toBe("member");
    expect(
      runInNewContext(extractor.probeExpression, {
        window: { person: { loggedIn: false, username: "member" } },
      }),
    ).toBe("");
  });
  it("does not infer account handles from public item URLs or book authors", () => {
    const books = new ReferenceExtractor("goodreads");
    const films = new ReferenceExtractor("letterboxd");
    const cachedBookHandle = books.handleFromPath;
    const cachedFilmHandle = films.handleFromPath;
    expect(cachedBookHandle(["123456"])).toBe("123456");
    expect(cachedFilmHandle(["scout2015"])).toBe("scout2015");
    expect(books.handleFromPath(["book", "show", "4671"])).toBeNull();
    expect(films.handleFromPath(["film", "perfect-days"])).toBeNull();
    expect(books.authCookies("_session_id2", "session")).toBe(true);
    expect(films.authCookies("JSESSIONID", "session")).toBe(true);
    expect(films.authCookies("JSESSIONID", "")).toBe(false);
  });
});
