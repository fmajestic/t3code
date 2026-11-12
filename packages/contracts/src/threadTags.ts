import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { TrimmedNonEmptyString } from "./baseSchemas.ts";

/** Tags match by exact spelling and case after trimming. */
export const ThreadTag = TrimmedNonEmptyString.check(
  Schema.isMaxLength(64),
  Schema.makeFilter((value) =>
    /[\p{Cc}]/u.test(value) ? "A thread tag must be a single line of text." : true,
  ),
);
export type ThreadTag = typeof ThreadTag.Type;

/** Tags read back from storage or a peer. Lenient so a later tag rule never fails a whole thread. */
export const StoredThreadTags = Schema.Array(Schema.String).pipe(
  Schema.catchDecoding(() => Effect.succeedSome([])),
);

/** Tags of this form file a thread into a sidebar section; they are never shown or hidden as tags. */
const SECTION_THREAD_TAG_PREFIX = "section:";

export const isSectionThreadTag = (tag: string): boolean =>
  tag.startsWith(SECTION_THREAD_TAG_PREFIX);

interface NamedSection {
  readonly id: string;
  readonly name: string;
}

export const SECTION_NAME_MAX_LENGTH = 40;

export function sectionThreadTag(sectionId: string): string {
  return `${SECTION_THREAD_TAG_PREFIX}${sectionId}`;
}

function sectionIdOfTag(tag: string): string | null {
  return isSectionThreadTag(tag) ? tag.slice(SECTION_THREAD_TAG_PREFIX.length) : null;
}

/** The thread's section: the first of its section tags in display order. Unlisted ids read as loose. */
export function resolveThreadSectionId(
  tags: ReadonlyArray<string> | undefined,
  sections: ReadonlyArray<NamedSection>,
): string | null {
  if (tags === undefined || tags.length === 0) return null;
  const ids = new Set(tags.flatMap((tag) => sectionIdOfTag(tag) ?? []));
  if (ids.size === 0) return null;
  return sections.find((section) => ids.has(section.id))?.id ?? null;
}

/** The tag writes that leave the thread in `sectionId` alone, or in none for null. */
export function planSectionTagWrites(
  tags: ReadonlyArray<string> | undefined,
  sectionId: string | null,
): { readonly add: string | null; readonly remove: ReadonlyArray<string> } {
  const current = tags ?? [];
  const target = sectionId === null ? null : sectionThreadTag(sectionId);
  return {
    add: target !== null && !current.includes(target) ? target : null,
    remove: current.filter((tag) => isSectionThreadTag(tag) && tag !== target),
  };
}

export function validateSectionName(
  name: string,
  sections: ReadonlyArray<NamedSection>,
  renamingId: string | null = null,
): { readonly name: string } | { readonly error: string } {
  const trimmed = name.trim();
  if (trimmed.length === 0) return { error: "Section name cannot be empty" };
  if (trimmed.length > SECTION_NAME_MAX_LENGTH) {
    return { error: `Section names can be at most ${SECTION_NAME_MAX_LENGTH} characters` };
  }
  const folded = trimmed.toLocaleLowerCase();
  const clash = sections.find(
    (section) => section.id !== renamingId && section.name.toLocaleLowerCase() === folded,
  );
  return clash ? { error: `A section named "${clash.name}" already exists` } : { name: trimmed };
}
