import type { TimestampFormat } from "@t3tools/contracts/settings";
import {
  resolveSnoozePresets as resolveSharedSnoozePresets,
  snoozeWakeLabel,
  type SnoozePreset,
} from "@t3tools/client-runtime/state/thread-settled";

import { formatShortTimestamp, getDateTimeFormatter, parseTimestampDate } from "../timestampFormat";

export { snoozeWakeLabel, type SnoozePreset };

const DAY_MS = 24 * 60 * 60 * 1_000;

function timeOfDayLabel(date: Date, timestampFormat: TimestampFormat): string {
  return formatShortTimestamp(date.toISOString(), timestampFormat);
}

export function resolveSnoozePresets(
  now: Date,
  timestampFormat: TimestampFormat,
): ReadonlyArray<SnoozePreset> {
  return resolveSharedSnoozePresets(now).map((preset) => {
    const wake = parseTimestampDate(preset.snoozedUntil);
    if (wake === null) return preset;
    const time = timeOfDayLabel(wake, timestampFormat);
    return {
      ...preset,
      whenLabel:
        preset.id === "next-week"
          ? `${getDateTimeFormatter({ weekday: "short" }).format(wake)} ${time}`
          : time,
    };
  });
}

/**
 * Human wake time for menus and toasts: "tomorrow 9:00", "Mon 9:00",
 * "17:30" (today).
 */
export function snoozeWakeDescription(
  snoozedUntil: string,
  now: Date,
  timestampFormat: TimestampFormat,
): string {
  const wake = parseTimestampDate(snoozedUntil);
  if (wake === null) return "";
  const time = timeOfDayLabel(wake, timestampFormat);
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const dayDelta = Math.floor((wake.getTime() - startOfToday.getTime()) / DAY_MS);
  if (dayDelta === 0) return time;
  if (dayDelta === 1) return `tomorrow ${time}`;
  const weekday = getDateTimeFormatter({ weekday: "short" }).format(wake);
  if (dayDelta < 7) return `${weekday} ${time}`;
  const date = getDateTimeFormatter({ month: "short", day: "numeric" }).format(wake);
  return `${date}, ${time}`;
}
