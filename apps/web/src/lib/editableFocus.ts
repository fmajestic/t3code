const EDITABLE_SELECTOR = [
  "input",
  "textarea",
  "select",
  '[contenteditable=""]',
  '[contenteditable="true"]',
  '[contenteditable="plaintext-only"]',
  '[role="textbox"]',
].join(",");

/** Includes focused descendants of open shadow roots, whose key events target the host. */
export function isEditableFocused(target: EventTarget | null = document.activeElement): boolean {
  const element = focusedElementWithin(target);
  return element !== null && element.closest(EDITABLE_SELECTOR) !== null;
}

export const FILE_FIND_SCOPE_ATTRIBUTE = "data-file-find-scope";

/** File surfaces run their own Mod+F search, so global shortcuts leave the key to them. */
export function isFileEditorFocused(target: EventTarget | null = document.activeElement): boolean {
  return (
    target instanceof Element &&
    ((target.closest("diffs-container") !== null && isEditableFocused(target)) ||
      target.closest(`[${FILE_FIND_SCOPE_ATTRIBUTE}]`) !== null)
  );
}

function focusedElementWithin(target: EventTarget | null): Element | null {
  let element = target instanceof Element ? target : null;
  while (element?.shadowRoot?.activeElement) element = element.shadowRoot.activeElement;
  return element;
}
