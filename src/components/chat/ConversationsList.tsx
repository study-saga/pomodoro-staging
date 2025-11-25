import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { getAvatarUrl, formatRelativeTime, truncateMessage } from '../../lib/chatService';
import type { Conversation } from '../../types/chat';

interface ConversationsListProps {
  currentUserId: string;
  onConversationClick: (userId: string, username: string) => void;
}

/**
 * List of DM conversations with last message preview
 * Shows unread count and timestamp
 */
export function ConversationsList({
  currentUserId,
  onConversationClick
}: ConversationsListProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadConversations();
  }, [currentUserId]);

  const loadConversations = async () => {
    try {
      setLoading(true);

      // Get all messages where user is sender or recipient
      const { data: messages, error } = await supabase
        .from('private_messages')
        .select('*')
        .or(`sender_id.eq.${currentUserId},recipient_id.eq.${currentUserId}`)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading conversations:', error);
        return;
      }

      if (!messages || messages.length === 0) {
        setConversations([]);
        return;
      }

      // Group messages by conversation partner
      const conversationMap = new Map<string, Conversation>();

      for (const msg of messages) {
        const partnerId = msg.sender_id === currentUserId ? msg.recipient_id : msg.sender_id;

        if (!conversationMap.has(partnerId)) {
          // Get partner's user info
          const { data: partnerData } = await supabase
            .from('users')
            .select('username, avatar')
            .eq('id', partnerId)
            .single();

          if (partnerData) {
            conversationMap.set(partnerId, {
              userId: partnerId,
              username: partnerData.username,
              avatar: partnerData.avatar,
              lastMessage: msg.content,
              lastMessageTime: new Date(msg.created_at).getTime(),
              unreadCount: 0 // TODO: Implement unread count
            });
          }
        }
      }

      setConversations(Array.from(conversationMap.values()));
    } catch (error) {
      console.error('Failed to load conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
        <p>Loading conversations...</p>
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400 text-sm p-4">
        <p>No conversations yet</p>
        <p className="text-xs mt-2 text-gray-500">
          Click on an online user to start chatting
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-2 space-y-1">
        {conversations.map((conv) => {
          const avatarUrl = getAvatarUrl({ avatar: conv.avatar });
          const relativeTime = formatRelativeTime(conv.lastMessageTime);
          const truncatedMessage = truncateMessage(conv.lastMessage, 40);

          return (
            <button
              key={conv.userId}
              onClick={() => onConversationClick(conv.userId, conv.username)}
              className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 transition-colors text-left"
            >
              {/* Avatar */}
              <div className="w-10 h-10 rounded-full bg-gray-700 flex-shrink-0 overflow-hidden">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={conv.username}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white text-sm font-semibold">
                    {conv.username.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2 mb-0.5">
                  <span className="text-sm font-semibold text-white truncate">
                    {conv.username}
                  </span>
                  <span className="text-xs text-gray-400 flex-shrink-0">
                    {relativeTime}
                  </span>
                </div>
                <p className="text-sm text-gray-400 truncate">
                  {truncatedMessage}
                </p>
              </div>

              {/* Unread Badge */}
              {conv.unreadCount > 0 && (
                <div className="flex-shrink-0 bg-purple-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {conv.unreadCount}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
