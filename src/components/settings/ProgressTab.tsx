import { motion } from 'framer-motion';
import { Clock, Calendar, Flame, BarChart, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { resetUserProgress } from '../../lib/userSyncAuth';
import { useAuth } from '../../contexts/AuthContext';

const ROLE_EMOJI_ELF = '🧝';
const ROLE_EMOJI_HUMAN = '⚔️';

interface ProgressTabProps {
  // Level system
  level: number;
  xp: number;
  prestigeLevel: number;
  levelPath: 'elf' | 'human';
  tempLevelSystemEnabled: boolean;
  setTempLevelSystemEnabled: (enabled: boolean) => void;
  handleRoleChange: (role: 'elf' | 'human') => void;

  // Stats
  totalPomodoros: number;
  totalStudyMinutes: number;
  totalUniqueDays: number;
  consecutiveLoginDays: number;
  firstLoginDate: string | null;

  // Boosts
  pomodoroBoostActive: boolean;
  pomodoroBoostExpiresAt: number | null;

  // Username
  usernameInput: string;
  setUsernameInput: (value: string) => void;
  usernameError: string | null;
  setUsernameError: (error: string | null) => void;
  usernameLoading: boolean;
  handleSaveUsername: () => Promise<void>;

  // Actions
  resetProgress: () => void;
}

export function ProgressTab(props: ProgressTabProps) {
  const {
    tempLevelSystemEnabled,
    setTempLevelSystemEnabled,
    levelPath,
    handleRoleChange,
    totalPomodoros,
    totalStudyMinutes,
    totalUniqueDays,
    consecutiveLoginDays,
    firstLoginDate,
    pomodoroBoostActive,
    pomodoroBoostExpiresAt,
    usernameInput,
    setUsernameInput,
    usernameError,
    setUsernameError,
    usernameLoading,
    handleSaveUsername,
    resetProgress,
  } = props;

  const { appUser } = useAuth();

  // Calculate study hours and minutes
  const studyHours = Math.floor(totalStudyMinutes / 60);
  const studyMins = totalStudyMinutes % 60;

  // Calculate avg session length
  const avgSessionLength = totalPomodoros > 0 ? Math.round(totalStudyMinutes / totalPomodoros) : 0;

  // Format first login date
  const formattedFirstLoginDate = firstLoginDate
    ? new Date(firstLoginDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'N/A';

  // Calculate boost time remaining
  let boostTimeRemaining: string | null = null;
  if (pomodoroBoostActive && pomodoroBoostExpiresAt) {
    const now = Date.now();
    const remaining = pomodoroBoostExpiresAt - now;
    if (remaining > 0) {
      const hours = Math.floor(remaining / (1000 * 60 * 60));
      const mins = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
      boostTimeRemaining = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
    }
  }

  return (
    <motion.div
      key="progress"
      role="tabpanel"
      id="progress-panel"
      aria-labelledby="progress-tab"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.2 }}
      className="space-y-8 w-full max-w-full"
    >
      {/* Level System Toggle */}
      <div className="w-full max-w-full">
        <h3 className="text-white font-bold text-lg mb-4">Level System</h3>
        <div className="flex items-center justify-between gap-4 mb-4">
          <label className="text-white flex-1 min-w-0 break-words">Enable leveling system</label>
          <input
            type="checkbox"
            checked={tempLevelSystemEnabled}
            onChange={(e) => setTempLevelSystemEnabled(e.target.checked)}
            className="w-5 h-5 rounded flex-shrink-0"
          />
        </div>
      </div>

      {/* Hero Stats */}
      <div className="w-full max-w-full">
        <h3 className="text-white font-bold text-lg mb-4">Hero Stats</h3>

        {/* Featured Role Card */}
        <label className="w-full max-w-full bg-gradient-to-r from-purple-900/40 to-purple-900/20 rounded-xl p-4 sm:p-6 border border-purple-500/30 mb-4 cursor-pointer block hover:border-purple-500/50 hover:from-purple-900/50 hover:to-purple-900/30 transition-all relative group">
          <input
            type="checkbox"
            className="opacity-0 w-0 h-0 peer"
            checked={levelPath === 'human'}
            onChange={(e) => handleRoleChange(e.target.checked ? 'human' : 'elf')}
          />
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6">
            <div className="flex items-center justify-center w-20 h-20 flex-shrink-0 bg-purple-500/10 rounded-2xl border border-purple-500/20 shadow-inner group-hover:scale-105 transition-transform duration-300">
              <span className="text-5xl filter drop-shadow-md">
                {levelPath === 'elf' ? ROLE_EMOJI_ELF : ROLE_EMOJI_HUMAN}
              </span>
            </div>
            <div className="flex flex-col items-center sm:items-start text-center sm:text-left">
              <p className="text-2xl font-bold text-white tracking-tight group-hover:text-purple-200 transition-colors">
                {levelPath === 'elf' ? 'Elf' : 'Human'}
              </p>
              <p className="text-sm text-purple-200/60 font-medium">
                {levelPath === 'elf' ? 'Consistency & Focus' : 'High Risk, High Reward'}
              </p>
            </div>
          </div>
          <div className="absolute top-3 right-3 text-[10px] text-white/20 uppercase tracking-widest font-bold group-hover:text-white/40 transition-colors">Tap to switch</div>
        </label>

        {/* Stats Grid - No external components, all inline */}
        <div className="grid grid-cols-2 gap-3 w-full max-w-full">
          {/* Pomodoros Card */}
          <div className="bg-white/5 backdrop-blur-sm rounded-lg p-4 border border-white/10 hover:border-white/20 transition-colors min-w-0">
            <div className="flex items-center gap-2 text-red-400 mb-2">
              <span className="text-base">🍅</span>
              <span className="text-xs text-gray-400 uppercase tracking-wide">Pomodoros</span>
            </div>
            <p className="text-lg font-bold text-white truncate">{totalPomodoros.toLocaleString()}</p>
          </div>

          {/* Study Time Card */}
          <div className="bg-white/5 backdrop-blur-sm rounded-lg p-4 border border-white/10 hover:border-white/20 transition-colors min-w-0">
            <div className="flex items-center gap-2 text-green-400 mb-2">
              <Clock className="w-5 h-5" />
              <span className="text-xs text-gray-400 uppercase tracking-wide">Study Time</span>
            </div>
            <p className="text-lg font-bold text-white truncate">
              {studyHours > 0 ? `${studyHours}h ${studyMins}m` : `${studyMins}m`}
            </p>
          </div>

          {/* Active Days Card */}
          <div className="bg-white/5 backdrop-blur-sm rounded-lg p-4 border border-white/10 hover:border-white/20 transition-colors min-w-0">
            <div className="flex items-center gap-2 text-cyan-400 mb-2">
              <Calendar className="w-5 h-5" />
              <span className="text-xs text-gray-400 uppercase tracking-wide">Active Days</span>
            </div>
            <p className="text-lg font-bold text-white truncate">{totalUniqueDays}</p>
          </div>

          {/* Login Streak Card */}
          <div className="bg-white/5 backdrop-blur-sm rounded-lg p-4 border border-white/10 hover:border-white/20 transition-colors min-w-0">
            <div className="flex items-center gap-2 text-orange-400 mb-2">
              <Flame className="w-5 h-5" />
              <span className="text-xs text-gray-400 uppercase tracking-wide">Login Streak</span>
            </div>
            <p className="text-lg font-bold text-white truncate">{consecutiveLoginDays} days</p>
          </div>

          {/* Avg Session Card */}
          <div className="bg-white/5 backdrop-blur-sm rounded-lg p-4 border border-white/10 hover:border-white/20 transition-colors min-w-0">
            <div className="flex items-center gap-2 text-purple-400 mb-2">
              <BarChart className="w-5 h-5" />
              <span className="text-xs text-gray-400 uppercase tracking-wide">Avg Session</span>
            </div>
            <p className="text-lg font-bold text-white truncate">{avgSessionLength}m</p>
          </div>

          {/* Since Card - Conditional */}
          {firstLoginDate && (
            <div className="bg-white/5 backdrop-blur-sm rounded-lg p-4 border border-white/10 hover:border-white/20 transition-colors min-w-0">
              <div className="flex items-center gap-2 text-pink-400 mb-2">
                <Calendar className="w-5 h-5" />
                <span className="text-xs text-gray-400 uppercase tracking-wide">Since</span>
              </div>
              <p className="text-lg font-bold text-white truncate">{formattedFirstLoginDate}</p>
            </div>
          )}

          {/* Boost Active Card - Conditional */}
          {pomodoroBoostActive && boostTimeRemaining && (
            <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-lg p-4 col-span-full min-w-0">
              <div className="flex items-center gap-2 text-purple-300 mb-1">
                <Zap className="w-5 h-5" />
                <span className="text-sm font-semibold">+25% XP Boost Active</span>
              </div>
              <p className="text-xs text-purple-400 truncate">
                Expires in {boostTimeRemaining}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Username Section */}
      <div className="w-full max-w-full">
        <h3 className="text-white font-bold text-lg mb-2">Username</h3>
        <p className="text-gray-400 text-sm mb-4">
          Change your display name. Free once per week, or costs 50 XP if changed earlier.
        </p>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={usernameInput}
            onChange={(e) => {
              setUsernameInput(e.target.value.slice(0, 20));
              setUsernameError(null);
            }}
            maxLength={20}
            disabled={usernameLoading}
            className="flex-1 min-w-0 bg-white/10 text-white px-4 py-2 rounded-lg border border-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
            placeholder="User"
          />
          <button
            onClick={handleSaveUsername}
            disabled={usernameLoading}
            className="px-6 py-2 bg-white text-black font-medium rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
          >
            {usernameLoading ? 'Saving...' : 'Update'}
          </button>
        </div>
        {usernameError && (
          <p className="text-red-400 text-sm mt-2">
            ⚠ {usernameError}
          </p>
        )}
      </div>

      {/* Reset Progress Section */}
      <div className="w-full max-w-full">
        <h3 className="text-white font-bold text-lg mb-2">Reset Progress</h3>
        <p className="text-gray-400 text-sm mb-4">
          This will reset all your progress including level, XP, prestige, and stats.
          This action cannot be undone.
        </p>
        <button
          onClick={() => {
            toast('Reset All Progress?', {
              description: 'This action cannot be undone. All your XP, levels, prestige, and stats will be lost permanently.',
              duration: 10000,
              action: {
                label: 'Reset Everything',
                onClick: async () => {
                  try {
                    // Reset server state if user is authenticated
                    if (appUser?.id && appUser?.discord_id) {
                      await resetUserProgress(appUser.id);
                    }

                    // Reset local state
                    resetProgress();

                    toast.success('All progress has been reset');
                  } catch (error) {
                    console.error('Failed to reset progress:', error);
                    toast.error('Failed to reset progress in database');
                  }
                }
              },
              cancel: {
                label: 'Cancel',
                onClick: () => { }
              }
            });
          }}
          className="px-4 py-3 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition-colors"
        >
          Reset All Progress
        </button>
      </div>
    </motion.div>
  );
}
