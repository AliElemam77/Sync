import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';
import { QueryTasksDto } from './dto/query-tasks.dto';
import { CreateTaskCommentDto } from './dto/create-task-comment.dto';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Prisma, TaskStatus, TaskAssignmentType } from '@prisma/client';
import { EventsGateway } from '../events/events.gateway';

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsGateway: EventsGateway,
  ) {}

  // ---------------------------------------------------------------------------
  // HELPER: RESOLVE USER EMPLOYEE PROFILE
  // ---------------------------------------------------------------------------

  private async getEmployeeProfile(userId: string) {
    return this.prisma.employeeProfile.findUnique({
      where: { userId },
      include: {
        department: true,
        position: true,
      },
    });
  }

  // ---------------------------------------------------------------------------
  // CREATE TASK (CROSS-DEPARTMENT ROUTING & DIRECT ASSIGNMENT)
  // ---------------------------------------------------------------------------

  async createTask(dto: CreateTaskDto, user: AuthenticatedUser) {
    const creatorEmployee = await this.getEmployeeProfile(user.id);
    if (!creatorEmployee) {
      throw new BadRequestException('Authenticated user must have an active employee profile to create tasks.');
    }

    let targetDepartmentId: string | null = null;
    let assigneeId: string | null = null;

    if (dto.assignmentType === TaskAssignmentType.DEPARTMENT) {
      const dept = await this.prisma.department.findUnique({
        where: { id: dto.targetId },
      });
      if (!dept) {
        throw new BadRequestException(`Target department with ID '${dto.targetId}' not found.`);
      }

      // Rule: Regular agents cannot route department tasks to their own department
      const isAgent = user.role === 'EMPLOYEE' && !user.permissions.includes('org.manage');
      if (isAgent && creatorEmployee.departmentId === dept.id) {
        throw new BadRequestException(
          'Agents cannot route department tasks to their own department. Please assign to yourself or select another department.',
        );
      }

      targetDepartmentId = dept.id;
      assigneeId = null; // Unassigned until Target Team Leader allocates
    } else {
      const assignee = await this.prisma.employeeProfile.findUnique({
        where: { id: dto.targetId },
      });
      if (!assignee) {
        throw new BadRequestException(`Assignee employee with ID '${dto.targetId}' not found.`);
      }

      // Rule: Regular agents can only assign to themselves. Only Team Leaders / Admins can assign to colleagues.
      const isAssigningToSelf = assignee.id === creatorEmployee.id;
      const isAdmin = ['SUPER_ADMIN', 'HR_MANAGER'].includes(user.role);
      const isTeamLeader = user.role === 'TEAM_LEADER' || user.permissions.includes('org.manage');

      if (!isAssigningToSelf && !isTeamLeader && !isAdmin) {
        throw new ForbiddenException(
          'Regular agents can only assign tasks to themselves or request tasks from other departments. Only Team Leaders and Managers can assign tasks to colleagues.',
        );
      }

      assigneeId = assignee.id;
      targetDepartmentId = assignee.departmentId;
    }

    // Default order within the target column
    let taskOrder = dto.order;
    if (taskOrder === undefined) {
      const highestOrder = await this.prisma.task.findFirst({
        where: { status: dto.status ?? TaskStatus.TODO },
        orderBy: { order: 'desc' },
        select: { order: true },
      });
      taskOrder = highestOrder ? highestOrder.order + 1 : 0;
    }

    const createdTask = await this.prisma.task.create({
      data: {
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        priority: dto.priority ?? undefined,
        status: dto.status ?? TaskStatus.TODO,
        assignmentType: dto.assignmentType,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        order: taskOrder,
        creatorId: creatorEmployee.id,
        targetDepartmentId,
        assigneeId,
        attachmentUrls: dto.attachmentUrls || [],
      },
      include: {
        creator: {
          select: {
            id: true,
            employeeCode: true,
            fullName: true,
            avatarUrl: true,
            department: { select: { id: true, name: true, code: true } },
          },
        },
        assignee: {
          select: {
            id: true,
            employeeCode: true,
            fullName: true,
            avatarUrl: true,
            department: { select: { id: true, name: true, code: true } },
            position: { select: { id: true, name: true } },
          },
        },
        targetDepartment: {
          select: { id: true, name: true, code: true },
        },
        comments: {
          include: {
            author: { select: { id: true, fullName: true, employeeCode: true, avatarUrl: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    this.eventsGateway.broadcastTaskCreated(createdTask);
    return createdTask;
  }

  // ---------------------------------------------------------------------------
  // QUERY TASKS (WITH CROSS-DEPARTMENT FILTERS)
  // ---------------------------------------------------------------------------

  async getTasks(query: QueryTasksDto, user?: AuthenticatedUser) {
    const { assigneeId, targetDepartmentId, creatorId, status, priority, assignmentType, search } = query;

    const employee = user ? await this.getEmployeeProfile(user.id) : null;
    const isAdmin = user ? ['SUPER_ADMIN', 'HR_MANAGER'].includes(user.role) : false;

    const where: Prisma.TaskWhereInput = {
      ...(assigneeId && { assigneeId }),
      ...(targetDepartmentId && { targetDepartmentId }),
      ...(creatorId && { creatorId }),
      ...(status && { status }),
      ...(priority && { priority }),
      ...(assignmentType && { assignmentType }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { assignee: { fullName: { contains: search, mode: 'insensitive' } } },
          { creator: { fullName: { contains: search, mode: 'insensitive' } } },
          { targetDepartment: { name: { contains: search, mode: 'insensitive' } } },
        ],
      }),
    };

    // For non-admin employees, if no specific query filter was provided, only show tasks relevant to them or their department
    if (!isAdmin && employee && !assigneeId && !targetDepartmentId && !creatorId && !search) {
      where.OR = [
        { assigneeId: employee.id },
        { creatorId: employee.id },
        { targetDepartmentId: employee.departmentId },
      ];
    }

    return this.prisma.task.findMany({
      where,
      orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
      include: {
        creator: {
          select: {
            id: true,
            employeeCode: true,
            fullName: true,
            avatarUrl: true,
            department: { select: { id: true, name: true, code: true } },
          },
        },
        assignee: {
          select: {
            id: true,
            employeeCode: true,
            fullName: true,
            avatarUrl: true,
            department: { select: { id: true, name: true, code: true } },
            position: { select: { id: true, name: true } },
          },
        },
        targetDepartment: {
          select: { id: true, name: true, code: true },
        },
        comments: {
          include: {
            author: { select: { id: true, fullName: true, employeeCode: true, avatarUrl: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  // ---------------------------------------------------------------------------
  // DEPARTMENT BACKLOG (UNASSIGNED TASKS FOR TEAM LEADERS)
  // ---------------------------------------------------------------------------

  async getDepartmentBacklog(user: AuthenticatedUser) {
    const isAdmin = ['SUPER_ADMIN', 'HR_MANAGER'].includes(user.role);
    const isLeader = user.role === 'TEAM_LEADER' || user.permissions.includes('org.manage');

    // Regular agents do not have access to unassigned department backlog
    if (!isLeader && !isAdmin) {
      return [];
    }

    const employee = await this.getEmployeeProfile(user.id);
    if (!employee) {
      return [];
    }

    return this.prisma.task.findMany({
      where: {
        targetDepartmentId: employee.departmentId,
        assigneeId: null,
        status: { not: TaskStatus.DONE },
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      include: {
        creator: {
          select: {
            id: true,
            employeeCode: true,
            fullName: true,
            avatarUrl: true,
            department: { select: { id: true, name: true, code: true } },
          },
        },
        targetDepartment: {
          select: { id: true, name: true, code: true },
        },
        comments: {
          include: {
            author: { select: { id: true, fullName: true, employeeCode: true, avatarUrl: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  // ---------------------------------------------------------------------------
  // GET SINGLE TASK BY ID
  // ---------------------------------------------------------------------------

  async getTaskById(id: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: {
        creator: {
          select: {
            id: true,
            userId: true,
            employeeCode: true,
            fullName: true,
            avatarUrl: true,
            department: { select: { id: true, name: true, code: true } },
          },
        },
        assignee: {
          select: {
            id: true,
            userId: true,
            employeeCode: true,
            fullName: true,
            avatarUrl: true,
            department: { select: { id: true, name: true, code: true } },
            position: { select: { id: true, name: true } },
          },
        },
        targetDepartment: {
          select: { id: true, name: true, code: true },
        },
        comments: {
          include: {
            author: { select: { id: true, fullName: true, employeeCode: true, avatarUrl: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!task) {
      throw new NotFoundException(`Task with ID '${id}' not found`);
    }

    return task;
  }

  // ---------------------------------------------------------------------------
  // UPDATE TASK STATUS (STRICT STATE MACHINE EXECUTION)
  // ---------------------------------------------------------------------------

  async updateTaskStatus(
    id: string,
    dto: UpdateTaskStatusDto,
    user: AuthenticatedUser,
  ) {
    const task = await this.getTaskById(id);
    const actorEmployee = await this.getEmployeeProfile(user.id);

    const isAdmin = ['SUPER_ADMIN', 'HR_MANAGER'].includes(user.role);
    const isCreator = task.creator?.userId === user.id;
    const isAssignee = task.assignee?.userId === user.id;
    
    const isLeader = user.role === 'TEAM_LEADER' || user.permissions.includes('org.manage');
    
    // Team Leader of Target Department
    const isTargetTeamLeader =
      actorEmployee &&
      task.targetDepartmentId &&
      actorEmployee.departmentId === task.targetDepartmentId &&
      isLeader;

    const targetStatus = dto.status;

    // 1. Rule: Setting to DONE requires Creator or Admin
    if (targetStatus === TaskStatus.DONE) {
      if (!isCreator && !isAdmin) {
        throw new ForbiddenException(
          'Only the task requester (Creator) or an Administrator can mark this task as DONE (Accepted).',
        );
      }
    }

    // 2. Rule: Setting to NEEDS_REVISION requires Creator or Admin + Mandatory Comment
    else if (targetStatus === TaskStatus.NEEDS_REVISION) {
      if (!isCreator && !isAdmin) {
        throw new ForbiddenException(
          'Only the task requester (Creator) or an Administrator can push a task back to NEEDS_REVISION.',
        );
      }
      if (!dto.comment || !dto.comment.trim()) {
        throw new BadRequestException(
          'A mandatory explanation comment is required when pushing a task back to NEEDS_REVISION.',
        );
      }
    }

    // 3. Rule: Setting to WAITING_FOR_CLIENT requires Target Team Leader, Creator, or Admin
    else if (targetStatus === TaskStatus.WAITING_FOR_CLIENT) {
      if (!isTargetTeamLeader && !isCreator && !isAdmin) {
        throw new ForbiddenException(
          'Only the target department Team Leader or task Creator can place a task in WAITING_FOR_CLIENT status.',
        );
      }
    }

    // 4. Rule: Setting to TODO, IN_PROGRESS, REVIEW allowed for Assignee, Team Leader, Creator, or Admin
    else if ([TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.REVIEW].includes(targetStatus)) {
      if (!isAssignee && !isTargetTeamLeader && !isCreator && !isAdmin) {
        throw new ForbiddenException('You do not have permission to transition the status of this task.');
      }
    }

    // Execute state update & auto-post comment if provided
    const updatedTask = await this.prisma.$transaction(async (tx) => {
      if (dto.comment && dto.comment.trim() && actorEmployee) {
        await tx.taskComment.create({
          data: {
            taskId: task.id,
            authorId: actorEmployee.id,
            content: dto.comment.trim(),
            attachmentUrls: dto.attachmentUrls || [],
          },
        });
      }

      return tx.task.update({
        where: { id },
        data: {
          status: targetStatus,
          ...(dto.order !== undefined && { order: dto.order }),
        },
        include: {
          creator: { select: { id: true, fullName: true, employeeCode: true, userId: true } },
          assignee: { select: { id: true, fullName: true, employeeCode: true, userId: true } },
          targetDepartment: { select: { id: true, name: true, code: true } },
          comments: {
            include: { author: { select: { id: true, fullName: true, employeeCode: true, avatarUrl: true } } },
            orderBy: { createdAt: 'asc' },
          },
        },
      });
    });

    this.eventsGateway.broadcastTaskStatusChanged(
      updatedTask,
      task.status,
      targetStatus,
      { id: user.id, name: actorEmployee?.fullName || user.email },
      dto.comment,
    );

    return updatedTask;
  }

  // ---------------------------------------------------------------------------
  // UPDATE TASK DETAILS & ALLOCATION (LEADER & CREATOR CONTROLS)
  // ---------------------------------------------------------------------------

  async updateTask(id: string, dto: UpdateTaskDto, user: AuthenticatedUser) {
    const task = await this.getTaskById(id);
    const actorEmployee = await this.getEmployeeProfile(user.id);

    const isAdmin = ['SUPER_ADMIN', 'HR_MANAGER'].includes(user.role);
    const isCreator = task.creator?.userId === user.id;
    const isLeader = user.role === 'TEAM_LEADER' || user.permissions.includes('org.manage');

    // Team Leader of Target Department
    const isTargetTeamLeader =
      actorEmployee &&
      task.targetDepartmentId &&
      actorEmployee.departmentId === task.targetDepartmentId &&
      isLeader;

    // Check if user is setting or modifying the assigneeId
    if (dto.assigneeId !== undefined && dto.assigneeId !== task.assigneeId) {
      if (!isTargetTeamLeader && !isAdmin) {
        throw new ForbiddenException(
          'Only Team Leaders of the target department or Administrators can assign or reassign tasks.',
        );
      }
    }

    // Check if user is editing other task core details
    const isEditingCoreDetails =
      dto.title !== undefined ||
      dto.description !== undefined ||
      dto.priority !== undefined ||
      dto.targetDepartmentId !== undefined ||
      dto.dueDate !== undefined ||
      dto.attachmentUrls !== undefined;

    if (isEditingCoreDetails) {
      if (!isCreator && !isAdmin) {
        throw new ForbiddenException(
          'Only the task Creator or an Administrator has permission to edit core task specifications.',
        );
      }
    }

    if (dto.assigneeId) {
      const assigneeExists = await this.prisma.employeeProfile.findUnique({
        where: { id: dto.assigneeId },
      });
      if (!assigneeExists) {
        throw new BadRequestException(`Assignee employee '${dto.assigneeId}' not found.`);
      }
    }

    const updatedTask = await this.prisma.task.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title.trim() }),
        ...(dto.description !== undefined && { description: dto.description?.trim() || null }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.priority !== undefined && { priority: dto.priority }),
        ...(dto.assignmentType !== undefined && { assignmentType: dto.assignmentType }),
        ...(dto.dueDate !== undefined && { dueDate: dto.dueDate ? new Date(dto.dueDate) : null }),
        ...(dto.order !== undefined && { order: dto.order }),
        ...(dto.targetDepartmentId !== undefined && { targetDepartmentId: dto.targetDepartmentId }),
        ...(dto.assigneeId !== undefined && { assigneeId: dto.assigneeId || null }),
        ...(dto.attachmentUrls !== undefined && { attachmentUrls: dto.attachmentUrls }),
      },
      include: {
        creator: { select: { id: true, fullName: true, employeeCode: true, userId: true } },
        assignee: { select: { id: true, fullName: true, employeeCode: true, avatarUrl: true, userId: true } },
        targetDepartment: { select: { id: true, name: true, code: true } },
        comments: {
          include: { author: { select: { id: true, fullName: true, employeeCode: true, avatarUrl: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    let newAssignee = dto.assigneeId
      ? await this.prisma.employeeProfile.findUnique({ where: { id: dto.assigneeId } })
      : undefined;

    this.eventsGateway.broadcastTaskUpdated(updatedTask, newAssignee);
    return updatedTask;
  }

  // ---------------------------------------------------------------------------
  // ADD COMMENT TO TASK
  // ---------------------------------------------------------------------------

  async addComment(taskId: string, dto: CreateTaskCommentDto, user: AuthenticatedUser) {
    const task = await this.getTaskById(taskId);
    const author = await this.getEmployeeProfile(user.id);
    if (!author) {
      throw new BadRequestException('Authenticated user must have an employee profile to post comments.');
    }

    const comment = await this.prisma.taskComment.create({
      data: {
        taskId: task.id,
        authorId: author.id,
        content: dto.content.trim(),
        attachmentUrls: dto.attachmentUrls || [],
      },
      include: {
        author: {
          select: { id: true, fullName: true, employeeCode: true, avatarUrl: true },
        },
      },
    });

    this.eventsGateway.broadcastTaskCommentAdded(taskId, comment, task);
    return comment;
  }

  // ---------------------------------------------------------------------------
  // DELETE TASK
  // ---------------------------------------------------------------------------

  async deleteTask(id: string, user: AuthenticatedUser) {
    const task = await this.getTaskById(id);

    const isAdmin = ['SUPER_ADMIN', 'HR_MANAGER'].includes(user.role);
    const isCreator = task.creator?.userId === user.id;

    if (!isCreator && !isAdmin) {
      throw new ForbiddenException('Only the task Creator or an Administrator can delete this task.');
    }

    // Rule: Creator can only delete the task if its status is still TODO.
    if (isCreator && !isAdmin && task.status !== TaskStatus.TODO) {
      throw new ForbiddenException(
        `Task creators can only delete tasks while they are still in 'TODO' status. Current status is '${task.status}'.`,
      );
    }

    const deleted = await this.prisma.task.delete({
      where: { id },
    });

    this.eventsGateway.broadcastTaskDeleted(id, task.title);
    return deleted;
  }
}
