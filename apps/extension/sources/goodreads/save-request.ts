import {
  asText,
  at,
  isRecord,
  type JsonValue,
  parseJsonValue,
} from "@/utils/json";

export interface GoodreadsSave {
  bookId: string;
  shelf: string;
}

export function goodreadsSaveRequest(
  body: string | null,
  response: JsonValue,
  resolveBook: (id: string) => string | null,
): GoodreadsSave | null {
  const request = parseJsonValue(body);
  const errors = at(response, "errors");
  if (!isRecord(request) || (Array.isArray(errors) && errors.length > 0))
    return null;
  if (
    asText(request.operationName) !== "ShelveBook" &&
    !asText(request.query)?.includes("mutation ShelveBook")
  )
    return null;
  if (!isRecord(at(response, "data", "shelveBook", "shelving"))) return null;
  const id = asText(at(request, "variables", "input", "id"));
  const shelf = asText(at(request, "variables", "input", "shelfName"));
  if (!id || !shelf) return null;
  const bookId = /^\d+$/.test(id) ? id : resolveBook(id);
  return bookId && /^\d+$/.test(bookId) ? { bookId, shelf } : null;
}

/** Initial page state and GraphQL book responses connect opaque IDs to public book URLs. */
export function collectGoodreadsBookIds(
  value: JsonValue,
  ids: Map<string, string>,
  depth = 0,
): void {
  if (depth > 30 || !value) return;
  if (Array.isArray(value)) {
    for (const child of value) collectGoodreadsBookIds(child, ids, depth + 1);
    return;
  }
  if (!isRecord(value)) return;
  const id = asText(value.id);
  const legacy =
    asText(value.legacyId) ?? (value.legacyId ? String(value.legacyId) : null);
  if (
    id &&
    legacy &&
    /^\d+$/.test(legacy) &&
    (value.__typename === "Book" ||
      asText(value.webUrl)?.includes("/book/show/"))
  )
    ids.set(id, legacy);
  for (const [key, child] of Object.entries(value)) {
    if (key === "apolloState")
      collectGoodreadsBookIds(
        asText(child) ? parseJsonValue(asText(child) ?? null) : child,
        ids,
        depth + 1,
      );
    else collectGoodreadsBookIds(child, ids, depth + 1);
  }
}
