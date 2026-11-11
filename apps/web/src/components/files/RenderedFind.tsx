import { ChevronDownIcon, ChevronUpIcon, XIcon } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";

import { collectThreadFindRanges } from "~/components/chat/threadFindHighlights";
import { Input } from "~/components/ui/input";
import { FILE_FIND_SCOPE_ATTRIBUTE } from "~/lib/editableFocus";

import { FileSurfaceAction } from "./fileSurfaceChrome";

const HIGHLIGHT_NAME = "t3-file-find";
const ACTIVE_HIGHLIGHT_NAME = "t3-file-find-active";

/** Mod+F find over rendered (non-editor) file content, painted with CSS Highlights. */
export function RenderedFind(props: { readonly label: string; readonly children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [ranges, setRanges] = useState<readonly Range[]>([]);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const searched = open ? query : "";

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- collects match ranges from the rendered DOM and recollects when it re-renders (async code highlighting, file reloads)
  useEffect(() => {
    const scope = root.current;
    const container = content.current;
    if (!scope || !container || searched.length === 0) {
      setRanges([]);
      return;
    }
    // Collects from the outer element: only descendants of it count as find scopes.
    const collect = () =>
      setRanges(collectThreadFindRanges(scope, searched).map((match) => match.range));
    collect();
    let frame: number | null = null;
    const observer = new MutationObserver(() => {
      if (frame !== null) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        collect();
      });
    });
    observer.observe(container, { subtree: true, childList: true, characterData: true });
    return () => {
      observer.disconnect();
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [searched]);

  const activeIndex = ranges.length === 0 ? 0 : Math.min(active, ranges.length - 1);
  const activeRange = ranges[activeIndex] ?? null;

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- paints the CSS Highlight registry, which lives outside React
  useEffect(() => {
    if (typeof CSS === "undefined" || !CSS.highlights || typeof Highlight === "undefined") return;
    if (ranges.length === 0) return;
    CSS.highlights.set(HIGHLIGHT_NAME, new Highlight(...ranges.filter((r) => r !== activeRange)));
    if (activeRange) CSS.highlights.set(ACTIVE_HIGHLIGHT_NAME, new Highlight(activeRange));
    return () => {
      CSS.highlights.delete(HIGHLIGHT_NAME);
      CSS.highlights.delete(ACTIVE_HIGHLIGHT_NAME);
    };
  }, [ranges, activeRange]);

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- scrolls the DOM to the selected match
  useEffect(() => {
    activeRange?.startContainer.parentElement?.scrollIntoView({ block: "center" });
  }, [activeRange]);

  const step = (delta: number) => {
    if (ranges.length === 0) return;
    setActive((activeIndex + delta + ranges.length) % ranges.length);
  };
  const close = () => {
    setOpen(false);
    root.current?.focus();
  };

  return (
    <div
      ref={root}
      tabIndex={-1}
      {...{ [FILE_FIND_SCOPE_ATTRIBUTE]: "" }}
      className="relative flex min-h-0 flex-1 flex-col outline-none"
      onKeyDown={(event) => {
        if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === "f") {
          event.preventDefault();
          setOpen(true);
          requestAnimationFrame(() => {
            input.current?.focus();
            input.current?.select();
          });
        }
      }}
    >
      {open ? (
        <div className="absolute top-2 right-4 z-10 flex items-center gap-1 rounded-lg border bg-popover p-1 text-muted-foreground text-xs shadow-md">
          <div className="w-44">
            <Input
              ref={input}
              size="compact"
              type="search"
              aria-label={`Find in ${props.label}`}
              placeholder="Find"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActive(0);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  step(event.shiftKey ? -1 : 1);
                } else if (event.key === "Escape") {
                  event.preventDefault();
                  event.stopPropagation();
                  close();
                }
              }}
            />
          </div>
          <span role="status" className="min-w-10 text-center tabular-nums">
            {query ? `${ranges.length ? activeIndex + 1 : 0}/${ranges.length}` : ""}
          </span>
          <FileSurfaceAction
            label="Previous match"
            disabled={!ranges.length}
            onPress={() => step(-1)}
          >
            <ChevronUpIcon className="size-3.5" />
          </FileSurfaceAction>
          <FileSurfaceAction label="Next match" disabled={!ranges.length} onPress={() => step(1)}>
            <ChevronDownIcon className="size-3.5" />
          </FileSurfaceAction>
          <FileSurfaceAction label="Close find" onPress={close}>
            <XIcon className="size-3.5" />
          </FileSurfaceAction>
        </div>
      ) : null}
      <div
        ref={content}
        data-timeline-row-id="rendered-file"
        data-thread-find-text=""
        className="flex min-h-0 flex-1 flex-col"
      >
        {props.children}
      </div>
    </div>
  );
}
