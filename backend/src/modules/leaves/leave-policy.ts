import { ShiftType } from '@prisma/client';

/** Longest annual leave allowed in a single request, in working days */
export const MAX_ANNUAL_LEAVE_DAYS_PER_REQUEST = 3;

/**
 * Weekly days off per shift, as Date#getUTCDay values (5 = Friday, 6 = Saturday).
 * RS works 6 days a week, LS works 5.
 */
export const WEEKLY_DAYS_OFF: Record<ShiftType, number[]> = {
  [ShiftType.RS]: [5],
  [ShiftType.LS]: [5, 6],
};

/** Calendar span accepted for one request, to keep the day count bounded */
export const MAX_LEAVE_RANGE_DAYS = 366;

const DAY_MS = 24 * 60 * 60 * 1000;

export function toDateOnly(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function calendarDaysBetween(start: Date, end: Date): number {
  return Math.round((toDateOnly(end).getTime() - toDateOnly(start).getTime()) / DAY_MS) + 1;
}

/** Working days in [start, end] inclusive, skipping the shift's weekly days off */
export function countWorkingDays(start: Date, end: Date, shiftType: ShiftType): number {
  const daysOff = WEEKLY_DAYS_OFF[shiftType];
  const last = toDateOnly(end).getTime();
  let workingDays = 0;

  for (let day = toDateOnly(start); day.getTime() <= last; day = new Date(day.getTime() + DAY_MS)) {
    if (!daysOff.includes(day.getUTCDay())) workingDays++;
  }
  return workingDays;
}
