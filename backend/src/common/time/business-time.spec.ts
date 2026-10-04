import {
  businessMinutesOfDay,
  businessMonthRange,
  businessToday,
  formatBusinessTime,
  zonedTimeToUtc,
} from './business-time';

// Cairo is UTC+2 in winter and UTC+3 during daylight saving (late April to late October)
describe('business time (Africa/Cairo)', () => {
  it('reads wall-clock minutes in Cairo regardless of the server timezone', () => {
    expect(businessMinutesOfDay(new Date('2026-01-15T07:20:00Z'))).toBe(9 * 60 + 20);
    expect(businessMinutesOfDay(new Date('2026-07-15T06:20:00Z'))).toBe(9 * 60 + 20);
  });

  it('rolls the business date over at Cairo midnight, not UTC midnight', () => {
    expect(businessToday(new Date('2026-01-15T22:30:00Z'))).toEqual(new Date('2026-01-16T00:00:00Z'));
    expect(businessToday(new Date('2026-01-15T21:30:00Z'))).toEqual(new Date('2026-01-15T00:00:00Z'));
  });

  it('converts Cairo wall-clock times to UTC instants across DST', () => {
    expect(zonedTimeToUtc(2026, 1, 1)).toEqual(new Date('2025-12-31T22:00:00Z'));
    expect(zonedTimeToUtc(2026, 7, 1, 9, 0)).toEqual(new Date('2026-07-01T06:00:00Z'));
  });

  it('builds [start, end) month ranges in company time', () => {
    expect(businessMonthRange(2026, 12)).toEqual({
      start: new Date('2026-11-30T22:00:00Z'),
      end: new Date('2026-12-31T22:00:00Z'),
    });
  });

  it('formats times for messages in company time', () => {
    expect(formatBusinessTime(new Date('2026-01-15T07:05:00Z'))).toBe('09:05');
  });
});
