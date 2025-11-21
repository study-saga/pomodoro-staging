import { memo, useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useDeviceType } from '../../hooks/useDeviceType';
import { X, Target, Calendar, Flame, Clock, Zap, BarChart } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';
import { ROLE_EMOJI_ELF, ROLE_EMOJI_HUMAN } from '../../data/levels';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverBody,
} from '../ui/popover';

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
    firstLoginDate,
  } = useSettingsStore();

  const [showSinceTooltip, setShowSinceTooltip] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const sinceCardRef = useRef<HTMLDivElement>(null);
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

  // Calculate days since first login
  let daysSinceFirstLogin = 0;
  let formattedFirstLoginDate = '';
  if (firstLoginDate) {
    const firstDate = new Date(firstLoginDate);
    const today = new Date();
    daysSinceFirstLogin = Math.floor((today.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
    formattedFirstLoginDate = firstDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

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

  // Stats grid content (shared between mobile and desktop)
  const statsContent = (
    <div className="relative">
      {/* Close Button - Positioned at top-right with gap */}
      <button
        onClick={() => onOpenChange?.(false)}
        className="absolute -top-3 -right-3 p-1.5 bg-gray-900 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-colors z-20"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="grid grid-cols-2 gap-2">
        {/* Role Toggle - Full Size */}
        <label className="bg-white/5 rounded-lg border border-white/10 cursor-pointer relative overflow-hidden flex items-center justify-center">
          <input
            type="checkbox"
            className="opacity-0 w-0 h-0 peer"
            checked={levelPath === 'human'}
            onChange={(e) => setLevelPath(e.target.checked ? 'human' : 'elf')}
          />
          <span className="absolute inset-0 bg-gradient-to-r from-purple-600 to-purple-700 rounded-lg transition-all duration-300 peer-checked:from-blue-600 peer-checked:to-blue-700"></span>
          <span className="relative text-4xl z-10 transition-transform duration-300">
            {levelPath === 'elf' ? ROLE_EMOJI_ELF : ROLE_EMOJI_HUMAN}
          </span>
        </label>
      <StatCard
        icon={<span className="text-base">{levelPath === 'elf' ? '🧝' : '⚔️'}</span>}
        label=""
        value={levelPath === 'elf' ? 'Elf' : 'Human'}
        color="text-purple-400"
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
      {pomodoroBoostActive && boostTimeRemaining && (
        <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-lg p-3 col-span-full">
          <div className="flex items-center gap-2 text-purple-300">
            <Zap className="w-4 h-4" />
            <span className="text-sm font-semibold">+25% XP Boost Active</span>
          </div>
          <p className="text-xs text-purple-400 mt-1">
            Expires in {boostTimeRemaining}
          </p>
        </div>
      )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop: Popover */}
      {!isMobile && (
        <Popover open={open} onOpenChange={onOpenChange}>
          <PopoverTrigger asChild>
            {trigger}
          </PopoverTrigger>
          <PopoverContent
            className="bg-gray-900/95 backdrop-blur-xl border-white/10 rounded-2xl w-[360px] p-0"
            align="start"
            side="bottom"
            sideOffset={8}
          >
            <PopoverBody className="p-0">
              <ScrollArea className="max-h-[60vh] sm:max-h-[400px]">
                <div className="p-4">
                  {statsContent}
                </div>
              </ScrollArea>
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
                  <ScrollArea className="max-h-[60vh] sm:max-h-[400px]">
                    <div className="p-4 pt-6">
                      {statsContent}
                    </div>
                  </ScrollArea>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </>
      )}

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
    <div className="bg-white/5 rounded-lg p-2 border border-white/10">
      <div className={`flex items-center gap-1.5 ${color} mb-0.5`}>
        {icon}
        <span className="text-xs text-gray-400">{label}</span>
      </div>
      <p className="text-base font-bold text-white">{value}</p>
    </div>
  );
}
