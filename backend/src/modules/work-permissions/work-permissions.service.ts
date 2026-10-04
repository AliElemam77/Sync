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
import { RequestStatus } from '@prisma/client';
import { EventsGateway } from '../events/events.gateway';

@Injectable()
export class WorkPermissionsService {
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
   * Submit a new Work Permission Request (الأذونات)
   */
  async createPermissionRequest(userId: string, dto: CreatePermissionRequestDto) {
    const employee = await this.getEmployeeByUserId(userId);

    // Validate monthly permission hours balance
    if (employee.monthlyPermissionHours < dto.hoursRequested) {
      throw new BadRequestException(
        `Insufficient monthly permission hours balance. Remaining: ${employee.monthlyPermissionHours} hour(s), requested: ${dto.hoursRequested} hour(s).`,
      );
    }

    const permission = await this.prisma.permissionRequest.create({
      data: {
        employeeId: employee.id,
        date: new Date(dto.date),
        startTime: dto.startTime,
        endTime: dto.endTime,
        hoursRequested: dto.hoursRequested,
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
  async getPermissionRequests(query: PermissionQueryDto, currentUser: any) {
    const roleName = typeof currentUser.role === 'string' ? currentUser.role : currentUser.role?.name;
    const isSuperAdminOrHR = ['SUPER_ADMIN', 'HR_MANAGER'].includes(roleName || '');

    const currentEmp = await this.prisma.employeeProfile.findUnique({
      where: { userId: currentUser.id },
    });

    const where: any = {};

    if (query.status) where.status = query.status;

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
  async approvePermissionRequest(id: string, approverUser: any) {
    const roleName = typeof approverUser.role === 'string' ? approverUser.role : approverUser.role?.name;
    const isSuperAdminOrHR = ['SUPER_ADMIN', 'HR_MANAGER'].includes(roleName || '');
    if (!isSuperAdminOrHR) {
      throw new ForbiddenException('Only HR Managers or Admins have the authority to approve permissions.');
    }

    const permission = await this.prisma.permissionRequest.findUnique({
      where: { id },
      include: {
        employee: true,
      },
    });

    if (!permission) {
      throw new NotFoundException('Permission request not found.');
    }

    if (permission.status !== RequestStatus.PENDING) {
      throw new BadRequestException(`Cannot approve request that is already ${permission.status}.`);
    }

    // Execute atomic transaction for safe balance decrement
    const result = await this.prisma.$transaction(async (tx) => {
      // Re-verify balance in atomic block
      const latestEmployee = await tx.employeeProfile.findUnique({
        where: { id: permission.employeeId },
      });

      if (!latestEmployee || latestEmployee.monthlyPermissionHours < permission.hoursRequested) {
        throw new BadRequestException(
          `Insufficient balance to approve. Employee has ${latestEmployee?.monthlyPermissionHours || 0} hour(s) remaining, requested ${permission.hoursRequested}.`,
        );
      }

      // Safely decrement monthly permission hours
      await tx.employeeProfile.update({
        where: { id: permission.employeeId },
        data: {
          monthlyPermissionHours: {
            decrement: permission.hoursRequested,
          },
        },
      });

      // Mark request as APPROVED
      const updatedPermission = await tx.permissionRequest.update({
        where: { id: permission.id },
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
  async rejectPermissionRequest(id: string, dto: RejectPermissionRequestDto, rejectorUser: any) {
    const roleName = typeof rejectorUser.role === 'string' ? rejectorUser.role : rejectorUser.role?.name;
    const isSuperAdminOrHR = ['SUPER_ADMIN', 'HR_MANAGER'].includes(roleName || '');
    if (!isSuperAdminOrHR) {
      throw new ForbiddenException('Only HR Managers or Admins have the authority to reject permissions.');
    }

    const permission = await this.prisma.permissionRequest.findUnique({
      where: { id },
      include: {
        employee: true,
      },
    });

    if (!permission) {
      throw new NotFoundException('Permission request not found.');
    }

    if (permission.status !== RequestStatus.PENDING) {
      throw new BadRequestException(`Cannot reject request that is already ${permission.status}.`);
    }

    const updatedPermission = await this.prisma.permissionRequest.update({
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
