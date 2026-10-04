import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConversationType } from '@prisma/client';
import { ChatService } from './chat.service';

describe('ChatService authorization', () => {
  let prisma: any;
  let gateway: Record<string, jest.Mock>;
  let service: ChatService;

  beforeEach(() => {
    prisma = {
      conversation: { findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
      conversationParticipant: { update: jest.fn() },
      employeeProfile: { findUnique: jest.fn() },
      message: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), groupBy: jest.fn() },
      user: { findUnique: jest.fn() },
    };
    gateway = {
      broadcastNewMessage: jest.fn(),
      broadcastReactionUpdated: jest.fn(),
    };
    service = new ChatService(prisma, gateway as any);
  });

  describe('getConversations', () => {
    const lastReadAt = new Date('2026-09-01T10:00:00Z');

    beforeEach(() => {
      prisma.conversation.findMany.mockResolvedValue([
        {
          id: 'conv-dm',
          type: ConversationType.DIRECT,
          title: null,
          avatarUrl: null,
          participants: [
            { userId: 'user-1', lastReadAt, role: 'MEMBER', isMuted: false, user: { email: 'me@x' }, employee: null },
            {
              userId: 'user-2',
              lastReadAt: null,
              user: { email: 'them@x' },
              employee: { fullName: 'Sara Ali', avatarUrl: 'https://img/sara.png' },
            },
          ],
          _count: { participants: 2 },
          messages: [],
          createdAt: new Date('2026-08-01'),
        },
        {
          id: 'conv-public',
          type: ConversationType.PUBLIC_GROUP,
          title: 'Announcements',
          avatarUrl: null,
          participants: [],
          _count: { participants: 40 },
          messages: [],
          createdAt: new Date('2026-08-01'),
        },
      ]);
      prisma.message.groupBy.mockResolvedValue([{ conversationId: 'conv-dm', _count: { _all: 3 } }]);
    });

    it('counts unread messages for all conversations in a single grouped query', async () => {
      const result = await service.getConversations('user-1');

      expect(prisma.message.groupBy).toHaveBeenCalledTimes(1);
      const { where } = prisma.message.groupBy.mock.calls[0][0];
      expect(where.senderId).toEqual({ not: 'user-1' });
      expect(where.OR).toEqual([
        { conversationId: 'conv-dm', createdAt: { gt: lastReadAt } },
        // not a participant yet: everything counts as unread
        { conversationId: 'conv-public', createdAt: { gt: new Date(0) } },
      ]);

      expect(result.map((c) => c.unreadCount)).toEqual([3, 0]);
    });

    it('keeps the response shape: counterpart title, participant count, membership', async () => {
      const [dm, publicGroup] = await service.getConversations('user-1');

      expect(dm).toEqual(
        expect.objectContaining({
          title: 'Sara Ali',
          avatarUrl: 'https://img/sara.png',
          participantsCount: 2,
          isParticipant: true,
        }),
      );
      expect(publicGroup).toEqual(
        expect.objectContaining({ title: 'Announcements', participantsCount: 40, isParticipant: false }),
      );
    });
  });

  describe('canAccessConversation', () => {
    it('allows participants and anyone for public groups', async () => {
      prisma.conversation.findUnique.mockResolvedValue({
        type: ConversationType.DIRECT,
        participants: [{ id: 'p-1' }],
      });
      await expect(service.canAccessConversation('conv-1', 'user-1')).resolves.toBe(true);

      prisma.conversation.findUnique.mockResolvedValue({
        type: ConversationType.PUBLIC_GROUP,
        participants: [],
      });
      await expect(service.canAccessConversation('conv-1', 'user-1')).resolves.toBe(true);
    });

    it('denies non-participants of private conversations and unknown ids', async () => {
      prisma.conversation.findUnique.mockResolvedValue({
        type: ConversationType.WORK_GROUP,
        participants: [],
      });
      await expect(service.canAccessConversation('conv-1', 'user-1')).resolves.toBe(false);

      prisma.conversation.findUnique.mockResolvedValue(null);
      await expect(service.canAccessConversation('missing', 'user-1')).resolves.toBe(false);
    });
  });

  it('forbids reacting to messages in conversations the user is not part of', async () => {
    prisma.message.findUnique.mockResolvedValue({
      id: 'msg-1',
      conversationId: 'conv-1',
      reactions: [],
      conversation: { id: 'conv-1', type: ConversationType.DIRECT, participants: [] },
    });

    await expect(service.toggleReaction('msg-1', 'user-1', '👍')).rejects.toThrow(
      ForbiddenException,
    );
    expect(prisma.message.update).not.toHaveBeenCalled();
  });

  it('rejects replies that quote a message from another conversation', async () => {
    prisma.conversation.findUnique.mockResolvedValue({
      id: 'conv-1',
      type: ConversationType.DIRECT,
      participants: [{ userId: 'user-1' }],
    });
    prisma.message.findUnique.mockResolvedValue({ conversationId: 'conv-other' });

    await expect(
      service.sendMessage('user-1', {
        conversationId: 'conv-1',
        content: 'hello',
        replyToId: 'msg-elsewhere',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.message.create).not.toHaveBeenCalled();
  });
});
