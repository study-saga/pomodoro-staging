import { useEffect, useRef, useMemo } from 'react';
import { MessageBubble } from './MessageBubble';
import { MessageInput } from './MessageInput';
import { useChatRoom } from '../../hooks/useChatRoom';
import { useRateLimit } from '../../hooks/useRateLimit';
import { useTypingIndicator } from '../../hooks/useTypingIndicator';
import type { AppUser } from '../../lib/types';

interface GlobalChatProps {
  currentUser: AppUser;
}

/**
 * Global chat room component (ephemeral, last 10 messages)
 * Uses Broadcast channels for real-time messaging
 */
export function GlobalChat({ currentUser }: GlobalChatProps) {
  const { messages, sendMessage, deleteMessage, isConnected } = useChatRoom();
  const { canSend, timeUntilReset, messagesRemaining, recordMessage } = useRateLimit();

  const typingUser = useMemo(
    () => ({ id: currentUser.id, username: currentUser.username }),
    [currentUser.id, currentUser.username]
  );
  const { typingUsers, broadcastTyping } = useTypingIndicator('global-chat', typingUser);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = (content: string) => {
    if (!canSend) return;

    sendMessage(content, {
      id: currentUser.id,
      username: currentUser.username,
      avatar: currentUser.avatar
    });

    recordMessage();
  };

  const handleDeleteMessage = (messageId: string) => {
    deleteMessage(messageId);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Connection Status */}
      {!isConnected && (
        <div className="px-4 py-2 bg-yellow-500/10 backdrop-blur text-yellow-200 text-xs text-center border-b border-yellow-500/20">
          Connecting to chat...
        </div>
      )}

      {/* Messages List */}
      <div className="flex-1 overflow-y-auto px-1.5 py-2 space-y-0.5">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 text-xs">
            <p>No messages yet. Say hi! 👋</p>
          </div>
        ) : (
          messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              currentUserId={currentUser.id}
              onDelete={handleDeleteMessage}
              showAvatar
            />
          ))
        )}

        {/* Typing Indicators */}
        {typingUsers.length > 0 && (
          <div className="px-2 py-1.5 text-[11px] text-gray-400 italic">
            {typingUsers.length === 1 ? (
              <span>{typingUsers[0].username} is typing...</span>
            ) : typingUsers.length === 2 ? (
              <span>
                {typingUsers[0].username} and {typingUsers[1].username} are typing...
              </span>
            ) : (
              <span>Several people are typing...</span>
            )}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <MessageInput
        onSendMessage={handleSendMessage}
        onTyping={broadcastTyping}
        placeholder="say something..."
        canSend={canSend}
        timeUntilReset={timeUntilReset}
        messagesRemaining={messagesRemaining}
        disabled={!isConnected}
      />
    </div>
  );
}
