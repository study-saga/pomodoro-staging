import { memo, useState } from 'react';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useDeviceType } from '../../hooks/useDeviceType';
import {
  getLevelName,
  getBadgeForLevel,
  ROLE_EMOJI_ELF,
  ROLE_EMOJI_HUMAN,
  getXPNeeded,
} from '../../data/levels';
import { Gift } from 'lucide-react';
import { UserStatsModal } from './UserStatsModal';

interface LevelDisplayProps {
  onOpenDailyGift?: () => void;
}

export const LevelDisplay = memo(function LevelDisplay({ onOpenDailyGift }: LevelDisplayProps) {
  const {
    level,
    xp,
    prestigeLevel,
    username,
    levelPath,
    levelSystemEnabled,
    addXP,
  } = useSettingsStore();

  const [selectedDay, setSelectedDay] = useState(1);
  const [showStatsModal, setShowStatsModal] = useState(false);

  const { isMobile } = useDeviceType();

  if (!levelSystemEnabled) return null;

  const xpNeeded = getXPNeeded(level);
  const levelName = getLevelName(level, levelPath);
  const badge = getBadgeForLevel(level, prestigeLevel);
  const roleEmoji = levelPath === 'elf' ? ROLE_EMOJI_ELF : ROLE_EMOJI_HUMAN;
  const progress = (xp / xpNeeded) * 100;

  // Simulate selected day (for testing)
  const simulateNextDay = () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    useSettingsStore.setState({
      lastLoginDate: yesterdayStr,
      consecutiveLoginDays: selectedDay, // Set to the selected day directly
      lastDailyGiftDate: null, // Reset to allow claiming gift
    });

    // Open the daily gift modal
    if (onOpenDailyGift) {
      onOpenDailyGift();
    }
  };

  return (
    <div className={`fixed top-4 left-4 bg-gray-900/95 backdrop-blur-xl rounded-2xl border border-white/10 ${isMobile ? 'p-2 min-w-[180px] max-w-[220px]' : 'p-4 min-w-[280px]'}`}>
      <div className={isMobile ? 'space-y-2' : 'space-y-3'}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2
              onClick={() => setShowStatsModal(true)}
              className={`font-bold text-white cursor-pointer hover:text-blue-400 transition-colors ${isMobile ? 'text-base' : 'text-lg'}`}
              title="Click to view stats"
            >
              {username}
            </h2>
            <p className={isMobile ? 'text-xs text-gray-300' : 'text-xs text-gray-300'}>{levelName}</p>
          </div>
          <div className={isMobile ? 'text-2xl' : 'text-3xl'}>{badge}</div>
        </div>

        {/* User Stats Modal - Conditional Rendering */}
        {showStatsModal && (
          isMobile ? (
            // Mobile: Full-screen centered modal (matches WhatsNew pattern)
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  setShowStatsModal(false);
                }
              }}
            >
              <div className="bg-gray-900/95 backdrop-blur-xl border border-white/10 rounded-2xl w-[calc(100vw-2rem)] max-w-[380px] max-h-[90vh] overflow-hidden">
                <UserStatsModal onClose={() => setShowStatsModal(false)} />
              </div>
            </div>
          ) : (
            // Desktop: Positioned underneath Level UI
            <div className="fixed top-[18rem] left-4 z-40">
              <div className="bg-gray-900/95 backdrop-blur-xl border border-white/10 rounded-2xl w-[300px]">
                <UserStatsModal onClose={() => setShowStatsModal(false)} />
              </div>
            </div>
          )
        )}

        {/* XP Progress Bar */}
        <div>
          <div className={`flex justify-between text-gray-300 ${isMobile ? 'text-xs mb-0.5' : 'text-xs mb-1'}`}>
            <span>{roleEmoji} Level {level}</span>
            <span>
              {xp} / {xpNeeded} XP
            </span>
          </div>
          <div className={`w-full bg-gray-700/50 rounded-full overflow-hidden ${isMobile ? 'h-1.5' : 'h-2'}`}>
            <div
              className="bg-gradient-to-r from-blue-500 to-purple-500 h-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Prestige Stars */}
        {prestigeLevel > 0 && (
          <div className="text-center pt-1">
            <span className={`text-yellow-400 ${isMobile ? 'text-xs' : 'text-sm'}`}>
              {"⭐".repeat(Math.min(prestigeLevel, 5))}
            </span>
          </div>
        )}


        {import.meta.env.DEV && (
          <div className="space-y-1">
            <button
              onClick={() => addXP(50)} // Adds 50 XP
              className="w-full px-2 py-1 bg-purple-600 text-white text-xs rounded hover:bg-purple-700 transition-colors"
            >
              Add 50 XP (Dev)
            </button>
            <div className="flex gap-1">
              <select
                value={selectedDay}
                onChange={(e) => setSelectedDay(Number(e.target.value))}
                className="px-2 py-1 bg-gray-700 text-white text-xs rounded border border-gray-600 focus:outline-none focus:border-pink-500"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((day) => (
                  <option key={day} value={day}>
                    Day {day}
                  </option>
                ))}
              </select>
              <button
                onClick={simulateNextDay}
                className="flex-1 px-2 py-1 bg-gradient-to-r from-pink-500 to-rose-500 text-white text-xs rounded hover:from-pink-600 hover:to-rose-600 transition-colors flex items-center justify-center gap-1"
              >
                <Gift className="w-3 h-3" />
                Daily Gift
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
});
