import type { Source } from "@pond/schema/db";
import type { ExternalSource } from "@pond/schema/sources";
import { UnsupportedError } from "./errors";
import { ArenaBlockExtractor } from "./sources/arena";
import { CosmosTileExtractor } from "./sources/cosmos";
import { InstagramPostExtractor } from "./sources/instagram";
import { PinterestPinExtractor } from "./sources/pinterest";
import { RedditPostExtractor } from "./sources/reddit";
import { ReferenceExtractor } from "./sources/reference";
import { ThreadsPostExtractor } from "./sources/threads";
import { TikTokVideoExtractor } from "./sources/tiktok";
import { TwitterTweetExtractor } from "./sources/twitter";
import { YouTubeWatchExtractor } from "./sources/youtube";
import type { ExtractInput, Extractor } from "./types";

const EXTRACTORS = {
  goodreads: new ReferenceExtractor("goodreads"),
  letterboxd: new ReferenceExtractor("letterboxd"),
  twitter: new TwitterTweetExtractor(),
  instagram: new InstagramPostExtractor(),
  tiktok: new TikTokVideoExtractor(),
  youtube: new YouTubeWatchExtractor(),
  pinterest: new PinterestPinExtractor(),
  arena: new ArenaBlockExtractor(),
  cosmos: new CosmosTileExtractor(),
  reddit: new RedditPostExtractor(),
  threads: new ThreadsPostExtractor(),
} as const satisfies Record<ExternalSource, Extractor>;

const WEB_EXTRACTOR: Extractor = {
  id: "web-page",
  source: "web",
  validUrl: [],
  cookieDomain: null,
  authCookies: () => false,
  suitable: (url: URL) => url.protocol === "http:" || url.protocol === "https:",
  extract: async (input: ExtractInput) => {
    const { WebPageExtractor } = await import("./sources/web");
    return new WebPageExtractor().extract(input);
  },
};

export const EXTRACTOR_LIST: readonly Extractor[] = Object.values(EXTRACTORS);

export function extractorFor(source: Source): Extractor | null {
  if (source === "local") return null;
  if (source === "web") return WEB_EXTRACTOR;
  return EXTRACTORS[source];
}

export function resolveExtractor(rawUrl: string): Extractor {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new UnsupportedError(`invalid url: ${rawUrl}`);
  }
  for (const ex of EXTRACTOR_LIST) {
    if (ex.suitable(url)) return ex;
  }
  if (WEB_EXTRACTOR.suitable(url)) return WEB_EXTRACTOR;
  throw new UnsupportedError(`no extractor for ${rawUrl}`);
}

interface UrlClassification {
  source: Source | null;
  extractorId: string | null;
}

export function classifyUrlToSource(rawUrl: string): UrlClassification {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { source: null, extractorId: null };
  }
  for (const ex of EXTRACTOR_LIST) {
    if (ex.suitable(url)) {
      return { source: ex.source, extractorId: ex.id };
    }
  }
  if (WEB_EXTRACTOR.suitable(url)) {
    return { source: WEB_EXTRACTOR.source, extractorId: WEB_EXTRACTOR.id };
  }
  return { source: null, extractorId: null };
}

export * from "./errors";
