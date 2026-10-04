import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  forwardRef,
  Inject,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ChatGateway } from './chat.gateway';
import { CreateGroupDto } from './dto/create-group.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { AddParticipantsDto } from './dto/add-participants.dto';
import { ConversationType, ParticipantRole, MessageType, Prisma } from '@prisma/client';

// Never `include: { user: true }` here: it exposes passwordHash and the full employee record.
const PARTICIPANT_INCLUDE = {
  user: { select: { id: true, email: true } },
  employee: {
    select: {
      id: true,
      fullName: true,
      avatarUrl: true,
      employeeCode: true,
      position: { select: { name: true } },
      department: { select: { name: true } },
    },
  },
} satisfies Prisma.ConversationParticipantInclude;

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => ChatGateway))
    private readonly chatGateway: ChatGateway,
  ) {}

  /**
   * Fetch all active conversations for the authenticated user
   */
  async getConversations(userId: string) {
    // Find all conversations where user is a participant OR public groups
    const conversations = await this.prisma.conversation.findMany({
      where: {
        OR: [
          {
            participants: {
              some: { userId },
            },
          },
          {
            type: ConversationType.PUBLIC_GROUP,
          },
        ],
      },
      include: {
        department: {
          select: { id: true, name: true, code: true },
        },
        participants: {
          include: {
            user: {
              select: { id: true, email: true, isActive: true },
            },
            employee: {
              select: {
                id: true,
                fullName: true,
                avatarUrl: true,
                employeeCode: true,
                position: { select: { name: true } },
                department: { select: { name: true } },
              },
            },
          },
        },
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          include: {
            senderEmployee: {
              select: { id: true, fullName: true },
            },
          },
        },
      },
      orderBy: [
        { lastMessageAt: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    // Format conversations with unread counts and counterpart metadata for DIRECT chats
    const formatted = await Promise.all(
      conversations.map(async (conv) => {
        const myParticipant = conv.participants.find((p) => p.userId === userId);
        const lastReadAt = myParticipant?.lastReadAt || new Date(0);

        // Count unread messages
        const unreadCount = await this.prisma.message.count({
          where: {
            conversationId: conv.id,
            createdAt: { gt: lastReadAt },
            senderId: { not: userId },
          },
        });

        // Determine title & avatar
        let displayTitle = conv.title;
        let displayAvatar = conv.avatarUrl;
        let counterpartEmployee: any = null;

        if (conv.type === ConversationType.DIRECT) {
          const counterpart = conv.participants.find((p) => p.userId !== userId);
          if (counterpart) {
            displayTitle = counterpart.employee?.fullName || counterpart.user.email;
            displayAvatar = counterpart.employee?.avatarUrl || null;
            counterpartEmployee = counterpart.employee;
          }
        }

        const lastMessage = conv.messages[0] || null;

        return {
          id: conv.id,
          title: displayTitle,
          description: conv.description,
          avatarUrl: displayAvatar,
          type: conv.type,
          isGroup: conv.isGroup,
          department: conv.department,
          creatorId: conv.creatorId,
          unreadCount,
          isParticipant: Boolean(myParticipant),
          role: myParticipant?.role || null,
          isMuted: myParticipant?.isMuted || false,
          counterpartEmployee,
          lastMessage: lastMessage
            ? {
                id: lastMessage.id,
                content: lastMessage.content,
                type: lastMessage.type,
                senderName: lastMessage.senderEmployee?.fullName || 'User',
                createdAt: lastMessage.createdAt,
              }
            : null,
          lastMessageAt: conv.lastMessageAt || conv.createdAt,
          participantsCount: conv.participants.length,
          createdAt: conv.createdAt,
        };
      }),
    );

    return formatted;
  }

  /**
   * Get single conversation details with full participants list
   */
  async getConversationById(conversationId: string, userId: string) {
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        department: { select: { id: true, name: true, code: true } },
        participants: { include: PARTICIPANT_INCLUDE },
      },
    });

    if (!conv) {
      throw new NotFoundException('المحادثة غير موجودة');
    }

    const isParticipant = conv.participants.some((p) => p.userId === userId);
    if (!isParticipant && conv.type !== ConversationType.PUBLIC_GROUP) {
      throw new ForbiddenException('ليس لديك صلاحية الوصول إلى هذه المحادثة');
    }

    return conv;
  }

  /**
   * Whether the user may receive a conversation's real-time events: participants, or anyone for public groups
   */
  async canAccessConversation(conversationId: string, userId: string): Promise<boolean> {
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: {
        type: true,
        participants: { where: { userId }, select: { id: true } },
      },
    });

    if (!conv) return false;
    return conv.participants.length > 0 || conv.type === ConversationType.PUBLIC_GROUP;
  }

  /**
   * Fetch paginated messages history for a conversation
   */
  async getMessages(conversationId: string, userId: string, page = 1, limit = 20) {
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { participants: true },
    });

    if (!conv) {
      throw new NotFoundException('المحادثة غير موجودة');
    }

    let participant = conv.participants.find((p) => p.userId === userId);

    // If it's a PUBLIC_GROUP and user isn't participant yet, automatically join them
    if (!participant && conv.type === ConversationType.PUBLIC_GROUP) {
      const userProfile = await this.prisma.employeeProfile.findUnique({
        where: { userId },
      });
      participant = await this.prisma.conversationParticipant.create({
        data: {
          conversationId,
          userId,
          employeeId: userProfile?.id || null,
          role: ParticipantRole.MEMBER,
        },
      });
    } else if (!participant) {
      throw new ForbiddenException('ليس لديك صلاحية للوصول إلى رسائل هذه المحادثة');
    }

    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      this.prisma.message.findMany({
        where: { conversationId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' }, // Latest first for pagination
        include: {
          sender: {
            select: { id: true, email: true },
          },
          senderEmployee: {
            select: {
              id: true,
              fullName: true,
              avatarUrl: true,
              employeeCode: true,
            },
          },
          replyTo: {
            select: {
              id: true,
              content: true,
              type: true,
              attachmentUrls: true,
              senderEmployee: {
                select: { id: true, fullName: true },
              },
            },
          },
          readReceipts: {
            select: { userId: true, readAt: true },
          },
        },
      }),
      this.prisma.message.count({ where: { conversationId } }),
    ]);

    // Automatically mark as read when fetching messages
    await this.markAsRead(conversationId, userId);

    return {
      messages: messages.reverse(), // Chronological order for chat display
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get or Create 1-to-1 Direct Conversation
   */
  async getOrCreateDirectConversation(userId: string, targetUserId: string) {
    if (userId === targetUserId) {
      throw new BadRequestException('لا يمكنك بدء محادثة مباشرة مع نفسك');
    }

    const targetUser = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      include: { employeeProfile: true },
    });

    if (!targetUser) {
      throw new NotFoundException('المستخدم المستهدف غير موجود');
    }

    const currentUser = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { employeeProfile: true },
    });

    // Check if direct conversation already exists between both users
    const existing = await this.prisma.conversation.findFirst({
      where: {
        type: ConversationType.DIRECT,
        isGroup: false,
        AND: [
          { participants: { some: { userId } } },
          { participants: { some: { userId: targetUserId } } },
        ],
      },
      include: {
        participants: { include: PARTICIPANT_INCLUDE },
      },
    });

    if (existing) {
      return existing;
    }

    // Create new direct conversation
    const newConv = await this.prisma.conversation.create({
      data: {
        type: ConversationType.DIRECT,
        isGroup: false,
        creatorId: userId,
        lastMessageAt: new Date(),
        participants: {
          create: [
            {
              userId,
              employeeId: currentUser?.employeeProfile?.id || null,
              role: ParticipantRole.MEMBER,
            },
            {
              userId: targetUserId,
              employeeId: targetUser?.employeeProfile?.id || null,
              role: ParticipantRole.MEMBER,
            },
          ],
        },
      },
      include: {
        participants: { include: PARTICIPANT_INCLUDE },
      },
    });

    this.chatGateway.broadcastNewConversation(newConv, [userId, targetUserId]);
    return newConv;
  }

  /**
   * Create Work Group or Public Group Channel
   */
  async createGroup(userId: string, dto: CreateGroupDto) {
    const creator = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { employeeProfile: true },
    });


    // Deduplicate and filter participant user IDs
    const uniqueUserIds = Array.from(
      new Set((dto.participantUserIds || []).filter((id) => id !== userId)),
    );

    // Resolve employee profiles for participants (matching either User.id or EmployeeProfile.id)
    const participantsProfiles = await this.prisma.user.findMany({
      where: {
        OR: [
          { id: { in: uniqueUserIds } },
          { employeeProfile: { id: { in: uniqueUserIds } } },
        ],
        AND: [
          { id: { not: userId } },
        ],
      },
      include: { employeeProfile: true },
    });

    const participantsData = [
      {
        userId,
        employeeId: creator?.employeeProfile?.id || null,
        role: ParticipantRole.ADMIN,
      },
      ...participantsProfiles.map((p) => ({
        userId: p.id,
        employeeId: p.employeeProfile?.id || null,
        role: ParticipantRole.MEMBER,
      })),
    ];

    const group = await this.prisma.conversation.create({
      data: {
        title: dto.title,
        description: dto.description || null,
        avatarUrl: dto.avatarUrl || null,
        type: dto.type,
        isGroup: true,
        departmentId: dto.departmentId || null,
        creatorId: userId,
        lastMessageAt: new Date(),
        participants: {
          create: participantsData,
        },
        messages: {
          create: {
            senderId: userId,
            senderEmployeeId: creator?.employeeProfile?.id || null,
            content: `قام ${creator?.employeeProfile?.fullName || creator?.email} بإنشاء المجموعة "${dto.title}"`,
            type: MessageType.SYSTEM,
          },
        },
      },
      include: {
        department: { select: { id: true, name: true, code: true } },
        participants: { include: PARTICIPANT_INCLUDE },
      },
    });

    const allParticipantUserIds = participantsData.map((p) => p.userId);
    this.chatGateway.broadcastNewConversation(group, allParticipantUserIds);

    return group;
  }

  /**
   * Send a message to a conversation
   */
  async sendMessage(userId: string, dto: SendMessageDto) {
    const conv = await this.prisma.conversation.findUnique({
      where: { id: dto.conversationId },
      include: { participants: true },
    });

    if (!conv) {
      throw new NotFoundException('المحادثة غير موجودة');
    }

    let participant = conv.participants.find((p) => p.userId === userId);

    // Auto-join public group if not participant
    if (!participant && conv.type === ConversationType.PUBLIC_GROUP) {
      const userProfile = await this.prisma.employeeProfile.findUnique({
        where: { userId },
      });
      participant = await this.prisma.conversationParticipant.create({
        data: {
          conversationId: dto.conversationId,
          userId,
          employeeId: userProfile?.id || null,
          role: ParticipantRole.MEMBER,
        },
      });
    } else if (!participant) {
      throw new ForbiddenException('ليس لديك صلاحية الإرسال في هذه المحادثة');
    }

    const senderProfile = await this.prisma.employeeProfile.findUnique({
      where: { userId },
    });

    const now = new Date();

    const content = (dto.content || '').trim();
    const attachments = dto.attachmentUrls || [];

    if (!content && attachments.length === 0) {
      throw new BadRequestException('محتوى الرسالة أو الصور المرفقة مطلوبة للإرسال');
    }

    if (dto.replyToId) {
      const replyTarget = await this.prisma.message.findUnique({
        where: { id: dto.replyToId },
        select: { conversationId: true },
      });
      if (!replyTarget || replyTarget.conversationId !== dto.conversationId) {
        throw new BadRequestException('الرسالة المقتبسة غير موجودة في هذه المحادثة');
      }
    }

    const messageType =
      dto.type || (attachments.length > 0 ? MessageType.IMAGE : MessageType.TEXT);

    // Create message in database
    const message = await this.prisma.message.create({
      data: {
        conversationId: dto.conversationId,
        senderId: userId,
        senderEmployeeId: senderProfile?.id || null,
        content: content,
        type: messageType,
        attachmentUrls: attachments,
        replyToId: dto.replyToId || null,
        reactions: [],
      },
      include: {
        sender: { select: { id: true, email: true } },
        senderEmployee: {
          select: {
            id: true,
            fullName: true,
            avatarUrl: true,
            employeeCode: true,
          },
        },
        replyTo: {
          select: {
            id: true,
            content: true,
            type: true,
            attachmentUrls: true,
            senderEmployee: {
              select: { id: true, fullName: true },
            },
          },
        },
        readReceipts: true,
      },
    });

    // Update conversation lastMessageAt & sender's lastReadAt in parallel
    await Promise.all([
      this.prisma.conversation.update({
        where: { id: dto.conversationId },
        data: { lastMessageAt: now },
      }),
      this.prisma.conversationParticipant.update({
        where: {
          conversationId_userId: {
            conversationId: dto.conversationId,
            userId,
          },
        },
        data: { lastReadAt: now },
      }),
    ]);

    // Broadcast real-time message via WebSockets
    const allParticipantUserIds = conv.participants.map((p) => p.userId);
    this.chatGateway.broadcastNewMessage(dto.conversationId, message, allParticipantUserIds);

    return message;
  }

  /**
   * Toggle a reaction emoji on a message
   */
  async toggleReaction(messageId: string, userId: string, emoji: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: {
        conversation: {
          select: {
            id: true,
            type: true,
            participants: { where: { userId }, select: { id: true } },
          },
        },
      },
    });

    if (!message) {
      throw new NotFoundException('الرسالة غير موجودة');
    }

    const isParticipant = message.conversation.participants.length > 0;
    if (!isParticipant && message.conversation.type !== ConversationType.PUBLIC_GROUP) {
      throw new ForbiddenException('ليس لديك صلاحية التفاعل مع رسائل هذه المحادثة');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { employeeProfile: true },
    });

    const userName = user?.employeeProfile?.fullName || user?.email || 'User';

    let currentReactions: Array<{ emoji: string; userId: string; userName: string }> = [];
    if (Array.isArray(message.reactions)) {
      currentReactions = message.reactions as any;
    }

    const existingIndex = currentReactions.findIndex(
      (r) => r.userId === userId && r.emoji === emoji,
    );

    if (existingIndex > -1) {
      // Remove reaction (toggle off)
      currentReactions.splice(existingIndex, 1);
    } else {
      // Add reaction (toggle on)
      currentReactions.push({ emoji, userId, userName });
    }

    await this.prisma.message.update({
      where: { id: messageId },
      data: { reactions: currentReactions },
    });

    // Broadcast reaction update via WebSockets
    this.chatGateway.broadcastReactionUpdated(
      message.conversationId,
      messageId,
      currentReactions,
    );

    return { messageId, reactions: currentReactions };
  }

  /**
   * Edit message content
   */
  async editMessage(messageId: string, userId: string, content: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      throw new NotFoundException('الرسالة غير موجودة');
    }

    if (message.senderId !== userId) {
      throw new ForbiddenException('لا يمكنك تعديل رسالة مستخدم آخر');
    }

    if (message.isDeleted) {
      throw new BadRequestException('لا يمكن تعديل رسالة محذوفة');
    }

    const updated = await this.prisma.message.update({
      where: { id: messageId },
      data: {
        content: content.trim(),
        isEdited: true,
      },
      include: {
        sender: { select: { id: true, email: true } },
        senderEmployee: {
          select: {
            id: true,
            fullName: true,
            avatarUrl: true,
            employeeCode: true,
          },
        },
        replyTo: {
          select: {
            id: true,
            content: true,
            type: true,
            attachmentUrls: true,
            senderEmployee: { select: { id: true, fullName: true } },
          },
        },
        readReceipts: { select: { userId: true, readAt: true } },
      },
    });

    this.chatGateway.broadcastMessageEdited(updated.conversationId, updated);
    return updated;
  }

  /**
   * Soft-delete a message (Preserved in database, marked isDeleted: true for users)
   */
  async deleteMessage(messageId: string, userId: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: {
        conversation: {
          include: {
            participants: true,
          },
        },
      },
    });

    if (!message) {
      throw new NotFoundException('الرسالة غير موجودة');
    }

    const isSender = message.senderId === userId;
    const participant = message.conversation.participants.find((p) => p.userId === userId);
    const isGroupAdmin = participant?.role === ParticipantRole.ADMIN;

    if (!isSender && !isGroupAdmin) {
      throw new ForbiddenException('ليس لديك صلاحية لحذف هذه الرسالة');
    }

    await this.prisma.message.update({
      where: { id: messageId },
      data: {
        isDeleted: true,
      },
    });

    this.chatGateway.broadcastMessageDeleted(message.conversationId, messageId);
    return { success: true, messageId };
  }

  /**
   * Mark all messages in a conversation as read for the user
   */
  async markAsRead(conversationId: string, userId: string) {
    const now = new Date();

    try {
      await this.prisma.conversationParticipant.update({
        where: {
          conversationId_userId: { conversationId, userId },
        },
        data: { lastReadAt: now },
      });

      this.chatGateway.broadcastMessagesRead(conversationId, userId, now);
      return { success: true, lastReadAt: now };
    } catch {
      // Ignore if not a participant
      return { success: false };
    }
  }

  /**
   * Add members to a Work Group
   */
  async addParticipants(conversationId: string, userId: string, dto: AddParticipantsDto) {
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { participants: true },
    });

    if (!conv) {
      throw new NotFoundException('المجموعة غير موجودة');
    }

    if (!conv.isGroup) {
      throw new BadRequestException('لا يمكن إضافة أعضاء لمحادثة فردية');
    }

    const currentParticipant = conv.participants.find((p) => p.userId === userId);
    if (!currentParticipant) {
      throw new ForbiddenException('أنت لست عضواً في هذه المجموعة');
    }

    // Filter out users already in the group
    const existingUserIds = new Set(conv.participants.map((p) => p.userId));

    const usersToAdd = await this.prisma.user.findMany({
      where: {
        OR: [
          { id: { in: dto.userIds } },
          { employeeProfile: { id: { in: dto.userIds } } },
        ],
        AND: [
          { id: { notIn: Array.from(existingUserIds) } },
        ],
      },
      include: { employeeProfile: true },
    });

    if (usersToAdd.length === 0) {
      return { message: 'جميع المستخدمين المحددين موجودون بالفعل في المجموعة' };
    }

    const now = new Date();

    await this.prisma.$transaction([
      this.prisma.conversationParticipant.createMany({
        data: usersToAdd.map((u) => ({
          conversationId,
          userId: u.id,
          employeeId: u.employeeProfile?.id || null,
          role: ParticipantRole.MEMBER,
        })),
      }),
      this.prisma.message.create({
        data: {
          conversationId,
          senderId: userId,
          content: `تمت إضافة ${usersToAdd.length} عضو جديد إلى المجموعة`,
          type: MessageType.SYSTEM,
        },
      }),
      this.prisma.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: now },
      }),
    ]);

    const updated = await this.getConversationById(conversationId, userId);
    const allUserIds = updated.participants.map((p) => p.userId);
    this.chatGateway.broadcastNewConversation(updated, allUserIds);

    return updated;
  }
}
