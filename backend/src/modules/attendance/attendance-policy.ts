import { ShiftType } from '@prisma/client';

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
