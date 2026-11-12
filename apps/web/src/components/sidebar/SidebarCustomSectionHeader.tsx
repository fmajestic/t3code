import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/models";
import { scopedThreadKey, scopeThreadRef } from "@t3tools/client-runtime/environment";
import { PlusIcon } from "lucide-react";
import {
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

import { cn } from "~/lib/utils";
import { useUiStateStore } from "../../uiStateStore";
import {
  resolveSidebarFolderDot,
  resolveThreadLastVisitedAt,
  type SidebarListMarker,
} from "../Sidebar.logic";
import { CollapsibleSectionHeader } from "../ui/collapsible-section-header";
import { SortableSidebarMarker } from "./SidebarListMarkers";
import {
  parseCustomSectionMarker,
  SECTION_NAME_MAX_LENGTH,
  type ArrangedCustomSections,
  type SidebarCustomSection,
} from "./sections.logic";
import type { useSidebarSections } from "./useSidebarSections";

type SidebarSectionsControls = ReturnType<typeof useSidebarSections>;

const DOT_CLASS_NAME = {
  attention: "bg-warning",
  failed: "bg-error",
  unread: "bg-success",
  working: "bg-info",
} as const;

const DOT_LABEL = {
  attention: ", needs you",
  failed: ", failed",
  unread: ", done",
  working: ", working",
} as const;

const SECTION_DRAG_TYPE = "application/x-t3code-sidebar-section";

/** Enter submits, Escape cancels, and leaving the field submits a changed name. */
function SectionNameInput(props: {
  initialName: string;
  label: string;
  onSubmit: (name: string) => boolean;
  onCancel: () => void;
}) {
  const [name, setName] = useState(props.initialName);
  // Enter and Escape blur the input as it unmounts; that blur must not submit again.
  const settledRef = useRef(false);
  const handleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    event.stopPropagation();
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    if (event.key === "Enter") {
      event.preventDefault();
      settledRef.current = props.onSubmit(name);
    } else if (event.key === "Escape") {
      event.preventDefault();
      settledRef.current = true;
      props.onCancel();
    }
  };
  return (
    <input
      autoFocus
      value={name}
      dir="auto"
      aria-label={props.label}
      placeholder="Section name"
      maxLength={SECTION_NAME_MAX_LENGTH}
      onChange={(event) => setName(event.target.value)}
      onFocus={(event) => event.currentTarget.select()}
      onKeyDown={handleKeyDown}
      onBlur={() => {
        if (settledRef.current) return;
        const changed = name.trim() !== "" && name.trim() !== props.initialName;
        if (!changed || !props.onSubmit(name)) props.onCancel();
      }}
      className="h-7 min-w-0 flex-1 rounded-sm border border-input bg-card px-1.5 text-xs font-medium text-card-foreground outline-none focus:border-foreground"
    />
  );
}

function SidebarCustomSectionHeader(props: {
  marker: `custom-section:${string}`;
  section: SidebarCustomSection;
  collapsed: boolean;
  hiddenThreads: ReadonlyArray<EnvironmentThreadShell>;
  dragging: boolean;
  isDropTarget: boolean;
  renaming: boolean;
  onToggle: (sectionId: string) => void;
  onContextMenu: (section: SidebarCustomSection, position: { x: number; y: number }) => void;
  onRename: (sectionId: string, name: string) => boolean;
  onCancelRename: () => void;
  onReorder: (sectionId: string, targetId: string, place: "before" | "after") => void;
}) {
  const { section, collapsed, hiddenThreads } = props;
  const [reorderPlace, setReorderPlace] = useState<"before" | "after" | null>(null);
  const localLastVisitedAtById = useUiStateStore((state) => state.threadLastVisitedAtById);
  const dot = collapsed
    ? resolveSidebarFolderDot(
        hiddenThreads.map((thread) => ({
          ...thread,
          lastVisitedAt: resolveThreadLastVisitedAt(
            thread.lastVisitedAt,
            localLastVisitedAtById[
              scopedThreadKey(scopeThreadRef(thread.environmentId, thread.id))
            ],
          ),
        })),
      )
    : null;
  const placeOf = (event: ReactDragEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return event.clientY < rect.top + rect.height / 2 ? "before" : "after";
  };
  return (
    <SortableSidebarMarker
      marker={props.marker}
      data-testid="sidebar-custom-section-header"
      className="relative mx-0.5 h-8"
    >
      {props.renaming ? (
        <div className="flex h-8 items-center px-1">
          <SectionNameInput
            initialName={section.name}
            label="Section name"
            onSubmit={(name) => props.onRename(section.id, name)}
            onCancel={props.onCancelRename}
          />
        </div>
      ) : (
        // Sections reorder by native drag, apart from the thread list's pointer drag.
        <div
          draggable={!props.dragging}
          onDragStart={(event) => {
            event.dataTransfer.setData(SECTION_DRAG_TYPE, section.id);
            event.dataTransfer.effectAllowed = "move";
          }}
          onDragOver={(event) => {
            if (!event.dataTransfer.types.includes(SECTION_DRAG_TYPE)) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
            setReorderPlace(placeOf(event));
          }}
          onDragLeave={() => setReorderPlace(null)}
          onDrop={(event) => {
            setReorderPlace(null);
            const draggedId = event.dataTransfer.getData(SECTION_DRAG_TYPE);
            if (draggedId === "" || draggedId === section.id) return;
            event.preventDefault();
            props.onReorder(draggedId, section.id, placeOf(event));
          }}
          className={cn(
            "relative",
            reorderPlace !== null &&
              "after:pointer-events-none after:absolute after:inset-x-2 after:h-0.5 after:rounded-full after:bg-primary",
            reorderPlace === "before" && "after:-top-px",
            reorderPlace === "after" && "after:-bottom-px",
          )}
        >
          <CollapsibleSectionHeader
            data-sidebar-row={`section:${section.id}`}
            onClick={() => props.onToggle(section.id)}
            onContextMenu={(event) => {
              event.preventDefault();
              props.onContextMenu(section, { x: event.clientX, y: event.clientY });
            }}
            expanded={!collapsed}
            tone={props.isDropTarget ? "accent" : props.dragging ? "emphasized" : "muted"}
            accessory={
              collapsed ? (
                <span className="flex shrink-0 items-center gap-1.5 font-normal tabular-nums">
                  {dot ? (
                    <span className={cn("size-1.5 rounded-full", DOT_CLASS_NAME[dot])}>
                      <span className="sr-only">{DOT_LABEL[dot]}</span>
                    </span>
                  ) : null}
                  {hiddenThreads.length}
                </span>
              ) : undefined
            }
          >
            {section.name}
          </CollapsibleSectionHeader>
        </div>
      )}
    </SortableSidebarMarker>
  );
}

