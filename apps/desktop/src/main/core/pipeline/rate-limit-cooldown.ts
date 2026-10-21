import type { Source } from "@pond/schema/db";

export function rateLimitCooldownMs(
  source: Source,
  multiplier: number,
  retryAfterSec?: number,
): number {
  const fallback =
    source === "instagram"
      ? Math.min(21_600, 900 * multiplier)
      : Math.min(900, 60 * multiplier);
  const seconds =
    retryAfterSec !== undefined && Number.isFinite(retryAfterSec)
      ? retryAfterSec
      : fallback;
  return Math.max(source === "instagram" ? 900_000 : 1_000, seconds * 1_000);
}
