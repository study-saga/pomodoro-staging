
import { memo, useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useSettingsStore } from '../../store/useSettingsStore';
import { X, Target, Calendar, Flame, Clock, Zap, BarChart } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';
import { calculateDaysSinceDate } from '../../lib/dateUtils';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ROLE_EMOJI_ELF,
  ROLE_EMOJI_HUMAN,
} from '../../data/levels';
import { createRateLimiter, rateLimitedToast } from '../../utils/rateLimiters';
import { getPrestigeIcons } from '../../lib/prestigeUtils';

interface UserStatsModalProps {
  onClose: () => void;
}

export const UserStatsModal = memo(function UserStatsModal({ onClose }: UserStatsModalProps) {
  const {
    level,
    levelPath,
    setLevelPath,
    prestigeStars,
    totalPomodoros,
    totalStudyMinutes,
    totalUniqueDays,
    consecutiveLoginDays,
    pomodoroBoostActive,
    pomodoroBoostExpiresAt,
    pomodoroBoostMultiplier,
    firstLoginDate,
  } = useSettingsStore();

  const [roleChangeMessage, setRoleChangeMessage] = useState<string | null>(null);
  const rateLimiterRef = useRef(createRateLimiter(720000)); // 12 minutes (5 changes per hour)
  // Average session length: total minutes divided by pomodoro count
  const avgSessionLength = totalPomodoros > 0
    ? Math.round(totalStudyMinutes / totalPomodoros)
    : 0;

  // Format study time into hours and minutes
  const studyHours = Math.floor(totalStudyMinutes / 60);
  const studyMins = totalStudyMinutes % 60;

  // Calculate boost time remaining (verified correct: pomodoroBoostExpiresAt is timestamp)
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

  return (
    <>
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">
            User Info
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Stats Grid with ScrollArea */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-4 pb-2">
          {/* Path Selection - Hero Stats Style */}
          <label className="w-full bg-gradient-to-r from-purple-900/40 to-purple-900/20 rounded-xl p-3 border border-purple-500/30 mb-3 cursor-pointer block hover:border-purple-500/50 hover:from-purple-900/50 hover:to-purple-900/30 transition-all relative group">
            <input
              type="checkbox"
              className="opacity-0 w-0 h-0 peer"
              checked={levelPath === 'human'}
              onChange={(e) => handleRoleChange(e.target.checked ? 'human' : 'elf')}
            />
            <div className="flex flex-row items-center justify-start gap-3">
              <span className="text-4xl filter drop-shadow-md group-hover:scale-110 transition-transform duration-300">
                {levelPath === 'elf' ? '🧝' : '⚔️'}
              </span>
              <div className="flex flex-col items-start text-left">
                <p className="text-lg font-bold text-white tracking-tight group-hover:text-purple-200 transition-colors">
                  {levelPath === 'elf' ? 'Elf' : 'Human'}
                </p>
                <p className="text-[11px] text-purple-200/60 font-medium">
                  {levelPath === 'elf' ? 'Consistency & Focus' : 'High Risk, High Reward'}
                </p>
              </div>
            </div>
            <div className="absolute top-2 right-2 text-[8px] text-white/20 uppercase tracking-widest font-bold group-hover:text-white/40 transition-colors">Tap to switch</div>
          </label>

          <div className="grid gap-2 grid-cols-2">
            {/* Row 1 */}
            <StatCard
              icon={<Target className="w-4 h-4" />}
              label="Level"
              value={level.toString()}
              color="text-blue-400"
              extra={prestigeStars && prestigeStars.length > 0 ? (
                <div className="flex gap-0.5 items-center justify-center mt-1">
                  {getPrestigeIcons(prestigeStars).map((icon, idx) =>
                    icon.type === 'svg' ? (
                      <img key={idx} src={icon.value} alt="star" className="w-4 h-4" />
                    ) : (
                      <span key={idx} className="text-xs">{icon.value}</span>
                    )
                  )}
                </div>
              ) : undefined}
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

            {/* Row 3 */}
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

            {/* Row 4 */}
            <StatCard
              icon={<BarChart className="w-4 h-4" />}
              label="Avg Session"
              value={`${avgSessionLength}m`}
              color="text-purple-400"
            />

            {/* Since Date */}
            {firstLoginDate && (
              <SinceDateTooltip
                formattedDate={formattedFirstLoginDate}
                daysSince={daysSinceFirstLogin}
              />
            )}

            {/* Active Boost */}
            {pomodoroBoostActive && boostTimeRemaining && (() => {
              const boostPercent = Math.round(((pomodoroBoostMultiplier || 1.25) - 1) * 100);
              return (
                <div className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-orange-500/10 border border-orange-400/30">
                  <Zap className="w-4 h-4 text-orange-400" />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-orange-300">
                      +{boostPercent}% XP Boost Active
                    </span>
                    <span className="text-xs text-orange-400/70">
                      {boostTimeRemaining} remaining
                    </span>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </ScrollArea>

      {/* Role Change Toast Notification */}
      <AnimatePresence>
        {roleChangeMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.3 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.2 } }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
            className="fixed bottom-4 right-4 sm:bottom-8 sm:right-8 z-[100] max-w-md w-[calc(100%-2rem)] sm:w-96"
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
    </>
  );
});

// Stat Card Component
interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
  extra?: React.ReactNode;
}

function StatCard({ icon, label, value, color, extra }: StatCardProps) {
  return (
    <div className="bg-white/5 rounded-lg p-2 border border-white/10 flex flex-col">
      <div className={`flex items-center gap-1.5 ${color} mb-1 h-5`}>
        {icon}
        <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-base font-bold text-white leading-tight">{value}</p>
      {extra}
    </div>
  );
}



function SinceDateTooltip({ formattedDate, daysSince }: { formattedDate: string, daysSince: number }) {
  const [show, setShow] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (show && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 8,
        left: rect.left + rect.width / 2
      });
    }
  }, [show]);

  return (
    <>
      <div
        ref={triggerRef}
        role="button"
        tabIndex={0}
        aria-expanded={show}
        aria-haspopup="dialog"
        className="relative bg-white/5 rounded-lg p-2 border border-white/10 cursor-help focus:outline-none focus:ring-2 focus:ring-pink-400/50"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={() => setShow(!show)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setShow(!show);
          } else if (e.key === 'Escape') {
            setShow(false);
          }
        }}
      >
        <div className="flex items-center gap-1.5 text-pink-400 mb-0.5">
          <Calendar className="w-4 h-4" />
          <span className="text-xs text-gray-400">Since</span>
        </div>
        <p className="text-base font-bold text-white">{formattedDate}</p>
      </div>

      {show && createPortal(
        <div
          className="fixed transform -translate-x-1/2 z-[100] px-3 py-2 bg-gray-900/95 backdrop-blur-xl rounded-2xl border border-white/10 shadow-xl whitespace-nowrap pointer-events-none"
          style={{ top: position.top, left: position.left }}
        >
          <p className="text-xs text-gray-200 text-center">
            I was there, Gandalf.<br />
            I was there {daysSince} {daysSince === 1 ? 'day' : 'days'} ago!
          </p>
        </div>,
        document.body
      )}
    </>
  );
}