function SidebarCustomSectionPlaceholder(props: {
  marker: `custom-section:${string}`;
  label: string;
  showHint: boolean;
  isDropTarget: boolean;
}) {
  return (
    <SortableSidebarMarker marker={props.marker} className="relative mx-0.5 -mb-px h-0">
      {props.showHint ? (
        <div
          className={cn(
            "absolute inset-x-0 top-0 flex h-9 items-center justify-center truncate rounded-md border border-dashed border-sidebar-foreground/25 px-2 text-xs text-sidebar-foreground/80",
            props.isDropTarget && "border-primary/40 bg-primary/5 text-primary",
          )}
        >
          {props.label}
        </div>
      ) : null}
    </SortableSidebarMarker>
  );
}

/** A section's header or drop placeholder in the sidebar list. */
export function SidebarCustomSectionMarker(props: {
  marker: SidebarListMarker;
  groups: ArrangedCustomSections<EnvironmentThreadShell>;
  controls: SidebarSectionsControls;
  dragging: boolean;
  /** The section a thread drag would file into: null for none, undefined outside the active list. */
  dropTargetId: string | null | undefined;
  showDropHint: (keys: ReadonlyArray<string>, isTarget: boolean) => boolean;
}) {
  const { controls } = props;
  const parsed = parseCustomSectionMarker(props.marker);
  const group = props.groups.sections.find(({ section }) => section.id === parsed?.sectionId);
  if (parsed === null || group === undefined) return null;
  const marker = props.marker as `custom-section:${string}`;
  const isDropTarget = props.dropTargetId === group.section.id;
  if (parsed.kind === "placeholder") {
    return (
      <SidebarCustomSectionPlaceholder
        marker={marker}
        label={group.section.name}
        showHint={props.showDropHint(
          group.threads.map((thread) =>
            scopedThreadKey(scopeThreadRef(thread.environmentId, thread.id)),
          ),
          isDropTarget,
        )}
        isDropTarget={isDropTarget}
      />
    );
  }
  return (
    <SidebarCustomSectionHeader
      marker={marker}
      section={group.section}
      collapsed={group.collapsed}
      hiddenThreads={group.hiddenThreads}
      dragging={props.dragging}
      isDropTarget={isDropTarget}
      renaming={
        controls.editor?.kind === "rename" && controls.editor.sectionId === group.section.id
      }
      onToggle={controls.toggleSection}
      onContextMenu={controls.openSectionMenu}
      onRename={controls.renameSection}
      onCancelRename={controls.cancelEdit}
      onReorder={controls.reorderSection}
    />
  );
}

/** "+ Section", or its name field while a section is being created. */
export function SidebarAddSection(props: {
  controls: SidebarSectionsControls;
  // Rows travel over this slot while a thread drags; it keeps its space but hides.
  hidden: boolean;
}) {
  const { controls } = props;
  return (
    <li className={cn("mx-0.5 list-none", props.hidden && "invisible")}>
      {controls.editor?.kind === "create" ? (
        <div className="flex h-8 items-center px-1">
          <SectionNameInput
            initialName=""
            label="New section name"
            onSubmit={controls.createSection}
            onCancel={controls.cancelEdit}
          />
        </div>
      ) : (
        <button
          type="button"
          data-testid="sidebar-add-section"
          onClick={() => controls.startCreate()}
          className="flex h-8 w-full cursor-pointer items-center gap-1.5 rounded-md px-2 text-left text-xs font-medium text-sidebar-muted-foreground hover:bg-sidebar-row-hover hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/70"
        >
          <PlusIcon aria-hidden className="size-3.5" />
          Section
        </button>
      )}
    </li>
  );
}
