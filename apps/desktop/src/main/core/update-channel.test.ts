import { DEFAULT_PREFS } from "@pond/schema/db";
import { describe, expect, it } from "vitest";
import {
  installedChannel,
  isForkBuild,
  withInstalledChannel,
} from "./update-channel";

describe("update channel", () => {
  it("keeps fork builds outside the upstream update channel", () => {
    expect(isForkBuild("1.2.0-fork.1")).toBe(true);
    expect(isForkBuild("1.2.0-fork")).toBe(true);
    expect(isForkBuild("1.2.0")).toBe(false);
    expect(isForkBuild("1.2.0-nightly.20261020.1")).toBe(false);
  });
  it("reads nightly from a nightly version and stable from anything else", () => {
    expect(installedChannel("1.0.2-nightly.20261018.42")).toBe("nightly");
    expect(installedChannel("1.0.1")).toBe("stable");
    expect(installedChannel("1.0.2-beta.1")).toBe("stable");
  });

  it("follows the installed build until a channel is chosen", () => {
    expect(DEFAULT_PREFS.updates.channel).toBeUndefined();
    expect(
      withInstalledChannel(DEFAULT_PREFS, "1.0.2-nightly.20261018.42").updates
        .channel,
    ).toBe("nightly");

    const chosen = {
      ...DEFAULT_PREFS,
      updates: { ...DEFAULT_PREFS.updates, channel: "stable" as const },
    };
    expect(
      withInstalledChannel(chosen, "1.0.2-nightly.20261018.42").updates.channel,
    ).toBe("stable");
  });
});
