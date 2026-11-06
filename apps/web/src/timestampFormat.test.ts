import { describe, expect, it } from "vite-plus/test";

import { formatDayAwareTimestamp, formatUpcomingTimestamp } from "./timestampFormat";

describe("timestamps in an explicit time zone", () => {
  // 23:00 UTC on July 1 is 7 PM on July 1 in New York, whatever the host zone.
  const now = Date.parse("2026-07-01T23:00:00.000Z");
  const zone = "America/New_York";

  it("picks relative days from the calendar in that zone", () => {
    expect(formatUpcomingTimestamp("2026-07-02T00:30:00.000Z", "12-hour", now, zone)).not.toMatch(
      /tomorrow/,
    );
    expect(formatUpcomingTimestamp("2026-07-02T05:30:00.000Z", "12-hour", now, zone)).toMatch(
      /^tomorrow at /,
    );
    expect(formatUpcomingTimestamp("2026-07-07T05:30:00.000Z", "12-hour", now, zone)).toMatch(
      /^Tuesday at /,
    );
    expect(formatUpcomingTimestamp("2026-07-08T05:30:00.000Z", "12-hour", now, zone)).toMatch(
      /^Wed \S/,
    );
    expect(formatDayAwareTimestamp("2026-07-01T03:30:00.000Z", "12-hour", now, zone)).toMatch(
      /^yesterday at /,
    );
  });
});
