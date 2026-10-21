import type { ImportCollection } from "@pond/schema/db";
import type { ImportCollectionOption } from "@shared/import-scope";
import { report } from "../../../pipeline/rate-governor";
import { runOnSourcePage } from "../../harvest-window/page-run";
import type { ListHarvestArgs, ListHarvestResult } from "../list-types";
import {
  buildReferenceListingExpression,
  type ReferenceReply,
  ReferenceReplySchema,
  type ReferenceSyncSource,
} from "./listing";
import {
  referenceCollections,
  referenceListingUrl,
  validReferencePageUrl,
  walkReferenceLibrary,
} from "./walk";

async function readPage(
  source: ReferenceSyncSource,
  handle: string,
  url: string,
  list: string,
  partition: string,
): Promise<ReferenceReply> {
  if (!validReferencePageUrl(source, handle, url))
    return { ok: false, reason: "no_match" };
  const home =
    source === "goodreads"
      ? "https://www.goodreads.com/"
      : "https://letterboxd.com/";
  const result = await runOnSourcePage(
    source,
    home,
    buildReferenceListingExpression(source, url, list),
    { partition, timeoutMs: 60_000 },
  );
  if (!result.ok)
    return {
      ok: false,
      reason: result.reason === "auth_required" ? "auth_required" : "unknown",
    };
  const parsed = ReferenceReplySchema.safeParse(result.value);
  if (!parsed.success) return { ok: false, reason: "no_match" };
  const reply = parsed.data;
  if (!reply.ok && reply.reason === "rate_limited")
    report(source, {
      ok: false,
      rateLimited: true,
      retryAfterSec: reply.retryAfterSec,
    });
  else if (reply.ok) report(source, { ok: true });
  return reply;
}

export async function harvestReferenceLibrary(
  source: ReferenceSyncSource,
  args: ListHarvestArgs & { accountKey?: string; freshLimit?: number },
  partition: string,
  collections?: readonly ImportCollection[],
): Promise<ListHarvestResult> {
  if (!args.accountKey) return { ok: false, reason: "auth_required" };
  const handle = args.accountKey;
  return walkReferenceLibrary(
    source,
    handle,
    args,
    (url, list) => readPage(source, handle, url, list, partition),
    collections,
  );
}

export async function listReferenceCollections(
  source: ReferenceSyncSource,
  handle: string | undefined,
  partition: string,
): Promise<
  | { ok: true; collections: ImportCollectionOption[] }
  | { ok: false; reason: "auth_required" | "rate_limited" | "unknown" }
> {
  if (!handle) return { ok: false, reason: "auth_required" };
  if (source === "letterboxd")
    return { ok: true, collections: referenceCollections() };
  const reply = await readPage(
    source,
    handle,
    referenceListingUrl(source, handle, "collections"),
    "collections",
    partition,
  );
  return reply.ok
    ? { ok: true, collections: reply.collections }
    : {
        ok: false,
        reason: reply.reason === "no_match" ? "unknown" : reply.reason,
      };
}
