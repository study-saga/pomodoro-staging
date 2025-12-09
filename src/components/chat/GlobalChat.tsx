import { useEffect, useRef, useState, useCallback, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { useChat } from '../../contexts/ChatContext';
import type { AppUser } from '../../lib/types';
import { ChatMessage } from './ChatMessage';
import { ReportModal } from './ReportModal';
import { ChatContextMenu } from './ChatContextMenu';

interface GlobalChatMessagesProps {
  currentUser: AppUser;
  onBanUser: (user: { id: string; username: string }) => void;
  isExpanded: boolean;
}

/**
 * Global chat messages list
 * Displays the list of messages and handles auto-scrolling
 */
export function GlobalChatMessages({ currentUser, onBanUser, isExpanded }: GlobalChatMessagesProps) {
  const { globalMessages, deleteGlobalMessage, userRole, reportMessage, connectionState, retryCount, manualRetry } = useChat();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const shouldAutoScrollRef = useRef(true);
  const prevIsExpandedRef = useRef(isExpanded);

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; userId: string; username: string; messageId: string; content: string } | null>(null);

  // Scroll to bottom helper
  const scrollToBottom = useCallback((smooth = false) => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
      shouldAutoScrollRef.current = true;
      setShowScrollButton(false);
    }
  }, []);

  // Handle scroll to detect if user is at bottom
  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    // User is considered at bottom if within 100px of the bottom
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;

    shouldAutoScrollRef.current = isAtBottom;
    setShowScrollButton(!isAtBottom);
  }, []);

  // Auto-scroll on new messages
  useLayoutEffect(() => {
    if (globalMessages.length === 0) return;

    const lastMessage = globalMessages[globalMessages.length - 1];
    const isMe = lastMessage?.user.id === currentUser.id;

    // Scroll if we were already at the bottom OR if I sent the message
    if (shouldAutoScrollRef.current || isMe) {
      scrollToBottom();
    }
  }, [globalMessages, currentUser.id, scrollToBottom]);

  // Scroll to bottom when chat is reopened
  useLayoutEffect(() => {
    const wasExpanded = prevIsExpandedRef.current;
    prevIsExpandedRef.current = isExpanded;

    if (!wasExpanded && isExpanded) {
      // Small timeout to allow layout to settle
      setTimeout(() => {
        scrollToBottom();
      }, 50);
    }
  }, [isExpanded, scrollToBottom]);

  // Close context menu on click outside
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent, userId: string, username: string, _targetRole?: string, messageId?: string, content?: string) => {
    e.preventDefault();

    if (userId === currentUser.id) {
      return;
    }

    if (messageId && content) {
      setContextMenu({ x: e.clientX, y: e.clientY, userId, username, messageId, content });
    } else {
      setContextMenu({ x: e.clientX, y: e.clientY, userId, username, messageId: '', content: '' });
    }
  }, [currentUser.id]);

  const handleBanClick = () => {
    if (contextMenu) {
      onBanUser({ id: contextMenu.userId, username: contextMenu.username });
      setContextMenu(null);
    }
  };

  const handleContextReportClick = () => {
    if (contextMenu && contextMenu.messageId) {
      handleReportClick(contextMenu.messageId, contextMenu.userId, contextMenu.username, contextMenu.content);
      setContextMenu(null);
    }
  };

  // Report Modal State
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [selectedUserToReport, setSelectedUserToReport] = useState<{ id: string; username: string; messageId: string; content: string } | null>(null);

  const handleReportClick = (messageId: string, userId: string, username: string, content: string) => {
    setSelectedUserToReport({ id: userId, username, messageId, content });
    setReportModalOpen(true);
  };

  const handleReportConfirm = async (reason: string) => {
    if (selectedUserToReport) {
      await reportMessage(
        selectedUserToReport.messageId,
        reason,
        selectedUserToReport.id,
        selectedUserToReport.username,
        selectedUserToReport.content
      );
      setReportModalOpen(false);
      setSelectedUserToReport(null);
    }
  };

  return (
    <>
      <div className="flex flex-col h-full relative">
        {/* Connection Status */}
        {connectionState === 'connecting' && (
          <div className="px-4 py-2 bg-yellow-500/10 backdrop-blur text-yellow-200 text-xs text-center border-b border-yellow-500/20 flex-shrink-0">
            Connecting to chat...
          </div>
        )}
        {connectionState === 'reconnecting' && (
          <div className="px-4 py-2 bg-yellow-500/10 backdrop-blur text-yellow-200 text-xs text-center border-b border-yellow-500/20 flex-shrink-0">
            Reconnecting... (attempt {retryCount + 1}/4)
          </div>
        )}
        {connectionState === 'error' && (
          <div className="px-4 py-2 bg-red-500/10 backdrop-blur border-b border-red-500/20 flex-shrink-0">
            <div className="flex items-center justify-between text-xs">
              <span className="text-red-400">Connection failed</span>
              <button
                onClick={manualRetry}
                className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 rounded text-red-400 transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Messages List */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 min-h-0 px-1.5 overflow-y-auto no-scrollbar"
        >
          {globalMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 text-xs">
              <p>No messages yet. Say hi! 👋</p>
            </div>
          ) : (
            <div className="flex flex-col pb-2">
              {globalMessages.map((msg, index) => {
                const showAvatar = index === 0 || globalMessages[index - 1].user.id !== msg.user.id || (msg.timestamp - globalMessages[index - 1].timestamp > 60000);

                return (
                  <div key={msg.id} className="pb-0.5">
                    <ChatMessage
                      message={msg}
                      currentUser={currentUser}
                      showAvatar={showAvatar}
                      onContextMenu={handleContextMenu}
                      onDelete={deleteGlobalMessage}
                      onReport={handleReportClick}
                      userRole={userRole}
                    />
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* Scroll to Bottom Button - appears when scrolled up */}
        {showScrollButton && globalMessages.length > 0 && (
          <button
            onClick={() => scrollToBottom(true)}
            className="absolute bottom-6 right-6 md:bottom-4 md:right-4 bg-black/50 hover:bg-black/70 backdrop-blur-md border border-white/10 text-white rounded-full p-3 md:p-2 shadow-lg transition-all duration-300 hover:scale-110 z-10 group"
            aria-label="Scroll to bottom"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="transition-transform duration-300 group-hover:translate-y-0.5 w-5 h-5 md:w-4 md:h-4"
            >
              <path d="M12 5v14M19 12l-7 7-7-7" />
            </svg>
          </button>
        )}
      </div>

      {createPortal(
        <>
          {/* Context Menu */}
          <ChatContextMenu
            contextMenu={contextMenu}
            onClose={() => setContextMenu(null)}
            onReport={handleContextReportClick}
            onBan={handleBanClick}
            userRole={userRole}
          />

          {/* Report Modal */}
          <ReportModal
            isOpen={reportModalOpen}
            onClose={() => setReportModalOpen(false)}
            onReport={handleReportConfirm}
            username={selectedUserToReport?.username || ''}
          />
        </>,
        document.body
      )}
    </>
  );
}
