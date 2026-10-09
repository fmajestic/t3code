import * as DateTime from "effect/DateTime";
import { describe, expect, it } from "vite-plus/test";

import { forkBuildVersion } from "./fork-dist-desktop.ts";

describe("forkBuildVersion", () => {
  it("stamps the next patch with the local date and an hhmm without a leading zero", () => {
    const now = DateTime.makeZonedUnsafe(
      { year: 2026, month: 10, day: 9, hour: 9, minute: 5 },
      { timeZone: DateTime.zoneMakeLocal(), adjustForTimeZone: true },
    );
    expect(forkBuildVersion("0.0.46", now)).toBe("0.0.47-fork.20261009.905");
  });
});
