import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { PrivateMessage } from '../types/chat';
import { getConversationId } from '../lib/chatService';

interface UsePrivateMessagesResult {
  messages: PrivateMessage[];
  loading: boolean;
  sendMessage: (content: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  isConnected: boolean;
}

/**
 * Hook for private messages between two users
 * Uses Supabase Postgres with RLS and real-time subscriptions
 */
export function usePrivateMessages(
  currentUserId: string,
  recipientId: string
): UsePrivateMessagesResult {
  const [messages, setMessages] = useState<PrivateMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);

  // Create deterministic conversation ID (sorted UUIDs)
  const conversationId = getConversationId(currentUserId, recipientId);

  useEffect(() => {
    let mounted = true;

    // Load existing messages
    async function loadMessages() {
      try {
        const { data, error } = await supabase
          .from('private_messages')
          .select('*')
          .or(
            `and(sender_id.eq.${currentUserId},recipient_id.eq.${recipientId}),` +
            `and(sender_id.eq.${recipientId},recipient_id.eq.${currentUserId})`
          )
          .order('created_at', { ascending: true });

        if (error) {
          console.error('Error loading messages:', error);
        } else if (mounted) {
          setMessages(data || []);
        }
      } catch (error) {
        console.error('Failed to load messages:', error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadMessages();

    // Subscribe to new messages in this conversation
    const dmChannel = supabase
      .channel(`dm:${conversationId}`, {
        config: { private: true }
      })
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'private_messages',
          filter: `sender_id=eq.${recipientId}`
        },
        (payload) => {
          if (mounted) {
            const newMessage = payload.new as PrivateMessage;
            // Only add if it's for the current user
            if (newMessage.recipient_id === currentUserId) {
              setMessages((prev) => [...prev, newMessage]);
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'private_messages'
        },
        (payload) => {
          if (mounted) {
            const updatedMessage = payload.new as PrivateMessage;
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === updatedMessage.id ? updatedMessage : msg
              )
            );
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
          console.log(`Connected to DM channel: ${conversationId}`);
        } else if (status === 'CLOSED') {
          setIsConnected(false);
          console.log(`Disconnected from DM channel: ${conversationId}`);
        }
      });

    return () => {
      mounted = false;
      dmChannel.unsubscribe();
      setIsConnected(false);
    };
  }, [currentUserId, recipientId, conversationId]);

  // Send a new message
  const sendMessage = useCallback(
    async (content: string) => {
      try {
        const { data, error } = await supabase
          .from('private_messages')
          .insert({
            sender_id: currentUserId,
            recipient_id: recipientId,
            content
          })
          .select()
          .single();

        if (error) {
          console.error('Error sending message:', error);
          throw error;
        }

        // Add message to local state immediately
        if (data) {
          setMessages((prev) => [...prev, data]);
        }
      } catch (error) {
        console.error('Failed to send message:', error);
        throw error;
      }
    },
    [currentUserId, recipientId]
  );

  // Soft delete a message
  const deleteMessage = useCallback(
    async (messageId: string) => {
      try {
        // Find the message to determine if user is sender or recipient
        const message = messages.find((m) => m.id === messageId);
        if (!message) {
          console.error('Message not found');
          return;
        }

        const isSender = message.sender_id === currentUserId;

        // Update the appropriate deletion flag
        const { error } = await supabase
          .from('private_messages')
          .update({
            ...(isSender
              ? { deleted_by_sender: true }
              : { deleted_by_recipient: true })
          })
          .eq('id', messageId);

        if (error) {
          console.error('Error deleting message:', error);
          throw error;
        }

        // Remove from local state
        setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
      } catch (error) {
        console.error('Failed to delete message:', error);
        throw error;
      }
    },
    [currentUserId, messages]
  );

  return {
    messages,
    loading,
    sendMessage,
    deleteMessage,
    isConnected
  };
}
