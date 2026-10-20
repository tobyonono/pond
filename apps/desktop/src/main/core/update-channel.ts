import type { Prefs } from "@pond/schema/db";

export type UpdateChannel = NonNullable<Prefs["updates"]["channel"]>;

/** Locally packaged forks update through their own release process. */
export function isForkBuild(version: string): boolean {
  return /^\d+\.\d+\.\d+-fork(?:\.|$)/.test(version);
}

export function installedChannel(version: string): UpdateChannel {
  return /^\d+\.\d+\.\d+-nightly\./.test(version) ? "nightly" : "stable";
}

/** Until you pick a channel, a nightly install keeps getting nightlies. */
export function withInstalledChannel(prefs: Prefs, version: string): Prefs {
  if (prefs.updates.channel) return prefs;
  return {
    ...prefs,
    updates: { ...prefs.updates, channel: installedChannel(version) },
  };
}
