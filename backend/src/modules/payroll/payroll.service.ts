import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { GeneratePayrollDto } from './dto/generate-payroll.dto';
import { QueryPayrollCyclesDto } from './dto/query-payroll-cycles.dto';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { AccessScopeService } from '../../common/access/access-scope.service';
import {
  PayrollCycleStatus,
  AdjustmentType,
  AttendanceStatus,
  EmployeeStatus,
  PaymentMethod,
  Prisma,
  RequestStatus,
  TaskStatus,
  TransactionCategory,
  TransactionType,
} from '@prisma/client';
import { businessMonthRange, businessToday } from '../../common/time/business-time';
import {
  SHIFT_MINUTES,
  dateKey,
  deductibleDelayMinutes,
  findAbsentDays,
} from '../attendance/attendance-policy';

const PAYOUT_LABELS: Partial<Record<PaymentMethod, string>> = {
  [PaymentMethod.CASH]: 'نقدي',
  [PaymentMethod.BANK_TRANSFER]: 'تحويل بنكي',
};

const DAY_MS = 24 * 60 * 60 * 1000;

function groupBy<T>(items: T[], keyOf: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const list = groups.get(keyOf(item)) ?? [];
    list.push(item);
    groups.set(keyOf(item), list);
  }
  return groups;
}

@Injectable()
export class PayrollService {
  private readonly logger = new Logger(PayrollService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessScopeService,
  ) {}

  // ---------------------------------------------------------------------------
  // 1. GENERATE PAYROLL CYCLE & CALCULATE COMPLIANT SALARIES
  // ---------------------------------------------------------------------------

