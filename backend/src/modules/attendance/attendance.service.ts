import {
  Injectable,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AttendanceStatus, Prisma, RequestStatus, ShiftType } from '@prisma/client';
import { AttendanceQueryDto } from './dto/attendance-query.dto';
import { EventsGateway } from '../events/events.gateway';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { AccessScopeService } from '../../common/access/access-scope.service';

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsGateway: EventsGateway,
    private readonly access: AccessScopeService,
  ) {}

  /**
   * Helper to normalize a date to midnight UTC (Date-only for DB @db.Date column)
   */
  private getTodayDateOnly(): Date {
    const now = new Date();
    return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
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

    const record = await this.prisma.attendanceRecord.findUnique({
      where: {
        employeeId_date: {
          employeeId: employee.id,
          date: today,
        },
      },
    });

    // Check if the employee has any approved permissions for today
    const approvedPermissions = await this.prisma.permissionRequest.findMany({
      where: {
        employeeId: employee.id,
        date: today,
        status: RequestStatus.APPROVED,
      },
    });

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
        monthlyPermissionHours: employee.monthlyPermissionHours,
      },
      approvedPermissionHours,
      approvedPermissions,
      hasCheckedIn: !!record,
      hasCheckedOut: !!record?.checkOutTime,
      record,
    };
  }

  /**
   * Employee Check-In for Today
   */
  async checkIn(userId: string) {
    const employee = await this.getEmployeeByUserId(userId);
    const today = this.getTodayDateOnly();
    const now = new Date();

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
        `You have already checked in today at ${existing.checkInTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`,
      );
    }

    // Calculate morning arrival delay based on standard 09:00 AM start with 15 mins grace (until 09:15 AM)
    const checkInMinutes = now.getHours() * 60 + now.getMinutes();
    const shiftStartMinutes = 9 * 60; // 09:00 AM = 540
    const graceEndMinutes = shiftStartMinutes + 15; // 09:15 AM = 555

    let delayMinutes = 0;
    if (checkInMinutes > graceEndMinutes) {
      delayMinutes = checkInMinutes - shiftStartMinutes;
    }

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
        `You have already checked out today at ${record.checkOutTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`,
      );
    }

    // -------------------------------------------------------------------------
    // DYNAMIC SHIFT CALCULATION WITH SMART PERMISSION CREDITING
    // -------------------------------------------------------------------------
    // RS Shift = 8 working hours (480 minutes)
    // LS Shift = 9 working hours (540 minutes)
    // -------------------------------------------------------------------------
    const approvedPermissions = await this.prisma.permissionRequest.findMany({
      where: {
        employeeId: employee.id,
        date: today,
        status: RequestStatus.APPROVED,
      },
    });

    const approvedPermissionMinutes = approvedPermissions.reduce(
      (sum, p) => sum + p.hoursRequested * 60,
      0,
    );

    const checkInMs = new Date(record.checkInTime).getTime();
    const checkOutMs = now.getTime();
    const workedMinutes = Math.max(0, Math.floor((checkOutMs - checkInMs) / (1000 * 60)));

    const standardShiftMinutes = employee.shiftType === ShiftType.LS ? 540 : 480;
    // Total credits earned today = worked time + approved official permission time
    const totalEarnedMinutes = workedMinutes + approvedPermissionMinutes;

    let delayMinutes = 0;
    let overtimeMinutes = 0;

    if (totalEarnedMinutes < standardShiftMinutes) {
      delayMinutes = standardShiftMinutes - totalEarnedMinutes;
      overtimeMinutes = 0;
    } else if (totalEarnedMinutes > standardShiftMinutes) {
      delayMinutes = 0;
      overtimeMinutes = totalEarnedMinutes - standardShiftMinutes;
    } else {
      delayMinutes = 0;
      overtimeMinutes = 0;
    }

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
}
