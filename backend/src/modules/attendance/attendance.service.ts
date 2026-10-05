import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AttendanceStatus, Prisma, RequestStatus } from '@prisma/client';
import { AttendanceQueryDto } from './dto/attendance-query.dto';
import { CreatePublicHolidayDto } from './dto/create-public-holiday.dto';
import { RecordAttendanceDto } from './dto/record-attendance.dto';
import { EventsGateway } from '../events/events.gateway';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { AccessScopeService } from '../../common/access/access-scope.service';
import {
  businessMinutesOfDay,
  businessToday,
  formatBusinessTime,
  getZonedParts,
  zonedTimeToUtc,
} from '../../common/time/business-time';
import {
  HALF_DAY_PERMISSION_HOURS,
  permissionMonthRange,
} from '../work-permissions/permission-policy';
import { calendarDaysBetween, toDateOnly } from '../leaves/leave-policy';
import {
  arrivalDelayMinutes,
  isCompanyClosedDay,
  isWeeklyDayOff,
  shiftBalance,
} from './attendance-policy';

/** Longest single holiday entry (a feast spans a few days) */
const MAX_HOLIDAY_SPAN_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsGateway: EventsGateway,
    private readonly access: AccessScopeService,
  ) {}

  /**
   * Today's date in company time, as stored in the @db.Date column
   */
  private getTodayDateOnly(): Date {
    return businessToday();
  }

  /**
   * Get employee profile for a given User ID
   */
  private async getEmployeeByUserId(userId: string) {
    const employee = await this.prisma.employeeProfile.findUnique({
      where: { userId },
      include: {
        department: true,
        position: true,
      },
    });

    if (!employee) {
      throw new BadRequestException('No active employee profile linked to your account.');
    }

    return employee;
  }

  /** Approved permission time for one employee on one day, in minutes */
  private async getApprovedPermissionMinutes(employeeId: string, date: Date): Promise<number> {
    const { _sum } = await this.prisma.permissionRequest.aggregate({
      where: { employeeId, date, status: RequestStatus.APPROVED },
      _sum: { hoursRequested: true },
    });
    return (_sum.hoursRequested ?? 0) * 60;
  }

  /**
   * Get today's attendance status & live shift data for authenticated user
   */
  async getTodayStatus(user: AuthenticatedUser) {
    if (this.access.isSuperAdmin(user)) {
      return {
        isSuperAdmin: true,
        employee: null,
        hasCheckedIn: false,
        hasCheckedOut: false,
        record: null,
      };
    }

    const employee = await this.prisma.employeeProfile.findUnique({
      where: { userId: user.id },
      include: { department: true, position: true },
    });

    if (!employee) {
      return {
        isSuperAdmin: false,
        employee: null,
        hasCheckedIn: false,
        hasCheckedOut: false,
        record: null,
      };
    }

    const today = this.getTodayDateOnly();

    // Today's record, today's approved permissions and this month's approved hours (independent lookups)
    const month = permissionMonthRange(today);
    const [record, approvedPermissions, monthUsage] = await Promise.all([
      this.prisma.attendanceRecord.findUnique({
        where: {
          employeeId_date: {
            employeeId: employee.id,
            date: today,
          },
        },
      }),
      this.prisma.permissionRequest.findMany({
        where: {
          employeeId: employee.id,
          date: today,
          status: RequestStatus.APPROVED,
        },
      }),
      this.prisma.permissionRequest.aggregate({
        where: {
          employeeId: employee.id,
          status: RequestStatus.APPROVED,
          date: { gte: month.start, lt: month.end },
          // Half-day (4-hour) permissions come out of annual leave, not the monthly hours
          hoursRequested: { lt: HALF_DAY_PERMISSION_HOURS },
        },
        _sum: { hoursRequested: true },
      }),
    ]);

    const approvedPermissionHours = approvedPermissions.reduce(
      (sum, p) => sum + p.hoursRequested,
      0,
    );

    return {
      isSuperAdmin: false,
      employee: {
        id: employee.id,
        employeeCode: employee.employeeCode,
        fullName: employee.fullName,
        shiftType: employee.shiftType,
        annualLeaveDays: employee.annualLeaveDays,
        // Monthly allowance, and what is left of it this month (renews every month)
        monthlyPermissionHours: employee.monthlyPermissionHours,
        remainingPermissionHours: Math.max(
          employee.monthlyPermissionHours - (monthUsage._sum.hoursRequested ?? 0),
          0,
        ),
      },
      approvedPermissionHours,
      approvedPermissions,
      // Friday: no check-in at all. Another weekly day off: check-in after confirming
      isCompanyClosedDay: isCompanyClosedDay(today),
      isWeeklyDayOff: isWeeklyDayOff(today, employee.shiftType),
      hasCheckedIn: !!record,
      hasCheckedOut: !!record?.checkOutTime,
      record,
    };
  }

  /**
   * Employee Check-In for Today
   */
  async checkIn(userId: string, confirmDayOff = false) {
    const employee = await this.getEmployeeByUserId(userId);
    const today = this.getTodayDateOnly();
    const now = new Date();

    // Nobody works on Friday; another weekly day off (Saturday for LS) needs the employee's confirmation
    if (isCompanyClosedDay(today)) {
      throw new BadRequestException('اليوم الجمعة إجازة للجميع، ولا يمكن تسجيل الحضور فيه.');
    }
    if (isWeeklyDayOff(today, employee.shiftType) && !confirmDayOff) {
      throw new BadRequestException('اليوم إجازتك الأسبوعية. أكّد أنك تعمل اليوم لتسجيل الحضور.');
    }

    // Check if already checked in today
    const existing = await this.prisma.attendanceRecord.findUnique({
      where: {
        employeeId_date: {
          employeeId: employee.id,
          date: today,
        },
      },
    });

    if (existing) {
      throw new BadRequestException(
        `You have already checked in today at ${formatBusinessTime(existing.checkInTime)}.`,
      );
    }

    // Minutes late after 09:00, less approved permission time today (the grace period applies in payroll)
    const delayMinutes = arrivalDelayMinutes(
      businessMinutesOfDay(now),
      await this.getApprovedPermissionMinutes(employee.id, today),
    );

    const record = await this.prisma.attendanceRecord.create({
      data: {
        employeeId: employee.id,
        date: today,
        checkInTime: now,
        status: AttendanceStatus.PRESENT,
        delayMinutes,
        overtimeMinutes: 0,
      },
      include: {
        employee: {
          select: {
            id: true,
            fullName: true,
            employeeCode: true,
            shiftType: true,
          },
        },
      },
    });

    return record;
  }

  /**
   * Employee Check-Out for Today with Dynamic RS/LS Shift Metrics Calculation
   */
  async checkOut(userId: string) {
    const employee = await this.getEmployeeByUserId(userId);
    const today = this.getTodayDateOnly();
    const now = new Date();

    const record = await this.prisma.attendanceRecord.findUnique({
      where: {
        employeeId_date: {
          employeeId: employee.id,
          date: today,
        },
      },
    });

    if (!record) {
      throw new BadRequestException('You must check in first before you can check out.');
    }

    if (record.checkOutTime) {
      throw new BadRequestException(
        `You have already checked out today at ${formatBusinessTime(record.checkOutTime)}.`,
      );
    }

    // Worked time plus approved permission time against the shift (RS 8 hours, LS 9 hours)
    const workedMinutes = Math.max(
      0,
      Math.floor((now.getTime() - new Date(record.checkInTime).getTime()) / (1000 * 60)),
    );
    const { delayMinutes, overtimeMinutes } = shiftBalance(
      workedMinutes,
      await this.getApprovedPermissionMinutes(employee.id, today),
      employee.shiftType,
    );

    const updatedRecord = await this.prisma.attendanceRecord.update({
      where: { id: record.id },
      data: {
        checkOutTime: now,
        delayMinutes,
        overtimeMinutes,
      },
      include: {
        employee: {
          select: {
            id: true,
            fullName: true,
            employeeCode: true,
            shiftType: true,
          },
        },
      },
    });

    return updatedRecord;
  }

  /**
   * Query Attendance Records with Scoped Permissions
   */
  async getRecords(query: AttendanceQueryDto, currentUser: AuthenticatedUser) {
    const where: Prisma.AttendanceRecordWhereInput = {};

    if (query.startDate || query.endDate) {
      where.date = {
        ...(query.startDate && { gte: new Date(query.startDate) }),
        ...(query.endDate && { lte: new Date(query.endDate) }),
      };
    }

    if (this.access.isHrAdmin(currentUser)) {
      if (query.employeeId) where.employeeId = query.employeeId;
      if (query.departmentId) where.employee = { departmentId: query.departmentId };
    } else if (this.access.isTeamLeader(currentUser)) {
      if (!currentUser.departmentId) {
        throw new ForbiddenException('Team Leader profile has no associated department.');
      }
      where.employee = { departmentId: currentUser.departmentId };
      if (query.employeeId) where.employeeId = query.employeeId;
    } else {
      // Regular Employee: Strictly restrict to own records
      if (!currentUser.employeeId) {
        return [];
      }
      where.employeeId = currentUser.employeeId;
    }

    const records = await this.prisma.attendanceRecord.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            fullName: true,
            employeeCode: true,
            shiftType: true,
            department: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        },
      },
      orderBy: { date: 'desc' },
      take: 200,
    });

    return records;
  }

  /**
   * Monthly Metrics Summary Report for an Employee
   */
  async getMonthlySummary(
    employeeId: string,
    year: number,
    month: number,
    currentUser: AuthenticatedUser,
  ) {
    // Same visibility rules as getRecords: HR/Admin any employee, Team Leader own department, others self
    if (!this.access.isHrAdmin(currentUser)) {
      const isSelf = !!currentUser.employeeId && currentUser.employeeId === employeeId;

      let isTeamLeaderOfTarget = false;
      if (!isSelf && this.access.isTeamLeader(currentUser) && currentUser.departmentId) {
        const targetEmp = await this.prisma.employeeProfile.findUnique({
          where: { id: employeeId },
          select: { departmentId: true },
        });
        isTeamLeaderOfTarget = targetEmp?.departmentId === currentUser.departmentId;
      }

      if (!isSelf && !isTeamLeaderOfTarget) {
        throw new ForbiddenException('You do not have access to this employee attendance summary.');
      }
    }

    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const endDate = new Date(Date.UTC(year, month, 0));

    const records = await this.prisma.attendanceRecord.findMany({
      where: {
        employeeId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    const totalDaysPresent = records.filter((r) => r.status === AttendanceStatus.PRESENT).length;
    const totalDelayMinutes = records.reduce((acc, r) => acc + (r.delayMinutes || 0), 0);
    const totalOvertimeMinutes = records.reduce((acc, r) => acc + (r.overtimeMinutes || 0), 0);

    return {
      year,
      month,
      totalDaysPresent,
      totalDelayMinutes,
      totalOvertimeMinutes,
      recordsCount: records.length,
    };
  }

  /**
   * HR correction of one employee's day (e.g. a forgotten check-in): creates or replaces the record
   * with the given company-time times, computing lateness and overtime like check-in and check-out
   */
  async recordAttendance(dto: RecordAttendanceDto) {
    const employee = await this.prisma.employeeProfile.findUnique({
      where: { id: dto.employeeId },
      select: { id: true, shiftType: true },
    });
    if (!employee) {
      throw new NotFoundException('Employee not found.');
    }

    const date = toDateOnly(new Date(dto.date));
    if (date.getTime() > this.getTodayDateOnly().getTime()) {
      throw new BadRequestException('Attendance cannot be recorded for a future date.');
    }
    if (isCompanyClosedDay(date)) {
      throw new BadRequestException('يوم الجمعة إجازة للجميع، ولا يمكن تسجيل حضور فيه.');
    }

    const toMinutes = (time: string) => {
      const [hours, minutes] = time.split(':').map(Number);
      return hours * 60 + minutes;
    };
    const atTime = (minutesOfDay: number) =>
      zonedTimeToUtc(
        date.getUTCFullYear(),
        date.getUTCMonth() + 1,
        date.getUTCDate(),
        Math.floor(minutesOfDay / 60),
        minutesOfDay % 60,
      );

    const checkInMinutes = toMinutes(dto.checkInTime);
    const checkOutMinutes = dto.checkOutTime ? toMinutes(dto.checkOutTime) : null;
    if (checkOutMinutes !== null && checkOutMinutes <= checkInMinutes) {
      throw new BadRequestException('Check-out time must be after check-in time.');
    }

    const permissionMinutes = await this.getApprovedPermissionMinutes(employee.id, date);
    const { delayMinutes, overtimeMinutes } =
      checkOutMinutes === null
        ? { delayMinutes: arrivalDelayMinutes(checkInMinutes, permissionMinutes), overtimeMinutes: 0 }
        : shiftBalance(checkOutMinutes - checkInMinutes, permissionMinutes, employee.shiftType);

    const data = {
      checkInTime: atTime(checkInMinutes),
      checkOutTime: checkOutMinutes === null ? null : atTime(checkOutMinutes),
      status: AttendanceStatus.PRESENT,
      delayMinutes,
      overtimeMinutes,
    };

    return this.prisma.attendanceRecord.upsert({
      where: { employeeId_date: { employeeId: employee.id, date } },
      create: { employeeId: employee.id, date, ...data },
      update: data,
      include: {
        employee: {
          select: { id: true, fullName: true, employeeCode: true, shiftType: true },
        },
      },
    });
  }

  // ---------------------------------------------------------------------------
  // PUBLIC HOLIDAYS (الإجازات الرسمية): company-wide days off, never counted as absence
  // ---------------------------------------------------------------------------

  async getPublicHolidays(year = getZonedParts(new Date()).year) {
    return this.prisma.publicHoliday.findMany({
      where: { date: { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) } },
      orderBy: { date: 'asc' },
    });
  }

  /** One row per day of the holiday; days that are already holidays are left as they are */
  async createPublicHoliday(dto: CreatePublicHolidayDto) {
    const name = dto.name.trim();
    if (!name) {
      throw new BadRequestException('Holiday name is required.');
    }

    const start = toDateOnly(new Date(dto.startDate));
    const end = toDateOnly(new Date(dto.endDate ?? dto.startDate));
    const days = calendarDaysBetween(start, end);
    if (days < 1) {
      throw new BadRequestException('A holiday cannot end before it starts.');
    }
    if (days > MAX_HOLIDAY_SPAN_DAYS) {
      throw new BadRequestException(`A holiday can span at most ${MAX_HOLIDAY_SPAN_DAYS} days.`);
    }

    await this.prisma.publicHoliday.createMany({
      data: Array.from({ length: days }, (_, i) => ({
        date: new Date(start.getTime() + i * DAY_MS),
        name,
      })),
      skipDuplicates: true,
    });

    return this.prisma.publicHoliday.findMany({
      where: { date: { gte: start, lte: end } },
      orderBy: { date: 'asc' },
    });
  }

  async deletePublicHoliday(id: string) {
    return this.prisma.publicHoliday.delete({ where: { id } });
  }
}
