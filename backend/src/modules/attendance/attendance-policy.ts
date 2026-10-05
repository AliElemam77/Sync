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
 * Lateness is deducted in tiers of a day's pay, by the minutes missing from the day:
 * up to 15 is forgiven, over 15 costs a quarter day, over 30 half a day, over 60 a full day.
 */
export const LATENESS_TIERS: { overMinutes: number; days: number; label: string }[] = [
  { overMinutes: 60, days: 1, label: 'يوم كامل' },
  { overMinutes: 30, days: 0.5, label: 'نصف يوم' },
  { overMinutes: 15, days: 0.25, label: 'ربع يوم' },
];

export function latenessTier(delayMinutes: number): { days: number; label: string } | null {
  return LATENESS_TIERS.find((tier) => delayMinutes > tier.overMinutes) ?? null;
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

/** The shift's weekly days off (Friday for everyone, also Saturday for LS): nobody works on them */
export function isWeeklyDayOff(day: Date, shiftType: ShiftType): boolean {
  return WEEKLY_DAYS_OFF[shiftType].includes(toDateOnly(day).getUTCDay());
}

/** The shift's weekly days off and public holidays are not working days */
export function isWorkingDay(day: Date, shiftType: ShiftType, holidays: Set<string>): boolean {
  return !isWeeklyDayOff(day, shiftType) && !holidays.has(dateKey(day));
}

/**
 * Working days in [from, to] with no attendance and no approved leave.
 * Approved permissions are handled by the caller.
 */
export function findAbsentDays(params: {
  from: Date;
  to: Date;
  shiftType: ShiftType;
  attendedDays: Set<string>;
  holidays: Set<string>;
  leaves: { startDate: Date; endDate: Date }[];
}): Date[] {
  const last = toDateOnly(params.to).getTime();
  const absent: Date[] = [];

  for (let day = toDateOnly(params.from); day.getTime() <= last; day = new Date(day.getTime() + DAY_MS)) {
    if (!isWorkingDay(day, params.shiftType, params.holidays)) continue;
    if (params.attendedDays.has(dateKey(day))) continue;
    const onLeave = params.leaves.some(
      (leave) =>
        toDateOnly(leave.startDate).getTime() <= day.getTime() &&
        day.getTime() <= toDateOnly(leave.endDate).getTime(),
    );
    if (!onLeave) absent.push(day);
  }
  return absent;
}
