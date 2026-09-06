'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  FiMessageSquare,
  FiUsers,
  FiHash,
  FiSend,
  FiImage,
  FiSearch,
  FiPlus,
  FiMoreVertical,
  FiCheck,
  FiInfo,
  FiChevronRight,
  FiChevronLeft,
  FiChevronDown,
  FiShield,
  FiUserPlus,
  FiX,
  FiDownload,
  FiMaximize2,
  FiCornerDownRight,
  FiAlertCircle,
  FiEdit2,
  FiTrash2,
  FiRotateCw,
} from 'react-icons/fi';
import { BiBuildingHouse } from 'react-icons/bi';
import { useAuth } from '../../../hooks/use-auth';
import { useEmployees } from '../../../hooks/use-employees';
import { useOrganizationTree } from '../../../hooks/use-organization';
import {
  useConversations,
  useConversationDetails,
  useInfiniteMessages,
  useSendMessage,
  useEditMessage,
  useDeleteMessage,
  useCreateDirectConversation,
  useCreateGroup,
  useAddParticipants,
  useMarkAsRead,
  useToggleReaction,
  useChatSocket,
} from '../../../hooks/use-chat';
import { ConversationSummary, ConversationType, Message } from '../../../types/chat';
import { uploadImageToImgBB } from '../../../lib/imgbb';

// =============================================================================
// TYPES FOR OPTIMISTIC IN-CHAT UPLOADS & REPLIES
// =============================================================================

interface OptimisticMessage extends Partial<Message> {
  id: string;
  conversationId: string;
  senderId: string;
  senderEmployee?: any;
  sender?: any;
  content: string;
  type: any;
  attachmentUrls: string[];
  replyToId?: string | null;
  replyTo?: any;
  reactions?: any[];
  isUploading?: boolean;
  uploadProgress?: number;
  uploadError?: string;
  rawFiles?: File[];
  createdAt: string;
}

// Available Emojis
const AVAILABLE_EMOJIS = [
  { emoji: '👍', label: 'إعجاب' },
  { emoji: '❤️', label: 'حب' },
  { emoji: '🔥', label: 'حماس' },
  { emoji: '😂', label: 'ضحك' },
  { emoji: '🎉', label: 'احتفال' },
  { emoji: '🚀', label: 'انطلاق' },
];

// =============================================================================
// WHATSAPP-STYLE GALLERY GRID COMPONENT
// =============================================================================

interface ChatGalleryGridProps {
  images: string[];
  isUploading?: boolean;
  onImageClick: (index: number) => void;
  isMe: boolean;
}

