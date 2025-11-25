import type { ChatTab } from '../../types/chat';

interface ChatTabsProps {
  activeTab: ChatTab;
  onTabChange: (tab: ChatTab) => void;
  localCount?: number;
  dmCount?: number;
  onlineCount?: number;
}

/**
 * Tab navigation for chat (Local | DM | Online)
 * Shows message/user counts in each tab
 */
export function ChatTabs({
  activeTab,
  onTabChange,
  localCount = 0,
  dmCount = 0,
  onlineCount = 0
}: ChatTabsProps) {
  const tabs = [
    { id: 'local' as ChatTab, label: 'Global Chat', count: localCount },
    { id: 'dm' as ChatTab, label: 'DM', count: dmCount },
    { id: 'online' as ChatTab, label: 'Online', count: onlineCount }
  ];

  return (
    <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-white/5">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`
              px-2.5 py-1 rounded-lg text-xs font-medium transition-all
              ${
                isActive
                  ? 'bg-white/10 text-white'
                  : 'text-gray-400 hover:text-gray-300 hover:bg-white/5'
              }
            `}
          >
            {tab.label}
            <span className="ml-1 text-[10px] opacity-60">
              • {tab.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
