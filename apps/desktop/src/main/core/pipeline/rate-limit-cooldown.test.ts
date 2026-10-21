import { describe, expect, it } from "vitest";
import { rateLimitCooldownMs } from "./rate-limit-cooldown";

describe("rate limit cooldown", () => {
  it("gives Instagram at least fifteen minutes, backing off further after repeated limits", () => {
    expect(rateLimitCooldownMs("instagram", 1)).toBe(900_000);
    expect(rateLimitCooldownMs("instagram", 2)).toBe(1_800_000);
    expect(rateLimitCooldownMs("instagram", 100)).toBe(21_600_000);
    expect(rateLimitCooldownMs("instagram", 1, 10)).toBe(900_000);
  });
  it("honors a longer server Retry-After", () => {
    expect(rateLimitCooldownMs("instagram", 1, 86_400)).toBe(86_400_000);
  });
  it("keeps existing behavior for other sources and rejects invalid durations", () => {
    expect(rateLimitCooldownMs("twitter", 1)).toBe(60_000);
    expect(rateLimitCooldownMs("twitter", 2, 120)).toBe(120_000);
    expect(rateLimitCooldownMs("instagram", 1, Number.NaN)).toBe(900_000);
  });
});
