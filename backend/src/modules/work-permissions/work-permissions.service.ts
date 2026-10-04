import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePermissionRequestDto } from './dto/create-permission-request.dto';
import { RejectPermissionRequestDto } from './dto/reject-permission-request.dto';
import { PermissionQueryDto } from './dto/permission-query.dto';
import { Prisma, RequestStatus } from '@prisma/client';
import { EventsGateway } from '../events/events.gateway';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { AccessScopeService } from '../../common/access/access-scope.service';
import {
  HALF_DAY_LEAVE_DAYS,
  HALF_DAY_PERMISSION_HOURS,
  MAX_PERMISSION_HOURS,
  isHalfDayPermission,
  permissionMonthRange,
  wholeHoursBetween,
} from './permission-policy';

@Injectable()
export class WorkPermissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsGateway: EventsGateway,
    private readonly access: AccessScopeService,
  ) {}

  /**
   * Helper to retrieve employee profile by User ID
   */
  private async getEmployeeByUserId(userId: string) {
    const employee = await this.prisma.employeeProfile.findUnique({
      where: { userId },
      include: {
        department: true,
      },
    });

    if (!employee) {
      throw new BadRequestException('No active employee profile associated with your account.');
    }

    return employee;
  }

  /** Hours already approved in the calendar month a permission date falls in */
  private async getApprovedHoursInMonth(
    client: Pick<Prisma.TransactionClient, 'permissionRequest'>,
    employeeId: string,
    date: Date,
  ): Promise<number> {
    const { start, end } = permissionMonthRange(date);
    const { _sum } = await client.permissionRequest.aggregate({
      where: {
        employeeId,
        status: RequestStatus.APPROVED,
        date: { gte: start, lt: end },
        // Half-day (4-hour) permissions come out of annual leave, not the monthly hours
        hoursRequested: { lt: HALF_DAY_PERMISSION_HOURS },
      },
      _sum: { hoursRequested: true },
    });
    return _sum.hoursRequested ?? 0;
  }

  /**
   * Submit a new Work Permission Request (الأذونات)
   */
  async createPermissionRequest(userId: string, dto: CreatePermissionRequestDto) {
    const employee = await this.getEmployeeByUserId(userId);

    // When both times are given they define the duration: whole hours only, 1 to MAX_PERMISSION_HOURS
    let hoursRequested = dto.hoursRequested;
    if (dto.startTime && dto.endTime) {
      const hours = wholeHoursBetween(dto.startTime, dto.endTime);
      if (hours === null || hours > MAX_PERMISSION_HOURS) {
        throw new BadRequestException(
          `A permission must span whole hours, from 1 to ${MAX_PERMISSION_HOURS} (e.g. 10:00-12:00).`,
        );
      }
      hoursRequested = hours;
    }

    if (isHalfDayPermission(hoursRequested)) {
      // A 4-hour permission is half a day of annual leave, not monthly permission hours
      if (employee.annualLeaveDays.lessThan(HALF_DAY_LEAVE_DAYS)) {
        throw new BadRequestException(
          `A ${HALF_DAY_PERMISSION_HOURS}-hour permission counts as half a day of annual leave. Remaining annual leave: ${employee.annualLeaveDays.toString()} day(s).`,
        );
      }
    } else {
      // The allowance renews monthly: compare with what is left in the permission's month
      const remaining =
        employee.monthlyPermissionHours -
        (await this.getApprovedHoursInMonth(this.prisma, employee.id, new Date(dto.date)));
      if (remaining < hoursRequested) {
        throw new BadRequestException(
          `Insufficient monthly permission hours balance. Remaining this month: ${Math.max(remaining, 0)} hour(s), requested: ${hoursRequested} hour(s).`,
        );
      }
    }

    const permission = await this.prisma.permissionRequest.create({
      data: {
        employeeId: employee.id,
        date: new Date(dto.date),
        startTime: dto.startTime,
        endTime: dto.endTime,
        hoursRequested,
        status: RequestStatus.PENDING,
        reason: dto.reason,
      },
      include: {
        employee: {
          select: {
            id: true,
            fullName: true,
            employeeCode: true,
            monthlyPermissionHours: true,
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
    });

    return permission;
  }

  /**
   * Get Work Permission Requests (Role & Department Scoped)
   */
  async getPermissionRequests(query: PermissionQueryDto, currentUser: AuthenticatedUser) {
    const where: Prisma.PermissionRequestWhereInput = {};

    if (query.status) where.status = query.status;

    // HR sees everything; others see their own requests plus those of departments they approve
    const visibility = await this.access.getRequestVisibility(currentUser);
    if (visibility !== null) {
      if (visibility.length === 0) return [];
      where.OR = visibility;
    }

    // Optional filters narrow results within the visible scope
    if (query.employeeId) where.employeeId = query.employeeId;
    if (query.departmentId) where.employee = { departmentId: query.departmentId };

    const permissions = await this.prisma.permissionRequest.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            fullName: true,
            employeeCode: true,
            monthlyPermissionHours: true,
            avatarUrl: true,
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
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    return permissions;
  }

  /**
   * Approve Permission Request with Atomic Balance Deduction
   */
  async approvePermissionRequest(id: string, approverUser: AuthenticatedUser) {
    const permission = await this.prisma.permissionRequest.findUnique({
      where: { id },
      include: {
        employee: true,
      },
    });

    if (!permission) {
      throw new NotFoundException('Permission request not found.');
    }

    if (!(await this.access.canDecideRequestOf(approverUser, permission.employee))) {
      throw new ForbiddenException(
        'You can only approve requests from employees in departments you lead (HR can approve any).',
      );
    }

    if (permission.status !== RequestStatus.PENDING) {
      throw new BadRequestException(`Cannot approve request that is already ${permission.status}.`);
    }

    const halfDay = isHalfDayPermission(permission.hoursRequested);

    const result = await this.prisma.$transaction(async (tx) => {
      const latestEmployee = await tx.employeeProfile.findUnique({
        where: { id: permission.employeeId },
        select: { monthlyPermissionHours: true, annualLeaveDays: true },
      });

      if (halfDay) {
        // 4 hours = half a day, taken from the annual leave balance
        if (!latestEmployee || latestEmployee.annualLeaveDays.lessThan(HALF_DAY_LEAVE_DAYS)) {
          throw new BadRequestException(
            `Insufficient annual leave to approve a half-day permission. Employee has ${latestEmployee?.annualLeaveDays.toString() ?? 0} day(s).`,
          );
        }
      } else {
        // Re-verify what is left of the monthly allowance for the permission's month
        const remaining =
          (latestEmployee?.monthlyPermissionHours ?? 0) -
          (await this.getApprovedHoursInMonth(tx, permission.employeeId, permission.date));

        if (remaining < permission.hoursRequested) {
          throw new BadRequestException(
            `Insufficient balance to approve. Employee has ${Math.max(remaining, 0)} hour(s) left this month, requested ${permission.hoursRequested}.`,
          );
        }
      }

      // Claim the request only if it is still pending, so concurrent decisions cannot both apply
      const { count } = await tx.permissionRequest.updateMany({
        where: { id: permission.id, status: RequestStatus.PENDING },
        data: { status: RequestStatus.APPROVED, rejectionReason: null },
      });
      if (count === 0) {
        throw new BadRequestException('This request has already been decided.');
      }

      if (halfDay) {
        await tx.employeeProfile.update({
          where: { id: permission.employeeId },
          data: { annualLeaveDays: { decrement: HALF_DAY_LEAVE_DAYS } },
        });
      }

      const updatedPermission = await tx.permissionRequest.findUniqueOrThrow({
        where: { id: permission.id },
        include: {
          employee: {
            select: {
              id: true,
              userId: true,
              fullName: true,
              employeeCode: true,
              monthlyPermissionHours: true,
            },
          },
        },
      });

      return updatedPermission;
    });

    // Send real-time notification to employee
    if (result.employee?.userId) {
      this.eventsGateway.sendNotification(result.employee.userId, {
        id: `notif-${Date.now()}`,
        type: 'TASK_DONE',
        title: 'Permission Request Approved',
        message: `Your permission request for ${permission.hoursRequested} hour(s) has been approved.`,
        createdAt: new Date().toISOString(),
        read: false,
      });
    }

    return result;
  }

  /**
   * Reject Permission Request with Reason
   */
  async rejectPermissionRequest(
    id: string,
    dto: RejectPermissionRequestDto,
    rejectorUser: AuthenticatedUser,
  ) {
    const permission = await this.prisma.permissionRequest.findUnique({
      where: { id },
      include: {
        employee: true,
      },
    });

    if (!permission) {
      throw new NotFoundException('Permission request not found.');
    }

    if (!(await this.access.canDecideRequestOf(rejectorUser, permission.employee))) {
      throw new ForbiddenException(
        'You can only reject requests from employees in departments you lead (HR can reject any).',
      );
    }

    if (permission.status !== RequestStatus.PENDING) {
      throw new BadRequestException(`Cannot reject request that is already ${permission.status}.`);
    }

    // Conditional transition: fails if the request was decided in the meantime
    const { count } = await this.prisma.permissionRequest.updateMany({
      where: { id, status: RequestStatus.PENDING },
      data: {
        status: RequestStatus.REJECTED,
        rejectionReason: dto.rejectionReason,
      },
    });
    if (count === 0) {
      throw new BadRequestException('This request has already been decided.');
    }

    const updatedPermission = await this.prisma.permissionRequest.findUniqueOrThrow({
      where: { id },
      include: {
        employee: {
          select: {
            id: true,
            userId: true,
            fullName: true,
            employeeCode: true,
            monthlyPermissionHours: true,
          },
        },
      },
    });

    // Notify employee of rejection
    if (updatedPermission.employee?.userId) {
      this.eventsGateway.sendNotification(updatedPermission.employee.userId, {
        id: `notif-${Date.now()}`,
        type: 'NEEDS_REVISION',
        title: 'Permission Request Rejected',
        message: `Your permission request was rejected: "${dto.rejectionReason}"`,
        createdAt: new Date().toISOString(),
        read: false,
      });
    }

    return updatedPermission;
  }
}
