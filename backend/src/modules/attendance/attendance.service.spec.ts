import { AttendanceService } from './attendance.service';
import { AccessScopeService } from '../../common/access/access-scope.service';
import { deductibleDelayMinutes, shiftBalance } from './attendance-policy';

describe('attendance policy', () => {
  it('forgives up to 15 missing minutes, then deducts every minute', () => {
    expect(deductibleDelayMinutes(10)).toBe(0);
    expect(deductibleDelayMinutes(15)).toBe(0);
    expect(deductibleDelayMinutes(16)).toBe(16);
    expect(deductibleDelayMinutes(45)).toBe(45);
  });

  it('balances worked and permission time against the shift length', () => {
    expect(shiftBalance(470, 0, 'RS')).toEqual({ delayMinutes: 10, overtimeMinutes: 0 });
    expect(shiftBalance(360, 120, 'RS')).toEqual({ delayMinutes: 0, overtimeMinutes: 0 });
    expect(shiftBalance(480, 0, 'LS')).toEqual({ delayMinutes: 60, overtimeMinutes: 0 });
    expect(shiftBalance(540, 0, 'RS')).toEqual({ delayMinutes: 0, overtimeMinutes: 60 });
  });
});

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
      permissionRequest: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { hoursRequested: null } }),
      },
    };
    service = new AttendanceService(prisma, {} as any, new AccessScopeService(prisma));
  });

  afterEach(() => jest.useRealTimers());

  const checkInAt = async (isoInstant: string) => {
    jest.useFakeTimers({ now: new Date(isoInstant) });
    return service.checkIn('user-1');
  };

  it('counts lateness from 09:00 Cairo time', async () => {
    // 09:20 in Cairo during winter (UTC+2)
    const record = await checkInAt('2026-01-15T07:20:00Z');
    expect(record.delayMinutes).toBe(20);
  });

  it('applies the same rule during daylight saving time (UTC+3)', async () => {
    const record = await checkInAt('2026-07-15T06:20:00Z');
    expect(record.delayMinutes).toBe(20);
  });

  it('keeps the actual minutes within the grace period; payroll does not deduct them', async () => {
    const record = await checkInAt('2026-01-15T07:10:00Z');
    expect(record.delayMinutes).toBe(10);
    expect(deductibleDelayMinutes(record.delayMinutes)).toBe(0);
  });

  it('does not count arrival time covered by an approved permission', async () => {
    // Approved 2-hour permission, arrives at 11:05
    prisma.permissionRequest.aggregate.mockResolvedValue({ _sum: { hoursRequested: 2 } });

    const record = await checkInAt('2026-01-15T09:05:00Z');

    expect(record.delayMinutes).toBe(5);
    expect(prisma.permissionRequest.aggregate).toHaveBeenCalledWith({
      where: { employeeId: 'emp-1', date: new Date('2026-01-15T00:00:00Z'), status: 'APPROVED' },
      _sum: { hoursRequested: true },
    });
  });

  it('files the record under the Cairo calendar date', async () => {
    // 01:30 on 16 January in Cairo is still 15 January in UTC
    const record = await checkInAt('2026-01-15T23:30:00Z');
    expect(record.date).toEqual(new Date('2026-01-16T00:00:00Z'));
  });
});

describe('AttendanceService.checkOut', () => {
  let prisma: any;
  let service: AttendanceService;

  beforeEach(() => {
    prisma = {
      employeeProfile: { findUnique: jest.fn().mockResolvedValue({ id: 'emp-1', shiftType: 'RS' }) },
      attendanceRecord: {
        // Checked in at 09:30 Cairo time
        findUnique: jest.fn().mockResolvedValue({
          id: 'rec-1',
          checkInTime: new Date('2026-01-15T07:30:00Z'),
          checkOutTime: null,
        }),
        update: jest.fn(({ data }) => data),
      },
      permissionRequest: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { hoursRequested: null } }),
      },
    };
    service = new AttendanceService(prisma, {} as any, new AccessScopeService(prisma));
  });

  afterEach(() => jest.useRealTimers());

  it('credits approved permission time towards the shift', async () => {
    // Leaves at 15:30 (6 hours worked) with a 2-hour permission: a full RS day
    prisma.permissionRequest.aggregate.mockResolvedValue({ _sum: { hoursRequested: 2 } });
    jest.useFakeTimers({ now: new Date('2026-01-15T13:30:00Z') });

    const record = await service.checkOut('user-1');

    expect(record).toEqual(expect.objectContaining({ delayMinutes: 0, overtimeMinutes: 0 }));
  });

  it('records the missing minutes when the day is short', async () => {
    // Leaves at 17:00: 7.5 hours worked
    jest.useFakeTimers({ now: new Date('2026-01-15T15:00:00Z') });

    const record = await service.checkOut('user-1');

    expect(record).toEqual(expect.objectContaining({ delayMinutes: 30, overtimeMinutes: 0 }));
  });
});
