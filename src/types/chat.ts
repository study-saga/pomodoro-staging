// Chat message types

export interface ChatMessage {
  id: string;
  user: {
    id: string;
    username: string;
    avatar: string | null;
    role?: UserRole;
  };
  content: string;
  timestamp: number;
  deleted?: boolean;
}

export interface PrivateMessage {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  created_at: string;
  deleted_by_sender: boolean;
  deleted_by_recipient: boolean;
}

export type UserRole = 'user' | 'moderator' | 'admin';

export interface OnlineUser {
  id: string;
  username: string;
  avatar: string | null;
  online_at: string;
  isChatting?: boolean;
  role?: UserRole;
}

export interface ChatBan {
  id: string;
  user_id: string;
  banned_by: string;
  reason: string;
  expires_at: string | null;
  created_at: string;
}

export interface Conversation {
  userId: string;
  username: string;
  avatar: string | null;
  lastMessage: string;
  lastMessageTime: number;
  unreadCount: number;
}

export interface TypingUser {
  id: string;
  username: string;
}

export type ChatTab = 'local' | 'dm' | 'online' | 'banned';

export interface ChatState {
  isExpanded: boolean;
  activeTab: ChatTab;
  selectedConversation: string | null;
}
