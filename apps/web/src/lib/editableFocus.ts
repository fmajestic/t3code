const EDITABLE_SELECTOR = [
  "input",
  "textarea",
  "select",
  '[contenteditable=""]',
  '[contenteditable="true"]',
  '[contenteditable="plaintext-only"]',
  '[role="textbox"]',
].join(",");

/**
 * Focus inside an open shadow root counts: a key event's target is retargeted
 * to the shadow host, so the host's focused descendant is what is typed into.
 */
export function isEditableFocused(target: EventTarget | null = document.activeElement): boolean {
  const element = focusedElementWithin(target);
  return element !== null && element.closest(EDITABLE_SELECTOR) !== null;
}

/** The file editor runs its own Mod+F search, so global shortcuts leave the key to it. */
export function isFileEditorFocused(target: EventTarget | null = document.activeElement): boolean {
  return (
    target instanceof Element &&
    target.closest("diffs-container") !== null &&
    isEditableFocused(target)
  );
}

function focusedElementWithin(target: EventTarget | null): Element | null {
  let element = target instanceof Element ? target : null;
  while (element?.shadowRoot?.activeElement) element = element.shadowRoot.activeElement;
  return element;
}
