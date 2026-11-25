/** Each matching element is its own find section; outside all of them is the main chat. */
const FIND_SECTION_SELECTOR = "[data-right-panel-surface-content], [data-side-chat-pane]";

function findSectionOf(node: Node): Element | null {
  let current: Node | null = node;
  while (current) {
    const element = current instanceof Element ? current : current.parentElement;
    const section = element?.closest(FIND_SECTION_SELECTOR);
    if (section) return section;
    const root = current.getRootNode();
    current = root instanceof ShadowRoot ? root.host : null;
  }
  return null;
}

function selectedRange(selection: Selection): Range | null {
  if (selection.rangeCount === 0) return null;
  // Code views render into shadow roots, which the plain selection range does not reach.
  const shadowRoots = Array.from(
    document.querySelectorAll("diffs-container"),
    (host) => host.shadowRoot,
  ).filter((root) => root !== null);
  let composed: StaticRange | undefined;
  try {
    composed = selection.getComposedRanges({ shadowRoots })[0];
  } catch {
    return selection.getRangeAt(0);
  }
  if (!composed) return null;
  const range = document.createRange();
  range.setStart(composed.startContainer, composed.startOffset);
  range.setEnd(composed.endContainer, composed.endOffset);
  return range;
}

/**
 * The text a find started from `target` searches for: the selection, when it is one line
 * and lies in the same section (main chat, side chat, or right panel tab) as `target`.
 */
export function readSelectionQuery(target: EventTarget | null): string | null {
  const selection = document.getSelection();
  const range = selection ? selectedRange(selection) : null;
  if (!range || range.collapsed) return null;
  const section = findSectionOf(target instanceof Node ? target : document.body);
  if (
    findSectionOf(range.startContainer) !== section ||
    findSectionOf(range.endContainer) !== section
  ) {
    return null;
  }
  // Only the selection's own text has the line breaks layout puts between blocks.
  const text = (selection?.toString() || range.toString()).trim();
  return text && !/[\r\n]/.test(text) ? text : null;
}
