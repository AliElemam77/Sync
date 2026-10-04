import { AttendanceService } from './attendance.service';
import { AccessScopeService } from '../../common/access/access-scope.service';

describe('AttendanceService.checkIn (company time: Africa/Cairo)', () => {
  let prisma: any;
  let service: AttendanceService;

  beforeEach(() => {
    prisma = {
      employeeProfile: { findUnique: jest.fn().mockResolvedValue({ id: 'emp-1', shiftType: 'RS' }) },
      attendanceRecord: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(({ data }) => data),
      },
    };
    service = new AttendanceService(prisma, {} as any, new AccessScopeService(prisma));
  });

  afterEach(() => jest.useRealTimers());

  const checkInAt = async (isoInstant: string) => {
    jest.useFakeTimers({ now: new Date(isoInstant) });
    return service.checkIn('user-1');
  };

  it('counts lateness from 09:00 Cairo time once the 15-minute grace has passed', async () => {
    // 09:20 in Cairo during winter (UTC+2)
    const record = await checkInAt('2026-01-15T07:20:00Z');
    expect(record.delayMinutes).toBe(20);
  });

  it('applies the same rule during daylight saving time (UTC+3)', async () => {
    const record = await checkInAt('2026-07-15T06:20:00Z');
    expect(record.delayMinutes).toBe(20);
  });

  it('does not count arrivals within the grace period', async () => {
    const record = await checkInAt('2026-01-15T07:10:00Z');
    expect(record.delayMinutes).toBe(0);
  });

  it('files the record under the Cairo calendar date', async () => {
    // 01:30 on 16 January in Cairo is still 15 January in UTC
    const record = await checkInAt('2026-01-15T23:30:00Z');
    expect(record.date).toEqual(new Date('2026-01-16T00:00:00Z'));
  });
});
