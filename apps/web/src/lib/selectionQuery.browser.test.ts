import { describe, expect, it } from "vite-plus/test";

import { readSelectionQuery } from "./selectionQuery";

function mount(html: string) {
  const root = document.createElement("div");
  root.innerHTML = html;
  document.body.append(root);
  return Object.assign(root, {
    [Symbol.dispose]: () => {
      document.getSelection()?.removeAllRanges();
      root.remove();
    },
  });
}

function select(start: Node, startOffset: number, end: Node, endOffset: number) {
  document.getSelection()?.setBaseAndExtent(start, startOffset, end, endOffset);
}

describe("readSelectionQuery", () => {
  it("reads a one-line selection in the target's section, trimmed", () => {
    using root = mount(`<p id="message"> find this </p>`);
    const text = root.querySelector("#message")!.firstChild!;
    select(text, 0, text, text.textContent!.length);
    expect(readSelectionQuery(document.body)).toBe("find this");
  });

  it("ignores collapsed and multi-line selections", () => {
    using root = mount(`<p id="a">first line</p><p id="b">second line</p>`);
    const first = root.querySelector("#a")!.firstChild!;
    const second = root.querySelector("#b")!.firstChild!;
    select(first, 2, first, 2);
    expect(readSelectionQuery(document.body)).toBeNull();
    select(first, 0, second, 6);
    expect(readSelectionQuery(document.body)).toBeNull();
  });

  it("ignores a selection outside the section the find starts in", () => {
    using root = mount(`
      <p id="message">in the chat</p>
      <div data-right-panel-surface-content><p id="file">in a panel tab</p><button>tab</button></div>
    `);
    const message = root.querySelector("#message")!.firstChild!;
    const file = root.querySelector("#file")!.firstChild!;
    const panelButton = root.querySelector("button")!;

    select(message, 0, message, 4);
    expect(readSelectionQuery(panelButton)).toBeNull();
    expect(readSelectionQuery(document.body)).toBe("in t");

    select(file, 0, file, 8);
    expect(readSelectionQuery(panelButton)).toBe("in a pan");
    expect(readSelectionQuery(document.body)).toBeNull();
  });

  it("reads a selection inside a code view's shadow root", () => {
    using root = mount(
      `<div data-right-panel-surface-content><diffs-container></diffs-container></div>`,
    );
    const host = root.querySelector("diffs-container")!;
    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `<div id="line">const needle = 1;</div><div id="next">next();</div>`;
    const text = shadow.querySelector("#line")!.firstChild!;
    const next = shadow.querySelector("#next")!.firstChild!;
    select(text, 6, text, 12);
    expect(readSelectionQuery(host)).toBe("needle");
    expect(readSelectionQuery(document.body)).toBeNull();
    select(text, 6, next, 4);
    expect(readSelectionQuery(host)).toBeNull();
  });
});
