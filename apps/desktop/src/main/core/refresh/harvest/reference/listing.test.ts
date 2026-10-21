import { runInNewContext } from "node:vm";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import {
  buildReferenceListingExpression,
  ReferenceReplySchema,
} from "./listing";

async function read(
  source: "goodreads" | "letterboxd",
  body: string,
  list: string,
  status = 200,
) {
  const dom = new JSDOM("");
  const url =
    source === "goodreads"
      ? "https://www.goodreads.com/review/list_rss/123"
      : "https://letterboxd.com/person/diary/";
  const raw = await runInNewContext(
    buildReferenceListingExpression(source, url, list),
    {
      DOMParser: dom.window.DOMParser,
      URL,
      fetch: async () => ({
        ok: status === 200,
        status,
        url,
        text: async () => body,
        headers: { get: () => (status === 429 ? "3600" : null) },
      }),
    },
  );
  dom.window.close();
  return ReferenceReplySchema.parse(raw);
}

describe("reference source listing boundary", () => {
  it("reads Goodreads books and all shelf memberships from RSS", async () => {
    const reply = await read(
      "goodreads",
      "<rss><channel><item><book_id>4671</book_id><title><![CDATA[The Great Gatsby]]></title><user_shelves>read, design</user_shelves><user_date_added>2026-10-20</user_date_added></item><item><book_id>bad</book_id></item></channel></rss>",
      "all",
    );
    expect(reply).toMatchObject({
      ok: true,
      entries: [
        {
          sourceId: "4671",
          url: "https://www.goodreads.com/book/show/4671",
          collectionIds: ["read", "design"],
          savedAt: "2026-10-20T00:00:00.000Z",
        },
      ],
    });
  });
  it("reads current Letterboxd poster attributes, logged membership and pagination", async () => {
    const reply = await read(
      "letterboxd",
      '<table class="diary-table"><tr class="diary-entry-row"><td><div data-item-slug="perfect-days-2023" data-item-link="/film/perfect-days-2023/" data-item-name="Perfect Days (2023)"></div></td></tr></table><div class="paginate-nextprev"><a class="next" href="/person/diary/films/page/2/">Older</a></div><aside><div data-item-link="/film/unrelated/"></div></aside>',
      "diary",
    );
    expect(reply).toMatchObject({
      ok: true,
      entries: [
        { sourceId: "perfect-days-2023", collectionIds: ["diary", "watched"] },
      ],
      nextUrl: "https://letterboxd.com/person/diary/films/page/2/",
    });
    if (reply.ok) expect(reply.entries).toHaveLength(1);
  });
  it("distinguishes a real empty list from unexpected markup and authentication failure", async () => {
    await expect(
      read(
        "letterboxd",
        '<section class="empty-text">No films yet</section>',
        "watched",
      ),
    ).resolves.toMatchObject({ ok: true, entries: [] });
    await expect(
      read("letterboxd", "<html>Checking your browser</html>", "watched"),
    ).resolves.toMatchObject({ ok: false, reason: "no_match" });
    await expect(read("goodreads", "login", "all", 403)).resolves.toMatchObject(
      { ok: false, reason: "auth_required" },
    );
  });
  it("reports a rate limit and never parses a challenge or external XML entity as an empty shelf", async () => {
    await expect(
      read("goodreads", "slow down", "all", 429),
    ).resolves.toMatchObject({
      ok: false,
      reason: "rate_limited",
      retryAfterSec: 3600,
    });
    await expect(
      read(
        "goodreads",
        '<!DOCTYPE rss [<!ENTITY x SYSTEM "file:///private">]><rss><channel/></rss>',
        "all",
      ),
    ).resolves.toMatchObject({ ok: false, reason: "no_match" });
  });
});
