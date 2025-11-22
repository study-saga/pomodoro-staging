import { memo, useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [activeBuffTooltip, setActiveBuffTooltip] = useState<string | null>(null);
  const prevLevelRef = useRef(level);

  const { isMobile } = useDeviceType();
  const { appUser } = useAuth();

  if (!levelSystemEnabled) return null;

  const xpNeeded = getXPNeeded(level);
  const levelName = getLevelName(level, levelPath);
  const roleEmoji = levelPath === 'elf' ? ROLE_EMOJI_ELF : ROLE_EMOJI_HUMAN;
  const progress = (xp / xpNeeded) * 100;

  // Generate confetti particles
  const confettiParticles = useMemo(() => {
    const colors = ['#FCD34D', '#F59E0B', '#A855F7', '#EC4899'];
    const sizes = [
      { w: 8, h: 4 },   // small
      { w: 12, h: 6 },  // medium
      { w: 16, h: 8 },  // large
    ];

    return Array.from({ length: 90 }, (_, i) => {
      const size = sizes[Math.floor(Math.random() * sizes.length)];
      return {
        id: i,
        x: Math.random() * 100,
        delay: Math.random() * 0.5,
        duration: 5,
        rotation: Math.random() * 720 - 360,
        rotateX: Math.random() * 720,
        color: colors[Math.floor(Math.random() * colors.length)],
        width: size.w,
        height: size.h,
        wobbleSpeed: 2 + Math.random() * 3,
        wobbleAmount: 20 + Math.random() * 40,
      };
    });
  }, []);

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

  // Detect level-up and trigger celebration
  useEffect(() => {
    if (level > prevLevelRef.current) {
      setShowLevelUp(true);
      setShowConfetti(true);

      // Hide confetti after 5s
      const confettiTimer = setTimeout(() => setShowConfetti(false), 5000);

      // Hide "LEVEL UP!" text after 3.5s (fade in 0.3s + stay 2.5s + fade out 0.5s)
      const textTimer = setTimeout(() => setShowLevelUp(false), 3300);

      prevLevelRef.current = level;

      return () => {
        clearTimeout(confettiTimer);
        clearTimeout(textTimer);
      };
    }
    prevLevelRef.current = level;
  }, [level]);

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

  // Handle buff icon click on mobile
  const handleBuffClick = (e: React.MouseEvent, buffId: string) => {
    if (isMobile) {
      e.stopPropagation();
      setActiveBuffTooltip(activeBuffTooltip === buffId ? null : buffId);
    }
  };

  return (
    <>
      {/* Level UI Container - Fixed position */}
      <div
        className={`fixed top-4 left-4 z-30 bg-gray-900/95 backdrop-blur-xl rounded-2xl border border-white/10 hover:border-white/20 transition-colors overflow-hidden ${isMobile ? 'p-3 min-w-[180px] max-w-[240px]' : 'p-4 min-w-[280px] max-w-[320px]'}`}
        onClick={() => isMobile && setActiveBuffTooltip(null)}
      >
        {/* Confetti - contained inside Level UI */}
        {showConfetti && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none z-50">
            {confettiParticles.map((particle) => (
              <motion.div
                key={particle.id}
                className="absolute"
                style={{
                  width: `${particle.width}px`,
                  height: `${particle.height}px`,
                  left: `${particle.x}%`,
                  top: '-8px',
                  backgroundColor: particle.color,
                  borderRadius: '2px',
                }}
                initial={{
                  y: 0,
                  x: 0,
                  opacity: 1,
                  rotateZ: 0,
                  rotateX: 0,
                  scale: 1,
                }}
                animate={{
                  y: isMobile ? 200 : 280,
                  x: [0, particle.wobbleAmount, -particle.wobbleAmount, 0],
                  opacity: [1, 1, 1, 1, 0],
                  rotateZ: particle.rotation * 3,
                  rotateX: [0, particle.rotateX * 2],
                  scale: [1, 0.9, 0.7],
                }}
                transition={{
                  duration: particle.duration,
                  delay: particle.delay,
                  ease: [0.4, 0.0, 0.6, 1],
                  x: {
                    duration: particle.duration,
                    ease: 'easeInOut',
                  },
                  opacity: {
                    duration: particle.duration,
                    times: [0, 0.2, 0.8, 0.9, 1],
                    ease: 'easeOut',
                  }
                }}
              />
            ))}
          </div>
        )}

        <div className={isMobile ? 'space-y-2.5' : 'space-y-3'}>
          {/* UserStatsPopover - Wraps only header + XP bar */}
          <UserStatsPopover
            open={showStatsPopover}
            onOpenChange={setShowStatsPopover}
            trigger={
              <div className="cursor-pointer space-y-2.5" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className={isMobile ? 'text-2xl' : 'text-3xl'}>{levelBadge}</div>
                    <div className="min-w-0 overflow-hidden flex-1">
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
                  <div className={`flex justify-between text-gray-300 ${isMobile ? 'text-xs mb-1' : 'text-xs mb-1'}`}>
                    <span>{roleEmoji} Level {level}</span>
                    <span>
                      {xp} / {xpNeeded} XP
                    </span>
                  </div>
                  <div className={`w-full bg-gray-700/50 rounded-full overflow-hidden ${isMobile ? 'h-2' : 'h-2'}`}>
                    <div
                      className="bg-gradient-to-r from-blue-500 to-purple-500 h-full rounded-full relative overflow-hidden"
                      style={{ width: `${progress}%` }}
                    >
                      {/* Soft Glow Wave - Sweeps left to right */}
                      <motion.div
                        className="absolute top-0 left-0 h-full w-[80px] pointer-events-none"
                        style={{
                          background: 'radial-gradient(ellipse at center, rgba(255,255,255,1) 0%, rgba(255,255,255,0.8) 25%, rgba(255,255,255,0.4) 50%, transparent 80%)',
                          filter: 'blur(3px) brightness(1.3)',
                        }}
                        animate={{
                          x: ['-100%', '250%'],
                          opacity: [0, 1, 1, 1, 0]
                        }}
                        transition={{
                          duration: 4,
                          repeat: Infinity,
                          ease: 'easeInOut',
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            }
          />

        {/* Role Buff Icons - Ordered: Permanent first, then by expiration */}
        <div className="flex gap-2">
          {/* 1. Role Buff (Permanent - Always first) */}
          <div className="relative group">
            <div
              className={`${isMobile ? 'w-7 h-7' : 'w-8 h-8'} bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-lg border border-purple-500/30 flex items-center justify-center cursor-help overflow-hidden`}
              onClick={(e) => handleBuffClick(e, 'role-buff')}
            >
              <img
                src={levelPath === 'elf' ? buffElf : buffHuman}
                alt={`${levelPath} buff`}
                className="w-full h-full object-cover"
                style={{ filter: 'drop-shadow(0 0 6px rgba(168, 85, 247, 0.5))' }}
              />
            </div>

            {/* Tooltip - Show on hover (desktop) or click (mobile) */}
            <div className={`absolute left-0 bottom-full mb-2 transition-opacity duration-200 pointer-events-none z-50 ${
              isMobile
                ? (activeBuffTooltip === 'role-buff' ? 'opacity-100' : 'opacity-0')
                : 'opacity-0 group-hover:opacity-100'
            }`}>
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
              <div
                className={`${isMobile ? 'w-7 h-7' : 'w-8 h-8'} rounded-lg flex items-center justify-center cursor-help overflow-hidden bg-gradient-to-r from-green-500/20 to-emerald-500/20 border-2 border-green-500`}
                onClick={(e) => handleBuffClick(e, 'slingshot-active')}
              >
                <img
                  src={buffElfSlingshot}
                  alt="Elven Slingshot"
                  className="w-full h-full object-cover"
                  style={{ filter: 'drop-shadow(0 0 6px rgba(34, 197, 94, 0.5))' }}
                />
              </div>

              {/* Tooltip - Show on hover (desktop) or click (mobile) */}
              <div className={`absolute left-0 bottom-full mb-2 transition-opacity duration-200 pointer-events-none z-50 ${
                isMobile
                  ? (activeBuffTooltip === 'slingshot-active' ? 'opacity-100' : 'opacity-0')
                  : 'opacity-0 group-hover:opacity-100'
              }`}>
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
              <div
                className={`${isMobile ? 'w-7 h-7' : 'w-8 h-8'} rounded-lg flex items-center justify-center cursor-help overflow-hidden bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border-2 border-yellow-500 animate-pulse`}
                onClick={(e) => handleBuffClick(e, 'boost')}
              >
                <img
                  src={buffBoost}
                  alt="XP Boost"
                  className="w-full h-full object-cover"
                  style={{ filter: 'drop-shadow(0 0 6px rgba(234, 179, 8, 0.5))' }}
                />
              </div>

              {/* Tooltip - Show on hover (desktop) or click (mobile) */}
              <div className={`absolute left-0 bottom-full mb-2 transition-opacity duration-200 pointer-events-none z-50 ${
                isMobile
                  ? (activeBuffTooltip === 'boost' ? 'opacity-100' : 'opacity-0')
                  : 'opacity-0 group-hover:opacity-100'
              }`}>
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
              <div
                className={`${isMobile ? 'w-7 h-7' : 'w-8 h-8'} rounded-lg flex items-center justify-center cursor-help overflow-hidden bg-gradient-to-r from-gray-500/20 to-gray-600/20 border border-gray-500/30`}
                onClick={(e) => handleBuffClick(e, 'slingshot-inactive')}
              >
                <img
                  src={buffElfSlingshot}
                  alt="Elven Slingshot"
                  className="w-full h-full object-cover"
                  style={{ filter: 'grayscale(100%) opacity(50%)' }}
                />
              </div>

              {/* Tooltip - Show on hover (desktop) or click (mobile) */}
              <div className={`absolute left-0 bottom-full mb-2 transition-opacity duration-200 pointer-events-none z-50 ${
                isMobile
                  ? (activeBuffTooltip === 'slingshot-inactive' ? 'opacity-100' : 'opacity-0')
                  : 'opacity-0 group-hover:opacity-100'
              }`}>
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

      {/* "LEVEL UP!" text - appears to the right of Level UI */}
      <AnimatePresence>
        {showLevelUp && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{
              duration: 0.3
            }}
            className={`fixed z-50 ${isMobile ? 'left-[200px] top-20' : 'left-[330px] top-24'} pointer-events-none`}
          >
            <div
              className="font-extrabold text-4xl"
              style={{
                color: '#FCD34D',
                textShadow: '0 0 10px #FCD34D, 0 0 20px #F59E0B, 0 0 30px #F59E0B, 0 0 40px #F59E0B',
                filter: 'drop-shadow(0 0 15px rgba(252, 211, 77, 0.9))'
              }}
            >
              LEVEL UP!
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
});
