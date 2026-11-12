import {
  type ContextMenuItem,
  planSectionTagWrites,
  type SidebarSectionSetting,
} from "@t3tools/contracts";

import {
  resolveSidebarDropTarget,
  sidebarListItemId,
  sidebarMarkerId,
  type SidebarListItem,
  type SidebarListMarker,
} from "../Sidebar.logic";

export type SidebarCustomSection = SidebarSectionSetting;

/** Whether the thread's tags already hold exactly `sectionId` and no other section. */
export function sectionTagsSettled(
  tags: ReadonlyArray<string> | undefined,
  sectionId: string | null,
): boolean {
  const writes = planSectionTagWrites(tags, sectionId);
  return writes.add === null && writes.remove.length === 0;
}

export interface ArrangedCustomSection<T> {
  readonly section: SidebarCustomSection;
  readonly collapsed: boolean;
  /** The rows on screen: all of them, or only the open thread while collapsed. */
  readonly threads: ReadonlyArray<T>;
  readonly hiddenThreads: ReadonlyArray<T>;
}

export interface ArrangedCustomSections<T> {
  readonly loose: ReadonlyArray<T>;
  readonly sections: ReadonlyArray<ArrangedCustomSection<T>>;
  /** Loose rows, then each section's rows, as they appear on screen. */
  readonly visibleThreads: ReadonlyArray<T>;
}

/** Splits the active list into loose threads and sections, keeping the list's order inside each. */
export function arrangeCustomSections<T>(input: {
  readonly threads: ReadonlyArray<T>;
  readonly sections: ReadonlyArray<SidebarCustomSection>;
  readonly sectionIdOf: (thread: T) => string | null;
  readonly keyOf: (thread: T) => string;
  readonly collapsedIds: ReadonlySet<string>;
  readonly routeKey: string | null;
}): ArrangedCustomSections<T> {
  const loose: T[] = [];
  const bySection = new Map(input.sections.map((section) => [section.id, [] as T[]]));
  for (const thread of input.threads) {
    const sectionId = input.sectionIdOf(thread);
    const bucket = sectionId === null ? undefined : bySection.get(sectionId);
    if (bucket === undefined) loose.push(thread);
    else bucket.push(thread);
  }
  const sections = input.sections.map((section) => {
    const threads = bySection.get(section.id)!;
    const collapsed = input.collapsedIds.has(section.id);
    if (!collapsed) return { section, collapsed, threads, hiddenThreads: [] };
    // A collapsed section still shows the open thread.
    const isRoute = (thread: T) => input.keyOf(thread) === input.routeKey;
    return {
      section,
      collapsed,
      threads: threads.filter(isRoute),
      hiddenThreads: threads.filter((thread) => !isRoute(thread)),
    };
  });
  return {
    loose,
    sections,
    visibleThreads: [...loose, ...sections.flatMap((section) => section.threads)],
  };
}

const CUSTOM_SECTION_MARKER_PREFIX = "custom-section:";
const PLACEHOLDER_SUFFIX = "-placeholder";

function customSectionHeaderMarker(sectionId: string): SidebarListMarker {
  return `${CUSTOM_SECTION_MARKER_PREFIX}${sectionId}`;
}

function customSectionPlaceholderMarker(sectionId: string): SidebarListMarker {
  return `${CUSTOM_SECTION_MARKER_PREFIX}${sectionId}${PLACEHOLDER_SUFFIX}`;
}

export function parseCustomSectionMarker(
  marker: SidebarListMarker,
): { readonly kind: "header" | "placeholder"; readonly sectionId: string } | null {
  if (!marker.startsWith(CUSTOM_SECTION_MARKER_PREFIX)) return null;
  const rest = marker.slice(CUSTOM_SECTION_MARKER_PREFIX.length);
  return rest.endsWith(PLACEHOLDER_SUFFIX)
    ? { kind: "placeholder", sectionId: rest.slice(0, -PLACEHOLDER_SUFFIX.length) }
    : { kind: "header", sectionId: rest };
}

type ThreadListItem = Extract<SidebarListItem, { kind: "thread" }>;

/** The active list's items: loose rows, then each section's header, drop placeholder and rows. */
export function customSectionListItems(input: {
  readonly looseKeys: ReadonlyArray<string>;
  readonly sections: ReadonlyArray<{
    readonly sectionId: string;
    readonly keys: ReadonlyArray<string>;
  }>;
}): SidebarListItem[] {
  const row = (key: string): ThreadListItem => ({ kind: "thread", key, section: "active" });
  return [
    ...input.looseKeys.map(row),
    ...input.sections.flatMap(({ sectionId, keys }): SidebarListItem[] => [
      { kind: "marker", marker: customSectionHeaderMarker(sectionId) },
      { kind: "marker", marker: customSectionPlaceholderMarker(sectionId) },
      ...keys.map(row),
    ]),
  ];
}

const isShelfMarker = (marker: SidebarListMarker) =>
  marker === "working-header" || marker === "snoozed-header" || marker === "settled-header";

