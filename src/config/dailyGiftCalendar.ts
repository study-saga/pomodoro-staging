// Daily Gift Calendar Configuration
// Configure rewards for each day of the month (1-31)

export type RewardType = 'xp' | 'boost' | 'special';

export interface DailyReward {
  day: number; // Day of month (1-31)
  type: RewardType;
  xpAmount?: number; // XP to award
  boostDuration?: number; // Hours for boost (if type = 'boost')
  boostMultiplier?: number; // Multiplier (e.g., 1.25 = +25%)
  itemId?: string; // Item identifier for special rewards
  emoji?: string; // Custom emoji to display
  description?: string; // Description for UI
}

// Default rewards for days not explicitly configured
const DEFAULT_REWARD: Omit<DailyReward, 'day'> = {
  type: 'xp',
  xpAmount: 10,
  emoji: '🍅',
};

// Custom rewards for specific days
// Days not listed here will use DEFAULT_REWARD
export const DAILY_GIFT_CALENDAR: Partial<Record<number, DailyReward>> = {
  // Week 1: Small XP rewards
  1: {
    day: 1,
    type: 'xp',
    xpAmount: 20,
    emoji: '🎉',
    description: 'Start of month bonus!',
  },

  // Day 7: Weekly milestone
  7: {
    day: 7,
    type: 'xp',
    xpAmount: 30,
    emoji: '⭐',
    description: 'Week 1 complete!',
  },

  // Day 10: Special tomato boost
  10: {
    day: 10,
    type: 'boost',
    xpAmount: 50,
    boostDuration: 24,
    boostMultiplier: 1.25,
    emoji: '🍅',
    description: '+25% For all Pomodoros [24hrs]',
  },

  // Day 14: Two-week milestone
  14: {
    day: 14,
    type: 'xp',
    xpAmount: 40,
    emoji: '🔥',
    description: 'Two weeks strong!',
  },

  // Day 15: Mid-month special
  15: {
    day: 15,
    type: 'boost',
    xpAmount: 75,
    boostDuration: 24,
    boostMultiplier: 1.5,
    emoji: '💎',
    description: '+50% XP Boost [24hrs]',
  },

  // Day 21: Three-week milestone
  21: {
    day: 21,
    type: 'xp',
    xpAmount: 50,
    emoji: '🏆',
    description: 'Three weeks complete!',
  },

  // Day 25: Late month push
  25: {
    day: 25,
    type: 'xp',
    xpAmount: 60,
    emoji: '🚀',
    description: 'Almost there!',
  },

  // Day 30: End of month mega reward
  30: {
    day: 30,
    type: 'special',
    xpAmount: 100,
    emoji: '🎁',
    description: 'Month completed!',
  },

  // Day 31: Bonus day for 31-day months
  31: {
    day: 31,
    type: 'boost',
    xpAmount: 100,
    boostDuration: 48,
    boostMultiplier: 1.5,
    emoji: '👑',
    description: '+50% XP Boost [48hrs]',
  },
};

/**
 * Get reward configuration for a specific day
 * Falls back to DEFAULT_REWARD if day not configured
 */
export function getRewardForDay(day: number): DailyReward {
  const customReward = DAILY_GIFT_CALENDAR[day];

  if (customReward) {
    return customReward;
  }

  // Return default reward with day number
  return {
    day,
    ...DEFAULT_REWARD,
  };
}

/**
 * Get number of days in a specific month/year
 */
export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Check if a specific day exists in the current month
 */
export function isDayInCurrentMonth(day: number): boolean {
  const now = new Date();
  const daysInMonth = getDaysInMonth(now.getFullYear(), now.getMonth());
  return day >= 1 && day <= daysInMonth;
}
