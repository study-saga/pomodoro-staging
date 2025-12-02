import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Shield } from 'lucide-react';

interface ChatContextMenuProps {
    contextMenu: {
        x: number;
        y: number;
        userId: string;
        username: string;
        messageId: string;
        content: string;
    } | null;
    onClose: () => void;
    onReport: () => void;
    onBan: () => void;
    userRole: string;
}

export function ChatContextMenu({ contextMenu, onClose, onReport, onBan, userRole }: ChatContextMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, [onClose]);

    if (!contextMenu) return null;

    // Viewport-aware positioning
    const MENU_WIDTH = 180;
    const MENU_HEIGHT = 100;
    const padding = 10;

    const style: React.CSSProperties = {};

    // Horizontal positioning
    if (contextMenu.x + MENU_WIDTH > window.innerWidth - padding) {
        style.right = window.innerWidth - contextMenu.x;
    } else {
        style.left = contextMenu.x;
    }

    // Vertical positioning
    if (contextMenu.y + MENU_HEIGHT > window.innerHeight - padding) {
        style.bottom = window.innerHeight - contextMenu.y;
    } else {
        style.top = contextMenu.y;
    }

    return createPortal(
        <div
            ref={menuRef}
            className="fixed z-[9999] bg-gray-900 border border-white/10 rounded-lg shadow-xl py-1 min-w-[160px] animate-in fade-in zoom-in duration-100"
            style={style}
            onClick={(e) => e.stopPropagation()}
        >
            <div className="px-3 py-2 border-b border-white/5 mb-1">
                <span className="text-xs text-gray-500">Actions for @{contextMenu.username}</span>
            </div>

            <button
                onClick={onReport}
                className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-white/5 hover:text-yellow-400 flex items-center gap-2 transition-colors"
            >
                <AlertTriangle size={14} />
                Report Message
            </button>

            {(userRole === 'moderator' || userRole === 'admin') && (
                <button
                    onClick={onBan}
                    className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 flex items-center gap-2 transition-colors"
                >
                    <Shield size={14} />
                    Ban User
                </button>
            )}
        </div>,
        document.body
    );
}
