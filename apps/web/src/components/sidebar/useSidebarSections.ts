import { scopedThreadKey, scopeThreadRef } from "@t3tools/client-runtime/environment";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/models";
import {
  isAtomCommandInterrupted,
  settlePromise,
  squashAtomCommandFailure,
  type AtomCommandResult,
} from "@t3tools/client-runtime/state/runtime";
import {
  planSectionTagWrites,
  resolveThreadSectionId,
  sectionThreadTag,
  validateSectionName,
  type ContextMenuItem,
  type LocalApi,
  type ScopedThreadRef,
} from "@t3tools/contracts";
import * as Schema from "effect/Schema";
import { AsyncResult } from "effect/reactivity";
import { useState } from "react";

import { useLocalStorage } from "../../hooks/useLocalStorage";
import { randomUUID } from "../../lib/utils";
import {
  useClientSettings,
  usePrimarySettings,
  useUpdatePrimarySettings,
} from "../../hooks/useSettings";
import { readLocalApi } from "../../localApi";
import { readThreadShell } from "../../state/entities";
import { threadEnvironment } from "../../state/threads";
import { useOrchestrationCommand } from "../../state/use-orchestration-command";
import { stackedThreadToast, toastManager } from "../ui/toast";
import { sectionTagsSettled, withSectionMenu, type SidebarCustomSection } from "./sections.logic";

const COLLAPSED_SECTIONS_KEY = "t3code:sidebar:collapsed-sections";
const CollapsedSectionIds = Schema.Array(Schema.String);
const NO_PENDING_MOVES: ReadonlyMap<string, string | null> = new Map();

const threadTags = (thread: Pick<EnvironmentThreadShell, "source">) => thread.source.tags;

function sameSections(
  left: ReadonlyArray<SidebarCustomSection>,
  right: ReadonlyArray<SidebarCustomSection>,
): boolean {
  return (
    left.length === right.length &&
    left.every((section, index) => {
      const other = right[index]!;
      return section.id === other.id && section.name === other.name;
    })
  );
}

function reportMoveFailure(result: AtomCommandResult<unknown, unknown>) {
  if (result._tag !== "Failure" || isAtomCommandInterrupted(result)) return;
  const error = squashAtomCommandFailure(result);
  toastManager.add(
    stackedThreadToast({
      type: "error",
      title: "Failed to move thread to section",
      description: error instanceof Error ? error.message : "An error occurred.",
    }),
  );
}

/** Files a thread into a section, or out of every section for null. */
export function useFileThreadIntoSection() {
  const setTag = useOrchestrationCommand(threadEnvironment.setTag, { reportFailure: false });
  return async (
    threadRef: ScopedThreadRef,
    sectionId: string | null,
  ): Promise<AtomCommandResult<unknown, unknown>> => {
    const writes = planSectionTagWrites(readThreadShell(threadRef)?.source.tags, sectionId);
    const tagWrites = [
      ...(writes.add === null ? [] : [{ tag: writes.add, tagged: true }]),
      ...writes.remove.map((tag) => ({ tag, tagged: false })),
    ];
    let result: AtomCommandResult<unknown, unknown> = AsyncResult.success(undefined);
    for (const write of tagWrites) {
      result = await setTag({
        environmentId: threadRef.environmentId,
        input: { threadId: threadRef.threadId, ...write },
      });
      if (result._tag === "Failure") break;
    }
    reportMoveFailure(result);
    return result;
  };
}

export function useSidebarSectionsEnabled(): boolean {
  return useClientSettings((settings) => settings.sectionsSidebarEnabled);
}

type SectionEditor =
  | { readonly kind: "create"; readonly fileThread: ScopedThreadRef | null }
  | { readonly kind: "rename"; readonly sectionId: string };

