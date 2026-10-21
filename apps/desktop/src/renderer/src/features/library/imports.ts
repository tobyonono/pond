import type { ReferenceImportSource } from "@shared/reference-import-contracts";
import { newMenuDialog } from "./state/new-menu-dialog";

export function openReferenceImport(source: ReferenceImportSource): void {
  newMenuDialog.open({ kind: "reference-import", source });
}
