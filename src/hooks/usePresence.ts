import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { OnlineUser } from '../types/chat';

interface UsePresenceResult {
  onlineUsers: OnlineUser[];
  isConnected: boolean;
}

/**
 * Hook for tracking online users using Supabase Presence
 * Tracks current user and shows all online users in real-time
 */
export function usePresence(
  currentUser: { id: string; username: string; avatar: string | null } | null
): UsePresenceResult {
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!currentUser) {
      setOnlineUsers([]);
      return;
    }

    // Create presence channel
    const presenceChannel = supabase.channel('online-users');

    presenceChannel
      // Listen to presence sync (full state update)
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState<OnlineUser>();
        const users: OnlineUser[] = [];

        // Extract all users from presence state
        Object.values(state).forEach((presences) => {
          presences.forEach((presence) => {
            users.push({
              id: presence.id,
              username: presence.username,
              avatar: presence.avatar
            });
          });
        });

        setOnlineUsers(users);
      })
      // Listen to users joining
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        console.log('Users joined:', newPresences);
      })
      // Listen to users leaving
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        console.log('Users left:', leftPresences);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);

          // Track current user's presence
          await presenceChannel.track({
            id: currentUser.id,
            username: currentUser.username,
            avatar: currentUser.avatar,
            online_at: new Date().toISOString()
          });

          console.log('Connected to presence channel');
        } else if (status === 'CLOSED') {
          setIsConnected(false);
          console.log('Disconnected from presence channel');
        }
      });

    setChannel(presenceChannel);

    // Cleanup on unmount
    return () => {
      presenceChannel.untrack();
      presenceChannel.unsubscribe();
      setIsConnected(false);
      setOnlineUsers([]);
    };
  }, [currentUser]);

  return {
    onlineUsers,
    isConnected
  };
}
