import { getAvatarUrl } from '../../lib/chatService';
import type { OnlineUser } from '../../types/chat';

interface OnlineUsersListProps {
  users: OnlineUser[];
  currentUserId: string;
  onUserClick: (userId: string) => void;
}

/**
 * List of online users with presence indicators
 * Click to start DM conversation
 */
export function OnlineUsersList({
  users,
  currentUserId,
  onUserClick
}: OnlineUsersListProps) {
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
        {users.map((user) => {
          const isCurrentUser = user.id === currentUserId;
          const avatarUrl = getAvatarUrl(user);

          return (
            <button
              key={user.id}
              onClick={() => !isCurrentUser && onUserClick(user.id)}
              disabled={isCurrentUser}
              className={`
                w-full flex items-center gap-3 p-2 rounded-lg transition-colors text-left
                ${
                  isCurrentUser
                    ? 'bg-purple-500/10 cursor-default'
                    : 'hover:bg-white/5 cursor-pointer'
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
                {/* Online indicator (green dot) */}
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-gray-900" />
              </div>

              {/* Username */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {user.username}
                  {isCurrentUser && (
                    <span className="ml-2 text-xs text-gray-400">(You)</span>
                  )}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
