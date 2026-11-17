import { FILE_LINK_REVEAL_ATTRIBUTE } from "./fileSurfaceChrome";

interface LineGeometry {
  readonly top: number;
  readonly height: number;
}

interface CenteredFileLineScrollInput {
  readonly scrollTop: number;
  readonly scrollHeight: number;
  readonly viewportTop: number;
  readonly viewportHeight: number;
  readonly fileTop: number;
  readonly estimatedLine: LineGeometry;
  readonly renderedLine?: LineGeometry;
}

export function resolveCenteredFileLineScrollTop(input: CenteredFileLineScrollInput): number {
  const lineTop =
    input.renderedLine === undefined
      ? input.fileTop + input.estimatedLine.top
      : input.scrollTop + input.renderedLine.top - input.viewportTop;
  const lineHeight = input.renderedLine?.height ?? input.estimatedLine.height;
  const centeredTop = Math.max(0, lineTop - Math.max(0, (input.viewportHeight - lineHeight) / 2));
  return Math.min(centeredTop, Math.max(0, input.scrollHeight - input.viewportHeight));
}

export function clampFileLine(contents: string, requestedLine: number): number {
  let lineCount = 1;
  for (let index = 0; index < contents.length; index += 1) {
    const character = contents.charCodeAt(index);
    if (character === 10) {
      lineCount += 1;
    } else if (character === 13) {
      lineCount += 1;
      if (contents.charCodeAt(index + 1) === 10) index += 1;
    }
  }
  return Math.min(Math.max(1, requestedLine), lineCount);
}

export function updateFileLinkReveal(fileContainer: HTMLElement, line: number | null): void {
  const root = fileContainer.shadowRoot ?? fileContainer;
  for (const element of root.querySelectorAll<HTMLElement>(`[${FILE_LINK_REVEAL_ATTRIBUTE}]`)) {
    element.removeAttribute(FILE_LINK_REVEAL_ATTRIBUTE);
  }
  if (line === null) return;

  root
    .querySelector<HTMLElement>(`[data-line="${line}"]`)
    ?.setAttribute(FILE_LINK_REVEAL_ATTRIBUTE, "");
  root
    .querySelector<HTMLElement>(`[data-column-number="${line}"]`)
    ?.setAttribute(FILE_LINK_REVEAL_ATTRIBUTE, "");
}
