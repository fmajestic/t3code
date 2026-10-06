import * as Option from "effect/Option";
import { describe, expect, it } from "vite-plus/test";

import {
  appBundleFromExecPath,
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

  it("labels a local build by version and build time", () => {
    expect(localUpdateLabel({ name: "T3-Code-0.0.45-arm64.zip", mtimeMs: 0 })).toMatch(
      /^0\.0\.45 \(built .+\)$/,
    );
    expect(
      localUpdateLabel({ name: "T3-Code-0.0.45-arm64.zip", mtimeMs: 15 * 3_600_000 }),
    ).not.toMatch(/AM|PM/);
  });
});
