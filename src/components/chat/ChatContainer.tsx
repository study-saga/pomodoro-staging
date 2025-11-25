import { useState } from 'react';
import { MessageCircle, Minimize2 } from 'lucide-react';
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
        className="fixed bottom-20 right-4 z-50 w-14 h-14 bg-gray-900/70 backdrop-blur-xl border border-white/20 hover:bg-gray-900/80 rounded-full shadow-2xl flex items-center justify-center transition-colors"
        title="Open chat"
      >
        <MessageCircle size={24} className="text-white/90" />
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
    <>
      {/* Collapsed: Floating chat button */}
      {!isExpanded && (
        <button
          onClick={() => setIsExpanded(true)}
          className="fixed bottom-4 left-4 z-50 w-14 h-14 bg-gray-900/70 backdrop-blur-xl border border-white/20 rounded-full shadow-2xl flex items-center justify-center hover:bg-gray-900/80 transition-colors"
          title="Open chat"
        >
          <MessageCircle size={24} className="text-white/90" />
        </button>
      )}

      {/* Expanded: Full chat interface */}
      {isExpanded && (
        <div className="fixed bottom-24 left-4 z-50 w-96 h-[500px] bg-gray-900/60 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
          {/* Header with minimize button */}
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/5 shrink-0">
            <h3 className="text-xs font-semibold text-white/80 uppercase tracking-wide">Chat</h3>
            <button
              onClick={() => {
                setIsExpanded(false);
                setSelectedConversation(null);
              }}
              className="p-1 hover:bg-white/5 rounded transition-colors"
              title="Minimize"
            >
              <Minimize2 size={14} className="text-gray-400" />
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
    </>
  );
}
