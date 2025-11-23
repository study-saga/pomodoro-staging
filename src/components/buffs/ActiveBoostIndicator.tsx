import { motion } from 'framer-motion';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useEffect, useState } from 'react';

export function ActiveBoostIndicator() {
  const pomodoroBoostActive = useSettingsStore((state) => state.pomodoroBoostActive);
  const pomodoroBoostExpiresAt = useSettingsStore((state) => state.pomodoroBoostExpiresAt);
  const pomodoroBoostMultiplier = useSettingsStore((state) => state.pomodoroBoostMultiplier);

  const [timeRemaining, setTimeRemaining] = useState<string>('');

  useEffect(() => {
    if (!pomodoroBoostActive || !pomodoroBoostExpiresAt) return;

    const updateTimer = () => {
      const now = Date.now();
      const remaining = pomodoroBoostExpiresAt - now;

      if (remaining <= 0) {
        useSettingsStore.setState({ pomodoroBoostActive: false, pomodoroBoostExpiresAt: null });
        return;
      }

      const hours = Math.floor(remaining / (1000 * 60 * 60));
      const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
      setTimeRemaining(`${hours}h ${minutes}m`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [pomodoroBoostActive, pomodoroBoostExpiresAt]);

  if (!pomodoroBoostActive) return null;

  const boostPercentage = ((pomodoroBoostMultiplier || 1.25) - 1) * 100;

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      className="fixed top-20 right-4 z-30"
    >
      <div className="bg-gradient-to-r from-orange-500/20 to-red-500/20 backdrop-blur-md border border-orange-400/40 rounded-lg px-3 py-2 flex items-center gap-2">
        {/* Boost Icon */}
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            rotate: [0, 5, -5, 0],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="text-2xl"
        >
          🔥
        </motion.div>

        {/* Boost Info */}
        <div className="flex flex-col">
          <span className="text-sm font-bold text-orange-300">
            +{boostPercentage}% XP Boost
          </span>
          <span className="text-xs text-white/60">
            {timeRemaining}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
