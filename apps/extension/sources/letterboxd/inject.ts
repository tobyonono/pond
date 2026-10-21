import { capture, installInterceptor, sourceChanged } from "@/utils/intercept";
import { asText, at, parseJsonValue } from "@/utils/json";
import { letterboxdActivityIds, letterboxdSavedIds } from "./save-request";

function filmUrl(id: string): string | null {
  for (const element of document.querySelectorAll<HTMLElement>(
    "[data-postered-identifier][data-item-link]",
  )) {
    const identifier = parseJsonValue(
      element.getAttribute("data-postered-identifier"),
    );
    if (
      asText(at(identifier, "lid")) !== id &&
      asText(at(identifier, "uid")) !== id
    )
      continue;
    const link = element.getAttribute("data-item-link");
    if (link?.startsWith("/film/")) return `https://letterboxd.com${link}`;
  }
  const identifier = document.querySelector<HTMLMetaElement>(
    'meta[name="production:identifier"]',
  )?.content;
  const production = parseJsonValue(identifier ?? null);
  if (
    asText(at(production, "lid")) === id ||
    asText(at(production, "uid")) === id
  ) {
    const canonical = document.querySelector<HTMLLinkElement>(
      'link[rel="canonical"]',
    )?.href;
    if (canonical?.startsWith("https://letterboxd.com/film/")) return canonical;
  }
  return /^[A-Za-z0-9]+$/.test(id) ? `https://boxd.it/${id}` : null;
}

export function inject(): void {
  installInterceptor({
    id: "letterboxd",
    match: (request) =>
      /\/me\/watchlist\/|\/watchlist\/add-films\/?|\/s\/film:\d+\/watch\/?|\/s\/save-diary-entry/.test(
        request.url,
      ),
    async onResponse(request, response) {
      if (!response.ok) return;
      const body = await request.readBody();
      const json = parseJsonValue(await response.readText());
      for (const id of letterboxdSavedIds(
        request.url,
        request.method,
        body,
        json,
      )) {
        sourceChanged("letterboxd");
        const url = filmUrl(id);
        if (url) capture(url, "letterboxd:watchlist");
      }
      for (const action of letterboxdActivityIds(
        request.url,
        request.method,
        body,
        json,
      )) {
        sourceChanged("letterboxd");
        const url = filmUrl(action.id);
        if (url) capture(url, `letterboxd:${action.trigger}`);
      }
    },
  });
}
