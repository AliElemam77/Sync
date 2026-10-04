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
  isManagement: false,
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
      payslip: {
        findMany: jest.fn().mockResolvedValue([
          { netPay: new Prisma.Decimal('9000'), employee: { salaryProfile: { paymentMethod: 'CASH' } } },
          { netPay: new Prisma.Decimal('11000.50'), employee: { salaryProfile: { paymentMethod: 'BANK_TRANSFER' } } },
          { netPay: new Prisma.Decimal('5000'), employee: { salaryProfile: { paymentMethod: 'BANK_TRANSFER' } } },
        ]),
      },
      financialTransaction: { create: jest.fn() },
      $transaction: jest.fn((fn: (tx: unknown) => unknown) => fn(prisma)),
    };
    service = new PayrollService(prisma, new AccessScopeService(prisma));
  });

  it('posts the approved net payroll to the ledger, one payroll expense per payout method', async () => {
    await service.approveCycle('cycle-1', payrollManager);

    const entries = prisma.financialTransaction.create.mock.calls.map(
      ([arg]: [{ data: { paymentMethod: string; amount: Prisma.Decimal } }]) => arg.data,
    );
    expect(entries.map((e: any) => [e.paymentMethod, e.amount.toString()])).toEqual([
      ['CASH', '9000'],
      ['BANK_TRANSFER', '16000.5'],
    ]);
    expect(entries[0]).toEqual(
      expect.objectContaining({
        type: 'EXPENSE',
        category: 'PAYROLL',
        referenceId: 'cycle-1',
        referenceType: 'PAYROLL_CYCLE',
        recordedById: 'hr-user',
      }),
    );
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
      task: { findMany: jest.fn().mockResolvedValue([]) },
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
    expect(adjustments[0].reason).toContain('30 دقيقة');
    expect(adjustments.every((a: { payslipId: string }) => a.payslipId === payslip.id)).toBe(true);
    expect(adjustments.map((a: { amount: Prisma.Decimal }) => a.amount.toString())).toEqual([
      '18.75',
      '56.25',
    ]);
  });

  it('does not deduct days missing 15 minutes or less', async () => {
    prisma.employeeProfile.findMany.mockResolvedValue([
      employee({ baseSalary: new Prisma.Decimal(9000) }),
    ]);
    prisma.attendanceRecord.findMany.mockResolvedValue([
      { employeeId: 'emp-1', date: new Date('2026-09-02'), delayMinutes: 15, overtimeMinutes: 0 },
      { employeeId: 'emp-1', date: new Date('2026-09-03'), delayMinutes: 16, overtimeMinutes: 0 },
    ]);

    await service.generatePayroll({ month: 9, year: 2026 }, payrollManager);

    const [payslip] = prisma.payslip.createMany.mock.calls[0][0].data;
    expect(payslip.attendancePenalties.toString()).toBe('10'); // 16 min x 0.625
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

  it('adds commission: department rate x weight for each task accepted in the month', async () => {
    prisma.employeeProfile.findMany.mockResolvedValue([
      {
        ...employee({ baseSalary: new Prisma.Decimal(9000) }),
        department: { id: 'dept-eng', name: 'Engineering', commissionPerTask: new Prisma.Decimal(500) },
      },
    ]);
    prisma.attendanceRecord.findMany.mockResolvedValue([]);
    prisma.task.findMany.mockResolvedValue([
      { id: 't1', title: 'Landing page', weight: new Prisma.Decimal(1), assigneeId: 'emp-1', completedAt: new Date('2026-09-10T08:00:00Z') },
      { id: 't2', title: 'Payments API', weight: new Prisma.Decimal(2), assigneeId: 'emp-1', completedAt: new Date('2026-09-20T08:00:00Z') },
    ]);

    await service.generatePayroll({ month: 9, year: 2026 }, payrollManager);

    // Accepted between 1 and 30 September, Cairo time
    expect(prisma.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'DONE',
          completedAt: {
            gte: new Date('2026-08-31T21:00:00Z'),
            lt: new Date('2026-09-30T21:00:00Z'),
          },
        }),
      }),
    );

    const [payslip] = prisma.payslip.createMany.mock.calls[0][0].data;
    expect(payslip.totalAllowances.toString()).toBe('1500'); // 500 x 1 + 500 x 2
    expect(payslip.grossPay.toString()).toBe('10500');

    const adjustments = prisma.financialAdjustment.createMany.mock.calls[0][0].data;
    expect(adjustments.map((a: { type: string; amount: Prisma.Decimal }) => [a.type, a.amount.toString()])).toEqual([
      ['COMMISSION', '500'],
      ['COMMISSION', '1000'],
    ]);
  });
});
