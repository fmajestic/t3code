/** `words` supplies month and weekday names, `shape` the order, separators and clock. */
export interface DateTimeLocale {
  readonly words: string | undefined;
  readonly shape: string | undefined;
}

const RUNTIME_DEFAULT: DateTimeLocale = { words: undefined, shape: undefined };

const REGION_OVERRIDE = /-rg-([a-z]{2})[a-z0-9]*/i;

/**
 * `en-US-u-rg-hrzzzz` takes its words from `en-US` and its shape from Croatia's language, `hr-Latn-HR`.
 * A tag `Intl` rejects falls back to the runtime default instead of breaking every timestamp.
 */
export function resolveDateTimeLocale(tag: string | null | undefined): DateTimeLocale {
  const trimmed = tag?.trim();
  if (!trimmed) return RUNTIME_DEFAULT;
  try {
    const region = REGION_OVERRIDE.exec(trimmed)?.[1]?.toUpperCase();
    const words = new Intl.Locale(trimmed.replace(REGION_OVERRIDE, "").replace(/-u$/i, ""));
    if (region === undefined || region === words.maximize().region) {
      return { words: words.toString(), shape: words.toString() };
    }
    return {
      words: words.toString(),
      shape: new Intl.Locale(`und-${region}`).maximize().baseName,
    };
  } catch {
    return RUNTIME_DEFAULT;
  }
}

export interface DateTimeFormatter {
  format(date: Date | number): string;
  resolvedOptions(): Intl.ResolvedDateTimeFormatOptions;
}

const WORD_PARTS: ReadonlySet<string> = new Set(["weekday", "month", "era", "dayPeriod"]);

/** Formats in the shape locale, with each worded part swapped for the words locale's. */
export function createDateTimeFormatter(
  locale: DateTimeLocale,
  options: Intl.DateTimeFormatOptions,
): DateTimeFormatter {
  const shape = new Intl.DateTimeFormat(locale.shape, options);
  if (locale.shape === locale.words) return shape;
  const words = new Intl.DateTimeFormat(locale.words, options);
  return {
    resolvedOptions: () => shape.resolvedOptions(),
    format: (date) => {
      const translated = new Map(words.formatToParts(date).map((part) => [part.type, part.value]));
      return shape
        .formatToParts(date)
        .map((part) =>
          WORD_PARTS.has(part.type) && !/\d/.test(part.value)
            ? (translated.get(part.type) ?? part.value)
            : part.value,
        )
        .join("");
    },
  };
}
