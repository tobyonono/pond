import {
  asText,
  at,
  isRecord,
  type JsonValue,
  parseJsonValue,
} from "@/utils/json";

export function letterboxdSavedIds(
  url: string,
  method: string,
  body: string | null,
  response: JsonValue,
): string[] {
  if (
    !isRecord(response) ||
    response.result === false ||
    response.success === false ||
    response.error ||
    (Array.isArray(response.errors) && response.errors.length > 0)
  )
    return [];
  let path: string;
  try {
    path = new URL(url, "https://letterboxd.com").pathname;
  } catch {
    return [];
  }
  const json = parseJsonValue(body);
  const watch = path.match(/\/me\/watchlist\/([A-Za-z0-9]+)\/?$/);
  if (method === "PATCH" && watch?.[1] && at(json, "inWatchlist") === true)
    return [watch[1]];
  if (method !== "POST" || !body) return [];
  if (/\/watchlist\/add-films\/?$/.test(path)) {
    const entries = parseJsonValue(new URLSearchParams(body).get("entries"));
    if (!Array.isArray(entries)) return [];
    return entries.flatMap((entry) => {
      const production = at(entry, "production");
      const id = asText(production) ?? asText(at(production, "lid"));
      return id && /^[A-Za-z0-9]+$/.test(id) ? [id] : [];
    });
  }
  return [];
}

/** Current first-party watched toggle and diary form use a production UID, not a short-link id. */
export function letterboxdActivityIds(
  url: string,
  method: string,
  body: string | null,
  response: JsonValue,
): Array<{ id: string; trigger: "watched" | "diary" }> {
  if (
    method !== "POST" ||
    !body ||
    !isRecord(response) ||
    response.result !== true ||
    response.error
  )
    return [];
  const path = new URL(url, "https://letterboxd.com").pathname;
  const form = new URLSearchParams(body);
  const watched = path.match(/^\/s\/(film:\d+)\/watch\/?$/)?.[1];
  if (watched && form.get("watched") === "true" && response.watched === true)
    return [{ id: watched, trigger: "watched" }];
  if (/^\/s\/save-diary-entry\/?$/.test(path) && form.get("draft") !== "true") {
    const uid = form.get("viewingableUid");
    if (uid && /^film:\d+$/.test(uid)) return [{ id: uid, trigger: "diary" }];
  }
  return [];
}
