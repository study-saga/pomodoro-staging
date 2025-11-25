import { useEffect, useRef } from 'react';
import { MessageBubble } from './MessageBubble';
import { MessageInput } from './MessageInput';
import { useChat } from '../../contexts/ChatContext';
import { useRateLimit } from '../../hooks/useRateLimit';
import type { AppUser } from '../../lib/types';

interface GlobalChatProps {
  currentUser: AppUser;
}

/**
 * Global chat room component (ephemeral, last 10 messages)
 * Uses Broadcast channels for real-time messaging
 */
export function GlobalChat({ currentUser }: GlobalChatProps) {
  const { globalMessages, sendGlobalMessage, deleteGlobalMessage, isGlobalConnected } = useChat();
  const { canSend, timeUntilReset, messagesRemaining, recordMessage } = useRateLimit();

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [globalMessages]);

  const handleSendMessage = (content: string) => {
    if (!canSend) return;

    sendGlobalMessage(content, {
      id: currentUser.id,
      username: currentUser.username,
      avatar: currentUser.avatar
    });

    recordMessage();
  };

  const handleDeleteMessage = (messageId: string) => {
    deleteGlobalMessage(messageId);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Connection Status */}
      {!isGlobalConnected && (
        <div className="px-4 py-2 bg-yellow-500/10 backdrop-blur text-yellow-200 text-xs text-center border-b border-yellow-500/20">
          Connecting to chat...
        </div>
      )}

      {/* Messages List */}
      <div className="flex-1 overflow-y-auto px-1.5 py-2 space-y-0.5">
        {globalMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 text-xs">
            <p>No messages yet. Say hi! 👋</p>
          </div>
        ) : (
          globalMessages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              currentUserId={currentUser.id}
              onDelete={handleDeleteMessage}
              showAvatar
            />
          ))
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <MessageInput
        onSendMessage={handleSendMessage}
        placeholder="say something..."
        canSend={canSend}
        timeUntilReset={timeUntilReset}
        messagesRemaining={messagesRemaining}
        disabled={!isGlobalConnected}
      />
    </div>
  );
}
