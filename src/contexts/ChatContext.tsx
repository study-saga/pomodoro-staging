import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { ChatMessage, OnlineUser, UserRole } from '../types/chat';
import { generateMessageId } from '../lib/chatService';
import { useAuth } from './AuthContext';

const MAX_MESSAGES = 50;
const BATCH_DELAY_MS = 150; // Message batching window
const RATE_LIMIT_MS = 2000; // 2 seconds between messages

interface ChatContextValue {
  // Global chat
  globalMessages: ChatMessage[];
  sendGlobalMessage: (content: string, user: { id: string; username: string; avatar: string | null }) => void;
  deleteGlobalMessage: (messageId: string) => void;
  isGlobalConnected: boolean;
  isChatEnabled: boolean; // Admin kill switch status

  // Presence
  onlineUsers: OnlineUser[]; // All users on site
  setChatOpen: (isOpen: boolean) => void; // Toggle chat presence

  // Moderation
  userRole: UserRole;
  isBanned: boolean;
  banReason: string | null;
  banExpiresAt: string | null;
  banUser: (userId: string, durationMinutes: number | null, reason: string) => Promise<void>;
  unbanUser: (userId: string) => Promise<void>;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const { appUser } = useAuth();

  // Global chat state
  const [globalMessages, setGlobalMessages] = useState<ChatMessage[]>([]);
  const [isGlobalConnected, setIsGlobalConnected] = useState(false);
  const [isChatEnabled, setIsChatEnabled] = useState(true);
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Presence state
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [isChatOpen, setIsChatOpen] = useState(false);

  // Moderation state
  const [userRole, setUserRole] = useState<UserRole>('user');
  const [isBanned, setIsBanned] = useState(false);
  const [banReason, setBanReason] = useState<string | null>(null);
  const [banExpiresAt, setBanExpiresAt] = useState<string | null>(null);

  // Ref to track banned state without triggering effect re-runs
  const isBannedRef = useRef(isBanned);
  useEffect(() => {
    isBannedRef.current = isBanned;
  }, [isBanned]);

  // Message batching & Rate limiting
  const messageBatchRef = useRef<ChatMessage[]>([]);
  const batchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastMessageTimeRef = useRef<number>(0);

