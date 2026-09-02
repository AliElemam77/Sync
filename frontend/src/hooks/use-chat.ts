import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient, useInfiniteQuery, InfiniteData } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import { getSocket } from '../lib/socket';
import {
  ConversationSummary,
  ConversationDetail,
  Message,
  MessagesResponse,
  CreateGroupPayload,
  SendMessagePayload,
} from '../types/chat';

export const CHAT_CONVERSATIONS_KEY = ['chat', 'conversations'];
export const CHAT_MESSAGES_KEY = (id: string) => ['chat', 'messages', id];
export const CHAT_CONVERSATION_KEY = (id: string) => ['chat', 'conversation', id];

// =============================================================================
// CACHE MUTATION HELPERS (Handles both InfiniteData and Standard format)
// =============================================================================

function appendMessageToCache(
  queryClient: any,
  conversationId: string,
  newMessage: Message,
) {
  queryClient.setQueryData(
    CHAT_MESSAGES_KEY(conversationId),
    (old: any) => {
      if (!old) return old;

      // Handle InfiniteData format from useInfiniteQuery
      if (old.pages && Array.isArray(old.pages)) {
        const exists = old.pages.some((page: MessagesResponse) =>
          page.messages.some((m) => m.id === newMessage.id),
        );
        if (exists) return old;

        const newPages = [...old.pages];
        const page0 = newPages[0] || { messages: [], total: 0, page: 1, totalPages: 1 };
        newPages[0] = {
          ...page0,
          messages: [...page0.messages, newMessage],
          total: (page0.total || 0) + 1,
        };
        return {
          ...old,
          pages: newPages,
        };
      }

      // Handle single MessagesResponse format
      if (old.messages && Array.isArray(old.messages)) {
        if (old.messages.some((m: Message) => m.id === newMessage.id)) return old;
        return {
          ...old,
          messages: [...old.messages, newMessage],
          total: (old.total || 0) + 1,
        };
      }

      return old;
    },
  );
}

function updateMessageInCache(
  queryClient: any,
  conversationId: string,
  updater: (msg: Message) => Message,
) {
  queryClient.setQueryData(
    CHAT_MESSAGES_KEY(conversationId),
    (old: any) => {
      if (!old) return old;

      if (old.pages && Array.isArray(old.pages)) {
        return {
          ...old,
          pages: old.pages.map((page: MessagesResponse) => ({
            ...page,
            messages: page.messages.map((m) => updater(m)),
          })),
        };
      }

      if (old.messages && Array.isArray(old.messages)) {
        return {
          ...old,
          messages: old.messages.map((m: Message) => updater(m)),
        };
      }

      return old;
    },
  );
}

// =============================================================================
// QUERY HOOKS
// =============================================================================

export function useConversations() {
  return useQuery({
    queryKey: CHAT_CONVERSATIONS_KEY,
    queryFn: async () => {
      const res = await apiClient.get<ConversationSummary[]>('/api/v1/chat/conversations');
      return res.data;
    },
    staleTime: 1000 * 60, // 1 minute stale time since sockets handle real-time updates
  });
}

export function useConversationDetails(conversationId: string | null) {
  return useQuery({
    queryKey: CHAT_CONVERSATION_KEY(conversationId || ''),
    queryFn: async () => {
      if (!conversationId) return null;
      const res = await apiClient.get<ConversationDetail>(`/api/v1/chat/conversations/${conversationId}`);
      return res.data;
    },
    enabled: Boolean(conversationId),
  });
}

export function useInfiniteMessages(conversationId: string | null) {
  return useInfiniteQuery<MessagesResponse>({
    queryKey: CHAT_MESSAGES_KEY(conversationId || ''),
    queryFn: async ({ pageParam = 1 }) => {
      if (!conversationId) return { messages: [], total: 0, page: 1, totalPages: 1 };
      const res = await apiClient.get<MessagesResponse>(
        `/api/v1/chat/conversations/${conversationId}/messages?page=${pageParam}&limit=20`,
      );
      return res.data;
    },
    getNextPageParam: (lastPage) => {
      if (!lastPage || lastPage.page >= lastPage.totalPages) return undefined;
      return lastPage.page + 1;
    },
    initialPageParam: 1,
    enabled: Boolean(conversationId),
    staleTime: Infinity,
  });
}

export function useMessages(conversationId: string | null) {
  return useQuery({
    queryKey: CHAT_MESSAGES_KEY(conversationId || ''),
    queryFn: async () => {
      if (!conversationId) return { messages: [], total: 0, page: 1, totalPages: 1 };
      const res = await apiClient.get<MessagesResponse>(`/api/v1/chat/conversations/${conversationId}/messages?limit=20`);
      return res.data;
    },
    enabled: Boolean(conversationId),
    staleTime: Infinity,
  });
}

// =============================================================================
// MUTATION HOOKS
// =============================================================================

