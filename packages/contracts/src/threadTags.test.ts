import { describe, expect, it } from "vite-plus/test";

import {
  planSectionTagWrites,
  resolveThreadSectionId,
  sectionThreadTag,
  validateSectionName,
} from "./threadTags.ts";

const sections = [
  { id: "p", name: "Priority" },
  { id: "l", name: "Nice to have" },
];

describe("resolveThreadSectionId", () => {
  it.each([
    { tags: undefined, expected: null },
    { tags: ["private"], expected: null },
    { tags: [sectionThreadTag("gone")], expected: null },
    { tags: [sectionThreadTag("l")], expected: "l" },
    // Two section tags resolve to the first in section order, not tag order.
    { tags: [sectionThreadTag("l"), sectionThreadTag("p")], expected: "p" },
    { tags: [sectionThreadTag("gone"), sectionThreadTag("l")], expected: "l" },
  ])("reads $tags as $expected", ({ tags, expected }) => {
    expect(resolveThreadSectionId(tags, sections)).toBe(expected);
  });
});

describe("planSectionTagWrites", () => {
  it("adds the new section and clears every other section tag, stale ones too", () => {
    expect(
      planSectionTagWrites(["keep", sectionThreadTag("p"), sectionThreadTag("gone")], "l"),
    ).toEqual({
      add: sectionThreadTag("l"),
      remove: [sectionThreadTag("p"), sectionThreadTag("gone")],
    });
  });

  it("clears all section tags when filing into no section", () => {
    expect(planSectionTagWrites([sectionThreadTag("p")], null)).toEqual({
      add: null,
      remove: [sectionThreadTag("p")],
    });
  });
});

describe("validateSectionName", () => {
  it.each([
    { name: "  Focus ", renaming: null, expected: { name: "Focus" } },
    { name: "   ", renaming: null, expected: { error: "Section name cannot be empty" } },
    { name: "x".repeat(41), renaming: null, expected: { error: expect.stringContaining("40") } },
    {
      name: "priority",
      renaming: null,
      expected: { error: 'A section named "Priority" already exists' },
    },
    // Renaming a section to a new casing of its own name is fine.
    { name: "PRIORITY", renaming: "p", expected: { name: "PRIORITY" } },
    { name: "🔥 hot", renaming: null, expected: { name: "🔥 hot" } },
  ])("$name", ({ name, renaming, expected }) => {
    expect(validateSectionName(name, sections, renaming)).toEqual(expected);
  });
});
