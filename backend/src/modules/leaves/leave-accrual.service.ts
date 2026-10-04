import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { EmployeeStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { getZonedParts } from '../../common/time/business-time';
import { MONTHLY_LEAVE_ACCRUAL, monthsBetween } from './leave-policy';

const CHECK_INTERVAL_MS = 60 * 60 * 1000;
const ACCRUING_STATUSES = [EmployeeStatus.ACTIVE, EmployeeStatus.PROBATION];

/**
 * Credits annual leave every month (company time). Idempotent: each employee carries the month it
 * was last credited for, and updates are conditional on that marker, so restarts, missed runs and
 * several backend instances neither skip nor double-credit a month.
 */
@Injectable()
export class LeaveAccrualService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(LeaveAccrualService.name);
  private timer?: NodeJS.Timeout;

  constructor(private readonly prisma: PrismaService) {}

  onApplicationBootstrap() {
    void this.runSafely();
    this.timer = setInterval(() => void this.runSafely(), CHECK_INTERVAL_MS);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** Credits every month due up to the current company month; returns the employees credited */
  async accrueDueLeave(now: Date = new Date()): Promise<number> {
    const { year, month } = getZonedParts(now);
    const currentMonth = new Date(Date.UTC(year, month - 1, 1));
    const notYetThisMonth = {
      OR: [{ leaveAccruedThrough: null }, { leaveAccruedThrough: { lt: currentMonth } }],
    };

    // Ended or inactive employees do not accrue; advance their marker so reactivation never back-credits
    await this.prisma.employeeProfile.updateMany({
      where: { status: { notIn: ACCRUING_STATUSES }, ...notYetThisMonth },
      data: { leaveAccruedThrough: currentMonth },
    });

    const due = await this.prisma.employeeProfile.findMany({
      where: { status: { in: ACCRUING_STATUSES }, ...notYetThisMonth },
      select: { id: true, leaveAccruedThrough: true },
    });

    let credited = 0;
    for (const employee of due) {
      // No marker yet: start accruing from now on, without crediting past months
      if (!employee.leaveAccruedThrough) {
        await this.prisma.employeeProfile.updateMany({
          where: { id: employee.id, leaveAccruedThrough: null },
          data: { leaveAccruedThrough: currentMonth },
        });
        continue;
      }

      const months = monthsBetween(employee.leaveAccruedThrough, currentMonth);
      const { count } = await this.prisma.employeeProfile.updateMany({
        where: { id: employee.id, leaveAccruedThrough: employee.leaveAccruedThrough },
        data: {
          annualLeaveDays: { increment: MONTHLY_LEAVE_ACCRUAL.mul(months) },
          leaveAccruedThrough: currentMonth,
        },
      });
      credited += count;
    }

    if (credited > 0) {
      this.logger.log(`Credited monthly annual leave to ${credited} employee(s)`);
    }
    return credited;
  }

  private async runSafely() {
    try {
      await this.accrueDueLeave();
    } catch (error) {
      this.logger.error('Annual leave accrual failed', error instanceof Error ? error.stack : error);
    }
  }
}
