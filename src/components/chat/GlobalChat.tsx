import { useEffect, useRef, useState, useCallback, memo, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { useChat } from '../../contexts/ChatContext';
import type { AppUser } from '../../lib/types';
import { VariableSizeList, type ListChildComponentProps } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import { ChatMessage } from './ChatMessage';
import { ReportModal } from './ReportModal';
import { ChatContextMenu } from './ChatContextMenu';

interface GlobalChatMessagesProps {
  currentUser: AppUser;
  onBanUser: (user: { id: string; username: string }) => void;
  isExpanded: boolean;
}

// Row component for virtualization
const Row = memo(({ index, style, data }: ListChildComponentProps) => {
  const { messages, currentUser, onContextMenu, onDelete, userRole, setSize } = data;
  const msg = messages[index];
  const rowRef = useRef<HTMLDivElement>(null);

  // Calculate showAvatar logic
  const showAvatar = index === 0 || messages[index - 1].user.id !== msg.user.id || (msg.timestamp - messages[index - 1].timestamp > 60000);

  useEffect(() => {
    if (rowRef.current) {
      setSize(index, rowRef.current.getBoundingClientRect().height);
    }
  }, [setSize, index, msg.content, showAvatar]); // Re-measure if content or avatar status changes

  return (
    <div style={style}>
      <div ref={rowRef} className="pb-0.5">
        <ChatMessage
          message={msg}
          currentUser={currentUser}
          showAvatar={showAvatar}
          onContextMenu={onContextMenu}
          onDelete={onDelete}
          userRole={userRole}
        />
      </div>
    </div>
  );
});

/**
 * Global chat messages list
 * Displays the list of messages and handles auto-scrolling
 */
export function GlobalChatMessages({ currentUser, onBanUser, isExpanded }: GlobalChatMessagesProps) {
  const { globalMessages, deleteGlobalMessage, userRole, reportMessage, isGlobalConnected } = useChat();
  const listRef = useRef<VariableSizeList>(null);
  const sizeMap = useRef<Record<number, number>>({});
  const [showScrollButton, setShowScrollButton] = useState(false);
  const shouldAutoScrollRef = useRef(true);
  const prevIsExpandedRef = useRef(isExpanded);

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; userId: string; username: string; messageId: string; content: string } | null>(null);

  const setSize = useCallback((index: number, size: number) => {
    if (sizeMap.current[index] !== size) {
      sizeMap.current[index] = size;
      listRef.current?.resetAfterIndex(index);
    }
  }, []);

  const getSize = useCallback((index: number) => {
    return sizeMap.current[index] || 60; // Default estimated height
  }, []);

  // Scroll to bottom - ALWAYS works
  const scrollToBottom = useCallback(() => {
    if (listRef.current && globalMessages.length > 0) {
      listRef.current.scrollToItem(globalMessages.length - 1, 'end');
      shouldAutoScrollRef.current = true;
      setShowScrollButton(false);
    }
  }, [globalMessages.length]);

  // Auto-scroll on new messages (using useLayoutEffect for immediate execution)
  useLayoutEffect(() => {
    if (globalMessages.length > 0) {
      const lastMessage = globalMessages[globalMessages.length - 1];
      const isMyMessage = lastMessage.user.id === currentUser.id;

      let shouldScroll = shouldAutoScrollRef.current || isMyMessage;

      // Fallback: Check if we are physically near the bottom (e.g. within 150px)
      // This handles cases where state might be desynced but user is effectively at the bottom
      if (!shouldScroll && listRef.current) {
        const listInstance = listRef.current as any;
        const outerElement = listInstance?.outerRef?.current as HTMLDivElement;
        if (outerElement) {
          const { scrollHeight, clientHeight, scrollTop } = outerElement;
          const distanceToBottom = scrollHeight - (scrollTop + clientHeight);
          if (distanceToBottom < 150) {
            shouldScroll = true;
          }
        }
      }

      // Scroll if auto-scroll is enabled OR if it's my own message OR if near bottom
      if (shouldScroll) {
        // If we are scrolling, ensure state is synced
        shouldAutoScrollRef.current = true;
        setShowScrollButton(false);

        if (listRef.current) {
          const lastIndex = globalMessages.length - 1;
          // Reset heights for new messages (dynamic height calculation)
          listRef.current.resetAfterIndex(lastIndex, false);
          // Scroll to new message
          listRef.current.scrollToItem(lastIndex, 'end');
        }
      }
    }
  }, [globalMessages.length, currentUser.id]);

  // Initial scroll on mount (with render delay for virtualization)
  useLayoutEffect(() => {
    if (globalMessages.length > 0 && listRef.current) {
      // Reset heights before scrolling (ensures accurate measurement)
      listRef.current.resetAfterIndex(0, false);

      // Small delay to ensure virtualized list fully rendered
      const timeoutId = setTimeout(() => {
        if (listRef.current) {
          listRef.current.scrollToItem(globalMessages.length - 1, 'end');
          shouldAutoScrollRef.current = true;
        }
      }, 50); // 50ms allows VariableSizeList to calculate heights

      return () => clearTimeout(timeoutId);
    }
  }, []); // Empty deps = run once on mount

  // Scroll to bottom when chat is reopened (detects false -> true transition)
  useLayoutEffect(() => {
    const wasExpanded = prevIsExpandedRef.current;
    prevIsExpandedRef.current = isExpanded;

    // Only scroll if chat was just opened (false -> true)
    if (!wasExpanded && isExpanded && globalMessages.length > 0) {
      // Delay to ensure panel animation started and virtualized list rendered
      const timeoutId = setTimeout(() => {
        if (listRef.current) {
          // Reset heights before scrolling (panel was hidden)
          listRef.current.resetAfterIndex(0, false);
          listRef.current.scrollToItem(globalMessages.length - 1, 'end');
          shouldAutoScrollRef.current = true;
          setShowScrollButton(false);
        }
      }, 50); // Increased from 10ms to 50ms for virtualization

      return () => clearTimeout(timeoutId);
    }
  }, [isExpanded, globalMessages.length]);

  // Handle scroll - detect if user scrolled up
  const handleScroll = useCallback((props: { scrollDirection: 'forward' | 'backward'; scrollOffset: number; scrollUpdateWasRequested: boolean }) => {
    const { scrollDirection, scrollUpdateWasRequested } = props;

    // If this was a programmatic scroll (auto-scroll), don't change state
    if (scrollUpdateWasRequested) {
      return;
    }

    // User manually scrolled
    if (scrollDirection === 'backward') {
      // Scrolled up - disable auto-scroll and show button
      shouldAutoScrollRef.current = false;
      setShowScrollButton(true);
    } else {
      // Scrolled down - check if near bottom
      const listInstance = listRef.current as any;
      const outerElement = listInstance?.outerRef?.current as HTMLDivElement;

      if (outerElement) {
        const { scrollHeight, clientHeight, scrollTop } = outerElement;
        const isNearBottom = scrollHeight - (scrollTop + clientHeight) < 100;

        if (isNearBottom) {
          shouldAutoScrollRef.current = true;
          setShowScrollButton(false);
        }
      }
    }
  }, []);

  // Close context menu on click outside
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent, userId: string, username: string, _targetRole?: string, messageId?: string, content?: string) => {
    e.preventDefault(); // Always prevent default context menu
    console.log('[GlobalChat] Context menu triggered for:', username, 'by role:', userRole);

    // Prevent banning self (or reporting self via context menu, though UI hides it)
    if (userId === currentUser.id) {
      return;
    }

    // Role-based protection for BANNING is handled in handleBanClick and the UI rendering
    // We allow the menu to open for everyone so they can Report

    if (messageId && content) {
      setContextMenu({ x: e.clientX, y: e.clientY, userId, username, messageId, content });
    } else {
      setContextMenu({ x: e.clientX, y: e.clientY, userId, username, messageId: '', content: '' });
    }
  }, [currentUser.id, userRole]);

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

  const itemData = {
    messages: globalMessages,
    currentUser,
    onContextMenu: handleContextMenu,
    onDelete: deleteGlobalMessage,
    onReport: handleReportClick,
    userRole,
    setSize
  };

  return (
    <>
      <div className="flex flex-col h-full">
        {/* Connection Status */}
        {!isGlobalConnected && (
          <div className="px-4 py-2 bg-yellow-500/10 backdrop-blur text-yellow-200 text-xs text-center border-b border-yellow-500/20">
            Connecting to chat...
          </div>
        )}

        {/* Messages List */}
        <div className="flex-1 min-h-0 px-1.5">
          {globalMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 text-xs">
              <p>No messages yet. Say hi! 👋</p>
            </div>
          ) : (
            <AutoSizer>
              {({ height, width }) => (
                <VariableSizeList
                  ref={listRef}
                  height={height}
                  width={width}
                  itemCount={globalMessages.length}
                  itemSize={getSize}
                  itemData={itemData}
                  style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                  className="[&::-webkit-scrollbar]:hidden"
                  onScroll={handleScroll}
                >
                  {Row}
                </VariableSizeList>
              )}
            </AutoSizer>
          )}
        </div>

        {/* Scroll to Bottom Button - appears when scrolled up */}
        {showScrollButton && globalMessages.length > 0 && (
          <button
            onClick={scrollToBottom}
            className="absolute bottom-4 right-4 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-white rounded-full p-3 shadow-xl transition-all duration-300 hover:scale-110 hover:shadow-2xl hover:border-white/30 z-10 group"
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
              className="transition-transform duration-300 group-hover:translate-y-0.5"
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
