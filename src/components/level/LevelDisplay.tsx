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
import { getNextMilestone } from '../../data/milestones';
import { Gift } from 'lucide-react';

export const LevelDisplay = memo(function LevelDisplay() {
  const {
    level,
    xp,
    prestigeLevel,
    username,
    levelPath,
    levelSystemEnabled,
    addXP,
    totalUniqueDays,
    consecutiveLoginDays,
  } = useSettingsStore();

  const { isMobile } = useDeviceType();
  const [isExpanded, setIsExpanded] = useState(false);

  if (!levelSystemEnabled) return null;

  const xpNeeded = getXPNeeded(level);
  const levelName = getLevelName(level, levelPath);
  const badge = getBadgeForLevel(level, prestigeLevel);
  const roleEmoji = levelPath === 'elf' ? ROLE_EMOJI_ELF : ROLE_EMOJI_HUMAN;
  const progress = (xp / xpNeeded) * 100;
  const nextMilestone = getNextMilestone(totalUniqueDays);

  // Simulate next day (for testing)
  const simulateNextDay = () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    useSettingsStore.setState({
      lastLoginDate: yesterdayStr,
    });

    window.location.reload();
  };

  // Compact badge for medium screens (768-1024px)
  const CompactBadge = () => (
    <button
      onClick={() => setIsExpanded(!isExpanded)}
      className="fixed top-4 left-4 bg-black/60 backdrop-blur-md rounded-full border border-white/10 px-3 py-2 hover:bg-black/70 transition-all cursor-pointer z-50"
      aria-label="Toggle stats"
    >
      <div className="flex items-center gap-2">
        <span className="text-lg">{badge}</span>
        <div className="flex flex-col items-start min-w-[60px]">
          <span className="text-xs text-white font-medium">Lv {level}</span>
          <div className="w-full bg-gray-700/50 rounded-full h-1 overflow-hidden">
            <div
              className="bg-gradient-to-r from-blue-500 to-purple-500 h-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    </button>
  );

  // Full stats card
  const FullCard = () => (
    <div className={`fixed top-4 left-4 bg-black/40 backdrop-blur-md rounded-xl border border-white/10 ${isMobile ? 'p-3 min-w-[200px]' : 'p-4 min-w-[280px]'} transition-all z-50`}>
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">{username}</h2>
            <p className="text-xs text-gray-300">{levelName}</p>
          </div>
          <div className="text-3xl">{badge}</div>
        </div>

        {/* XP Progress Bar */}
        <div>
          <div className="flex justify-between text-xs text-gray-300 mb-1">
            <span>{roleEmoji} Level {level}</span>
            <span>
              {xp} / {xpNeeded} XP
            </span>
          </div>
          <div className="w-full bg-gray-700/50 rounded-full h-2 overflow-hidden">
            <div
              className="bg-gradient-to-r from-blue-500 to-purple-500 h-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Prestige Stars */}
        {prestigeLevel > 0 && (
          <div className="text-center pt-1">
            <span className="text-yellow-400 text-sm">
              {"⭐".repeat(Math.min(prestigeLevel, 5))}
            </span>
          </div>
        )}

        {/* Milestone Progress */}
        <div className="pt-2 border-t border-white/10">
          <div className="flex justify-between text-xs text-gray-300 mb-1">
            <span>📅 Active Days</span>
            <span>{totalUniqueDays} days</span>
          </div>
          {nextMilestone ? (
            <div className="text-xs text-gray-400">
              Next: {nextMilestone.title} at {nextMilestone.days} days
            </div>
          ) : (
            <div className="text-xs text-green-400">
              All milestones completed! 🎉
            </div>
          )}
        </div>

        {import.meta.env.DEV && (
          <div className="space-y-1">
            <button
              onClick={() => addXP(50)} // Adds 50 XP
              className="w-full px-2 py-1 bg-purple-600 text-white text-xs rounded hover:bg-purple-700 transition-colors"
            >
              Add 50 XP (Dev)
            </button>
            <button
              onClick={simulateNextDay}
              className="w-full px-2 py-1 bg-gradient-to-r from-pink-500 to-rose-500 text-white text-xs rounded hover:from-pink-600 hover:to-rose-600 transition-colors flex items-center justify-center gap-1"
            >
              <Gift className="w-3 h-3" />
              Daily Gift
            </button>
          </div>
        )}

        {/* Login Streak Display */}
        {consecutiveLoginDays > 0 && (
          <div className="pt-2 border-t border-white/10">
            <div className="flex justify-between text-xs text-gray-300">
              <span>🎁 Login Streak</span>
              <span>{consecutiveLoginDays} days</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Hidden on <768px, Compact badge on 768-1024px, Full card on 1024px+ */}
      <div className="hidden md:block lg:hidden">
        {isExpanded ? <FullCard /> : <CompactBadge />}
      </div>
      <div className="hidden lg:block">
        <FullCard />
      </div>
    </>
  );
});
