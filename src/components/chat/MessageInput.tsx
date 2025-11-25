import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { Send, Smile } from 'lucide-react';
import { validateMessage } from '../../lib/chatService';

interface MessageInputProps {
  onSendMessage: (content: string) => void;
  onTyping?: () => void;
  placeholder?: string;
  canSend: boolean;
  timeUntilReset?: number;
  messagesRemaining?: number;
  disabled?: boolean;
}

/**
 * Message input component with character limit and rate limiting
 */
export function MessageInput({
  onSendMessage,
  onTyping,
  placeholder = 'say something...',
  canSend,
  timeUntilReset = 0,
  messagesRemaining = 10,
  disabled = false
}: MessageInputProps) {
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [content]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setContent(newContent);
    setError(null);

    // Trigger typing indicator
    if (onTyping) {
      onTyping();
    }
  };

  const handleSend = () => {
    if (disabled) return;

    const trimmed = content.trim();
    if (!trimmed) {
      setError('Message cannot be empty');
      return;
    }

    if (!canSend) {
      setError(`Rate limit reached. Try again in ${timeUntilReset}s`);
      return;
    }

    const validation = validateMessage(trimmed);
    if (!validation.valid) {
      setError(validation.error || 'Invalid message');
      return;
    }

    onSendMessage(trimmed);
    setContent('');
    setError(null);

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const charCount = content.length;
  const showCharCount = charCount > 400;
  const isOverLimit = charCount > 500;

  return (
    <div className="border-t border-white/10 bg-gray-900/50 p-3">
      {/* Error/Warning Messages */}
      {error && (
        <div className="text-xs text-red-400 mb-2 px-2">
          {error}
        </div>
      )}
      {!canSend && timeUntilReset > 0 && (
        <div className="text-xs text-yellow-400 mb-2 px-2">
          Rate limit: {timeUntilReset}s cooldown ({messagesRemaining} msgs left)
        </div>
      )}

      <div className="flex items-end gap-2">
        {/* Textarea */}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            className="w-full bg-white/5 text-white placeholder-gray-400 rounded-lg px-3 py-2 pr-10 resize-none border border-white/10 focus:border-purple-500/50 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed max-h-32 text-sm"
          />

          {/* Character Counter */}
          {showCharCount && (
            <div
              className={`absolute bottom-2 right-2 text-xs ${
                isOverLimit ? 'text-red-400' : 'text-gray-400'
              }`}
            >
              {charCount}/500
            </div>
          )}
        </div>

        {/* Emoji Button (placeholder for future implementation) */}
        <button
          type="button"
          className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-gray-300 transition-colors"
          title="Emoji (coming soon)"
          disabled
        >
          <Smile size={20} />
        </button>

        {/* Send Button */}
        <button
          onClick={handleSend}
          disabled={disabled || !canSend || !content.trim() || isOverLimit}
          className="p-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg text-white transition-colors"
          title="Send message (Enter)"
        >
          <Send size={20} />
        </button>
      </div>

      {/* Helper Text */}
      <div className="text-xs text-gray-500 mt-2 px-2">
        <span className="opacity-75">Shift + Enter for new line</span>
      </div>
    </div>
  );
}
