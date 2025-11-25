import { useEffect, useRef } from 'react';
import { ArrowLeft } from 'lucide-react';
import { MessageBubble } from './MessageBubble';
import { MessageInput } from './MessageInput';
import { usePrivateMessages } from '../../hooks/usePrivateMessages';
import { useRateLimit } from '../../hooks/useRateLimit';
import { useTypingIndicator } from '../../hooks/useTypingIndicator';
import { useChatNotifications } from '../../hooks/useChatNotifications';
import { getConversationId } from '../../lib/chatService';
import type { AppUser } from '../../lib/types';

interface ConversationViewProps {
  currentUser: AppUser;
  recipientId: string;
  recipientUsername: string;
  onBack: () => void;
}

/**
 * DM conversation thread view
 * Shows message history with a specific user
 */
export function ConversationView({
  currentUser,
  recipientId,
  recipientUsername,
  onBack
}: ConversationViewProps) {
  const { messages, loading, sendMessage, deleteMessage, isConnected } = usePrivateMessages(
    currentUser.id,
    recipientId
  );
  const { canSend, timeUntilReset, messagesRemaining, recordMessage } = useRateLimit();
  const conversationId = getConversationId(currentUser.id, recipientId);
  const { typingUsers, broadcastTyping } = useTypingIndicator(conversationId, {
    id: currentUser.id,
    username: currentUser.username
  });
  const { showNotification, permission, requestPermission } = useChatNotifications();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef(messages.length);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Show notification for new messages from recipient
  useEffect(() => {
    if (messages.length > prevMessageCountRef.current) {
      const newMessage = messages[messages.length - 1];

      // Only notify for messages from recipient
      if (newMessage.sender_id === recipientId) {
        if (permission === 'granted') {
          showNotification(
            `${recipientUsername}`,
            newMessage.content,
            () => {
              // Focus app when notification clicked
              window.focus();
            }
          );
        } else if (permission === 'default') {
          requestPermission();
        }
      }
    }
    prevMessageCountRef.current = messages.length;
  }, [messages, recipientId, recipientUsername, permission, showNotification, requestPermission]);

  const handleSendMessage = async (content: string) => {
    if (!canSend) return;

    try {
      await sendMessage(content);
      recordMessage();
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    try {
      await deleteMessage(messageId);
    } catch (error) {
      console.error('Failed to delete message:', error);
    }
  };

  // Convert PrivateMessages to ChatMessages for MessageBubble
  const chatMessages = messages.map((msg) => ({
    id: msg.id,
    user: {
      id: msg.sender_id,
      username: msg.sender_id === currentUser.id ? currentUser.username : recipientUsername,
      avatar: msg.sender_id === currentUser.id ? currentUser.avatar : null
    },
    content: msg.content,
    timestamp: new Date(msg.created_at).getTime(),
    deleted: msg.deleted_by_sender || msg.deleted_by_recipient
  }));

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-3 py-3 border-b border-white/10 bg-gray-900/50">
        <button
          onClick={onBack}
          className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
          title="Back to conversations"
        >
          <ArrowLeft size={18} className="text-gray-300" />
        </button>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-white">{recipientUsername}</h3>
          {!isConnected && (
            <p className="text-xs text-yellow-400">Connecting...</p>
          )}
        </div>
      </div>

      {/* Messages List */}
      <div className="flex-1 overflow-y-auto px-2 py-4 space-y-1">
        {loading ? (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            <p>Loading messages...</p>
          </div>
        ) : chatMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 text-sm">
            <p>No messages yet</p>
            <p className="text-xs text-gray-500 mt-1">Start the conversation!</p>
          </div>
        ) : (
          chatMessages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              currentUserId={currentUser.id}
              onDelete={handleDeleteMessage}
              showAvatar={false}
            />
          ))
        )}

        {/* Typing Indicator */}
        {typingUsers.length > 0 && (
          <div className="px-3 py-2 text-sm text-gray-400 italic">
            {recipientUsername} is typing...
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <MessageInput
        onSendMessage={handleSendMessage}
        onTyping={broadcastTyping}
        placeholder={`Message ${recipientUsername}...`}
        canSend={canSend}
        timeUntilReset={timeUntilReset}
        messagesRemaining={messagesRemaining}
        disabled={!isConnected || loading}
      />
    </div>
  );
}
