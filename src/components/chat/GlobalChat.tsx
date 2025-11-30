import { useEffect, useRef, useState, useCallback, memo } from 'react';
import { createPortal } from 'react-dom';
import { useChat } from '../../contexts/ChatContext';
import { AlertTriangle } from 'lucide-react';
import type { AppUser } from '../../lib/types';
import { toast } from 'sonner';
import { VariableSizeList, type ListChildComponentProps } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import { ChatMessage } from './ChatMessage';
import { ReportModal } from './ReportModal';

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
  const { globalMessages, deleteGlobalMessage, userRole, isGlobalConnected } = useChat();
  const listRef = useRef<VariableSizeList>(null);
  const sizeMap = useRef<Record<number, number>>({});
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; userId: string; username: string } | null>(null);

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
    if (shouldAutoScroll && listRef.current) {
      listRef.current.scrollToItem(globalMessages.length - 1, 'end');
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
  const handleScroll = ({ scrollDirection }: { scrollOffset: number, scrollDirection: 'forward' | 'backward' }) => {
    // Simple logic: if scrolled to bottom, enable auto-scroll.
    // However, react-window doesn't give us scrollHeight easily in onScroll.
    // We can assume if scrollDirection is backward, user is scrolling up.
    if (scrollDirection === 'backward') {
      setShouldAutoScroll(false);
    } else {
      // If we are near bottom, enable auto-scroll?
      // This is tricky with virtualization.
      // For now, let's just enable auto-scroll on new messages if we were already at bottom?
      // Or just always auto-scroll if user didn't manually scroll up?
      // Let's stick to simple: if user scrolls up, disable. If they scroll down to bottom, enable.
      // But we don't know "bottom" easily.
      // Let's just set it to true on mount and if they scroll down?
      // Actually, a common pattern is:
      // If (scrollHeight - scrollTop - clientHeight < threshold) setShouldAutoScroll(true)
      // We can get these from the ref? listRef.current.outerRef?
      // listRef.current has no outerRef exposed publicly in types usually, but it might be there.
      // Let's skip complex auto-scroll logic for now and just auto-scroll on new messages if we assume they want it.
      // Or just always auto-scroll for now as per plan "Implement auto-scroll on new messages".
      setShouldAutoScroll(true); // Always auto-scroll for now to match plan simplicity
    }
  };

  // Close context menu on click outside
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent, userId: string, username: string, targetRole?: string) => {
    e.preventDefault(); // Always prevent default context menu
    console.log('[GlobalChat] Context menu triggered for:', username, 'by role:', userRole);

    // Only show for mods/admins
    if (userRole !== 'moderator' && userRole !== 'admin') {
      console.log('[GlobalChat] Access denied: User is not mod/admin');
      return;
    }

    // Prevent banning self
    if (userId === currentUser.id) {
      toast.error("You cannot ban yourself.");
      return;
    }

    // Role-based protection
    if (userRole === 'moderator') {
      if (targetRole === 'moderator' || targetRole === 'admin') {
        toast.error("You cannot ban other moderators or admins.");
        return;
      }
    }

    if (userRole === 'admin') {
      if (targetRole === 'admin') {
        toast.error("You cannot ban other admins.");
        return;
      }
    }

    setContextMenu({ x: e.clientX, y: e.clientY, userId, username });
  }, [currentUser.id, userRole]);

  const handleBanClick = () => {
    if (contextMenu) {
      onBanUser({ id: contextMenu.userId, username: contextMenu.username });
      setContextMenu(null);
    }
  };

  // Report Modal State
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [selectedUserToReport, setSelectedUserToReport] = useState<{ id: string; username: string; messageId: string; content: string } | null>(null);

  const { reportMessage } = useChat();

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
                  onScroll={handleScroll}
                  className="no-scrollbar"
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
          {contextMenu && (
            <div
              className="fixed z-[9999] bg-gray-900 border border-white/10 rounded-lg shadow-xl py-1 min-w-[160px] animate-in fade-in zoom-in duration-100"
              style={{ top: contextMenu.y, left: contextMenu.x }}
            >
              <div className="px-3 py-2 border-b border-white/5 mb-1">
                <span className="text-xs text-gray-500">Actions for @{contextMenu.username}</span>
              </div>
              <button
                onClick={handleBanClick}
                className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 flex items-center gap-2 transition-colors"
              >
                <AlertTriangle size={14} />
                Ban User
              </button>
            </div>
          )}

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
