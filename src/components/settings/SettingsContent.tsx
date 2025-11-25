import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { AMBIENT_SOUNDS } from '../../data/constants';
import { Badge } from '../ui/badge';
import { changelog, type ChangelogEntry } from '../../data/changelog';
import { ProgressTab } from './ProgressTab';


interface SettingsContentProps {
  activeTab: 'timer' | 'appearance' | 'sounds' | 'notifications' | 'music' | 'progress' | 'whats-new';
  isMobile: boolean;

  // Timer settings
  tempTimers: { pomodoro: number; shortBreak: number; longBreak: number };
  setTempTimers: React.Dispatch<React.SetStateAction<{ pomodoro: number; shortBreak: number; longBreak: number }>>;
  tempPomodorosBeforeLongBreak: number;
  setTempPomodorosBeforeLongBreak: React.Dispatch<React.SetStateAction<number>>;
  tempAutoStartBreaks: boolean;
  setTempAutoStartBreaks: React.Dispatch<React.SetStateAction<boolean>>;
  tempAutoStartPomodoros: boolean;
  setTempAutoStartPomodoros: React.Dispatch<React.SetStateAction<boolean>>;
  tempSoundEnabled: boolean;
  setTempSoundEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  tempVolume: number;
  setTempVolume: React.Dispatch<React.SetStateAction<number>>;
  tempLevelSystemEnabled: boolean;
  setTempLevelSystemEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  notificationPermission: NotificationPermission;

  // Appearance settings
  tempBackground: string;
  setTempBackground: React.Dispatch<React.SetStateAction<string>>;
  filteredBackgrounds: Array<{ id: string; name: string; poster: string; orientation: string }>;

  // Sound settings
  tempMusicVolume: number;
  setTempMusicVolume: React.Dispatch<React.SetStateAction<number>>;
  tempAmbientVolumes: Record<string, number>;
  setTempAmbientVolumes: React.Dispatch<React.SetStateAction<Record<string, number>>>;

  // Music settings
  totalTracks: number;
  setShowMusicCredits: React.Dispatch<React.SetStateAction<boolean>>;

  // Progress settings
  level: number;
  xp: number;
  prestigeLevel: number;
  totalPomodoros: number;
  totalStudyMinutes: number;
  levelPath: 'elf' | 'human';
  handleRoleChange: (newRole: 'elf' | 'human') => void;
  usernameInput: string;
  setUsernameInput: React.Dispatch<React.SetStateAction<string>>;
  usernameError: string | null;
  setUsernameError: React.Dispatch<React.SetStateAction<string | null>>;
  usernameLoading: boolean;
  handleSaveUsername: () => Promise<void>;
  resetProgress: () => void;

  // New props for stats
  totalUniqueDays: number;
  consecutiveLoginDays: number;
  pomodoroBoostActive: boolean;
  pomodoroBoostExpiresAt: number | null;
  firstLoginDate: string | null;
}

