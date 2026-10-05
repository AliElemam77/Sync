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
    shiftType: 'RS',
    joiningDate: new Date('2025-01-01'),
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
      leaveRequest: { findMany: jest.fn().mockResolvedValue([]) },
      permissionRequest: { findMany: jest.fn().mockResolvedValue([]) },
      publicHoliday: { findMany: jest.fn().mockResolvedValue([]) },
      // No settings row yet: overtime is off
      companySettings: { findUnique: jest.fn().mockResolvedValue(null) },
      task: { findMany: jest.fn().mockResolvedValue([]) },
      payslip: { createMany: jest.fn() },
      financialAdjustment: { createMany: jest.fn() },
      $transaction: jest.fn((fn: (tx: unknown) => unknown) => fn(prisma)),
    };
    service = new PayrollService(prisma, new AccessScopeService(prisma));
    // Generated after the month has ended
    jest.useFakeTimers({ now: new Date('2026-10-05T08:00:00Z') });
  });

  afterEach(() => jest.useRealTimers());

  /** A record for every day of September 2026, with optional figures for some days */
  const septemberAttendance = (
    days: Record<string, { delayMinutes?: number; overtimeMinutes?: number } | 'absent'> = {},
  ) =>
    Array.from({ length: 30 }, (_, i) => new Date(Date.UTC(2026, 8, i + 1)))
      .filter((date) => days[date.toISOString().slice(0, 10)] !== 'absent')
      .map((date) => {
        const figures = days[date.toISOString().slice(0, 10)];
        return {
          employeeId: 'emp-1',
          date,
          status: 'PRESENT',
          checkOutTime: date,
          delayMinutes: 0,
          overtimeMinutes: 0,
          ...(typeof figures === 'object' ? figures : {}),
        };
      });

  it('deducts lateness in tiers of a day and pays enabled overtime at the set rate', async () => {
    prisma.companySettings.findUnique.mockResolvedValue({
      id: 1,
      overtimeEnabled: true,
      overtimeMultiplier: new Prisma.Decimal(2),
    });
    prisma.employeeProfile.findMany.mockResolvedValue([
      employee({ baseSalary: new Prisma.Decimal(9000) }),
    ]);
    prisma.attendanceRecord.findMany.mockResolvedValue(
      septemberAttendance({
        '2026-09-02': { delayMinutes: 30 },
        '2026-09-03': { overtimeMinutes: 60 },
      }),
    );

    await service.generatePayroll({ month: 9, year: 2026 }, payrollManager);

    // Probation employees are paid like active staff
    expect(prisma.employeeProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: { in: ['ACTIVE', 'PROBATION'] } } }),
    );

    // A single attendance query covers every employee
    expect(prisma.attendanceRecord.findMany).toHaveBeenCalledTimes(1);

    // day = 9000 / 30 = 300; an RS hour = 300 / 8 = 37.5
    const [payslip] = prisma.payslip.createMany.mock.calls[0][0].data;
    expect(payslip.payrollCycleId).toBe('cycle-1');
    expect(payslip.baseSalary.toString()).toBe('9000');
    expect(payslip.attendancePenalties.toString()).toBe('75'); // 30 min late: a quarter day
    expect(payslip.totalAllowances.toString()).toBe('75'); // 1 overtime hour = 2 x 37.5
    expect(payslip.grossPay.toString()).toBe('9075');
    expect(payslip.netPay.toString()).toBe('9000');

    const adjustments = prisma.financialAdjustment.createMany.mock.calls[0][0].data;
    expect(adjustments).toHaveLength(2);
    expect(adjustments[0].reason).toBe('خصم تأخير 30 دقيقة (ربع يوم) بتاريخ 2026-09-02');
    expect(adjustments.every((a: { payslipId: string }) => a.payslipId === payslip.id)).toBe(true);
    expect(adjustments.map((a: { amount: Prisma.Decimal }) => a.amount.toString())).toEqual([
      '75',
      '75',
    ]);
    expect(adjustments[1].reason).toBe('وقت إضافي 60 دقيقة (الساعة بـ 2 ساعة) بتاريخ 2026-09-03');
  });

  it('pays no overtime until Management turns it on', async () => {
    prisma.employeeProfile.findMany.mockResolvedValue([
      employee({ baseSalary: new Prisma.Decimal(9000) }),
    ]);
    prisma.attendanceRecord.findMany.mockResolvedValue(
      septemberAttendance({ '2026-09-03': { overtimeMinutes: 120 } }),
    );

    await service.generatePayroll({ month: 9, year: 2026 }, payrollManager);

    const [payslip] = prisma.payslip.createMany.mock.calls[0][0].data;
    expect(payslip.totalAllowances.toString()).toBe('0');
    expect(payslip.grossPay.toString()).toBe('9000');
    expect(prisma.financialAdjustment.createMany).not.toHaveBeenCalled();
  });

  it('values an overtime hour by the shift length (LS: 9 hours)', async () => {
    prisma.companySettings.findUnique.mockResolvedValue({
      id: 1,
      overtimeEnabled: true,
      overtimeMultiplier: new Prisma.Decimal('1.5'),
    });
    prisma.employeeProfile.findMany.mockResolvedValue([
      { ...employee({ baseSalary: new Prisma.Decimal(9000) }), shiftType: 'LS' },
    ]);
    prisma.attendanceRecord.findMany.mockResolvedValue(
      septemberAttendance({ '2026-09-03': { overtimeMinutes: 60 } }),
    );

    await service.generatePayroll({ month: 9, year: 2026 }, payrollManager);

    const [payslip] = prisma.payslip.createMany.mock.calls[0][0].data;
    expect(payslip.totalAllowances.toString()).toBe('50'); // 300 / 9 hours x 1.5
  });

  it('forgives 15 minutes, then deducts a quarter, half or full day', async () => {
    prisma.employeeProfile.findMany.mockResolvedValue([
      employee({ baseSalary: new Prisma.Decimal(9000) }), // 300 a day
    ]);
    prisma.attendanceRecord.findMany.mockResolvedValue(
      septemberAttendance({
        '2026-09-01': { delayMinutes: 15 }, // grace
        '2026-09-02': { delayMinutes: 16 }, // quarter day
        '2026-09-03': { delayMinutes: 31 }, // half day
        '2026-09-05': { delayMinutes: 60 }, // half day
        '2026-09-06': { delayMinutes: 61 }, // full day
        '2026-09-04': { delayMinutes: 120 }, // Friday, a weekly day off: nothing
      }),
    );

    await service.generatePayroll({ month: 9, year: 2026 }, payrollManager);

    const adjustments = prisma.financialAdjustment.createMany.mock.calls[0][0].data;
    expect(adjustments.map((a: { reason: string; amount: Prisma.Decimal }) => [a.reason, a.amount.toString()])).toEqual([
      ['خصم تأخير 16 دقيقة (ربع يوم) بتاريخ 2026-09-02', '75'],
      ['خصم تأخير 31 دقيقة (نصف يوم) بتاريخ 2026-09-03', '150'],
      ['خصم تأخير 60 دقيقة (نصف يوم) بتاريخ 2026-09-05', '150'],
      ['خصم تأخير 61 دقيقة (يوم كامل) بتاريخ 2026-09-06', '300'],
    ]);
  });

  it('deducts a full day for a forgotten check-out, but not for today', async () => {
    // Run on 15 September (11:00 in Cairo)
    jest.useFakeTimers({ now: new Date('2026-09-15T08:00:00Z') });
    prisma.employeeProfile.findMany.mockResolvedValue([
      employee({ baseSalary: new Prisma.Decimal(9000) }),
    ]);
    prisma.attendanceRecord.findMany.mockResolvedValue(
      septemberAttendance({ '2026-09-02': { delayMinutes: 20 } })
        .filter((r) => r.date <= new Date('2026-09-15'))
        .map((r) =>
          ['2026-09-02', '2026-09-15'].includes(r.date.toISOString().slice(0, 10))
            ? { ...r, checkOutTime: null }
            : r,
        ),
    );

    await service.generatePayroll({ month: 9, year: 2026 }, payrollManager);

    const adjustments = prisma.financialAdjustment.createMany.mock.calls[0][0].data;
    expect(adjustments.map((a: { reason: string; amount: Prisma.Decimal }) => [a.reason, a.amount.toString()])).toEqual([
      ['خصم يوم: لم تُسجَّل بصمة الانصراف بتاريخ 2026-09-02', '300'],
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

  it('adds commission: department rate x weight for each task accepted in the month', async () => {
    prisma.employeeProfile.findMany.mockResolvedValue([
      {
        ...employee({ baseSalary: new Prisma.Decimal(9000) }),
        department: { id: 'dept-eng', name: 'Engineering', commissionPerTask: new Prisma.Decimal(500) },
      },
    ]);
    prisma.attendanceRecord.findMany.mockResolvedValue(septemberAttendance());
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

  it('deducts a day for each working day with no attendance, leave or holiday', async () => {
    prisma.employeeProfile.findMany.mockResolvedValue([
      employee({ baseSalary: new Prisma.Decimal(9000) }), // 300 a day
    ]);
    prisma.attendanceRecord.findMany.mockResolvedValue(
      septemberAttendance({
        '2026-09-07': 'absent', // Monday: absent
        '2026-09-08': 'absent', // approved leave
        '2026-09-09': 'absent', // public holiday
        '2026-09-10': 'absent', // approved 4-hour permission: half the day is covered
        '2026-09-11': 'absent', // Friday: weekly day off
      }),
    );
    prisma.leaveRequest.findMany.mockResolvedValue([
      { employeeId: 'emp-1', startDate: new Date('2026-09-08'), endDate: new Date('2026-09-08') },
    ]);
    prisma.publicHoliday.findMany.mockResolvedValue([{ date: new Date('2026-09-09') }]);
    prisma.permissionRequest.findMany.mockResolvedValue([
      { employeeId: 'emp-1', date: new Date('2026-09-10'), hoursRequested: 4 },
    ]);

    await service.generatePayroll({ month: 9, year: 2026 }, payrollManager);

    expect(prisma.leaveRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: 'APPROVED' }) }),
    );
    const [payslip] = prisma.payslip.createMany.mock.calls[0][0].data;
    expect(payslip.attendancePenalties.toString()).toBe('450'); // 300 + 150
    expect(payslip.netPay.toString()).toBe('8550');

    const adjustments = prisma.financialAdjustment.createMany.mock.calls[0][0].data;
    expect(adjustments.map((a: { reason: string; amount: Prisma.Decimal }) => [a.reason, a.amount.toString()])).toEqual([
      ['خصم غياب بدون إذن أو إجازة بتاريخ 2026-09-07', '300'],
      ['خصم غياب بتاريخ 2026-09-10 (بعد احتساب إذن 4 ساعة)', '150'],
    ]);
  });

  it('counts absence only from the joining date and never for today', async () => {
    // Run on 15 September (11:00 in Cairo) for someone who joined on Monday 14 September
    jest.useFakeTimers({ now: new Date('2026-09-15T08:00:00Z') });
    prisma.employeeProfile.findMany.mockResolvedValue([
      { ...employee({ baseSalary: new Prisma.Decimal(9000) }), joiningDate: new Date('2026-09-14') },
    ]);
    prisma.attendanceRecord.findMany.mockResolvedValue([]);

    await service.generatePayroll({ month: 9, year: 2026 }, payrollManager);

    const adjustments = prisma.financialAdjustment.createMany.mock.calls[0][0].data;
    expect(adjustments.map((a: { reason: string }) => a.reason)).toEqual([
      'خصم غياب بدون إذن أو إجازة بتاريخ 2026-09-14',
    ]);
  });
});

describe('PayrollService settings', () => {
  let prisma: any;
  let service: PayrollService;

  beforeEach(() => {
    prisma = {
      companySettings: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn(),
      },
    };
    service = new PayrollService(prisma, new AccessScopeService(prisma));
  });

  it('defaults to overtime off at two regular hours per overtime hour', async () => {
    const settings = await service.getSettings();
    expect(settings.overtimeEnabled).toBe(false);
    expect(settings.overtimeMultiplier.toString()).toBe('2');
  });

  it('lets only Management change them', async () => {
    await expect(
      service.updateSettings({ overtimeEnabled: true }, payrollManager),
    ).rejects.toThrow('الإدارة');
    expect(prisma.companySettings.upsert).not.toHaveBeenCalled();

    await service.updateSettings(
      { overtimeEnabled: true, overtimeMultiplier: 2.5 },
      { ...payrollManager, isManagement: true },
    );
    expect(prisma.companySettings.upsert).toHaveBeenCalledWith({
      where: { id: 1 },
      create: { id: 1, overtimeEnabled: true, overtimeMultiplier: new Prisma.Decimal('2.5') },
      update: { overtimeEnabled: true, overtimeMultiplier: new Prisma.Decimal('2.5') },
    });
  });
});
