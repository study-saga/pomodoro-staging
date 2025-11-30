import { useEffect, useRef, useState, useCallback, memo } from 'react';
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
export function GlobalChatMessages({ currentUser, onBanUser }: GlobalChatMessagesProps) {
  const { globalMessages, deleteGlobalMessage, userRole, reportMessage, isGlobalConnected } = useChat();
  const listRef = useRef<VariableSizeList>(null);
  const sizeMap = useRef<Record<number, number>>({});
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);

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

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (shouldAutoScroll && listRef.current && globalMessages.length > 0) {
      // Use RAF to ensure scroll happens after layout
      requestAnimationFrame(() => {
        if (listRef.current) {
          listRef.current.scrollToItem(globalMessages.length - 1, 'end');
        }
      });
    }
  }, [globalMessages.length, shouldAutoScroll]);

  // Initial scroll to bottom on mount (restore position)
  useEffect(() => {
    // Small timeout to ensure list is fully rendered/measured
    const timer = setTimeout(() => {
      if (listRef.current && globalMessages.length > 0) {
        listRef.current.scrollToItem(globalMessages.length - 1, 'end');
      }
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  // Handle scroll to detect if user scrolled up
  const handleScroll = ({ scrollDirection }: { scrollDirection: 'forward' | 'backward' }) => {
    // If user scrolls up (backward), disable auto-scroll
    if (scrollDirection === 'backward') {
      setShouldAutoScroll(false);
    } else {
      // If user scrolls down, check if they are near the bottom
      // Access outerRef via type assertion since it's not in the public types but exists at runtime
      const listInstance = listRef.current as any;
      const outerElement = listInstance?.outerRef?.current as HTMLDivElement;

      if (outerElement) {
        const { scrollHeight, clientHeight, scrollTop } = outerElement;
        // If we are within 100px of the bottom, re-enable auto-scroll
        if (scrollHeight - (scrollTop + clientHeight) < 100) {
          setShouldAutoScroll(true);
        }
      } else {
        // Fallback if ref is missing
        setShouldAutoScroll(true);
      }
    }
  };

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
                  className="scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent hover:scrollbar-thumb-white/20"
                  onScroll={handleScroll}
                >
                  {Row}
                </VariableSizeList>
              )}
            </AutoSizer>
          )}
        </div>
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
