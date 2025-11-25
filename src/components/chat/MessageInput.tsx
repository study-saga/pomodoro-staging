import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import { Send } from 'lucide-react';
import { validateMessage } from '../../lib/chatService';

interface MessageInputProps {
  onSendMessage: (content: string) => void;
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
    <div className="border-t border-white/5 p-2">
      {/* Error/Warning Messages */}
      {error && (
        <div className="text-[10px] text-red-400 mb-1.5 px-1">
          {error}
        </div>
      )}
      {!canSend && timeUntilReset > 0 && (
        <div className="text-[10px] text-yellow-400 mb-1.5 px-1">
          Rate limit: {timeUntilReset}s ({messagesRemaining} left)
        </div>
      )}

      <div className="flex items-end gap-1.5">
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
            className="w-full bg-white/5 text-white placeholder-gray-500 rounded-lg px-2.5 py-1.5 pr-10 resize-none border border-white/5 focus:border-purple-500/30 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed max-h-24 text-xs"
          />

          {/* Character Counter */}
          {showCharCount && (
            <div
              className={`absolute bottom-1.5 right-2 text-[10px] ${
                isOverLimit ? 'text-red-400' : 'text-gray-500'
              }`}
            >
              {charCount}/500
            </div>
          )}
        </div>

        {/* Send Button */}
        <button
          onClick={handleSend}
          disabled={disabled || !canSend || !content.trim() || isOverLimit}
          className="p-1.5 bg-purple-600/80 hover:bg-purple-600 disabled:bg-gray-700/50 disabled:cursor-not-allowed rounded-lg text-white transition-colors"
          title="Send (Enter)"
        >
          <Send size={16} />
        </button>
      </div>

      {/* Helper Text */}
      <div className="text-[10px] text-gray-600 mt-1 px-1">
        <span>Shift+Enter for new line</span>
      </div>
    </div>
  );
}