function ChatGalleryGrid({ images, isUploading, onImageClick }: ChatGalleryGridProps) {
  if (!images || images.length === 0) return null;

  const count = images.length;

  return (
    <div className="relative my-1.5 overflow-hidden rounded-2xl border border-border shadow-xs">
      {/* 1 Image: Large Showcase */}
      {count === 1 && (
        <div
          onClick={() => onImageClick(0)}
          className="relative group cursor-pointer overflow-hidden max-h-80 max-w-sm sm:max-w-md bg-surface"
        >
          <img
            src={images[0]}
            alt="Chat attachment"
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <FiMaximize2 className="h-6 w-6 text-white drop-shadow-md" />
          </div>
        </div>
      )}

      {/* 2 Images: 2 Equal Columns */}
      {count === 2 && (
        <div className="grid grid-cols-2 gap-1 max-w-sm sm:max-w-md bg-surface">
          {images.map((url, idx) => (
            <div
              key={idx}
              onClick={() => onImageClick(idx)}
              className="relative aspect-square group cursor-pointer overflow-hidden bg-surface-raised"
            >
              <img
                src={url}
                alt={`Attachment ${idx + 1}`}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <FiMaximize2 className="h-5 w-5 text-white drop-shadow-md" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 3 Images: 1 Large Left/Top + 2 Stacked Right */}
      {count === 3 && (
        <div className="grid grid-cols-3 gap-1 max-w-sm sm:max-w-md bg-surface">
          <div
            onClick={() => onImageClick(0)}
            className="col-span-2 relative aspect-square group cursor-pointer overflow-hidden bg-surface-raised"
          >
            <img
              src={images[0]}
              alt="Attachment 1"
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <FiMaximize2 className="h-5 w-5 text-white" />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            {images.slice(1, 3).map((url, idx) => (
              <div
                key={idx + 1}
                onClick={() => onImageClick(idx + 1)}
                className="relative aspect-square group cursor-pointer overflow-hidden bg-surface-raised"
              >
                <img
                  src={url}
                  alt={`Attachment ${idx + 2}`}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <FiMaximize2 className="h-4 w-4 text-white" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4+ Images: 2x2 Grid with remaining counter */}
      {count >= 4 && (
        <div className="grid grid-cols-2 gap-1 max-w-sm sm:max-w-md bg-surface">
          {images.slice(0, 3).map((url, idx) => (
            <div
              key={idx}
              onClick={() => onImageClick(idx)}
              className="relative aspect-square group cursor-pointer overflow-hidden bg-surface-raised"
            >
              <img
                src={url}
                alt={`Attachment ${idx + 1}`}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <FiMaximize2 className="h-5 w-5 text-white" />
              </div>
            </div>
          ))}

          {/* 4th Item with Remaining Counter Overlay if count > 4 */}
          <div
            onClick={() => onImageClick(3)}
            className="relative group cursor-pointer overflow-hidden bg-surface-raised"
          >
            <img
              src={images[3]}
              alt="Attachment 4"
              className="w-full h-full object-cover"
            />
            {count > 4 ? (
              <div className="absolute inset-0 bg-black/65 backdrop-blur-xs flex flex-col items-center justify-center text-white transition-all group-hover:bg-black/55">
                <span className="text-xl sm:text-2xl font-black font-mono tracking-tight">+{count - 3}</span>
                <span className="text-[10px] font-bold text-slate-200">صور إضافية</span>
              </div>
            ) : (
              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <FiMaximize2 className="h-5 w-5 text-white" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* In-Chat Uploading Spinner Indicator Overlay */}
      {isUploading && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center text-white gap-2 z-10 animate-in fade-in duration-150">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="text-xs font-bold text-slate-200">جاري إرسال الصور...</span>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// MAIN CHAT PAGE
// =============================================================================

export default function ChatPage() {
  const { user } = useAuth();
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'DIRECT' | 'WORK_GROUP' | 'PUBLIC_GROUP'>('ALL');
  const [messageText, setMessageText] = useState('');
  const [showRightDrawer, setShowRightDrawer] = useState(false);

  // Replying State
  const [replyingToMessage, setReplyingToMessage] = useState<Message | null>(null);

  // In-Chat Optimistic Local Uploads Queue
  const [optimisticMessages, setOptimisticMessages] = useState<OptimisticMessage[]>([]);

  // Selected Local Files for Instant Preview
  const [selectedLocalFiles, setSelectedLocalFiles] = useState<{ file: File; localUrl: string }[]>([]);

  // Lightbox Modal State
  const [lightboxState, setLightboxState] = useState<{ isOpen: boolean; images: string[]; currentIndex: number }>({
    isOpen: false,
    images: [],
    currentIndex: 0,
  });

  // Reaction picker hover state
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);

  // Modals
  const [isDirectModalOpen, setIsDirectModalOpen] = useState(false);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [isAddMembersModalOpen, setIsAddMembersModalOpen] = useState(false);
  const [directSearch, setDirectSearch] = useState('');
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [groupTitle, setGroupTitle] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [groupType, setGroupType] = useState<ConversationType>('WORK_GROUP');
  const [groupDepartmentId, setGroupDepartmentId] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef<boolean>(true);
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const composerInputRef = useRef<HTMLTextAreaElement>(null);

  // Queries
  const { data: conversations = [], isLoading: isConversationsLoading } = useConversations();
  const { data: activeConversation } = useConversationDetails(activeConvId);
  const {
    data: messagesInfiniteData,
    isLoading: isMessagesLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteMessages(activeConvId);
  const { data: employeesData } = useEmployees({ page: 1, limit: 100 });
  const { data: departments = [] } = useOrganizationTree();

  // Mutations
  const sendMessageMutation = useSendMessage();
  const editMessageMutation = useEditMessage();
  const deleteMessageMutation = useDeleteMessage();
  const createDirectMutation = useCreateDirectConversation();
  const createGroupMutation = useCreateGroup();
  const addParticipantsMutation = useAddParticipants(activeConvId || '');
  const markAsReadMutation = useMarkAsRead();
  const toggleReactionMutation = useToggleReaction();

  const [editingMessage, setEditingMessage] = useState<Message | null>(null);

  // WebSockets integration
  const { typingUsers, emitTyping } = useChatSocket(activeConvId);

  // Auto-select first conversation
  useEffect(() => {
    if (!activeConvId && conversations.length > 0) {
      setActiveConvId(conversations[0].id);
    }
  }, [conversations, activeConvId]);

  // Mark as read
  useEffect(() => {
    if (activeConvId) {
      markAsReadMutation.mutate(activeConvId);
    }
  }, [activeConvId]);

  // Smart Auto-scroll
  const scrollToBottom = useCallback((behavior: 'auto' | 'smooth' = 'smooth') => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior,
      });
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior });
    }
    isNearBottomRef.current = true;
    setShowScrollBottomBtn(false);
  }, []);

  // Listen to user scroll position & load earlier 20 messages on scroll up
  const handleMessagesScroll = () => {
    if (!messagesContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;

    // Trigger loading older 20 messages when user reaches near the top (< 80px)
    if (scrollTop < 80 && hasNextPage && !isFetchingNextPage) {
      const prevScrollHeight = scrollHeight;
      fetchNextPage().then(() => {
        requestAnimationFrame(() => {
          if (messagesContainerRef.current) {
            const newScrollHeight = messagesContainerRef.current.scrollHeight;
            messagesContainerRef.current.scrollTop = newScrollHeight - prevScrollHeight;
          }
        });
      });
    }

    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    const isNear = distanceFromBottom < 120;
    isNearBottomRef.current = isNear;
    setShowScrollBottomBtn(!isNear);
  };

  // Scroll to bottom immediately when active conversation changes
  useEffect(() => {
    if (activeConvId) {
      isNearBottomRef.current = true;
      setShowScrollBottomBtn(false);
      const timer = setTimeout(() => {
        scrollToBottom('auto');
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [activeConvId, scrollToBottom]);

  // Flatten all loaded pages in chronological order (Page 1 is newest 20, Page 2 is older 20, etc.)
  const serverMessages = useMemo(() => {
    if (!messagesInfiniteData?.pages) return [];
    return messagesInfiniteData.pages
      .slice()
      .reverse()
      .flatMap((page) => page.messages);
  }, [messagesInfiniteData?.pages]);

  // Merge Server Messages with Active Local Optimistic Messages
  const combinedMessages = useMemo(() => {
    const activeOptimistic = optimisticMessages.filter((m) => m.conversationId === activeConvId);
    return [...serverMessages, ...activeOptimistic];
  }, [serverMessages, optimisticMessages, activeConvId]);

  // Only auto-scroll on new message if the user is already near the bottom
  useEffect(() => {
    if (isNearBottomRef.current) {
      scrollToBottom('smooth');
    }
  }, [combinedMessages.length, typingUsers.length, scrollToBottom]);

  // Filtered Conversations List
  const filteredConversations = useMemo(() => {
    return conversations.filter((c) => {
      const matchesSearch =
        (c.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.lastMessage?.content || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = filterType === 'ALL' || c.type === filterType;
      return matchesSearch && matchesType;
    });
  }, [conversations, searchQuery, filterType]);

  // Handle Multi-Image Selection into Composer
  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const newFiles = files.map((file) => ({
      file,
      localUrl: URL.createObjectURL(file),
    }));

    setSelectedLocalFiles((prev) => [...prev, ...newFiles]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Remove local file from composer queue
  const removeSelectedFile = (index: number) => {
    setSelectedLocalFiles((prev) => {
      const target = prev[index];
      if (target) URL.revokeObjectURL(target.localUrl);
      return prev.filter((_, i) => i !== index);
    });
  };

  // Trigger Reply to a message
  const handleStartReply = (msg: Message) => {
    setReplyingToMessage(msg);
    setEditingMessage(null);
    composerInputRef.current?.focus();
  };

  // Trigger Edit a message
  const handleStartEdit = (msg: Message) => {
    setEditingMessage(msg);
    setReplyingToMessage(null);
    setMessageText(msg.content);
    composerInputRef.current?.focus();
  };

  // Trigger Delete a message
  const handleDeleteMessage = async (messageId: string) => {
    if (!confirm('هل أنت متأكد من رغبتك في حذف هذه الرسالة؟')) return;
    if (!activeConvId) return;
    try {
      await deleteMessageMutation.mutateAsync({
        messageId,
        conversationId: activeConvId,
      });
    } catch (err: any) {
      alert(err.response?.data?.message || 'فشل حذف الرسالة');
    }
  };

  // Scroll to a quoted message
  const handleScrollToMessage = (messageId: string) => {
    const element = document.getElementById(`message-${messageId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.classList.add('ring-2', 'ring-primary', 'bg-primary/10');
      setTimeout(() => {
        element.classList.remove('ring-2', 'ring-primary', 'bg-primary/10');
      }, 2000);
    }
  };

  // Handle In-Chat Instant Send or Edit
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if ((!messageText.trim() && selectedLocalFiles.length === 0) || !activeConvId) return;

    // If Editing
    if (editingMessage) {
      const msgId = editingMessage.id;
      const textToUpdate = messageText.trim();
      setEditingMessage(null);
      setMessageText('');
      emitTyping(false);

      try {
        await editMessageMutation.mutateAsync({
          messageId: msgId,
          content: textToUpdate,
          conversationId: activeConvId,
        });
      } catch (err: any) {
        alert(err.response?.data?.message || 'فشل تعديل الرسالة');
      }
      return;
    }

    const textToSend = messageText.trim();
    const filesToUpload = [...selectedLocalFiles];
    const replyTarget = replyingToMessage;

    // Reset Composer Immediately
    setMessageText('');
    setSelectedLocalFiles([]);
    setReplyingToMessage(null);
    emitTyping(false);

    // If images are attached: create instant optimistic message in chat
    if (filesToUpload.length > 0) {
      const tempId = `temp-${Date.now()}-${Math.random()}`;
      const localBlobUrls = filesToUpload.map((f) => f.localUrl);

      const optimisticMsg: OptimisticMessage = {
        id: tempId,
        conversationId: activeConvId,
        senderId: user?.id || '',
        senderEmployee: {
          id: user?.id,
          fullName: 'أنا',
          avatarUrl: null,
          employeeCode: 'ME',
        },
        content: textToSend,
        type: 'IMAGE',
        attachmentUrls: localBlobUrls,
        rawFiles: filesToUpload.map((f) => f.file),
        replyToId: replyTarget?.id || null,
        replyTo: replyTarget
          ? {
              id: replyTarget.id,
              content: replyTarget.content,
              type: replyTarget.type,
              attachmentUrls: replyTarget.attachmentUrls,
              senderEmployee: {
                fullName: replyTarget.senderEmployee?.fullName || 'زميل',
              },
            }
          : null,
        isUploading: true,
        reactions: [],
        createdAt: new Date().toISOString(),
      };

      setOptimisticMessages((prev) => [...prev, optimisticMsg]);
      scrollToBottom();

      // Perform background upload
      try {
        const uploadedUrls = await Promise.all(
          filesToUpload.map((item) => uploadImageToImgBB(item.file)),
        );

        // Send to backend REST/WebSocket
        await sendMessageMutation.mutateAsync({
          conversationId: activeConvId,
          content: textToSend,
          type: 'IMAGE',
          attachmentUrls: uploadedUrls,
          replyToId: replyTarget?.id,
        });

        // Clean up optimistic message
        setOptimisticMessages((prev) => prev.filter((m) => m.id !== tempId));
        localBlobUrls.forEach((url) => URL.revokeObjectURL(url));
      } catch (err: any) {
        console.error('Failed to send image(s):', err);
        setOptimisticMessages((prev) =>
          prev.map((m) =>
            m.id === tempId ? { ...m, isUploading: false, uploadError: 'تعذر إرسال الصور' } : m,
          ),
        );
      }
    } else {
      // Regular text message - Full Optimistic Instant In-Chat Experience
      const tempId = `temp-${Date.now()}-${Math.random()}`;

      const optimisticMsg: OptimisticMessage = {
        id: tempId,
        conversationId: activeConvId,
        senderId: user?.id || '',
        senderEmployee: {
          id: user?.id,
          fullName: 'أنا',
          avatarUrl: null,
          employeeCode: 'ME',
        },
        content: textToSend,
        type: 'TEXT',
        attachmentUrls: [],
        replyToId: replyTarget?.id || null,
        replyTo: replyTarget
          ? {
              id: replyTarget.id,
              content: replyTarget.content,
              type: replyTarget.type,
              attachmentUrls: replyTarget.attachmentUrls,
              senderEmployee: {
                fullName: replyTarget.senderEmployee?.fullName || 'زميل',
              },
            }
          : null,
        isUploading: true,
        reactions: [],
        createdAt: new Date().toISOString(),
      };

      // 1. Immediately inject message into the active conversation stream
      setOptimisticMessages((prev) => [...prev, optimisticMsg]);
      scrollToBottom();

      // 2. Dispatch to server in background
      try {
        await sendMessageMutation.mutateAsync({
          conversationId: activeConvId,
          content: textToSend,
          type: 'TEXT',
          attachmentUrls: [],
          replyToId: replyTarget?.id,
        });

        // On success: remove temporary optimistic clone (server message is now in cache/feed)
        setOptimisticMessages((prev) => prev.filter((m) => m.id !== tempId));
      } catch (err: any) {
        console.error('Failed to send text message:', err);
        // On error: keep message visible in chat, marked as failed with retry action
        setOptimisticMessages((prev) =>
          prev.map((m) =>
            m.id === tempId
              ? {
                  ...m,
                  isUploading: false,
                  uploadError: 'تعذر إرسال الرسالة',
                }
              : m,
          ),
        );
      }
    }
  };

  // Retry sending an optimistic message that failed
  const handleRetryMessage = async (msgId: string) => {
    const targetMsg = optimisticMessages.find((m) => m.id === msgId);
    if (!targetMsg || !activeConvId) return;

    // Set isUploading true, clear error to show in-progress loader
    setOptimisticMessages((prev) =>
      prev.map((m) =>
        m.id === msgId ? { ...m, isUploading: true, uploadError: undefined } : m,
      ),
    );

    try {
      let uploadedUrls: string[] = [];
      if (targetMsg.rawFiles && targetMsg.rawFiles.length > 0) {
        uploadedUrls = await Promise.all(
          targetMsg.rawFiles.map((file) => uploadImageToImgBB(file)),
        );
      } else {
        uploadedUrls = targetMsg.attachmentUrls || [];
      }

      await sendMessageMutation.mutateAsync({
        conversationId: activeConvId,
        content: targetMsg.content,
        type: (targetMsg.type as any) || (uploadedUrls.length > 0 ? 'IMAGE' : 'TEXT'),
        attachmentUrls: uploadedUrls,
        replyToId: targetMsg.replyToId || undefined,
      });

      // Clean up optimistic message
      setOptimisticMessages((prev) => prev.filter((m) => m.id !== msgId));
      targetMsg.attachmentUrls?.forEach((url) => {
        if (url.startsWith('blob:')) URL.revokeObjectURL(url);
      });
    } catch (err: any) {
      console.error('Retry failed:', err);
      setOptimisticMessages((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? {
                ...m,
                isUploading: false,
                uploadError: targetMsg.attachmentUrls?.length ? 'تعذر إرسال الصور' : 'تعذر إرسال الرسالة',
              }
            : m,
        ),
      );
    }
  };

  // Cancel / dismiss failed message
  const handleCancelOptimisticMessage = (msgId: string) => {
    const targetMsg = optimisticMessages.find((m) => m.id === msgId);
    targetMsg?.attachmentUrls?.forEach((url) => {
      if (url.startsWith('blob:')) URL.revokeObjectURL(url);
    });
    setOptimisticMessages((prev) => prev.filter((m) => m.id !== msgId));
  };

  // Toggle Reaction handler
  const handleToggleReaction = async (messageId: string, emoji: string) => {
    if (!activeConvId) return;
    setHoveredMessageId(null);
    try {
      await toggleReactionMutation.mutateAsync({
        messageId,
        emoji,
        conversationId: activeConvId,
      });
    } catch (err) {
      console.error('Failed to toggle reaction:', err);
    }
  };

  // Lightbox handlers
  const openLightbox = (images: string[], index: number) => {
    setLightboxState({ isOpen: true, images, currentIndex: index });
  };

  const closeLightbox = () => {
    setLightboxState((prev) => ({ ...prev, isOpen: false }));
  };

  const nextLightboxImage = useCallback(() => {
    setLightboxState((prev) => ({
      ...prev,
      currentIndex: (prev.currentIndex + 1) % prev.images.length,
    }));
  }, []);

  const prevLightboxImage = useCallback(() => {
    setLightboxState((prev) => ({
      ...prev,
      currentIndex: (prev.currentIndex - 1 + prev.images.length) % prev.images.length,
    }));
  }, []);

  // Keyboard navigation for Lightbox
  useEffect(() => {
    if (!lightboxState.isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowRight') prevLightboxImage();
      if (e.key === 'ArrowLeft') nextLightboxImage();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [lightboxState.isOpen, nextLightboxImage, prevLightboxImage]);

  // Handle Start Direct Chat
  const handleStartDirectChat = async (targetUserId: string) => {
    try {
      const conv = await createDirectMutation.mutateAsync(targetUserId);
      setActiveConvId(conv.id);
      setIsDirectModalOpen(false);
    } catch (err: any) {
      alert(err.response?.data?.message || 'فشل بدء المحادثة المباشرة');
    }
  };

  // Handle Create Group
  const handleCreateGroupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupTitle.trim()) return;

    try {
      const group = await createGroupMutation.mutateAsync({
        title: groupTitle.trim(),
        description: groupDescription.trim() || undefined,
        type: groupType,
        departmentId: groupDepartmentId || undefined,
        participantUserIds: selectedEmployeeIds,
      });
      setActiveConvId(group.id);
      setIsGroupModalOpen(false);
      setGroupTitle('');
      setGroupDescription('');
      setSelectedEmployeeIds([]);
    } catch (err: any) {
      alert(err.response?.data?.message || 'فشل إنشاء المجموعة');
    }
  };

  // Handle Add Members
  const handleAddMembersSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeConvId || selectedEmployeeIds.length === 0) return;

    try {
      await addParticipantsMutation.mutateAsync(selectedEmployeeIds);
      setIsAddMembersModalOpen(false);
      setSelectedEmployeeIds([]);
    } catch (err: any) {
  alert(err.response?.data?.message || 'فشل إضافة الأعضاء');
    }
  };

  // Format Time
  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString('ar-EG', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  return (
    <div dir="rtl" className="h-[calc(100vh-8rem)] flex flex-col font-sans glass-card text-foreground rounded-3xl overflow-hidden shadow-luxury dark:shadow-luxury-dark relative animate-in fade-in duration-300">
      <div className="flex-1 flex overflow-hidden">
        {/* =================================================================== */}
        {/* LEFT SIDEBAR: CONVERSATIONS & CHANNELS LIST */}
        {/* =================================================================== */}
        <aside className="w-full md:w-80 lg:w-96 border-e border-white/40 dark:border-white/10 bg-white/30 dark:bg-black/35 backdrop-blur-2xl flex flex-col shrink-0 z-10">
          {/* Top Header */}
          <div className="p-4 border-b border-border/15 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-brand-taupe to-brand-gold dark:from-brand-gold dark:to-brand-champagne flex items-center justify-center text-white dark:text-brand-stone-950 shadow-md shadow-brand-taupe/20">
                <FiMessageSquare className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-black text-foreground tracking-tight">غرف الدردشة</h2>
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-500 font-bold">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>متصل لحظياً</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  setSelectedEmployeeIds([]);
                  setIsDirectModalOpen(true);
                }}
                className="p-2 rounded-xl bg-surface hover:bg-surface-hover text-foreground transition-all hover:scale-105"
                title="محادثة مباشرة جديدة"
              >
                <FiPlus className="h-4 w-4" />
              </button>
              <button
                onClick={() => {
                  setSelectedEmployeeIds([]);
                  setIsGroupModalOpen(true);
                }}
                className="p-2 rounded-xl bg-primary hover:bg-primary-hover text-primary-foreground shadow-md shadow-primary/20 transition-all hover:scale-105"
                title="إنشاء مجموعة عمل أو قناة عامة"
              >
                <FiUsers className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Quick Search Bar */}
          <div className="p-3 border-b border-border/15 bg-surface/30">
            <div className="relative">
              <FiSearch className="absolute start-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-foreground-subtle" />
              <input
                type="text"
                placeholder="البحث في القنوات والمحادثات..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-2xl bg-surface ps-9 pe-3.5 py-2 text-xs text-foreground placeholder-foreground-subtle focus:border-primary focus:outline-none transition-all"
              />
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1 p-2 border-b border-border/15 bg-surface-raised/30 text-[11px] font-bold">
            {[
              { id: 'ALL', label: 'الكل' },
              { id: 'DIRECT', label: 'مباشر' },
              { id: 'WORK_GROUP', label: 'فرق العمل' },
              { id: 'PUBLIC_GROUP', label: 'عامة 📢' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilterType(tab.id as any)}
                className={`flex-1 py-1.5 rounded-xl transition-all text-center ${
                  filterType === tab.id
                    ? 'bg-primary text-primary-foreground font-black shadow-xs'
                    : 'text-foreground-muted hover:text-foreground hover:bg-surface-hover'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Conversation List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {isConversationsLoading ? (
              <div className="p-4 text-center text-xs text-foreground-muted animate-pulse">
                جاري تحميل المحادثات...
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="p-8 text-center text-xs text-foreground-muted">
                <FiMessageSquare className="h-8 w-8 mx-auto mb-2 opacity-40 text-primary" />
                <span>لا توجد محادثات مطابقة</span>
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const isSelected = activeConvId === conv.id;

                return (
                  <button
                    key={conv.id}
                    onClick={() => setActiveConvId(conv.id)}
                    className={`w-full p-3 rounded-2xl flex items-center gap-3 transition-all duration-200 text-start group relative ${
                      isSelected
                        ? 'bg-surface-raised border border-border/30 shadow-xs'
                        : 'hover:bg-surface/70'
                    }`}
                  >
                    {/* Avatar */}
                    <div className="relative shrink-0">
                      <div className="h-12 w-12 rounded-2xl bg-surface-raised border border-white/[0.04] flex items-center justify-center font-black text-foreground overflow-hidden shadow-inner">
                        {conv.avatarUrl ? (
                          <img src={conv.avatarUrl} alt={conv.title || 'Conversation'} className="h-full w-full object-cover" />
                        ) : conv.type === 'PUBLIC_GROUP' ? (
                          <FiHash className="h-5 w-5 text-amber-500" />
                        ) : conv.isGroup ? (
                          <FiUsers className="h-5 w-5 text-indigo-500" />
                        ) : (
                          conv.title?.slice(0, 1) || 'U'
                        )}
                      </div>
                      {conv.type === 'DIRECT' && (
                        <span className="absolute -bottom-0.5 -end-0.5 h-3.5 w-3.5 rounded-full bg-emerald-500 ring-2 ring-card" />
                      )}
                    </div>

                    {/* Metadata */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span className={`text-xs truncate font-extrabold ${isSelected ? 'text-foreground font-black' : 'text-foreground'}`}>
                          {conv.title}
                        </span>
                        {conv.lastMessageAt && (
                          <span className="text-[10px] text-foreground-subtle font-mono shrink-0">
                            {formatTime(conv.lastMessageAt)}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-1">
                        <p className="text-[11px] text-foreground-muted truncate">
                          {conv.lastMessage
                            ? `${conv.isGroup ? `${conv.lastMessage.senderName}: ` : ''}${conv.lastMessage.content || '📷 صورة مرفقة'}`
                            : conv.description || 'لا توجد رسائل بعد'}
                        </p>

                        {/* Unread Counter Badge */}
                        {conv.unreadCount > 0 && (
                          <span className="h-5 min-w-5 px-1.5 rounded-full bg-primary text-primary-foreground font-black text-[10px] flex items-center justify-center shrink-0 shadow-xs animate-pulse">
                            {conv.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        <main className="flex-1 flex flex-col bg-transparent relative overflow-hidden">
          {/* WhatsApp / Telegram Ambient Pattern Wallpaper (Fixed Full-Height Coverage) */}
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.06] dark:opacity-[0.045] bg-repeat z-0"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='80' height='80' viewBox='0 0 80 80' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23605B51' fill-opacity='1' fill-rule='evenodd'%3E%3Cpath d='M11 14.01V7a1 1 0 0 1 2 0v7.01A5 5 0 0 1 18 19v2a1 1 0 0 1-2 0v-2a3 3 0 0 0-3-3h-2a3 3 0 0 0-3 3v2a1 1 0 0 1-2 0v-2a5 5 0 0 1 5-4.99zM35 4a3 3 0 0 1 3 3v2a3 3 0 0 1-3 3h-2a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h2zm0 2h-2a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1zm25 10a4 4 0 1 1 0 8 4 4 0 0 1 0-8zm0 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM9 48a3 3 0 0 1 3 3v4a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-4a3 3 0 0 1 3-3h2zm0 2H7a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-4a1 1 0 0 0-1-1zm48 20a3 3 0 0 1 3 3v2a3 3 0 0 1-3 3h-2a3 3 0 0 1-3-3v-2a3 3 0 0 1 3-3h2zm0 2h-2a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1zM65 42a5 5 0 0 1 5 5v2a1 1 0 0 1-2 0v-2a3 3 0 0 0-3-3h-2a3 3 0 0 0-3 3v2a1 1 0 0 1-2 0v-2a5 5 0 0 1 5-5h2zM33 60a4 4 0 1 1 0 8 4 4 0 0 1 0-8zm0 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4z'/%3E%3C/g%3E%3C/svg%3E")`,
              backgroundSize: '120px 120px',
            }}
          />

          {activeConversation ? (
            <>
              {/* Header */}
              <header className="p-3.5 sm:p-4 border-b border-white/40 dark:border-white/10 bg-white/35 dark:bg-black/40 backdrop-blur-2xl flex items-center justify-between shrink-0 z-10 shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-2xl bg-surface-raised border border-white/[0.04] flex items-center justify-center font-black text-foreground overflow-hidden shadow-inner">
                    {activeConversation.avatarUrl ? (
                      <img src={activeConversation.avatarUrl} alt={activeConversation.title || 'Conversation'} className="h-full w-full object-cover" />
                    ) : activeConversation.type === 'PUBLIC_GROUP' ? (
                      <FiHash className="h-5 w-5 text-amber-500" />
                    ) : activeConversation.isGroup ? (
                      <FiUsers className="h-5 w-5 text-indigo-500" />
                    ) : (
                      activeConversation.title?.slice(0, 1) || 'U'
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-black text-foreground tracking-tight">
                        {activeConversation.title}
                      </h3>
                      {activeConversation.isGroup && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20">
                          {activeConversation.type === 'PUBLIC_GROUP' ? 'قناة عامة' : 'مجموعة عمل'}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-foreground-muted font-mono">
                      {activeConversation.isGroup
                        ? `${activeConversation.participantsCount || activeConversation.participants?.length || 0} أعضاء • ${activeConversation.description || 'لا يوجد وصف'}`
                        : activeConversation.counterpartEmployee?.position?.name
                        ? `${activeConversation.counterpartEmployee.position.name} • ${activeConversation.counterpartEmployee.department?.name || 'الشركة'}`
                        : 'محادثة مباشرة 1-to-1'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {activeConversation.isGroup && activeConversation.role === 'ADMIN' && (
                    <button
                      onClick={() => {
                        setSelectedEmployeeIds([]);
                        setIsAddMembersModalOpen(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface hover:bg-surface-hover text-xs font-bold text-foreground border border-border/40 transition-colors"
                    >
                      <FiUserPlus className="h-3.5 w-3.5 text-primary" />
                      <span className="hidden sm:inline">إضافة أعضاء</span>
                    </button>
                  )}

                  <button
                    onClick={() => setShowRightDrawer(!showRightDrawer)}
                    className="p-2.5 rounded-xl bg-surface hover:bg-surface-hover text-foreground-muted hover:text-foreground transition-colors"
                    title="معلومات المحادثة"
                  >
                    <FiInfo className="h-4 w-4" />
                  </button>
                </div>
              </header>

              {/* Messages Stream Container */}
              <div
                ref={messagesContainerRef}
                onScroll={handleMessagesScroll}
                className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 relative z-10"
              >
                <div className="relative z-10 space-y-4">
                  {isMessagesLoading ? (
                    <div className="flex flex-col items-center justify-center h-full text-foreground-muted text-xs">
                      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent mb-2" />
                      <span>جاري تحميل سجل المحادثة...</span>
                    </div>
                  ) : combinedMessages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-foreground-muted text-xs text-center p-8">
                      <div className="h-16 w-16 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-3 shadow-inner">
                        <FiMessageSquare className="h-8 w-8" />
                      </div>
                      <h4 className="font-bold text-foreground text-sm">بداية محادثة جديدة</h4>
                      <p className="max-w-xs mt-1 text-foreground-muted">
                        أرسل أول رسالة أو شارك مجموعة صور لبدء التواصل الفوري مع الزملاء.
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Older Messages Loading Indicator */}
                      {hasNextPage && (
                        <div className="flex justify-center py-2">
                          {isFetchingNextPage ? (
                            <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-surface-raised border border-white/[0.06] text-primary text-xs font-bold shadow-xs">
                              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                              <span>جاري تحميل الرسائل السابقة...</span>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                if (!messagesContainerRef.current) return;
                                const prevScrollHeight = messagesContainerRef.current.scrollHeight;
                                fetchNextPage().then(() => {
                                  requestAnimationFrame(() => {
                                    if (messagesContainerRef.current) {
                                      const newScrollHeight = messagesContainerRef.current.scrollHeight;
                                      messagesContainerRef.current.scrollTop = newScrollHeight - prevScrollHeight;
                                    }
                                  });
                                });
                              }}
                              className="px-3.5 py-1 rounded-full bg-surface-raised hover:bg-surface-hover border border-white/[0.06] text-foreground-muted hover:text-foreground text-[11px] font-bold transition-all shadow-xs"
                            >
                              تحميل الرسائل السابقة (20 رسالة)
                            </button>
                          )}
                        </div>
                      )}

                      {combinedMessages.map((msg, index) => {
                      const isMe = msg.senderId === user?.id;

                      const prevMsg = index > 0 ? combinedMessages[index - 1] : null;
                      const nextMsg = index < combinedMessages.length - 1 ? combinedMessages[index + 1] : null;

                      const isSameSenderAsPrev =
                        Boolean(prevMsg) &&
                        prevMsg?.senderId === msg.senderId &&
                        prevMsg?.type !== 'SYSTEM' &&
                        new Date(msg.createdAt).getTime() - new Date(prevMsg!.createdAt).getTime() < 5 * 60 * 1000;

                      const isSameSenderAsNext =
                        Boolean(nextMsg) &&
                        nextMsg?.senderId === msg.senderId &&
                        nextMsg?.type !== 'SYSTEM' &&
                        new Date(nextMsg!.createdAt).getTime() - new Date(msg.createdAt).getTime() < 5 * 60 * 1000;

                      const aggregatedReactions: Record<string, { count: number; users: string[]; hasReacted: boolean }> = {};
                      if (Array.isArray(msg.reactions)) {
                        msg.reactions.forEach((r: any) => {
                          if (!aggregatedReactions[r.emoji]) {
                            aggregatedReactions[r.emoji] = { count: 0, users: [], hasReacted: false };
                          }
                          aggregatedReactions[r.emoji].count += 1;
                          aggregatedReactions[r.emoji].users.push(r.userName);
                          if (r.userId === user?.id) {
                            aggregatedReactions[r.emoji].hasReacted = true;
                          }
                        });
                      }

                      const hasReactions = Object.keys(aggregatedReactions).length > 0;

                      // System Message
                      if (msg.type === 'SYSTEM') {
                        return (
                          <div key={msg.id} className="flex justify-center my-3">
                            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[11px] font-semibold bg-surface-raised border border-border/20 text-foreground-muted shadow-xs">
                              <FiInfo className="h-3.5 w-3.5 text-primary" />
                              <span>{msg.content}</span>
                            </span>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={msg.id}
                          id={`message-${msg.id}`}
                          onMouseEnter={() => setHoveredMessageId(msg.id)}
                          onMouseLeave={() => setHoveredMessageId(null)}
                          className={`flex items-end gap-2.5 group relative transition-all ${
                            isSameSenderAsPrev ? 'mt-1' : 'mt-4'
                          } ${hasReactions ? 'mb-4' : ''} ${isMe ? 'justify-start flex-row-reverse' : 'justify-start'}`}
                        >
                          {/* Avatar Column */}
                          {!isMe && (
                            <div className="w-8 shrink-0 flex items-center justify-center">
                              {!isSameSenderAsNext ? (
                                <div className="h-8 w-8 rounded-xl bg-surface-raised border border-white/[0.04] flex items-center justify-center text-xs font-bold text-foreground shrink-0 overflow-hidden shadow-xs">
                                  {msg.senderEmployee?.avatarUrl ? (
                                    <img
                                      src={msg.senderEmployee.avatarUrl}
                                      alt={msg.senderEmployee.fullName}
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    msg.senderEmployee?.fullName?.slice(0, 1) || 'U'
                                  )}
                                </div>
                              ) : (
                                <div className="h-8 w-8" />
                              )}
                            </div>
                          )}

                          {/* Message Bubble Column */}
                          <div className={`max-w-md sm:max-w-lg lg:max-w-xl flex flex-col relative group/bubble ${isMe ? 'items-end' : 'items-start'}`}>
                            {!isMe && activeConversation.isGroup && !isSameSenderAsPrev && (
                              <span className="text-[11px] font-extrabold text-primary mb-1 ps-1.5">
                                {msg.senderEmployee?.fullName || msg.sender?.email}
                              </span>
                            )}

                            {/* Bubble Body */}
                            <div
                              className={`p-3.5 rounded-3xl shadow-xs text-xs leading-relaxed relative ${
                                msg.isDeleted
                                  ? 'bg-surface/50 border border-white/[0.03] text-foreground-subtle italic'
                                  : isMe
                                  ? 'bg-primary text-primary-foreground rounded-br-xs font-medium'
                                  : 'bg-surface text-foreground rounded-bl-xs border border-white/[0.04]'
                              }`}
                            >
                              {/* Quoted Reply Banner */}
                              {!msg.isDeleted && msg.replyTo && (
                                <div
                                  onClick={() => msg.replyTo?.id && handleScrollToMessage(msg.replyTo.id)}
                                  className={`mb-2 p-2.5 rounded-2xl border-s-4 cursor-pointer transition-all ${
                                    isMe
                                      ? 'bg-black/20 border-white/80 hover:bg-black/30 text-primary-foreground'
                                      : 'bg-surface-raised border-primary hover:bg-surface-hover text-foreground-muted'
                                  }`}
                                >
                                  <div className="flex items-center gap-1.5 font-bold text-[10px] mb-0.5">
                                    <FiCornerDownRight className="h-3 w-3" />
                                    <span>{msg.replyTo.senderEmployee?.fullName || 'رسالة سابقة'}</span>
                                  </div>
                                  <p className="text-[11px] truncate opacity-90">
                                    {msg.replyTo.content || (msg.replyTo.attachmentUrls?.length ? '📷 صورة مرفقة' : 'رسالة')}
                                  </p>
                                </div>
                              )}

                              {/* WhatsApp Multi-Image Gallery Grid */}
                              {!msg.isDeleted && msg.attachmentUrls && msg.attachmentUrls.length > 0 && (
                                <ChatGalleryGrid
                                  images={msg.attachmentUrls}
                                  isUploading={msg.isUploading}
                                  isMe={isMe}
                                  onImageClick={(idx) => openLightbox(msg.attachmentUrls, idx)}
                                />
                              )}

                              {/* Text Content */}
                              {msg.isDeleted ? (
                                <div className="flex items-center gap-1.5 py-0.5 text-foreground-muted">
                                  <FiAlertCircle className="h-3.5 w-3.5 text-foreground-subtle" />
                                  <span>تم حذف هذه الرسالة</span>
                                </div>
                              ) : (
                                msg.content && (
                                  <p className="whitespace-pre-wrap select-text font-normal mt-0.5">{msg.content}</p>
                                )
                              )}

                              {/* Send Error & Resend / Retry Action */}
                              {msg.uploadError && (
                                <div className="mt-2.5 p-2 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-between gap-2 text-rose-600 dark:text-rose-400">
                                  <div className="flex items-center gap-1.5 text-[11px] font-bold">
                                    <FiAlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
                                    <span>{msg.uploadError}</span>
                                  </div>

                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => handleRetryMessage(msg.id)}
                                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-[11px] font-extrabold shadow-sm transition-all active:scale-95 cursor-pointer"
                                      title="إعادة إرسال الرسالة"
                                    >
                                      <FiRotateCw className="h-3 w-3" />
                                      <span>إعادة الإرسال</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => handleCancelOptimisticMessage(msg.id)}
                                      className="p-1 rounded-lg hover:bg-rose-500/20 text-rose-500 text-[10px] transition-colors"
                                      title="إلغاء الرسالة"
                                    >
                                      <FiX className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                </div>
                              )}

                              {/* Bottom Time & Delivery Status */}
                              <div
                                className={`flex items-center gap-1.5 mt-1.5 text-[10px] font-mono ${
                                  isMe ? 'text-primary-foreground/75 justify-end' : 'text-foreground-subtle justify-start'
                                }`}
                              >
                                <span>{formatTime(msg.createdAt)}</span>
                                {msg.isEdited && !msg.isDeleted && (
                                  <span className="text-[9px] font-bold opacity-80">(معدلة)</span>
                                )}
                                {isMe && !msg.isUploading && !msg.uploadError && <FiCheck className="h-3.5 w-3.5" />}
                                {isMe && msg.isUploading && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-sans font-bold opacity-90">
                                    <span>جاري الإرسال</span>
                                    <div className="h-2.5 w-2.5 animate-spin rounded-full border border-primary-foreground border-t-transparent" />
                                  </span>
                                )}
                                {isMe && msg.uploadError && (
                                  <span className="inline-flex items-center gap-1 text-rose-300 font-sans font-bold">
                                    <span>فشل الإرسال</span>
                                    <FiAlertCircle className="h-3 w-3 text-rose-400" />
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Floating Reaction Badges UNDER the Bubble (Sitting between this message and the next) */}
                            {!msg.isDeleted && hasReactions && (
                              <div
                                className={`absolute -bottom-3.5 ${
                                  isMe ? 'end-1' : 'start-1'
                                } z-20 flex flex-wrap items-center gap-1.5 bg-[#181814] border border-white/20 px-2.5 py-0.5 rounded-full shadow-lg`}
                              >
                                {Object.entries(aggregatedReactions).map(([emoji, item]) => (
                                  <button
                                    key={emoji}
                                    type="button"
                                    onClick={() => handleToggleReaction(msg.id, emoji)}
                                    title={item.users.join('، ')}
                                    className={`inline-flex items-center gap-1 text-xs font-bold transition-transform active:scale-95 cursor-pointer ${
                                      item.hasReacted
                                        ? 'text-amber-400 font-black scale-110'
                                        : 'text-slate-200 hover:text-white'
                                    }`}
                                  >
                                    <span>{emoji}</span>
                                    {item.count > 1 && <span className="font-mono text-[10px] text-white font-black">{item.count}</span>}
                                  </button>
                                ))}
                              </div>
                            )}

                            {/* Quick Action Toolbar directly anchored over the bubble on Hover */}
                            {hoveredMessageId === msg.id && !msg.isUploading && !msg.isDeleted && (
                              <div
                                className={`absolute -top-10 ${
                                  isMe ? 'end-0' : 'start-0'
                                } z-40 flex items-center gap-1.5 bg-[#181814] text-white border border-white/20 px-3 py-1 rounded-full shadow-[0_10px_30px_-5px_rgba(0,0,0,0.85)] ring-1 ring-black/40 animate-in zoom-in-95 duration-100`}
                              >
                                {/* Emoji Reaction Buttons */}
                                <div className="flex items-center gap-0.5">
                                  {AVAILABLE_EMOJIS.map((item) => (
                                    <button
                                      key={item.emoji}
                                      type="button"
                                      onClick={() => handleToggleReaction(msg.id, item.emoji)}
                                      className="h-7 w-7 hover:scale-135 transition-transform flex items-center justify-center text-base active:scale-95 cursor-pointer rounded-full hover:bg-white/15"
                                      title={item.label}
                                    >
                                      {item.emoji}
                                    </button>
                                  ))}
                                </div>

                                <div className="h-4 w-px bg-white/25 mx-1" />

                                {/* Message Action Buttons */}
                                <div className="flex items-center gap-1">
                                  {/* Reply Action */}
                                  <button
                                    type="button"
                                    onClick={() => handleStartReply(msg as Message)}
                                    className="h-7 w-7 flex items-center justify-center rounded-full text-slate-200 hover:text-white hover:bg-white/20 transition-all cursor-pointer"
                                    title="رد على الرسالة"
                                  >
                                    <FiCornerDownRight className="h-4 w-4" />
                                  </button>

                                  {/* Edit Action (For Sender) */}
                                  {isMe && (
                                    <button
                                      type="button"
                                      onClick={() => handleStartEdit(msg as Message)}
                                      className="h-7 w-7 flex items-center justify-center rounded-full text-amber-300 hover:text-amber-200 hover:bg-amber-400/25 transition-all cursor-pointer"
                                      title="تعديل الرسالة"
                                    >
                                      <FiEdit2 className="h-4 w-4" />
                                    </button>
                                  )}

                                  {/* Delete Action (For Sender or Group Admin) */}
                                  {(isMe || activeConversation?.role === 'ADMIN') && (
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteMessage(msg.id)}
                                      className="h-7 w-7 flex items-center justify-center rounded-full text-rose-400 hover:text-rose-300 hover:bg-rose-500/25 transition-all cursor-pointer"
                                      title="حذف الرسالة"
                                    >
                                      <FiTrash2 className="h-4 w-4" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    </>
                  )}

                  {/* Live Typing indicator */}
                  {typingUsers.length > 0 && (
                    <div className="flex items-center gap-2 text-xs text-primary animate-pulse pt-2">
                      <div className="flex gap-1">
                        <span className="h-1.5 w-1.5 bg-primary rounded-full animate-bounce" />
                        <span className="h-1.5 w-1.5 bg-primary rounded-full animate-bounce [animation-delay:0.2s]" />
                        <span className="h-1.5 w-1.5 bg-primary rounded-full animate-bounce [animation-delay:0.4s]" />
                      </div>
                      <span>{typingUsers.join('، ')} يكتب الآن...</span>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>
              </div>

              {/* Floating Scroll-to-Bottom Button */}
              {showScrollBottomBtn && (
                <button
                  type="button"
                  onClick={() => scrollToBottom('smooth')}
                  className="absolute bottom-20 start-6 z-30 px-3.5 py-2 rounded-full bg-card/95 backdrop-blur-xl border border-white/20 text-foreground shadow-2xl hover:scale-105 hover:bg-surface-raised active:scale-95 transition-all flex items-center gap-2 text-xs font-black animate-in slide-in-from-bottom-3 duration-200"
                  title="الانتقال إلى أحدث الرسائل"
                >
                  <FiChevronDown className="h-4 w-4 text-primary animate-bounce" />
                  <span>أحدث الرسائل</span>
                </button>
              )}

              {/* Message Composer Bar */}
              <footer className="p-3 sm:p-4 border-t border-white/30 dark:border-white/10 bg-white/40 dark:bg-black/50 backdrop-blur-2xl z-10">
                {/* Active Editing Banner */}
                {editingMessage && (
                  <div className="flex items-center justify-between mb-2.5 p-2.5 rounded-2xl bg-white/60 dark:bg-white/[0.05] border border-brand-gold/40 backdrop-blur-xl border-s-4 border-s-brand-gold animate-in slide-in-from-bottom-2 duration-150">
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      <FiEdit2 className="h-4 w-4 text-brand-gold shrink-0" />
                      <div className="truncate">
                        <span className="font-extrabold text-[11px] text-brand-gold block">
                          تعديل الرسالة:
                        </span>
                        <p className="text-[11px] text-foreground-muted truncate">
                          {editingMessage.content}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingMessage(null);
                        setMessageText('');
                      }}
                      className="p-1.5 text-foreground-muted hover:text-foreground hover:bg-surface-hover rounded-xl transition-colors"
                    >
                      <FiX className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}

                {/* Active Reply Banner */}
                {replyingToMessage && !editingMessage && (
                  <div className="flex items-center justify-between mb-2.5 p-2.5 rounded-2xl bg-white/60 dark:bg-white/[0.05] border border-primary/30 backdrop-blur-xl border-s-4 border-s-primary animate-in slide-in-from-bottom-2 duration-150">
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      <FiCornerDownRight className="h-4 w-4 text-primary shrink-0" />
                      <div className="truncate">
                        <span className="font-extrabold text-[11px] text-primary block">
                          الرد على {replyingToMessage.senderEmployee?.fullName || 'رسالة'}
                        </span>
                        <p className="text-[11px] text-foreground-muted truncate">
                          {replyingToMessage.content || (replyingToMessage.attachmentUrls?.length ? '📷 صورة مرفقة' : 'رسالة')}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setReplyingToMessage(null)}
                      className="p-1.5 text-foreground-muted hover:text-foreground hover:bg-surface-hover rounded-xl transition-colors"
                    >
                      <FiX className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}

                {/* Local Selected Images Preview Bar */}
                {selectedLocalFiles.length > 0 && (
                  <div className="flex items-center gap-3 mb-2.5 p-3 rounded-2xl bg-white/60 dark:bg-white/[0.05] border border-white/40 dark:border-white/10 backdrop-blur-xl overflow-x-auto">
                    <span className="text-[11px] font-bold text-primary shrink-0">
                      تم اختيار ({selectedLocalFiles.length}) صور:
                    </span>
                    <div className="flex items-center gap-2">
                      {selectedLocalFiles.map((item, idx) => (
                        <div key={idx} className="relative h-14 w-14 rounded-xl border border-white/40 dark:border-white/10 overflow-hidden shrink-0 group shadow-xs">
                          <img src={item.localUrl} alt="Local preview" className="h-full w-full object-cover" />
                          <button
                            type="button"
                            onClick={() => removeSelectedFile(idx)}
                            className="absolute top-0.5 right-0.5 p-0.5 bg-rose-500 text-white rounded-full hover:bg-rose-600 transition-colors shadow-sm"
                          >
                            <FiX className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* UNIFIED LIQUID GLASS COMPOSER CAPSULE */}
                <form onSubmit={handleSendMessage} className="relative">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFilesSelected}
                    multiple
                    accept="image/*"
                    className="hidden"
                  />

                  <div className="flex items-end gap-2 p-1.5 rounded-3xl bg-white/60 dark:bg-white/[0.04] border border-white/60 dark:border-white/10 backdrop-blur-2xl shadow-lg shadow-black/5 dark:shadow-black/20 focus-within:border-brand-gold/60 focus-within:ring-2 focus-within:ring-brand-gold/20 transition-all duration-300">
                    {/* Attachment Gallery Button */}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="h-10 w-10 rounded-2xl flex items-center justify-center text-foreground-muted hover:text-brand-gold dark:hover:text-brand-gold hover:bg-white/80 dark:hover:bg-white/10 transition-all shrink-0 self-center active:scale-95"
                      title="إرفاق صور ومعرض (Gallery)"
                    >
                      <FiImage className="h-5 w-5" />
                    </button>

                    {/* Integrated Textarea Input */}
                    <div className="flex-1 min-w-0 py-1">
                      <textarea
                        ref={composerInputRef}
                        rows={1}
                        value={messageText}
                        onChange={(e) => {
                          setMessageText(e.target.value);
                          emitTyping(e.target.value.length > 0);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage();
                          }
                        }}
                        placeholder={editingMessage ? 'تعديل نص الرسالة...' : 'اكتب رسالتك هنا... (اضغط Enter للإرسال)'}
                        className="w-full max-h-32 bg-transparent border-none outline-none focus:outline-none focus:ring-0 text-xs text-foreground placeholder-foreground-subtle/70 resize-none px-2 py-1 leading-relaxed"
                      />
                    </div>

                    {/* Send / Save Button */}
                    <button
                      type="submit"
                      disabled={!messageText.trim() && selectedLocalFiles.length === 0}
                      className={`h-10 w-10 rounded-2xl flex items-center justify-center transition-all shrink-0 self-center shadow-md active:scale-90 ${
                        messageText.trim() || selectedLocalFiles.length > 0
                          ? 'bg-gradient-to-tr from-brand-gold to-brand-champagne text-brand-stone-950 hover:scale-105 shadow-brand-gold/30 cursor-pointer'
                          : 'bg-white/20 dark:bg-white/[0.04] text-foreground-subtle/30 cursor-not-allowed shadow-none'
                      }`}
                      title={editingMessage ? 'حفظ التعديل' : 'إرسال'}
                    >
                      {editingMessage ? (
                        <FiCheck className="h-4 w-4" />
                      ) : (
                        <FiSend className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </form>
              </footer>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-foreground-muted text-xs">
              <FiMessageSquare className="h-12 w-12 opacity-30 mb-3" />
              <h3 className="font-bold text-foreground text-base">مرحباً بك في دردشة Sync ERP</h3>
              <p className="max-w-sm text-center text-foreground-muted mt-1">
                اختر محادثة من القائمة الجانبية أو ابدأ محادثة مباشرة مع أحد زملائك بالعمل.
              </p>
            </div>
          )}

          {/* ================================================================= */}
          {/* RIGHT DRAWER: GROUP INFO & PARTICIPANTS */}
          {/* ================================================================= */}
          {showRightDrawer && activeConversation && (
            <div className="absolute inset-y-0 end-0 w-80 bg-card border-s border-border shadow-2xl z-30 flex flex-col animate-in slide-in-from-right duration-200">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <h4 className="font-bold text-xs text-foreground">معلومات المحادثة</h4>
                <button
                  onClick={() => setShowRightDrawer(false)}
                  className="p-1 text-foreground-muted hover:text-foreground rounded-lg"
                >
                  <FiX className="h-4 w-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs">
                <div className="text-center pb-4 border-b border-border">
                  <div className="h-16 w-16 mx-auto rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-black text-xl mb-2">
                    {activeConversation.title?.slice(0, 2) || 'CH'}
                  </div>
                  <h3 className="font-black text-sm text-foreground">{activeConversation.title}</h3>
                  <p className="text-foreground-muted text-[11px] mt-1">{activeConversation.description || 'لا يوجد وصف'}</p>
                </div>

                {activeConversation.isGroup && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-bold text-foreground">
                        الأعضاء المشاركون ({activeConversation.participants?.length || 0})
                      </span>
                      <button
                        onClick={() => {
                          setSelectedEmployeeIds([]);
                          setIsAddMembersModalOpen(true);
                        }}
                        className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline font-bold"
                      >
                        <FiUserPlus className="h-3.5 w-3.5" />
                        <span>إضافة عضو</span>
                      </button>
                    </div>

                    <div className="space-y-2">
                      {activeConversation.participants?.map((p) => (
                        <div key={p.id} className="flex items-center justify-between p-2.5 rounded-2xl bg-surface border border-border">
                          <div className="flex items-center gap-2.5">
                            <div className="h-8 w-8 rounded-xl bg-surface-raised flex items-center justify-center text-foreground font-bold text-[10px]">
                              {p.employee?.fullName?.slice(0, 1) || 'U'}
                            </div>
                            <div>
                              <div className="font-bold text-foreground text-[11px]">{p.employee?.fullName || p.user?.email}</div>
                              <div className="text-[9px] text-foreground-muted">{p.employee?.position?.name || 'موظف'}</div>
                            </div>
                          </div>

                          {p.role === 'ADMIN' && (
                            <span className="text-[9px] font-bold bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-md">
                              مشرف
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ===================================================================== */}
      {/* LIGHTBOX FULLSCREEN GALLERY MODAL */}
      {/* ===================================================================== */}
      {lightboxState.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="relative w-full h-full flex flex-col items-center justify-between">
            {/* Top Toolbar */}
            <div className="w-full flex items-center justify-between p-4 z-10 text-white">
              <span className="font-mono text-sm font-bold bg-white/10 px-3 py-1 rounded-full">
                {lightboxState.currentIndex + 1} / {lightboxState.images.length}
              </span>

              <div className="flex items-center gap-3">
                <a
                  href={lightboxState.images[lightboxState.currentIndex]}
                  target="_blank"
                  rel="noreferrer"
                  download
                  className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                  title="تحميل الصورة"
                >
                  <FiDownload className="h-5 w-5" />
                </a>
                <button
                  onClick={closeLightbox}
                  className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                  title="إغلاق"
                >
                  <FiX className="h-6 w-6" />
                </button>
              </div>
            </div>

            {/* Center Image Display with Left/Right Navigators */}
            <div className="relative flex-1 w-full flex items-center justify-center px-12">
              {lightboxState.images.length > 1 && (
                <button
                  onClick={prevLightboxImage}
                  className="absolute start-4 p-3 rounded-full bg-white/10 hover:bg-white/25 text-white transition-all"
                  title="الصورة السابقة"
                >
                  <FiChevronRight className="h-6 w-6" />
                </button>
              )}

              <img
                src={lightboxState.images[lightboxState.currentIndex]}
                alt="Full preview"
                className="max-h-[75vh] max-w-full object-contain rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200"
              />

              {lightboxState.images.length > 1 && (
                <button
                  onClick={nextLightboxImage}
                  className="absolute end-4 p-3 rounded-full bg-white/10 hover:bg-white/25 text-white transition-all"
                  title="الصورة التالية"
                >
                  <FiChevronLeft className="h-6 w-6" />
                </button>
              )}
            </div>

            {/* Bottom Thumbnails Strip */}
            {lightboxState.images.length > 1 && (
              <div className="flex items-center gap-2 p-4 overflow-x-auto max-w-2xl">
                {lightboxState.images.map((url, idx) => (
                  <button
                    key={idx}
                    onClick={() => setLightboxState((prev) => ({ ...prev, currentIndex: idx }))}
                    className={`h-16 w-16 rounded-xl overflow-hidden shrink-0 border-2 transition-all ${
                      idx === lightboxState.currentIndex
                        ? 'border-primary scale-105 shadow-lg'
                        : 'border-transparent opacity-50 hover:opacity-100'
                    }`}
                  >
                    <img src={url} alt={`Thumb ${idx + 1}`} className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 1: NEW DIRECT MESSAGE MODAL */}
      {/* ===================================================================== */}
      {/* ===================================================================== */}
      {/* MODAL 1: DIRECT CHAT MODAL                                            */}
      {/* ===================================================================== */}
      {isDirectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 sm:p-6 animate-in fade-in duration-200">
          <div className="relative overflow-hidden w-full max-w-md max-h-[85vh] flex flex-col rounded-3xl border border-white/30 dark:border-white/10 bg-white/90 dark:bg-[#141411]/95 backdrop-blur-3xl shadow-2xl">
            {/* Top Specular Rim */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent z-10" />

            <div className="px-6 py-5 border-b border-border/30 dark:border-white/10 flex items-center justify-between bg-surface/40 shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shadow-inner">
                  <FiMessageSquare className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-foreground">بدء محادثة مباشرة</h3>
                  <p className="text-[11px] text-foreground-muted">اختر زميل العمل لبدء التواصل الفوري</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDirectModalOpen(false)}
                className="h-8 w-8 rounded-xl flex items-center justify-center text-foreground-muted hover:text-foreground hover:bg-surface-hover transition-colors"
                title="إغلاق"
              >
                <FiX className="h-4 w-4" />
              </button>
            </div>

            <div className="px-6 py-4 border-b border-border/20 bg-surface/20 shrink-0">
              <div className="relative">
                <FiSearch className="absolute start-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-muted" />
                <input
                  type="text"
                  placeholder="ابحث بالاسم أو القسم أو المسمى الوظيفي..."
                  value={directSearch}
                  onChange={(e) => setDirectSearch(e.target.value)}
                  className="w-full rounded-2xl border border-border/80 dark:border-white/10 bg-surface/80 ps-10 pe-4 py-2.5 text-xs text-foreground placeholder:text-foreground-subtle focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-1.5 divide-y divide-border/10">
              {employeesData?.data
                ?.filter((emp) => emp.user?.id !== user?.id)
                ?.filter((emp) => emp.fullName.toLowerCase().includes(directSearch.toLowerCase()))
                ?.map((emp) => (
                  <button
                    key={emp.id}
                    onClick={() => emp.user?.id && handleStartDirectChat(emp.user.id)}
                    className="w-full flex items-center justify-between p-3 rounded-2xl hover:bg-surface-hover transition-all text-start group border border-transparent hover:border-border/40"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-brand-taupe to-brand-gold dark:from-brand-gold dark:to-brand-champagne text-white dark:text-brand-stone-950 flex items-center justify-center text-xs font-black shadow-xs">
                        {emp.fullName.slice(0, 1)}
                      </div>
                      <div>
                        <div className="font-bold text-xs text-foreground group-hover:text-primary transition-colors">{emp.fullName}</div>
                        <div className="text-[11px] text-foreground-muted">{emp.position?.name || 'موظف'} • {emp.department?.name || 'الشركة'}</div>
                      </div>
                    </div>

                    <span className="text-xs text-primary font-black px-3 py-1 rounded-xl bg-primary/10 border border-primary/20 group-hover:bg-primary group-hover:text-brand-stone-950 transition-all">
                      مراسلة
                    </span>
                  </button>
                ))}
            </div>

            <div className="px-6 py-4 border-t border-border/30 dark:border-white/10 bg-surface/60 dark:bg-white/[0.02] backdrop-blur-xl flex items-center justify-end shrink-0">
              <button
                type="button"
                onClick={() => setIsDirectModalOpen(false)}
                className="rounded-2xl border border-border/80 bg-surface px-5 py-2.5 text-xs font-bold text-foreground hover:bg-surface-hover transition-colors shadow-xs"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 2: CREATE GROUP CHAT MODAL */}
      {/* ===================================================================== */}
      {isGroupModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 sm:p-6 animate-in fade-in duration-200">
          <div className="relative overflow-hidden w-full max-w-lg max-h-[88vh] flex flex-col rounded-3xl border border-white/30 dark:border-white/10 bg-white/90 dark:bg-[#141411]/95 backdrop-blur-3xl shadow-2xl">
            {/* Top Specular Rim */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent z-10" />

            <div className="px-6 py-5 border-b border-border/30 dark:border-white/10 flex items-center justify-between bg-surface/40 shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shadow-inner">
                  <FiUsers className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-foreground">إنشاء مجموعة عمل أو قناة عامة</h3>
                  <p className="text-[11px] text-foreground-muted">مساحة عمل مخصصة للفرق والأقسام والمشاريع</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsGroupModalOpen(false)}
                className="h-8 w-8 rounded-xl flex items-center justify-center text-foreground-muted hover:text-foreground hover:bg-surface-hover transition-colors"
                title="إغلاق"
              >
                <FiX className="h-4 w-4" />
              </button>
            </div>

            <form id="create-group-form" onSubmit={handleCreateGroupSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-4 text-xs">
              <div>
                <label className="block text-foreground font-bold mb-1.5">
                  اسم المجموعة / القناة <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={groupTitle}
                  onChange={(e) => setGroupTitle(e.target.value)}
                  placeholder="مثال: فريق الهندسة والتطوير، أو # الإعلانات العامة"
                  className="w-full rounded-2xl border border-border/80 dark:border-white/10 bg-surface/80 px-4 py-2.5 text-xs text-foreground placeholder:text-foreground-subtle focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-foreground font-bold mb-1.5">نوع القناة</label>
                  <select
                    value={groupType}
                    onChange={(e) => setGroupType(e.target.value as any)}
                    className="w-full rounded-2xl border border-border/80 dark:border-white/10 bg-surface/80 px-3.5 py-2.5 text-xs text-foreground focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="WORK_GROUP">🔒 مجموعة خاصة (بدعوة الأعضاء)</option>
                    <option value="PUBLIC_GROUP">🌐 قناة عامة (متاحة للجميع)</option>
                  </select>
                </div>

                {groupType === 'WORK_GROUP' && (
                  <div>
                    <label className="block text-foreground font-bold mb-1.5">القسم المرتبط (اختياري)</label>
                    <select
                      value={groupDepartmentId}
                      onChange={(e) => setGroupDepartmentId(e.target.value)}
                      className="w-full rounded-2xl border border-border/80 dark:border-white/10 bg-surface/80 px-3.5 py-2.5 text-xs text-foreground focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      <option value="">عام لكافة الأقسام</option>
                      {departments.map((dept) => (
                        <option key={dept.id} value={dept.id}>
                          {dept.name} ({dept.code})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-foreground font-bold mb-1.5">الوصف والهدف</label>
                <textarea
                  rows={2}
                  value={groupDescription}
                  onChange={(e) => setGroupDescription(e.target.value)}
                  placeholder="اكتب نبذة عن موضوع وغرض هذه المجموعة..."
                  className="w-full rounded-2xl border border-border/80 dark:border-white/10 bg-surface/80 p-3 text-xs text-foreground placeholder:text-foreground-subtle focus:bg-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                />
              </div>

              {/* Members Selection */}
              {groupType === 'WORK_GROUP' && (
                <div className="space-y-2 p-3.5 rounded-2xl bg-surface/40 border border-border/40 dark:border-white/5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <FiUsers className="h-3.5 w-3.5 text-primary" />
                      <span>اختيار أعضاء المجموعة ({selectedEmployeeIds.length})</span>
                    </label>
                    <span className="text-[11px] text-foreground-muted">حدد الأعضاء المنضمين</span>
                  </div>

                  <div className="max-h-48 overflow-y-auto space-y-1 p-2 rounded-2xl border border-border/60 bg-surface">
                    {employeesData?.data
                      ?.filter((emp) => emp.user?.id !== user?.id)
                      ?.map((emp) => {
                        const targetId = emp.user?.id || emp.id;
                        const isSelected = selectedEmployeeIds.includes(targetId);
                        return (
                          <label
                            key={emp.id}
                            className={`flex items-center justify-between p-2.5 rounded-xl transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-primary/10 border border-primary/20 text-primary'
                                : 'hover:bg-surface-hover text-foreground'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedEmployeeIds((prev) => [...prev, targetId]);
                                  } else {
                                    setSelectedEmployeeIds((prev) => prev.filter((id) => id !== targetId));
                                  }
                                }}
                                className="rounded-md border-border text-primary focus:ring-primary h-4 w-4"
                              />
                              <div>
                                <span className="font-bold text-xs">{emp.fullName}</span>
                                <span className="text-[10px] text-foreground-muted block">({emp.department?.name || 'الشركة'})</span>
                              </div>
                            </div>
                            <span className="text-[10px] font-mono text-foreground-muted">{emp.position?.name || ''}</span>
                          </label>
                        );
                      })}
                  </div>
                </div>
              )}
            </form>

            <div className="px-6 py-4 border-t border-border/30 dark:border-white/10 bg-surface/60 dark:bg-white/[0.02] backdrop-blur-xl flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setIsGroupModalOpen(false)}
                className="rounded-2xl border border-border/80 bg-surface px-5 py-2.5 text-xs font-bold text-foreground hover:bg-surface-hover transition-colors shadow-xs"
              >
                إلغاء
              </button>
              <button
                form="create-group-form"
                type="submit"
                disabled={createGroupMutation.isPending}
                className="rounded-2xl btn-glow-primary px-6 py-2.5 text-xs font-black text-brand-stone-950 shadow-md active:scale-95 disabled:opacity-50 transition-all"
              >
                {createGroupMutation.isPending ? 'جاري الإنشاء...' : 'إنشاء المجموعة'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 3: ADD MEMBERS MODAL */}
      {/* ===================================================================== */}
      {isAddMembersModalOpen && activeConversation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 sm:p-6 animate-in fade-in duration-200">
          <div className="relative overflow-hidden w-full max-w-md max-h-[85vh] flex flex-col rounded-3xl border border-white/30 dark:border-white/10 bg-white/90 dark:bg-[#141411]/95 backdrop-blur-3xl shadow-2xl">
            {/* Top Specular Rim */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent z-10" />

            <div className="px-6 py-5 border-b border-border/30 dark:border-white/10 flex items-center justify-between bg-surface/40 shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shadow-inner">
                  <FiUserPlus className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-foreground">إضافة أعضاء جدد</h3>
                  <p className="text-[11px] text-foreground-muted truncate max-w-[220px]">إلى {activeConversation.title}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddMembersModalOpen(false)}
                className="h-8 w-8 rounded-xl flex items-center justify-center text-foreground-muted hover:text-foreground hover:bg-surface-hover transition-colors"
                title="إغلاق"
              >
                <FiX className="h-4 w-4" />
              </button>
            </div>

            <form id="add-members-form" onSubmit={handleAddMembersSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-4 text-xs">
              <div className="max-h-64 overflow-y-auto space-y-1.5 p-2 rounded-2xl border border-border/60 bg-surface">
                {employeesData?.data
                  ?.filter((emp) => !activeConversation.participants?.some((p) => p.userId === emp.user?.id || p.employeeId === emp.id))
                  ?.map((emp) => {
                    const targetId = emp.user?.id || emp.id;
                    const isSelected = selectedEmployeeIds.includes(targetId);
                    return (
                      <label
                        key={emp.id}
                        className={`flex items-center justify-between p-2.5 rounded-xl transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-primary/10 border border-primary/20 text-primary'
                            : 'hover:bg-surface-hover text-foreground'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedEmployeeIds((prev) => [...prev, targetId]);
                              } else {
                                setSelectedEmployeeIds((prev) => prev.filter((id) => id !== targetId));
                              }
                            }}
                            className="rounded-md border-border text-primary focus:ring-primary h-4 w-4"
                          />
                          <div>
                            <div className="font-bold text-xs">{emp.fullName}</div>
                            <div className="text-[10px] text-foreground-muted">{emp.position?.name || 'موظف'} • {emp.department?.name || 'الشركة'}</div>
                          </div>
                        </div>
                      </label>
                    );
                  })}
              </div>
            </form>

            <div className="px-6 py-4 border-t border-border/30 dark:border-white/10 bg-surface/60 dark:bg-white/[0.02] backdrop-blur-xl flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setIsAddMembersModalOpen(false)}
                className="rounded-2xl border border-border/80 bg-surface px-5 py-2.5 text-xs font-bold text-foreground hover:bg-surface-hover transition-colors shadow-xs"
              >
                إلغاء
              </button>
              <button
                form="add-members-form"
                type="submit"
                disabled={selectedEmployeeIds.length === 0 || addParticipantsMutation.isPending}
                className="rounded-2xl btn-glow-primary px-6 py-2.5 text-xs font-black text-brand-stone-950 shadow-md active:scale-95 disabled:opacity-50 transition-all"
              >
                {addParticipantsMutation.isPending ? 'جاري الإضافة...' : `إضافة (${selectedEmployeeIds.length})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

