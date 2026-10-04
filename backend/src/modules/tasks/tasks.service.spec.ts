import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { TaskStatus } from '@prisma/client';
import { TasksService } from './tasks.service';
import { AccessScopeService } from '../../common/access/access-scope.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

const makeUser = (overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser => ({
  id: 'outsider-user',
  email: 'user@example.com',
  roleId: 'role-emp',
  role: 'EMPLOYEE',
  permissions: ['tasks.view', 'tasks.update'],
  employeeId: 'outsider-emp',
  departmentId: 'dept-sales',
  isManagement: false,
  ...overrides,
});

const creator = makeUser({ id: 'creator-user', employeeId: 'creator-emp', departmentId: 'dept-ops' });
const assignee = makeUser({ id: 'assignee-user', employeeId: 'assignee-emp', departmentId: 'dept-eng' });
const outsider = makeUser();
const hrAdmin = makeUser({ id: 'hr-user', role: 'HR_MANAGER', employeeId: 'hr-emp', departmentId: 'dept-hr' });

const profileFor = (user: AuthenticatedUser) => ({
  id: user.employeeId,
  departmentId: user.departmentId,
  fullName: user.email,
});

const baseTask = {
  id: 'task-1',
  title: 'Prepare report',
  status: TaskStatus.IN_PROGRESS,
  creatorId: 'creator-emp',
  assigneeId: 'assignee-emp',
  targetDepartmentId: 'dept-eng',
  creator: { userId: 'creator-user' },
  assignee: { userId: 'assignee-user' },
  comments: [],
};

describe('TasksService', () => {
  let prisma: any;
  let service: TasksService;

  const actAs = (user: AuthenticatedUser) =>
    prisma.employeeProfile.findUnique.mockResolvedValue(profileFor(user));

  beforeEach(() => {
    prisma = {
      task: {
        findUnique: jest.fn().mockResolvedValue(baseTask),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockImplementation(({ data }) => ({ ...baseTask, ...data })),
      },
      taskComment: { create: jest.fn() },
      employeeProfile: { findUnique: jest.fn() },
      department: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn((fn: (tx: unknown) => unknown) => fn(prisma)),
    };
    const events = {
      broadcastTaskStatusChanged: jest.fn(),
      broadcastTaskUpdated: jest.fn(),
    };
    service = new TasksService(prisma, events as any, new AccessScopeService(prisma));
  });

  describe('status state machine', () => {
    it('only lets the creator or an admin accept a task as DONE', async () => {
      actAs(assignee);
      await expect(
        service.updateTaskStatus('task-1', { status: TaskStatus.DONE }, assignee),
      ).rejects.toThrow(ForbiddenException);

      actAs(creator);
      await service.updateTaskStatus('task-1', { status: TaskStatus.DONE }, creator);
      expect(prisma.task.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: TaskStatus.DONE }) }),
      );
    });

    it('requires a comment when sending a task back for revision', async () => {
      actAs(creator);
      await expect(
        service.updateTaskStatus('task-1', { status: TaskStatus.NEEDS_REVISION }, creator),
      ).rejects.toThrow(BadRequestException);
    });

    it('lets the assignee move work forward to REVIEW', async () => {
      actAs(assignee);
      await service.updateTaskStatus('task-1', { status: TaskStatus.REVIEW }, assignee);
      expect(prisma.task.update).toHaveBeenCalled();
    });

    it('rejects status changes and reordering from users unrelated to the task', async () => {
      actAs(outsider);
      await expect(
        service.updateTaskStatus('task-1', { status: TaskStatus.REVIEW }, outsider),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.updateTaskStatus('task-1', { status: TaskStatus.IN_PROGRESS, order: 3 }, outsider),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('acceptance date and weight', () => {
    it('stamps completedAt when a task is accepted and clears it when reopened', async () => {
      actAs(creator);
      await service.updateTaskStatus('task-1', { status: TaskStatus.DONE }, creator);
      expect(prisma.task.update.mock.calls[0][0].data.completedAt).toBeInstanceOf(Date);

      prisma.task.findUnique.mockResolvedValue({ ...baseTask, status: TaskStatus.DONE });
      await service.updateTaskStatus(
        'task-1',
        { status: TaskStatus.NEEDS_REVISION, comment: 'Missing tests' },
        creator,
      );
      expect(prisma.task.update.mock.calls[1][0].data.completedAt).toBeNull();
    });

    it('lets the Team Leader of the target department set the weight', async () => {
      const leader = makeUser({ id: 'tl-user', role: 'TEAM_LEADER', employeeId: 'tl-emp', departmentId: 'dept-eng' });
      actAs(leader);

      await service.updateTask('task-1', { weight: 2 }, leader);

      expect(prisma.task.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ weight: 2 }) }),
      );
    });

    it('does not let the assignee or creator weigh their own task', async () => {
      actAs(assignee);
      await expect(service.updateTask('task-1', { weight: 3 }, assignee)).rejects.toThrow(
        ForbiddenException,
      );
      actAs(creator);
      await expect(service.updateTask('task-1', { weight: 3 }, creator)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('updateTask', () => {
    it('applies the state machine to status changes (no bypass of /status)', async () => {
      actAs(assignee);
      await expect(
        service.updateTask('task-1', { status: TaskStatus.DONE }, assignee),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.task.update).not.toHaveBeenCalled();
    });

    it('rejects edits from users unrelated to the task', async () => {
      actAs(outsider);
      await expect(service.updateTask('task-1', { order: 1 }, outsider)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('visibility', () => {
    it('always scopes non-admin task lists, even when searching', async () => {
      actAs(outsider);
      await service.getTasks({ search: 'report' }, outsider);

      const { where } = prisma.task.findMany.mock.calls[0][0];
      expect(where.AND[1]).toEqual({
        OR: [
          { assigneeId: 'outsider-emp' },
          { creatorId: 'outsider-emp' },
          { targetDepartmentId: 'dept-sales' },
        ],
      });
    });

    it('does not scope admin task lists', async () => {
      actAs(hrAdmin);
      await service.getTasks({ search: 'report' }, hrAdmin);

      const { where } = prisma.task.findMany.mock.calls[0][0];
      expect(where.AND).toBeUndefined();
    });

    it('hides unrelated tasks from GET /tasks/:id', async () => {
      actAs(outsider);
      await expect(service.getTaskById('task-1', outsider)).rejects.toThrow(NotFoundException);
    });

    it('shows a task to members of its target department', async () => {
      const teammate = makeUser({ id: 'teammate-user', employeeId: 'teammate-emp', departmentId: 'dept-eng' });
      actAs(teammate);
      await expect(service.getTaskById('task-1', teammate)).resolves.toEqual(baseTask);
    });
  });
});
