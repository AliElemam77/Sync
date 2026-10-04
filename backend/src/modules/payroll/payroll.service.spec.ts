import { Prisma } from '@prisma/client';
import { PayrollService } from './payroll.service';
import { AccessScopeService } from '../../common/access/access-scope.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

const payrollManager: AuthenticatedUser = {
  id: 'hr-user',
  email: 'hr@example.com',
  roleId: 'role-hr',
  role: 'HR_MANAGER',
  permissions: ['payroll.manage'],
  employeeId: 'hr-emp',
  departmentId: 'dept-hr',
};

/**
 * Characterization tests: they pin today's payroll formula so Phase 2 changes
 * (salary source of truth, allowances/tax, shift length) are deliberate.
 */
describe('PayrollService.generatePayroll', () => {
  let prisma: any;
  let service: PayrollService;

  const employee = (salaryProfile: { baseSalary: Prisma.Decimal } | null) => ({
    id: 'emp-1',
    status: 'ACTIVE',
    salaryProfile,
    department: { id: 'dept-eng', name: 'Engineering' },
    position: { id: 'pos-1', name: 'Developer' },
  });

  beforeEach(() => {
    prisma = {
      payrollCycle: {
        findUnique: jest.fn().mockResolvedValueOnce(null).mockResolvedValue({ id: 'cycle-1' }),
        create: jest.fn().mockResolvedValue({ id: 'cycle-1' }),
      },
      employeeProfile: { findMany: jest.fn() },
      attendanceRecord: { findMany: jest.fn() },
      payslip: { create: jest.fn() },
      $transaction: jest.fn((fn: (tx: unknown) => unknown) => fn(prisma)),
    };
    service = new PayrollService(prisma, new AccessScopeService(prisma));
  });

  it('applies minute-rate delay penalties and 1.5x overtime to the base salary', async () => {
    prisma.employeeProfile.findMany.mockResolvedValue([
      employee({ baseSalary: new Prisma.Decimal(9000) }),
    ]);
    prisma.attendanceRecord.findMany
      // delayed days
      .mockResolvedValueOnce([{ date: new Date('2026-09-02'), delayMinutes: 30 }])
      // overtime days
      .mockResolvedValueOnce([{ date: new Date('2026-09-03'), overtimeMinutes: 60 }]);

    await service.generatePayroll({ month: 9, year: 2026 }, payrollManager);

    // minute rate = 9000 / 30 days / 480 minutes = 0.625
    const { data } = prisma.payslip.create.mock.calls[0][0];
    expect(data.baseSalary.toString()).toBe('9000');
    expect(data.attendancePenalties.toString()).toBe('18.75'); // 30 min x 0.625
    expect(data.totalAllowances.toString()).toBe('56.25'); // 60 min x 0.625 x 1.5
    expect(data.grossPay.toString()).toBe('9056.25');
    expect(data.netPay.toString()).toBe('9037.5');
    expect(data.adjustments.create).toHaveLength(2);
  });

  it('pays 0 when an employee has no SalaryProfile (BankInfo.basicSalary is not read; decision #1)', async () => {
    prisma.employeeProfile.findMany.mockResolvedValue([employee(null)]);
    prisma.attendanceRecord.findMany.mockResolvedValue([]);

    await service.generatePayroll({ month: 9, year: 2026 }, payrollManager);

    const { data } = prisma.payslip.create.mock.calls[0][0];
    expect(data.grossPay.toString()).toBe('0');
    expect(data.netPay.toString()).toBe('0');
  });
});
