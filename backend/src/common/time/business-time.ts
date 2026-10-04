// Business dates (attendance days, lateness, month and year boundaries) follow the company's
// timezone, never the server clock. Defaults to Africa/Cairo; override with COMPANY_TIMEZONE.

export interface ZonedParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export function companyTimeZone(): string {
  return process.env.COMPANY_TIMEZONE || 'Africa/Cairo';
}

export function getZonedParts(date: Date, timeZone = companyTimeZone()): ZonedParts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value);

  return {
    year: value('year'),
    month: value('month'),
    day: value('day'),
    hour: value('hour'),
    minute: value('minute'),
    second: value('second'),
  };
}

/** The company's current calendar date, as the UTC-midnight Date stored in @db.Date columns */
export function businessToday(now: Date = new Date()): Date {
  const { year, month, day } = getZonedParts(now);
  return new Date(Date.UTC(year, month - 1, day));
}

/** Minutes since midnight in company time (09:15 -> 555) */
export function businessMinutesOfDay(date: Date): number {
  const { hour, minute } = getZonedParts(date);
  return hour * 60 + minute;
}

/** HH:mm in company time, for user-facing messages */
export function formatBusinessTime(date: Date): string {
  return date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: companyTimeZone(),
  });
}

function zoneOffsetMs(date: Date): number {
  const p = getZonedParts(date);
  const wallClockAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return wallClockAsUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** The instant at which a company-local wall-clock time occurs (handles DST transitions) */
export function zonedTimeToUtc(year: number, month: number, day: number, hour = 0, minute = 0): Date {
  const wallClockAsUtc = Date.UTC(year, month - 1, day, hour, minute);
  const firstGuess = wallClockAsUtc - zoneOffsetMs(new Date(wallClockAsUtc));
  // Re-check once in case the guess crossed a DST boundary
  return new Date(wallClockAsUtc - zoneOffsetMs(new Date(firstGuess)));
}

/** [start, end) instants of a company-local calendar month */
export function businessMonthRange(year: number, month: number): { start: Date; end: Date } {
  const next = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
  return {
    start: zonedTimeToUtc(year, month, 1),
    end: zonedTimeToUtc(next.year, next.month, 1),
  };
}
