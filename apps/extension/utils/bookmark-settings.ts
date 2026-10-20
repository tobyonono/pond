import { storage } from "wxt/utils/storage";
import { z } from "zod";

export const BookmarkSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  folderIds: z.array(z.string()).default([]),
  libraryPath: z.string().default(""),
  libraryName: z.string().default(""),
  generation: z.string().default(""),
});
export type BookmarkSettings = z.infer<typeof BookmarkSettingsSchema>;

export const bookmarkSettings = storage.defineItem<BookmarkSettings>(
  "local:bookmarkSync",
  {
    fallback: {
      enabled: false,
      folderIds: [],
      libraryPath: "",
      libraryName: "",
      generation: "",
    },
  },
);

export const bookmarkStatus = storage.defineItem<{
  pending: number;
  error: string | null;
  lastSync: number | null;
}>("local:bookmarkSyncStatus", {
  fallback: { pending: 0, error: null, lastSync: null },
});