  async generatePayroll(dto: GeneratePayrollDto, user: AuthenticatedUser) {
    const { month, year } = dto;

    this.logger.log(
      `Initiating payroll generation for ${year}-${String(month).padStart(2, '0')} requested by ${user.email}`,
    );

    // 1. Check if cycle already exists
    const existingCycle = await this.prisma.payrollCycle.findUnique({
      where: {
        year_month: { year, month },
      },
    });

    if (existingCycle) {
      if (
        existingCycle.status === PayrollCycleStatus.APPROVED ||
        existingCycle.status === PayrollCycleStatus.PAID
      ) {
        throw new BadRequestException(
          `مسير الرواتب لشهر ${month}/${year} معتمد أو مدفوع بالفعل، ولا يمكن إعادة احتسابه.`,
        );
      }
    }

    // 2. Fetch all active employees with their salary profiles
    const employees = await this.prisma.employeeProfile.findMany({
      // Employees on probation are paid like active staff
      where: { status: { in: [EmployeeStatus.ACTIVE, EmployeeStatus.PROBATION] } },
      include: {
        salaryProfile: true,
        department: { select: { id: true, name: true, commissionPerTask: true } },
        position: { select: { id: true, name: true } },
      },
    });

    if (employees.length === 0) {
      throw new BadRequestException('لا يوجد موظفون نشطون لاحتساب الرواتب لهم.');
    }

    // 3. Define month date range (UTC)
    const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

    // Prepare container for cycle figures
    let cycleTotalGross = new Prisma.Decimal(0);
    let cycleTotalNet = new Prisma.Decimal(0);

    interface PreparedPayslip {
      employeeId: string;
      baseSalary: Prisma.Decimal;
      grossPay: Prisma.Decimal;
      netPay: Prisma.Decimal;
      totalAllowances: Prisma.Decimal;
      totalDeductions: Prisma.Decimal;
      attendancePenalties: Prisma.Decimal;
      adjustments: {
        type: AdjustmentType;
        amount: Prisma.Decimal;
        reason: string;
        date?: Date;
      }[];
    }

    const preparedPayslips: PreparedPayslip[] = [];

    // The month's attendance, approved leaves and permissions, and public holidays: one query each,
    // grouped per employee in memory
    const employeeIds = employees.map((e) => e.id);
    const [attendanceRecords, approvedLeaves, approvedPermissions, holidays] = await Promise.all([
      this.prisma.attendanceRecord.findMany({
        where: { employeeId: { in: employeeIds }, date: { gte: startDate, lte: endDate } },
        select: {
          employeeId: true,
          date: true,
          status: true,
          delayMinutes: true,
          overtimeMinutes: true,
        },
        orderBy: { date: 'asc' },
      }),
      this.prisma.leaveRequest.findMany({
        where: {
          employeeId: { in: employeeIds },
          status: RequestStatus.APPROVED,
          startDate: { lte: endDate },
          endDate: { gte: startDate },
        },
        select: { employeeId: true, startDate: true, endDate: true },
      }),
      this.prisma.permissionRequest.findMany({
        where: {
          employeeId: { in: employeeIds },
          status: RequestStatus.APPROVED,
          date: { gte: startDate, lte: endDate },
        },
        select: { employeeId: true, date: true, hoursRequested: true },
      }),
      this.prisma.publicHoliday.findMany({
        where: { date: { gte: startDate, lte: endDate } },
        select: { date: true },
      }),
    ]);

    const recordsByEmployee = groupBy(attendanceRecords, (r) => r.employeeId);
    const leavesByEmployee = groupBy(approvedLeaves, (l) => l.employeeId);
    const permissionMinutesByDay = new Map<string, number>();
    for (const p of approvedPermissions) {
      const key = `${p.employeeId}:${dateKey(p.date)}`;
      permissionMinutesByDay.set(key, (permissionMinutesByDay.get(key) ?? 0) + p.hoursRequested * 60);
    }
    const holidayDays = new Set(holidays.map((h) => dateKey(h.date)));

    // Absence counts only for days that are over: never today or later
    const lastClosedDay = new Date(businessToday().getTime() - DAY_MS);
    const absenceEnd = lastClosedDay < endDate ? lastClosedDay : endDate;

    // Tasks accepted during the month (company time) earn commission for their assignee
    const taskMonth = businessMonthRange(year, month);
    const acceptedTasks = await this.prisma.task.findMany({
      where: {
        assigneeId: { in: employees.map((e) => e.id) },
        status: TaskStatus.DONE,
        completedAt: { gte: taskMonth.start, lt: taskMonth.end },
      },
      select: { id: true, title: true, weight: true, assigneeId: true, completedAt: true },
      orderBy: { completedAt: 'asc' },
    });

    const tasksByEmployee = new Map<string, typeof acceptedTasks>();
    for (const task of acceptedTasks) {
      if (!task.assigneeId) continue;
      const list = tasksByEmployee.get(task.assigneeId) ?? [];
      list.push(task);
      tasksByEmployee.set(task.assigneeId, list);
    }

    // 4. Iterate and compute each employee's salary and attendance penalties
    for (const emp of employees) {
      const salary = emp.salaryProfile?.baseSalary ?? new Prisma.Decimal(0);

      // Standard Rate Calculation:
      // Working month = 30 days, 8 hours/day = 480 minutes/day
      // Daily Rate = Monthly Salary / 30
      // Minute Rate = Daily Rate / 480
      const dailyRate = salary.div(new Prisma.Decimal(30));
      const minuteRate = dailyRate.div(new Prisma.Decimal(480));

      const employeeRecords = (recordsByEmployee.get(emp.id) ?? []).filter(
        (r) => r.status !== AttendanceStatus.ABSENT,
      );
      // Up to 15 missing minutes a day are forgiven; past that every missing minute is deducted
      const lateRecords = employeeRecords.filter((r) => deductibleDelayMinutes(r.delayMinutes) > 0);

      let employeeAttendancePenalties = new Prisma.Decimal(0);
      const adjustments: {
        type: AdjustmentType;
        amount: Prisma.Decimal;
        reason: string;
        date?: Date;
      }[] = [];

      for (const record of lateRecords) {
        // Penalty = minuteRate * delayMinutes
        const penaltyAmount = minuteRate
          .mul(new Prisma.Decimal(record.delayMinutes))
          .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

        employeeAttendancePenalties = employeeAttendancePenalties.add(penaltyAmount);

        const dateStr = record.date.toISOString().slice(0, 10);
        adjustments.push({
          type: AdjustmentType.PENALTY,
          amount: penaltyAmount,
          reason: `خصم تأخير ${record.delayMinutes} دقيقة بتاريخ ${dateStr}`,
          date: record.date,
        });
      }

      // Absence: a working day with no attendance and no approved leave costs a day's pay, less any
      // approved permission time that day
      const absentDays = findAbsentDays({
        from: emp.joiningDate > startDate ? emp.joiningDate : startDate,
        to: absenceEnd,
        shiftType: emp.shiftType,
        attendedDays: new Set(employeeRecords.map((r) => dateKey(r.date))),
        holidays: holidayDays,
        leaves: leavesByEmployee.get(emp.id) ?? [],
      });
      const shiftMinutes = SHIFT_MINUTES[emp.shiftType];
      for (const day of absentDays) {
        const permissionMinutes = Math.min(
          permissionMinutesByDay.get(`${emp.id}:${dateKey(day)}`) ?? 0,
          shiftMinutes,
        );
        const penaltyAmount = dailyRate
          .mul(shiftMinutes - permissionMinutes)
          .div(shiftMinutes)
          .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
        if (!penaltyAmount.greaterThan(0)) continue;

        employeeAttendancePenalties = employeeAttendancePenalties.add(penaltyAmount);
        adjustments.push({
          type: AdjustmentType.PENALTY,
          amount: penaltyAmount,
          reason:
            permissionMinutes > 0
              ? `خصم غياب بتاريخ ${dateKey(day)} (بعد احتساب إذن ${permissionMinutes / 60} ساعة)`
              : `خصم غياب بدون إذن أو إجازة بتاريخ ${dateKey(day)}`,
          date: day,
        });
      }

      const overtimeRecords = employeeRecords.filter((r) => r.overtimeMinutes > 0);

      let employeeOvertimeBonus = new Prisma.Decimal(0);
      for (const record of overtimeRecords) {
        // Standard overtime rate: 1.5x minute rate
        const overtimeAmount = minuteRate
          .mul(new Prisma.Decimal(record.overtimeMinutes))
          .mul(new Prisma.Decimal(1.5))
          .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

        employeeOvertimeBonus = employeeOvertimeBonus.add(overtimeAmount);

        const dateStr = record.date.toISOString().slice(0, 10);
        adjustments.push({
          type: AdjustmentType.OVERTIME,
          amount: overtimeAmount,
          reason: `ساعات عمل إضافية (${record.overtimeMinutes} دقيقة) بتاريخ ${dateStr}`,
          date: record.date,
        });
      }

      // Commission: the employee's department rate x the weight of each task accepted this month
      let employeeCommission = new Prisma.Decimal(0);
      const commissionRate = emp.department?.commissionPerTask ?? new Prisma.Decimal(0);
      if (commissionRate.greaterThan(0)) {
        for (const task of tasksByEmployee.get(emp.id) ?? []) {
          const commissionAmount = commissionRate
            .mul(task.weight)
            .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

          employeeCommission = employeeCommission.add(commissionAmount);
          adjustments.push({
            type: AdjustmentType.COMMISSION,
            amount: commissionAmount,
            reason: `كوميشن تاسك "${task.title}" (وزن ${task.weight.toString()})`,
            date: task.completedAt ?? undefined,
          });
        }
      }

      // Financial totals
      const grossPay = salary.add(employeeOvertimeBonus).add(employeeCommission);
      const totalAllowances = employeeOvertimeBonus.add(employeeCommission);
      const totalDeductions = employeeAttendancePenalties;
      const netPay = grossPay.sub(totalDeductions);

      cycleTotalGross = cycleTotalGross.add(grossPay);
      cycleTotalNet = cycleTotalNet.add(netPay);

      preparedPayslips.push({
        employeeId: emp.id,
        baseSalary: salary,
        grossPay,
        netPay,
        totalAllowances,
        totalDeductions,
        attendancePenalties: employeeAttendancePenalties,
        adjustments,
      });
    }

    // 5. Execute in atomic transaction
    return this.prisma.$transaction(async (tx) => {
      // Upsert or clear unapproved cycle
      let cycleId: string;
      if (existingCycle) {
        cycleId = existingCycle.id;
        // Clear previous unapproved payslips and cascade adjustments
        await tx.payslip.deleteMany({
          where: { payrollCycleId: cycleId },
        });

        await tx.payrollCycle.update({
          where: { id: cycleId },
          data: {
            totalGross: cycleTotalGross,
            totalNet: cycleTotalNet,
            status: PayrollCycleStatus.DRAFT,
          },
        });
      } else {
        const created = await tx.payrollCycle.create({
          data: {
            month,
            year,
            totalGross: cycleTotalGross,
            totalNet: cycleTotalNet,
            status: PayrollCycleStatus.DRAFT,
          },
        });
        cycleId = created.id;
      }

      // Bulk-insert payslips and their itemized adjustments (2 statements instead of one per employee).
      // Ids are generated here so adjustments can reference their payslip without a read-back.
      const payslipRows = preparedPayslips.map((p) => ({ id: randomUUID(), ...p }));

      await tx.payslip.createMany({
        data: payslipRows.map(({ adjustments: _adjustments, ...p }) => ({
          ...p,
          payrollCycleId: cycleId,
        })),
      });

      const adjustmentRows = payslipRows.flatMap((p) =>
        p.adjustments.map((adj) => ({
          payslipId: p.id,
          type: adj.type,
          amount: adj.amount,
          reason: adj.reason,
          date: adj.date,
        })),
      );
      if (adjustmentRows.length > 0) {
        await tx.financialAdjustment.createMany({ data: adjustmentRows });
      }

      // Fetch the full cycle with all populated data
      return tx.payrollCycle.findUnique({
        where: { id: cycleId },
        include: {
          payslips: {
            include: {
              employee: {
                select: {
                  id: true,
                  fullName: true,
                  employeeCode: true,
                  avatarUrl: true,
                  department: { select: { id: true, name: true } },
                  position: { select: { id: true, name: true } },
                },
              },
              adjustments: true,
            },
            orderBy: { netPay: 'desc' },
          },
          approvedBy: {
            select: { id: true, email: true },
          },
        },
      });
    });
  }

