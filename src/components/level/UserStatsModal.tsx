import { memo, useState } from 'react';
import { useSettingsStore } from '../../store/useSettingsStore';
import { getLevelName } from '../../data/levels';
import { X, Trophy, Target, Calendar, Flame, Clock, Zap } from 'lucide-react';

interface UserStatsModalProps {
  onClose: () => void;
}

export const UserStatsModal = memo(function UserStatsModal({ onClose }: UserStatsModalProps) {
  const {
    username,
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

  const levelName = getLevelName(level, levelPath);
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
    <div className="fixed top-4 left-[304px] z-50 pointer-events-none">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-gray-900/95 backdrop-blur-xl rounded-2xl border border-white/10 p-4 w-[300px] shadow-2xl pointer-events-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-400" />
              {username}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">{levelName}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Stats Grid - 2x4 Layout */}
        <div className="grid grid-cols-2 gap-2">
          {/* Row 1 */}
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
            icon={<span className="text-base">📊</span>}
            label="Avg Session"
            value={`${avgSessionLength}m`}
            color="text-indigo-400"
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
    </div>
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
