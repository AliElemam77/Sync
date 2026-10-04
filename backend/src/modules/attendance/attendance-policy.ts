import { ShiftType } from '@prisma/client';
import { WEEKLY_DAYS_OFF, toDateOnly } from '../leaves/leave-policy';

/** Every shift starts at 09:00 company time */
export const SHIFT_START_MINUTES = 9 * 60;

/** Working minutes per shift: RS is 8 hours, LS is 9 */
export const SHIFT_MINUTES: Record<ShiftType, number> = {
  [ShiftType.RS]: 480,
  [ShiftType.LS]: 540,
};

/**
 * Up to 15 missing minutes a day are forgiven. Past that, every missing minute is deducted
 * (20 minutes late -> 20 minutes deducted).
 */
export const LATE_GRACE_MINUTES = 15;

export function deductibleDelayMinutes(delayMinutes: number): number {
  return delayMinutes > LATE_GRACE_MINUTES ? delayMinutes : 0;
}

/** Lateness at check-in: minutes after the shift start not covered by approved permission time */
export function arrivalDelayMinutes(checkInMinutesOfDay: number, permissionMinutes: number): number {
  return Math.max(checkInMinutesOfDay - SHIFT_START_MINUTES - permissionMinutes, 0);
}

/** A closed day: worked time plus approved permission time against the shift length */
export function shiftBalance(
  workedMinutes: number,
  permissionMinutes: number,
  shiftType: ShiftType,
): { delayMinutes: number; overtimeMinutes: number } {
  const earned = workedMinutes + permissionMinutes;
  const shift = SHIFT_MINUTES[shiftType];
  return {
    delayMinutes: Math.max(shift - earned, 0),
    overtimeMinutes: Math.max(earned - shift, 0),
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** YYYY-MM-DD of a date-only value */
export function dateKey(date: Date): string {
  return toDateOnly(date).toISOString().slice(0, 10);
}

/**
 * Working days in [from, to] with no attendance and no approved leave: the shift's weekly days off
 * and public holidays are not working days. Approved permissions are handled by the caller.
 */
export function findAbsentDays(params: {
  from: Date;
  to: Date;
  shiftType: ShiftType;
  attendedDays: Set<string>;
  holidays: Set<string>;
  leaves: { startDate: Date; endDate: Date }[];
}): Date[] {
  const daysOff = WEEKLY_DAYS_OFF[params.shiftType];
  const last = toDateOnly(params.to).getTime();
  const absent: Date[] = [];

  for (let day = toDateOnly(params.from); day.getTime() <= last; day = new Date(day.getTime() + DAY_MS)) {
    const key = dateKey(day);
    if (daysOff.includes(day.getUTCDay())) continue;
    if (params.holidays.has(key) || params.attendedDays.has(key)) continue;
    const onLeave = params.leaves.some(
      (leave) =>
        toDateOnly(leave.startDate).getTime() <= day.getTime() &&
        day.getTime() <= toDateOnly(leave.endDate).getTime(),
    );
    if (!onLeave) absent.push(day);
  }
  return absent;
}
