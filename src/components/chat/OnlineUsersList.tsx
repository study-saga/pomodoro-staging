import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { getAvatarUrl } from '../../lib/chatService';
import type { OnlineUser } from '../../types/chat';
import { Shield, AlertTriangle } from 'lucide-react';
import { useChat } from '../../contexts/ChatContext';
import { toast } from 'sonner';

interface OnlineUsersListProps {
  users: OnlineUser[];
  currentUserId: string;
  onBanUser?: (user: { id: string; username: string }) => void;
}

/**
 * Render a sorted list of online users with presence and role badges and a context menu for moderator/admin actions.
 *
 * Moderators and admins can open a context menu on a user to perform actions (e.g., ban); the component prevents self-ban and enforces role-based protections, and it will invoke `onBanUser` when a ban is confirmed.
 *
 * @param users - The list of users to display. Users are ordered with the current user first, then users who are actively chatting, then others; ties are resolved by username.
 * @param currentUserId - The id of the current user; used to highlight the current user and prevent self-actions.
 * @param onBanUser - Optional callback called with `{ id, username }` when a ban is performed via the context menu.
 * @returns The JSX element rendering the online users list.
 */
export function OnlineUsersList({
  users,
  currentUserId,
  onBanUser
}: OnlineUsersListProps) {
  const { userRole } = useChat();

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; userId: string; username: string } | null>(null);

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
    if (userId === currentUserId) {
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
    if (contextMenu && onBanUser) {
      onBanUser({ id: contextMenu.userId, username: contextMenu.username });
      setContextMenu(null);
    }
  };

  // Sort users: Current user first, then chatters, then lurkers
  const sortedUsers = [...users].sort((a, b) => {
    if (a.id === currentUserId) return -1;
    if (b.id === currentUserId) return 1;
    if (a.isChatting && !b.isChatting) return -1;
    if (!a.isChatting && b.isChatting) return 1;
    return a.username.localeCompare(b.username);
  });

  if (users.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400 text-sm p-4">
        <p>No one else online</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto">
        <div className="p-3 space-y-1">
          {sortedUsers.map((user) => {
            const isCurrentUser = user.id === currentUserId;
            const avatarUrl = getAvatarUrl(user);

            return (
              <div
                key={user.id}
                onContextMenu={(e) => handleContextMenu(e, user.id, user.username, user.role)}
                className={`
                  w-full flex items-center gap-3 p-2 rounded-lg transition-colors cursor-pointer
                  ${isCurrentUser
                    ? 'bg-purple-500/10'
                    : 'hover:bg-white/5'
                  }
                `}
              >
                {/* Avatar with online indicator */}
                <div className="relative flex-shrink-0">
                  <div className="w-10 h-10 rounded-full bg-gray-700 overflow-hidden">
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt={user.username}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white text-sm font-semibold">
                        {user.username.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  {/* Online indicator */}
                  <div
                    className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-gray-900 ${user.isChatting ? 'bg-green-500' : 'bg-gray-500'
                      }`}
                    title={user.isChatting ? 'In Chat' : 'Online'}
                  />
                </div>

                {/* Username */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-white truncate">
                      {user.username}
                    </p>
                    {user.role === 'moderator' && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-blue-500/20 text-blue-300">
                        <Shield size={8} className="mr-1" /> Mod
                      </span>
                    )}
                    {user.role === 'admin' && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-red-500/20 text-red-300">
                        <Shield size={8} className="mr-1" /> Admin
                      </span>
                    )}
                    {isCurrentUser && (
                      <span className="text-xs text-gray-400">(You)</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 truncate">
                    {user.isChatting ? 'In Chat' : 'Browsing'}
                  </p>
                </div>
              </div>
            );
          })}
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
        </>,
        document.body
      )}
    </>
  );
}