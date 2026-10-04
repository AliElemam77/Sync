/**
 * Permissions are taken in whole hours: 1, 2 or 3. A 4-hour absence counts as half a day;
 * until half-day leave exists it is still accepted here and counted against the monthly hours.
 */
export const MAX_PERMISSION_HOURS = 4;

/**
 * Calendar month (as [start, end) date-only values) that a permission date counts against.
 * EmployeeProfile.monthlyPermissionHours is the monthly allowance; what remains is the allowance
 * minus the hours approved for that month, so the balance renews every month by itself.
 */
export function permissionMonthRange(date: Date): { start: Date; end: Date } {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  return {
    start: new Date(Date.UTC(year, month, 1)),
    end: new Date(Date.UTC(year, month + 1, 1)),
  };
}

/** Whole hours between two HH:mm times, or null when the span is not a positive whole number of hours */
export function wholeHoursBetween(startTime: string, endTime: string): number | null {
  const toMinutes = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  };
  const span = toMinutes(endTime) - toMinutes(startTime);
  return span > 0 && span % 60 === 0 ? span / 60 : null;
}
