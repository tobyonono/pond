import { z } from "zod";
import { CaptureWebDraftSchema } from "./capture";
import { enqueueRequestSchema } from "./ingest";
import { extensionCookieSchema, sessionImportPayloadSchema } from "./session";

export const NATIVE_HOST_NAME = "so.pond.host";

/** Pinned by `manifest.key` in unpacked builds; native-host `allowed_origins` must match. */
export const EXTENSION_ID = "ihciihlcdkopghlpabpmnodncfdboplb";

/**
 * The Chrome Web Store assigns its own ID because it rejects `manifest.key` on a new listing.
 * @todo Set this to the Item ID from the Chrome Web Store dashboard once the listing exists.
 */
export const CHROME_WEB_STORE_ID: string | null = null;

/** Firefox rejects `manifest.key`, so the gecko id is pinned here for `allowed_extensions`. */
export const FIREFOX_EXTENSION_ID = "desktop@pond.so";

export const CHROMIUM_EXTENSION_IDS: readonly string[] = CHROME_WEB_STORE_ID
  ? [EXTENSION_ID, CHROME_WEB_STORE_ID]
  : [EXTENSION_ID];

export type ExtensionStore = "chrome" | "firefox";

/** Chrome, Arc, Brave, Edge, Dia, and Vivaldi install from the Chrome Web Store; Zen and other Firefox forks from AMO. */
export const EXTENSION_STORE_URLS = {
  chrome: CHROME_WEB_STORE_ID
    ? `https://chromewebstore.google.com/detail/${CHROME_WEB_STORE_ID}`
    : null,
  firefox: `https://addons.mozilla.org/firefox/addon/${encodeURIComponent(FIREFOX_EXTENSION_ID)}/`,
} satisfies Record<ExtensionStore, string | null>;

const captureIdSchema = z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/);

export const nativeRequestSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("bookmarks.capture"),
    libraryPath: z.string().min(1).max(8192),
    url: z
      .string()
      .url()
      .regex(/^https?:\/\//i),
    title: z.string().max(4096),
    folderPath: z.array(z.string().max(1024)).max(64),
  }),
  z.object({ type: z.literal("hello") }),
  z.object({
    type: z.literal("capture.accept"),
    draft: CaptureWebDraftSchema,
    cookies: z.array(extensionCookieSchema).max(500).optional(),
  }),
  z.object({ type: z.literal("capture.status"), id: captureIdSchema }),
  z.object({ type: z.literal("library.info") }),
  z.object({ type: z.literal("folders.list") }),
  z.object({ type: z.literal("tags.list") }),
  z.object({ type: z.literal("extension.settings") }),
  z.object({ type: z.literal("session.pending") }),
  enqueueRequestSchema.extend({ type: z.literal("enqueue") }),
  sessionImportPayloadSchema.extend({ type: z.literal("session.import") }),
]);

export type NativeRequest = z.infer<typeof nativeRequestSchema>;

export const nativeSuccessSchema = z.object({
  ok: z.literal(true),
  data: z.unknown(),
});

export const nativeErrorSchema = z.object({
  ok: z.literal(false),
  error: z.string(),
});

export const nativeResponseSchema = z.union([
  nativeSuccessSchema,
  nativeErrorSchema,
]);

export type NativeResponse = z.infer<typeof nativeResponseSchema>;

export type NativeMessage = NativeRequest | NativeResponse;
