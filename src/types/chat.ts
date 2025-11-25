// Chat message types

export interface ChatMessage {
  id: string;
  user: {
    id: string;
    username: string;
    avatar: string | null;
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

export interface OnlineUser {
  id: string;
  username: string;
  avatar: string | null;
  isChatting?: boolean;
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

export type ChatTab = 'local' | 'dm' | 'online';

export interface ChatState {
  isExpanded: boolean;
  activeTab: ChatTab;
  selectedConversation: string | null;
}
