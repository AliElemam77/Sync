import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { QueryAuditLogsDto } from './dto/query-audit-logs.dto';
import {
  QueryPendingRequestsDto,
  PendingRequestType,
} from './dto/query-pending-requests.dto';
import {
  ManagementOverrideDto,
  RequestCategory,
  ManagementAction,
} from './dto/management-override.dto';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { LeavesService } from '../leaves/leaves.service';
import { WorkPermissionsService } from '../work-permissions/work-permissions.service';
import { completionChange } from '../tasks/tasks.service';
import { businessMonthRange, businessToday, getZonedParts } from '../../common/time/business-time';
import {
  Prisma,
  RequestStatus,
  TaskStatus,
  LeaveType,
  AttendanceStatus,
  TransactionType,
} from '@prisma/client';

export interface ActionableItem {
  id: string;
  category: 'LEAVE' | 'PERMISSION' | 'TASK_REVIEW';
  title: string;
  description: string | null;
  status: string;
  priority?: string | null;
  createdAt: Date;
  requester: {
    id: string;
    fullName: string;
    employeeCode: string;
    avatarUrl: string | null;
    positionName?: string;
    departmentName?: string;
  };
  department: {
    id: string;
    name: string;
    code: string;
  } | null;
  meta: Record<string, any>;
}

