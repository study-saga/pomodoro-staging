import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { TypingUser } from '../types/chat';

const TYPING_TIMEOUT = 3000; // 3 seconds

interface UseTypingIndicatorResult {
  typingUsers: TypingUser[];
  broadcastTyping: () => void;
  isConnected: boolean;
}

/**
 * Hook for broadcasting and receiving typing indicators
 * Shows "User is typing..." for 3 seconds after last keystroke
 */
export function useTypingIndicator(
  channelName: string,
  currentUser: { id: string; username: string } | null
): UseTypingIndicatorResult {
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const typingTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    if (!currentUser) {
      setTypingUsers([]);
      return;
    }

    // Create channel for typing indicators
    const typingChannel = supabase.channel(`typing:${channelName}`, {
      config: {
        broadcast: { self: false } // Don't show own typing
      }
    });

    typingChannel
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        const { userId, username } = payload as { userId: string; username: string };

        // Don't show current user's typing
        if (userId === currentUser.id) {
          return;
        }

        // Add user to typing list
        setTypingUsers((prev) => {
          const exists = prev.some((u) => u.id === userId);
          if (exists) {
            return prev;
          }
          return [...prev, { id: userId, username }];
        });

        // Clear existing timeout for this user
        const existingTimeout = typingTimeoutsRef.current.get(userId);
        if (existingTimeout) {
          clearTimeout(existingTimeout);
        }

        // Set new timeout to remove user after TYPING_TIMEOUT
        const timeout = setTimeout(() => {
          setTypingUsers((prev) => prev.filter((u) => u.id !== userId));
          typingTimeoutsRef.current.delete(userId);
        }, TYPING_TIMEOUT);

        typingTimeoutsRef.current.set(userId, timeout);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
          console.log(`Connected to typing channel: ${channelName}`);
        } else if (status === 'CLOSED') {
          setIsConnected(false);
          console.log(`Disconnected from typing channel: ${channelName}`);
        }
      });

    channelRef.current = typingChannel;

    // Cleanup on unmount
    return () => {
      // Clear all timeouts
      typingTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
      typingTimeoutsRef.current.clear();

      typingChannel.unsubscribe();
      setIsConnected(false);
      setTypingUsers([]);
    };
  }, [channelName, currentUser]);

  // Broadcast typing indicator
  const broadcastTyping = useCallback(() => {
    if (!channelRef.current || !isConnected || !currentUser) {
      return;
    }

    channelRef.current.send({
      type: 'broadcast',
      event: 'typing',
      payload: {
        userId: currentUser.id,
        username: currentUser.username
      }
    });
  }, [isConnected, currentUser]);

  return {
    typingUsers,
    broadcastTyping,
    isConnected
  };
}