export function SettingsContent(props: SettingsContentProps) {
  const {
    activeTab,
    isMobile,
    tempTimers,
    setTempTimers,
    tempPomodorosBeforeLongBreak,
    setTempPomodorosBeforeLongBreak,
    tempAutoStartBreaks,
    setTempAutoStartBreaks,
    tempAutoStartPomodoros,
    setTempAutoStartPomodoros,
    tempSoundEnabled,
    setTempSoundEnabled,
    tempVolume,
    setTempVolume,
    tempLevelSystemEnabled,
    setTempLevelSystemEnabled,
    notificationPermission,
    tempBackground,
    setTempBackground,
    filteredBackgrounds,
    tempMusicVolume,
    setTempMusicVolume,
    tempAmbientVolumes,
    setTempAmbientVolumes,
    totalTracks,
    setShowMusicCredits,
    level,
    xp,
    prestigeLevel,
    totalPomodoros,
    totalStudyMinutes,
    levelPath,
    handleRoleChange,
    usernameInput,
    setUsernameInput,
    usernameError,
    setUsernameError,
    usernameLoading,
    handleSaveUsername,
    resetProgress,
    totalUniqueDays,
    consecutiveLoginDays,
    pomodoroBoostActive,
    pomodoroBoostExpiresAt,
    firstLoginDate,
  } = props;

  return (
    <AnimatePresence mode="wait">
      {activeTab === 'timer' && (
        <motion.div
          key="timer"
          role="tabpanel"
          id="timer-panel"
          aria-labelledby="timer-tab"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ duration: 0.2 }}
          className="space-y-4"
        >
          <div>
            <h3 className="text-white font-bold text-lg mb-4">Timer Durations (minutes)</h3>

            {/* Pomodoro */}
            <div className="flex items-center justify-between mb-4">
              <label className="text-white">Pomodoro</label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setTempTimers(t => ({ ...t, pomodoro: Math.max(1, t.pomodoro - 1) }))}
                  className="w-7 h-7 bg-white/10 hover:bg-white/20 rounded text-white text-sm"
                >
                  −
                </button>
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={tempTimers.pomodoro}
                  onChange={(e) => setTempTimers(t => ({ ...t, pomodoro: Number(e.target.value) }))}
                  className="w-16 bg-white/10 text-white text-center px-2 py-1 rounded border border-white/20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <button
                  onClick={() => setTempTimers(t => ({ ...t, pomodoro: Math.min(60, t.pomodoro + 1) }))}
                  className="w-7 h-7 bg-white/10 hover:bg-white/20 rounded text-white text-sm"
                >
                  +
                </button>
              </div>
            </div>

            {/* Short Break */}
            <div className="flex items-center justify-between mb-4">
              <label className="text-white">Short Break</label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setTempTimers(t => ({ ...t, shortBreak: Math.max(1, t.shortBreak - 1) }))}
                  className="w-7 h-7 bg-white/10 hover:bg-white/20 rounded text-white text-sm"
                >
                  −
                </button>
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={tempTimers.shortBreak}
                  onChange={(e) => setTempTimers(t => ({ ...t, shortBreak: Number(e.target.value) }))}
                  className="w-16 bg-white/10 text-white text-center px-2 py-1 rounded border border-white/20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <button
                  onClick={() => setTempTimers(t => ({ ...t, shortBreak: Math.min(60, t.shortBreak + 1) }))}
                  className="w-7 h-7 bg-white/10 hover:bg-white/20 rounded text-white text-sm"
                >
                  +
                </button>
              </div>
            </div>

            {/* Long Break */}
            <div className="flex items-center justify-between mb-4">
              <label className="text-white">Long Break</label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setTempTimers(t => ({ ...t, longBreak: Math.max(1, t.longBreak - 1) }))}
                  className="w-7 h-7 bg-white/10 hover:bg-white/20 rounded text-white text-sm"
                >
                  −
                </button>
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={tempTimers.longBreak}
                  onChange={(e) => setTempTimers(t => ({ ...t, longBreak: Number(e.target.value) }))}
                  className="w-16 bg-white/10 text-white text-center px-2 py-1 rounded border border-white/20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <button
                  onClick={() => setTempTimers(t => ({ ...t, longBreak: Math.min(60, t.longBreak + 1) }))}
                  className="w-7 h-7 bg-white/10 hover:bg-white/20 rounded text-white text-sm"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-white font-bold text-lg mb-4">Advanced Settings</h3>

            <div className="flex items-center justify-between mb-4">
              <label className="text-white">Pomodoros before long break</label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setTempPomodorosBeforeLongBreak(Math.max(1, tempPomodorosBeforeLongBreak - 1))}
                  className="w-7 h-7 bg-white/10 hover:bg-white/20 rounded text-white text-sm"
                >
                  −
                </button>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={tempPomodorosBeforeLongBreak}
                  onChange={(e) => setTempPomodorosBeforeLongBreak(Number(e.target.value))}
                  className="w-16 bg-white/10 text-white text-center px-2 py-1 rounded border border-white/20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <button
                  onClick={() => setTempPomodorosBeforeLongBreak(Math.min(10, tempPomodorosBeforeLongBreak + 1))}
                  className="w-7 h-7 bg-white/10 hover:bg-white/20 rounded text-white text-sm"
                >
                  +
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between mb-4">
              <label className="text-white">Auto-start breaks</label>
              <input
                type="checkbox"
                checked={tempAutoStartBreaks}
                onChange={(e) => setTempAutoStartBreaks(e.target.checked)}
                className="w-5 h-5 rounded"
              />
            </div>

            <div className="flex items-center justify-between mb-4">
              <label className="text-white">Auto-start pomodoros</label>
              <input
                type="checkbox"
                checked={tempAutoStartPomodoros}
                onChange={(e) => setTempAutoStartPomodoros(e.target.checked)}
                className="w-5 h-5 rounded"
              />
            </div>
          </div>
        </motion.div>
      )}

      {activeTab === 'appearance' && (
        <motion.div
          key="appearance"
          role="tabpanel"
          id="appearance-panel"
          aria-labelledby="appearance-tab"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ duration: 0.2 }}
          className="space-y-4"
        >
          <h3 className="text-white font-bold text-lg">Background</h3>
          <div className="grid grid-cols-3 gap-4">
            {filteredBackgrounds.map((bg) => (
              <button
                key={bg.id}
                onClick={() => setTempBackground(bg.id)}
                className={`relative rounded-lg overflow-hidden aspect-video border-2 transition-all ${tempBackground === bg.id
                  ? 'border-purple-500 shadow-lg shadow-purple-500/50'
                  : 'border-white/20 hover:border-white/40'
                  }`}
              >
                <img
                  src={bg.poster}
                  alt={bg.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <span className="text-white text-sm font-medium">{bg.name}</span>
                </div>
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {activeTab === 'sounds' && (
        <motion.div
          key="sounds"
          role="tabpanel"
          id="sounds-panel"
          aria-labelledby="sounds-tab"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ duration: 0.2 }}
          className="space-y-4"
        >
          <div>
            <h3 className="text-white font-bold text-lg mb-4">Sound Settings</h3>

            <div className="flex items-center justify-between mb-4">
              <label className="text-white">Enable sound notifications</label>
              <input
                type="checkbox"
                checked={tempSoundEnabled}
                onChange={(e) => setTempSoundEnabled(e.target.checked)}
                className="w-5 h-5 rounded"
              />
            </div>
          </div>

          <div>
            <h3 className="text-white font-bold text-lg mb-4">Volume Controls</h3>

            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-white text-sm">🔔 Bell Notification Volume</label>
                <span className="text-white text-sm">{tempVolume}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={tempVolume}
                onChange={(e) => setTempVolume(Number(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-full appearance-none cursor-pointer
                  [&::-webkit-slider-thumb]:appearance-none
                  [&::-webkit-slider-thumb]:w-4
                  [&::-webkit-slider-thumb]:h-4
                  [&::-webkit-slider-thumb]:rounded-full
                  [&::-webkit-slider-thumb]:bg-blue-500
                  [&::-webkit-slider-thumb]:cursor-pointer"
              />
            </div>

            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-white text-sm">🎵 Music Volume</label>
                <span className="text-white text-sm">{tempMusicVolume}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={tempMusicVolume}
                onChange={(e) => setTempMusicVolume(Number(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-full appearance-none cursor-pointer
                  [&::-webkit-slider-thumb]:appearance-none
                  [&::-webkit-slider-thumb]:w-4
                  [&::-webkit-slider-thumb]:h-4
                  [&::-webkit-slider-thumb]:rounded-full
                  [&::-webkit-slider-thumb]:bg-gray-500
                  [&::-webkit-slider-thumb]:cursor-pointer"
              />
            </div>
          </div>

          <div>
            <h3 className="text-white font-bold text-sm mb-3">🔊 Ambient Sounds</h3>
            <div className={`grid ${isMobile ? 'grid-cols-1' : 'grid-cols-2'} gap-4`}>
              {AMBIENT_SOUNDS.map((sound) => (
                <div key={sound.id}>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-white text-sm">{sound.name}</label>
                    <span className="text-white text-sm">{tempAmbientVolumes[sound.id] || 0}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={tempAmbientVolumes[sound.id] || 0}
                    onChange={(e) => setTempAmbientVolumes(v => ({ ...v, [sound.id]: Number(e.target.value) }))}
                    className="w-full h-2 bg-gray-700 rounded-full appearance-none cursor-pointer
                      [&::-webkit-slider-thumb]:appearance-none
                      [&::-webkit-slider-thumb]:w-4
                      [&::-webkit-slider-thumb]:h-4
                      [&::-webkit-slider-thumb]:rounded-full
                      [&::-webkit-slider-thumb]:bg-white
                      [&::-webkit-slider-thumb]:cursor-pointer"
                  />
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {activeTab === 'notifications' && (
        <motion.div
          key="notifications"
          role="tabpanel"
          id="notifications-panel"
          aria-labelledby="notifications-tab"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ duration: 0.2 }}
          className="space-y-4"
        >
          <div>
            <h3 className="text-white font-bold text-lg mb-3">🔔 Browser Notifications</h3>
            <p className="text-gray-400 text-sm mb-3">
              Enable browser notifications to get notified when your timer completes.
            </p>
            {(typeof window !== 'undefined' && 'Notification' in window) ? (
              <>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white text-sm">Status:</span>
                  <span className={`text-sm font-medium ${notificationPermission === 'granted' ? 'text-green-400' :
                    notificationPermission === 'denied' ? 'text-red-400' :
                      'text-yellow-400'
                    }`}>
                    {notificationPermission === 'granted' ? '✓ Enabled' :
                      notificationPermission === 'denied' ? '✗ Blocked' :
                        '⚠ Not enabled'}
                  </span>
                </div>
                {notificationPermission === 'default' && (
                  <button
                    onClick={async () => {
                      const permission = await Notification.requestPermission();
                      if (permission === 'granted') {
                        // Trigger re-render to show updated status
                        window.dispatchEvent(new Event('notificationPermissionChange'));
                      }
                    }}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Enable Notifications
                  </button>
                )}
                {notificationPermission === 'denied' && (
                  <p className="text-red-400 text-xs">
                    Notifications are blocked. Please enable them in your browser settings.
                  </p>
                )}
              </>
            ) : (
              <p className="text-gray-400 text-sm">
                Notifications are not supported in this browser.
              </p>
            )}
          </div>
        </motion.div>
      )}

      {activeTab === 'music' && (
        <motion.div
          key="music"
          role="tabpanel"
          id="music-panel"
          aria-labelledby="music-tab"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ duration: 0.2 }}
          className="space-y-4"
        >
          <div>
            <h3 className="text-white font-bold text-lg mb-2">Music Credits</h3>
            <p className="text-gray-400 text-sm mb-4">
              All music tracks are royalty-free and hosted locally for Discord Activity compatibility.
            </p>
            <button
              onClick={() => setShowMusicCredits(true)}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg border border-white/20 transition-colors"
            >
              View All Music Credits ({totalTracks} Tracks)
            </button>
          </div>

          <div>
            <h3 className="text-white font-bold text-lg mb-2">Copyright Notice</h3>
            <p className="text-gray-400 text-sm mb-4">
              If you are a copyright holder and believe any song in this collection infringes on your rights,
              please contact me and I will remove it immediately.
            </p>
            <a
              href="mailto:lexlarisa@protonmail.com?subject=Music%20Copyright%20Infringement%20Report"
              className="inline-block px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg border border-white/20 transition-colors"
            >
              Contact: lexlarisa@protonmail.com
            </a>
          </div>
        </motion.div>
      )}

      {activeTab === 'progress' && (
        <ProgressTab
          level={level}
          xp={xp}
          prestigeLevel={prestigeLevel}
          levelPath={levelPath}
          tempLevelSystemEnabled={tempLevelSystemEnabled}
          setTempLevelSystemEnabled={setTempLevelSystemEnabled}
          handleRoleChange={handleRoleChange}
          totalPomodoros={totalPomodoros}
          totalStudyMinutes={totalStudyMinutes}
          totalUniqueDays={totalUniqueDays}
          consecutiveLoginDays={consecutiveLoginDays}
          firstLoginDate={firstLoginDate}
          pomodoroBoostActive={pomodoroBoostActive}
          pomodoroBoostExpiresAt={pomodoroBoostExpiresAt}
          usernameInput={usernameInput}
          setUsernameInput={setUsernameInput}
          usernameError={usernameError}
          setUsernameError={setUsernameError}
          usernameLoading={usernameLoading}
          handleSaveUsername={handleSaveUsername}
          resetProgress={resetProgress}
        />
      )}

      {activeTab === 'whats-new' && (
        <motion.div
          key="whats-new"
          role="tabpanel"
          id="whats-new-panel"
          aria-labelledby="whats-new-tab"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ duration: 0.2 }}
          className="space-y-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <Sparkles size={20} className="text-purple-400" />
            <h3 className="text-white font-bold text-lg">Latest Updates</h3>
          </div>
          <p className="text-gray-400 text-sm mb-4">Recent features and improvements</p>

          <div className="space-y-4">
            {changelog.map((entry, index) => (
              <ChangelogItem key={`${entry.date}-${index}`} entry={entry} />
            ))}

            {/* End of list */}
            <div className="py-3 text-center text-xs text-gray-500">
              You've seen all updates
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Helper function for date formatting
function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Changelog Item Component
interface ChangelogItemProps {
  entry: ChangelogEntry;
}

function ChangelogItem({ entry }: ChangelogItemProps) {
  return (
    <div className="group">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-1.5 h-1.5 mt-2 bg-purple-500 rounded-full" />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="text-white font-semibold text-sm leading-tight">{entry.title}</h3>
            <span className="text-xs text-gray-500 whitespace-nowrap flex-shrink-0">
              {formatDate(entry.date)}
            </span>
          </div>
          <p className="text-gray-400 text-sm leading-relaxed mb-2">{entry.description}</p>
          <div className="flex flex-wrap gap-1.5">
            {entry.tags.map((tag) => (
              <Badge key={tag} variant={tag} className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      </div>
      <div className="h-px bg-gradient-to-r from-transparent via-gray-800 to-transparent mt-4" />
    </div>
  );
}