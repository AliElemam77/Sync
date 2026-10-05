import { AttendanceService } from './attendance.service';
import { AccessScopeService } from '../../common/access/access-scope.service';
import { BadRequestException } from '@nestjs/common';
import { findAbsentDays, latenessTier, shiftBalance } from './attendance-policy';

describe('attendance policy', () => {
  it('forgives up to 15 missing minutes, then deducts a quarter, half or full day', () => {
    const days = (minutes: number) => latenessTier(minutes)?.days ?? 0;
    expect(days(15)).toBe(0);
    expect(days(16)).toBe(0.25);
    expect(days(30)).toBe(0.25);
    expect(days(31)).toBe(0.5);
    expect(days(60)).toBe(0.5);
    expect(days(61)).toBe(1);
  });

  it('balances worked and permission time against the shift length', () => {
    expect(shiftBalance(470, 0, 'RS')).toEqual({ delayMinutes: 10, overtimeMinutes: 0 });
    expect(shiftBalance(360, 120, 'RS')).toEqual({ delayMinutes: 0, overtimeMinutes: 0 });
    expect(shiftBalance(480, 0, 'LS')).toEqual({ delayMinutes: 60, overtimeMinutes: 0 });
    expect(shiftBalance(540, 0, 'RS')).toEqual({ delayMinutes: 0, overtimeMinutes: 60 });
  });

  it("finds working days with no attendance, skipping the shift's days off, holidays and leave", () => {
    // Thursday 1 to Wednesday 7 October 2026
    const absent = (shiftType: 'RS' | 'LS') =>
      findAbsentDays({
        from: new Date('2026-10-01'),
        to: new Date('2026-10-07'),
        shiftType,
        attendedDays: new Set(['2026-10-01']),
        holidays: new Set(['2026-10-06']),
        leaves: [{ startDate: new Date('2026-10-04'), endDate: new Date('2026-10-05') }],
      }).map((d) => d.toISOString().slice(0, 10));

    // RS is off on Friday 2nd; LS also on Saturday 3rd
    expect(absent('RS')).toEqual(['2026-10-03', '2026-10-07']);
    expect(absent('LS')).toEqual(['2026-10-07']);
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
    expect(latenessTier(record.delayMinutes)).toBeNull();
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
    // 01:30 on Thursday 15 January in Cairo is still 14 January in UTC
    const record = await checkInAt('2026-01-14T23:30:00Z');
    expect(record.date).toEqual(new Date('2026-01-15T00:00:00Z'));
  });

  it("refuses check-in on the shift's weekly day off", async () => {
    // Friday 16 January, 09:00 in Cairo
    await expect(checkInAt('2026-01-16T07:00:00Z')).rejects.toThrow('إجازتك الأسبوعية');

    // LS is also off on Saturday
    prisma.employeeProfile.findUnique.mockResolvedValue({ id: 'emp-1', shiftType: 'LS' });
    await expect(checkInAt('2026-01-17T07:00:00Z')).rejects.toThrow('إجازتك الأسبوعية');
    expect(prisma.attendanceRecord.create).not.toHaveBeenCalled();
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

describe('AttendanceService.recordAttendance (HR correction)', () => {
  let prisma: any;
  let service: AttendanceService;

  beforeEach(() => {
    jest.useFakeTimers({ now: new Date('2026-01-20T08:00:00Z') });
    prisma = {
      employeeProfile: { findUnique: jest.fn().mockResolvedValue({ id: 'emp-1', shiftType: 'RS' }) },
      attendanceRecord: { upsert: jest.fn(({ create }) => create) },
      permissionRequest: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { hoursRequested: null } }),
      },
    };
    service = new AttendanceService(prisma, {} as any, new AccessScopeService(prisma));
  });

  afterEach(() => jest.useRealTimers());

  it('stores the day in Cairo time and computes it like a check-out', async () => {
    const record = await service.recordAttendance({
      employeeId: 'emp-1',
      date: '2026-01-15',
      checkInTime: '09:40',
      checkOutTime: '17:00',
    });

    expect(record).toEqual(
      expect.objectContaining({
        date: new Date('2026-01-15T00:00:00Z'),
        checkInTime: new Date('2026-01-15T07:40:00Z'),
        checkOutTime: new Date('2026-01-15T15:00:00Z'),
        delayMinutes: 40, // 7h20 worked on an 8-hour shift
        overtimeMinutes: 0,
      }),
    );
    expect(prisma.attendanceRecord.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { employeeId_date: { employeeId: 'emp-1', date: new Date('2026-01-15T00:00:00Z') } },
      }),
    );
  });

  it("rejects the employee's weekly day off", async () => {
    await expect(
      service.recordAttendance({ employeeId: 'emp-1', date: '2026-01-16', checkInTime: '09:00' }),
    ).rejects.toThrow('إجازة أسبوعية');
    expect(prisma.attendanceRecord.upsert).not.toHaveBeenCalled();
  });

  it('rejects future dates and a check-out before the check-in', async () => {
    await expect(
      service.recordAttendance({ employeeId: 'emp-1', date: '2026-01-21', checkInTime: '09:00' }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.recordAttendance({
        employeeId: 'emp-1',
        date: '2026-01-15',
        checkInTime: '12:00',
        checkOutTime: '11:00',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.attendanceRecord.upsert).not.toHaveBeenCalled();
  });
});

describe('AttendanceService.createPublicHoliday', () => {
  it('adds one row per day and keeps days that are already holidays', async () => {
    const prisma: any = {
      publicHoliday: { createMany: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = new AttendanceService(prisma, {} as any, new AccessScopeService(prisma));

    await service.createPublicHoliday({
      startDate: '2026-03-20',
      endDate: '2026-03-22',
      name: ' Eid al-Fitr ',
    });

    expect(prisma.publicHoliday.createMany).toHaveBeenCalledWith({
      data: [
        { date: new Date('2026-03-20T00:00:00Z'), name: 'Eid al-Fitr' },
        { date: new Date('2026-03-21T00:00:00Z'), name: 'Eid al-Fitr' },
        { date: new Date('2026-03-22T00:00:00Z'), name: 'Eid al-Fitr' },
      ],
      skipDuplicates: true,
    });
  });
});
