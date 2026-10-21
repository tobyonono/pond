import { IconPlus } from "@pond/icons";
import { Menu } from "@pond/ui";
import { useQueryClient } from "@tanstack/react-query";
import { openReferenceImport } from "@/features/library/imports";
import { startConnect, startWatch } from "@/features/sources/lib/create";
import { buildSourceNewMenuItems } from "@/features/sources/lib/create-menu";
import { pickWatchedFolder } from "@/features/sources/lib/watched-folder";
import {
  sourceNewMenu,
  useSourceNewMenuOpen,
} from "@/features/sources/state/source-new-menu";

export function NewSourceMenu({
  children: label = "New Source",
  controlled = false,
  onWatchedFolder,
}: {
  children?: string;
  controlled?: boolean;
  onWatchedFolder?: () => void;
} = {}) {
  const storedOpen = useSourceNewMenuOpen();
  const client = useQueryClient();

  function chooseWatchedFolder(): void {
    if (onWatchedFolder) {
      onWatchedFolder();
      return;
    }
    void pickWatchedFolder().then(() =>
      client.invalidateQueries({ queryKey: ["watched-folder"] }),
    );
  }

  return (
    <Menu.Root
      {...(controlled
        ? {
            open: storedOpen,
            onOpenChange: (next: boolean) => sourceNewMenu.setOpen(next),
          }
        : {})}
    >
      <Menu.Trigger
        variant="ghost"
        size="sm"
        icon
        aria-label={label}
        data-sources-new={controlled || undefined}
      >
        <IconPlus />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner align="end" side="bottom">
          <Menu.Popup>
            <Menu.Items
              items={buildSourceNewMenuItems({
                onConnect: (source) => void startConnect(source),
                onImport: openReferenceImport,
                onWatch: startWatch,
                onFolder: chooseWatchedFolder,
              })}
            />
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
