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

describe('PayrollService.approveCycle', () => {
  let prisma: any;
  let service: PayrollService;

  beforeEach(() => {
    prisma = {
      payrollCycle: {
        findUnique: jest.fn().mockResolvedValue({ status: 'DRAFT' }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 'cycle-1',
          month: 9,
          year: 2026,
          totalNet: new Prisma.Decimal('125000.50'),
          payslips: [],
        }),
      },
      financialTransaction: { create: jest.fn() },
      $transaction: jest.fn((fn: (tx: unknown) => unknown) => fn(prisma)),
    };
    service = new PayrollService(prisma, new AccessScopeService(prisma));
  });

  it('posts the approved net payroll to the ledger as a payroll expense', async () => {
    await service.approveCycle('cycle-1', payrollManager);

    expect(prisma.financialTransaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        amount: new Prisma.Decimal('125000.50'),
        type: 'EXPENSE',
        category: 'PAYROLL',
        referenceId: 'cycle-1',
        referenceType: 'PAYROLL_CYCLE',
        recordedById: 'hr-user',
      }),
    });
  });

  it('refuses a second approval without posting again', async () => {
    prisma.payrollCycle.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.approveCycle('cycle-1', payrollManager)).rejects.toThrow();
    expect(prisma.financialTransaction.create).not.toHaveBeenCalled();
  });
});

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
      payslip: { createMany: jest.fn() },
      financialAdjustment: { createMany: jest.fn() },
      $transaction: jest.fn((fn: (tx: unknown) => unknown) => fn(prisma)),
    };
    service = new PayrollService(prisma, new AccessScopeService(prisma));
  });

  it('applies minute-rate delay penalties and 1.5x overtime to the base salary', async () => {
    prisma.employeeProfile.findMany.mockResolvedValue([
      employee({ baseSalary: new Prisma.Decimal(9000) }),
    ]);
    prisma.attendanceRecord.findMany.mockResolvedValue([
      { employeeId: 'emp-1', date: new Date('2026-09-02'), delayMinutes: 30, overtimeMinutes: 0 },
      { employeeId: 'emp-1', date: new Date('2026-09-03'), delayMinutes: 0, overtimeMinutes: 60 },
    ]);

    await service.generatePayroll({ month: 9, year: 2026 }, payrollManager);

    // Probation employees are paid like active staff
    expect(prisma.employeeProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: { in: ['ACTIVE', 'PROBATION'] } } }),
    );

    // A single attendance query covers every employee
    expect(prisma.attendanceRecord.findMany).toHaveBeenCalledTimes(1);

    // minute rate = 9000 / 30 days / 480 minutes = 0.625
    const [payslip] = prisma.payslip.createMany.mock.calls[0][0].data;
    expect(payslip.payrollCycleId).toBe('cycle-1');
    expect(payslip.baseSalary.toString()).toBe('9000');
    expect(payslip.attendancePenalties.toString()).toBe('18.75'); // 30 min x 0.625
    expect(payslip.totalAllowances.toString()).toBe('56.25'); // 60 min x 0.625 x 1.5
    expect(payslip.grossPay.toString()).toBe('9056.25');
    expect(payslip.netPay.toString()).toBe('9037.5');

    const adjustments = prisma.financialAdjustment.createMany.mock.calls[0][0].data;
    expect(adjustments).toHaveLength(2);
    expect(adjustments.every((a: { payslipId: string }) => a.payslipId === payslip.id)).toBe(true);
    expect(adjustments.map((a: { amount: Prisma.Decimal }) => a.amount.toString())).toEqual([
      '18.75',
      '56.25',
    ]);
  });

  it('pays 0 when an employee has no SalaryProfile (BankInfo.basicSalary is not read; decision #1)', async () => {
    prisma.employeeProfile.findMany.mockResolvedValue([employee(null)]);
    prisma.attendanceRecord.findMany.mockResolvedValue([]);

    await service.generatePayroll({ month: 9, year: 2026 }, payrollManager);

    const [payslip] = prisma.payslip.createMany.mock.calls[0][0].data;
    expect(payslip.grossPay.toString()).toBe('0');
    expect(payslip.netPay.toString()).toBe('0');
    expect(prisma.financialAdjustment.createMany).not.toHaveBeenCalled();
  });
});
