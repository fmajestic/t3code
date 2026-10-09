import * as Option from "effect/Option";
import { describe, expect, it } from "vite-plus/test";

import { resolveDateTimeLocale } from "@t3tools/shared/dateTimeLocale";

import {
  appBundleFromExecPath,
  appendBuildOutput,
  localUpdateLabel,
  newestReleaseZip,
  releaseZipVersion,
} from "./LocalAppReplace.ts";

describe("LocalAppReplace", () => {
  it("picks the newest release zip for the running arch", () => {
    const zips = [
      { name: "T3-Code-0.0.45-arm64.zip", mtimeMs: 1 },
      { name: "T3-Code-0.0.46-arm64.zip", mtimeMs: 3 },
      { name: "T3-Code-0.0.47-x64.zip", mtimeMs: 9 },
      { name: "T3-Code-0.0.47-arm64.dmg", mtimeMs: 9 },
      { name: "T3-Code-0.0.44-arm64.zip", mtimeMs: 2 },
    ];
    expect(newestReleaseZip(zips, "arm64")).toEqual(
      Option.some({ name: "T3-Code-0.0.46-arm64.zip", mtimeMs: 3 }),
    );
    expect(newestReleaseZip(zips, "universal")).toEqual(Option.none());
  });

  it("resolves the app bundle from the main executable only", () => {
    expect(
      appBundleFromExecPath(
        "/Users/me/Applications/T3 Code (Majestic).app/Contents/MacOS/T3 Code (Majestic)",
      ),
    ).toEqual(Option.some("/Users/me/Applications/T3 Code (Majestic).app"));
    expect(appBundleFromExecPath("/usr/local/bin/node")).toEqual(Option.none());
  });

  it("reads a stamped prerelease version from the zip name", () => {
    expect(releaseZipVersion("T3-Code-0.0.46-fork.20261008.930-arm64.zip")).toBe(
      "0.0.46-fork.20261008.930",
    );
  });

  it("labels a local build by version and build time in the system locale", () => {
    // @effect-diagnostics-next-line globalDate:off -- The label shows local wall-clock time.
    const builtAt = new Date(2026, 9, 8, 15, 5).getTime();
    expect(
      localUpdateLabel(
        { name: "T3-Code-0.0.45-arm64.zip", mtimeMs: builtAt },
        resolveDateTimeLocale("en-US-u-rg-hrzzzz"),
      ),
    ).toBe("0.0.45 (built 8. Oct 15:05)");
  });

  it("keeps the last complete build output lines across chunks and redraws", () => {
    const first = appendBuildOutput([], "", "\u001b[32mstep 1\u001b[0m\n\nstep 2\nhal");
    expect(first).toEqual({ lines: ["step 1", "step 2"], pending: "hal" });
    expect(appendBuildOutput(first.lines, first.pending, "f\r50%\r100%\n")).toEqual({
      lines: ["half", "50%", "100%"],
      pending: "",
    });
  });
});
