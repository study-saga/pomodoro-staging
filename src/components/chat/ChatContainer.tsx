import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { MessageCircle, Minimize2, AlertTriangle, Lock, Clock } from 'lucide-react';
import { ChatTabs } from './ChatTabs';
import { GlobalChatMessages } from './GlobalChat';
import { MessageInput } from './MessageInput';
import { OnlineUsersList } from './OnlineUsersList';
import { BannedUsersList } from './BannedUsersList';
import { useChat } from '../../contexts/ChatContext';
import { useAuth } from '../../contexts/AuthContext';
import { useRateLimit } from '../../hooks/useRateLimit';
import type { ChatTab } from '../../types/chat';
import { BanModal } from './BanModal';
import { useDeviceType } from '../../hooks/useDeviceType';

/**
 * Main chat container with collapsible functionality
 * Positioned bottom-left on desktop, floating button on mobile
 */
export function ChatContainer() {
  const { appUser } = useAuth();
  const { onlineUsers, setChatOpen, isChatEnabled, sendGlobalMessage, isGlobalConnected, isBanned, banReason, banExpiresAt, banUser } = useChat();
  const { canSend, timeUntilReset, recordMessage } = useRateLimit();
  const { isMobile } = useDeviceType();

  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<ChatTab>('local');
  const [timeLeft, setTimeLeft] = useState<string>('');

  // Ban Modal State
  const [banModalOpen, setBanModalOpen] = useState(false);
  const [selectedUserToBan, setSelectedUserToBan] = useState<{ id: string; username: string } | null>(null);

  // Calculate counts
  const chattingCount = onlineUsers.filter(u => u.isChatting).length;

  // Update chat presence when expanded state changes
  useEffect(() => {
    setChatOpen(isExpanded);
  }, [isExpanded, setChatOpen]);

  // Ban Countdown Timer
  useEffect(() => {
    if (!isBanned || !banExpiresAt) return;

    const interval = setInterval(() => {
      const now = new Date();
      const end = new Date(banExpiresAt);

      if (now >= end) {
        setTimeLeft('Ban expiring...');
        clearInterval(interval);
      } else {
        const diff = end.getTime() - now.getTime();

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        const parts = [];
        if (days > 0) parts.push(`${days}d`);
        if (hours > 0) parts.push(`${hours}h`);
        parts.push(`${minutes}m`);
        parts.push(`${seconds}s`);

        setTimeLeft(parts.join(' '));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isBanned, banExpiresAt]);

  // Global Enter key listener to open chat
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only trigger if chat is closed, user is authenticated, and not typing in an input
      if (
        !isExpanded &&
        appUser &&
        e.key === 'Enter' &&
        !e.shiftKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !e.metaKey &&
        !isBanned // Don't open if banned
      ) {
        const activeElement = document.activeElement;
        const isInteractive = activeElement?.matches(
          'input, textarea, select, [contenteditable="true"], button, a, [role="button"], [role="link"]'
        );

        if (!isInteractive) {
          e.preventDefault();
          setIsExpanded(true);
          setActiveTab('local'); // Ensure we are on the chat tab to show input
          // Focus will be handled by autoFocus on input or effect
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isExpanded, appUser, isBanned]);

  // Handle sending messages
  const handleSendMessage = (content: string) => {
    if (!canSend || !appUser) return;

    sendGlobalMessage(content, {
      id: appUser.id,
      username: appUser.username,
      avatar: appUser.avatar,
      discord_id: appUser.discord_id
    });

    recordMessage();
  };

  const handleOpenBanModal = (user: { id: string; username: string }) => {
    setSelectedUserToBan(user);
    setBanModalOpen(true);
  };

  const handleBanConfirm = async (duration: number | null, reason: string) => {
    if (selectedUserToBan) {
      await banUser(selectedUserToBan.id, duration, reason);
      setBanModalOpen(false);
      setSelectedUserToBan(null);
    }
  };

  // Don't show chat if not authenticated
  if (!appUser) {
    return null;
  }

  // Mobile: Floating chat button
  // Mobile: Floating chat button
  // isMobile is already destructured at the top level

  if (isMobile && !isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className={`fixed bottom-20 right-4 z-50 transition-all duration-300 ease-out hover:scale-110 active:scale-95 ${isChatEnabled && !isBanned
          ? 'text-white hover:text-white drop-shadow-2xl'
          : 'text-red-400 hover:text-red-300 drop-shadow-lg'
          }`}
        title={isBanned ? "You are banned" : isChatEnabled ? "Open chat (Enter)" : "Chat disabled"}
      >
        <div className="flex flex-col items-center gap-1">
          {isBanned ? (
            <Lock size={32} />
          ) : isChatEnabled ? (
            <MessageCircle size={32} className="opacity-90 hover:opacity-100" strokeWidth={2.5} />
          ) : (
            <AlertTriangle size={32} />
          )}
          {isChatEnabled && !isBanned && (
            <span className="bg-gradient-to-r from-purple-500 to-pink-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-lg">
              BETA
            </span>
          )}
        </div>
      </button>
    );
  }

  // Mobile: Full screen overlay
  if (isMobile && isExpanded) {
    return (
      <div className="fixed inset-0 h-[100dvh] z-[70] bg-gray-900/95 backdrop-blur-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="text-lg font-bold text-white">Chat</h2>
          <button
            onClick={() => setIsExpanded(false)}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <Minimize2 size={20} className="text-white" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col min-h-0 relative">
          {/* Ban Overlay */}
          {isBanned && (
            <div className="absolute inset-0 z-20 bg-gray-900/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center">
              <div className="p-4 bg-red-500/10 rounded-full mb-4 animate-pulse">
                <Lock size={48} className="text-red-500" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">Account Banned</h3>
              <p className="text-red-200 font-medium mb-6 max-w-xs">{banReason}</p>

              {banExpiresAt ? (
                <div className="flex flex-col items-center gap-2 text-gray-400">
                  <span className="text-xs uppercase tracking-widest">Unban In</span>
                  <div className="flex items-center gap-2 text-xl font-mono text-white">
                    <Clock size={20} className="text-red-400" />
                    {timeLeft}
                  </div>
                </div>
              ) : (
                <div className="px-4 py-2 bg-red-500/20 rounded-lg text-red-200 text-sm font-bold">
                  PERMANENT BAN
                </div>
              )}
            </div>
          )}

          {!isChatEnabled && !isBanned && (
            <div className="absolute inset-0 z-10 bg-gray-900/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
              <AlertTriangle size={48} className="text-red-500 mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">Chat Disabled</h3>
              <p className="text-gray-300">
                Chat is currently disabled for maintenance. Please check back later.
              </p>
            </div>
          )}

          <ChatTabs
            activeTab={activeTab}
            onTabChange={setActiveTab}
            localCount={chattingCount}
            onlineCount={onlineUsers.length}
          />
          <div className="flex-1 overflow-hidden flex flex-col pb-[60px]">
            <div className="flex-1 overflow-hidden">
              {activeTab === 'local' && (
                <GlobalChatMessages
                  currentUser={appUser}
                  onBanUser={handleOpenBanModal}
                />
              )}
              {activeTab === 'online' && (
                <OnlineUsersList
                  users={onlineUsers}
                  currentUserId={appUser.id}
                  onBanUser={handleOpenBanModal}
                />
              )}
              {activeTab === 'banned' && <BannedUsersList />}
            </div>

            {/* Input attached at bottom for mobile */}
            {activeTab === 'local' && (
              <div className="fixed bottom-0 left-0 right-0 bg-black/60 backdrop-blur-xl border-t border-white/10 pb-[env(safe-area-inset-bottom,0)]">
                <MessageInput
                  onSendMessage={handleSendMessage}
                  placeholder="Message..."
                  canSend={canSend}
                  timeUntilReset={timeUntilReset}
                  disabled={!isGlobalConnected || !isChatEnabled || isBanned}
                  className="p-3"
                />
              </div>
            )}
          </div>
        </div>

        {/* Ban Modal */}
        {createPortal(
          <BanModal
            isOpen={banModalOpen}
            onClose={() => setBanModalOpen(false)}
            onBan={handleBanConfirm}
            username={selectedUserToBan?.username || ''}
          />,
          document.body
        )}
      </div>
    );
  }

  // Desktop: Collapsible bottom-left panel

  return (
    <>
      {/* Collapsed: Floating chat button */}
      {!isExpanded && (
        <button
          onClick={() => setIsExpanded(true)}
          className={`fixed bottom-24 left-4 z-40 transition-all duration-300 ease-out hover:scale-110 active:scale-95 ${isChatEnabled && !isBanned
            ? 'text-white hover:text-white drop-shadow-2xl'
            : 'text-red-400 hover:text-red-300 drop-shadow-lg'
            }`}
          title={isBanned ? "You are banned" : isChatEnabled ? "Open chat (Enter)" : "Chat disabled"}
        >
          <div className="flex flex-col items-center gap-1">
            {isBanned ? (
              <Lock size={32} />
            ) : isChatEnabled ? (
              <MessageCircle size={32} className="opacity-90 hover:opacity-100" strokeWidth={2.5} />
            ) : (
              <AlertTriangle size={32} />
            )}
            {isChatEnabled && !isBanned && (
              <span className="bg-gradient-to-r from-purple-500 to-pink-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-lg">
                BETA
              </span>
            )}
          </div>
        </button>
      )}

      {/* Expanded: Full chat interface */}
      {isExpanded && (
        <div className={`fixed bottom-20 left-4 z-40 flex flex-col gap-1.5 w-[320px] max-w-[calc(100vw-2rem)] transition-all duration-300`}>
          {/* Main Glass Box (Tabs + Content) */}
          <div className={`h-[450px] max-h-[55vh] min-h-[300px] bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col relative transition-all duration-300`}>
            {/* Minimize Button (Absolute top-right) */}
            <button
              onClick={() => setIsExpanded(false)}
              className="absolute top-2 right-2 p-1.5 hover:bg-white/10 rounded-lg transition-colors z-20 text-gray-400 hover:text-white"
              title="Minimize"
            >
              <Minimize2 size={16} />
            </button>

            {/* Ban Overlay */}
            {isBanned && (
              <div className="absolute inset-0 z-30 bg-gray-900/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center">
                <div className="p-4 bg-red-500/10 rounded-full mb-4 animate-pulse">
                  <Lock size={48} className="text-red-500" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">Account Banned</h3>
                <p className="text-red-200 font-medium mb-6 max-w-xs">{banReason}</p>

                {banExpiresAt ? (
                  <div className="flex flex-col items-center gap-2 text-gray-400">
                    <span className="text-xs uppercase tracking-widest">Unban In</span>
                    <div className="flex items-center gap-2 text-xl font-mono text-white">
                      <Clock size={20} className="text-red-400" />
                      {timeLeft}
                    </div>
                  </div>
                ) : (
                  <div className="px-4 py-2 bg-red-500/20 rounded-lg text-red-200 text-sm font-bold">
                    PERMANENT BAN
                  </div>
                )}
              </div>
            )}

            {/* Maintenance Overlay */}
            {!isChatEnabled && !isBanned && (
              <div className="absolute inset-0 z-10 bg-gray-900/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
                <AlertTriangle size={48} className="text-red-500 mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">Chat Disabled</h3>
                <p className="text-gray-300">
                  Chat is currently disabled for maintenance. Please check back later.
                </p>
              </div>
            )}

            <ChatTabs
              activeTab={activeTab}
              onTabChange={setActiveTab}
              localCount={chattingCount}
              onlineCount={onlineUsers.length}
            />

            <div className="flex-1 overflow-hidden">
              {activeTab === 'local' && (
                <GlobalChatMessages
                  currentUser={appUser}
                  onBanUser={handleOpenBanModal}
                />
              )}
              {activeTab === 'online' && (
                <OnlineUsersList
                  users={onlineUsers}
                  currentUserId={appUser.id}
                  onBanUser={handleOpenBanModal}
                />
              )}
              {activeTab === 'banned' && <BannedUsersList />}
            </div>
          </div>

          {/* Detached Input (Only for local tab) */}
          {activeTab === 'local' && !isBanned && (
            <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl shadow-xl overflow-hidden">
              <MessageInput
                onSendMessage={handleSendMessage}
                placeholder="say something..."
                canSend={canSend}
                timeUntilReset={timeUntilReset}
                disabled={!isGlobalConnected || !isChatEnabled}
                autoFocus={true}
              />
            </div>
          )}
        </div>
      )}

      {/* Ban Modal */}
      {createPortal(
        <BanModal
          isOpen={banModalOpen}
          onClose={() => setBanModalOpen(false)}
          onBan={handleBanConfirm}
          username={selectedUserToBan?.username || ''}
        />,
        document.body
      )}
    </>
  );
}
