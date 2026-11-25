const BLANK = /^\s*$/;
const QUOTED = /^(\s*)> ?/;

/**
 * Typing `>` over a selection quotes every line it touches, or unquotes one level when all
 * non-blank lines are already quoted. Offsets are into the prompt's Markdown.
 */
export function toggleQuoteLines(
  value: string,
  start: number,
  end: number,
): { value: string; start: number; end: number } | null {
  if (start >= end) return null;
  const lineStart = value.lastIndexOf("\n", start - 1) + 1;
  // A selection ending at column 0 does not take that line along.
  const lastLineEnd = value[end - 1] === "\n" ? end - 1 : end;
  const nextBreak = value.indexOf("\n", lastLineEnd);
  const lineEnd = nextBreak === -1 ? value.length : nextBreak;
  const lines = value.slice(lineStart, lineEnd).split("\n");
  const prose = lines.filter((line) => !BLANK.test(line));
  if (prose.length === 0) return null;
  const unquote = prose.every((line) => QUOTED.test(line));

  const edits: { at: number; removed: number; inserted: string }[] = [];
  let offset = lineStart;
  for (const line of lines) {
    if (unquote) {
      const match = QUOTED.exec(line);
      if (match) {
        edits.push({
          at: offset + match[1]!.length,
          removed: match[0].length - match[1]!.length,
          inserted: "",
        });
      }
    } else if (!QUOTED.test(line)) {
      edits.push(
        BLANK.test(line)
          ? { at: offset, removed: line.length, inserted: ">" }
          : { at: offset, removed: 0, inserted: "> " },
      );
    }
    offset += line.length + 1;
  }

  const mapOffset = (position: number) => {
    let shift = 0;
    for (const { at, removed, inserted } of edits) {
      if (position < at) break;
      if (position < at + removed) return at + shift + inserted.length;
      shift += inserted.length - removed;
    }
    return position + shift;
  };
  let next = value;
  for (const { at, removed, inserted } of edits.toReversed()) {
    next = next.slice(0, at) + inserted + next.slice(at + removed);
  }
  return { value: next, start: mapOffset(start), end: mapOffset(end) };
}
