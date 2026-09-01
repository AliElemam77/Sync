import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger, Injectable, forwardRef, Inject } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/send-message.dto';

@Injectable()
@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => ChatService))
    private readonly chatService: ChatService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      let token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '') ||
        client.handshake.query?.token;

      if (!token || typeof token !== 'string') {
        return;
      }

      if (token.startsWith('Bearer ')) {
        token = token.slice(7).trim();
      }

      const secret = process.env.JWT_SECRET || 'sync-jwt-secret-key-enterprise-2026-production';
      const payload = this.jwtService.verify(token, { secret });
      if (!payload || !payload.sub) {
        return;
      }

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        include: {
          employeeProfile: {
            select: { id: true, fullName: true, avatarUrl: true, departmentId: true },
          },
          role: true,
        },
      });

      if (!user || !user.isActive) {
        return;
      }

      client.data.user = {
        userId: user.id,
        email: user.email,
        role: user.role.name,
        employeeId: user.employeeProfile?.id,
        fullName: user.employeeProfile?.fullName || user.email,
        avatarUrl: user.employeeProfile?.avatarUrl,
        departmentId: user.employeeProfile?.departmentId,
      };

      // Auto-join personal user room for direct alerts and new group additions
      client.join('global');
      client.join(`user:${user.id}`);
      if (user.employeeProfile?.id) {
        client.join(`employee:${user.employeeProfile.id}`);
      }

      this.logger.log(`Chat Socket Authenticated: ${user.email} (${client.id})`);
    } catch (err: any) {
      this.logger.debug(`Chat socket auth failed or unauthenticated: ${err.message}`);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Chat Socket Disconnected: ${client.id}`);
  }

  @SubscribeMessage('chat:join_room')
  handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId: string },
  ) {
    if (payload?.conversationId) {
      const room = `conversation:${payload.conversationId}`;
      client.join(room);
      this.logger.debug(`User ${client.data.user?.email || client.id} joined room ${room}`);
    }
  }

  @SubscribeMessage('chat:leave_room')
  handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId: string },
  ) {
    if (payload?.conversationId) {
      const room = `conversation:${payload.conversationId}`;
      client.leave(room);
      this.logger.debug(`User ${client.data.user?.email || client.id} left room ${room}`);
    }
  }

  @SubscribeMessage('chat:send_message')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: SendMessageDto,
  ) {
    const userId = client.data.user?.userId;
    if (!userId) {
      return { status: 'error', message: 'Unauthorized' };
    }

    try {
      const message = await this.chatService.sendMessage(userId, dto);
      return { status: 'ok', data: message };
    } catch (err: any) {
      return { status: 'error', message: err.message };
    }
  }

  @SubscribeMessage('chat:toggle_reaction')
  async handleToggleReaction(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { messageId: string; emoji: string },
  ) {
    const userId = client.data.user?.userId;
    if (!userId || !payload?.messageId || !payload?.emoji) {
      return { status: 'error', message: 'Invalid payload' };
    }

    try {
      const result = await this.chatService.toggleReaction(payload.messageId, userId, payload.emoji);
      return { status: 'ok', data: result };
    } catch (err: any) {
      return { status: 'error', message: err.message };
    }
  }

  @SubscribeMessage('chat:typing')
  handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId: string; isTyping: boolean },
  ) {
    if (payload?.conversationId && client.data.user) {
      client.to(`conversation:${payload.conversationId}`).emit('chat:user_typing', {
        conversationId: payload.conversationId,
        userId: client.data.user.userId,
        employeeId: client.data.user.employeeId,
        fullName: client.data.user.fullName,
        isTyping: payload.isTyping,
      });
    }
  }

  @SubscribeMessage('chat:mark_as_read')
  async handleMarkAsRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId: string },
  ) {
    const userId = client.data.user?.userId;
    if (!userId || !payload?.conversationId) return;

    try {
      await this.chatService.markAsRead(payload.conversationId, userId);
    } catch (err: any) {
      this.logger.error(`Error marking as read: ${err.message}`);
    }
  }

  // ---------------------------------------------------------------------------
  // EMISSION HELPERS (Called from ChatService)
  // ---------------------------------------------------------------------------

  /**
   * Broadcast newly created message to conversation room and notify offline/external participants
   */
  broadcastNewMessage(conversationId: string, message: any, participantUserIds: string[]) {
    // 1. Broadcast to active room members
    this.server.to(`conversation:${conversationId}`).emit('chat:receive_message', message);

    // 2. Broadcast conversation updated event (snippet & badge) to all participants
    for (const userId of participantUserIds) {
      this.server.to(`user:${userId}`).emit('chat:conversation_updated', {
        conversationId,
        lastMessage: message,
      });
    }
    this.server.emit('chat:global_ping', { conversationId });
  }

  /**
   * Broadcast reaction updated event to room
   */
  broadcastReactionUpdated(conversationId: string, messageId: string, reactions: any[]) {
    this.server.to(`conversation:${conversationId}`).emit('chat:reaction_updated', {
      conversationId,
      messageId,
      reactions,
    });
  }

  /**
   * Broadcast read receipt status to room
   */
  broadcastMessagesRead(conversationId: string, userId: string, readAt: Date) {
    this.server.to(`conversation:${conversationId}`).emit('chat:messages_read', {
      conversationId,
      userId,
      readAt: readAt.toISOString(),
    });
  }

  /**
   * Broadcast when a new conversation or group is created
   */
  broadcastNewConversation(conversation: any, participantUserIds: string[]) {
    // Broadcast to targeted user rooms
    for (const userId of participantUserIds) {
      this.server.to(`user:${userId}`).emit('chat:new_conversation', conversation);
    }
    // Also broadcast to global channel for immediate UI refresh
    this.server.emit('chat:new_conversation', conversation);
  }
}