export function useSidebarSections(threads: ReadonlyArray<EnvironmentThreadShell>) {
  const enabled = useSidebarSectionsEnabled();
  const savedSections = usePrimarySettings((settings) => settings.sidebarSections);
  const updateSettings = useUpdatePrimarySettings();
  const fileThreadIntoSection = useFileThreadIntoSection();
  const [collapsedList, setCollapsedList] = useLocalStorage(
    COLLAPSED_SECTIONS_KEY,
    [] as ReadonlyArray<string>,
    CollapsedSectionIds,
  );
  const [editor, setEditor] = useState<SectionEditor | null>(null);

  // Holds a written list on screen until the server settings echo it back.
  const [writtenSections, setWrittenSections] =
    useState<ReadonlyArray<SidebarCustomSection> | null>(null);
  if (writtenSections !== null && sameSections(writtenSections, savedSections)) {
    setWrittenSections(null);
  }
  const sections = writtenSections ?? savedSections;

  const threadByKey = new Map(
    threads.map((thread) => [
      scopedThreadKey(scopeThreadRef(thread.environmentId, thread.id)),
      thread,
    ]),
  );
  // Holds a moved thread in its new section until its tags land.
  const [pendingMoves, setPendingMoves] = useState(NO_PENDING_MOVES);
  if (pendingMoves.size > 0) {
    const unsettled = [...pendingMoves].filter(([key, sectionId]) => {
      const thread = threadByKey.get(key);
      return thread !== undefined && !sectionTagsSettled(threadTags(thread), sectionId);
    });
    if (unsettled.length !== pendingMoves.size) setPendingMoves(new Map(unsettled));
  }

  const saveSections = (next: ReadonlyArray<SidebarCustomSection>) => {
    setWrittenSections(next);
    updateSettings({ sidebarSections: next }, { onFailed: () => setWrittenSections(null) });
  };

  const sectionIdOfKey = (key: string): string | null => {
    const pending = pendingMoves.get(key);
    if (pending !== undefined) return pending;
    const thread = threadByKey.get(key);
    return thread === undefined ? null : resolveThreadSectionId(threadTags(thread), sections);
  };
  const sectionIdOf = (thread: Pick<EnvironmentThreadShell, "environmentId" | "id">) =>
    sectionIdOfKey(scopedThreadKey(scopeThreadRef(thread.environmentId, thread.id)));

  const fileThread = async (threadRef: ScopedThreadRef, sectionId: string | null) => {
    const key = scopedThreadKey(threadRef);
    const thread = readThreadShell(threadRef);
    if (thread === null || sectionTagsSettled(thread.source.tags, sectionId)) {
      return AsyncResult.success(undefined);
    }
    setPendingMoves((current) => new Map(current).set(key, sectionId));
    const result = await fileThreadIntoSection(threadRef, sectionId);
    if (result._tag === "Failure") {
      setPendingMoves((current) => {
        const next = new Map(current);
        next.delete(key);
        return next;
      });
    }
    return result;
  };

  const submitName = (name: string, renamingId: string | null) => {
    const validated = validateSectionName(name, sections, renamingId);
    if ("error" in validated) {
      toastManager.add({ type: "warning", title: validated.error });
      return null;
    }
    return validated.name;
  };

  const createSection = (name: string): boolean => {
    if (editor?.kind !== "create") return true;
    const validName = submitName(name, null);
    if (validName === null) return false;
    const section = { id: randomUUID(), name: validName };
    saveSections([...sections, section]);
    setEditor(null);
    if (editor.fileThread !== null) void fileThread(editor.fileThread, section.id);
    return true;
  };

  const renameSection = (sectionId: string, name: string): boolean => {
    const validName = submitName(name, sectionId);
    if (validName === null) return false;
    setEditor(null);
    if (sections.some((section) => section.id === sectionId && section.name !== validName)) {
      saveSections(
        sections.map((section) =>
          section.id === sectionId ? { ...section, name: validName } : section,
        ),
      );
    }
    return true;
  };

  const deleteSection = async (section: SidebarCustomSection) => {
    const tag = sectionThreadTag(section.id);
    const members = threads.filter((thread) => threadTags(thread)?.includes(tag) === true);
    if (members.length > 0) {
      const api = readLocalApi();
      if (!api) return;
      const confirmed = await settlePromise(() =>
        api.dialogs.confirm(
          [
            `Delete section "${section.name}"?`,
            `Its ${members.length === 1 ? "thread moves" : `${members.length} threads move`} out of the section. No thread is deleted.`,
          ].join("\n"),
          { variant: "destructive" },
        ),
      );
      if (confirmed._tag === "Failure" || !confirmed.value) return;
    }
    saveSections(sections.filter((candidate) => candidate.id !== section.id));
    setCollapsedList((current) => current.filter((id) => id !== section.id));
    for (const thread of members) {
      void fileThreadIntoSection(scopeThreadRef(thread.environmentId, thread.id), null);
    }
  };

  const reorderSection = (sectionId: string, targetId: string, place: "before" | "after") => {
    const moved = sections.find((section) => section.id === sectionId);
    if (moved === undefined) return;
    const rest = sections.filter((section) => section.id !== sectionId);
    const targetIndex = rest.findIndex((section) => section.id === targetId);
    if (targetIndex === -1) return;
    const index = place === "before" ? targetIndex : targetIndex + 1;
    const next = [...rest.slice(0, index), moved, ...rest.slice(index)];
    if (!sameSections(next, sections)) saveSections(next);
  };

  const openSectionMenu = async (
    section: SidebarCustomSection,
    position: { x: number; y: number },
  ) => {
    const api = readLocalApi();
    if (!api) return;
    const clicked = await settlePromise(() =>
      api.contextMenu.show(
        [
          { id: "rename", label: "Rename section", icon: "pencil" },
          { id: "delete", label: "Delete section", icon: "trash", destructive: true },
        ],
        position,
      ),
    );
    if (clicked._tag === "Failure") return;
    if (clicked.value === "rename") setEditor({ kind: "rename", sectionId: section.id });
    else if (clicked.value === "delete") await deleteSection(section);
  };

  /** Shows a thread's menu, with "Move to section" while sections are on. */
  const showThreadMenu = <T extends string>(
    api: LocalApi,
    thread: Pick<EnvironmentThreadShell, "environmentId" | "id">,
    items: ReadonlyArray<ContextMenuItem<T>>,
    position: { x: number; y: number },
  ) =>
    api.contextMenu.show(
      enabled ? withSectionMenu(items, sections, sectionIdOf(thread)) : items,
      position,
    );

  const collapsedIds = new Set(collapsedList);
  const toggleSection = (sectionId: string) =>
    setCollapsedList((current) =>
      current.includes(sectionId)
        ? current.filter((id) => id !== sectionId)
        : [...current, sectionId],
    );

  return {
    enabled,
    sections,
    collapsedIds,
    sectionIdOf,
    sectionIdOfKey,
    fileThread,
    showThreadMenu,
    editor,
    startCreate: (fileThreadRef: ScopedThreadRef | null = null) =>
      setEditor({ kind: "create", fileThread: fileThreadRef }),
    startRename: (sectionId: string) => setEditor({ kind: "rename", sectionId }),
    cancelEdit: () => setEditor(null),
    createSection,
    renameSection,
    openSectionMenu,
    reorderSection,
    toggleSection,
  };
}
