export type ConversationType = 'DIRECT' | 'WORK_GROUP' | 'PUBLIC_GROUP';
export type ParticipantRole = 'MEMBER' | 'ADMIN';
export type MessageType = 'TEXT' | 'IMAGE' | 'FILE' | 'SYSTEM';

export interface ParticipantEmployee {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  employeeCode: string;
  position?: { name: string };
  department?: { name: string };
}

export interface ConversationParticipant {
  id: string;
  conversationId: string;
  userId: string;
  employeeId?: string;
  role: ParticipantRole;
  joinedAt: string;
  lastReadAt?: string;
  isMuted: boolean;
  user: {
    id: string;
    email: string;
    isActive?: boolean;
  };
  employee?: ParticipantEmployee;
}

export interface MessageReadReceipt {
  userId: string;
  readAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderEmployeeId?: string;
  sender: {
    id: string;
    email: string;
  };
  senderEmployee?: {
    id: string;
    fullName: string;
    avatarUrl: string | null;
    employeeCode: string;
  };
  content: string;
  type: MessageType;
  attachmentUrls: string[];
  replyToId?: string | null;
  replyTo?: {
    id: string;
    content: string;
    type: MessageType;
    attachmentUrls: string[];
    senderEmployee?: {
      id: string;
      fullName: string;
    };
  } | null;
  reactions?: Array<{
    emoji: string;
    userId: string;
    userName: string;
  }>;
  isEdited: boolean;
  isDeleted: boolean;
  isUploading?: boolean;
  uploadError?: string;
  readReceipts?: MessageReadReceipt[];
  createdAt: string;
  updatedAt?: string;
}

export interface ConversationSummary {
  id: string;
  title: string | null;
  description: string | null;
  avatarUrl: string | null;
  type: ConversationType;
  isGroup: boolean;
  department?: {
    id: string;
    name: string;
    code: string;
  };
  creatorId?: string;
  unreadCount: number;
  isParticipant: boolean;
  role: ParticipantRole | null;
  isMuted: boolean;
  counterpartEmployee?: ParticipantEmployee;
  lastMessage: {
    id: string;
    content: string;
    type: MessageType;
    senderName: string;
    createdAt: string;
  } | null;
  lastMessageAt: string;
  participantsCount: number;
  createdAt: string;
}

export interface ConversationDetail extends ConversationSummary {
  participants: ConversationParticipant[];
}

export interface MessagesResponse {
  messages: Message[];
  total: number;
  page: number;
  totalPages: number;
}

export interface CreateGroupPayload {
  title: string;
  type: ConversationType;
  description?: string;
  avatarUrl?: string;
  departmentId?: string;
  participantUserIds?: string[];
}

export interface SendMessagePayload {
  conversationId: string;
  content: string;
  type?: MessageType;
  attachmentUrls?: string[];
  replyToId?: string;
}