  // ---------------------------------------------------------------------------
  // 2. GET ALL PAYROLL CYCLES
  // ---------------------------------------------------------------------------

  async listCycles(query: QueryPayrollCyclesDto) {
    const where: Prisma.PayrollCycleWhereInput = {};

    if (query.year) where.year = query.year;
    if (query.month) where.month = query.month;
    if (query.status) where.status = query.status;

    return this.prisma.payrollCycle.findMany({
      where,
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      include: {
        approvedBy: {
          select: { id: true, email: true },
        },
        _count: {
          select: { payslips: true },
        },
      },
    });
  }

  // ---------------------------------------------------------------------------
  // 3. GET SINGLE PAYROLL CYCLE WITH ALL PAYSLIPS
  // ---------------------------------------------------------------------------

  async getCycleById(id: string) {
    const cycle = await this.prisma.payrollCycle.findUnique({
      where: { id },
      include: {
        approvedBy: {
          select: { id: true, email: true },
        },
        payslips: {
          include: {
            employee: {
              select: {
                id: true,
                fullName: true,
                employeeCode: true,
                avatarUrl: true,
                department: { select: { id: true, name: true } },
                position: { select: { id: true, name: true } },
              },
            },
            adjustments: {
              orderBy: { createdAt: 'asc' },
            },
          },
          orderBy: { netPay: 'desc' },
        },
      },
    });

    if (!cycle) {
      throw new NotFoundException('مسير الرواتب المطلوب غير موجود.');
    }

    return cycle;
  }

