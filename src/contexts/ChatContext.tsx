import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { ChatMessage, OnlineUser, UserRole } from '../types/chat';
import { useAuth } from './AuthContext';

const MAX_MESSAGES = 50;
const RATE_LIMIT_MS = 1000; // 1 second between messages (enforced by DB too, but good for UI feedback)

interface ChatContextValue {
  // Global chat
  globalMessages: ChatMessage[];
  sendGlobalMessage: (content: string, user: { id: string; username: string; avatar: string | null; discord_id?: string }) => Promise<void>;
  deleteGlobalMessage: (messageId: string) => Promise<void>;
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
  reportMessage: (messageId: string, reason: string, reportedUserId: string, reportedUsername: string, reportedContent: string) => Promise<void>;

  // Connection state
  connectionState: 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';
  retryCount: number;
  manualRetry: () => void;
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
  const [banId, setBanId] = useState<string | null>(null);

  // Rate limiting ref
  const lastMessageTimeRef = useRef<number>(0);

  // Connection state management
  const [connectionState, setConnectionState] = useState<'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error'>('disconnected');
  const [retryCount, setRetryCount] = useState(0);
  const connectionTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Ref to track banned state without triggering effect re-runs
  const isBannedRef = useRef(isBanned);
  useEffect(() => {
    isBannedRef.current = isBanned;
  }, [isBanned]);


  // Ref to track previous connection state for reconnection detection
  const prevConnectedRef = useRef<boolean | undefined>(undefined);
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
        .select('id, reason, expires_at')
        .eq('user_id', appUser.id)
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
        .maybeSingle();

