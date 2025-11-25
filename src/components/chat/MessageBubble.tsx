import { Trash2 } from 'lucide-react';
import { formatMessageTime, getAvatarUrl } from '../../lib/chatService';
import type { ChatMessage } from '../../types/chat';

interface MessageBubbleProps {
  message: ChatMessage;
  currentUserId: string;
  onDelete?: (messageId: string) => void;
  showAvatar?: boolean;
}

/**
 * Individual message bubble component
 * Displays user avatar, username, timestamp, and message content
 */
export function MessageBubble({
  message,
  currentUserId,
  onDelete,
  showAvatar = true
}: MessageBubbleProps) {
  const isOwnMessage = message.user.id === currentUserId;
  const avatarUrl = getAvatarUrl(message.user);
  const formattedTime = formatMessageTime(message.timestamp);

  if (message.deleted) {
    return (
      <div className="flex items-start gap-3 py-2 px-3 hover:bg-white/5 rounded-lg group">
        {showAvatar && (
          <div className="w-8 h-8 rounded-full bg-gray-700 flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold text-gray-500">
              {message.user.username}
            </span>
            <span className="text-xs text-gray-600">{formattedTime}</span>
          </div>
          <p className="text-sm text-gray-500 italic mt-0.5">Message deleted</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 py-2 px-3 hover:bg-white/5 rounded-lg group">
      {showAvatar && (
        <div className="w-8 h-8 rounded-full bg-gray-700 flex-shrink-0 overflow-hidden">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={message.user.username}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white text-sm font-semibold">
              {message.user.username.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold text-white">
            {message.user.username}
          </span>
          <span className="text-xs text-gray-400">{formattedTime}</span>
        </div>
        <p className="text-sm text-gray-200 mt-0.5 break-words whitespace-pre-wrap">
          {message.content}
        </p>
      </div>
      {isOwnMessage && onDelete && (
        <button
          onClick={() => onDelete(message.id)}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-red-500/20 rounded text-red-400 hover:text-red-300 flex-shrink-0"
          title="Delete message"
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
}
