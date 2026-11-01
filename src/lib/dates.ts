import { DEFAULT_TIMEZONE } from "./types";

const DATE_KEY_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_KEY_REGEX = /^(\d{4})-(\d{2})$/;

export function isValidTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function normalizeTimezone(tz?: string | null): string {
  if (!tz) return DEFAULT_TIMEZONE;
  return isValidTimezone(tz) ? tz : DEFAULT_TIMEZONE;
}

/**
 * Validates that YYYY-MM-DD represents an actual calendar date
 * (rejects impossible dates such as 2026-02-30 or 2026-13-01).
 */
export function isValidDateKey(dateKey: string): boolean {
  const match = DATE_KEY_REGEX.exec(dateKey);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1970 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;

  const dt = new Date(Date.UTC(year, month - 1, day));
  return (
    dt.getUTCFullYear() === year &&
    dt.getUTCMonth() === month - 1 &&
    dt.getUTCDate() === day
  );
}

export function isValidMonthKey(monthKey: string): boolean {
  const match = MONTH_KEY_REGEX.exec(monthKey);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  return year >= 1970 && year <= 2100 && month >= 1 && month <= 12;
}

/**
 * Converts a Date or ISO timestamp into YYYY-MM-DD in the given IANA timezone.
 */
export function formatDateKeyInTimezone(
  input: Date | string,
  timezone: string = DEFAULT_TIMEZONE
): string {
  const tz = normalizeTimezone(timezone);
  const date = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid timestamp provided to formatDateKeyInTimezone");
  }

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("Failed to format date parts");
  }
  return `${year}-${month}-${day}`;
}

export function getTodayDateKey(timezone: string = DEFAULT_TIMEZONE): string {
  return formatDateKeyInTimezone(new Date(), timezone);
}

export function parseDateKeyToUtcNoon(dateKey: string): Date {
  if (!isValidDateKey(dateKey)) {
    throw new Error(`Invalid dateKey: ${dateKey}`);
  }
  const [y, m, d] = dateKey.split("-").map(Number);
  // Using UTC noon prevents any +/- 12h offset shift during calendar arithmetic
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

export function utcDateToDateKey(dt: Date): string {
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dt.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDaysToDateKey(dateKey: string, deltaDays: number): string {
  const dt = parseDateKeyToUtcNoon(dateKey);
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  return utcDateToDateKey(dt);
}

export function diffCalendarDays(startDateKey: string, endDateKey: string): number {
  const a = parseDateKeyToUtcNoon(startDateKey);
  const b = parseDateKeyToUtcNoon(endDateKey);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/**
 * Returns the Monday-through-Sunday week range containing `dateKey`.
 * Day of week in UTC: 0 = Sunday, 1 = Monday, ..., 6 = Saturday.
 */
export function getWeekRangeForDateKey(dateKey: string): {
  weekStart: string;
  weekEnd: string;
  days: string[];
} {
  const dt = parseDateKeyToUtcNoon(dateKey);
  const dow = dt.getUTCDay(); // 0=Sun..6=Sat
  const offsetToMonday = dow === 0 ? -6 : 1 - dow;
  const weekStart = addDaysToDateKey(dateKey, offsetToMonday);
  const days: string[] = [];
  for (let i = 0; i < 7; i++) {
    days.push(addDaysToDateKey(weekStart, i));
  }
  return {
    weekStart,
    weekEnd: days[6],
    days,
  };
}

/**
 * Returns full calendar range for a YYYY-MM month key.
 */
export function getMonthRange(monthKey: string): {
  monthKey: string;
  year: number;
  month: number; // 1..12
  startDateKey: string;
  endDateKey: string;
  days: string[];
  daysInMonth: number;
} {
  if (!isValidMonthKey(monthKey)) {
    throw new Error(`Invalid monthKey: ${monthKey}`);
  }
  const [year, month] = monthKey.split("-").map(Number);
  const lastDayDate = new Date(Date.UTC(year, month, 0, 12, 0, 0));
  const daysInMonth = lastDayDate.getUTCDate();
  const startDateKey = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDateKey = `${year}-${String(month).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;
  const days: string[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    days.push(`${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }
  return {
    monthKey,
    year,
    month,
    startDateKey,
    endDateKey,
    days,
    daysInMonth,
  };
}

export function addMonthsToMonthKey(monthKey: string, deltaMonths: number): string {
  if (!isValidMonthKey(monthKey)) {
    throw new Error(`Invalid monthKey: ${monthKey}`);
  }
  const [year, month] = monthKey.split("-").map(Number);
  const dt = new Date(Date.UTC(year, month - 1 + deltaMonths, 1, 12, 0, 0));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function formatDisplayDate(dateKey: string): string {
  if (!isValidDateKey(dateKey)) return dateKey;
  const dt = parseDateKeyToUtcNoon(dateKey);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(dt);
}

export function formatShortDay(dateKey: string): string {
  if (!isValidDateKey(dateKey)) return dateKey;
  const dt = parseDateKeyToUtcNoon(dateKey);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
  }).format(dt);
}

export function formatMonthTitle(monthKey: string): string {
  if (!isValidMonthKey(monthKey)) return monthKey;
  const [year, month] = monthKey.split("-").map(Number);
  const dt = new Date(Date.UTC(year, month - 1, 1, 12, 0, 0));
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  }).format(dt);
}

export function formatMinutesHuman(totalMinutes: number): string {
  const safe = Math.max(0, Math.round(totalMinutes));
  const hrs = Math.floor(safe / 60);
  const mins = safe % 60;
  if (hrs === 0) return `${mins}m`;
  if (mins === 0) return `${hrs}h`;
  return `${hrs}h ${mins}m`;
}
