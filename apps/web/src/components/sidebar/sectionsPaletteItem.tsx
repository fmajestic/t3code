import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/models";
import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import { useGT } from "gt-react";
import { FolderInputIcon, FolderXIcon } from "lucide-react";

import { usePrimarySettings } from "../../hooks/useSettings";
import {
  ADDON_ICON_CLASS,
  ITEM_ICON_CLASS,
  type CommandPaletteSubmenuItem,
} from "../CommandPalette.logic";
import { resolveThreadSectionId } from "./sections.logic";
import { useFileThreadIntoSection, useSidebarSectionsEnabled } from "./useSidebarSections";

/** "Move thread to section" for the open thread, while sidebar sections are on. */
export function useMoveToSectionPaletteItem(
  thread: EnvironmentThreadShell | null,
): CommandPaletteSubmenuItem | null {
  const gt = useGT();
  const enabled = useSidebarSectionsEnabled();
  const sections = usePrimarySettings((settings) => settings.sidebarSections);
  const fileThread = useFileThreadIntoSection();
  if (!enabled || thread === null || sections.length === 0) return null;
  const threadRef = scopeThreadRef(thread.environmentId, thread.id);
  const currentSectionId = resolveThreadSectionId(thread.source.tags, sections);
  const choices = [
    ...sections.map((section) => ({ id: section.id as string | null, name: section.name })),
    { id: null, name: gt("No section") },
  ];
  return {
    kind: "submenu",
    value: "action:move-thread-to-section",
    searchTerms: ["section", "move", "file", "group", "priority", "sidebar"],
    title: gt("Move thread to section"),
    icon: <FolderInputIcon className={ITEM_ICON_CLASS} />,
    addonIcon: <FolderInputIcon className={ADDON_ICON_CLASS} />,
    searchNoun: gt("sections"),
    groups: [
      {
        value: "move-thread-to-section",
        label: gt("Sections"),
        items: choices.map((choice) => ({
          kind: "action" as const,
          value: `move-thread-to-section:${choice.id ?? "none"}`,
          searchTerms: [choice.name],
          title: choice.name,
          ...(choice.id === currentSectionId ? { description: gt("Current") } : {}),
          icon:
            choice.id === null ? (
              <FolderXIcon className={ITEM_ICON_CLASS} />
            ) : (
              <FolderInputIcon className={ITEM_ICON_CLASS} />
            ),
          run: async () => {
            await fileThread(threadRef, choice.id);
          },
        })),
      },
    ],
  };
}