  // 0. Fetch User Role & Check Ban Status
  useEffect(() => {
    if (!appUser) {
      setUserRole('user');
      setIsBanned(false);
      setBanReason(null);
      setBanExpiresAt(null);
      return;
    }

    const fetchUserStatus = async () => {
      // Fetch role
      const { data: userData } = await supabase
        .from('users')
        .select('role')
        .eq('id', appUser.id)
        .single();

      if (userData) {
        setUserRole(userData.role as UserRole);
      }

      // Check active bans
      const { data: banData } = await supabase
        .from('chat_bans')
        .select('reason, expires_at')
        .eq('user_id', appUser.id)
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
        .maybeSingle();

      if (banData) {
        setIsBanned(true);
        setBanReason(banData.reason);
        setBanExpiresAt(banData.expires_at);
      } else {
        setIsBanned(false);
        setBanReason(null);
        setBanExpiresAt(null);
      }
    };

    fetchUserStatus();

    // Subscribe to ban changes for this user
    const banChannel = supabase.channel(`bans:${appUser.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_bans',
          filter: `user_id=eq.${appUser.id}`
        },
        async () => {
          // Re-check ban status on any change
          const { data: banData } = await supabase
            .from('chat_bans')
            .select('reason, expires_at')
            .eq('user_id', appUser.id)
            .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
            .maybeSingle();

          if (banData) {
            setIsBanned(true);
            setBanReason(banData.reason);
            setBanExpiresAt(banData.expires_at);
            toast.error(`You have been banned: ${banData.reason}`);
            setIsGlobalConnected(false); // Force disconnect
          } else {
            // Only unban if previously banned
            if (isBannedRef.current) {
              setIsBanned(false);
              setBanReason(null);
              setBanExpiresAt(null);
              toast.success('Your ban has been lifted.');
            }
          }
        }
      )
      .subscribe();

    return () => {
      banChannel.unsubscribe();
    };
  }, [appUser]);

  // 1. Admin Kill Switch Listener
  useEffect(() => {
    // Fetch initial config
    const fetchConfig = async () => {
      const { data } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'chat_config')
        .single();

      if (data?.value) {
        setIsChatEnabled(data.value.enabled !== false); // Default true if missing
      }
    };

    fetchConfig();

    // Subscribe to changes
    const settingsChannel = supabase.channel('system-settings')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'system_settings',
          filter: 'key=eq.chat_config'
        },
        (payload) => {
          const newValue = payload.new.value as { enabled: boolean; maintenance_message?: string };
          const isEnabled = newValue.enabled !== false;

          setIsChatEnabled(isEnabled);

          if (!isEnabled) {
            toast.error(newValue.maintenance_message || 'Chat has been disabled by administrators.');
          } else {
            toast.success('Chat has been re-enabled.');
          }
        }
      )
      .subscribe();

    return () => {
      settingsChannel.unsubscribe();
    };
  }, []);

  // 2. Single Channel Subscription (Global + Chat)
  useEffect(() => {
    if (!appUser || !isChatEnabled || isBanned) { // Disconnect if chat disabled or banned
      setOnlineUsers([]);
      setIsGlobalConnected(false);
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
            role?: UserRole;
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
                isChatting: presence.is_chatting,
                online_at: presence.online_at,
                role: presence.role
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
              online_at: new Date().toISOString(),
              role: userRole
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
  }, [appUser, isChatOpen, isChatEnabled, isBanned, userRole]); // Re-connect when status changes

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

  // Send global message with batching and rate limiting
  const sendGlobalMessage = useCallback((
    content: string,
    user: { id: string; username: string; avatar: string | null }
  ) => {
    if (!isChatEnabled) {
      toast.error('Chat is currently disabled.');
      return;
    }

    if (isBanned) {
      toast.error(`You are banned: ${banReason}`);
      return;
    }

    if (!channelRef.current || !isGlobalConnected) {
      console.error('Not connected to global chat');
      return;
    }

    // Rate Limiting
    const now = Date.now();
    if (now - lastMessageTimeRef.current < RATE_LIMIT_MS) {
      toast.error('Please wait a moment before sending another message.');
      return;
    }
    lastMessageTimeRef.current = now;

    const message: ChatMessage = {
      id: generateMessageId(),
      user: {
        id: user.id,
        username: user.username,
        avatar: user.avatar,
        role: userRole
      },
      content,
      timestamp: now
    };

    messageBatchRef.current.push(message);

    if (batchTimerRef.current) {
      clearTimeout(batchTimerRef.current);
    }

    batchTimerRef.current = setTimeout(() => {
      flushMessageBatch();
    }, BATCH_DELAY_MS);
  }, [isGlobalConnected, flushMessageBatch, isChatEnabled, isBanned, banReason, userRole]);

  // Delete global message
  const deleteGlobalMessage = useCallback((messageId: string) => {
    if (!channelRef.current || !isGlobalConnected) {
      return;
    }

    // Only admins and moderators can delete messages
    if (userRole !== 'admin' && userRole !== 'moderator') {
      toast.error('You do not have permission to delete messages.');
      return;
    }

    channelRef.current.send({
      type: 'broadcast',
      event: 'delete',
      payload: { messageId }
    });
  }, [isGlobalConnected, userRole]);

  // Ban User Function
  const banUser = useCallback(async (userId: string, durationMinutes: number | null, reason: string) => {
    if (!appUser || (userRole !== 'moderator' && userRole !== 'admin')) {
      toast.error('You do not have permission to ban users.');
      return;
    }

    if (userId === appUser.id) {
      toast.error('You cannot ban yourself.');
      return;
    }

    // Check target user's role
    const { data: targetUser } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single();

    if (targetUser) {
      const targetRole = targetUser.role as UserRole;
      // Admins cannot be banned by anyone (except maybe super-admins, but we treat admin as top)
      if (targetRole === 'admin') {
        toast.error('Administrators cannot be banned.');
        return;
      }
      // Moderators cannot ban other moderators
      if (userRole === 'moderator' && targetRole === 'moderator') {
        toast.error('Moderators cannot ban other moderators.');
        return;
      }
    }

    let expiresAt = null;
    if (durationMinutes) {
      const date = new Date();
      date.setMinutes(date.getMinutes() + durationMinutes);
      expiresAt = date.toISOString();
    }

    const { error } = await supabase
      .from('chat_bans')
      .insert({
        user_id: userId,
        banned_by: appUser.id,
        reason,
        expires_at: expiresAt
      });

    if (error) {
      console.error('Error banning user:', error);
      toast.error('Failed to ban user.');
    } else {
      toast.success('User has been banned.');
    }
  }, [appUser, userRole]);

  // Unban User Function
  const unbanUser = useCallback(async (userId: string) => {
    if (!appUser || (userRole !== 'moderator' && userRole !== 'admin')) {
      toast.error('You do not have permission to unban users.');
      return;
    }

    // Check who banned this user and enforce hierarchy
    const { data: banRecord } = await supabase
      .from('chat_bans')
      .select('banned_by, users!chat_bans_banned_by_fkey(role)')
      .eq('user_id', userId)
      .single();

    if (banRecord?.banned_by) {
      // Supabase returns an array for the relation if not explicitly 1:1 mapped in types, or just handle both
      const bannerUser = Array.isArray(banRecord.users) ? banRecord.users[0] : banRecord.users;
      const bannerRole = bannerUser?.role as UserRole | undefined;
      // Moderators cannot unban if banned by admin
      if (userRole === 'moderator' && bannerRole === 'admin') {
        toast.error('You cannot unban users that were banned by administrators.');
        return;
      }
    }

    // Delete the ban record
    const { error } = await supabase
      .from('chat_bans')
      .delete()
      .eq('user_id', userId);

    if (error) {
      console.error('Error unbanning user:', error);
      toast.error('Failed to unban user.');
    } else {
      toast.success('User has been unbanned.');
    }
  }, [appUser, userRole]);

  const value: ChatContextValue = {
    globalMessages,
    sendGlobalMessage,
    deleteGlobalMessage,
    isGlobalConnected,
    isChatEnabled,
    onlineUsers,
    setChatOpen: setIsChatOpen,
    userRole,
    isBanned,
    banReason,
    banExpiresAt,
    banUser,
    unbanUser
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
