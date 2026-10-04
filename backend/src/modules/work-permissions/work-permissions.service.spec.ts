import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { WorkPermissionsService } from './work-permissions.service';
import { AccessScopeService } from '../../common/access/access-scope.service';
import { wholeHoursBetween } from './permission-policy';

describe('permission policy', () => {
  it('accepts only positive whole-hour spans', () => {
    expect(wholeHoursBetween('10:00', '12:00')).toBe(2);
    expect(wholeHoursBetween('10:00', '11:30')).toBeNull();
    expect(wholeHoursBetween('12:00', '10:00')).toBeNull();
  });
});

describe('WorkPermissionsService.createPermissionRequest', () => {
  let prisma: any;
  let service: WorkPermissionsService;

  beforeEach(() => {
    prisma = {
      employeeProfile: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'emp-1', monthlyPermissionHours: 4, annualLeaveDays: new Prisma.Decimal(10) }),
      },
      permissionRequest: {
        create: jest.fn(({ data }) => data),
        aggregate: jest.fn().mockResolvedValue({ _sum: { hoursRequested: null } }),
      },
    };
    service = new WorkPermissionsService(prisma, {} as any, new AccessScopeService(prisma));
  });

  const request = (startTime: string, endTime: string, hoursRequested = 1) =>
    service.createPermissionRequest('emp-user', {
      date: '2026-10-06',
      startTime,
      endTime,
      hoursRequested,
      reason: 'Bank visit',
    });

  it('derives the hours from the requested times', async () => {
    const permission: any = await request('10:00', '13:00');
    expect(permission.hoursRequested).toBe(3);
  });

  it("checks the request against what is left of that month's allowance", async () => {
    // 4-hour allowance, 2 hours already approved this month
    prisma.permissionRequest.aggregate.mockResolvedValue({ _sum: { hoursRequested: 2 } });

    await expect(request('10:00', '13:00')).rejects.toThrow('Remaining this month: 2 hour(s)');
    await expect(request('10:00', '12:00')).resolves.toBeDefined();

    expect(prisma.permissionRequest.aggregate).toHaveBeenCalledWith({
      where: {
        employeeId: 'emp-1',
        status: 'APPROVED',
        date: { gte: new Date('2026-10-01T00:00:00Z'), lt: new Date('2026-11-01T00:00:00Z') },
        hoursRequested: { lt: 4 },
      },
      _sum: { hoursRequested: true },
    });
  });

  it('rejects partial hours and spans longer than 4 hours', async () => {
    await expect(request('10:00', '11:30')).rejects.toThrow(BadRequestException);
    await expect(request('09:00', '14:00')).rejects.toThrow(BadRequestException);
    expect(prisma.permissionRequest.create).not.toHaveBeenCalled();
  });
});

describe('half-day (4-hour) permissions', () => {
  const hrUser = {
    id: 'hr-user',
    email: 'hr@example.com',
    roleId: 'role-hr',
    role: 'HR_MANAGER',
    permissions: [],
    employeeId: 'hr-emp',
    departmentId: 'dept-hr',
    isManagement: false,
  };

  let prisma: any;
  let service: WorkPermissionsService;

  beforeEach(() => {
    prisma = {
      employeeProfile: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'emp-1',
          monthlyPermissionHours: 0,
          annualLeaveDays: new Prisma.Decimal(1),
        }),
        update: jest.fn(),
      },
      permissionRequest: {
        create: jest.fn(({ data }) => data),
        aggregate: jest.fn(),
        findUnique: jest.fn().mockResolvedValue({
          id: 'perm-1',
          employeeId: 'emp-1',
          date: new Date('2026-10-06T00:00:00Z'),
          hoursRequested: 4,
          status: 'PENDING',
          employee: { id: 'emp-1', departmentId: 'dept-eng' },
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'perm-1', employee: { userId: 'emp-user' } }),
      },
      $transaction: jest.fn((fn: (tx: unknown) => unknown) => fn(prisma)),
    };
    service = new WorkPermissionsService(
      prisma,
      { sendNotification: jest.fn() } as any,
      new AccessScopeService(prisma),
    );
  });

  it('is requested against the annual leave balance, not the monthly hours', async () => {
    // No monthly hours left, but 1 day of annual leave
    await expect(
      service.createPermissionRequest('emp-user', {
        date: '2026-10-06',
        startTime: '09:00',
        endTime: '13:00',
        hoursRequested: 4,
        reason: 'Family errand',
      }),
    ).resolves.toEqual(expect.objectContaining({ hoursRequested: 4 }));
    expect(prisma.permissionRequest.aggregate).not.toHaveBeenCalled();
  });

  it('needs at least half a day of annual leave', async () => {
    prisma.employeeProfile.findUnique.mockResolvedValue({
      id: 'emp-1',
      monthlyPermissionHours: 4,
      annualLeaveDays: new Prisma.Decimal('0.25'),
    });

    await expect(
      service.createPermissionRequest('emp-user', {
        date: '2026-10-06',
        startTime: '09:00',
        endTime: '13:00',
        hoursRequested: 4,
        reason: 'Family errand',
      }),
    ).rejects.toThrow('counts as half a day of annual leave');
  });

  it('deducts half a day of annual leave when approved', async () => {
    await service.approvePermissionRequest('perm-1', hrUser);

    expect(prisma.employeeProfile.update).toHaveBeenCalledWith({
      where: { id: 'emp-1' },
      data: { annualLeaveDays: { decrement: new Prisma.Decimal('0.5') } },
    });
    expect(prisma.permissionRequest.aggregate).not.toHaveBeenCalled();
  });
});
