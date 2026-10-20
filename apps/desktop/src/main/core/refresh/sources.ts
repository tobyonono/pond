import type { Source } from "@pond/schema/db";
export function homeUrlForSource(source: Source): string {
  switch (source) {
    case "twitter":
      return "https://x.com/login";
    case "instagram":
      return "https://www.instagram.com/accounts/login/";
    case "cosmos":
      return "https://www.cosmos.so/login";
    case "tiktok":
      return "https://www.tiktok.com/login";
    case "pinterest":
      return "https://www.pinterest.com/login/";
    case "arena":
      return "https://www.are.na/log-in";
    case "youtube":
      return "https://accounts.google.com/ServiceLogin?service=youtube";
    case "reddit":
      return "https://www.reddit.com/login/";
    case "threads":
      return "https://www.threads.com/login";
    case "goodreads":
      return "https://www.goodreads.com/";
    case "letterboxd":
      return "https://letterboxd.com/";
    case "web":
      return "";
    case "local":
      return "";
  }
}
