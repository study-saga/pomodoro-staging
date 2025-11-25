import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useChat } from '../../contexts/ChatContext';
import { formatMessageTime, getAvatarUrl, hasMention } from '../../lib/chatService';
import { Trash2, Shield, AlertTriangle } from 'lucide-react';
import type { AppUser } from '../../lib/types';
import { BanModal } from './BanModal';
import { toast } from 'sonner';

interface GlobalChatMessagesProps {
  currentUser: AppUser;
}

/**
 * Global chat messages list
 * Displays the list of messages and handles auto-scrolling
 */
export function GlobalChatMessages({ currentUser }: GlobalChatMessagesProps) {
  const { globalMessages, deleteGlobalMessage, userRole, banUser } = useChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Ban Modal State
  const [banModalOpen, setBanModalOpen] = useState(false);
  const [selectedUserToBan, setSelectedUserToBan] = useState<{ id: string; username: string } | null>(null);

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; userId: string; username: string } | null>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [globalMessages]);

  // Close context menu on click outside
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  const handleContextMenu = (e: React.MouseEvent, userId: string, username: string, targetRole?: string) => {
    e.preventDefault(); // Always prevent default context menu

    // Only show for mods/admins
    if (userRole !== 'moderator' && userRole !== 'admin') {
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
  };

  const handleBanClick = () => {
    if (contextMenu) {
      setSelectedUserToBan({ id: contextMenu.userId, username: contextMenu.username });
      setBanModalOpen(true);
      setContextMenu(null);
    }
  };

  const handleBanConfirm = async (duration: number | null, reason: string) => {
    if (selectedUserToBan) {
      await banUser(selectedUserToBan.id, duration, reason);
      setBanModalOpen(false);
      setSelectedUserToBan(null);
    }
  };

  return (
    <>
      <div className="flex flex-col h-full">
        {/* Connection Status */}
        {!useChat().isGlobalConnected && (
          <div className="px-4 py-2 bg-yellow-500/10 backdrop-blur text-yellow-200 text-xs text-center border-b border-yellow-500/20">
            Connecting to chat...
          </div>
        )}

        {/* Messages List */}
        <div className="flex-1 overflow-y-auto px-1.5 py-2 space-y-0.5 no-scrollbar">
          {globalMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 text-xs">
              <p>No messages yet. Say hi! 👋</p>
            </div>
          ) : (
            globalMessages.map((msg, index) => {
              const isMe = msg.user.id === currentUser.id;
              const showAvatar = index === 0 || globalMessages[index - 1].user.id !== msg.user.id || (msg.timestamp - globalMessages[index - 1].timestamp > 60000);
              const isMentioned = hasMention(msg.content, currentUser.username);

              const isDeleted = msg.deleted;

              return (
                <div
                  key={msg.id}
                  className={`group flex items-start gap-2 px-2 py-1 rounded-lg transition-colors ${isMentioned && !isDeleted ? 'bg-yellow-500/10 hover:bg-yellow-500/20' : 'hover:bg-white/5'
                    }`}
                  onContextMenu={(e) => !isDeleted && handleContextMenu(e, msg.user.id, msg.user.username, msg.user.role)}
                >
                  {/* Avatar */}
                  <div className="w-8 flex-shrink-0 pt-0.5">
                    {showAvatar ? (
                      <img
                        src={getAvatarUrl(msg.user) || `https://ui-avatars.com/api/?name=${msg.user.username}&background=random`}
                        alt={msg.user.username}
                        className={`w-8 h-8 rounded-full object-cover ${isDeleted ? 'opacity-50 grayscale' : ''}`}
                      />
                    ) : (
                      <div className="w-8" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {showAvatar && (
                      <div className="flex items-baseline gap-2">
                        <span className={`text-sm font-bold truncate ${isMe ? 'text-purple-400' : 'text-gray-200'
                          } ${isDeleted ? 'opacity-50' : ''}`}>
                          {msg.user.username}
                        </span>
                        {!isDeleted && msg.user.role === 'moderator' && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/20 text-blue-300">
                            <Shield size={10} className="mr-1" /> Mod
                          </span>
                        )}
                        {!isDeleted && msg.user.role === 'admin' && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-red-500/20 text-red-300">
                            <Shield size={10} className="mr-1" /> Admin
                          </span>
                        )}
                        <span className="text-[10px] text-gray-500">
                          {formatMessageTime(msg.timestamp)}
                        </span>
                      </div>
                    )}

                    {isDeleted ? (
                      <p className="text-sm text-gray-500 italic flex items-center gap-1.5">
                        <Trash2 size={12} />
                        Message deleted by moderator
                      </p>
                    ) : (
                      <p className={`text-sm leading-relaxed break-words ${isMentioned ? 'text-yellow-100' : 'text-gray-300'
                        }`}>
                        {msg.content}
                      </p>
                    )}
                  </div>

                  {/* Delete Button (Only for own messages or mods/admins) */}
                  {!isDeleted && (isMe || userRole === 'moderator' || userRole === 'admin') && (
                    <button
                      onClick={() => deleteGlobalMessage(msg.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-gray-500 hover:text-red-400 transition-all"
                      title="Delete message"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
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

          {/* Ban Modal */}
          <BanModal
            isOpen={banModalOpen}
            onClose={() => setBanModalOpen(false)}
            onBan={handleBanConfirm}
            username={selectedUserToBan?.username || ''}
          />
        </>,
        document.body
      )}
    </>
  );
}