@Injectable()
export class ManagementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly leavesService: LeavesService,
    private readonly workPermissionsService: WorkPermissionsService,
  ) {}

  // ---------------------------------------------------------------------------
  // 1. GET AUDIT LOGS (TIMELINE & INFINITE SCROLLING)
  // ---------------------------------------------------------------------------

  async getAuditLogs(query: QueryAuditLogsDto) {
    const {
      action,
      entity,
      userId,
      startDate,
      endDate,
      search,
      page = 1,
      limit = 30,
    } = query;

    const skip = (page - 1) * limit;
    const where: Prisma.AuditLogWhereInput = {};

    if (action) {
      where.action = action;
    }

    if (entity) {
      where.entity = { equals: entity, mode: 'insensitive' };
    }

    if (userId) {
      where.userId = userId;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    if (search && search.trim()) {
      const term = search.trim();
      where.OR = [
        { entity: { contains: term, mode: 'insensitive' } },
        { entityId: { contains: term, mode: 'insensitive' } },
        {
          user: {
            employeeProfile: {
              fullName: { contains: term, mode: 'insensitive' },
            },
          },
        },
        {
          user: {
            email: { contains: term, mode: 'insensitive' },
          },
        },
      ];
    }

    const [total, records] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              employeeProfile: {
                select: {
                  id: true,
                  fullName: true,
                  employeeCode: true,
                  avatarUrl: true,
                  position: { select: { id: true, name: true } },
                  department: { select: { id: true, name: true, code: true } },
                },
              },
            },
          },
        },
      }),
    ]);

    return {
      data: records,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // 2. UNIFIED PENDING REQUESTS (PARALLEL PROMISE.ALL AGGREGATION)
  // ---------------------------------------------------------------------------

  async getPendingRequests(query: QueryPendingRequestsDto) {
    const { type = PendingRequestType.ALL, departmentId, limit = 50 } = query;

    const shouldFetchLeaves =
      type === PendingRequestType.ALL || type === PendingRequestType.LEAVE;
    const shouldFetchPermissions =
      type === PendingRequestType.ALL || type === PendingRequestType.PERMISSION;
    const shouldFetchTasks =
      type === PendingRequestType.ALL || type === PendingRequestType.TASK_REVIEW;

    const [pendingLeaves, pendingPermissions, pendingTasks] = await Promise.all([
      shouldFetchLeaves
        ? this.prisma.leaveRequest.findMany({
            where: {
              status: RequestStatus.PENDING,
              ...(departmentId && {
                employee: { departmentId },
              }),
            },
            take: limit,
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              type: true,
              startDate: true,
              endDate: true,
              totalDaysRequested: true,
              reason: true,
              createdAt: true,
              status: true,
              employee: {
                select: {
                  id: true,
                  fullName: true,
                  employeeCode: true,
                  avatarUrl: true,
                  annualLeaveDays: true,
                  position: { select: { id: true, name: true } },
                  department: { select: { id: true, name: true, code: true } },
                },
              },
            },
          })
        : Promise.resolve([]),

      shouldFetchPermissions
        ? this.prisma.permissionRequest.findMany({
            where: {
              status: RequestStatus.PENDING,
              ...(departmentId && {
                employee: { departmentId },
              }),
            },
            take: limit,
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              date: true,
              startTime: true,
              endTime: true,
              hoursRequested: true,
              reason: true,
              createdAt: true,
              status: true,
              employee: {
                select: {
                  id: true,
                  fullName: true,
                  employeeCode: true,
                  avatarUrl: true,
                  monthlyPermissionHours: true,
                  position: { select: { id: true, name: true } },
                  department: { select: { id: true, name: true, code: true } },
                },
              },
            },
          })
        : Promise.resolve([]),

      shouldFetchTasks
        ? this.prisma.task.findMany({
            where: {
              status: { in: [TaskStatus.WAITING_FOR_CLIENT, TaskStatus.REVIEW] },
              ...(departmentId && {
                OR: [
                  { targetDepartmentId: departmentId },
                  { creator: { departmentId } },
                ],
              }),
            },
            take: limit,
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              title: true,
              description: true,
              status: true,
              priority: true,
              dueDate: true,
              createdAt: true,
              creator: {
                select: {
                  id: true,
                  fullName: true,
                  employeeCode: true,
                  avatarUrl: true,
                  position: { select: { id: true, name: true } },
                  department: { select: { id: true, name: true, code: true } },
                },
              },
              assignee: {
                select: {
                  id: true,
                  fullName: true,
                  employeeCode: true,
                  avatarUrl: true,
                },
              },
              targetDepartment: {
                select: { id: true, name: true, code: true },
              },
            },
          })
        : Promise.resolve([]),
    ]);

    // Standardize Leaves
    const leaveItems: ActionableItem[] = pendingLeaves.map((l) => {
      const typeLabel =
        l.type === LeaveType.ANNUAL
          ? 'إجازة سنوية'
          : l.type === LeaveType.SICK
          ? 'إجازة مرضية'
          : 'إجازة غير مدفوعة';

      return {
        id: l.id,
        category: 'LEAVE',
        title: `طلب ${typeLabel} (${l.totalDaysRequested} يوم)`,
        description: l.reason,
        status: l.status,
        createdAt: l.createdAt,
        requester: {
          id: l.employee.id,
          fullName: l.employee.fullName,
          employeeCode: l.employee.employeeCode,
          avatarUrl: l.employee.avatarUrl,
          positionName: l.employee.position?.name,
          departmentName: l.employee.department?.name,
        },
        department: l.employee.department,
        meta: {
          leaveType: l.type,
          startDate: l.startDate,
          endDate: l.endDate,
          totalDays: l.totalDaysRequested,
          remainingBalance: l.employee.annualLeaveDays,
        },
      };
    });

    // Standardize Permissions
    const permissionItems: ActionableItem[] = pendingPermissions.map((p) => ({
      id: p.id,
      category: 'PERMISSION',
      title: `طلب إذن عمل (${p.hoursRequested} ساعات)`,
      description: p.reason,
      status: p.status,
      createdAt: p.createdAt,
      requester: {
        id: p.employee.id,
        fullName: p.employee.fullName,
        employeeCode: p.employee.employeeCode,
        avatarUrl: p.employee.avatarUrl,
        positionName: p.employee.position?.name,
        departmentName: p.employee.department?.name,
      },
      department: p.employee.department,
      meta: {
        date: p.date,
        startTime: p.startTime,
        endTime: p.endTime,
        hoursRequested: p.hoursRequested,
        monthlyQuota: p.employee.monthlyPermissionHours,
      },
    }));

    // Standardize Tasks in Review
    const taskItems: ActionableItem[] = pendingTasks.map((t) => ({
      id: t.id,
      category: 'TASK_REVIEW',
      title: `مهمة ${t.status === 'WAITING_FOR_CLIENT' ? 'بانتظار العميل' : 'قيد المراجعة'}: ${t.title}`,
      description: t.description,
      status: t.status,
      priority: t.priority,
      createdAt: t.createdAt,
      requester: {
        id: t.creator.id,
        fullName: t.creator.fullName,
        employeeCode: t.creator.employeeCode,
        avatarUrl: t.creator.avatarUrl,
        positionName: t.creator.position?.name,
        departmentName: t.creator.department?.name,
      },
      department: t.targetDepartment || t.creator.department,
      meta: {
        taskId: t.id,
        taskStatus: t.status,
        dueDate: t.dueDate,
        assignee: t.assignee,
      },
    }));

    // Merge and sort unified list chronologically
    const allItems = [...leaveItems, ...permissionItems, ...taskItems].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    return {
      data: allItems,
      counts: {
        leaves: leaveItems.length,
        permissions: permissionItems.length,
        tasks: taskItems.length,
        total: allItems.length,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // 3. MANAGEMENT OVERVIEW COMMAND CENTER KPIS
  // ---------------------------------------------------------------------------

  async getManagementStats() {
    // Same "today" as attendance check-ins (company calendar date), and the current company month
    const today = businessToday();
    const now = getZonedParts(new Date());
    const { start: startOfMonth, end: startOfNextMonth } = businessMonthRange(now.year, now.month);

    const [
      activeEmployeesCount,
      todayPresentCount,
      totalDepartmentsCount,
      openTasksCount,
      pendingLeavesCount,
      pendingPermissionsCount,
      pendingTasksReviewCount,
      incomeAggregate,
      expenseAggregate,
    ] = await Promise.all([
      this.prisma.employeeProfile.count({ where: { status: 'ACTIVE' } }),
      this.prisma.attendanceRecord.count({
        where: { date: today, status: AttendanceStatus.PRESENT },
      }),
      this.prisma.department.count({ where: { isActive: true } }),
      this.prisma.task.count({
        where: { status: { not: TaskStatus.DONE } },
      }),
      this.prisma.leaveRequest.count({ where: { status: RequestStatus.PENDING } }),
      this.prisma.permissionRequest.count({
        where: { status: RequestStatus.PENDING },
      }),
      this.prisma.task.count({
        where: { status: { in: [TaskStatus.WAITING_FOR_CLIENT, TaskStatus.REVIEW] } },
      }),
      this.prisma.financialTransaction.aggregate({
        where: {
          isReversed: false,
          type: TransactionType.INCOME,
          transactionDate: { gte: startOfMonth, lt: startOfNextMonth },
        },
        _sum: { amount: true },
      }),
      this.prisma.financialTransaction.aggregate({
        where: {
          isReversed: false,
          type: TransactionType.EXPENSE,
          transactionDate: { gte: startOfMonth, lt: startOfNextMonth },
        },
        _sum: { amount: true },
      }),
    ]);

    const monthlyIncome = incomeAggregate._sum.amount
      ? Number(incomeAggregate._sum.amount)
      : 0;
    const monthlyExpense = expenseAggregate._sum.amount
      ? Number(expenseAggregate._sum.amount)
      : 0;
    const monthlyNetProfit = Number((monthlyIncome - monthlyExpense).toFixed(2));

    const pendingApprovalsTotal =
      pendingLeavesCount + pendingPermissionsCount + pendingTasksReviewCount;

    return {
      activeEmployeesCount,
      todayPresentCount,
      totalDepartmentsCount,
      openTasksCount,
      pendingApprovalsTotal,
      pendingBreakdown: {
        leaves: pendingLeavesCount,
        permissions: pendingPermissionsCount,
        tasks: pendingTasksReviewCount,
      },
      financialSummary: {
        monthlyIncome,
        monthlyExpense,
        monthlyNetProfit,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // 4. MANAGEMENT OVERRIDE & DIRECT APPROVAL DISPATCH
  // ---------------------------------------------------------------------------

  async overrideAction(dto: ManagementOverrideDto, user: AuthenticatedUser) {
    const { id, category, action, reason } = dto;
    const rejection = { rejectionReason: reason?.trim() || 'تم الرفض بواسطة الإدارة العليا' };

    // Leave & permission decisions go through their owning services so status checks,
    // balance validation/deduction and employee notifications stay identical to the normal flow.
    if (category === RequestCategory.LEAVE) {
      return action === ManagementAction.APPROVE
        ? this.leavesService.approveLeaveRequest(id, user)
        : this.leavesService.rejectLeaveRequest(id, rejection, user);
    }

    if (category === RequestCategory.PERMISSION) {
      return action === ManagementAction.APPROVE
        ? this.workPermissionsService.approvePermissionRequest(id, user)
        : this.workPermissionsService.rejectPermissionRequest(id, rejection, user);
    }

    if (category === RequestCategory.TASK) {
      const task = await this.prisma.task.findUnique({ where: { id } });
      if (!task) {
        throw new NotFoundException('المهمة غير موجودة.');
      }

      // Only tasks surfaced in the management inbox can be overridden
      if (task.status !== TaskStatus.REVIEW && task.status !== TaskStatus.WAITING_FOR_CLIENT) {
        throw new BadRequestException('لا يمكن تنفيذ هذا الإجراء على مهمة ليست قيد المراجعة أو بانتظار العميل.');
      }

      const nextStatus =
        action === ManagementAction.APPROVE || action === ManagementAction.COMPLETE
          ? TaskStatus.DONE
          : TaskStatus.IN_PROGRESS;

      return this.prisma.task.update({
        where: { id },
        data: { status: nextStatus, ...completionChange(task.status, nextStatus) },
      });
    }

    throw new BadRequestException('إجراء غير مدعوم.');
  }
}
