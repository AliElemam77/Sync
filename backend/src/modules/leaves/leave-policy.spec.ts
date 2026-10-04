import { ShiftType } from '@prisma/client';
import { calendarDaysBetween, countWorkingDays } from './leave-policy';

const day = (iso: string) => new Date(`${iso}T00:00:00Z`);

// 2026-10-06 is a Tuesday; 2026-10-09 is a Friday and 2026-10-10 a Saturday
describe('leave policy: working days', () => {
  it('counts Tuesday to Thursday as 3 working days', () => {
    expect(countWorkingDays(day('2026-10-06'), day('2026-10-08'), ShiftType.LS)).toBe(3);
  });

  it('skips Friday and Saturday for the 5-day (LS) shift', () => {
    // Thu, (Fri), (Sat), Sun
    expect(countWorkingDays(day('2026-10-08'), day('2026-10-11'), ShiftType.LS)).toBe(2);
  });

  it('skips only Friday for the 6-day (RS) shift', () => {
    // Thu, (Fri), Sat, Sun
    expect(countWorkingDays(day('2026-10-08'), day('2026-10-11'), ShiftType.RS)).toBe(3);
  });

  it('returns 0 when the whole range is weekly days off', () => {
    expect(countWorkingDays(day('2026-10-09'), day('2026-10-10'), ShiftType.LS)).toBe(0);
  });

  it('counts calendar days inclusively', () => {
    expect(calendarDaysBetween(day('2026-10-06'), day('2026-10-06'))).toBe(1);
    expect(calendarDaysBetween(day('2026-10-06'), day('2026-10-11'))).toBe(6);
  });
});