/**
 * Where a drag over `overId` files the thread: its section (null for loose) and its index among
 * that section's other rows on screen. As in any sorted list, a header passed from below files
 * into the area above it; the placeholder under each header files into that section.
 * Null when the list has no sections.
 */
export function resolveCustomSectionDrop(
  items: ReadonlyArray<SidebarListItem>,
  activeKey: string,
  overId: string,
): { readonly sectionId: string | null; readonly index: number } | null {
  if (
    !items.some(
      (item) => item.kind === "marker" && parseCustomSectionMarker(item.marker)?.kind === "header",
    )
  ) {
    return null;
  }
  const activeIndex = items.findIndex((item) => sidebarListItemId(item) === activeKey);
  const overIndex = items.findIndex((item) => sidebarListItemId(item) === overId);
  if (activeIndex === -1 || overIndex === -1) return null;
  const moved = items.filter((_, index) => index !== activeIndex);
  moved.splice(overIndex, 0, items[activeIndex]!);
  let inActive = false;
  let current: string | null = null;
  const counts = new Map<string | null, number>();
  for (const item of moved) {
    if (item.kind === "marker") {
      if (item.marker === "pinned-divider") inActive = true;
      else if (isShelfMarker(item.marker)) break;
      else {
        const parsed = parseCustomSectionMarker(item.marker);
        if (parsed?.kind === "header") current = parsed.sectionId;
      }
      continue;
    }
    if (!inActive) continue;
    if (item.key === activeKey) return { sectionId: current, index: counts.get(current) ?? 0 };
    counts.set(current, (counts.get(current) ?? 0) + 1);
  }
  return { sectionId: null, index: 0 };
}

/**
 * Active orders for a drop into a section. `segmentOrder` is the section's order after the drop,
 * which key writes follow; `fullOrder` lists every active thread, section by section, to hold
 * the drop on screen until the writes land. A collapsed section takes the thread at its top.
 */
export function planCustomSectionOrders(input: {
  readonly activeKeys: ReadonlyArray<string>;
  readonly draggedKey: string;
  readonly sectionIdOf: (key: string) => string | null;
  readonly sectionIds: ReadonlyArray<string>;
  readonly target: { readonly sectionId: string | null; readonly index: number };
  readonly collapsedIds: ReadonlySet<string>;
}): {
  readonly segmentOrder: ReadonlyArray<string>;
  readonly currentSegmentOrder: ReadonlyArray<string>;
  readonly fullOrder: ReadonlyArray<string>;
} {
  const { draggedKey, target } = input;
  const listed = new Set(input.sectionIds);
  const bucketOf = (key: string) => {
    const sectionId = input.sectionIdOf(key);
    return sectionId !== null && listed.has(sectionId) ? sectionId : null;
  };
  const buckets = new Map<string | null, string[]>([
    [null, []],
    ...input.sectionIds.map((id) => [id, []] as [string, string[]]),
  ]);
  for (const key of input.activeKeys) {
    if (key !== draggedKey) buckets.get(bucketOf(key))!.push(key);
  }
  const targetRows = buckets.get(target.sectionId) ?? [];
  const index =
    target.sectionId !== null && input.collapsedIds.has(target.sectionId)
      ? 0
      : Math.min(Math.max(target.index, 0), targetRows.length);
  const segmentOrder = [...targetRows.slice(0, index), draggedKey, ...targetRows.slice(index)];
  return {
    segmentOrder,
    currentSegmentOrder: input.activeKeys.filter((key) => bucketOf(key) === target.sectionId),
    fullOrder: [null, ...input.sectionIds].flatMap((id) =>
      id === target.sectionId ? segmentOrder : buckets.get(id)!,
    ),
  };
}

/**
 * Rows of the active list while a thread is dragged: loose rows, then each section's header and
 * rows. `dragged` joins `targetSectionId` by `rank`; an empty bucket shows its drop placeholder.
 */
export function projectCustomSectionRows(input: {
  readonly items: ReadonlyArray<SidebarListItem>;
  readonly rows: ReadonlyArray<ThreadListItem>;
  readonly dragged: ThreadListItem | null;
  readonly targetSectionId: string | null;
  readonly rank: (key: string) => number;
}): SidebarListItem[] {
  const sectionOfKey = new Map<string, string | null>();
  const sectionIds: string[] = [];
  let current: string | null = null;
  for (const item of input.items) {
    if (item.kind === "thread") {
      sectionOfKey.set(item.key, current);
      continue;
    }
    const parsed = parseCustomSectionMarker(item.marker);
    if (parsed?.kind === "header") {
      current = parsed.sectionId;
      sectionIds.push(parsed.sectionId);
    } else if (item.marker === "pinned-divider") current = null;
  }
  const buckets = new Map<string | null, ThreadListItem[]>([
    [null, []],
    ...sectionIds.map((id) => [id, []] as [string, ThreadListItem[]]),
  ]);
  for (const row of input.rows) buckets.get(sectionOfKey.get(row.key) ?? null)?.push(row);
  if (input.dragged !== null) {
    const bucket = buckets.get(input.targetSectionId) ?? buckets.get(null)!;
    const rank = input.rank(input.dragged.key);
    const index = bucket.findIndex((row) => input.rank(row.key) > rank);
    bucket.splice(index < 0 ? bucket.length : index, 0, input.dragged);
  }
  const loose = buckets.get(null)!;
  return [
    ...(loose.length > 0
      ? loose
      : [{ kind: "marker", marker: "active-placeholder" } satisfies SidebarListItem]),
    ...sectionIds.flatMap((id): SidebarListItem[] => {
      const rows = buckets.get(id)!;
      return [
        { kind: "marker", marker: customSectionHeaderMarker(id) },
        ...(rows.length > 0
          ? rows
          : [{ kind: "marker", marker: customSectionPlaceholderMarker(id) } as const]),
      ];
    }),
  ];
}

