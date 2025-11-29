import { memo } from 'react';
import { motion } from 'framer-motion';

interface TimerTabProps {
  tempTimers: {
    pomodoro: number;
    shortBreak: number;
    longBreak: number;
  };
  setTempTimers: React.Dispatch<React.SetStateAction<{
    pomodoro: number;
    shortBreak: number;
    longBreak: number;
  }>>;
  tempPomodorosBeforeLongBreak: number;
  setTempPomodorosBeforeLongBreak: (value: number) => void;
  tempAutoStartBreaks: boolean;
  setTempAutoStartBreaks: (value: boolean) => void;
  tempAutoStartPomodoros: boolean;
  setTempAutoStartPomodoros: (value: boolean) => void;
  tempSoundEnabled: boolean;
  setTempSoundEnabled: (value: boolean) => void;
  tempLevelSystemEnabled: boolean;
  setTempLevelSystemEnabled: (value: boolean) => void;
  tempVolume: number;
  setTempVolume: (value: number) => void;
  notificationPermission: NotificationPermission;
}

export const TimerTab = memo(({
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
  tempLevelSystemEnabled,
  setTempLevelSystemEnabled,
  tempVolume,
  setTempVolume,
  notificationPermission,
}: TimerTabProps) => {
  return (
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
          <input
            type="number"
            min="1"
            max="10"
            value={tempPomodorosBeforeLongBreak}
            onChange={(e) => setTempPomodorosBeforeLongBreak(Number(e.target.value))}
            className="w-16 bg-white/10 text-white text-center px-2 py-1 rounded border border-white/20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
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

        <div className="flex items-center justify-between mb-4">
          <label className="text-white">Enable sound notifications</label>
          <input
            type="checkbox"
            checked={tempSoundEnabled}
            onChange={(e) => setTempSoundEnabled(e.target.checked)}
            className="w-5 h-5 rounded"
          />
        </div>

        <div className="flex items-center justify-between mb-4">
          <label className="text-white">Enable leveling system</label>
          <input
            type="checkbox"
            checked={tempLevelSystemEnabled}
            onChange={(e) => setTempLevelSystemEnabled(e.target.checked)}
            className="w-5 h-5 rounded"
          />
        </div>
      </div>

      <div>
        <label className="block text-white font-medium mb-2">
          Alarm Bell Volume - {tempVolume}%
        </label>
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
          [&::-webkit-slider-thumb]:cursor-pointer
          [&::-moz-range-thumb]:w-4
          [&::-moz-range-thumb]:h-4
          [&::-moz-range-thumb]:rounded-full
          [&::-moz-range-thumb]:bg-blue-500
          [&::-moz-range-thumb]:border-0"
        />
      </div>

      <div>
        <h3 className="text-white font-bold text-lg mb-3">🔔 Notifications</h3>
        <p className="text-gray-400 text-sm mb-3">
          Enable browser notifications to get notified when your timer completes.
        </p>
        {('Notification' in window) ? (
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
  );
});
