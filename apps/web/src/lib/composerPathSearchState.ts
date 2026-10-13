import {
  getComposerPathBrowse,
  type ComposerPathSearchState,
  type ComposerPathSearchTarget,
} from "@t3tools/client-runtime/state/threads";

import {
  useComposerPathBrowse,
  useComposerPathSearch as useComposerPathSearchQuery,
} from "../state/queries";

export function useComposerPathSearch(target: ComposerPathSearchTarget): ComposerPathSearchState {
  const isBrowsing = getComposerPathBrowse(target.query) !== null;
  const state = useComposerPathSearchQuery(isBrowsing ? { ...target, query: null } : target);
  const browse = useComposerPathBrowse(target);
  const entries = state.entries.map((entry) => ({ path: entry.path, kind: entry.kind }));
  if (isBrowsing) return browse;
  return {
    entries,
    error: state.error,
    isPending: state.isPending,
  };
}