/** The drag badge for a move between sections, or null when the drop keeps the thread's section. */
export function resolveCustomSectionDropLabel(input: {
  readonly targetSectionId: string | null | undefined;
  readonly currentSectionId: string | null;
  readonly sections: ReadonlyArray<SidebarCustomSection>;
}): string | null {
  const { targetSectionId, currentSectionId } = input;
  if (targetSectionId === undefined || targetSectionId === currentSectionId) return null;
  if (targetSectionId === null) return "Remove from section";
  const name = input.sections.find((section) => section.id === targetSectionId)?.name;
  return name === undefined ? null : `Move to ${name}`;
}

type SectionMenuId = `move-to-section:${string}`;
const SECTION_MENU_PREFIX = "move-to-section:";

export function isSectionMenuId(id: string): id is SectionMenuId {
  return id.startsWith(SECTION_MENU_PREFIX);
}

/** What a "Move to section" pick asks for: a section, none, or a new section. */
export function parseSectionMenuId(
  id: SectionMenuId,
): { readonly kind: "move"; readonly sectionId: string | null } | { readonly kind: "new" } {
  const rest = id.slice(SECTION_MENU_PREFIX.length);
  if (rest === "new") return { kind: "new" };
  return { kind: "move", sectionId: rest === "none" ? null : rest };
}

/** The thread menu with "Move to section" before Rename. */
export function withSectionMenu<T extends string>(
  items: ReadonlyArray<ContextMenuItem<T>>,
  sections: ReadonlyArray<SidebarCustomSection>,
  currentSectionId: string | null,
): ReadonlyArray<ContextMenuItem<T | SectionMenuId>> {
  const menu: ContextMenuItem<SectionMenuId> = {
    id: `${SECTION_MENU_PREFIX}menu`,
    label: "Move to section",
    icon: "folder",
    children: [
      ...sections.map((section) => ({
        id: `${SECTION_MENU_PREFIX}${section.id}` as const,
        label: section.name,
        checked: section.id === currentSectionId,
      })),
      {
        id: `${SECTION_MENU_PREFIX}none`,
        label: "None",
        checked: currentSectionId === null,
        separatorBefore: sections.length > 0,
      },
      { id: `${SECTION_MENU_PREFIX}new`, label: "New section…", separatorBefore: true },
    ],
  };
  const renameIndex = items.findIndex((item) => item.id === "rename");
  const index = renameIndex === -1 ? items.length : renameIndex;
  return [...items.slice(0, index), menu, ...items.slice(index)];
}

/**
 * Puts first the nearest collision that files into the section the pointer is over on screen.
 * Collisions measure untransformed rows, where an empty section's drop slot has no height, so
 * the area a drag opens up could never win by distance alone.
 */
export function preferVisualCustomSection<C extends { readonly id: string | number }>(input: {
  readonly items: ReadonlyArray<SidebarListItem>;
  readonly activeKey: string;
  readonly pointerY: number;
  readonly collisions: ReadonlyArray<C>;
  /** The on-screen rect of a sortable item, drag transforms included. */
  readonly rectOf: (id: string) => DOMRect | undefined;
}): ReadonlyArray<C> {
  const { items, activeKey, pointerY, collisions } = input;
  const nearest = collisions[0];
  if (nearest === undefined) return collisions;
  if (resolveSidebarDropTarget(items, activeKey, String(nearest.id))?.section !== "active") {
    return collisions;
  }
  let region: string | null = null;
  for (const item of items) {
    if (item.kind !== "marker") continue;
    if (isShelfMarker(item.marker)) {
      const top = input.rectOf(sidebarMarkerId(item.marker))?.top;
      if (top !== undefined && pointerY >= top) return collisions;
      break;
    }
    const parsed = parseCustomSectionMarker(item.marker);
    if (parsed?.kind !== "header") continue;
    const top = input.rectOf(sidebarMarkerId(item.marker))?.top;
    if (top !== undefined && pointerY >= top) region = parsed.sectionId;
  }
  const preferred = collisions.find(
    (collision) =>
      resolveSidebarDropTarget(items, activeKey, String(collision.id))?.section === "active" &&
      resolveCustomSectionDrop(items, activeKey, String(collision.id))?.sectionId === region,
  );
  return preferred === undefined || preferred === nearest
    ? collisions
    : [preferred, ...collisions.filter((collision) => collision !== preferred)];
}
