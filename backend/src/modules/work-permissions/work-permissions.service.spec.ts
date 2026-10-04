import { BadRequestException } from '@nestjs/common';
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
        findUnique: jest.fn().mockResolvedValue({ id: 'emp-1', monthlyPermissionHours: 4 }),
      },
      permissionRequest: { create: jest.fn(({ data }) => data) },
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

  it('rejects partial hours and spans longer than 4 hours', async () => {
    await expect(request('10:00', '11:30')).rejects.toThrow(BadRequestException);
    await expect(request('09:00', '14:00')).rejects.toThrow(BadRequestException);
    expect(prisma.permissionRequest.create).not.toHaveBeenCalled();
  });
});
