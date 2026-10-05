import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BonusKind, EmployeeStatus, PayrollCycleStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AccessScopeService } from '../../common/access/access-scope.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { businessToday } from '../../common/time/business-time';
import { CreateBonusDto } from './dto/create-bonus.dto';
import { BonusQueryDto } from './dto/bonus-query.dto';

const CLOSED_CYCLE_STATUSES: PayrollCycleStatus[] = [PayrollCycleStatus.APPROVED, PayrollCycleStatus.PAID];

const BONUS_INCLUDE = {
  employee: {
    select: {
      id: true,
      fullName: true,
      employeeCode: true,
      department: { select: { id: true, name: true } },
    },
  },
  grantedBy: { select: { id: true, email: true, employeeProfile: { select: { fullName: true } } } },
  cancelledBy: { select: { id: true, email: true, employeeProfile: { select: { fullName: true } } } },
} satisfies Prisma.BonusInclude;

/**
 * Incentive bonuses measured in days. A pay bonus adds days of pay (salary / 30 each) to the
 * payslip of the month it is granted in; a leave bonus adds days to the annual leave balance on top
 * of the yearly 21. Bonuses apply at once; HR, Management or whoever granted one can cancel it
 * until that month's payroll is approved.
 */
@Injectable()
export class BonusesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessScopeService,
  ) {}

  /** Bonuses of a payroll month: HR and Management see all, leaders their departments, others their own */
  async list(query: BonusQueryDto, user: AuthenticatedUser) {
    const where: Prisma.BonusWhereInput = {
      payrollMonth: query.month ? new Date(`${query.month}-01T00:00:00Z`) : this.currentMonth(),
    };

    if (!this.access.isHrAdmin(user)) {
      const departments = (await this.access.getBonusDepartmentIds(user)) ?? [];
      const visible: Prisma.BonusWhereInput[] = [];
      if (user.employeeId) visible.push({ employeeId: user.employeeId });
      if (departments.length > 0) visible.push({ employee: { departmentId: { in: departments } } });
      if (visible.length === 0) return [];
      where.OR = visible;
    }

    return this.prisma.bonus.findMany({
      where,
      include: BONUS_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async grant(dto: CreateBonusDto, user: AuthenticatedUser) {
    if (!Number.isInteger(dto.days * 2)) {
      throw new BadRequestException('البونص يكون بأنصاف الأيام: نص يوم، يوم، يوم ونص...');
    }

    const employee = await this.prisma.employeeProfile.findUnique({
      where: { id: dto.employeeId },
      select: { id: true, departmentId: true, status: true },
    });
    if (!employee) {
      throw new NotFoundException('الموظف غير موجود.');
    }
    if (employee.id === user.employeeId) {
      throw new ForbiddenException('لا يمكنك منح بونص لنفسك.');
    }
    if (employee.status !== EmployeeStatus.ACTIVE && employee.status !== EmployeeStatus.PROBATION) {
      throw new BadRequestException('لا يمكن منح بونص لموظف غير نشط.');
    }

    const kind = dto.kind ?? BonusKind.PAY;
    if (kind === BonusKind.LEAVE && !this.access.isSuperAdmin(user) && !this.access.isManagement(user)) {
      throw new ForbiddenException('أيام الإجازة الإضافية تمنحها الإدارة فقط.');
    }

    const scope = await this.access.getBonusDepartmentIds(user);
    if (scope !== null && !scope.includes(employee.departmentId)) {
      throw new ForbiddenException('يمكنك منح البونص لموظفي الأقسام التي تقودها فقط.');
    }

    const days = new Prisma.Decimal(dto.days);
    const payrollMonth = await this.openPayrollMonth();

    return this.prisma.$transaction(async (tx) => {
      const bonus = await tx.bonus.create({
        data: {
          employeeId: employee.id,
          kind,
          days,
          reason: dto.reason.trim(),
          payrollMonth,
          grantedById: user.id,
        },
        include: BONUS_INCLUDE,
      });

      if (kind === BonusKind.LEAVE) {
        await tx.employeeProfile.update({
          where: { id: employee.id },
          data: { annualLeaveDays: { increment: days } },
        });
      }

      return bonus;
    });
  }

  async cancel(id: string, user: AuthenticatedUser) {
    const bonus = await this.prisma.bonus.findUnique({ where: { id } });
    if (!bonus) {
      throw new NotFoundException('البونص غير موجود.');
    }
    if (!this.access.isHrAdmin(user) && bonus.grantedById !== user.id) {
      throw new ForbiddenException('يلغي البونص الموارد البشرية أو الإدارة أو من منحه.');
    }
    if (bonus.cancelledAt) {
      throw new BadRequestException('تم إلغاء هذا البونص بالفعل.');
    }
    if (bonus.kind === BonusKind.PAY && (await this.isPayrollClosed(bonus.payrollMonth))) {
      throw new BadRequestException('مسير رواتب هذا الشهر معتمد، ولا يمكن إلغاء البونص.');
    }

    return this.prisma.$transaction(async (tx) => {
      // Conditional: two concurrent cancellations cannot both apply
      const { count } = await tx.bonus.updateMany({
        where: { id, cancelledAt: null },
        data: { cancelledAt: new Date(), cancelledById: user.id },
      });
      if (count === 0) {
        throw new BadRequestException('تم إلغاء هذا البونص بالفعل.');
      }

      if (bonus.kind === BonusKind.LEAVE) {
        const { count: taken } = await tx.employeeProfile.updateMany({
          where: { id: bonus.employeeId, annualLeaveDays: { gte: bonus.days } },
          data: { annualLeaveDays: { decrement: bonus.days } },
        });
        if (taken === 0) {
          throw new BadRequestException('استخدم الموظف أيام البونص من رصيده بالفعل، ولا يمكن إلغاؤها.');
        }
      }

      return tx.bonus.findUniqueOrThrow({ where: { id }, include: BONUS_INCLUDE });
    });
  }

  /** First day of the current company month */
  private currentMonth(): Date {
    const today = businessToday();
    return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  }

  /** The current month, or the next one when this month's payroll is already approved */
  private async openPayrollMonth(): Promise<Date> {
    const month = this.currentMonth();
    if (!(await this.isPayrollClosed(month))) return month;
    return new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1));
  }

  private async isPayrollClosed(monthStart: Date): Promise<boolean> {
    const cycle = await this.prisma.payrollCycle.findUnique({
      where: {
        year_month: { year: monthStart.getUTCFullYear(), month: monthStart.getUTCMonth() + 1 },
      },
      select: { status: true },
    });
    return !!cycle && CLOSED_CYCLE_STATUSES.includes(cycle.status);
  }
}
