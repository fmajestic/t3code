import { userEvent } from "vite-plus/test/browser";
import { describe, expect, it, vi } from "vite-plus/test";

import { render } from "../../../test/render";

import { isFileEditorFocused } from "~/lib/editableFocus";
import { isMacPlatform } from "~/lib/utils";
import { RenderedFind } from "./RenderedFind";

describe("RenderedFind", () => {
  it("claims Mod+F and steps through matches across inline markup", async () => {
    await using screen = await render(
      <RenderedFind label="markdown">
        <p>
          alpha <strong>be</strong>ta
        </p>
        <p>beta again</p>
      </RenderedFind>,
    );
    const paragraph = screen.getByText("beta again").element();
    await userEvent.click(paragraph);
    expect(isFileEditorFocused(document.activeElement)).toBe(true);

    const mod = isMacPlatform(navigator.platform) ? "Meta" : "Control";
    await userEvent.keyboard(`{${mod}>}f{/${mod}}`);
    const input = screen.getByRole("searchbox", { name: "Find in markdown" });
    await expect.element(input).toHaveFocus();

    await userEvent.type(input, "beta");
    await expect.element(screen.getByRole("status")).toHaveTextContent("1/2");
    expect(CSS.highlights.get("t3-file-find-active")?.size).toBe(1);

    await userEvent.keyboard("{Enter}");
    await expect.element(screen.getByRole("status")).toHaveTextContent("2/2");

    await userEvent.keyboard("{Escape}");
    await expect.element(input).not.toBeInTheDocument();
    await vi.waitFor(() => expect(CSS.highlights.get("t3-file-find")).toBeUndefined());
  });
});
