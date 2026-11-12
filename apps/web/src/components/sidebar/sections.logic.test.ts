import { describe, expect, it } from "vite-plus/test";

import { sidebarMarkerId, type SidebarListItem, type SidebarListMarker } from "../Sidebar.logic";
import {
  arrangeCustomSections,
  customSectionListItems,
  planCustomSectionOrders,
  projectCustomSectionRows,
  resolveCustomSectionDrop,
  resolveCustomSectionDropLabel,
} from "./sections.logic";

const priority = { id: "p", name: "Priority" };
const later = { id: "l", name: "Nice to have" };
const sections = [priority, later];

const marker = (name: SidebarListMarker): SidebarListItem => ({ kind: "marker", marker: name });
const row = (
  key: string,
  section: "pinned" | "active" | "settled" = "active",
): SidebarListItem => ({
  kind: "thread",
  key,
  section,
});
const keysOf = (items: ReadonlyArray<SidebarListItem>) =>
  items.map((item) => (item.kind === "thread" ? item.key : item.marker));

// Pinned a | loose b | Priority c d | Nice to have (empty) | Settled z
const items: SidebarListItem[] = [
  marker("pinned-header"),
  row("a", "pinned"),
  marker("pinned-divider"),
  marker("active-placeholder"),
  ...customSectionListItems({
    looseKeys: ["b"],
    sections: [
      { sectionId: "p", keys: ["c", "d"] },
      { sectionId: "l", keys: [] },
    ],
  }),
  marker("settled-header"),
  marker("settled-placeholder"),
  row("z", "settled"),
];

describe("arrangeCustomSections", () => {
  const sectionOf: Record<string, string | null> = { b: null, c: "p", d: "p", e: "l", f: "gone" };
  const arrange = (collapsed: string[], routeKey: string | null = null) =>
    arrangeCustomSections({
      threads: ["b", "c", "e", "d", "f"],
      sections,
      sectionIdOf: (key) => sectionOf[key] ?? null,
      keyOf: (key) => key,
      collapsedIds: new Set(collapsed),
      routeKey,
    });

  it("keeps the list order inside each section, and unlisted sections read as loose", () => {
    const arranged = arrange([]);
    expect(arranged.loose).toEqual(["b", "f"]);
    expect(arranged.sections.map((section) => section.threads)).toEqual([["c", "d"], ["e"]]);
    expect(arranged.visibleThreads).toEqual(["b", "f", "c", "d", "e"]);
  });

  it("leaves a collapsed section's threads out of the on-screen order, except the open one", () => {
    expect(arrange(["p"]).visibleThreads).toEqual(["b", "f", "e"]);
    const arranged = arrange(["p"], "d");
    expect(arranged.visibleThreads).toEqual(["b", "f", "d", "e"]);
    expect(arranged.sections[0]!.hiddenThreads).toEqual(["c"]);
  });
});

describe("resolveCustomSectionDrop", () => {
  it.each([
    // Dragging loose b down over c lands after c in Priority.
    { active: "b", over: "c", expected: { sectionId: "p", index: 1 } },
    // Down over a header lands at the top of that section; up over one, in the area above it.
    {
      active: "b",
      over: sidebarMarkerId("custom-section:l"),
      expected: { sectionId: "l", index: 0 },
    },
    {
      active: "z",
      over: sidebarMarkerId("custom-section:p"),
      expected: { sectionId: null, index: 1 },
    },
    // Up over an empty section's placeholder files it into that section.
    {
      active: "z",
      over: sidebarMarkerId("custom-section:l-placeholder"),
      expected: { sectionId: "l", index: 0 },
    },
    // Up over the loose drop area takes it out of its section.
    {
      active: "d",
      over: sidebarMarkerId("active-placeholder"),
      expected: { sectionId: null, index: 0 },
    },
    { active: "a", over: "b", expected: { sectionId: null, index: 1 } },
  ])("$active over $over", ({ active, over, expected }) => {
    expect(resolveCustomSectionDrop(items, active, over)).toEqual(expected);
  });

  it("is off for a list without sections", () => {
    const plain = [marker("pinned-divider"), marker("active-placeholder"), row("b"), row("c")];
    expect(resolveCustomSectionDrop(plain, "b", "c")).toBeNull();
  });
});

describe("planCustomSectionOrders", () => {
  const sectionOf: Record<string, string | null> = { b: null, c: "p", d: "p", e: "l" };
  const plan = (
    draggedKey: string,
    target: { sectionId: string | null; index: number },
    collapsed: string[] = [],
  ) =>
    planCustomSectionOrders({
      activeKeys: ["c", "b", "e", "d"],
      draggedKey,
      sectionIdOf: (key) => sectionOf[key] ?? null,
      sectionIds: ["p", "l"],
      target,
      collapsedIds: new Set(collapsed),
    });

  it("orders keys within the target section and holds every active thread section by section", () => {
    expect(plan("b", { sectionId: "p", index: 1 })).toEqual({
      segmentOrder: ["c", "b", "d"],
      currentSegmentOrder: ["c", "d"],
      fullOrder: ["c", "b", "d", "e"],
    });
  });

  it("puts a thread from outside the list, like a pinned one, at its slot", () => {
    expect(plan("a", { sectionId: null, index: 1 }).fullOrder).toEqual(["b", "a", "c", "d", "e"]);
  });

  it("drops onto a collapsed section at its top", () => {
    expect(plan("b", { sectionId: "p", index: 2 }, ["p"]).segmentOrder).toEqual(["b", "c", "d"]);
  });

  it("reports the unchanged order of a move within its own section", () => {
    const orders = plan("d", { sectionId: "p", index: 1 });
    expect(orders.segmentOrder).toEqual(orders.currentSegmentOrder);
  });
});

describe("projectCustomSectionRows", () => {
  const threadRow = (key: string) => ({ kind: "thread" as const, key, section: "active" as const });

  it("lays out loose rows and each section, with the dragged row in its target by rank", () => {
    const ranks = new Map(["c", "b", "d"].map((key, index) => [key, index]));
    expect(
      keysOf(
        projectCustomSectionRows({
          items,
          rows: [threadRow("c"), threadRow("d")],
          dragged: threadRow("b"),
          targetSectionId: "p",
          rank: (key) => ranks.get(key) ?? Number.POSITIVE_INFINITY,
        }),
      ),
    ).toEqual([
      "active-placeholder",
      "custom-section:p",
      "c",
      "b",
      "d",
      "custom-section:l",
      "custom-section:l-placeholder",
    ]);
  });

  it("keeps the sections in place while the drop lands outside the active list", () => {
    expect(
      keysOf(
        projectCustomSectionRows({
          items,
          rows: [threadRow("b"), threadRow("c")],
          dragged: null,
          targetSectionId: null,
          rank: () => 0,
        }),
      ),
    ).toEqual(["b", "custom-section:p", "c", "custom-section:l", "custom-section:l-placeholder"]);
  });
});

describe("resolveCustomSectionDropLabel", () => {
  it.each([
    { target: undefined, current: "p", expected: null },
    { target: "p", current: "p", expected: null },
    { target: "l", current: "p", expected: "Move to Nice to have" },
    { target: null, current: "p", expected: "Remove from section" },
    { target: null, current: null, expected: null },
  ])("$current to $target", ({ target, current, expected }) => {
    expect(
      resolveCustomSectionDropLabel({
        targetSectionId: target,
        currentSectionId: current,
        sections,
      }),
    ).toBe(expected);
  });
});
