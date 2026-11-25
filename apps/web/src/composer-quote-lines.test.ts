import { describe, expect, it } from "vite-plus/test";

import { toggleQuoteLines } from "./composer-quote-lines";

/** `[` and `]` mark the selection; the result is written back the same way. */
function toggle(marked: string) {
  const start = marked.indexOf("[");
  const end = marked.indexOf("]") - 1;
  const result = toggleQuoteLines(marked.replace("[", "").replace("]", ""), start, end);
  if (!result) return null;
  const { value, start: from, end: to } = result;
  return `${value.slice(0, from)}[${value.slice(from, to)}]${value.slice(to)}`;
}

describe("toggleQuoteLines", () => {
  it("quotes every line a partial selection touches, in full", () => {
    expect(toggle("one\ntwo th[ree\nfour\nfive si]x\nseven")).toBe(
      "one\n> two th[ree\n> four\n> five si]x\nseven",
    );
  });

  it("quotes the whole line for a selection inside it", () => {
    expect(toggle("a w[or]d here")).toBe("> a w[or]d here");
  });

  it("skips the line where the selection ends at column 0", () => {
    expect(toggle("[one\ntwo\n]three")).toBe("> [one\n> two\n]three");
  });

  it("marks blank lines with a bare > so the quote stays one block", () => {
    expect(toggle("[one\n\n  \ntwo]")).toBe("> [one\n>\n>\n> two]");
  });

  it("removes one level when every non-blank line is quoted", () => {
    expect(toggle("> [one\n\n> > two\n>three]")).toBe("[one\n\n> two\nthree]");
  });

  it("quotes only the unquoted lines of a mixed selection", () => {
    expect(toggle("> [one\ntwo]")).toBe("> [one\n> two]");
  });

  it("keeps a selection start that sat inside a removed prefix at the line start", () => {
    expect(toggle(">[ one]")).toBe("[one]");
  });

  it("undoes itself", () => {
    const quoted = toggle("x[y\nz]")!;
    expect(quoted).toBe("> x[y\n> z]");
    expect(toggle(quoted)).toBe("x[y\nz]");
  });

  it("ignores empty and blank-only selections", () => {
    expect(toggleQuoteLines("abc", 1, 1)).toBeNull();
    expect(toggle("a\n[\n]b")).toBeNull();
  });
});
