// Time helpers for the timeline + slot math. The timeline operates on a single
// local day; we treat stored DateTimes in the server/browser local timezone.

export const DAY_START_HOUR = 6; // timeline window start (06:00)
export const DAY_END_HOUR = 24; // timeline window end (24:00 = midnight)
export const SLOT_RESOLUTION_MIN = 15;

export function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseYmd(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

// Combine a YYYY-MM-DD date string with an HH:mm time into a local Date.
export function combineDateTime(dateStr: string, timeStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  return new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0, 0);
}

export function hhmm(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes(),
  ).padStart(2, "0")}`;
}

export function minutesSinceDayStart(d: Date): number {
  return d.getHours() * 60 + d.getMinutes() - DAY_START_HOUR * 60;
}

export const TIMELINE_TOTAL_MIN = (DAY_END_HOUR - DAY_START_HOUR) * 60;

// Snap a minute value to the configured resolution.
export function snapMinutes(min: number, resolution = SLOT_RESOLUTION_MIN): number {
  return Math.round(min / resolution) * resolution;
}

const DATE_FMT = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
});

const TIME_FMT = new Intl.DateTimeFormat(undefined, {
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDateLong(d: Date): string {
  return DATE_FMT.format(d);
}

export function formatTime(d: Date): string {
  return TIME_FMT.format(d);
}

export function formatDateTimeRange(start: Date, end: Date): string {
  const sameDay = ymd(start) === ymd(end);
  if (sameDay) {
    return `${formatDateLong(start)} · ${formatTime(start)} – ${formatTime(end)}`;
  }
  return `${formatDateLong(start)} ${formatTime(start)} → ${formatDateLong(
    end,
  )} ${formatTime(end)}`;
}