      if (banData) {
        setIsBanned(true);
        setBanReason(banData.reason);
        setBanExpiresAt(banData.expires_at);
        setBanId(banData.id);
      } else {
        setIsBanned(false);
        setBanReason(null);
        setBanExpiresAt(null);
        setBanId(null);
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
            .select('id, reason, expires_at')
            .eq('user_id', appUser.id)
            .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
            .maybeSingle();

          if (banData) {
            setIsBanned(true);
            setBanReason(banData.reason);
            setBanExpiresAt(banData.expires_at);
            setBanId(banData.id);
            toast.error(`You have been banned: ${banData.reason}`);
            setIsGlobalConnected(false); // Force disconnect
          } else {
            // Only unban if previously banned
            if (isBannedRef.current) {
              setIsBanned(false);
              setBanReason(null);
              setBanExpiresAt(null);
              setBanId(null);
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

  // 0.5. Listen for Unban (Delete) specifically
  useEffect(() => {
    if (!isBanned || !banId) return;

    const unbanChannel = supabase.channel(`unban:${banId}`)
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'chat_bans',
          filter: `id=eq.${banId}`
        },
        () => {
          setIsBanned(false);
          setBanReason(null);
          setBanExpiresAt(null);
          setBanId(null);
          toast.success('Your ban has been lifted.');
        }
      )
      .subscribe();

    return () => {
      unbanChannel.unsubscribe();
    };
  }, [isBanned, banId]);

  // 1. Admin Kill Switch Listener
  useEffect(() => {
    const fetchConfig = async () => {
      const { data } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'chat_config')
        .single();

      if (data?.value) {
        setIsChatEnabled(data.value.enabled !== false);
      }
    };

    fetchConfig();

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

  // 2. Load Initial Messages
  useEffect(() => {
    if (!isChatEnabled || isBanned) return;

    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('chat_messages')
        .select(`
          id,
          content,
          created_at,
          is_deleted,
          user_id,
          users (
            id,
            username,
            avatar,
            discord_id,
            role
          )
        `)
        .eq('is_deleted', false) // Only fetch non-deleted
        .order('created_at', { ascending: false })
        .limit(MAX_MESSAGES);

      if (error) {
        console.error('Error fetching messages:', error);
        return;
      }

      // Transform to ChatMessage type
      const messages: ChatMessage[] = data.map((msg: any) => ({
        id: msg.id,
        content: msg.content,
        timestamp: new Date(msg.created_at).getTime(),
        deleted: msg.is_deleted,
        user: {
          id: msg.users?.id || msg.user_id,
          username: msg.users?.username || 'Unknown',
          avatar: msg.users?.avatar || null,
          discord_id: msg.users?.discord_id,
          role: msg.users?.role || 'user'
        }
      })).reverse(); // Reverse to show oldest first (top) -> newest (bottom)

      setGlobalMessages(messages);
    };

    fetchMessages();
  }, [isChatEnabled, isBanned]);

  // 2.5. Refetch messages on reconnection (tab visibility change)
  useEffect(() => {
    const wasDisconnected = prevConnectedRef.current === false;
    const isNowConnected = isGlobalConnected === true;

    // Only refetch if we went from disconnected → connected (reconnection)
    if (wasDisconnected && isNowConnected) {
      console.log('[Chat] Reconnected - refetching messages to catch up');

      const fetchMessages = async () => {
        const { data, error } = await supabase
          .from('chat_messages')
          .select(`
            id,
            content,
            created_at,
            is_deleted,
            user_id,
            users (
              id,
              username,
              avatar,
              discord_id,
              role
            )
          `)
          .eq('is_deleted', false)
          .order('created_at', { ascending: false })
          .limit(MAX_MESSAGES);

        if (error) {
          console.error('[Chat] Error refetching messages on reconnection:', error);
          return;
        }

        // Transform to ChatMessage type
        const messages: ChatMessage[] = data.map((msg: any) => ({
          id: msg.id,
          content: msg.content,
          timestamp: new Date(msg.created_at).getTime(),
          deleted: msg.is_deleted,
          user: {
            id: msg.users?.id || msg.user_id,
            username: msg.users?.username || 'Unknown',
            avatar: msg.users?.avatar || null,
            discord_id: msg.users?.discord_id,
            role: msg.users?.role || 'user'
          }
        })).reverse(); // Reverse to show oldest first

        setGlobalMessages(messages);
        console.log(`[Chat] Refetched ${messages.length} messages after reconnection`);
      };

      fetchMessages();
    }

    // Update ref for next check
    prevConnectedRef.current = isGlobalConnected;
  }, [isGlobalConnected]);

  // 3. Realtime Subscription (Postgres Changes + Presence)
  useEffect(() => {
    if (!appUser || !isChatEnabled || isBanned) {
      setOnlineUsers([]);
      setIsGlobalConnected(false);
      return;
    }

    let channel: RealtimeChannel | null = null;

    const attemptConnection = async (attempt: number = 0): Promise<void> => {
      const maxAttempts = 4;
      const delays = [0, 1000, 2000, 4000]; // Exponential backoff

      if (attempt > 0) {
        import.meta.env.DEV && console.log(`[Chat] Retry ${attempt}/${maxAttempts - 1} after ${delays[attempt]}ms`);
        setConnectionState('reconnecting');
        await new Promise(resolve => setTimeout(resolve, delays[attempt]));
      } else {
        setConnectionState('connecting');
      }

      setRetryCount(attempt);

      try {
        await connectToChannel();
        setConnectionState('connected');
        setRetryCount(0);
        clearTimeout(connectionTimeoutRef.current);
        clearTimeout(retryTimeoutRef.current);
      } catch (error) {
        console.error(`[Chat] Attempt ${attempt} failed:`, error);

        if (attempt < maxAttempts - 1) {
          retryTimeoutRef.current = setTimeout(() => {
            attemptConnection(attempt + 1);
          }, 0);
        } else {
          setConnectionState('error');
          clearTimeout(connectionTimeoutRef.current);
        }
      }
    };

    const connectToChannel = (): Promise<void> => {
      return new Promise((resolve, reject) => {
        if (channelRef.current) {
          supabase.removeChannel(channelRef.current);
          channelRef.current = null;
        }

        channel = supabase.channel('global_chat_db', {
          config: {
            presence: { key: appUser.id }
          }
        });

        let resolved = false;

        channel
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, async (payload) => {
            import.meta.env.DEV && console.log('[Chat] Received INSERT payload:', payload);
            const newMsg = payload.new as any;

            const { data: userData, error: userError } = await supabase
              .from('users')
              .select('username, avatar, discord_id, role')
              .eq('id', newMsg.user_id)
              .single();

            if (userError) {
              console.error('[Chat] Error fetching user for message:', userError);
            }

            const message: ChatMessage = {
              id: newMsg.id,
              content: newMsg.content,
              timestamp: new Date(newMsg.created_at).getTime(),
              deleted: newMsg.is_deleted,
              user: {
                id: newMsg.user_id,
                username: userData?.username || 'Unknown',
                avatar: userData?.avatar || null,
                discord_id: userData?.discord_id,
                role: userData?.role || 'user'
              }
            };

            setGlobalMessages(prev => {
              if (prev.some(m => m.id === message.id)) return prev;
              const updated = [...prev, message];
              return updated.slice(-MAX_MESSAGES);
            });
          })
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_messages' }, (payload) => {
            import.meta.env.DEV && console.log('[Chat] Received UPDATE payload:', payload);
            const updatedMsg = payload.new as any;
            if (updatedMsg.is_deleted) {
              setGlobalMessages(prev => prev.filter(msg => msg.id !== updatedMsg.id));
            } else {
              setGlobalMessages(prev => prev.map(msg =>
                msg.id === updatedMsg.id ? { ...msg, content: updatedMsg.content } : msg
              ));
            }
          })
          .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'chat_messages' }, (payload) => {
            import.meta.env.DEV && console.log('[Chat] Received DELETE payload:', payload);
            const deletedId = payload.old.id;
            if (deletedId) {
              setGlobalMessages(prev => prev.filter(msg => msg.id !== deletedId));
            }
          })
          .on('presence', { event: 'sync' }, () => {
            const state = channel!.presenceState<{
              id: string;
              username: string;
              avatar: string | null;
              is_chatting: boolean;
              online_at: string;
              role?: UserRole;
              discord_id?: string;
            }>();

            const users: OnlineUser[] = [];
            Object.values(state).forEach((presences) => {
              const presence = presences[0];
              if (presence) {
                users.push({
                  id: presence.id,
                  username: presence.username,
                  avatar: presence.avatar,
                  isChatting: presence.is_chatting,
                  online_at: presence.online_at,
                  role: presence.role,
                  discord_id: presence.discord_id
                });
              }
            });
            setOnlineUsers(users);
          })
          .subscribe(async (status, err) => {
            import.meta.env.DEV && console.log(`[Chat] Status: ${status}`, err);

            if (status === 'SUBSCRIBED') {
              resolved = true;
              setIsGlobalConnected(true);
              import.meta.env.DEV && console.log('Connected to global chat (DB-backed)');

              await channel!.track({
                id: appUser.id,
                username: appUser.username,
                avatar: appUser.avatar,
                is_chatting: isChatOpen,
                online_at: new Date().toISOString(),
                role: userRole,
                discord_id: appUser.discord_id
              });

              resolve();
            } else if (status === 'CHANNEL_ERROR') {
              resolved = true;
              setIsGlobalConnected(false);
              reject(new Error(`Channel error: ${err?.message || 'Unknown'}`));
            } else if (status === 'CLOSED' && !resolved) {
              resolved = true;
              setIsGlobalConnected(false);
              reject(new Error('Channel closed before subscription'));
            }
          });

        channelRef.current = channel;

        // Backup timeout for subscription callback
        setTimeout(() => {
          if (!resolved) {
            resolved = true;
            reject(new Error('Subscription callback timeout'));
          }
        }, 8000);
      });
    };

    const connect = () => {
      if (!appUser) return;

      clearTimeout(connectionTimeoutRef.current);
      clearTimeout(retryTimeoutRef.current);

      // 10s global timeout
      connectionTimeoutRef.current = setTimeout(() => {
        console.error('[Chat] Timeout after 10s');
        setConnectionState('error');
        disconnect();
      }, 10000);

      attemptConnection(0);
    };

    const disconnect = () => {
      import.meta.env.DEV && console.log('[Chat] Disconnecting');
      clearTimeout(connectionTimeoutRef.current);
      clearTimeout(retryTimeoutRef.current);
      setConnectionState('disconnected');
      setRetryCount(0);

      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      if (channel) {
        channel.unsubscribe();
        setIsGlobalConnected(false);
      }
    };

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
  }, [appUser, isChatEnabled, isBanned, userRole]); // Added retryTrigger for manual retry

  // Send Global Message (Database Insert)
  const sendGlobalMessage = useCallback(async (
    content: string,
    user: { id: string; username: string; avatar: string | null; discord_id?: string }
  ) => {
    if (!isChatEnabled) {
      toast.error('Chat is currently disabled.');
      return;
    }

    if (isBanned) {
      toast.error(`You are banned: ${banReason}`);
      return;
    }

    // Rate Limiting
    const now = Date.now();
    if (now - lastMessageTimeRef.current < RATE_LIMIT_MS) {
      toast.error('Please wait a moment before sending another message.');
      return;
    }
    lastMessageTimeRef.current = now;

    // Optimistic Update
    const messageId = crypto.randomUUID(); // Generate UUID on client
    const optimisticMessage: ChatMessage = {
      id: messageId,
      content: content.trim(),
      timestamp: now,
      deleted: false,
      user: {
        id: user.id,
        username: user.username,
        avatar: user.avatar,
        discord_id: user.discord_id,
        role: userRole
      }
    };

    setGlobalMessages(prev => [...prev, optimisticMessage].slice(-MAX_MESSAGES));

    // Insert into DB with the SAME ID
    const { error } = await supabase
      .from('chat_messages')
      .insert({
        id: messageId, // Use the client-generated ID
        user_id: user.id,
        content: content.trim(),
        // Metadata for history preservation (optional)
        username: user.username,
        user_role: userRole
      });

    if (error) {
      console.error('Error sending message:', error);
      // Rollback optimistic update
      setGlobalMessages(prev => prev.filter(m => m.id !== optimisticMessage.id));

      if (error.code === '42501') { // RLS violation
        toast.error('Failed to send message. You may be banned or timed out.');
      } else {
        toast.error('Failed to send message.');
      }
    }
  }, [isChatEnabled, isBanned, banReason, userRole]);

  // Delete Global Message (Soft Delete)
  const deleteGlobalMessage = useCallback(async (messageId: string) => {
    if (userRole !== 'admin' && userRole !== 'moderator') {
      toast.error('You do not have permission to delete messages.');
      return;
    }

    const { error } = await supabase
      .from('chat_messages')
      .update({ is_deleted: true })
      .eq('id', messageId);

    if (error) {
      console.error('Error deleting message:', error);
      toast.error('Failed to delete message.');
    } else {
      toast.success('Message deleted.');
    }
  }, [userRole]);

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
      if (targetRole === 'admin') {
        toast.error('Administrators cannot be banned.');
        return;
      }
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

    const { data: banRecord } = await supabase
      .from('chat_bans')
      .select('banned_by, users!chat_bans_banned_by_fkey(role)')
      .eq('user_id', userId)
      .single();

    if (banRecord?.banned_by) {
      const bannerUser = Array.isArray(banRecord.users) ? banRecord.users[0] : banRecord.users;
      const bannerRole = bannerUser?.role as UserRole | undefined;
      if (userRole === 'moderator' && bannerRole === 'admin') {
        toast.error('You cannot unban users that were banned by administrators.');
        return;
      }
    }

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

  // Manual retry for reconnection
  const manualRetry = useCallback(() => {
    import.meta.env.DEV && console.log('[Chat] Manual retry triggered');
    setConnectionState('connecting');
    setRetryCount(0);
  }, []);

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
    unbanUser,
    connectionState,
    retryCount,
    manualRetry,
    reportMessage: async (messageId: string, reason: string, reportedUserId: string, reportedUsername: string, reportedContent: string) => {
      if (!appUser) return;

      try {
        const { error } = await supabase.functions.invoke('report-message', {
          body: {
            messageId,
            reason,
            reportedUserId,
            reportedUsername,
            reportedContent,
            origin: window.location.origin
          }
        });

        if (error) throw error;
        toast.success('Report submitted. Thank you for helping keep the chat safe.');
      } catch (err) {
        console.error('Error submitting report:', err);
        toast.error('Failed to submit report. Please try again.');
      }
    }
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
