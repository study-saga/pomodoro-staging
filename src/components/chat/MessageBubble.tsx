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
 * Render a chat message bubble showing avatar, username, timestamp, and content; handles deleted messages and an optional own-message delete action.
 *
 * @param message - The chat message to render.
 * @param currentUserId - ID of the current user (used to determine ownership).
 * @param onDelete - Optional callback invoked with the message id when the owner clicks the delete button.
 * @param showAvatar - Whether to render the avatar area (defaults to `true`).
 * @returns A JSX element representing the rendered message bubble.
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
      <div className="flex items-start gap-2 py-1.5 px-2 hover:bg-white/5 rounded-lg group transition-colors">
        {showAvatar && (
          <div className="w-7 h-7 rounded-full bg-gray-700 flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1.5">
            <span className="text-xs font-semibold text-gray-500">
              {message.user.username}
            </span>
            <span className="text-[10px] text-gray-600">{formattedTime}</span>
          </div>
          <p className="text-xs text-gray-500 italic mt-0.5">Message deleted</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2 py-1.5 px-2 hover:bg-white/5 rounded-lg group transition-colors">
      {showAvatar && (
        <div className="w-7 h-7 rounded-full bg-gray-700 flex-shrink-0 overflow-hidden">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={message.user.username}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white text-xs font-semibold">
              {message.user.username.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1.5">
          <span className="text-xs font-semibold text-white">
            {message.user.username}
          </span>
          <span className="text-[10px] text-gray-500">{formattedTime}</span>
        </div>
        <p className="text-xs text-gray-300 mt-0.5 break-words whitespace-pre-wrap leading-relaxed">
          {message.content}
        </p>
      </div>
      {isOwnMessage && onDelete && (
        <button
          onClick={() => onDelete(message.id)}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-500/20 rounded text-red-400 hover:text-red-300 flex-shrink-0"
          title="Delete message"
        >
          <Trash2 size={12} />
        </button>
      )}
    </div>
  );
}