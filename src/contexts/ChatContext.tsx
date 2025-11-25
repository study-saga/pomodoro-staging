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
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Presence state
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [isChatOpen, setIsChatOpen] = useState(false);

  // Message batching
  const messageBatchRef = useRef<ChatMessage[]>([]);
  const batchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Single Channel Subscription (Global + Chat)
  useEffect(() => {
    if (!appUser) {
      setOnlineUsers([]);
      return;
    }

    let channel: RealtimeChannel | null = null;

    const connect = async () => {
      // Single channel for everything
      channel = supabase.channel('global', {
        config: {
          broadcast: { self: true },
          presence: { key: appUser.id }
        }
      });

      channel
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
        // Presence (Syncs both "Online" and "In Chat" status via metadata)
        .on('presence', { event: 'sync' }, () => {
          const state = channel!.presenceState<{
            id: string;
            username: string;
            avatar: string | null;
            is_chatting: boolean;
            online_at: string;
          }>();

          const users: OnlineUser[] = [];

          Object.values(state).forEach((presences) => {
            // Use the most recent presence state for this user
            const presence = presences[0];
            if (presence) {
              users.push({
                id: presence.id,
                username: presence.username,
                avatar: presence.avatar,
                isChatting: presence.is_chatting
              });
            }
          });

          setOnlineUsers(users);
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            setIsGlobalConnected(true);
            console.log('Connected to global channel');

            // Track presence with metadata
            await channel!.track({
              id: appUser.id,
              username: appUser.username,
              avatar: appUser.avatar,
              is_chatting: isChatOpen, // Dynamic status
              online_at: new Date().toISOString()
            });
          } else if (status === 'CLOSED') {
            setIsGlobalConnected(false);
          }
        });

      channelRef.current = channel;
    };

    const disconnect = () => {
      if (channel) {
        channel.unsubscribe();
        setIsGlobalConnected(false);
      }
    };

    // Inactive tab detection
    const handleVisibilityChange = () => {
      if (document.hidden) {
        disconnect();
      } else {
        connect();
      }
    };

    connect();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      disconnect();
    };
  }, [appUser, isChatOpen]); // Re-connect/Re-track when isChatOpen changes

  // Flush message batch
  const flushMessageBatch = useCallback(() => {
    if (messageBatchRef.current.length === 0 || !channelRef.current) {
      return;
    }

    if (messageBatchRef.current.length === 1) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'message',
        payload: messageBatchRef.current[0]
      });
    } else {
      channelRef.current.send({
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
    if (!channelRef.current || !isGlobalConnected) {
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
    if (!channelRef.current || !isGlobalConnected) {
      return;
    }

    channelRef.current.send({
      type: 'broadcast',
      event: 'delete',
      payload: { messageId }
    });
  }, [isGlobalConnected]);

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
