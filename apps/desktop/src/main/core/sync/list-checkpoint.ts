/** A batch cap must not mark history complete or advance past items not yet queued. */
export function listSyncCheckpoint(
  harvest: { reachedEnd: boolean; resumeCursor?: string },
  fresh: number,
  totalFresh: number,
) {
  if (fresh < totalFresh) return { reachedEnd: false, resumeCursor: undefined };
  return {
    reachedEnd: harvest.reachedEnd,
    resumeCursor: harvest.reachedEnd ? null : (harvest.resumeCursor ?? null),
  };
}
