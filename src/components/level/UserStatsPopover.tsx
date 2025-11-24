import { memo, useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useDeviceType } from '../../hooks/useDeviceType';
import { X, Target, Calendar, Flame, Clock, Zap, BarChart } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverBody,
} from '../ui/popover';
import { calculateDaysSinceDate } from '../../lib/dateUtils';
import {
  ROLE_EMOJI_ELF,
  ROLE_EMOJI_HUMAN,
} from '../../data/levels';
import { createRateLimiter, rateLimitedToast } from '../../utils/rateLimiters';

interface UserStatsPopoverProps {
  trigger: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const UserStatsPopover = memo(function UserStatsPopover({
  trigger,
  open,
  onOpenChange,
}: UserStatsPopoverProps) {
  const {
    level,
    levelPath,
    setLevelPath,
    prestigeLevel,
    totalPomodoros,
    totalStudyMinutes,
    totalUniqueDays,
    consecutiveLoginDays,
    pomodoroBoostActive,
    pomodoroBoostExpiresAt,
    pomodoroBoostMultiplier,
    firstLoginDate,
  } = useSettingsStore();

  const [showSinceTooltip, setShowSinceTooltip] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const [roleChangeMessage, setRoleChangeMessage] = useState<string | null>(null);
  const sinceCardRef = useRef<HTMLDivElement>(null);
  const rateLimiterRef = useRef(createRateLimiter(720000)); // 12 minutes (5 changes per hour)
  const { isMobile } = useDeviceType();

  const avgSessionLength = totalPomodoros > 0
    ? Math.round(totalStudyMinutes / totalPomodoros)
    : 0;

  // Format study time
  const studyHours = Math.floor(totalStudyMinutes / 60);
  const studyMins = totalStudyMinutes % 60;

  // Calculate boost time remaining
  let boostTimeRemaining = '';
  if (pomodoroBoostActive && pomodoroBoostExpiresAt) {
    const timeLeft = pomodoroBoostExpiresAt - Date.now();
    if (timeLeft > 0) {
      const hoursLeft = Math.floor(timeLeft / (1000 * 60 * 60));
      const minsLeft = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
      boostTimeRemaining = `${hoursLeft}h ${minsLeft}m`;
    }
  }

  // Calculate days since first login using shared helper (keeps modal & popover in sync)
  const { daysSince: daysSinceFirstLogin, formattedDate: formattedFirstLoginDate } =
    calculateDaysSinceDate(firstLoginDate);

  // Calculate tooltip position when shown
  useEffect(() => {
    if (showSinceTooltip && sinceCardRef.current) {
      const rect = sinceCardRef.current.getBoundingClientRect();
      setTooltipPosition({
        top: rect.bottom + 8,
        left: rect.left + rect.width / 2,
      });
    }
  }, [showSinceTooltip]);

  // Reset tooltip state when popover closes to prevent stuck tooltips
  useEffect(() => {
    if (!open && showSinceTooltip) {
      setShowSinceTooltip(false);
    }
  }, [open, showSinceTooltip]);

  // Auto-dismiss role change message
  useEffect(() => {
    if (roleChangeMessage) {
      const timer = setTimeout(() => {
        setRoleChangeMessage(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [roleChangeMessage]);

  // Handle role change with funny messages (rate limited to 5 per hour)
  const handleRoleChange = (newRole: 'elf' | 'human') => {
    // Apply rate limiting (12 minutes between role changes)
    rateLimiterRef.current(() => {
      setLevelPath(newRole);

      const messages = {
        elf: [
          "You have chosen the path of the Elf! May nature guide your journey.",
          "The forest welcomes you, brave Elf. Your adventure begins anew!",
          "An Elf emerges! The ancient woods await your wisdom.",
          "You walk the Elven path. Grace and focus shall be your companions.",
          "Pointy ears, sharp focus.",
          "Leaves are better than swords.",
          "Immortality is a long study session.",
          "Tree hugger? No, tree scholar.",
          "Elven wisdom activated. Coffee optional.",
        ],
        human: [
          "You have chosen the path of the Human! May courage light your way.",
          "A warrior's path chosen! Your legend starts now, brave Human.",
          "The Human spirit awakens within you. Face your challenges head-on!",
          "You walk the Human path. Strength and determination guide you forward.",
          "Jack of all trades, master of none.",
          "Live fast, study hard.",
          "Round ears, rounder ambition.",
          "XP is just a number.",
          "Human selected. Results may vary.",
        ],
      };

      const randomMessage = messages[newRole][Math.floor(Math.random() * messages[newRole].length)];

      // Use rate-limited toast to prevent spam
      rateLimitedToast(randomMessage, setRoleChangeMessage);
    })();
  };

  // Stats grid content (shared between mobile and desktop)
  const statsContent = (
    <>
      {/* Path Selection - Hero Stats Style */}
      <label className="w-full bg-gradient-to-r from-purple-900/40 to-purple-900/20 rounded-xl p-3 sm:p-4 border border-purple-500/30 mb-4 cursor-pointer block hover:border-purple-500/50 hover:from-purple-900/50 hover:to-purple-900/30 transition-all relative group">
        <input
          type="checkbox"
          className="opacity-0 w-0 h-0 peer"
          checked={levelPath === 'human'}
          onChange={(e) => handleRoleChange(e.target.checked ? 'human' : 'elf')}
        />
        <div className="flex flex-row items-center justify-start gap-3 sm:gap-4">
          <span className="text-4xl sm:text-5xl filter drop-shadow-md group-hover:scale-110 transition-transform duration-300">
            {levelPath === 'elf' ? ROLE_EMOJI_ELF : ROLE_EMOJI_HUMAN}
          </span>
          <div className="flex flex-col items-start text-left">
            <p className="text-lg sm:text-xl font-bold text-white tracking-tight group-hover:text-purple-200 transition-colors">
              {levelPath === 'elf' ? 'Elf' : 'Human'}
            </p>
            <p className="text-[11px] sm:text-xs text-purple-200/60 font-medium">
              {levelPath === 'elf' ? 'Consistency & Focus' : 'High Risk, High Reward'}
            </p>
          </div>
        </div>
        <div className="absolute top-2 right-2 text-[8px] sm:text-[10px] text-white/20 uppercase tracking-widest font-bold group-hover:text-white/40 transition-colors">Tap to switch</div>
      </label>

      <div className="grid grid-cols-2 gap-2">
        <StatCard
          icon={<Target className="w-4 h-4" />}
          label="Level"
          value={`${level}${prestigeLevel > 0 ? ` ⭐${prestigeLevel}` : ''}`}
          color="text-blue-400"
        />
        <StatCard
          icon={<span className="text-base">🍅</span>}
          label="Pomodoros"
          value={totalPomodoros.toLocaleString()}
          color="text-red-400"
        />
        <StatCard
          icon={<Clock className="w-4 h-4" />}
          label="Study Time"
          value={studyHours > 0 ? `${studyHours}h ${studyMins}m` : `${studyMins}m`}
          color="text-green-400"
        />
        <StatCard
          icon={<Calendar className="w-4 h-4" />}
          label="Active Days"
          value={`${totalUniqueDays}`}
          color="text-cyan-400"
        />
        <StatCard
          icon={<Flame className="w-4 h-4" />}
          label="Login Streak"
          value={`${consecutiveLoginDays} days`}
          color="text-orange-400"
        />
        <StatCard
          icon={<BarChart className="w-4 h-4" />}
          label="Avg Session"
          value={`${avgSessionLength}m`}
          color="text-purple-400"
        />
        {firstLoginDate && (
          <div
            ref={sinceCardRef}
            className="relative bg-white/5 rounded-lg p-2 border border-white/10 cursor-help"
            onMouseEnter={() => setShowSinceTooltip(true)}
            onMouseLeave={() => setShowSinceTooltip(false)}
          >
            <div className="flex items-center gap-1.5 text-pink-400 mb-0.5">
              <Calendar className="w-4 h-4" />
              <span className="text-xs text-gray-400">Since</span>
            </div>
            <p className="text-base font-bold text-white">{formattedFirstLoginDate}</p>
          </div>
        )}
        {pomodoroBoostActive && boostTimeRemaining && (() => {
          const boostPercent = Math.round(((pomodoroBoostMultiplier || 1.25) - 1) * 100);
          return (
            <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-lg p-3 col-span-full">
              <div className="flex items-center gap-2 text-purple-300">
                <Zap className="w-4 h-4" />
                <span className="text-sm font-semibold">+{boostPercent}% XP Boost Active</span>
              </div>
              <p className="text-xs text-purple-400 mt-1">
                Expires in {boostTimeRemaining}
              </p>
            </div>
          );
        })()}
      </div>
    </>
  );

  return (
    <>
      {/* Desktop: Popover */}
      {!isMobile && (
        <Popover open={open} onOpenChange={onOpenChange}>
          <PopoverTrigger asChild>
            {trigger}
          </PopoverTrigger>

          {/* IMPORTANT: Negative sideOffset and zero collisionPadding are intentional for tight positioning.
              Watch for regressions: popover clipping at screen edges or unexpected repositioning. */}
          <PopoverContent
            className="bg-gray-900/95 backdrop-blur-xl border-white/10 rounded-2xl w-[360px] p-0"
            align="start"
            side="right"
            sideOffset={-20}
            alignOffset={0}
            collisionPadding={0}
          >
            <PopoverBody className="p-0">
              <div className="relative">
                <button
                  onClick={() => onOpenChange?.(false)}
                  className="absolute top-3 right-3 z-10 p-1 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
                <ScrollArea
                  className="max-h-[70vh] sm:max-h-[500px]"
                  onWheel={() => setShowSinceTooltip(false)}
                  onTouchMove={() => setShowSinceTooltip(false)}
                >
                  <div className="p-4 pt-12 pb-6">
                    {statsContent}
                  </div>
                </ScrollArea>
              </div>
            </PopoverBody>
          </PopoverContent>
        </Popover>
      )}

      {/* Mobile: Centered Modal */}
      {isMobile && (
        <>
          <div onClick={() => onOpenChange?.(!open)}>
            {trigger}
          </div>

          <AnimatePresence>
            {open && (
              <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
                {/* Backdrop */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                  onClick={() => onOpenChange?.(false)}
                />

                {/* Modal Content */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 20 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  className="relative bg-gray-900/95 backdrop-blur-xl border-white/10 border rounded-2xl w-full max-w-sm"
                >
                  <div className="relative">
                    <button
                      onClick={() => onOpenChange?.(false)}
                      className="absolute top-3 right-3 z-10 p-1 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <ScrollArea
                      className="max-h-[70vh] sm:max-h-[500px]"
                      onWheel={() => setShowSinceTooltip(false)}
                      onTouchMove={() => setShowSinceTooltip(false)}
                    >
                      <div className="p-4 pt-12 pb-6">
                        {statsContent}
                      </div>
                    </ScrollArea>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </>
      )}

      {/* Role Change Toast Notification */}
      <AnimatePresence>
        {roleChangeMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.3 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.2 } }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
            className="fixed bottom-4 left-4 right-4 sm:bottom-8 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 z-[100] sm:max-w-md sm:w-full"
          >
            <div className="relative bg-gradient-to-br from-purple-900/40 to-blue-900/40 backdrop-blur-xl border border-white/20 rounded-2xl p-4 sm:p-5 shadow-2xl overflow-hidden">
              {/* Glow effect */}
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-blue-500/20 opacity-50" />

              {/* Content */}
              <div className="relative flex items-start gap-3 sm:gap-4">
                <div className="flex-shrink-0 w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center bg-white/10 rounded-xl border border-white/20 backdrop-blur-sm">
                  <span className="text-2xl sm:text-3xl">{levelPath === 'elf' ? ROLE_EMOJI_ELF : ROLE_EMOJI_HUMAN}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                    <p className="text-xs sm:text-sm font-bold text-white/90 uppercase tracking-wider">Role Changed</p>
                  </div>
                  <p className="text-sm sm:text-base text-white leading-relaxed">{roleChangeMessage}</p>
                </div>
              </div>

              {/* Animated border */}
              <div className="absolute inset-0 rounded-2xl border-2 border-transparent bg-gradient-to-r from-purple-500 to-blue-500 opacity-50 blur-sm -z-10" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Gandalf Easter Egg Tooltip - Portal to body (escapes all clipping) */}
      {showSinceTooltip && firstLoginDate && createPortal(
        <div
          className="fixed transform -translate-x-1/2 px-3 py-2 bg-gray-900/95 backdrop-blur-xl rounded-2xl border border-white/10 z-[9999] shadow-xl whitespace-nowrap pointer-events-none"
          style={{
            top: `${tooltipPosition.top}px`,
            left: `${tooltipPosition.left}px`
          }}
        >
          <p className="text-xs text-gray-200 text-center">
            I was there, Gandalf.<br />
            I was there {daysSinceFirstLogin} {daysSinceFirstLogin === 1 ? 'day' : 'days'} ago!
          </p>
        </div>,
        document.body
      )}
    </>
  );
});

// Stat Card Component
interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}

function StatCard({ icon, label, value, color }: StatCardProps) {
  return (
    <div className="bg-white/5 rounded-lg p-2 border border-white/10 flex flex-col">
      <div className={`flex items-center gap-1.5 ${color} mb-1 h-5`}>
        {icon}
        <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-base font-bold text-white leading-tight text-left">{value}</p>
    </div>
  );
}