export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: SendMessagePayload) => {
      const res = await apiClient.post<Message>('/api/v1/chat/messages', payload);
      return res.data;
    },
    onSuccess: (newMessage) => {
      // 1. Instantly append message to active conversation cache
      appendMessageToCache(queryClient, newMessage.conversationId, newMessage);

      // 2. Update last message snippet on conversations list
      queryClient.setQueryData<ConversationSummary[]>(CHAT_CONVERSATIONS_KEY, (old) => {
        if (!old) return old;
        return old.map((conv) => {
          if (conv.id === newMessage.conversationId) {
            return {
              ...conv,
              lastMessage: {
                id: newMessage.id,
                content: newMessage.content,
                type: newMessage.type,
                senderName: newMessage.senderEmployee?.fullName || 'User',
                createdAt: newMessage.createdAt,
              },
              lastMessageAt: newMessage.createdAt,
            };
          }
          return conv;
        });
      });
    },
  });
}

export function useCreateDirectConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (targetUserId: string) => {
      const res = await apiClient.post<ConversationDetail>('/api/v1/chat/conversations/direct', { targetUserId });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CHAT_CONVERSATIONS_KEY });
    },
  });
}

export function useCreateGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateGroupPayload) => {
      const res = await apiClient.post<ConversationDetail>('/api/v1/chat/conversations/group', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CHAT_CONVERSATIONS_KEY });
    },
  });
}

export function useAddParticipants(conversationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userIds: string[]) => {
      const res = await apiClient.post<ConversationDetail>(`/api/v1/chat/conversations/${conversationId}/participants`, {
        userIds,
      });
      return res.data;
    },
    onSuccess: (updatedConv) => {
      queryClient.setQueryData(CHAT_CONVERSATION_KEY(conversationId), updatedConv);
      queryClient.invalidateQueries({ queryKey: CHAT_CONVERSATIONS_KEY });
    },
  });
}

export function useMarkAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (conversationId: string) => {
      const res = await apiClient.patch(`/api/v1/chat/conversations/${conversationId}/read`);
      return res.data;
    },
    onSuccess: (_, conversationId) => {
      // Optimistically clear unread badge in conversation list
      queryClient.setQueryData<ConversationSummary[]>(CHAT_CONVERSATIONS_KEY, (old) => {
        if (!old) return old;
        return old.map((c) => (c.id === conversationId ? { ...c, unreadCount: 0 } : c));
      });
    },
  });
}

export function useToggleReaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ messageId, emoji, conversationId }: { messageId: string; emoji: string; conversationId: string }) => {
      const res = await apiClient.post(`/api/v1/chat/messages/${messageId}/reactions`, { emoji });
      return { data: res.data, conversationId, messageId };
    },
    onSuccess: (result) => {
      if (result.data?.reactions) {
        updateMessageInCache(queryClient, result.conversationId, (m) =>
          m.id === result.messageId ? { ...m, reactions: result.data.reactions } : m,
        );
      }
    },
  });
}

export function useEditMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ messageId, content, conversationId }: { messageId: string; content: string; conversationId: string }) => {
      const res = await apiClient.patch<Message>(`/api/v1/chat/messages/${messageId}`, { content });
      return { message: res.data, conversationId, messageId };
    },
    onSuccess: (result) => {
      updateMessageInCache(queryClient, result.conversationId, (m) =>
        m.id === result.messageId ? { ...m, content: result.message.content, isEdited: true } : m,
      );
    },
  });
}

export function useDeleteMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ messageId, conversationId }: { messageId: string; conversationId: string }) => {
      const res = await apiClient.delete(`/api/v1/chat/messages/${messageId}`);
      return { data: res.data, conversationId, messageId };
    },
    onSuccess: (result) => {
      updateMessageInCache(queryClient, result.conversationId, (m) =>
        m.id === result.messageId ? { ...m, isDeleted: true, content: 'تم حذف هذه الرسالة' } : m,
      );
    },
  });
}

// =============================================================================
// REAL-TIME WEBSOCKET HOOK
// =============================================================================