  // ---------------------------------------------------------------------------
  // 4. APPROVE AND LOCK PAYROLL CYCLE
  // ---------------------------------------------------------------------------

  async approveCycle(id: string, user: AuthenticatedUser) {
    const cycle = await this.prisma.payrollCycle.findUnique({
      where: { id },
      select: { status: true },
    });

    if (!cycle) {
      throw new NotFoundException('مسير الرواتب المطلوب غير موجود.');
    }

    if (
      cycle.status === PayrollCycleStatus.APPROVED ||
      cycle.status === PayrollCycleStatus.PAID
    ) {
      throw new BadRequestException('تم اعتماد مسير الرواتب مسبقاً.');
    }

    const updatedCycle = await this.prisma.$transaction(async (tx) => {
      // Conditional update so that two concurrent approvals cannot both post to the ledger
      const { count } = await tx.payrollCycle.updateMany({
        where: {
          id,
          status: { notIn: [PayrollCycleStatus.APPROVED, PayrollCycleStatus.PAID] },
        },
        data: {
          status: PayrollCycleStatus.APPROVED,
          approvedAt: new Date(),
          approvedById: user.id,
        },
      });
      if (count === 0) {
        throw new BadRequestException('تم اعتماد مسير الرواتب مسبقاً.');
      }

      const approved = await tx.payrollCycle.findUniqueOrThrow({
        where: { id },
        include: {
          approvedBy: {
            select: { id: true, email: true },
          },
          payslips: {
            include: {
              employee: {
                select: {
                  id: true,
                  fullName: true,
                  employeeCode: true,
                  department: { select: { name: true } },
                },
              },
            },
          },
        },
      });

      // Post the approved month to the ledger: one payroll expense per payout method (net amounts)
      const payouts = await tx.payslip.findMany({
        where: { payrollCycleId: id },
        select: {
          netPay: true,
          employee: { select: { salaryProfile: { select: { paymentMethod: true } } } },
        },
      });
      const netByMethod = new Map<PaymentMethod, Prisma.Decimal>();
      for (const payout of payouts) {
        const method = payout.employee.salaryProfile?.paymentMethod ?? PaymentMethod.BANK_TRANSFER;
        netByMethod.set(method, (netByMethod.get(method) ?? new Prisma.Decimal(0)).add(payout.netPay));
      }

      for (const [method, amount] of netByMethod) {
        if (!amount.greaterThan(0)) continue;
        await tx.financialTransaction.create({
          data: {
            amount,
            type: TransactionType.EXPENSE,
            category: TransactionCategory.PAYROLL,
            paymentMethod: method,
            description: `مسير رواتب شهر ${approved.month}/${approved.year} (${PAYOUT_LABELS[method] ?? method})`,
            transactionDate: new Date(),
            referenceId: approved.id,
            referenceType: 'PAYROLL_CYCLE',
            recordedById: user.id,
          },
        });
      }

      return approved;
    });

    this.logger.log(`Payroll cycle ${id} successfully APPROVED by ${user.email}`);
    return updatedCycle;
  }

