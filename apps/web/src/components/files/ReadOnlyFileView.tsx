import type { CodeViewItem, PostRenderPhase } from "@pierre/diffs";
import type { CodeViewHandle } from "@pierre/diffs/react";
import { useEffect, useEffectEvent, useRef, useState } from "react";

import { resolveDiffThemeName } from "~/lib/diffRendering";
import { FILE_FIND_SCOPE_ATTRIBUTE } from "~/lib/editableFocus";
import { PREFERRED_HIGHLIGHTER } from "~/lib/syntaxHighlighting";

import { StyledDiffCodeView } from "../diffs/StyledDiffCodeView";
import { type PreviewAction, subscribePreviewAction } from "../preview/previewActionBus";
import { clampFileLine, updateFileLinkReveal } from "./fileLineReveal";
import { FILE_LINK_REVEAL_UNSAFE_CSS } from "./fileSurfaceChrome";
import { useSourceSelection } from "./ReadOnlySourcePreview";

const ITEM_ID = "file";
// A scroll asked before the file is measured is clamped short; renders retry until the line shows.
const REVEAL_MAX_ATTEMPTS = 10;

function isWithin(row: Element, scroller: Element) {
  const rowRect = row.getBoundingClientRect();
  const viewport = scroller.getBoundingClientRect();
  return rowRect.top >= viewport.top && rowRect.bottom <= viewport.bottom;
}

/** A file the panel cannot edit, in a CodeView so Mod+F gets Pierre's find panel. */
export default function ReadOnlyFileView(props: {
  readonly name: string;
  readonly text: string;
  readonly cacheKey: string;
  readonly wordWrap: boolean;
  readonly revealLine: number | null;
  readonly revealRequestId: number;
  readonly resolvedTheme: "light" | "dark";
}) {
  const { resolvedTheme } = props;
  const viewer = useRef<CodeViewHandle<undefined, undefined>>(null);
  const container = useRef<HTMLDivElement>(null);
  const reveal = useRef<{ requestId: number; attempts: number } | null>(null);
  const selection = useSourceSelection(container, props.text);
  // Controlled CodeView items only rerender when their version changes.
  const [revision, setRevision] = useState({ cacheKey: props.cacheKey, version: 0 });
  if (revision.cacheKey !== props.cacheKey) {
    setRevision({ cacheKey: props.cacheKey, version: revision.version + 1 });
  }
  const items: CodeViewItem<undefined>[] = [
    {
      id: ITEM_ID,
      type: "file",
      version: revision.version,
      file: { name: props.name, contents: props.text, cacheKey: props.cacheKey },
    },
  ];
  const targetLine = props.revealLine === null ? null : clampFileLine(props.text, props.revealLine);

  const revealTarget = useEffectEvent((requestId: number, line: number | null) => {
    const fileContainer = container.current?.querySelector<HTMLElement>("diffs-container");
    if (fileContainer) updateFileLinkReveal(fileContainer, line);
    if (line === null) return;
    if (reveal.current?.requestId !== requestId) reveal.current = { requestId, attempts: 0 };
    const state = reveal.current;
    if (state.attempts >= REVEAL_MAX_ATTEMPTS) return;
    const handle = viewer.current;
    const scroller = container.current?.querySelector(".file-preview-code-view");
    if (!handle || !scroller) return;
    if (
      !handle
        .getInstance()
        ?.getRenderedItems()
        .some((entry) => entry.id === ITEM_ID)
    )
      return;
    const row = fileContainer?.shadowRoot?.querySelector(`[data-line="${line}"]`);
    if (state.attempts > 0 && row && isWithin(row, scroller)) {
      state.attempts = REVEAL_MAX_ATTEMPTS;
      return;
    }
    state.attempts += 1;
    handle.scrollTo({ type: "line", id: ITEM_ID, lineNumber: line, align: "center" });
  });
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- scrolls the CodeView to a newly requested link line
  useEffect(() => {
    revealTarget(props.revealRequestId, targetLine);
  }, [props.revealRequestId, targetLine]);

  const onPanelAction = useEffectEvent((action: PreviewAction) => {
    // Hidden panel tabs stay mounted; only the visible file answers.
    if (action === "find" && container.current?.getClientRects().length) {
      viewer.current?.openSearch({ scope: "all" });
    }
  });
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- subscribes to the panel find command, which fires while focus is in the right panel but outside the CodeView
  useEffect(() => subscribePreviewAction(onPanelAction), []);

  return (
    <div
      ref={container}
      {...{ [FILE_FIND_SCOPE_ATTRIBUTE]: "" }}
      className="flex min-h-0 flex-1 flex-col"
      {...selection.handlers}
    >
      <StyledDiffCodeView
        key={resolvedTheme}
        viewerRef={viewer}
        className="file-preview-code-view min-h-0 flex-1 overflow-auto"
        items={items}
        unsafeCSSExtra={FILE_LINK_REVEAL_UNSAFE_CSS}
        options={{
          disableFileHeader: true,
          overflow: props.wordWrap ? "wrap" : "scroll",
          theme: resolveDiffThemeName(resolvedTheme),
          preferredHighlighter: PREFERRED_HIGHLIGHTER,
          themeType: resolvedTheme,
          onPostRender: (node: HTMLElement, _instance: unknown, phase: PostRenderPhase) => {
            selection.draw(node, phase);
            if (phase === "unmount") return;
            requestAnimationFrame(() => revealTarget(props.revealRequestId, targetLine));
          },
        }}
      />
    </div>
  );
}
