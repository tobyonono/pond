import { SOURCES, type Source } from "@pond/schema/source-ids";

export function cookieDomainsForSource(source: Source): string[] {
  switch (source) {
    case "twitter":
      return ["x.com", "twitter.com"];
    case "instagram":
      return ["instagram.com"];
    case "tiktok":
      return ["tiktok.com"];
    case "pinterest":
      return ["pinterest.com"];
    case "youtube":
      return ["youtube.com", "google.com"];
    case "cosmos":
      return ["cosmos.so"];
    case "arena":
      return ["are.na"];
    case "reddit":
      return ["reddit.com"];
    case "threads":
      return ["threads.net", "threads.com", "instagram.com"];
    case "goodreads":
    case "letterboxd":
    case "web":
    case "local":
      return [];
  }
}

export function isCookieSourceUrl(url: string): boolean {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  return SOURCES.some((source) =>
    cookieDomainsForSource(source).some(
      (domain) => host === domain || host.endsWith(`.${domain}`),
    ),
  );
}
