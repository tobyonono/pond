import {
  IconBrandArena,
  IconBrandCosmos,
  IconBrandThreads,
  IconInstagram,
  IconPinterest,
  IconReddit,
  IconSourceLocal,
  IconSourceWeb,
  IconTikTok,
  IconXTwitter,
  IconYoutube,
} from "@pond/icons/social-media";
import type { IconComponent } from "@pond/icons/types";
import type { Source } from "@pond/schema/db";
import {
  hostToSource,
  resolveSourceId,
  sourceLabel,
} from "@pond/schema/sources";

interface SourceDef {
  source: Source;
  label: string;
  logo: string | null;
  icon: IconComponent | null;
}

const SOURCE_LOGOS = {
  goodreads: null,
  letterboxd: null,
  twitter: null,
  pinterest: null,
  arena: null,
  instagram: null,
  cosmos: null,
  tiktok: null,
  youtube: null,
  reddit: null,
  threads: null,
  web: null,
  local: null,
} satisfies Record<Source, string | null>;

const SOURCE_ICONS = {
  goodreads: IconSourceWeb,
  letterboxd: IconSourceWeb,
  twitter: IconXTwitter,
  pinterest: IconPinterest,
  arena: IconBrandArena,
  instagram: IconInstagram,
  cosmos: IconBrandCosmos,
  tiktok: IconTikTok,
  youtube: IconYoutube,
  reddit: IconReddit,
  threads: IconBrandThreads,
  web: IconSourceWeb,
  local: IconSourceLocal,
} satisfies Record<Source, IconComponent | null>;

export function getSourceDef(source: Source): SourceDef {
  return {
    source,
    label: sourceLabel(source),
    logo: SOURCE_LOGOS[source],
    icon: SOURCE_ICONS[source],
  };
}

export function getSourceDefForIdentity(identity: string): SourceDef | null {
  const source =
    resolveSourceId(identity) ??
    hostToSource(identity.includes("://") ? identity : `https://${identity}`);
  return source ? getSourceDef(source) : null;
}

export function getSourceLogo(source: string): string | null {
  const normalized = resolveSourceId(source);
  return normalized ? SOURCE_LOGOS[normalized] : null;
}

export function getSourceIcon(source: string): IconComponent | null {
  const normalized = resolveSourceId(source);
  return normalized ? SOURCE_ICONS[normalized] : null;
}
