import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GeneratePayrollDto } from './dto/generate-payroll.dto';
import { QueryPayrollCyclesDto } from './dto/query-payroll-cycles.dto';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { AccessScopeService } from '../../common/access/access-scope.service';
import {
  PayrollCycleStatus,
  AdjustmentType,
  Prisma,
} from '@prisma/client';

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
      include: {
        payslips: true,
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
      where: { status: 'ACTIVE' },
      include: {
        salaryProfile: true,
        department: { select: { id: true, name: true } },
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

    // 4. Iterate and compute each employee's salary and attendance penalties
    for (const emp of employees) {
      const salary = emp.salaryProfile?.baseSalary ?? new Prisma.Decimal(0);

      // Standard Rate Calculation:
      // Working month = 30 days, 8 hours/day = 480 minutes/day
      // Daily Rate = Monthly Salary / 30
      // Minute Rate = Daily Rate / 480
      const dailyRate = salary.div(new Prisma.Decimal(30));
      const minuteRate = dailyRate.div(new Prisma.Decimal(480));

      // Query attendance records with delays in this specific month
      const lateRecords = await this.prisma.attendanceRecord.findMany({
        where: {
          employeeId: emp.id,
          date: {
            gte: startDate,
            lte: endDate,
          },
          delayMinutes: { gt: 0 },
        },
        orderBy: { date: 'asc' },
      });

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

      // Check overtime records
      const overtimeRecords = await this.prisma.attendanceRecord.findMany({
        where: {
          employeeId: emp.id,
          date: {
            gte: startDate,
            lte: endDate,
          },
          overtimeMinutes: { gt: 0 },
        },
        orderBy: { date: 'asc' },
      });

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

      // Financial totals
      const grossPay = salary.add(employeeOvertimeBonus);
      const totalAllowances = employeeOvertimeBonus;
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

      // Create all payslips and itemized adjustments
      for (const p of preparedPayslips) {
        await tx.payslip.create({
          data: {
            payrollCycleId: cycleId,
            employeeId: p.employeeId,
            baseSalary: p.baseSalary,
            grossPay: p.grossPay,
            netPay: p.netPay,
            totalAllowances: p.totalAllowances,
            totalDeductions: p.totalDeductions,
            attendancePenalties: p.attendancePenalties,
            adjustments: {
              create: p.adjustments.map((adj) => ({
                type: adj.type,
                amount: adj.amount,
                reason: adj.reason,
                date: adj.date,
              })),
            },
          },
        });
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
      include: { payslips: true },
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

    const updatedCycle = await this.prisma.payrollCycle.update({
      where: { id },
      data: {
        status: PayrollCycleStatus.APPROVED,
        approvedAt: new Date(),
        approvedById: user.id,
      },
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
