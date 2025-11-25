import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { ChatMessage, OnlineUser } from '../types/chat';
import { generateMessageId } from '../lib/chatService';
import { useAuth } from './AuthContext';

const MAX_MESSAGES = 50;
const BATCH_DELAY_MS = 150; // Message batching window

interface ChatContextValue {
  // Global chat
  globalMessages: ChatMessage[];
  sendGlobalMessage: (content: string, user: { id: string; username: string; avatar: string | null }) => void;
  deleteGlobalMessage: (messageId: string) => void;
  isGlobalConnected: boolean;

  // Presence
  onlineUsers: OnlineUser[]; // All users on site
  setChatOpen: (isOpen: boolean) => void; // Toggle chat presence
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const { appUser } = useAuth();

  // Global chat state
  const [globalMessages, setGlobalMessages] = useState<ChatMessage[]>([]);
  const [isGlobalConnected, setIsGlobalConnected] = useState(false);
  const globalChannelRef = useRef<RealtimeChannel | null>(null);

  // Presence state
  const [rawOnlineUsers, setRawOnlineUsers] = useState<OnlineUser[]>([]); // From global-presence
  const [chatUserIds, setChatUserIds] = useState<Set<string>>(new Set()); // From global-chat
  const [isChatOpen, setIsChatOpen] = useState(false);
  const presenceChannelRef = useRef<RealtimeChannel | null>(null);

  // Message batching
  const messageBatchRef = useRef<ChatMessage[]>([]);
  const batchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 1. Global Presence Subscription (Always active)
  useEffect(() => {
    if (!appUser) {
      setRawOnlineUsers([]);
      return;
    }

    const channel = supabase.channel('global-presence');
    presenceChannelRef.current = channel;

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<OnlineUser>();
        const users: OnlineUser[] = [];

        Object.values(state).forEach((presences) => {
          presences.forEach((presence) => {
            users.push({
              id: presence.id,
              username: presence.username,
              avatar: presence.avatar
            });
          });
        });

        setRawOnlineUsers(users);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // Track user in global presence
          await channel.track({
            id: appUser.id,
            username: appUser.username,
            avatar: appUser.avatar,
            online_at: new Date().toISOString()
          });
        }
      });

    return () => {
      channel.unsubscribe();
    };
  }, [appUser]);

  // 2. Global Chat Subscription (Messages + Chat Presence)
  useEffect(() => {
    if (!appUser) return;

    let chatChannel: RealtimeChannel | null = null;

    const connectChat = async () => {
      chatChannel = supabase.channel('global-chat', {
        config: {
          broadcast: { self: true },
          presence: { key: appUser.id }
        }
      });

      chatChannel
        // Messages
        .on('broadcast', { event: 'message' }, ({ payload }) => {
          const message = payload as ChatMessage;
          setGlobalMessages(prev => {
            const updated = [...prev, message];
            return updated.slice(-MAX_MESSAGES);
          });
        })
        .on('broadcast', { event: 'message_batch' }, ({ payload }) => {
          const messages = payload as ChatMessage[];
          setGlobalMessages(prev => {
            const updated = [...prev, ...messages];
            return updated.slice(-MAX_MESSAGES);
          });
        })
        .on('broadcast', { event: 'delete' }, ({ payload }) => {
          const { messageId } = payload as { messageId: string };
          setGlobalMessages(prev => prev.map(msg =>
            msg.id === messageId ? { ...msg, deleted: true } : msg
          ));
        })
        // Chat Presence (Who has chat open)
        .on('presence', { event: 'sync' }, () => {
          const state = chatChannel!.presenceState();
          const ids = new Set(Object.keys(state));
          setChatUserIds(ids);
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            setIsGlobalConnected(true);
            console.log('Connected to global chat');

            // If chat is open, track presence in chat channel
            if (isChatOpen) {
              await chatChannel!.track({
                user_id: appUser.id,
                online_at: new Date().toISOString()
              });
            }
          } else if (status === 'CLOSED') {
            setIsGlobalConnected(false);
          }
        });

      globalChannelRef.current = chatChannel;
    };

    const disconnectChat = () => {
      if (chatChannel) {
        chatChannel.unsubscribe();
        setIsGlobalConnected(false);
      }
    };

    // Inactive tab detection
    const handleVisibilityChange = () => {
      if (document.hidden) {
        disconnectChat();
      } else {
        connectChat();
      }
    };

    connectChat();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      disconnectChat();
    };
  }, [appUser, isChatOpen]); // Re-run when isChatOpen changes to update tracking

  // Flush message batch
  const flushMessageBatch = useCallback(() => {
    if (messageBatchRef.current.length === 0 || !globalChannelRef.current) {
      return;
    }

    if (messageBatchRef.current.length === 1) {
      globalChannelRef.current.send({
        type: 'broadcast',
        event: 'message',
        payload: messageBatchRef.current[0]
      });
    } else {
      globalChannelRef.current.send({
        type: 'broadcast',
        event: 'message_batch',
        payload: messageBatchRef.current
      });
    }

    messageBatchRef.current = [];
    batchTimerRef.current = null;
  }, []);

  // Send global message with batching
  const sendGlobalMessage = useCallback((
    content: string,
    user: { id: string; username: string; avatar: string | null }
  ) => {
    if (!globalChannelRef.current || !isGlobalConnected) {
      console.error('Not connected to global chat');
      return;
    }

    const message: ChatMessage = {
      id: generateMessageId(),
      user: {
        id: user.id,
        username: user.username,
        avatar: user.avatar
      },
      content,
      timestamp: Date.now()
    };

    messageBatchRef.current.push(message);

    if (batchTimerRef.current) {
      clearTimeout(batchTimerRef.current);
    }

    batchTimerRef.current = setTimeout(() => {
      flushMessageBatch();
    }, BATCH_DELAY_MS);
  }, [isGlobalConnected, flushMessageBatch]);

  // Delete global message
  const deleteGlobalMessage = useCallback((messageId: string) => {
    if (!globalChannelRef.current || !isGlobalConnected) {
      return;
    }

    globalChannelRef.current.send({
      type: 'broadcast',
      event: 'delete',
      payload: { messageId }
    });
  }, [isGlobalConnected]);

  // Merge presence data
  const onlineUsers = rawOnlineUsers.map(user => ({
    ...user,
    isChatting: chatUserIds.has(user.id)
  }));

  const value: ChatContextValue = {
    globalMessages,
    sendGlobalMessage,
    deleteGlobalMessage,
    isGlobalConnected,
    onlineUsers,
    setChatOpen: setIsChatOpen
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within ChatProvider');
  }
  return context;
}
