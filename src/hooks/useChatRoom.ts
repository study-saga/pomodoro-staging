import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { ChatMessage } from '../types/chat';
import { generateMessageId } from '../lib/chatService';

const MAX_MESSAGES = 10;

interface UseChatRoomResult {
  messages: ChatMessage[];
  sendMessage: (content: string, user: { id: string; username: string; avatar: string | null }) => void;
  deleteMessage: (messageId: string) => void;
  isConnected: boolean;
}

/**
 * Hook for ephemeral global chat room using Supabase Broadcast
 * Messages are not saved to database - only kept in memory
 */
export function useChatRoom(): UseChatRoomResult {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Create broadcast channel for global chat
    const chatChannel = supabase.channel('global-chat', {
      config: {
        broadcast: { self: true } // Allow receiving own messages
      }
    });

    // Listen for new messages
    chatChannel
      .on('broadcast', { event: 'message' }, ({ payload }) => {
        const message = payload as ChatMessage;
        setMessages(prev => {
          // Add new message and keep only last MAX_MESSAGES
          const updated = [...prev, message];
          return updated.slice(-MAX_MESSAGES);
        });
      })
      .on('broadcast', { event: 'delete' }, ({ payload }) => {
        const { messageId } = payload as { messageId: string };
        setMessages(prev => prev.map(msg =>
          msg.id === messageId ? { ...msg, deleted: true } : msg
        ));
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
          console.log('Connected to global chat');
        } else if (status === 'CLOSED') {
          setIsConnected(false);
          console.log('Disconnected from global chat');
        }
      });

    setChannel(chatChannel);

    // Cleanup on unmount
    return () => {
      chatChannel.unsubscribe();
      setIsConnected(false);
    };
  }, []);

  // Send a message to the global chat
  const sendMessage = useCallback((
    content: string,
    user: { id: string; username: string; avatar: string | null }
  ) => {
    if (!channel || !isConnected) {
      console.error('Not connected to chat');
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

    channel.send({
      type: 'broadcast',
      event: 'message',
      payload: message
    });
  }, [channel, isConnected]);

  // Delete a message (soft delete - mark as deleted)
  const deleteMessage = useCallback((messageId: string) => {
    if (!channel || !isConnected) {
      console.error('Not connected to chat');
      return;
    }

    channel.send({
      type: 'broadcast',
      event: 'delete',
      payload: { messageId }
    });
  }, [channel, isConnected]);

  return {
    messages,
    sendMessage,
    deleteMessage,
    isConnected
  };
}
