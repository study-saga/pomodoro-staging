
import { memo, useState } from 'react';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useDeviceType } from '../../hooks/useDeviceType';
import { X, Target, Calendar, Flame, Clock, Zap, BarChart } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';

interface UserStatsModalProps {
  onClose: () => void;
}

export const UserStatsModal = memo(function UserStatsModal({ onClose }: UserStatsModalProps) {
  const {
    level,
    levelPath,
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
  const { isMobile } = useDeviceType();
  const avgSessionLength = totalPomodoros > 0
    ? Math.round(totalStudyMinutes / totalPomodoros)
    : 0;

  // Format study time into hours and minutes
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
      <ScrollArea className="max-h-[60vh]">
        <div className="p-4 pb-2">
          <div className="grid gap-2 grid-cols-2">
            {/* Row 1 */}
            <StatCard
              icon={<Target className="w-4 h-4" />}
              label="Level"
              value={`${level}${prestigeLevel > 0 ? ` ⭐${prestigeLevel}` : ''}`}
              color="text-blue-400"
            />

            {/* Path Toggle */}
            <div className="bg-white/5 rounded-lg p-2 border border-white/10">
              <div className="flex items-center gap-1.5 text-purple-400 mb-1">
                <span className="text-xs text-gray-400">Path</span>
              </div>
              <div className="flex gap-1 bg-gray-800/50 rounded-lg p-0.5">
                <button
                  onClick={() => setLevelPath('human')}
                  className={`flex-1 py-1 px-2 rounded-md transition-all flex items-center justify-center gap-1 ${
                    levelPath === 'human'
                      ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <span className="text-sm">⚔️</span>
                  <span className="text-xs font-semibold">Human</span>
                </button>
                <button
                  onClick={() => setLevelPath('elf')}
                  className={`flex-1 py-1 px-2 rounded-md transition-all flex items-center justify-center gap-1 ${
                    levelPath === 'elf'
                      ? 'bg-gradient-to-r from-purple-600 to-purple-700 text-white shadow-lg'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <span className="text-sm">🧝</span>
                  <span className="text-xs font-semibold">Elf</span>
                </button>
              </div>
            </div>

            {/* Row 2 */}
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

                {/* Tooltip */}
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

            {/* Active Boost */}
            {pomodoroBoostActive && boostTimeRemaining && (
              <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-lg p-3">
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
      </ScrollArea>
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
