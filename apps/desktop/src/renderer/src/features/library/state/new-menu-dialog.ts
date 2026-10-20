import type { LibraryRepairKind } from "@shared/library-repair-contracts";
import type { ReferenceImportSource } from "@shared/reference-import-contracts";
import { useSelector } from "@tanstack/react-store";
import { Store } from "@tanstack/store";

export type NewMenuDialog =
  | { kind: "reference-import"; source: ReferenceImportSource }
  | { kind: "links" }
  | { kind: "repair"; repair: LibraryRepairKind };

const store = new Store<NewMenuDialog | null>(null);

export const newMenuDialog = {
  open(kind: NewMenuDialog): void {
    store.setState(() => kind);
  },
  close(): void {
    store.setState(() => null);
  },
};

export function useNewMenuDialog(): NewMenuDialog | null {
  return useSelector(store, (state) => state);
}
