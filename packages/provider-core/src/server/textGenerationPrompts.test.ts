import { describe, expect, it } from "vite-plus/test";

import { buildThreadTitlePrompt } from "./textGenerationPrompts.ts";
import { normalizeCliError } from "./textGenerationUtils.ts";

describe("normalizeCliError", () => {
  it("does not expose CLI failure details in the public error message", () => {
    const result = normalizeCliError(
      "codex",
      "generateCommitMessage",
      new Error("request failed with access_token=secret-token"),
      "Failed to generate a commit message",
    );

    expect(result.detail).toBe("Failed to generate a commit message");
    expect(result.message).not.toContain("secret-token");
  });
});

describe("buildThreadTitlePrompt", () => {
  it("names the project to leave out of initial and regenerated titles", () => {
    for (const previousTitle of [undefined, "Hyperdrive Config Crash"]) {
      const { prompt } = buildThreadTitlePrompt({
        message: "hyperdrive init crashes without a config",
        previousTitle,
        projectTitle: "Hyperdrive",
      });
      expect(prompt).toContain('Never include the project name ("Hyperdrive")');
    }
  });

  it("asks for a section only when titling a new thread with sections offered", () => {
    const sections = ["Backend", "Mobile"];
    const initial = buildThreadTitlePrompt({ message: "Fix the API", sections });
    expect(initial.prompt).toContain('- "Backend"\n- "Mobile"');
    expect(Object.keys(initial.outputSchema.fields)).toContain("section");
    for (const input of [
      { message: "Fix the API" },
      { message: "Fix the API", sections, previousTitle: "API Fix" },
    ]) {
      const { prompt, outputSchema } = buildThreadTitlePrompt(input);
      expect(prompt).not.toContain("sidebar sections");
      expect(Object.keys(outputSchema.fields)).not.toContain("section");
    }
  });
});
