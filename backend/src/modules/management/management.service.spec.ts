import { BadRequestException } from '@nestjs/common';
import { TaskStatus } from '@prisma/client';
import { ManagementService } from './management.service';
import { ManagementAction, RequestCategory } from './dto/management-override.dto';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

const admin: AuthenticatedUser = {
  id: 'admin-user',
  email: 'admin@example.com',
  roleId: 'role-super',
  role: 'SUPER_ADMIN',
  permissions: [],
  employeeId: null,
  departmentId: null,
  isManagement: false,
};

describe('ManagementService.overrideAction', () => {
  let prisma: any;
  let leaves: { approveLeaveRequest: jest.Mock; rejectLeaveRequest: jest.Mock };
  let permissions: { approvePermissionRequest: jest.Mock; rejectPermissionRequest: jest.Mock };
  let service: ManagementService;

  beforeEach(() => {
    prisma = { task: { findUnique: jest.fn(), update: jest.fn() } };
    leaves = { approveLeaveRequest: jest.fn(), rejectLeaveRequest: jest.fn() };
    permissions = { approvePermissionRequest: jest.fn(), rejectPermissionRequest: jest.fn() };
    service = new ManagementService(prisma, leaves as any, permissions as any);
  });

  it('delegates leave approval to LeavesService (status, balance and notification rules)', async () => {
    await service.overrideAction(
      { id: 'leave-1', category: RequestCategory.LEAVE, action: ManagementAction.APPROVE },
      admin,
    );
    expect(leaves.approveLeaveRequest).toHaveBeenCalledWith('leave-1', admin);
  });

  it('delegates permission rejection with a default reason', async () => {
    await service.overrideAction(
      { id: 'perm-1', category: RequestCategory.PERMISSION, action: ManagementAction.REJECT },
      admin,
    );
    expect(permissions.rejectPermissionRequest).toHaveBeenCalledWith(
      'perm-1',
      { rejectionReason: expect.any(String) },
      admin,
    );
  });

  it('only overrides tasks that are in review or waiting for the client', async () => {
    prisma.task.findUnique.mockResolvedValue({ id: 'task-1', status: TaskStatus.TODO });
    await expect(
      service.overrideAction(
        { id: 'task-1', category: RequestCategory.TASK, action: ManagementAction.APPROVE },
        admin,
      ),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.task.update).not.toHaveBeenCalled();
  });

  it('completes a task under review', async () => {
    prisma.task.findUnique.mockResolvedValue({ id: 'task-1', status: TaskStatus.REVIEW });
    await service.overrideAction(
      { id: 'task-1', category: RequestCategory.TASK, action: ManagementAction.APPROVE },
      admin,
    );
    expect(prisma.task.update).toHaveBeenCalledWith({
      where: { id: 'task-1' },
      data: { status: TaskStatus.DONE },
    });
  });
});
