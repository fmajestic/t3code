import { describe, expect, it } from "vite-plus/test";

import {
  buildComposerPathBrowseEntries,
  describeComposerPathEntry,
  getComposerPathBrowse,
} from "./composerPathSearch.ts";

const HOME_LISTING = {
  parentPath: "/Users/me",
  entries: [
    { name: ".config", fullPath: "/Users/me/.config", kind: "directory" as const },
    { name: "notes.md", fullPath: "/Users/me/notes.md", kind: "file" as const },
    { name: "work", fullPath: "/Users/me/work", kind: "directory" as const },
  ],
};

describe("composer path browse", () => {
  it("browses only explicit paths, leaving plain queries to the project index", () => {
    expect(getComposerPathBrowse("src/app")).toBeNull();
    expect(getComposerPathBrowse("~")).toBeNull();
    expect(getComposerPathBrowse("~/work/ol")).toMatchObject({
      directoryPath: "~/work/",
      filterQuery: "ol",
    });
    expect(getComposerPathBrowse("../")).toMatchObject({ directoryPath: "../", filterQuery: "" });
  });

  it("lists a bare directory with itself first and continues the typed path into children", () => {
    expect(buildComposerPathBrowseEntries("~/", "", HOME_LISTING)).toEqual([
      { path: "/Users/me", kind: "directory" },
      { path: "/Users/me/notes.md", kind: "file" },
      { path: "/Users/me/work", kind: "directory", browseQuery: "~/work/" },
    ]);
  });

  it("filters by the typed leaf and reveals dot entries only when asked", () => {
    expect(buildComposerPathBrowseEntries("~/", "w", HOME_LISTING)).toEqual([
      { path: "/Users/me/work", kind: "directory", browseQuery: "~/work/" },
    ]);
    expect(buildComposerPathBrowseEntries("~/", ".", HOME_LISTING)).toEqual([
      { path: "/Users/me/.config", kind: "directory", browseQuery: "~/.config/" },
      { path: "/Users/me/notes.md", kind: "file" },
    ]);
  });

  it("matches anywhere in the name, listing names that start with the query first", () => {
    const listing = {
      parentPath: "/repo",
      entries: [
        { name: "body.sql", fullPath: "/repo/body.sql", kind: "file" as const },
        { name: "nobody", fullPath: "/repo/nobody", kind: "directory" as const },
        { name: "reports_body.sql", fullPath: "/repo/reports_body.sql", kind: "file" as const },
        { name: "readme.md", fullPath: "/repo/readme.md", kind: "file" as const },
      ],
    };
    expect(
      buildComposerPathBrowseEntries("/repo/", "BODY", listing).map((entry) => entry.path),
    ).toEqual(["/repo/body.sql", "/repo/nobody", "/repo/reports_body.sql"]);
  });

  it("treats entries from servers without kinds as directories", () => {
    const legacy = { parentPath: "/srv", entries: [{ name: "app", fullPath: "/srv/app" }] };
    expect(buildComposerPathBrowseEntries("/srv/", "a", legacy)).toEqual([
      { path: "/srv/app", kind: "directory", browseQuery: "/srv/app/" },
    ]);
  });

  it("accepts Windows path forms", () => {
    expect(getComposerPathBrowse("~\\work\\ol")).toMatchObject({
      directoryPath: "~\\work\\",
      filterQuery: "ol",
    });
    expect(getComposerPathBrowse("C:\\Users\\")).toMatchObject({
      directoryPath: "C:\\Users\\",
      filterQuery: "",
    });
  });

  it("continues a backslash path with backslashes", () => {
    const listing = {
      parentPath: "C:\\Users\\me",
      entries: [{ name: "work", fullPath: "C:\\Users\\me\\work", kind: "directory" as const }],
    };
    expect(buildComposerPathBrowseEntries("~\\", "w", listing)).toEqual([
      { path: "C:\\Users\\me\\work", kind: "directory", browseQuery: "~\\work\\" },
    ]);
  });

  it("labels entries by their last segment with either separator", () => {
    expect(describeComposerPathEntry("C:\\Users\\me\\notes.md")).toEqual({
      label: "notes.md",
      description: "C:\\Users\\me",
    });
    expect(describeComposerPathEntry("src/app.ts")).toEqual({
      label: "app.ts",
      description: "src",
    });
    expect(describeComposerPathEntry("/")).toEqual({ label: "/", description: "" });
  });
});
