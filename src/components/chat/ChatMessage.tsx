import { memo } from 'react';
import { Trash2, Shield, MoreVertical, AlertTriangle } from 'lucide-react';
import { formatMessageTime, getAvatarUrl, hasMention } from '../../lib/chatService';
import type { AppUser } from '../../lib/types';
import type { ChatMessage as ChatMessageType } from '../../types/chat';

interface ChatMessageProps {
    message: ChatMessageType;
    currentUser: AppUser;
    showAvatar: boolean;
    onContextMenu: (e: React.MouseEvent, userId: string, username: string, role?: string, messageId?: string, content?: string) => void;
    onDelete: (messageId: string) => void;
    onReport?: (messageId: string, userId: string, username: string, content: string) => void;
    onToggleReaction?: (messageId: string) => void;
    userRole: string;
}

export const ChatMessage = memo(({
    message,
    currentUser,
    showAvatar,
    onContextMenu,
    onDelete,
    onReport,
    onToggleReaction,
    userRole
}: ChatMessageProps) => {
    const isMe = message.user.id === currentUser.id;
    const isMentioned = hasMention(message.content, currentUser.username);
    const isDeleted = message.deleted;
    const reactions = message.reactions || { hearts: 0, hearted_by: [] };
    const isHearted = reactions.hearted_by.includes(currentUser.id);

    return (
        <div
            className={`group flex items-start gap-2 px-2 py-1 rounded-lg transition-colors ${isMentioned && !isDeleted ? 'bg-yellow-500/10 hover:bg-yellow-500/20' : 'hover:bg-white/5'
                }`}
            onContextMenu={(e) => !isDeleted && onContextMenu(e, message.user.id, message.user.username, message.user.role, message.id, message.content)}
        >
            {/* Avatar */}
            <div className="w-8 flex-shrink-0 pt-0.5">
                {showAvatar ? (
                    <img
                        src={getAvatarUrl(message.user) || `https://cdn.discordapp.com/embed/avatars/${(message.user.username.charCodeAt(0) + message.user.username.length) % 5}.png`}
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
                        <span className={`text-base font-bold truncate ${isMe ? 'text-purple-400' : 'text-gray-200'
                            } ${isDeleted ? 'opacity-50' : ''}`}>
                            {message.user.username}
                        </span>
                        {!isDeleted && message.user.role === 'moderator' && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-sm font-medium bg-blue-500/20 text-blue-300">
                                <Shield size={10} className="mr-1" /> Mod
                            </span>
                        )}
                        {!isDeleted && message.user.role === 'admin' && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-sm font-medium bg-red-500/20 text-red-300">
                                <Shield size={10} className="mr-1" /> Admin
                            </span>
                        )}
                        <span className="text-[10px] text-gray-500">
                            {formatMessageTime(message.timestamp)}
                        </span>

                        {/* Heart Button with count - inline after timestamp */}
                        {!isDeleted && onToggleReaction && (
                            <div className={`flex items-center gap-0.5 ${isHearted ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onToggleReaction(message.id);
                                    }}
                                    className="p-0.5 transition-all duration-200 hover:scale-110"
                                    title={isHearted ? 'Remove heart' : 'Add heart'}
                                >
                                    <svg
                                        viewBox="0 0 16 16"
                                        className={`transition-all duration-200 ${
                                            isHearted
                                                ? 'fill-red-500'
                                                : 'fill-gray-500 hover:fill-gray-400'
                                        }`}
                                        height={12}
                                        width={12}
                                        xmlns="http://www.w3.org/2000/svg"
                                    >
                                        <path
                                            d="M8 1.314C12.438-3.248 23.534 4.735 8 15-7.534 4.736 3.562-3.248 8 1.314"
                                            fillRule="evenodd"
                                        />
                                    </svg>
                                </button>
                                {reactions.hearts > 0 && (
                                    <span className={`text-[10px] font-medium ${isHearted ? 'text-red-400' : 'text-gray-400'}`}>
                                        {reactions.hearts}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {isDeleted ? (
                    <p className="text-base text-gray-500 italic flex items-center gap-1.5">
                        <Trash2 size={12} />
                        Message deleted by moderator
                    </p>
                ) : (
                    <p className={`text-base leading-relaxed break-words ${isMentioned ? 'text-yellow-100' : 'text-gray-300'
                        }`}>
                        {message.content}
                    </p>
                )}
            </div>

            {/* Actions Button (Delete/Report) */}
            {!isDeleted && (
                <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    {/* Context Menu Button (For everyone on other users) */}
                    {!isMe && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onContextMenu(e, message.user.id, message.user.username, message.user.role, message.id, message.content);
                            }}
                            className="p-1 text-gray-500 hover:text-white transition-colors"
                            title="More Actions"
                        >
                            <MoreVertical size={14} />
                        </button>
                    )}

                    {/* Report Button (For everyone on other users) */}
                    {!isMe && onReport && (
                        <button
                            onClick={() => onReport(message.id, message.user.id, message.user.username, message.content)}
                            className="p-1 text-gray-500 hover:text-yellow-400 transition-colors"
                            title="Report Message"
                        >
                            <AlertTriangle size={14} />
                        </button>
                    )}

                    {/* Delete Button (Own messages or Mods/Admins) */}
                    {(isMe || userRole === 'moderator' || userRole === 'admin') && (
                        <button
                            onClick={() => onDelete(message.id)}
                            className="p-1 text-gray-500 hover:text-red-400 transition-colors"
                            title="Delete message"
                        >
                            <Trash2 size={14} />
                        </button>
                    )}
                </div>
            )}
        </div>
    );
});
