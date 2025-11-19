import { useEffect, useState, useRef } from 'react';
import { useSettingsStore } from '../store/useSettingsStore';
import { getLevelName } from '../data/levels';
import { showGameToast } from '../components/ui/GameToast';

export function useLevelNotifications() {
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [levelUpData, setLevelUpData] = useState({ level: 1, levelName: '' });

  const level = useSettingsStore((state) => state.level);
  const levelPath = useSettingsStore((state) => state.levelPath);
  const xp = useSettingsStore((state) => state.xp);

  // Use refs to track previous values (more reliable than localStorage)
  const prevXPRef = useRef<number | null>(null);
  const prevLevelRef = useRef<number | null>(null);
  const isInitializedRef = useRef(false);

  // Initialize previous values on first render with actual state values
  useEffect(() => {
    if (!isInitializedRef.current && xp > 0) {
      // Only initialize once we have real data (xp > 0 means data is loaded)
      prevXPRef.current = xp;
      prevLevelRef.current = level;
      isInitializedRef.current = true;
      console.log('[LevelNotifications] Initialized with level:', level, 'XP:', xp);
    }
  }, [xp, level]);

  // Watch for XP and level changes
  useEffect(() => {
    // Skip if not initialized yet (prevents false triggers on mount)
    if (!isInitializedRef.current || prevXPRef.current === null || prevLevelRef.current === null) return;

    const prevXP = prevXPRef.current;
    const prevLevel = prevLevelRef.current;

    if (xp !== prevXP) {
      if (xp > prevXP) {
        // XP gained - show positive toast
        const gained = xp - prevXP;
        showGameToast(`+${gained} XP Collected! 🎉`);
      } else if (prevXP - xp === 50) {
        // Name change cost (50 XP)
        showGameToast(`-50 XP Spent`);
      }
      // No toast for reset (large decrease)

      prevXPRef.current = xp;
    }

    // Level up detected!
    if (level !== prevLevel && level > prevLevel) {
      console.log('[LevelNotifications] 🎉 LEVEL UP DETECTED! From', prevLevel, 'to', level);

      setLevelUpData({
        level,
        levelName: getLevelName(level, levelPath)
      });
      setShowLevelUp(true);

      // Hide celebration after 3 seconds
      setTimeout(() => setShowLevelUp(false), 3000);

      prevLevelRef.current = level;
    } else if (level !== prevLevel) {
      // Level changed but didn't increase (e.g., prestige or manual change)
      console.log('[LevelNotifications] Level changed but not increased:', prevLevel, '→', level);
      prevLevelRef.current = level;
    }
  }, [xp, level, levelPath]);

  return {
    showLevelUp,
    levelUpData
  };
}
