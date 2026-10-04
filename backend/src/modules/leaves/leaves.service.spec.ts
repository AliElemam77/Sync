import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { LeaveType, RequestStatus } from '@prisma/client';
import { LeavesService } from './leaves.service';
import { AccessScopeService } from '../../common/access/access-scope.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

const makeUser = (overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser => ({
  id: 'hr-user',
  email: 'hr@example.com',
  roleId: 'role-hr',
  role: 'HR_MANAGER',
  permissions: ['leaves.approve'],
  employeeId: 'hr-emp',
  departmentId: 'dept-hr',
  ...overrides,
});

const pendingLeave = (overrides: Record<string, unknown> = {}) => ({
  id: 'leave-1',
  employeeId: 'emp-1',
  type: LeaveType.ANNUAL,
  status: RequestStatus.PENDING,
  totalDaysRequested: 3,
  employee: { id: 'emp-1', userId: 'emp-user', annualLeaveDays: 10, departmentId: 'dept-eng' },
  ...overrides,
});

describe('LeavesService approvals', () => {
  let prisma: any;
  let events: { sendNotification: jest.Mock };
  let service: LeavesService;

  beforeEach(() => {
    prisma = {
      leaveRequest: {
        findUnique: jest.fn().mockResolvedValue(pendingLeave()),
        update: jest.fn().mockImplementation(({ data }) => ({
          ...pendingLeave(),
          ...data,
          employee: { id: 'emp-1', userId: 'emp-user' },
        })),
      },
      employeeProfile: {
        findUnique: jest.fn().mockResolvedValue({ id: 'emp-1', annualLeaveDays: 10 }),
        update: jest.fn(),
      },
      department: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn((fn: (tx: unknown) => unknown) => fn(prisma)),
    };
    events = { sendNotification: jest.fn() };
    service = new LeavesService(prisma, events as any, new AccessScopeService(prisma));
  });

  describe('who may decide', () => {
    const leaderOf = (departmentId: string) =>
      makeUser({ id: 'tl-user', role: 'TEAM_LEADER', employeeId: 'tl-emp', departmentId });

    it('lets a Team Leader approve requests from their own department', async () => {
      await service.approveLeaveRequest('leave-1', leaderOf('dept-eng'));
      expect(prisma.leaveRequest.update).toHaveBeenCalled();
    });

    it("forbids a Team Leader from deciding another department's requests", async () => {
      await expect(service.approveLeaveRequest('leave-1', leaderOf('dept-sales'))).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('lets a department head decide for the departments they manage', async () => {
      prisma.department.findMany.mockResolvedValue([{ id: 'dept-eng' }]);
      const head = makeUser({ id: 'head-user', role: 'EMPLOYEE', employeeId: 'head-emp', departmentId: 'dept-ops' });

      await service.rejectLeaveRequest('leave-1', { rejectionReason: 'Release week' }, head);
      expect(prisma.leaveRequest.update).toHaveBeenCalled();
    });

    it('forbids approving your own request', async () => {
      const selfLeader = makeUser({ id: 'emp-user', role: 'TEAM_LEADER', employeeId: 'emp-1', departmentId: 'dept-eng' });
      await expect(service.approveLeaveRequest('leave-1', selfLeader)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('forbids regular employees', async () => {
      await expect(
        service.approveLeaveRequest('leave-1', makeUser({ role: 'EMPLOYEE', employeeId: 'emp-2' })),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  it('refuses to approve a request that is no longer pending', async () => {
    prisma.leaveRequest.findUnique.mockResolvedValue(pendingLeave({ status: RequestStatus.APPROVED }));
    await expect(service.approveLeaveRequest('leave-1', makeUser())).rejects.toThrow(
      BadRequestException,
    );
    expect(prisma.employeeProfile.update).not.toHaveBeenCalled();
  });

  it('deducts annual leave days on approval and notifies the employee', async () => {
    await service.approveLeaveRequest('leave-1', makeUser());

    expect(prisma.employeeProfile.update).toHaveBeenCalledWith({
      where: { id: 'emp-1' },
      data: { annualLeaveDays: { decrement: 3 } },
    });
    expect(events.sendNotification).toHaveBeenCalledWith('emp-user', expect.any(Object));
  });

  it('refuses approval when the balance is insufficient', async () => {
    prisma.employeeProfile.findUnique.mockResolvedValue({ id: 'emp-1', annualLeaveDays: 1 });
    await expect(service.approveLeaveRequest('leave-1', makeUser())).rejects.toThrow(
      BadRequestException,
    );
  });

  it('does not touch the balance for non-annual leave', async () => {
    prisma.leaveRequest.findUnique.mockResolvedValue(pendingLeave({ type: LeaveType.SICK }));
    await service.approveLeaveRequest('leave-1', makeUser());
    expect(prisma.employeeProfile.update).not.toHaveBeenCalled();
  });

  it('records the rejection reason', async () => {
    await service.rejectLeaveRequest('leave-1', { rejectionReason: 'Peak season' }, makeUser());
    expect(prisma.leaveRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: RequestStatus.REJECTED, rejectionReason: 'Peak season' },
      }),
    );
  });
});
