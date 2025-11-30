import { memo } from 'react';
import { Trash2, Shield, MoreVertical } from 'lucide-react';
import { formatMessageTime, getAvatarUrl, hasMention } from '../../lib/chatService';
import type { AppUser } from '../../lib/types';
import type { ChatMessage as ChatMessageType } from '../../types/chat';

interface ChatMessageProps {
    message: ChatMessageType;
    currentUser: AppUser;
    showAvatar: boolean;
    onContextMenu: (e: React.MouseEvent, userId: string, username: string, role?: string) => void;
    onDelete: (messageId: string) => void;
    userRole: string;
}

export const ChatMessage = memo(({
    message,
    currentUser,
    showAvatar,
    onContextMenu,
    onDelete,
    userRole
}: ChatMessageProps) => {
    const isMe = message.user.id === currentUser.id;
    const isMentioned = hasMention(message.content, currentUser.username);
    const isDeleted = message.deleted;

    return (
        <div
            className={`group flex items-start gap-2 px-2 py-1 rounded-lg transition-colors ${isMentioned && !isDeleted ? 'bg-yellow-500/10 hover:bg-yellow-500/20' : 'hover:bg-white/5'
                }`}
            onContextMenu={(e) => !isDeleted && onContextMenu(e, message.user.id, message.user.username, message.user.role)}
        >
            {/* Avatar */}
            <div className="w-8 flex-shrink-0 pt-0.5">
                {showAvatar ? (
                    <img
                        src={getAvatarUrl(message.user) || `https://ui-avatars.com/api/?name=${message.user.username}&background=random`}
                        alt={message.user.username}
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
                            {message.user.username}
                        </span>
                        {!isDeleted && message.user.role === 'moderator' && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/20 text-blue-300">
                                <Shield size={10} className="mr-1" /> Mod
                            </span>
                        )}
                        {!isDeleted && message.user.role === 'admin' && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-red-500/20 text-red-300">
                                <Shield size={10} className="mr-1" /> Admin
                            </span>
                        )}
                        <span className="text-[10px] text-gray-500">
                            {formatMessageTime(message.timestamp)}
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
                        {message.content}
                    </p>
                )}
            </div>

            {/* Delete Button (Only for own messages or mods/admins) */}
            {!isDeleted && (isMe || userRole === 'moderator' || userRole === 'admin') && (
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {/* Context Menu Button (For Mods/Admins on other users) */}
                    {!isMe && (userRole === 'moderator' || userRole === 'admin') && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onContextMenu(e, message.user.id, message.user.username, message.user.role);
                            }}
                            className="p-1 text-gray-500 hover:text-white transition-colors"
                            title="User Actions"
                        >
                            <MoreVertical size={14} />
                        </button>
                    )}

                    {/* Delete Button */}
                    <button
                        onClick={() => onDelete(message.id)}
                        className="p-1 text-gray-500 hover:text-red-400 transition-colors"
                        title="Delete message"
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
            )}
        </div>
    );
});
