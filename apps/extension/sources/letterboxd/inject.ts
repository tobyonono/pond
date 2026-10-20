import { capture, installInterceptor } from "@/utils/intercept";
import { asText, at, parseJsonValue } from "@/utils/json";
import { letterboxdSavedIds } from "./save-request";

function filmUrl(id: string): string {
  for (const element of document.querySelectorAll<HTMLElement>(
    "[data-postered-identifier][data-item-link]",
  )) {
    if (
      asText(
        at(
          parseJsonValue(element.getAttribute("data-postered-identifier")),
          "lid",
        ),
      ) !== id
    )
      continue;
    const link = element.getAttribute("data-item-link");
    if (link?.startsWith("/film/")) return `https://letterboxd.com${link}`;
  }
  const identifier = document.querySelector<HTMLMetaElement>(
    'meta[name="production:identifier"]',
  )?.content;
  if (asText(at(parseJsonValue(identifier ?? null), "lid")) === id) {
    const canonical = document.querySelector<HTMLLinkElement>(
      'link[rel="canonical"]',
    )?.href;
    if (canonical?.startsWith("https://letterboxd.com/film/")) return canonical;
  }
  return `https://boxd.it/${id}`;
}

export function inject(): void {
  installInterceptor({
    id: "letterboxd",
    match: (request) =>
      /\/me\/watchlist\/|\/watchlist\/add-films\/?/.test(request.url),
    async onResponse(request, response) {
      if (!response.ok) return;
      const ids = letterboxdSavedIds(
        request.url,
        request.method,
        await request.readBody(),
        parseJsonValue(await response.readText()),
      );
      for (const id of ids) capture(filmUrl(id), "letterboxd:watchlist");
    },
  });
}
