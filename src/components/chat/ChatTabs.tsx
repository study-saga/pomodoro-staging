import { MessageCircle, Users, Shield } from 'lucide-react';
import { useChat } from '../../contexts/ChatContext';
import type { ChatTab } from '../../types/chat';

interface ChatTabsProps {
  activeTab: ChatTab;
  onTabChange: (tab: ChatTab) => void;
  localCount: number;
  onlineCount: number;
}

export function ChatTabs({ activeTab, onTabChange, localCount, onlineCount }: ChatTabsProps) {
  const { userRole } = useChat();
  const isMod = userRole === 'moderator' || userRole === 'admin';

  return (
    <div className="flex items-center p-1.5 pr-10 gap-1 bg-black/20 border-b border-white/5">
      <button
        onClick={() => onTabChange('local')}
        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-medium transition-all ${activeTab === 'local'
          ? 'bg-white/10 text-white shadow-lg'
          : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
      >
        <MessageCircle size={14} />
        General
        <span className="bg-white/10 px-1.5 py-0.5 rounded-full text-[10px]">
          {localCount}
        </span>
      </button>

      <button
        onClick={() => onTabChange('online')}
        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-medium transition-all ${activeTab === 'online'
          ? 'bg-white/10 text-white shadow-lg'
          : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
      >
        <Users size={14} />
        Online
        <span className="bg-white/10 px-1.5 py-0.5 rounded-full text-[10px]">
          {onlineCount}
        </span>
      </button>

      {isMod && (
        <button
          onClick={() => onTabChange('banned')}
          className={`flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all ${activeTab === 'banned'
            ? 'bg-red-500/20 text-red-200 shadow-lg border border-red-500/20'
            : 'text-gray-400 hover:text-red-200 hover:bg-red-500/10'
            }`}
          title="Banned Users"
        >
          <Shield size={14} />
        </button>
      )}
    </div>
  );
}
