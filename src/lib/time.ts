import {
  addDays as _addDays,
  endOfDay as _endOfDay,
  endOfMonth as _endOfMonth,
  endOfWeek as _endOfWeek,
  startOfDay as _startOfDay,
  startOfMonth as _startOfMonth,
  startOfWeek as _startOfWeek,
  differenceInSeconds,
  format,
} from "date-fns";

// Re-export date-fns helpers (same signatures as the old hand-rolled versions)
export const startOfDay = _startOfDay;
export const endOfDay = _endOfDay;
export const startOfMonth = _startOfMonth;
export const endOfMonth = _endOfMonth;
export const addDays = _addDays;

/** Get start of the current week (Monday) */
export function startOfWeek(date: Date): Date {
  return _startOfWeek(date, { weekStartsOn: 1 });
}

/** Get end of the current week (Sunday) */
export function endOfWeek(date: Date): Date {
  return _endOfWeek(date, { weekStartsOn: 1 });
}

/** Format a date as YYYY-MM-DD (local timezone) */
export function formatDate(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

/** Format a date as HH:mm (local timezone) */
export function formatTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return format(d, "HH:mm");
}

/** Calculate elapsed time in seconds since a given ISO date string */
export function elapsedSince(isoString: string): number {
  return differenceInSeconds(new Date(), new Date(isoString));
}

// --- Domain-specific helpers (no date-fns equivalent) ---

/** Format a duration in seconds to human-readable string */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

/** Format seconds as decimal hours (e.g., 1.5h) */
export function formatDecimalHours(seconds: number): string {
  return `${(seconds / 3600).toFixed(1)}h`;
}

/** Convert a Date to Clockodo-compatible ISO 8601 UTC string (no milliseconds) */
export function toClockodoDateTime(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

/**
 * Like `parseDateTime`, but bare dates (YYYY-MM-DD) and keywords (today/yesterday/tomorrow)
 * resolve to end-of-day (23:59:59) instead of start-of-day. Useful for `--until` flags where
 * a bare date should include the entire day.
 */
export function parseDateTimeUntil(input: string): string {
  const lower = input.toLowerCase();

  // Keywords → end of day
  if (lower === "today" || lower === "yesterday" || lower === "tomorrow") {
    const now = new Date();
    const offset = lower === "yesterday" ? -1 : lower === "tomorrow" ? 1 : 0;
    return toClockodoDateTime(_endOfDay(addDays(now, offset)));
  }

  // Bare date YYYY-MM-DD → end of day
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    return toClockodoDateTime(_endOfDay(new Date(`${input}T00:00:00`)));
  }

  // Everything else (explicit time, full ISO, etc.) → delegate unchanged
  return parseDateTime(input);
}

/** Parse a flexible date string into an ISO 8601 UTC string for the Clockodo API */
export function parseDateTime(input: string): string {
  const now = new Date();

  switch (input.toLowerCase()) {
    case "today":
      return toClockodoDateTime(startOfDay(now));
    case "yesterday":
      return toClockodoDateTime(startOfDay(addDays(now, -1)));
    case "tomorrow":
      return toClockodoDateTime(startOfDay(addDays(now, 1)));
  }

  // Handle "YYYY-MM-DD" (date only, assume start of day)
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    return toClockodoDateTime(new Date(`${input}T00:00:00`));
  }

  // Handle "YYYY-MM-DD HH:mm" (date and time, local timezone)
  if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}$/.test(input)) {
    return toClockodoDateTime(new Date(`${input.replace(" ", "T")}:00`));
  }

  // Handle "HH:mm" (time only, assume today)
  if (/^\d{2}:\d{2}$/.test(input)) {
    const parts = input.split(":").map(Number);
    const hours = parts[0] ?? 0;
    const minutes = parts[1] ?? 0;
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return toClockodoDateTime(date);
  }

  // Try native Date parsing as fallback
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Cannot parse date: "${input}"`);
  }
  return toClockodoDateTime(parsed);
}
