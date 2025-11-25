import { useState } from 'react';
import { MessageCircle, Maximize2, Minimize2 } from 'lucide-react';
import { ChatTabs } from './ChatTabs';
import { GlobalChat } from './GlobalChat';
import { OnlineUsersList } from './OnlineUsersList';
import { ConversationsList } from './ConversationsList';
import { ConversationView } from './ConversationView';
import { usePresence } from '../../hooks/usePresence';
import { useAuth } from '../../contexts/AuthContext';
import type { ChatTab } from '../../types/chat';

/**
 * Main chat container with collapsible functionality
 * Positioned bottom-left on desktop, floating button on mobile
 */
export function ChatContainer() {
  const { appUser } = useAuth();
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<ChatTab>('local');
  const [selectedConversation, setSelectedConversation] = useState<{
    userId: string;
    username: string;
  } | null>(null);

  const { onlineUsers } = usePresence(appUser);

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
        className="fixed bottom-20 right-4 z-50 w-14 h-14 bg-purple-600 hover:bg-purple-700 rounded-full shadow-lg flex items-center justify-center transition-colors"
        title="Open chat"
      >
        <MessageCircle size={24} className="text-white" />
      </button>
    );
  }

  // Mobile: Full screen overlay
  if (isMobile && isExpanded) {
    return (
      <div className="fixed inset-0 z-50 bg-gray-900 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="text-lg font-bold text-white">Chat</h2>
          <button
            onClick={() => {
              setIsExpanded(false);
              setSelectedConversation(null);
            }}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <Minimize2 size={20} className="text-white" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col min-h-0">
          {selectedConversation ? (
            <ConversationView
              currentUser={appUser}
              recipientId={selectedConversation.userId}
              recipientUsername={selectedConversation.username}
              onBack={() => setSelectedConversation(null)}
            />
          ) : (
            <>
              <ChatTabs
                activeTab={activeTab}
                onTabChange={setActiveTab}
                localCount={0}
                dmCount={0}
                onlineCount={onlineUsers.length}
              />
              <div className="flex-1 overflow-hidden">
                {activeTab === 'local' && <GlobalChat currentUser={appUser} />}
                {activeTab === 'dm' && (
                  <ConversationsList
                    currentUserId={appUser.id}
                    onConversationClick={(userId, username) =>
                      setSelectedConversation({ userId, username })
                    }
                  />
                )}
                {activeTab === 'online' && (
                  <OnlineUsersList
                    users={onlineUsers}
                    currentUserId={appUser.id}
                    onUserClick={(userId) => {
                      const user = onlineUsers.find((u) => u.id === userId);
                      if (user) {
                        setSelectedConversation({ userId, username: user.username });
                        setActiveTab('dm');
                      }
                    }}
                  />
                )}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // Desktop: Collapsible bottom-left panel
  return (
    <div
      className={`
        fixed bottom-4 left-4 z-50
        bg-gray-900/90 backdrop-blur-xl border border-white/10 rounded-t-2xl
        shadow-2xl transition-all duration-300 overflow-hidden
        ${isExpanded ? 'w-[360px] h-[450px]' : 'w-[360px] h-[60px]'}
      `}
    >
      {/* Collapsed: Just input bar visible */}
      {!isExpanded && (
        <button
          onClick={() => setIsExpanded(true)}
          className="w-full h-full flex items-center gap-3 px-4 hover:bg-white/5 transition-colors"
        >
          <MessageCircle size={20} className="text-gray-400" />
          <span className="flex-1 text-left text-sm text-gray-400">
            say something...
          </span>
          <Maximize2 size={16} className="text-gray-500" />
        </button>
      )}

      {/* Expanded: Full chat interface */}
      {isExpanded && (
        <div className="h-full flex flex-col">
          {/* Header with minimize button */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 bg-gray-900/50 shrink-0">
            <h3 className="text-sm font-bold text-white">Chat</h3>
            <button
              onClick={() => {
                setIsExpanded(false);
                setSelectedConversation(null);
              }}
              className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
              title="Minimize"
            >
              <Minimize2 size={16} className="text-gray-400" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 flex flex-col min-h-0">
            {selectedConversation ? (
              <ConversationView
                currentUser={appUser}
                recipientId={selectedConversation.userId}
                recipientUsername={selectedConversation.username}
                onBack={() => setSelectedConversation(null)}
              />
            ) : (
              <>
                <ChatTabs
                  activeTab={activeTab}
                  onTabChange={setActiveTab}
                  localCount={0}
                  dmCount={0}
                  onlineCount={onlineUsers.length}
                />
                <div className="flex-1 overflow-hidden">
                  {activeTab === 'local' && <GlobalChat currentUser={appUser} />}
                  {activeTab === 'dm' && (
                    <ConversationsList
                      currentUserId={appUser.id}
                      onConversationClick={(userId, username) =>
                        setSelectedConversation({ userId, username })
                      }
                    />
                  )}
                  {activeTab === 'online' && (
                    <OnlineUsersList
                      users={onlineUsers}
                      currentUserId={appUser.id}
                      onUserClick={(userId) => {
                        const user = onlineUsers.find((u) => u.id === userId);
                        if (user) {
                          setSelectedConversation({ userId, username: user.username });
                          setActiveTab('dm');
                        }
                      }}
                    />
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
