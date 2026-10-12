import { afterEach, describe, expect, it } from "vite-plus/test";

import { isEditableFocused, isFileEditorFocused } from "./editableFocus";

afterEach(() => {
  document.body.replaceChildren();
});

describe("isEditableFocused", () => {
  it("sees a text field focused inside an open shadow root", () => {
    // A key event from a shadow input is retargeted to its host, so the host is
    // what page-level shortcut handlers receive as the event target.
    const host = document.createElement("div");
    const input = document.createElement("input");
    host.attachShadow({ mode: "open" }).append(input);
    document.body.append(host);

    expect(isEditableFocused(host)).toBe(false);
    input.focus();
    expect(isEditableFocused(host)).toBe(true);
    expect(isEditableFocused()).toBe(true);
  });
});

describe("isFileEditorFocused", () => {
  it("is true only while an editable element inside a file editor host has focus", () => {
    const file = document.createElement("diffs-container");
    const content = document.createElement("div");
    content.setAttribute("contenteditable", "true");
    content.tabIndex = 0;
    file.attachShadow({ mode: "open" }).append(content);
    const composer = document.createElement("textarea");
    document.body.append(file, composer);

    expect(isFileEditorFocused(file)).toBe(false);
    content.focus();
    expect(isFileEditorFocused(file)).toBe(true);
    composer.focus();
    expect(isFileEditorFocused(composer)).toBe(false);
  });
});
