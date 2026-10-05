import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { BonusesService } from './bonuses.service';
import { AccessScopeService } from '../../common/access/access-scope.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

const user = (overrides: Partial<AuthenticatedUser>): AuthenticatedUser => ({
  id: 'user-x',
  email: 'x@example.com',
  roleId: 'role-x',
  role: 'EMPLOYEE',
  permissions: [],
  employeeId: 'emp-x',
  departmentId: 'dept-x',
  isManagement: false,
  ...overrides,
});

const teamLeader = user({ id: 'tl-user', role: 'TEAM_LEADER', employeeId: 'tl-emp', departmentId: 'dept-eng' });
const hrManager = user({ id: 'hr-user', role: 'HR_MANAGER', employeeId: 'hr-emp', departmentId: 'dept-hr' });
const management = user({ id: 'mgmt-user', employeeId: 'mgmt-emp', departmentId: 'dept-mgmt', isManagement: true });

describe('BonusesService', () => {
  let prisma: any;
  let service: BonusesService;

  beforeEach(() => {
    // 10 October 2026, Cairo time
    jest.useFakeTimers({ now: new Date('2026-10-10T08:00:00Z') });
    prisma = {
      employeeProfile: {
        findUnique: jest.fn().mockResolvedValue({ id: 'emp-1', departmentId: 'dept-eng', status: 'ACTIVE' }),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      department: { findMany: jest.fn().mockResolvedValue([]) },
      payrollCycle: { findUnique: jest.fn().mockResolvedValue(null) },
      bonus: {
        create: jest.fn(({ data }) => data),
        findUnique: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'bonus-1' }),
      },
      $transaction: jest.fn((fn: (tx: unknown) => unknown) => fn(prisma)),
    };
    service = new BonusesService(prisma, new AccessScopeService(prisma));
  });

  afterEach(() => jest.useRealTimers());

  const grant = (actor: AuthenticatedUser, overrides: Record<string, unknown> = {}) =>
    service.grant({ employeeId: 'emp-1', days: 1, reason: 'Heavy release week', ...overrides } as any, actor);

  describe('grant', () => {
    it("lets a Team Leader give a pay bonus to their department, paid with this month's salary", async () => {
      const bonus: any = await grant(teamLeader, { days: 0.5 });

      expect(bonus).toEqual(
        expect.objectContaining({
          employeeId: 'emp-1',
          kind: 'PAY',
          days: new Prisma.Decimal('0.5'),
          payrollMonth: new Date('2026-10-01T00:00:00Z'),
          grantedById: 'tl-user',
        }),
      );
      expect(prisma.employeeProfile.update).not.toHaveBeenCalled();
    });

    it('refuses employees outside the departments the user leads, and HR', async () => {
      prisma.employeeProfile.findUnique.mockResolvedValue({ id: 'emp-2', departmentId: 'dept-sales', status: 'ACTIVE' });

      await expect(grant(teamLeader)).rejects.toThrow(ForbiddenException);
      await expect(grant(hrManager)).rejects.toThrow(ForbiddenException);
      expect(prisma.bonus.create).not.toHaveBeenCalled();
    });

    it('accepts half days only and never for oneself', async () => {
      await expect(grant(teamLeader, { days: 0.3 })).rejects.toThrow(BadRequestException);

      prisma.employeeProfile.findUnique.mockResolvedValue({ id: 'tl-emp', departmentId: 'dept-eng', status: 'ACTIVE' });
      await expect(grant(teamLeader)).rejects.toThrow('لنفسك');
    });

    it('lets only Management add leave days, on top of the balance', async () => {
      await expect(grant(teamLeader, { kind: 'LEAVE', days: 2 })).rejects.toThrow(ForbiddenException);

      await grant(management, { kind: 'LEAVE', days: 2 });
      expect(prisma.employeeProfile.update).toHaveBeenCalledWith({
        where: { id: 'emp-1' },
        data: { annualLeaveDays: { increment: new Prisma.Decimal(2) } },
      });
    });

    it("moves to next month's payroll once this month's is approved", async () => {
      prisma.payrollCycle.findUnique.mockResolvedValue({ status: 'APPROVED' });

      const bonus: any = await grant(teamLeader);

      expect(bonus.payrollMonth).toEqual(new Date('2026-11-01T00:00:00Z'));
    });
  });

  describe('cancel', () => {
    const payBonus = {
      id: 'bonus-1',
      employeeId: 'emp-1',
      kind: 'PAY',
      days: new Prisma.Decimal(1),
      payrollMonth: new Date('2026-10-01T00:00:00Z'),
      grantedById: 'tl-user',
      cancelledAt: null,
    };

    it('lets HR, Management or the granter cancel, but nobody else', async () => {
      prisma.bonus.findUnique.mockResolvedValue(payBonus);

      await expect(service.cancel('bonus-1', user({}))).rejects.toThrow(ForbiddenException);
      await service.cancel('bonus-1', hrManager);
      await service.cancel('bonus-1', teamLeader);

      expect(prisma.bonus.updateMany).toHaveBeenCalledWith({
        where: { id: 'bonus-1', cancelledAt: null },
        data: { cancelledAt: expect.any(Date), cancelledById: 'hr-user' },
      });
    });

    it("refuses once that month's payroll is approved", async () => {
      prisma.bonus.findUnique.mockResolvedValue(payBonus);
      prisma.payrollCycle.findUnique.mockResolvedValue({ status: 'APPROVED' });

      await expect(service.cancel('bonus-1', hrManager)).rejects.toThrow('معتمد');
      expect(prisma.bonus.updateMany).not.toHaveBeenCalled();
    });

    it('takes leave days back only while they are still in the balance', async () => {
      prisma.bonus.findUnique.mockResolvedValue({ ...payBonus, kind: 'LEAVE', days: new Prisma.Decimal(2) });

      await service.cancel('bonus-1', management);
      expect(prisma.employeeProfile.updateMany).toHaveBeenCalledWith({
        where: { id: 'emp-1', annualLeaveDays: { gte: new Prisma.Decimal(2) } },
        data: { annualLeaveDays: { decrement: new Prisma.Decimal(2) } },
      });

      prisma.employeeProfile.updateMany.mockResolvedValue({ count: 0 });
      await expect(service.cancel('bonus-1', management)).rejects.toThrow('استخدم الموظف');
    });
  });
});
