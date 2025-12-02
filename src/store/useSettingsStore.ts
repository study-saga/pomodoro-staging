import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Settings } from '../types';
import { DEFAULT_SETTINGS, USERNAME_EDIT_COOLDOWN, USERNAME_EDIT_COST, getDefaultBackground, BACKGROUNDS } from '../data/constants';
import { MAX_LEVEL, getXPNeeded } from '../data/levels';
import { getMilestoneForDay, type MilestoneReward } from '../data/milestones';
import { calculateRoleXP } from '../data/roleSystem';
import { getActiveBuffs } from '../data/eventBuffsData';

// Helper to detect device type
const getIsMobile = () => {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < 768 || window.matchMedia('(orientation: portrait)').matches;
};

// Helper to validate background compatibility
const getValidBackgroundForDevice = (backgroundId: string, isMobile: boolean): string => {
  const background = BACKGROUNDS.find(bg => bg.id === backgroundId);
  if (!background) return getDefaultBackground(isMobile);

  const requiredOrientation = isMobile ? 'vertical' : 'horizontal';
  if (background.orientation !== requiredOrientation) {
    return getDefaultBackground(isMobile);
  }

  return backgroundId;
};

interface SettingsStore extends Settings {
  // Timer actions
  setPomodoroDuration: (minutes: number) => void;
  setShortBreakDuration: (minutes: number) => void;
  setLongBreakDuration: (minutes: number) => void;
  setPomodorosBeforeLongBreak: (count: number) => void;
  setAutoStartBreaks: (enabled: boolean) => void;
  setAutoStartPomodoros: (enabled: boolean) => void;

  // Audio actions
  setSoundEnabled: (enabled: boolean) => void;
  setVolume: (volume: number) => void;
  setMusicVolume: (volume: number) => void;
  setAmbientVolume: (soundId: string, volume: number) => void;

  // Visual actions
  setBackground: (background: string) => void;
  backgroundMobile: string;
  backgroundDesktop: string;
  setPlaylist: (playlist: 'lofi' | 'synthwave') => void;

  // Level system actions
  addXP: (minutes: number) => void;
  addDailyGiftXP: (xpAmount: number, skipSync?: boolean) => void;
  setUsername: (username: string, forceWithXP?: boolean) => void;
  setLevelPath: (path: 'elf' | 'human') => void;
  setLevelSystemEnabled: (enabled: boolean) => void;
  resetProgress: () => void;
  prestige: () => void;

  // Milestone system actions
  unlockMilestoneReward: (milestone: MilestoneReward) => void;
  simulateUniqueDay: () => void; // Dev-only function to test milestones

  // Login tracking
  trackLogin: () => { isNewDay: boolean; currentDay: number; giftAlreadyClaimed: boolean };
  markDailyGiftClaimed: () => void;

  // Sync state
  settingsSyncComplete: boolean;
  setSettingsSyncComplete: (complete: boolean) => void;

