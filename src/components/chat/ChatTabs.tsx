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
    { id: 'local' as ChatTab, label: 'Local', count: localCount },
    { id: 'dm' as ChatTab, label: 'DM', count: dmCount },
    { id: 'online' as ChatTab, label: 'Online', count: onlineCount }
  ];

  return (
    <div className="flex items-center gap-1 px-3 py-2 border-b border-white/10 bg-gray-900/50">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`
              px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
              ${
                isActive
                  ? 'bg-white/10 text-white'
                  : 'text-gray-400 hover:text-gray-300 hover:bg-white/5'
              }
            `}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className="ml-1.5 text-xs opacity-75">
                • {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