  // ---------------------------------------------------------------------------
  // 5. EMPLOYEE SELF-SERVICE: MY PAYSLIPS
  // ---------------------------------------------------------------------------

  async getMyPayslips(userId: string) {
    const employee = await this.prisma.employeeProfile.findUnique({
      where: { userId },
    });

    if (!employee) {
      throw new NotFoundException('لا يوجد ملف موظف نشط مرتبط بهذا الحساب.');
    }

    return this.prisma.payslip.findMany({
      where: { employeeId: employee.id },
      include: {
        payrollCycle: true,
        adjustments: {
          orderBy: { date: 'asc' },
        },
      },
      orderBy: [
        { payrollCycle: { year: 'desc' } },
        { payrollCycle: { month: 'desc' } },
      ],
    });
  }

  // ---------------------------------------------------------------------------
  // 6. GET SINGLE PAYSLIP DETAILS
  // ---------------------------------------------------------------------------

  async getPayslipById(id: string, user: AuthenticatedUser) {
    const payslip = await this.prisma.payslip.findUnique({
      where: { id },
      include: {
        payrollCycle: true,
        employee: {
          include: {
            department: true,
            position: true,
            bankInfo: true,
            salaryProfile: true,
          },
        },
        adjustments: {
          orderBy: { date: 'asc' },
        },
      },
    });

    if (!payslip) {
      throw new NotFoundException('قسيمة الراتب المطلوبة غير موجودة.');
    }

    // Permission check: If not HR / Admin, user must be the owner
    const canManagePayroll =
      this.access.hasPermission(user, 'payroll.manage') ||
      this.access.hasPermission(user, 'payroll.view') ||
      this.access.isHrAdmin(user);

    if (!canManagePayroll && payslip.employee.userId !== user.id) {
      throw new ForbiddenException('ليس لديك صلاحية للاطلاع على قسيمة راتب موظف آخر.');
    }

    return payslip;
  }
}