  // Computed
  canEditUsername: () => boolean;
  getXPCost: () => number;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set, get) => ({
      // Initial state from defaults with device-aware background
      ...DEFAULT_SETTINGS,
      background: getValidBackgroundForDevice(DEFAULT_SETTINGS.background, getIsMobile()),
      backgroundMobile: getDefaultBackground(true),
      backgroundDesktop: getDefaultBackground(false),

      // Sync state (not persisted - always starts false)
      settingsSyncComplete: false,
      setSettingsSyncComplete: (complete) => set({ settingsSyncComplete: complete }),

      // Timer actions
      setPomodoroDuration: (minutes) =>
        set((state) => ({
          timers: { ...state.timers, pomodoro: minutes },
        })),

      setShortBreakDuration: (minutes) =>
        set((state) => ({
          timers: { ...state.timers, shortBreak: minutes },
        })),

      setLongBreakDuration: (minutes) =>
        set((state) => ({
          timers: { ...state.timers, longBreak: minutes },
        })),

      setPomodorosBeforeLongBreak: (count) =>
        set({ pomodorosBeforeLongBreak: count }),

      setAutoStartBreaks: (enabled) => set({ autoStartBreaks: enabled }),

      setAutoStartPomodoros: (enabled) => set({ autoStartPomodoros: enabled }),

      // Audio actions
      setSoundEnabled: (enabled) => set({ soundEnabled: enabled }),

      setVolume: (volume) => set({ volume }),

      setMusicVolume: (volume) => set({ musicVolume: volume }),

      setAmbientVolume: (soundId, volume) =>
        set((state) => ({
          ambientVolumes: { ...state.ambientVolumes, [soundId]: volume },
        })),

      // Visual actions
      setBackground: (background) => {
        const isMobile = getIsMobile();
        const validBackground = getValidBackgroundForDevice(background, isMobile);

        set((state) => ({
          background: validBackground,
          // Update the specific preference based on current device type
          backgroundMobile: isMobile ? validBackground : state.backgroundMobile,
          backgroundDesktop: !isMobile ? validBackground : state.backgroundDesktop
        }));
      },
      setPlaylist: (playlist) => set({ playlist }),

      // Level system actions
      addXP: (minutes) => {
        const state = get();

        console.log('[XP] addXP called with minutes:', minutes, 'Current level:', state.level, 'Current XP:', state.xp, 'Role:', state.levelPath);

        // Check if pomodoro boost is active and not expired
        let boostMultiplier = 1;
        let boostStillActive = state.pomodoroBoostActive;

        if (state.pomodoroBoostActive && state.pomodoroBoostExpiresAt) {
          if (Date.now() > state.pomodoroBoostExpiresAt) {
            // Boost has expired
            boostStillActive = false;
            console.log('[XP] Pomodoro boost expired');
          } else {
            // Boost is still active - use the actual multiplier from state
            boostMultiplier = state.pomodoroBoostMultiplier || 1.25;
            const boostPercent = Math.round((boostMultiplier - 1) * 100);
            console.log(`[XP] Applying +${boostPercent}% XP boost!`);
          }
        }

        // Role-based XP calculation using role system
        const roleResult = calculateRoleXP(state.levelPath, minutes, {
          consecutiveDays: state.consecutiveLoginDays,
          prestigeLevel: state.prestigeLevel,
          consecutiveCrits: state.consecutiveCriticals,
        });

        let baseXP = roleResult.xpGained;
        const criticalSuccess = roleResult.criticalSuccess;

        // Log role bonuses
        if (roleResult.bonuses.length > 0) {
          console.log('[XP] Role buffs applied:', roleResult.bonuses.join(', '));
        }

        // Get all active event buffs (date-based)
        const activeEventBuffs = getActiveBuffs(new Date());

        // Filter role-specific buffs
        const roleFilteredBuffs = activeEventBuffs.filter(buff => {
          if (buff.description.includes('(Elf only)')) {
            return state.levelPath === 'elf';
          }
          if (buff.description.includes('(Human only)')) {
            return state.levelPath === 'human';
          }
          return true; // Buff applies to all roles
        });

        // Calculate event buff multiplier from role-filtered buffs (stacked)
        const eventBuffMultiplier = roleFilteredBuffs.reduce((total, buff) => {
          return total * buff.xpMultiplier;
        }, 1);

        // Calculate flat XP bonus from active buffs
        const flatXPBonus = roleFilteredBuffs.reduce((total, buff) => {
          return total + (buff.flatXPBonus || 0);
        }, 0);

        if (eventBuffMultiplier > 1 && roleFilteredBuffs.length > 0) {
          console.log(
            '[XP] Event buffs active:',
            roleFilteredBuffs.map((b) => `${b.title} (x${b.xpMultiplier})`).join(', ')
          );
          console.log('[XP] Stacked event buff multiplier:', eventBuffMultiplier.toFixed(3));
        }

        if (flatXPBonus > 0) {
          console.log(`[XP] Flat XP bonus from event buffs: +${flatXPBonus}`);
        }

        // Calculate final XP with all multipliers stacked
        // Order: base XP → daily boost → event buffs (multiplier) → flat bonus
        const xpWithBoost = baseXP * boostMultiplier;
        const xpWithEventBuffs = xpWithBoost * eventBuffMultiplier;
        const xpGained = Math.floor(xpWithEventBuffs) + flatXPBonus;
        let newXP = state.xp + xpGained;
        let newLevel = state.level;
        let newPrestigeLevel = state.prestigeLevel;

        console.log('[XP] XP gained:', xpGained, 'New XP total:', newXP, 'XP needed for next level:', getXPNeeded(newLevel));

        // Check for level ups
        while (newLevel < MAX_LEVEL && newXP >= getXPNeeded(newLevel)) {
          newXP -= getXPNeeded(newLevel);
          newLevel++;
          console.log('[XP] 🎉 LEVEL UP! New level:', newLevel, 'Remaining XP:', newXP);
        }

        // Check for prestige
        if (newLevel >= MAX_LEVEL && newXP > 0) {
          newPrestigeLevel++;
          newLevel = 1;
          console.log('[XP] ⭐ PRESTIGE! New prestige level:', newPrestigeLevel);
          // XP continues to accumulate
        }

        // Check for daily milestone progress
        const today = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD
        let newTotalUniqueDays = state.totalUniqueDays;

        if (state.lastPomodoroDate !== today) {
          // This is the first Pomodoro of a new day
          newTotalUniqueDays = state.totalUniqueDays + 1;

          // Check if this new day count matches a milestone
          const milestone = getMilestoneForDay(newTotalUniqueDays);
          if (milestone) {
            // Unlock the milestone reward
            get().unlockMilestoneReward(milestone);
          }
        }

        // Update role-specific stats
        let newConsecutiveCrits = state.consecutiveCriticals;
        let newTodayPomodoros = state.todayPomodoros;
        let newComebackActive = state.comebackActive;
        let newComebackPomodoros = state.comebackPomodoros;

        // Reset today counter if new day
        if (state.lastPomodoroDate !== today) {
          newTodayPomodoros = 0;
        }
        newTodayPomodoros++;

        // Update consecutive criticals for humans
        if (state.levelPath === 'human') {
          if (criticalSuccess) {
            newConsecutiveCrits = Math.max(0, newConsecutiveCrits) + 1;
            console.log('[XP] Consecutive crits:', newConsecutiveCrits);
          } else {
            newConsecutiveCrits = Math.min(0, newConsecutiveCrits) - 1;
            console.log('[XP] Consecutive fails:', Math.abs(newConsecutiveCrits));
          }

          // Comeback buff: use and decrement
          if (newComebackActive && newComebackPomodoros > 0) {
            newComebackPomodoros--;
            if (newComebackPomodoros === 0) {
              newComebackActive = false;
              console.log('[XP] Comeback buff expired');
            }
          }
        }

        // Update local store first (optimistic update for instant UI feedback)
        console.log('[XP] Updating state - Old level:', state.level, '→ New level:', newLevel, '| Old XP:', state.xp, '→ New XP:', newXP);
        set({
          xp: newXP,
          level: newLevel,
          prestigeLevel: newPrestigeLevel,
          totalPomodoros: state.totalPomodoros + 1,
          totalStudyMinutes: state.totalStudyMinutes + minutes,
          totalUniqueDays: newTotalUniqueDays,
          lastPomodoroDate: today,
          pomodoroBoostActive: boostStillActive,
          pomodoroBoostExpiresAt: boostStillActive ? state.pomodoroBoostExpiresAt : null,
          consecutiveCriticals: newConsecutiveCrits,
          todayPomodoros: newTodayPomodoros,
          comebackActive: newComebackActive,
          comebackPomodoros: newComebackPomodoros,
        });
        console.log('[XP] State updated successfully');

        // Sync to database in background (fire and forget)
        // This ensures XP persists across page refreshes
        (async () => {
          try {
            const { saveCompletedPomodoro } = await import('../lib/userSyncAuth');

            // Get userId and discordId from store state
            const { userId, discordId } = get();

            if (!userId || !discordId) {
              console.warn('[addXP] No user ID or Discord ID - XP saved locally only');
              return;
            }

            // Save pomodoro to database (this atomically updates XP and stats)
            // RPC function handles both web and Discord auth modes
            await saveCompletedPomodoro(userId, discordId, {
              duration_minutes: minutes,
              xp_earned: xpGained,
              critical_success: criticalSuccess,
            });

            console.log('[addXP] ✓ XP synced to database');
          } catch (error) {
            console.error('[addXP] Failed to sync XP to database:', error);
            // Non-fatal - local XP is already saved
          }
        })();
      },

      addDailyGiftXP: (xpAmount, skipSync = false) => {
        const state = get();
        let newXP = state.xp + xpAmount;
        let newLevel = state.level;
        let newPrestigeLevel = state.prestigeLevel;

        // Check for level ups
        while (newLevel < MAX_LEVEL && newXP >= getXPNeeded(newLevel)) {
          newXP -= getXPNeeded(newLevel);
          newLevel++;
        }

        // Check for prestige
        if (newLevel >= MAX_LEVEL && newXP > 0) {
          newPrestigeLevel++;
          newLevel = 1;
          // XP continues to accumulate
        }

        // Update local store first (optimistic update for instant UI feedback)
        set({
          xp: newXP,
          level: newLevel,
          prestigeLevel: newPrestigeLevel,
        });

        if (skipSync) {
          console.log(`[addDailyGiftXP] Skipping DB sync (handled externally)`);
          return;
        }

        // Sync to database in background (fire and forget)
        (async () => {
          try {
            const { incrementUserXP } = await import('../lib/userSyncAuth');

            // Get userId from store state
            const { userId } = get();

            if (!userId) {
              console.warn('[addDailyGiftXP] No user ID - XP saved locally only');
              return;
            }

            // Increment XP in database using the dedicated RPC function
            // RPC function handles both web and Discord auth modes
            await incrementUserXP(userId, xpAmount);

            console.log(`[addDailyGiftXP] ✓ ${xpAmount} XP synced to database`);
          } catch (error) {
            console.error('[addDailyGiftXP] Failed to sync XP to database:', error);
            // Non-fatal - local XP is already saved
          }
        })();
      },

      setUsername: (username, forceWithXP = false) => {
        const state = get();

        if (forceWithXP) {
          // Spend XP to change username early
          if (state.xp >= USERNAME_EDIT_COST) {
            set({
              username,
              xp: state.xp - USERNAME_EDIT_COST,
              lastUsernameChange: Date.now(),
            });
          }
        } else {
          // Normal username change (cooldown must have passed)
          set({
            username,
            lastUsernameChange: Date.now(),
          });
        }
      },

      setLevelPath: (path) => set({ levelPath: path }),

      setLevelSystemEnabled: (enabled) => set({ levelSystemEnabled: enabled }),

      resetProgress: () =>
        set({
          xp: 0,
          level: 1,
          prestigeLevel: 0,
          totalPomodoros: 0,
          totalStudyMinutes: 0,
        }),

      prestige: () => {
        const state = get();
        set({
          level: 1,
          xp: 0,
          prestigeLevel: state.prestigeLevel + 1,
        });
      },

      // Milestone system actions
      unlockMilestoneReward: (milestone) => {
        console.log(`🎉 Milestone Unlocked: ${milestone.title}`);
        console.log(`📝 ${milestone.description}`);
        console.log(`🎁 Reward: ${milestone.rewardType} - ${milestone.unlockId}`);

        // TODO: In the future, this will unlock actual backgrounds, themes, or badges
        // For now, just logging to console
        // Example future implementation:
        // - Add to unlockedBackgrounds array
        // - Add to unlockedThemes array
        // - Show a notification toast
      },

      simulateUniqueDay: () => {
        const state = get();
        const newTotalUniqueDays = state.totalUniqueDays + 1;

        // Check if this new day count matches a milestone
        const milestone = getMilestoneForDay(newTotalUniqueDays);
        if (milestone) {
          get().unlockMilestoneReward(milestone);
        }

        // Update state with new unique day count and a fake "yesterday" date
        // so the next real Pomodoro will count as today
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        set({
          totalUniqueDays: newTotalUniqueDays,
          lastPomodoroDate: yesterdayStr,
        });
      },

      trackLogin: () => {
        const state = get();
        const today = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD

        // First time user (no last login date)
        if (!state.lastLoginDate) {
          console.log('[trackLogin] First time user - setting day 1');
          set({
            lastLoginDate: today,
            consecutiveLoginDays: 1,
            totalLoginDays: 1,
            firstLoginDate: today,
          });
          return {
            isNewDay: true,
            currentDay: 1,
            giftAlreadyClaimed: false,
          };
        }

        // Check if this is a new day
        if (state.lastLoginDate === today) {
          // Same day, check if gift was already claimed today
          const giftAlreadyClaimed = state.lastDailyGiftDate === today;
          console.log('[trackLogin] Same day - lastDailyGiftDate:', state.lastDailyGiftDate, 'today:', today, 'claimed:', giftAlreadyClaimed);
          return {
            isNewDay: false,
            currentDay: state.consecutiveLoginDays,
            giftAlreadyClaimed,
          };
        }

        // It's a new day!
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        // Check if login is consecutive
        const isConsecutive = state.lastLoginDate === yesterdayStr;
        const newConsecutiveDays = isConsecutive
          ? Math.min(state.consecutiveLoginDays + 1, 12)
          : 1;
        const newTotalLoginDays = state.totalLoginDays + 1;

        set({
          lastLoginDate: today,
          consecutiveLoginDays: newConsecutiveDays,
          totalLoginDays: newTotalLoginDays,
        });

        // Gift hasn't been claimed today (it's a new day)
        console.log('[trackLogin] New day - consecutiveLoginDays:', newConsecutiveDays, 'giftAlreadyClaimed: false');
        return {
          isNewDay: true,
          currentDay: newConsecutiveDays,
          giftAlreadyClaimed: false,
        };
      },

      markDailyGiftClaimed: () => {
        const today = new Date().toISOString().split('T')[0];
        set({ lastDailyGiftDate: today });
        console.log('[DailyGift] Marked daily gift as claimed for', today);
      },

      // Computed
      canEditUsername: () => {
        const state = get();
        if (!state.lastUsernameChange) return true;
        return Date.now() - state.lastUsernameChange >= USERNAME_EDIT_COOLDOWN;
      },

      getXPCost: () => USERNAME_EDIT_COST,
    }),
    {
      name: 'pomodoroSettings',
      onRehydrateStorage: () => (state) => {
        // After loading from localStorage, validate background compatibility
        if (state) {
          const isMobile = getIsMobile();

          // Switch to the correct background preference for this device
          // If preference exists, use it. Otherwise use current background if valid, or default.
          let targetBackground = isMobile ? state.backgroundMobile : state.backgroundDesktop;

          // Fallback if specific preference is missing (legacy state)
          if (!targetBackground) {
            targetBackground = state.background;
          }

          const validBackground = getValidBackgroundForDevice(targetBackground, isMobile);

          // Apply the validated background
          state.background = validBackground;

          // Ensure preferences are populated if they were empty (migration from old state)
          if (!state.backgroundMobile) state.backgroundMobile = getDefaultBackground(true);
          if (!state.backgroundDesktop) state.backgroundDesktop = getDefaultBackground(false);
        }
      },
    }
  )
);
