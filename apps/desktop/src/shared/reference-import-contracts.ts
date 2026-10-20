import { z } from "zod";

export const ReferenceImportSourceSchema = z.enum([
  "goodreads",
  "letterboxd",
  "bookmarks",
]);
export type ReferenceImportSource = z.infer<typeof ReferenceImportSourceSchema>;

export interface ReferenceImportPreview {
  path: string;
  name: string;
  count: number;
  folders: { id: string; name: string; parentId: string | null }[];
  rootCount: number;
  tmdbConfigured: boolean;
}

export interface ReferenceImportsInputs {
  "sources.previewImport": { source: ReferenceImportSource };
  "sources.importReferences": {
    source: ReferenceImportSource;
    path: string;
    folderIds?: string[];
    includeRoot?: boolean;
  };
  "sources.importLetterboxdRss": { username: string };
  "sources.setTmdbKey": { key: string };
}

export interface ReferenceImportCounts {
  imported: number;
  skipped: number;
  failed: number;
  warnings: string[];
}

export interface ReferenceImportsResults {
  "sources.previewImport": ReferenceImportPreview | null;
  "sources.importReferences": ReferenceImportCounts;
  "sources.importLetterboxdRss": ReferenceImportCounts;
  "sources.setTmdbKey": { configured: boolean };
}
