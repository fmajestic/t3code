import type { EnvironmentId, FilesystemBrowseResult } from "@t3tools/contracts";

import { getFilesystemBrowsePath } from "./filesystem.ts";
import { ensureBrowseDirectoryPath } from "./projects.ts";

export interface ComposerPathSearchEntry {
  readonly path: string;
  readonly kind: "file" | "directory";
  readonly parentPath?: string;
  // Query text that lists this directory's children; selecting the entry continues the path.
  readonly browseQuery?: string;
}

export interface ComposerPathSearchTarget {
  readonly environmentId: EnvironmentId | null;
  readonly cwd: string | null;
  readonly query: string | null;
}

/** Paths that may leave the project list one directory at a time, so they never start a recursive scan. */
export function getComposerPathBrowse(query: string | null) {
  if (query === null) return null;
  const browse = getFilesystemBrowsePath(query, "windows");
  return browse.isBrowsing ? browse : null;
}

/** Menu label and dimmed location for an entry; browsed entries carry the server's separators. */
export function describeComposerPathEntry(path: string) {
  const separatorIndex = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return {
    label: path.slice(separatorIndex + 1) || path,
    description: separatorIndex > 0 ? path.slice(0, separatorIndex) : "",
  };
}

// Matches anywhere in the name, names starting with the query first; dot entries need a leading `.`.
function matchComposerBrowseEntries(
  entries: FilesystemBrowseResult["entries"],
  query: string,
): FilesystemBrowseResult["entries"] {
  const lowerQuery = query.toLowerCase();
  const showHidden = query.startsWith(".");
  const prefixMatches: Array<FilesystemBrowseResult["entries"][number]> = [];
  const innerMatches: Array<FilesystemBrowseResult["entries"][number]> = [];
  for (const entry of entries) {
    if (!showHidden && entry.name.startsWith(".")) continue;
    const index = entry.name.toLowerCase().indexOf(lowerQuery);
    if (index === 0) prefixMatches.push(entry);
    else if (index > 0) innerMatches.push(entry);
  }
  return [...prefixMatches, ...innerMatches];
}

export function buildComposerPathBrowseEntries(
  directoryPath: string,
  filterQuery: string,
  result: FilesystemBrowseResult,
): ReadonlyArray<ComposerPathSearchEntry> {
  const children = matchComposerBrowseEntries(result.entries, filterQuery).map(
    (entry): ComposerPathSearchEntry =>
      entry.kind === "file"
        ? { path: entry.fullPath, kind: "file" }
        : {
            path: entry.fullPath,
            kind: "directory",
            browseQuery: ensureBrowseDirectoryPath(`${directoryPath}${entry.name}`),
          },
  );
  // A bare directory lists itself first, so the folder can be mentioned without entering it.
  return filterQuery.length === 0
    ? [{ path: result.parentPath, kind: "directory" }, ...children]
    : children;
}
