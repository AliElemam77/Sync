import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateLeaveDto } from './dto/create-leave.dto';
import { RejectLeaveDto } from './dto/reject-leave.dto';
import { LeaveQueryDto } from './dto/leave-query.dto';
import { Prisma, RequestStatus, LeaveType } from '@prisma/client';
import { EventsGateway } from '../events/events.gateway';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { AccessScopeService } from '../../common/access/access-scope.service';
import {
  MAX_ANNUAL_LEAVE_DAYS_PER_REQUEST,
  MAX_LEAVE_RANGE_DAYS,
  calendarDaysBetween,
  countWorkingDays,
  toDateOnly,
} from './leave-policy';

@Injectable()
export class LeavesService {
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

  /**
   * Submit a new Leave Request
   */
  async createLeaveRequest(userId: string, dto: CreateLeaveDto) {
    const employee = await this.getEmployeeByUserId(userId);

    const start = toDateOnly(new Date(dto.startDate));
    const end = toDateOnly(new Date(dto.endDate));

    if (start > end) {
      throw new BadRequestException('Start date cannot be after end date.');
    }
    if (calendarDaysBetween(start, end) > MAX_LEAVE_RANGE_DAYS) {
      throw new BadRequestException('The selected leave period is too long.');
    }

    // The server counts the days: working days only, weekly days off excluded
    const totalDaysRequested = countWorkingDays(start, end, employee.shiftType);
    if (totalDaysRequested === 0) {
      throw new BadRequestException('The selected dates fall entirely on weekly days off.');
    }

    if (dto.type === LeaveType.ANNUAL) {
      if (totalDaysRequested > MAX_ANNUAL_LEAVE_DAYS_PER_REQUEST) {
        throw new BadRequestException(
          `Annual leave is limited to ${MAX_ANNUAL_LEAVE_DAYS_PER_REQUEST} working days per request (requested ${totalDaysRequested}).`,
        );
      }
      if (employee.annualLeaveDays.lessThan(totalDaysRequested)) {
        throw new BadRequestException(
          `Insufficient annual leave balance. Remaining: ${employee.annualLeaveDays} day(s), requested: ${totalDaysRequested} day(s).`,
        );
      }
    }

    const leave = await this.prisma.leaveRequest.create({
      data: {
        employeeId: employee.id,
        startDate: start,
        endDate: end,
        totalDaysRequested,
        type: dto.type,
        status: RequestStatus.PENDING,
        reason: dto.reason,
      },
      include: {
        employee: {
          select: {
            id: true,
            fullName: true,
            employeeCode: true,
            annualLeaveDays: true,
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

    return leave;
  }

  /**
   * Get Leave Requests with Dynamic Role & Department Scoping
   */
  async getLeaveRequests(query: LeaveQueryDto, currentUser: AuthenticatedUser) {
    const where: Prisma.LeaveRequestWhereInput = {};

    if (query.status) where.status = query.status;
    if (query.type) where.type = query.type;

    // HR sees everything; others see their own requests plus those of departments they approve
    const visibility = await this.access.getRequestVisibility(currentUser);
    if (visibility !== null) {
      if (visibility.length === 0) return [];
      where.OR = visibility;
    }

    // Optional filters narrow results within the visible scope
    if (query.employeeId) where.employeeId = query.employeeId;
    if (query.departmentId) where.employee = { departmentId: query.departmentId };

    const leaves = await this.prisma.leaveRequest.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            fullName: true,
            employeeCode: true,
            annualLeaveDays: true,
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

    return leaves;
  }

  /**
   * Approve Leave Request with Atomic Balance Deduction & Attendance Synchronization
   */
  async approveLeaveRequest(id: string, approverUser: AuthenticatedUser) {
    const leave = await this.prisma.leaveRequest.findUnique({
      where: { id },
      include: {
        employee: true,
      },
    });

    if (!leave) {
      throw new NotFoundException('Leave request not found.');
    }

    if (!(await this.access.canDecideRequestOf(approverUser, leave.employee))) {
      throw new ForbiddenException(
        'You can only approve requests from employees in departments you lead (HR can approve any).',
      );
    }

    if (leave.status !== RequestStatus.PENDING) {
      throw new BadRequestException(`Cannot approve leave that is already ${leave.status}.`);
    }

    // Execute atomic transaction for safe balance decrement
    const result = await this.prisma.$transaction(async (tx) => {
      // Claim the request only if it is still pending, so concurrent approvals cannot both deduct
      const { count } = await tx.leaveRequest.updateMany({
        where: { id: leave.id, status: RequestStatus.PENDING },
        data: { status: RequestStatus.APPROVED, rejectionReason: null },
      });
      if (count === 0) {
        throw new BadRequestException('This request has already been decided.');
      }

      if (leave.type === LeaveType.ANNUAL) {
        // Re-verify balance in atomic block
        const latestEmployee = await tx.employeeProfile.findUnique({
          where: { id: leave.employeeId },
        });

        if (!latestEmployee || latestEmployee.annualLeaveDays.lessThan(leave.totalDaysRequested)) {
          throw new BadRequestException(
            `Insufficient balance to approve. Employee has ${latestEmployee?.annualLeaveDays || 0} days remaining, requested ${leave.totalDaysRequested}.`,
          );
        }

        // Safely decrement balance
        await tx.employeeProfile.update({
          where: { id: leave.employeeId },
          data: {
            annualLeaveDays: {
              decrement: leave.totalDaysRequested,
            },
          },
        });
      }

      const updatedLeave = await tx.leaveRequest.findUniqueOrThrow({
        where: { id: leave.id },
        include: {
          employee: {
            select: {
              id: true,
              userId: true,
              fullName: true,
              employeeCode: true,
              annualLeaveDays: true,
            },
          },
        },
      });

      return updatedLeave;
    });

    // Send real-time notification to employee
    if (result.employee?.userId) {
      this.eventsGateway.sendNotification(result.employee.userId, {
        id: `notif-${Date.now()}`,
        type: 'TASK_DONE',
        title: 'Leave Request Approved',
        message: `Your ${leave.type} leave request for ${leave.totalDaysRequested} day(s) has been approved.`,
        createdAt: new Date().toISOString(),
        read: false,
      });
    }

    return result;
  }

  /**
   * Reject Leave Request with Reason
   */
  async rejectLeaveRequest(id: string, dto: RejectLeaveDto, rejectorUser: AuthenticatedUser) {
    const leave = await this.prisma.leaveRequest.findUnique({
      where: { id },
      include: {
        employee: true,
      },
    });

    if (!leave) {
      throw new NotFoundException('Leave request not found.');
    }

    if (!(await this.access.canDecideRequestOf(rejectorUser, leave.employee))) {
      throw new ForbiddenException(
        'You can only reject requests from employees in departments you lead (HR can reject any).',
      );
    }

    if (leave.status !== RequestStatus.PENDING) {
      throw new BadRequestException(`Cannot reject leave that is already ${leave.status}.`);
    }

    // Conditional transition: fails if the request was decided in the meantime
    const { count } = await this.prisma.leaveRequest.updateMany({
      where: { id, status: RequestStatus.PENDING },
      data: {
        status: RequestStatus.REJECTED,
        rejectionReason: dto.rejectionReason,
      },
    });
    if (count === 0) {
      throw new BadRequestException('This request has already been decided.');
    }

    const updatedLeave = await this.prisma.leaveRequest.findUniqueOrThrow({
      where: { id },
      include: {
        employee: {
          select: {
            id: true,
            userId: true,
            fullName: true,
            employeeCode: true,
            annualLeaveDays: true,
          },
        },
      },
    });

    // Notify employee of rejection
    if (updatedLeave.employee?.userId) {
      this.eventsGateway.sendNotification(updatedLeave.employee.userId, {
        id: `notif-${Date.now()}`,
        type: 'NEEDS_REVISION',
        title: 'Leave Request Rejected',
        message: `Your ${leave.type} leave request was rejected: "${dto.rejectionReason}"`,
        createdAt: new Date().toISOString(),
        read: false,
      });
    }

    return updatedLeave;
  }
}
