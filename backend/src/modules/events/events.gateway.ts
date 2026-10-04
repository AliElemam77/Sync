import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger, Injectable } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { wsCorsOptions } from '../../common/config/ws-cors';

export interface InAppNotification {
  id: string;
  type: 'TASK_ASSIGNED' | 'STATUS_CHANGED' | 'NEW_COMMENT' | 'NEEDS_REVISION' | 'TASK_DONE' | 'NEW_TASK';
  title: string;
  message: string;
  taskId?: string;
  createdAt: string;
  read: boolean;
  actor?: {
    name: string;
    avatarUrl?: string;
  };
}

@Injectable()
@WebSocketGateway({ cors: wsCorsOptions })
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(EventsGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      let token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '') ||
        client.handshake.query?.token;

      if (!token || typeof token !== 'string') {
        this.logger.warn(`Client connection rejected: No token provided (${client.id})`);
        client.disconnect();
        return;
      }

      if (token.startsWith('Bearer ')) {
        token = token.slice(7).trim();
      }

      const payload = this.jwtService.verify(token);
      if (!payload || !payload.sub) {
        client.disconnect();
        return;
      }

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        include: {
          employeeProfile: {
            select: { id: true, fullName: true, departmentId: true },
          },
          role: true,
        },
      });

      if (!user || !user.isActive) {
        client.disconnect();
        return;
      }

      // Store authenticated session data on socket
      client.data.user = {
        userId: user.id,
        email: user.email,
        role: user.role.name,
        employeeId: user.employeeProfile?.id,
        departmentId: user.employeeProfile?.departmentId,
        fullName: user.employeeProfile?.fullName || user.email,
      };

      // Join standard rooms
      client.join('global');
      client.join(`user:${user.id}`);
      if (user.employeeProfile?.id) {
        client.join(`employee:${user.employeeProfile.id}`);
      }
      if (user.employeeProfile?.departmentId) {
        client.join(`dept:${user.employeeProfile.departmentId}`);
      }

      this.logger.log(
        `Socket Connected: ${user.email} (${client.id}) [Dept: ${user.employeeProfile?.departmentId || 'None'}]`,
      );
    } catch (err: any) {
      this.logger.error(`Socket connection authentication error: ${err.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Socket Disconnected: ${client.id}`);
  }

  // ---------------------------------------------------------------------------
  // EMISSION METHODS (CALLED FROM SERVICES)
  // ---------------------------------------------------------------------------

  /**
   * Broadcast Task Created Event & Send Notification to Target Dept / Assignee
   */
  broadcastTaskCreated(task: any) {
    // Global task events carry identifiers only; clients refetch through the scoped REST API
    this.server.to('global').emit('task:created', { id: task.id });

    const notification: InAppNotification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      type: 'NEW_TASK',
      title: 'New Task Created',
      message: `${task.creator?.fullName || 'Someone'} created task: "${task.title}"`,
      taskId: task.id,
      createdAt: new Date().toISOString(),
      read: false,
      actor: {
        name: task.creator?.fullName || 'System',
        avatarUrl: task.creator?.avatarUrl,
      },
    };

    if (task.assignee?.userId) {
      this.sendNotification(task.assignee.userId, {
        ...notification,
        type: 'TASK_ASSIGNED',
        title: 'New Task Assigned to You',
        message: `${task.creator?.fullName || 'Someone'} assigned task "${task.title}" to you.`,
      });
    } else if (task.targetDepartmentId) {
      // Notify team leader room of target department
      this.server.to(`dept:${task.targetDepartmentId}`).emit('notification:new', {
        ...notification,
        title: 'New Department Backlog Task',
        message: `Task "${task.title}" was routed to your department.`,
      });
    }
  }

  /**
   * Broadcast Task Details Updated (Assignee, Priority, Due Date)
   */
  broadcastTaskUpdated(task: any, newAssigneeEmployee?: any) {
    this.server.to('global').emit('task:updated', { id: task.id });

    if (newAssigneeEmployee?.userId) {
      this.sendNotification(newAssigneeEmployee.userId, {
        id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        type: 'TASK_ASSIGNED',
        title: 'Task Assigned to You',
        message: `You have been assigned to task "${task.title}"`,
        taskId: task.id,
        createdAt: new Date().toISOString(),
        read: false,
      });
    }
  }

  /**
   * Broadcast Task Status Transition & Notify Relevant Roles
   */
  broadcastTaskStatusChanged(
    task: any,
    oldStatus: string,
    newStatus: string,
    actor: { id?: string; name: string; avatarUrl?: string },
    comment?: string,
  ) {
    this.server.to('global').emit('task:status_changed', {
      taskId: task.id,
      oldStatus,
      newStatus,
    });

    const notifBase: InAppNotification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      type: 'STATUS_CHANGED',
      title: `Task Status: ${newStatus.replace(/_/g, ' ')}`,
      message: `${actor.name} moved "${task.title}" to ${newStatus.replace(/_/g, ' ')}`,
      taskId: task.id,
      createdAt: new Date().toISOString(),
      read: false,
      actor: {
        name: actor.name,
        avatarUrl: actor.avatarUrl,
      },
    };

    // 1. If submitted to REVIEW -> Notify Creator
    if (newStatus === 'REVIEW' && task.creator?.userId) {
      this.sendNotification(task.creator.userId, {
        ...notifBase,
        type: 'STATUS_CHANGED',
        title: 'Task Ready for Review',
        message: `${actor.name} submitted "${task.title}" for your approval/review.`,
      });
    }

    // 2. If rejected with NEEDS_REVISION -> Notify Assignee
    else if (newStatus === 'NEEDS_REVISION' && task.assignee?.userId) {
      this.sendNotification(task.assignee.userId, {
        ...notifBase,
        type: 'NEEDS_REVISION',
        title: 'Task Needs Revision',
        message: `${actor.name} requested changes on "${task.title}": "${comment || 'Please check feedback'}"`,
      });
    }

    // 3. If accepted as DONE -> Notify Assignee
    else if (newStatus === 'DONE' && task.assignee?.userId) {
      this.sendNotification(task.assignee.userId, {
        ...notifBase,
        type: 'TASK_DONE',
        title: 'Task Approved & Completed',
        message: `${actor.name} approved task "${task.title}". Great job!`,
      });
    }

    // 4. If placed in WAITING_FOR_CLIENT -> Notify Assignee & Creator
    else if (newStatus === 'WAITING_FOR_CLIENT') {
      if (task.assignee?.userId) {
        this.sendNotification(task.assignee.userId, notifBase);
      }
      if (task.creator?.userId) {
        this.sendNotification(task.creator.userId, notifBase);
      }
    }
  }

  /**
   * Broadcast New Discussion Comment & Notify Participants
   */
  broadcastTaskCommentAdded(taskId: string, comment: any, task: any) {
    this.server.to('global').emit('task:comment_added', { taskId });

    const authorName = comment.author?.fullName || 'Someone';

    const notif: InAppNotification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      type: 'NEW_COMMENT',
      title: 'New Comment on Task',
      message: `${authorName}: "${comment.content?.slice(0, 70)}${comment.content?.length > 70 ? '...' : ''}"`,
      taskId,
      createdAt: new Date().toISOString(),
      read: false,
      actor: {
        name: authorName,
        avatarUrl: comment.author?.avatarUrl,
      },
    };

    // Notify assignee if not comment author
    if (task.assignee?.userId && task.assignee.userId !== comment.author?.id) {
      this.sendNotification(task.assignee.userId, notif);
    }

    // Notify creator if not comment author
    if (task.creator?.userId && task.creator.userId !== comment.author?.id) {
      this.sendNotification(task.creator.userId, notif);
    }
  }

  /**
   * Broadcast Task Deleted
   */
  broadcastTaskDeleted(taskId: string) {
    this.server.to('global').emit('task:deleted', { taskId });
  }

  /**
   * Send Dedicated Notification to Single User
   */
  sendNotification(userId: string, notification: InAppNotification) {
    this.server.to(`user:${userId}`).emit('notification:new', notification);
  }
}
