import { capture, installInterceptor, sourceChanged } from "@/utils/intercept";
import { parseJsonValue } from "@/utils/json";
import { collectGoodreadsBookIds, goodreadsSaveRequest } from "./save-request";

export function inject(): void {
  const ids = new Map<string, string>();
  installInterceptor({
    id: "goodreads",
    match: (request) =>
      request.method === "POST" && /\/graphql(?:\?|$)/.test(request.url),
    async onResponse(request, response) {
      if (!response.ok) return;
      const data = parseJsonValue(await response.readText());
      collectGoodreadsBookIds(data, ids);
      collectGoodreadsBookIds(
        parseJsonValue(
          document.getElementById("__NEXT_DATA__")?.textContent ?? null,
        ),
        ids,
      );
      const saved = goodreadsSaveRequest(
        await request.readBody(),
        data,
        (id) => ids.get(id) ?? null,
      );
      if (saved) {
        sourceChanged("goodreads");
        capture(
          `https://www.goodreads.com/book/show/${saved.bookId}`,
          saved.shelf === "rated" ? "goodreads:rating" : "goodreads:shelf",
        );
      }
    },
  });
}
