import { memo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useDeviceType } from '../../hooks/useDeviceType';
import { X, Target, Calendar, Flame, Clock, Zap, BarChart } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';
import { Avatar, AvatarImage, AvatarFallback } from '../ui/avatar';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverHeader,
  PopoverBody,
} from '../ui/popover';
import { getBadgeForLevel } from '../../data/levels';

interface UserStatsPopoverProps {
  trigger: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  avatarUrl?: string;
}

export const UserStatsPopover = memo(function UserStatsPopover({
  trigger,
  open,
  onOpenChange,
  avatarUrl,
}: UserStatsPopoverProps) {
  const {
    level,
    levelPath,
    prestigeLevel,
    username,
    totalPomodoros,
    totalStudyMinutes,
    totalUniqueDays,
    consecutiveLoginDays,
    pomodoroBoostActive,
    pomodoroBoostExpiresAt,
    firstLoginDate,
  } = useSettingsStore();

  const [showSinceTooltip, setShowSinceTooltip] = useState(false);
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

  const badge = getBadgeForLevel(level, prestigeLevel);
  const initials = username.slice(0, 2).toUpperCase();

  // Stats grid content (shared between mobile and desktop)
  const statsContent = (
    <div className="grid grid-cols-2 gap-2">
      <StatCard
        icon={<Target className="w-4 h-4" />}
        label="Level"
        value={`${level}${prestigeLevel > 0 ? ` ⭐${prestigeLevel}` : ''}`}
        color="text-blue-400"
      />
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
          className="relative bg-white/5 rounded-lg p-2 border border-white/10 cursor-help"
          onMouseEnter={() => setShowSinceTooltip(true)}
          onMouseLeave={() => setShowSinceTooltip(false)}
        >
          <div className="flex items-center gap-1.5 text-pink-400 mb-0.5">
            <Calendar className="w-4 h-4" />
            <span className="text-xs text-gray-400">Since</span>
          </div>
          <p className="text-base font-bold text-white">{formattedFirstLoginDate}</p>
          {showSinceTooltip && (
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-3 py-2 bg-gray-900/95 backdrop-blur-xl rounded-2xl border border-white/10 z-50 shadow-xl whitespace-nowrap">
              <p className="text-xs text-gray-200 text-center">
                I was there, Gandalf.<br />
                I was there {daysSinceFirstLogin} {daysSinceFirstLogin === 1 ? 'day' : 'days'} ago!
              </p>
            </div>
          )}
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
            className="bg-gray-900/95 backdrop-blur-xl border-white/10 w-[360px] p-0"
            align="start"
            side="bottom"
            sideOffset={8}
          >
            <PopoverHeader className="border-b border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    {avatarUrl && <AvatarImage src={avatarUrl} />}
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                  <div>
                    <h2 className="text-lg font-bold text-white">{username}</h2>
                    <p className="text-xs text-gray-300">
                      Level {level} {badge}
                      {prestigeLevel > 0 && <span className="ml-1 text-yellow-400">⭐{prestigeLevel}</span>}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => onOpenChange?.(false)}
                  className="p-1 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </PopoverHeader>
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
                  {/* Header */}
                  <div className="p-4 border-b border-gray-700">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-12 w-12">
                          {avatarUrl && <AvatarImage src={avatarUrl} />}
                          <AvatarFallback>{initials}</AvatarFallback>
                        </Avatar>
                        <div>
                          <h2 className="text-lg font-bold text-white">{username}</h2>
                          <p className="text-xs text-gray-300">
                            Level {level} {badge}
                            {prestigeLevel > 0 && <span className="ml-1 text-yellow-400">⭐{prestigeLevel}</span>}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => onOpenChange?.(false)}
                        className="p-1 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Body */}
                  <ScrollArea className="max-h-[60vh] sm:max-h-[400px]">
                    <div className="p-4">
                      {statsContent}
                    </div>
                  </ScrollArea>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </>
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
