import type { Source } from "@pond/schema/db";
import type { JsonValue } from "@pond/schema/json";
import type { Capture } from "@pond/schema/raw";
import { sourceIdFromUrl } from "@pond/schema/sources";
import * as arena from "./arena";
import * as cosmos from "./cosmos";
import type { HarvestAdaptCtx } from "./from-page";
import * as instagram from "./instagram";
import * as pinterest from "./pinterest";
import * as reddit from "./reddit";
import * as threads from "./threads";
import * as tiktok from "./tiktok";
import * as twitter from "./twitter";
import * as youtube from "./youtube";

interface Harvester {
  buildExpression: (sourceId: string) => string;
  adapt: (raw: JsonValue, ctx: HarvestAdaptCtx) => Capture | null;
  sourceIdFromUrl: (url: string) => string | null;
}

const REGISTRY = {
  goodreads: {
    buildExpression: () => {
      throw new Error("Goodreads uses public-page capture.");
    },
    adapt: () => null,
    sourceIdFromUrl: (url) => sourceIdFromUrl("goodreads", url),
  },
  letterboxd: {
    buildExpression: () => {
      throw new Error("Letterboxd uses public-page capture.");
    },
    adapt: () => null,
    sourceIdFromUrl: (url) => sourceIdFromUrl("letterboxd", url),
  },
  twitter: {
    buildExpression: twitter.buildExpression,
    adapt: twitter.adapt,
    sourceIdFromUrl: (url) => sourceIdFromUrl("twitter", url),
  },
  instagram: {
    buildExpression: instagram.buildExpression,
    adapt: instagram.adapt,
    sourceIdFromUrl: (url) => sourceIdFromUrl("instagram", url),
  },
  youtube: {
    buildExpression: youtube.buildExpression,
    adapt: youtube.adapt,
    sourceIdFromUrl: (url) => sourceIdFromUrl("youtube", url),
  },
  pinterest: {
    buildExpression: pinterest.buildExpression,
    adapt: pinterest.adapt,
    sourceIdFromUrl: (url) => sourceIdFromUrl("pinterest", url),
  },
  tiktok: {
    buildExpression: tiktok.buildExpression,
    adapt: tiktok.adapt,
    sourceIdFromUrl: (url) => sourceIdFromUrl("tiktok", url),
  },
  arena: {
    buildExpression: arena.buildExpression,
    adapt: arena.adapt,
    sourceIdFromUrl: (url) => sourceIdFromUrl("arena", url),
  },
  cosmos: {
    buildExpression: cosmos.buildExpression,
    adapt: cosmos.adapt,
    sourceIdFromUrl: (url) => sourceIdFromUrl("cosmos", url),
  },
  reddit: {
    buildExpression: reddit.buildExpression,
    adapt: reddit.adapt,
    sourceIdFromUrl: (url) => sourceIdFromUrl("reddit", url),
  },
  threads: {
    buildExpression: threads.buildExpression,
    adapt: threads.adapt,
    sourceIdFromUrl: (url) => sourceIdFromUrl("threads", url),
  },
  web: {
    buildExpression: () => {
      throw new Error("web source does not harvest via the window pool");
    },
    adapt: () => null,
    sourceIdFromUrl: (url) => sourceIdFromUrl("web", url),
  },
  local: {
    buildExpression: () => {
      throw new Error("local source is not harvestable");
    },
    adapt: () => null,
    sourceIdFromUrl: (url) => sourceIdFromUrl("local", url),
  },
} satisfies Record<Source, Harvester>;

export function harvesterFor(source: Source): Harvester {
  return REGISTRY[source];
}
