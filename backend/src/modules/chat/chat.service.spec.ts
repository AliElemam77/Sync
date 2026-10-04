import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConversationType } from '@prisma/client';
import { ChatService } from './chat.service';

describe('ChatService authorization', () => {
  let prisma: any;
  let gateway: Record<string, jest.Mock>;
  let service: ChatService;

  beforeEach(() => {
    prisma = {
      conversation: { findUnique: jest.fn(), update: jest.fn() },
      conversationParticipant: { update: jest.fn() },
      employeeProfile: { findUnique: jest.fn() },
      message: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
      user: { findUnique: jest.fn() },
    };
    gateway = {
      broadcastNewMessage: jest.fn(),
      broadcastReactionUpdated: jest.fn(),
    };
    service = new ChatService(prisma, gateway as any);
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
