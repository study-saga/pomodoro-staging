import { useState, useEffect } from 'react';
import { MessageCircle, Minimize2, AlertTriangle } from 'lucide-react';
import { ChatTabs } from './ChatTabs';
import { GlobalChatMessages } from './GlobalChat';
import { MessageInput } from './MessageInput';
import { OnlineUsersList } from './OnlineUsersList';
import { useChat } from '../../contexts/ChatContext';
import { useAuth } from '../../contexts/AuthContext';
import { useRateLimit } from '../../hooks/useRateLimit';
import type { ChatTab } from '../../types/chat';

/**
 * Main chat container with collapsible functionality
 * Positioned bottom-left on desktop, floating button on mobile
 */
export function ChatContainer() {
  const { appUser } = useAuth();
  const { onlineUsers, setChatOpen, isChatEnabled, sendGlobalMessage, isGlobalConnected } = useChat();
  const { canSend, timeUntilReset, messagesRemaining, recordMessage } = useRateLimit();

  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<ChatTab>('local');


  // Calculate counts
  const chattingCount = onlineUsers.filter(u => u.isChatting).length;

  // Update chat presence when expanded state changes
  useEffect(() => {
    setChatOpen(isExpanded);
  }, [isExpanded, setChatOpen]);

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
        !e.metaKey
      ) {
        const activeTag = document.activeElement?.tagName.toLowerCase();
        if (activeTag !== 'input' && activeTag !== 'textarea' && activeTag !== 'select') {
          e.preventDefault();
          e.preventDefault();
          setIsExpanded(true);
          setActiveTab('local'); // Ensure we are on the chat tab to show input
          // Focus will be handled by autoFocus on input or effect
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isExpanded, appUser]);

  // Handle sending messages
  const handleSendMessage = (content: string) => {
    if (!canSend || !appUser) return;

    sendGlobalMessage(content, {
      id: appUser.id,
      username: appUser.username,
      avatar: appUser.avatar
    });

    recordMessage();
  };

  // Don't show chat if not authenticated
  if (!appUser) {
    return null;
  }

  // Mobile: Floating chat button
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  if (isMobile && !isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className={`fixed bottom-20 right-4 z-50 w-14 h-14 backdrop-blur-xl border rounded-full shadow-2xl flex items-center justify-center transition-colors ${isChatEnabled
          ? 'bg-gray-900/70 border-white/20 hover:bg-gray-900/80'
          : 'bg-red-900/70 border-red-500/30 hover:bg-red-900/80'
          }`}
        title={isChatEnabled ? "Open chat (Enter)" : "Chat disabled"}
      >
        {isChatEnabled ? (
          <MessageCircle size={24} className="text-white/90" />
        ) : (
          <AlertTriangle size={24} className="text-red-200" />
        )}
      </button>
    );
  }

  // Mobile: Full screen overlay
  if (isMobile && isExpanded) {
    return (
      <div className="fixed inset-0 z-50 bg-gray-900/95 backdrop-blur-xl flex flex-col">
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
          {!isChatEnabled && (
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
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="flex-1 overflow-hidden">
              {activeTab === 'local' && <GlobalChatMessages currentUser={appUser} />}
              {activeTab === 'online' && (
                <OnlineUsersList
                  users={onlineUsers}
                  currentUserId={appUser.id}
                />
              )}
            </div>

            {/* Input attached at bottom for mobile */}
            {activeTab === 'local' && (
              <MessageInput
                onSendMessage={handleSendMessage}
                placeholder="say something..."
                canSend={canSend}
                timeUntilReset={timeUntilReset}
                messagesRemaining={messagesRemaining}
                disabled={!isGlobalConnected || !isChatEnabled}
              />
            )}
          </div>
        </div>
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
          className={`fixed bottom-24 left-4 z-50 transition-all duration-300 ease-out hover:scale-110 active:scale-95 ${isChatEnabled
            ? 'text-white hover:text-white drop-shadow-2xl'
            : 'text-red-400 hover:text-red-300 drop-shadow-lg'
            }`}
          title={isChatEnabled ? "Open chat (Enter)" : "Chat disabled"}
        >
          {isChatEnabled ? (
            <MessageCircle size={32} fill="white" className="opacity-90 hover:opacity-100" />
          ) : (
            <AlertTriangle size={32} />
          )}
        </button>
      )}

      {/* Expanded: Full chat interface */}
      {isExpanded && (
        <div className="fixed bottom-24 left-4 z-50 w-96 flex flex-col gap-1.5">
          {/* Main Glass Box (Tabs + Content) */}
          <div className="h-[450px] bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col relative">
            {/* Minimize Button (Absolute top-right) */}
            <button
              onClick={() => setIsExpanded(false)}
              className="absolute top-2 right-2 p-1.5 hover:bg-white/10 rounded-lg transition-colors z-20 text-gray-400 hover:text-white"
              title="Minimize"
            >
              <Minimize2 size={16} />
            </button>

            {/* Maintenance Overlay */}
            {!isChatEnabled && (
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
              {activeTab === 'local' && <GlobalChatMessages currentUser={appUser} />}
              {activeTab === 'online' && (
                <OnlineUsersList
                  users={onlineUsers}
                  currentUserId={appUser.id}
                />
              )}
            </div>
          </div>

          {/* Detached Input (Only for local tab) */}
          {activeTab === 'local' && (
            <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl shadow-xl overflow-hidden">
              <MessageInput
                onSendMessage={handleSendMessage}
                placeholder="say something..."
                canSend={canSend}
                timeUntilReset={timeUntilReset}
                messagesRemaining={messagesRemaining}
                disabled={!isGlobalConnected || !isChatEnabled}
                autoFocus={true}
              />
            </div>
          )}
        </div>
      )}
    </>
  );
}
