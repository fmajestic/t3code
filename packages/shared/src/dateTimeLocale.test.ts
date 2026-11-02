import { describe, expect, it } from "vite-plus/test";

import { createDateTimeFormatter, resolveDateTimeLocale } from "./dateTimeLocale.ts";

describe("resolveDateTimeLocale", () => {
  it("defers to the runtime default when the host reports no locale", () => {
    expect(resolveDateTimeLocale(null)).toEqual({ words: undefined, shape: undefined });
    expect(resolveDateTimeLocale("   ")).toEqual({ words: undefined, shape: undefined });
  });

  it("uses one locale for both halves when ICU has data for its region", () => {
    expect(resolveDateTimeLocale("en-GB")).toEqual({ words: "en-GB", shape: "en-GB" });
    expect(resolveDateTimeLocale("en-US")).toEqual({ words: "en-US", shape: "en-US" });
  });

  it("takes the shape from the region's language when ICU lacks data for the region", () => {
    expect(resolveDateTimeLocale("en-HR")).toEqual({ words: "en-HR", shape: "hr-Latn-HR" });
    expect(resolveDateTimeLocale("en-HR-u-hc-h12")).toEqual({
      words: "en-HR-u-hc-h12",
      shape: "hr-Latn-HR-u-hc-h12",
    });
  });

  it("defers to the runtime default rather than throwing on an unusable tag", () => {
    expect(resolveDateTimeLocale("not a locale")).toEqual({ words: undefined, shape: undefined });
    expect(resolveDateTimeLocale("en_GB")).toEqual({ words: undefined, shape: undefined });
  });
});

describe("createDateTimeFormatter", () => {
  // @effect-diagnostics-next-line globalDate:off -- Formatting is checked against local wall-clock time.
  const date = new Date(2026, 9, 8, 15, 5);
  const englishInCroatia = resolveDateTimeLocale("en-HR");

  it("orders and punctuates like the region and names months in the language", () => {
    expect(
      createDateTimeFormatter(englishInCroatia, {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(date),
    ).toBe("8. Oct 2026.");
    expect(
      createDateTimeFormatter(englishInCroatia, { weekday: "short", hour: "numeric" }).format(date),
    ).toMatch(/^Thu.* 15$/);
  });

  it("takes the region's clock", () => {
    expect(
      createDateTimeFormatter(englishInCroatia, { hour: "numeric", minute: "2-digit" }).format(
        date,
      ),
    ).toBe("15:05");
  });
});