export function useChatSocket(activeConversationId: string | null) {
  const queryClient = useQueryClient();
  const [typingUsers, setTypingUsers] = useState<Record<string, { fullName: string; timer: NodeJS.Timeout }>>({});

  // Socket room connection & listeners
  useEffect(() => {
    const socket = getSocket();

    if (activeConversationId) {
      socket.emit('chat:join_room', { conversationId: activeConversationId });
    }

    // 1. Receive live message
    const handleReceiveMessage = (newMessage: Message) => {
      appendMessageToCache(queryClient, newMessage.conversationId, newMessage);

      // Update conversations list snippet & unread count
      queryClient.setQueryData<ConversationSummary[]>(CHAT_CONVERSATIONS_KEY, (old) => {
        if (!old) return old;
        return old.map((conv) => {
          if (conv.id === newMessage.conversationId) {
            const isCurrentlyActive = conv.id === activeConversationId;
            return {
              ...conv,
              unreadCount: isCurrentlyActive ? 0 : conv.unreadCount + 1,
              lastMessage: {
                id: newMessage.id,
                content: newMessage.content,
                type: newMessage.type,
                senderName: newMessage.senderEmployee?.fullName || 'User',
                createdAt: newMessage.createdAt,
              },
              lastMessageAt: newMessage.createdAt,
            };
          }
          return conv;
        });
      });
    };

    // 2. Conversation list updated
    const handleConversationUpdated = (data: { conversationId: string; lastMessage: Message }) => {
      queryClient.setQueryData<ConversationSummary[]>(CHAT_CONVERSATIONS_KEY, (old) => {
        if (!old) return old;
        return old.map((conv) => {
          if (conv.id === data.conversationId) {
            const isCurrentlyActive = conv.id === activeConversationId;
            return {
              ...conv,
              unreadCount: isCurrentlyActive ? 0 : conv.unreadCount + 1,
              lastMessage: {
                id: data.lastMessage.id,
                content: data.lastMessage.content,
                type: data.lastMessage.type,
                senderName: data.lastMessage.senderEmployee?.fullName || 'User',
                createdAt: data.lastMessage.createdAt,
              },
              lastMessageAt: data.lastMessage.createdAt,
            };
          }
          return conv;
        });
      });
    };

    // 3. New conversation created
    const handleNewConversation = () => {
      queryClient.invalidateQueries({ queryKey: CHAT_CONVERSATIONS_KEY });
    };

    // 4. Reaction updated in real-time
    const handleReactionUpdated = (data: { conversationId: string; messageId: string; reactions: any[] }) => {
      updateMessageInCache(queryClient, data.conversationId, (m) =>
        m.id === data.messageId ? { ...m, reactions: data.reactions } : m,
      );
    };

    // 5. Message edited in real-time
    const handleMessageEdited = (data: { conversationId: string; message: Message }) => {
      updateMessageInCache(queryClient, data.conversationId, (m) =>
        m.id === data.message.id ? { ...m, content: data.message.content, isEdited: true } : m,
      );
    };

    // 6. Message deleted in real-time
    const handleMessageDeleted = (data: { conversationId: string; messageId: string }) => {
      updateMessageInCache(queryClient, data.conversationId, (m) =>
        m.id === data.messageId ? { ...m, isDeleted: true, content: 'تم حذف هذه الرسالة' } : m,
      );
    };

    // 7. Live typing indicator
    const handleUserTyping = (data: {
      conversationId: string;
      userId: string;
      fullName: string;
      isTyping: boolean;
    }) => {
      if (data.conversationId === activeConversationId) {
        if (data.isTyping) {
          setTypingUsers((prev) => {
            if (prev[data.userId]?.timer) {
              clearTimeout(prev[data.userId].timer);
            }
            const timer = setTimeout(() => {
              setTypingUsers((current) => {
                const copy = { ...current };
                delete copy[data.userId];
                return copy;
              });
            }, 3000);

            return {
              ...prev,
              [data.userId]: { fullName: data.fullName, timer },
            };
          });
        } else {
          setTypingUsers((prev) => {
            const copy = { ...prev };
            if (copy[data.userId]?.timer) {
              clearTimeout(copy[data.userId].timer);
            }
            delete copy[data.userId];
            return copy;
          });
        }
      }
    };

    socket.on('chat:receive_message', handleReceiveMessage);
    socket.on('chat:conversation_updated', handleConversationUpdated);
    socket.on('chat:new_conversation', handleNewConversation);
    socket.on('chat:reaction_updated', handleReactionUpdated);
    socket.on('chat:message_edited', handleMessageEdited);
    socket.on('chat:message_deleted', handleMessageDeleted);
    socket.on('chat:user_typing', handleUserTyping);

    return () => {
      if (activeConversationId) {
        socket.emit('chat:leave_room', { conversationId: activeConversationId });
      }
      socket.off('chat:receive_message', handleReceiveMessage);
      socket.off('chat:conversation_updated', handleConversationUpdated);
      socket.off('chat:new_conversation', handleNewConversation);
      socket.off('chat:reaction_updated', handleReactionUpdated);
      socket.off('chat:message_edited', handleMessageEdited);
      socket.off('chat:message_deleted', handleMessageDeleted);
      socket.off('chat:user_typing', handleUserTyping);
    };
  }, [activeConversationId, queryClient]);

  // Send typing trigger
  const emitTyping = useCallback(
    (isTyping: boolean) => {
      if (!activeConversationId) return;
      const socket = getSocket();
      socket.emit('chat:typing', {
        conversationId: activeConversationId,
        isTyping,
      });
    },
    [activeConversationId],
  );

  return {
    typingUsers: Object.values(typingUsers).map((u) => u.fullName),
    emitTyping,
  };
}
