'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  MessageSquare,
  Users,
  Hash,
  Send,
  Paperclip,
  Image as ImageIcon,
  Search,
  Plus,
  MoreVertical,
  Check,
  CheckCheck,
  Smile,
  Phone,
  Video,
  Info,
  ChevronRight,
  ChevronLeft,
  Shield,
  UserPlus,
  X,
  Sparkles,
  Lock,
  Building2,
  Calendar,
  Layers,
  Circle,
  FileText,
  AlertCircle,
  Loader2,
  Download,
  ExternalLink,
  Maximize2,
  Camera,
  CornerDownRight,
  Reply,
  Heart,
  ThumbsUp,
  Flame,
  Laugh,
  PartyPopper,
  Rocket,
  Mic,
  Copy,
} from 'lucide-react';
import { useAuth } from '../../../hooks/use-auth';
import { useEmployees } from '../../../hooks/use-employees';
import { useOrganizationTree } from '../../../hooks/use-organization';
import {
  useConversations,
  useConversationDetails,
  useMessages,
  useSendMessage,
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
    <div className="relative my-1.5 overflow-hidden rounded-2xl border border-white/10 shadow-md">
      {/* 1 Image: Large Showcase */}
      {count === 1 && (
        <div
          onClick={() => onImageClick(0)}
          className="relative group cursor-pointer overflow-hidden max-h-80 max-w-sm sm:max-w-md bg-slate-950"
        >
          <img
            src={images[0]}
            alt="Chat attachment"
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <Maximize2 className="h-6 w-6 text-white drop-shadow-md" />
          </div>
        </div>
      )}

      {/* 2 Images: 2 Equal Columns */}
      {count === 2 && (
        <div className="grid grid-cols-2 gap-1 max-w-sm sm:max-w-md bg-slate-950">
          {images.map((url, idx) => (
            <div
              key={idx}
              onClick={() => onImageClick(idx)}
              className="relative aspect-square group cursor-pointer overflow-hidden bg-slate-900"
            >
              <img
                src={url}
                alt={`Attachment ${idx + 1}`}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Maximize2 className="h-5 w-5 text-white drop-shadow-md" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 3 Images: 1 Tall on Left + 2 Stacked on Right */}
      {count === 3 && (
        <div className="grid grid-cols-2 grid-rows-2 gap-1 max-w-sm sm:max-w-md h-72 bg-slate-950">
          <div
            onClick={() => onImageClick(0)}
            className="row-span-2 relative group cursor-pointer overflow-hidden bg-slate-900"
          >
            <img
              src={images[0]}
              alt="Attachment 1"
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Maximize2 className="h-5 w-5 text-white" />
            </div>
          </div>
          {images.slice(1, 3).map((url, idx) => (
            <div
              key={idx}
              onClick={() => onImageClick(idx + 1)}
              className="relative group cursor-pointer overflow-hidden bg-slate-900"
            >
              <img
                src={url}
                alt={`Attachment ${idx + 2}`}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Maximize2 className="h-4 w-4 text-white" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 4 or More Images: 2x2 Grid with +N Badge for Overflow */}
      {count >= 4 && (
        <div className="grid grid-cols-2 grid-rows-2 gap-1 max-w-sm sm:max-w-md h-72 bg-slate-950">
          {images.slice(0, 3).map((url, idx) => (
            <div
              key={idx}
              onClick={() => onImageClick(idx)}
              className="relative group cursor-pointer overflow-hidden bg-slate-900"
            >
              <img
                src={url}
                alt={`Attachment ${idx + 1}`}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Maximize2 className="h-5 w-5 text-white" />
              </div>
            </div>
          ))}

          {/* 4th Item with Remaining Counter Overlay if count > 4 */}
          <div
            onClick={() => onImageClick(3)}
            className="relative group cursor-pointer overflow-hidden bg-slate-900"
          >
            <img
              src={images[3]}
              alt="Attachment 4"
              className="w-full h-full object-cover"
            />
            {count > 4 ? (
              <div className="absolute inset-0 bg-black/65 backdrop-blur-[2px] flex flex-col items-center justify-center text-white transition-all group-hover:bg-black/55">
                <span className="text-xl sm:text-2xl font-black font-mono tracking-tight">+{count - 3}</span>
                <span className="text-[10px] font-semibold text-slate-300">صور إضافية</span>
              </div>
            ) : (
              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Maximize2 className="h-5 w-5 text-white" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* In-Chat Uploading Spinner Indicator Overlay */}
      {isUploading && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center text-white gap-2 z-10 animate-in fade-in duration-150">
          <div className="relative">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
            <Sparkles className="h-3.5 w-3.5 text-amber-400 absolute -top-1 -right-1 animate-pulse" />
          </div>
          <span className="text-xs font-bold text-slate-200">جاري رفع الصور ومشاركتها...</span>
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const composerInputRef = useRef<HTMLTextAreaElement>(null);

  // Queries
  const { data: conversations = [], isLoading: isConversationsLoading } = useConversations();
  const { data: activeConversation } = useConversationDetails(activeConvId);
  const { data: messagesData, isLoading: isMessagesLoading } = useMessages(activeConvId);
  const { data: employeesData } = useEmployees({ page: 1, limit: 100 });
  const { data: departments = [] } = useOrganizationTree();

  // Mutations
  const sendMessageMutation = useSendMessage();
  const createDirectMutation = useCreateDirectConversation();
  const createGroupMutation = useCreateGroup();
  const addParticipantsMutation = useAddParticipants(activeConvId || '');
  const markAsReadMutation = useMarkAsRead();
  const toggleReactionMutation = useToggleReaction();

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

  // Auto-scroll
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messagesData?.messages, optimisticMessages, typingUsers]);

  // Merge Server Messages with Active Local Optimistic Messages
  const combinedMessages = useMemo(() => {
    const serverMsgs = messagesData?.messages || [];
    const activeOptimistic = optimisticMessages.filter((m) => m.conversationId === activeConvId);
    return [...serverMsgs, ...activeOptimistic];
  }, [messagesData?.messages, optimisticMessages, activeConvId]);

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
    composerInputRef.current?.focus();
  };

  // Scroll to a quoted message
  const handleScrollToMessage = (messageId: string) => {
    const element = document.getElementById(`message-${messageId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.classList.add('ring-2', 'ring-indigo-500', 'bg-indigo-950/30');
      setTimeout(() => {
        element.classList.remove('ring-2', 'ring-indigo-500', 'bg-indigo-950/30');
      }, 2000);
    }
  };

  // Handle In-Chat Instant Send
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if ((!messageText.trim() && selectedLocalFiles.length === 0) || !activeConvId) return;

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
        console.error('Failed to upload image(s):', err);
        setOptimisticMessages((prev) =>
          prev.map((m) =>
            m.id === tempId ? { ...m, isUploading: false, uploadError: 'فشل رفع الصور. يرجى المحاولة ثانية.' } : m,
          ),
        );
      }
    } else {
      // Regular text message
      try {
        await sendMessageMutation.mutateAsync({
          conversationId: activeConvId,
          content: textToSend,
          type: 'TEXT',
          attachmentUrls: [],
          replyToId: replyTarget?.id,
        });
        scrollToBottom();
      } catch (err: any) {
        console.error('Failed to send text message:', err);
      }
    }
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
    <div dir="rtl" className="h-[calc(100vh-5rem)] flex flex-col font-sans bg-slate-950 text-slate-100 rounded-3xl overflow-hidden border border-slate-800 shadow-2xl relative">
      <div className="flex-1 flex overflow-hidden">
        {/* =================================================================== */}
        {/* LEFT SIDEBAR: CONVERSATIONS & CHANNELS LIST */}
        {/* =================================================================== */}
        <aside className="w-full md:w-80 lg:w-96 border-l border-slate-800/80 bg-slate-900/90 backdrop-blur-2xl flex flex-col shrink-0 z-10">
          {/* Top Header */}
          <div className="p-4.5 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-700 flex items-center justify-center text-white shadow-md shadow-indigo-600/30">
                <MessageSquare className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-white tracking-tight">غرف الدردشة</h2>
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium">
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
                className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition-all hover:scale-105"
                title="محادثة مباشرة جديدة"
              >
                <Plus className="h-4 w-4" />
              </button>
              <button
                onClick={() => {
                  setSelectedEmployeeIds([]);
                  setIsGroupModalOpen(true);
                }}
                className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30 transition-all hover:scale-105"
                title="إنشاء مجموعة عمل أو قناة عامة"
              >
                <Users className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Quick Search Bar */}
          <div className="p-3 border-b border-slate-800/60 bg-slate-950/20">
            <div className="relative">
              <Search className="absolute start-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="البحث في القنوات والمحادثات..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-slate-950/80 ps-9 pe-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none transition-all"
              />
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1 p-2 border-b border-slate-800/60 bg-slate-950/40 text-[11px] font-bold">
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
                    ? 'bg-indigo-600 text-white shadow-sm font-extrabold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1 divide-y divide-slate-800/20 scrollbar-thin">
            {isConversationsLoading ? (
              <div className="flex flex-col items-center justify-center p-12 space-y-2 text-slate-400 text-xs">
                <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
                <span>جاري مزامنة المحادثات...</span>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="text-center p-10 text-slate-500 text-xs">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <span>لا توجد محادثات مطابقة.</span>
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const isActive = conv.id === activeConvId;

                return (
                  <button
                    key={conv.id}
                    onClick={() => setActiveConvId(conv.id)}
                    className={`w-full text-start p-3 rounded-2xl transition-all flex items-start gap-3 group relative ${
                      isActive
                        ? 'bg-indigo-600/20 border border-indigo-500/50 text-white shadow-sm'
                        : 'hover:bg-slate-800/50 text-slate-300 border border-transparent'
                    }`}
                  >
                    {/* Icon / Avatar */}
                    <div className="relative shrink-0 mt-0.5">
                      {conv.type === 'PUBLIC_GROUP' ? (
                        <div className="h-11 w-11 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold shadow-inner">
                          <Hash className="h-5 w-5" />
                        </div>
                      ) : conv.type === 'WORK_GROUP' ? (
                        <div className="h-11 w-11 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold shadow-inner">
                          <Users className="h-5 w-5" />
                        </div>
                      ) : conv.avatarUrl ? (
                        <img
                          src={conv.avatarUrl}
                          alt={conv.title || 'User'}
                          className="h-11 w-11 rounded-2xl object-cover border border-slate-700 shadow-sm"
                        />
                      ) : (
                        <div className="h-11 w-11 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-200 font-bold text-xs">
                          {conv.title?.slice(0, 2) || 'DM'}
                        </div>
                      )}

                      {conv.type === 'DIRECT' && (
                        <span className="absolute -bottom-0.5 -start-0.5 h-3.5 w-3.5 rounded-full bg-emerald-500 ring-2 ring-slate-900 shadow-sm" />
                      )}
                    </div>

                    {/* Meta & Snippet */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="font-bold text-xs truncate text-slate-100 group-hover:text-white">
                          {conv.title}
                        </span>
                        {conv.lastMessage && (
                          <span className="text-[10px] font-mono text-slate-500 shrink-0">
                            {formatTime(conv.lastMessage.createdAt)}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[11px] text-slate-400 truncate font-medium">
                          {conv.lastMessage ? (
                            <span>
                              <strong className="text-slate-300 font-semibold">{conv.lastMessage.senderName}: </strong>
                              {conv.lastMessage.content}
                            </span>
                          ) : (
                            <span className="italic text-slate-500">لا توجد رسائل سابقة</span>
                          )}
                        </p>

                        {conv.unreadCount > 0 && (
                          <span className="shrink-0 rounded-full bg-indigo-600 px-2.5 py-0.5 text-[10px] font-mono font-black text-white shadow-md shadow-indigo-600/40 animate-pulse">
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

        {/* =================================================================== */}
        {/* MAIN CHAT AREA (HEADER + GALLERY + COMPOSER) */}
        {/* =================================================================== */}
        <section className="flex-1 flex flex-col bg-[#080d1a] relative overflow-hidden">
          {/* Subtle WhatsApp-style Wallpaper Pattern */}
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[radial-gradient(#6366f1_1px,transparent_1px)] [background-size:20px_20px]" />

          {activeConversation ? (
            <>
              {/* Chat Room Top Bar */}
              <header className="h-16 px-5 border-b border-slate-800/80 bg-slate-900/80 backdrop-blur-xl flex items-center justify-between shrink-0 z-10">
                <div className="flex items-center gap-3.5 overflow-hidden">
                  <div className="h-10 w-10 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 shadow-sm">
                    {activeConversation.type === 'PUBLIC_GROUP' ? (
                      <Hash className="h-5 w-5 text-amber-400" />
                    ) : activeConversation.type === 'WORK_GROUP' ? (
                      <Users className="h-5 w-5 text-indigo-400" />
                    ) : (
                      <MessageSquare className="h-5 w-5 text-emerald-400" />
                    )}
                  </div>

                  <div className="truncate">
                    <div className="flex items-center gap-2">
                      <h3 className="font-extrabold text-sm text-white truncate">{activeConversation.title}</h3>
                      <span
                        className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                          activeConversation.type === 'PUBLIC_GROUP'
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            : activeConversation.type === 'WORK_GROUP'
                            ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        }`}
                      >
                        {activeConversation.type === 'PUBLIC_GROUP'
                          ? 'قناة عامة'
                          : activeConversation.type === 'WORK_GROUP'
                          ? 'مجموعة عمل'
                          : 'محادثة مباشرة'}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-400 truncate">
                      {activeConversation.isGroup
                        ? `${activeConversation.participants?.length || 0} أعضاء • ${
                            activeConversation.description || 'لا يوجد وصف'
                          }`
                        : activeConversation.counterpartEmployee?.position?.name || 'محادثة مشفرة'}
                    </p>
                  </div>
                </div>

                {/* Right Bar Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowRightDrawer(!showRightDrawer)}
                    className={`p-2.5 rounded-xl border transition-all ${
                      showRightDrawer
                        ? 'bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-600/30'
                        : 'border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800'
                    }`}
                    title="تفاصيل المجموعة والأعضاء"
                  >
                    <Info className="h-4 w-4" />
                  </button>
                </div>
              </header>

              {/* Messages Thread Window */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-1 relative scrollbar-thin">
                {isMessagesLoading ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-500 text-xs">
                    <Loader2 className="h-8 w-8 animate-spin text-indigo-500 mb-2" />
                    <span>جاري تحميل سجل المحادثة...</span>
                  </div>
                ) : combinedMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-500 text-xs text-center p-8">
                    <div className="h-16 w-16 rounded-3xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-3 shadow-inner">
                      <Sparkles className="h-8 w-8" />
                    </div>
                    <h4 className="font-bold text-slate-200 text-sm">بداية محادثة جديدة</h4>
                    <p className="max-w-xs mt-1 text-slate-400">
                      أرسل أول رسالة أو شارك مجموعة صور لبدء التواصل الفوري مع الزملاء.
                    </p>
                  </div>
                ) : (
                  combinedMessages.map((msg, index) => {
                    const isMe = msg.senderId === user?.id;

                    // Grouping Logic: Detect if previous and next messages are from same sender
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

                    // Aggregate reactions: { '👍': { count: 2, users: ['Ahmed', 'Sara'], hasReacted: true } }
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

                    // System Message
                    if (msg.type === 'SYSTEM') {
                      return (
                        <div key={msg.id} className="flex justify-center my-3">
                          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[11px] font-semibold bg-slate-900/90 border border-slate-800 text-slate-300 shadow-sm">
                            <Info className="h-3.5 w-3.5 text-indigo-400" />
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
                        className={`flex items-end gap-2.5 group relative transition-all rounded-2xl ${
                          isSameSenderAsPrev ? 'mt-1' : 'mt-4'
                        } ${isMe ? 'justify-start flex-row-reverse' : 'justify-start'}`}
                      >
                        {/* Avatar Column (Show only on the LAST message of consecutive group for others) */}
                        {!isMe && (
                          <div className="w-8 shrink-0 flex items-center justify-center">
                            {!isSameSenderAsNext ? (
                              <div className="h-8 w-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-slate-300 shrink-0 overflow-hidden shadow-sm">
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
                        <div className={`max-w-md sm:max-w-lg lg:max-w-xl flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                          {/* Sender Name in groups (Show only on the FIRST message in consecutive group) */}
                          {!isMe && activeConversation.isGroup && !isSameSenderAsPrev && (
                            <span className="text-[11px] font-extrabold text-indigo-400 mb-1 ps-1.5">
                              {msg.senderEmployee?.fullName || msg.sender?.email}
                            </span>
                          )}

                          <div
                            className={`p-3.5 rounded-3xl shadow-md text-xs leading-relaxed relative ${
                              isMe
                                ? 'bg-gradient-to-tr from-indigo-600 via-indigo-600 to-indigo-700 text-white rounded-br-xs'
                                : 'bg-slate-900/95 border border-slate-800 text-slate-100 rounded-bl-xs'
                            }`}
                          >
                            {/* Quoted Reply Banner (if this message is replying to another) */}
                            {msg.replyTo && (
                              <div
                                onClick={() => msg.replyTo?.id && handleScrollToMessage(msg.replyTo.id)}
                                className={`mb-2 p-2.5 rounded-2xl border-s-4 cursor-pointer transition-all ${
                                  isMe
                                    ? 'bg-black/20 border-white/80 hover:bg-black/30 text-indigo-100'
                                    : 'bg-slate-950/80 border-indigo-500 hover:bg-slate-950 text-slate-300'
                                }`}
                              >
                                <div className="flex items-center gap-1.5 font-bold text-[10px] text-indigo-300 mb-0.5">
                                  <Reply className="h-3 w-3 rotate-180" />
                                  <span>{msg.replyTo.senderEmployee?.fullName || 'رسالة سابقة'}</span>
                                </div>
                                <p className="text-[11px] truncate opacity-90">
                                  {msg.replyTo.content || (msg.replyTo.attachmentUrls?.length ? '📷 صورة مرفقة' : 'رسالة')}
                                </p>
                              </div>
                            )}

                            {/* WhatsApp Multi-Image Gallery Grid */}
                            {msg.attachmentUrls && msg.attachmentUrls.length > 0 && (
                              <ChatGalleryGrid
                                images={msg.attachmentUrls}
                                isUploading={msg.isUploading}
                                isMe={isMe}
                                onImageClick={(idx) => openLightbox(msg.attachmentUrls, idx)}
                              />
                            )}

                            {/* Text Content */}
                            {msg.content && (
                              <p className="whitespace-pre-wrap select-text font-normal mt-0.5">{msg.content}</p>
                            )}

                            {/* Upload Error feedback */}
                            {msg.uploadError && (
                              <div className="mt-2 text-[10px] text-rose-300 bg-rose-950/60 border border-rose-800 p-2 rounded-xl flex items-center gap-1.5 font-semibold">
                                <AlertCircle className="h-3.5 w-3.5 text-rose-400 shrink-0" />
                                <span>{msg.uploadError}</span>
                              </div>
                            )}

                            {/* Bottom Time & Delivery Status */}
                            <div
                              className={`flex items-center gap-1 mt-1.5 text-[10px] font-mono ${
                                isMe ? 'text-indigo-200 justify-end' : 'text-slate-400 justify-start'
                              }`}
                            >
                              <span>{formatTime(msg.createdAt)}</span>
                              {isMe && !msg.isUploading && <CheckCheck className="h-3.5 w-3.5 text-indigo-300" />}
                              {msg.isUploading && <Loader2 className="h-3 w-3 animate-spin text-indigo-300" />}
                            </div>

                            {/* Aggregated Reaction Badges on Bubble */}
                            {Object.keys(aggregatedReactions).length > 0 && (
                              <div className="flex flex-wrap items-center gap-1 mt-2 pt-1 border-t border-white/10">
                                {Object.entries(aggregatedReactions).map(([emoji, item]) => (
                                  <button
                                    key={emoji}
                                    onClick={() => handleToggleReaction(msg.id, emoji)}
                                    title={item.users.join('، ')}
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold transition-transform active:scale-95 ${
                                      item.hasReacted
                                        ? 'bg-indigo-500/40 border border-indigo-400 text-white'
                                        : 'bg-black/40 border border-white/10 text-slate-300 hover:bg-black/60'
                                    }`}
                                  >
                                    <span>{emoji}</span>
                                    {item.count > 1 && <span className="font-mono text-[10px]">{item.count}</span>}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Quick Actions (Reply + Emoji Reactions) on Hover */}
                        {hoveredMessageId === msg.id && !msg.isUploading && (
                          <div
                            className={`absolute -top-8 ${
                              isMe ? 'start-10' : 'end-10'
                            } z-20 flex items-center gap-1 bg-slate-900 border border-slate-700/80 px-2 py-1 rounded-full shadow-2xl animate-in zoom-in-95 duration-100`}
                          >
                            {/* Reply Action Button */}
                            <button
                              onClick={() => handleStartReply(msg as Message)}
                              className="p-1 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors"
                              title="رد على الرسالة"
                            >
                              <Reply className="h-3.5 w-3.5" />
                            </button>

                            <div className="h-3 w-px bg-slate-700 mx-0.5" />

                            {/* Emoji Reaction Buttons */}
                            {AVAILABLE_EMOJIS.map((item) => (
                              <button
                                key={item.emoji}
                                onClick={() => handleToggleReaction(msg.id, item.emoji)}
                                className="h-6 w-6 hover:scale-130 transition-transform flex items-center justify-center text-xs"
                                title={item.label}
                              >
                                {item.emoji}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}

                {/* Live Typing indicator */}
                {typingUsers.length > 0 && (
                  <div className="flex items-center gap-2 text-xs text-indigo-400 animate-pulse pt-2">
                    <div className="flex gap-1">
                      <span className="h-1.5 w-1.5 bg-indigo-400 rounded-full animate-bounce" />
                      <span className="h-1.5 w-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                      <span className="h-1.5 w-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                    </div>
                    <span>{typingUsers.join('، ')} يكتب الآن...</span>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Message Composer Bar */}
              <footer className="p-3 sm:p-4 border-t border-slate-800/80 bg-slate-900/90 backdrop-blur-2xl z-10">
                {/* Active Reply Banner (Quoting previous message) */}
                {replyingToMessage && (
                  <div className="flex items-center justify-between mb-2 p-2.5 rounded-2xl bg-slate-950 border border-slate-800 border-s-4 border-s-indigo-500 animate-in slide-in-from-bottom-2 duration-150">
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      <Reply className="h-4 w-4 text-indigo-400 shrink-0" />
                      <div className="truncate">
                        <span className="font-extrabold text-[11px] text-indigo-400 block">
                          الرد على {replyingToMessage.senderEmployee?.fullName || 'رسالة'}
                        </span>
                        <p className="text-[11px] text-slate-400 truncate">
                          {replyingToMessage.content || (replyingToMessage.attachmentUrls?.length ? '📷 صورة مرفقة' : 'رسالة')}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setReplyingToMessage(null)}
                      className="p-1 text-slate-400 hover:text-white rounded-lg"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}

                {/* Local Selected Images Preview Bar (Before Sending) */}
                {selectedLocalFiles.length > 0 && (
                  <div className="flex items-center gap-3 mb-3 p-3 rounded-2xl bg-slate-950 border border-slate-800 overflow-x-auto">
                    <span className="text-[11px] font-bold text-indigo-400 shrink-0">
                      تم اختيار ({selectedLocalFiles.length}) صور:
                    </span>
                    <div className="flex items-center gap-2">
                      {selectedLocalFiles.map((item, idx) => (
                        <div key={idx} className="relative h-14 w-14 rounded-xl border border-slate-700 overflow-hidden shrink-0 group">
                          <img src={item.localUrl} alt="Local preview" className="h-full w-full object-cover" />
                          <button
                            type="button"
                            onClick={() => removeSelectedFile(idx)}
                            className="absolute top-0.5 right-0.5 p-0.5 bg-rose-600/90 text-white rounded-full hover:bg-rose-500 transition-colors"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <form onSubmit={handleSendMessage} className="flex items-end gap-2.5">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFilesSelected}
                    multiple
                    accept="image/*"
                    className="hidden"
                  />

                  {/* Multi-Photo Attachment Button */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-3 rounded-2xl border border-slate-800 bg-slate-950 text-slate-300 hover:text-white hover:border-slate-700 hover:bg-slate-900 transition-all flex items-center gap-1.5"
                    title="إرفاق صور ومعرض (Gallery)"
                  >
                    <ImageIcon className="h-5 w-5 text-indigo-400" />
                  </button>

                  {/* Textarea Input */}
                  <div className="flex-1 relative">
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
                      placeholder="اكتب رسالتك هنا... (اضغط Enter للإرسال المباشر)"
                      className="w-full max-h-32 rounded-2xl border border-slate-800 bg-slate-950/90 p-3.5 text-xs text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none resize-none shadow-inner"
                    />
                  </div>

                  {/* Send Button */}
                  <button
                    type="submit"
                    disabled={!messageText.trim() && selectedLocalFiles.length === 0}
                    className="p-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-all hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                    title="إرسال"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </form>
              </footer>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 text-xs">
              <MessageSquare className="h-12 w-12 text-slate-700 mb-3" />
              <h3 className="font-bold text-slate-300 text-base">مرحباً بك في دردشة Sync ERP</h3>
              <p className="max-w-sm text-center text-slate-500 mt-1">
                اختر محادثة من القائمة الجانبية أو ابدأ محادثة مباشرة مع أحد زملائك بالعمل.
              </p>
            </div>
          )}

          {/* ================================================================= */}
          {/* RIGHT DRAWER: GROUP INFO & PARTICIPANTS */}
          {/* ================================================================= */}
          {showRightDrawer && activeConversation && (
            <div className="absolute inset-y-0 end-0 w-80 bg-slate-900 border-s border-slate-800 shadow-2xl z-30 flex flex-col animate-in slide-in-from-right duration-200">
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <h4 className="font-bold text-xs text-white">معلومات المحادثة</h4>
                <button
                  onClick={() => setShowRightDrawer(false)}
                  className="p-1 text-slate-400 hover:text-white rounded-lg"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs">
                <div className="text-center pb-4 border-b border-slate-800">
                  <div className="h-16 w-16 mx-auto rounded-3xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-extrabold text-xl mb-2">
                    {activeConversation.title?.slice(0, 2) || 'CH'}
                  </div>
                  <h3 className="font-extrabold text-sm text-white">{activeConversation.title}</h3>
                  <p className="text-slate-400 text-[11px] mt-1">{activeConversation.description || 'لا يوجد وصف'}</p>
                </div>

                {activeConversation.isGroup && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-bold text-slate-300">
                        الأعضاء المشاركون ({activeConversation.participants?.length || 0})
                      </span>
                      <button
                        onClick={() => {
                          setSelectedEmployeeIds([]);
                          setIsAddMembersModalOpen(true);
                        }}
                        className="inline-flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 font-bold"
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                        <span>إضافة عضو</span>
                      </button>
                    </div>

                    <div className="space-y-2">
                      {activeConversation.participants?.map((p) => (
                        <div key={p.id} className="flex items-center justify-between p-2.5 rounded-2xl bg-slate-950/60 border border-slate-800/80">
                          <div className="flex items-center gap-2.5">
                            <div className="h-8 w-8 rounded-xl bg-slate-800 flex items-center justify-center text-slate-300 font-bold text-[10px]">
                              {p.employee?.fullName?.slice(0, 1) || 'U'}
                            </div>
                            <div>
                              <div className="font-bold text-slate-200 text-[11px]">{p.employee?.fullName || p.user?.email}</div>
                              <div className="text-[9px] text-slate-500">{p.employee?.position?.name || 'موظف'}</div>
                            </div>
                          </div>

                          {p.role === 'ADMIN' && (
                            <span className="text-[9px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded-md">
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
        </section>
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
                  <Download className="h-5 w-5" />
                </a>
                <button
                  onClick={closeLightbox}
                  className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                  title="إغلاق"
                >
                  <X className="h-6 w-6" />
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
                  <ChevronRight className="h-6 w-6" />
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
                  <ChevronLeft className="h-6 w-6" />
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
                        ? 'border-indigo-500 scale-105 shadow-lg'
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
      {isDirectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-indigo-400" />
                <span>بدء محادثة مباشرة جديدة</span>
              </h3>
              <button onClick={() => setIsDirectModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-4">
              <input
                type="text"
                placeholder="ابحث بالاسم أو القسم أو الوظيفة..."
                value={directSearch}
                onChange={(e) => setDirectSearch(e.target.value)}
                className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div className="max-h-60 overflow-y-auto space-y-1.5 divide-y divide-slate-800/40">
              {employeesData?.data
                ?.filter((emp) => emp.user?.id !== user?.id)
                ?.filter((emp) => emp.fullName.toLowerCase().includes(directSearch.toLowerCase()))
                ?.map((emp) => (
                  <button
                    key={emp.id}
                    onClick={() => emp.user?.id && handleStartDirectChat(emp.user.id)}
                    className="w-full flex items-center justify-between p-2.5 rounded-2xl hover:bg-slate-800 transition-colors text-start"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="h-9 w-9 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center text-xs font-bold">
                        {emp.fullName.slice(0, 1)}
                      </div>
                      <div>
                        <div className="font-bold text-xs text-slate-100">{emp.fullName}</div>
                        <div className="text-[10px] text-slate-400">{emp.position?.name} • {emp.department?.name}</div>
                      </div>
                    </div>

                    <span className="text-[11px] text-indigo-400 font-bold">مراسلة</span>
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 2: CREATE GROUP CHAT MODAL */}
      {/* ===================================================================== */}
      {isGroupModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Users className="h-4 w-4 text-indigo-400" />
                <span>إنشاء مجموعة عمل أو قناة عامة</span>
              </h3>
              <button onClick={() => setIsGroupModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateGroupSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1">اسم المجموعة / القناة</label>
                <input
                  type="text"
                  required
                  value={groupTitle}
                  onChange={(e) => setGroupTitle(e.target.value)}
                  placeholder="مثال: فريق الهندسة والتطوير، أو # الإعلانات العامة"
                  className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-slate-100 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">نوع القناة</label>
                <select
                  value={groupType}
                  onChange={(e) => setGroupType(e.target.value as any)}
                  className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-slate-100 focus:border-indigo-500 focus:outline-none"
                >
                  <option value="WORK_GROUP">مجموعة عمل خاصة (تتطلب دعوة الأعضاء)</option>
                  <option value="PUBLIC_GROUP">قناة عامة للشركة (متاحة لكافة الموظفين)</option>
                </select>
              </div>

              {groupType === 'WORK_GROUP' && (
                <div>
                  <label className="block text-slate-300 font-bold mb-1">القسم المرتبط (اختياري)</label>
                  <select
                    value={groupDepartmentId}
                    onChange={(e) => setGroupDepartmentId(e.target.value)}
                    className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-slate-100 focus:border-indigo-500 focus:outline-none"
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

              <div>
                <label className="block text-slate-300 font-bold mb-1">الوصف والهدف</label>
                <textarea
                  rows={2}
                  value={groupDescription}
                  onChange={(e) => setGroupDescription(e.target.value)}
                  placeholder="اكتب نبذة عن موضوع وغرض هذه المجموعة..."
                  className="w-full rounded-2xl border border-slate-800 bg-slate-950 p-3 text-slate-100 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              {/* Members Selection */}
              {groupType === 'WORK_GROUP' && (
                <div>
                  <label className="block text-slate-300 font-bold mb-1">إضافة أعضاء للبدء</label>
                  <div className="max-h-40 overflow-y-auto space-y-1 p-2 rounded-2xl border border-slate-800 bg-slate-950">
                    {employeesData?.data
                      ?.filter((emp) => emp.user?.id !== user?.id)
                      ?.map((emp) => {
                        const targetId = emp.user?.id || emp.id;
                        const isSelected = selectedEmployeeIds.includes(targetId);
                        return (
                          <label
                            key={emp.id}
                            className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-slate-800 cursor-pointer"
                          >
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
                              className="rounded border-slate-700 text-indigo-600 focus:ring-indigo-500"
                            />
                            <span className="font-semibold text-slate-200">{emp.fullName}</span>
                            <span className="text-[10px] text-slate-400">({emp.department?.name})</span>
                          </label>
                        );
                      })}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsGroupModalOpen(false)}
                  className="px-4 py-2.5 rounded-2xl border border-slate-700 text-slate-300 hover:bg-slate-800 font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={createGroupMutation.isPending}
                  className="px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-md shadow-indigo-600/30"
                >
                  {createGroupMutation.isPending ? 'جاري الإنشاء...' : 'إنشاء المجموعة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 3: ADD MEMBERS MODAL */}
      {/* ===================================================================== */}
      {isAddMembersModalOpen && activeConversation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-indigo-400" />
                <span>إضافة أعضاء إلى {activeConversation.title}</span>
              </h3>
              <button onClick={() => setIsAddMembersModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAddMembersSubmit} className="space-y-4 text-xs">
              <div className="max-h-60 overflow-y-auto space-y-1 p-2 rounded-2xl border border-slate-800 bg-slate-950">
                {employeesData?.data
                  ?.filter((emp) => !activeConversation.participants?.some((p) => p.userId === emp.user?.id || p.employeeId === emp.id))
                  ?.map((emp) => {
                    const targetId = emp.user?.id || emp.id;
                    const isSelected = selectedEmployeeIds.includes(targetId);
                    return (
                      <label
                        key={emp.id}
                        className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-slate-800 cursor-pointer"
                      >
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
                          className="rounded border-slate-700 text-indigo-600 focus:ring-indigo-500"
                        />
                        <div>
                          <div className="font-bold text-slate-200">{emp.fullName}</div>
                          <div className="text-[10px] text-slate-400">{emp.position?.name} • {emp.department?.name}</div>
                        </div>
                      </label>
                    );
                  })}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddMembersModalOpen(false)}
                  className="px-4 py-2.5 rounded-2xl border border-slate-700 text-slate-300 hover:bg-slate-800 font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={selectedEmployeeIds.length === 0 || addParticipantsMutation.isPending}
                  className="px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-md disabled:opacity-50"
                >
                  {addParticipantsMutation.isPending ? 'جاري الإضافة...' : `إضافة (${selectedEmployeeIds.length})`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
