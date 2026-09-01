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
import { RequestStatus, LeaveType, AttendanceStatus } from '@prisma/client';
import { EventsGateway } from '../events/events.gateway';

@Injectable()
export class LeavesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsGateway: EventsGateway,
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

    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);

    if (start > end) {
      throw new BadRequestException('Start date cannot be after end date.');
    }

    // Balance check for ANNUAL leave
    if (dto.type === LeaveType.ANNUAL) {
      if (employee.annualLeaveDays < dto.totalDaysRequested) {
        throw new BadRequestException(
          `Insufficient annual leave balance. Remaining: ${employee.annualLeaveDays} day(s), requested: ${dto.totalDaysRequested} day(s).`,
        );
      }
    }

    const leave = await this.prisma.leaveRequest.create({
      data: {
        employeeId: employee.id,
        startDate: start,
        endDate: end,
        totalDaysRequested: dto.totalDaysRequested,
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
  async getLeaveRequests(query: LeaveQueryDto, currentUser: any) {
    const roleName = typeof currentUser.role === 'string' ? currentUser.role : currentUser.role?.name;
    const isSuperAdminOrHR = ['SUPER_ADMIN', 'HR_MANAGER'].includes(roleName || '');
    const isTeamLeader = roleName === 'TEAM_LEADER';

    const currentEmp = await this.prisma.employeeProfile.findUnique({
      where: { userId: currentUser.id },
    });

    const where: any = {};

    if (query.status) where.status = query.status;
    if (query.type) where.type = query.type;

    if (isSuperAdminOrHR) {
      if (query.employeeId) where.employeeId = query.employeeId;
      if (query.departmentId) where.employee = { departmentId: query.departmentId };
    } else {
      // Non-HR users (including Team Leaders) see only their own requests
      if (!currentEmp) {
        return [];
      }
      where.employeeId = currentEmp.id;
    }

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
  async approveLeaveRequest(id: string, approverUser: any) {
    const roleName = typeof approverUser.role === 'string' ? approverUser.role : approverUser.role?.name;
    const isSuperAdminOrHR = ['SUPER_ADMIN', 'HR_MANAGER'].includes(roleName || '');
    if (!isSuperAdminOrHR) {
      throw new ForbiddenException('Only HR Managers or Admins have the authority to approve leaves.');
    }

    const leave = await this.prisma.leaveRequest.findUnique({
      where: { id },
      include: {
        employee: true,
      },
    });

    if (!leave) {
      throw new NotFoundException('Leave request not found.');
    }

    if (leave.status !== RequestStatus.PENDING) {
      throw new BadRequestException(`Cannot approve leave that is already ${leave.status}.`);
    }

    // Execute atomic transaction for safe balance decrement
    const result = await this.prisma.$transaction(async (tx) => {
      if (leave.type === LeaveType.ANNUAL) {
        // Re-verify balance in atomic block
        const latestEmployee = await tx.employeeProfile.findUnique({
          where: { id: leave.employeeId },
        });

        if (!latestEmployee || latestEmployee.annualLeaveDays < leave.totalDaysRequested) {
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

      // Mark request as APPROVED
      const updatedLeave = await tx.leaveRequest.update({
        where: { id: leave.id },
        data: {
          status: RequestStatus.APPROVED,
          rejectionReason: null,
        },
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
  async rejectLeaveRequest(id: string, dto: RejectLeaveDto, rejectorUser: any) {
    const roleName = typeof rejectorUser.role === 'string' ? rejectorUser.role : rejectorUser.role?.name;
    const isSuperAdminOrHR = ['SUPER_ADMIN', 'HR_MANAGER'].includes(roleName || '');
    if (!isSuperAdminOrHR) {
      throw new ForbiddenException('Only HR Managers or Admins have the authority to reject leaves.');
    }

    const leave = await this.prisma.leaveRequest.findUnique({
      where: { id },
      include: {
        employee: true,
      },
    });

    if (!leave) {
      throw new NotFoundException('Leave request not found.');
    }

    if (leave.status !== RequestStatus.PENDING) {
      throw new BadRequestException(`Cannot reject leave that is already ${leave.status}.`);
    }

    const updatedLeave = await this.prisma.leaveRequest.update({
      where: { id },
      data: {
        status: RequestStatus.REJECTED,
        rejectionReason: dto.rejectionReason,
      },
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
