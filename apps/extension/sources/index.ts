import { SOURCES } from "@pond/schema/source-ids";
import { type ExternalSource, sourceIdFromUrl } from "@pond/schema/sources";
import { MatchPattern } from "wxt/utils/match-patterns";
import { matches as arena } from "./arena/matches";
import { matches as cosmos } from "./cosmos/matches";
import { matches as instagram } from "./instagram/matches";
import { matches as pinterest } from "./pinterest/matches";
import { matches as reddit } from "./reddit/matches";
import { matches as threads } from "./threads/matches";
import { matches as tiktok } from "./tiktok/matches";
import { matches as twitter } from "./twitter/matches";
import { matches as youtube } from "./youtube/matches";

interface HookSource {
  matches: readonly string[];
  /** Triggers that record a like or upvote rather than an explicit save. */
  likes: readonly string[];
  item: string;
}

export const HOOK_SOURCES = {
  goodreads: { matches: ["*://*.goodreads.com/*"], likes: [], item: "Book" },
  letterboxd: {
    matches: ["*://*.letterboxd.com/*", "*://boxd.it/*"],
    likes: [],
    item: "Film",
  },
  twitter: { matches: twitter, likes: ["twitter:like"], item: "Post" },
  instagram: { matches: instagram, likes: ["instagram:like"], item: "Post" },
  pinterest: { matches: pinterest, likes: [], item: "Pin" },
  arena: { matches: arena, likes: [], item: "Block" },
  cosmos: { matches: cosmos, likes: [], item: "Element" },
  tiktok: { matches: tiktok, likes: ["tiktok:like"], item: "Video" },
  youtube: { matches: youtube, likes: ["youtube:like"], item: "Video" },
  reddit: { matches: reddit, likes: ["reddit:upvote"], item: "Post" },
  threads: { matches: threads, likes: ["threads:like"], item: "Post" },
} as const satisfies Record<ExternalSource, HookSource>;

export const HOOK_SOURCE_IDS: readonly ExternalSource[] = SOURCES.filter(
  (source): source is ExternalSource => source !== "web" && source !== "local",
);

export const HOOK_MATCHES: string[] = HOOK_SOURCE_IDS.flatMap((source) => [
  ...HOOK_SOURCES[source].matches,
]);

export function isLikeTrigger(
  source: ExternalSource,
  trigger: string,
): boolean {
  const likes: readonly string[] = HOOK_SOURCES[source].likes;
  return likes.includes(trigger);
}

export function hookSourceForUrl(url: string): ExternalSource | null {
  return (
    HOOK_SOURCE_IDS.find((source) =>
      HOOK_SOURCES[source].matches.some((pattern) =>
        new MatchPattern(pattern).includes(url),
      ),
    ) ?? null
  );
}

/** The source when the URL is one item Pond can harvest, not a feed or profile. */
export function harvestSourceForUrl(url: string): ExternalSource | null {
  const source = hookSourceForUrl(url);
  return source && sourceIdFromUrl(source, url) ? source : null;
}
