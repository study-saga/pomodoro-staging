import { memo, useState } from 'react';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useDeviceType } from '../../hooks/useDeviceType';
import { useAuth } from '../../contexts/AuthContext';
import {
  getLevelName,
  ROLE_EMOJI_ELF,
  ROLE_EMOJI_HUMAN,
  getXPNeeded,
} from '../../data/levels';
import { Gift } from 'lucide-react';
import buffElf from '../../assets/buff-elf.svg';
import buffHuman from '../../assets/buff-human.svg';
import buffElfSlingshot from '../../assets/buff-elf-slingshot.svg';
import buffBoost from '../../assets/buff-boost.svg';
import { UserStatsPopover } from './UserStatsPopover';
import { Avatar, AvatarImage, AvatarFallback } from '../ui/avatar';

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
    pomodoroBoostActive,
    pomodoroBoostExpiresAt,
  } = useSettingsStore();

  const [selectedDay, setSelectedDay] = useState(1);
  const [showStatsPopover, setShowStatsPopover] = useState(false);

  const { isMobile } = useDeviceType();
  const { appUser } = useAuth();

  if (!levelSystemEnabled) return null;

  const xpNeeded = getXPNeeded(level);
  const levelName = getLevelName(level, levelPath);
  const roleEmoji = levelPath === 'elf' ? ROLE_EMOJI_ELF : ROLE_EMOJI_HUMAN;
  const progress = (xp / xpNeeded) * 100;

  // Extract emoji and text from levelName
  const levelBadge = levelName.split(' ')[0]; // Get emoji (first part before space)
  const levelTitle = levelName.split(' ').slice(1).join(' '); // Get text (everything after first space)

  // Check if slingshot buff is active (Nov 22-23 onwards for elves)
  const isSlingshotActive = () => {
    if (levelPath !== 'elf') return false;
    const today = new Date();
    const activationDate = new Date('2025-11-22');
    return today >= activationDate;
  };

  const slingshotActive = isSlingshotActive();

  // Calculate boost time remaining
  const getBoostTimeRemaining = () => {
    if (!pomodoroBoostActive || !pomodoroBoostExpiresAt) return '';
    const timeLeft = pomodoroBoostExpiresAt - Date.now();
    if (timeLeft <= 0) return '';
    const hoursLeft = Math.floor(timeLeft / (1000 * 60 * 60));
    const minsLeft = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
    return `${hoursLeft}h ${minsLeft}m`;
  };

  const boostTimeRemaining = getBoostTimeRemaining();

  // Debug logging for boost state
  if (import.meta.env.DEV && pomodoroBoostActive) {
    console.log('[LevelDisplay] Boost state:', {
      active: pomodoroBoostActive,
      expiresAt: pomodoroBoostExpiresAt,
      now: Date.now(),
      isExpired: pomodoroBoostExpiresAt ? pomodoroBoostExpiresAt <= Date.now() : 'no expiry set',
      timeRemaining: boostTimeRemaining
    });
  }

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
    <UserStatsPopover
      open={showStatsPopover}
      onOpenChange={setShowStatsPopover}
      trigger={
        <div className={`fixed top-4 left-4 bg-gray-900/95 backdrop-blur-xl rounded-2xl border border-white/10 cursor-pointer hover:border-white/20 transition-colors ${isMobile ? 'p-2 min-w-[180px] max-w-[220px]' : 'p-4 min-w-[280px]'}`}>
          <div className={isMobile ? 'space-y-2' : 'space-y-3'}>
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={isMobile ? 'text-2xl' : 'text-3xl'}>{levelBadge}</div>
                <div>
                  <h2 className={`font-bold text-white truncate ${isMobile ? 'text-base' : 'text-lg'}`}>
                    {username}
                  </h2>
                  <p className="text-xs text-gray-300">{levelTitle}</p>
                </div>
              </div>
              <Avatar className={isMobile ? 'h-8 w-8' : 'h-10 w-10'}>
                {appUser?.avatar && <AvatarImage src={appUser.avatar} />}
                <AvatarFallback>{username.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
            </div>

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

        {/* Role Buff Icons - Ordered: Permanent first, then by expiration */}
        <div className="flex gap-2">
          {/* 1. Role Buff (Permanent - Always first) */}
          <div className="relative group">
            <div className="w-8 h-8 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-lg border border-purple-500/30 flex items-center justify-center cursor-help overflow-hidden">
              <img
                src={levelPath === 'elf' ? buffElf : buffHuman}
                alt={`${levelPath} buff`}
                className="w-full h-full object-cover"
                style={{ filter: 'drop-shadow(0 0 6px rgba(168, 85, 247, 0.5))' }}
              />
            </div>

            {/* Hover Tooltip */}
            <div className="absolute left-0 bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50">
              <div className="bg-gray-900/95 backdrop-blur-xl border border-purple-500/30 rounded-lg px-3 py-2 shadow-lg min-w-[180px]">
                <p className="text-xs font-semibold text-purple-300 mb-0.5">
                  {levelPath === 'elf' ? 'Elf Consistency' : 'Human Risk/Reward'}
                </p>
                <p className="text-[10px] text-gray-400">
                  {levelPath === 'elf' ? '+0.5 XP per minute' : '25% chance to double XP'}
                </p>
              </div>
            </div>
          </div>

          {/* 2. Slingshot Buff (Permanent when active - Elf only, Nov 22+) */}
          {levelPath === 'elf' && slingshotActive && (
            <div className="relative group">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center cursor-help overflow-hidden bg-gradient-to-r from-green-500/20 to-emerald-500/20 border-2 border-green-500">
                <img
                  src={buffElfSlingshot}
                  alt="Elven Slingshot"
                  className="w-full h-full object-cover"
                  style={{ filter: 'drop-shadow(0 0 6px rgba(34, 197, 94, 0.5))' }}
                />
              </div>

              {/* Hover Tooltip */}
              <div className="absolute left-0 bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50">
                <div className="bg-gray-900/95 backdrop-blur-xl rounded-lg px-3 py-2 shadow-lg min-w-[180px] border border-green-500/30">
                  <p className="text-xs font-semibold mb-0.5 text-green-300">
                    Elven Slingshot 🏹
                  </p>
                  <p className="text-[10px] text-gray-400">
                    Buff is now active!
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 3. 24h Boost Buff (Time-limited - Shows remaining time) */}
          {pomodoroBoostActive && pomodoroBoostExpiresAt && pomodoroBoostExpiresAt > Date.now() && (
            <div className="relative group">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center cursor-help overflow-hidden bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border-2 border-yellow-500 animate-pulse">
                <img
                  src={buffBoost}
                  alt="XP Boost"
                  className="w-full h-full object-cover"
                  style={{ filter: 'drop-shadow(0 0 6px rgba(234, 179, 8, 0.5))' }}
                />
              </div>

              {/* Hover Tooltip */}
              <div className="absolute left-0 bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50">
                <div className="bg-gray-900/95 backdrop-blur-xl rounded-lg px-3 py-2 shadow-lg min-w-[180px] border border-yellow-500/30">
                  <p className="text-xs font-semibold mb-0.5 text-yellow-300">
                    🍅 +25% XP Boost
                  </p>
                  <p className="text-[10px] text-gray-400">
                    Expires in {boostTimeRemaining || getBoostTimeRemaining()}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 4. Inactive Slingshot (Show at end when inactive) */}
          {levelPath === 'elf' && !slingshotActive && (
            <div className="relative group">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center cursor-help overflow-hidden bg-gradient-to-r from-gray-500/20 to-gray-600/20 border border-gray-500/30">
                <img
                  src={buffElfSlingshot}
                  alt="Elven Slingshot"
                  className="w-full h-full object-cover"
                  style={{ filter: 'grayscale(100%) opacity(50%)' }}
                />
              </div>

              {/* Hover Tooltip */}
              <div className="absolute left-0 bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50">
                <div className="bg-gray-900/95 backdrop-blur-xl rounded-lg px-3 py-2 shadow-lg min-w-[180px] border border-gray-500/30">
                  <p className="text-xs font-semibold mb-0.5 text-gray-400">
                    Elven Slingshot 🏹
                  </p>
                  <p className="text-[10px] text-gray-400">
                    Activates on Nov 22-23, 2025
                  </p>
                </div>
              </div>
            </div>
          )}
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
      }
    />
  );
});
