import { getAvatarUrl } from '../../lib/chatService';
import type { OnlineUser } from '../../types/chat';
import { Shield } from 'lucide-react';

interface OnlineUsersListProps {
  users: OnlineUser[];
  currentUserId: string;
}

/**
 * List of online users with presence indicators
 */
export function OnlineUsersList({
  users,
  currentUserId
}: OnlineUsersListProps) {
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
    <div className="flex-1 overflow-y-auto">
      <div className="p-3 space-y-1">
        {sortedUsers.map((user) => {
          const isCurrentUser = user.id === currentUserId;
          const avatarUrl = getAvatarUrl(user);

          return (
            <div
              key={user.id}
              className={`
                w-full flex items-center gap-3 p-2 rounded-lg transition-colors
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
  );
}
