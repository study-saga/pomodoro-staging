import type { EventBuff } from '../types';
import { isBuffActiveOnDate } from '../config/buffActivationRules';

/**
 * EVENT BUFFS DATABASE
 *
 * Edit this file to add/modify monthly event buffs!
 * No code changes needed - buffs auto-activate based on date rules.
 *
 * HOW TO ADD A NEW BUFF:
 * 1. Copy an existing buff object
 * 2. Change id, title, description, emoji
 * 3. Set xpMultiplier (1.25 = +25%, 1.5 = +50%, 2.0 = double)
 * 4. Set dateRule (see examples below)
 * 5. Save file - buff is now live!
 */

export const EVENT_BUFFS: EventBuff[] = [
  // ============================================
  // WEEKEND BUFFS (Always Active)
  // ============================================
  {
    id: 'weekend_warrior',
    title: 'Weekend Warrior',
    description: '+25% XP on weekends',
    emoji: '💪',
    xpMultiplier: 1.25,
    dateRule: {
      type: 'dayOfWeek',
      days: [0, 6], // Sunday and Saturday
    },
  },

  // ============================================
  // NOVEMBER 2025 BUFFS
  // ============================================
  {
    id: 'thanksgiving_2025',
    title: 'Gratitude Bonus',
    description: '+50% XP - Thanksgiving Week',
    emoji: '🦃',
    xpMultiplier: 1.5,
    dateRule: {
      type: 'dateRange',
      startDate: '2025-11-20',
      endDate: '2025-11-27',
      yearlyRecur: false,
    },
  },

  {
    id: 'black_friday_2025',
    title: 'Black Friday Blitz',
    description: '+75% XP - 48 hours only!',
    emoji: '🛍️',
    xpMultiplier: 1.75,
    durationHours: 48,
    dateRule: {
      type: 'specificDate',
      date: '2025-11-28',
    },
  },

  // ============================================
  // DECEMBER 2025 - JANUARY 2026 (Holiday Season)
  // ============================================
  {
    id: 'december_festivities',
    title: 'December Cheer',
    description: '+30% XP all month',
    emoji: '🎄',
    xpMultiplier: 1.3,
    dateRule: {
      type: 'monthDay',
      month: 12,
      day: 15, // Centered around mid-December
      daysAround: 15, // Dec 1 - Dec 31
    },
  },

  {
    id: 'christmas_special',
    title: 'Christmas Magic',
    description: 'Double XP! Dec 22-25',
    emoji: '🎁',
    xpMultiplier: 2.0,
    dateRule: {
      type: 'dateRange',
      startDate: '2025-12-22',
      endDate: '2025-12-25',
      yearlyRecur: true, // Repeats every year
    },
  },

  {
    id: 'new_years_energy',
    title: 'New Year Energy',
    description: '+50% XP - New Year week',
    emoji: '🎊',
    xpMultiplier: 1.5,
    dateRule: {
      type: 'dateRange',
      startDate: '2025-12-26',
      endDate: '2026-01-02',
      yearlyRecur: false,
    },
  },

  // ============================================
  // RECURRING EVENTS (Bi-weekly Study Pushes)
  // ============================================
  {
    id: 'study_surge_cycle',
    title: 'Study Surge',
    description: '+40% XP - 5-day power week',
    emoji: '⚡',
    xpMultiplier: 1.4,
    dateRule: {
      type: 'cycle',
      startDate: '2025-11-01',
      intervalDays: 14, // Every 2 weeks
      durationDays: 5, // Active for 5 days
    },
  },

  // ============================================
  // COMMENTED EXAMPLES (For Future Use)
  // ============================================

  /*
  // Valentine's Day (yearly recurring)
  {
    id: 'valentines_day',
    title: 'Love & Study',
    description: '+50% XP - Valentine\'s week',
    emoji: '💕',
    xpMultiplier: 1.5,
    dateRule: {
      type: 'monthDay',
      month: 2,
      day: 14,
      daysAround: 3, // Feb 11-17
    },
  },

  // Spring Break (specific dates)
  {
    id: 'spring_break_2026',
    title: 'Spring Break Grind',
    description: '+60% XP - Make the most of your break!',
    emoji: '🌸',
    xpMultiplier: 1.6,
    dateRule: {
      type: 'dateRange',
      startDate: '2026-03-15',
      endDate: '2026-03-22',
    },
  },

  // Full Moon (recurring every ~29 days)
  {
    id: 'full_moon_focus',
    title: 'Full Moon Focus',
    description: '+20% XP under the full moon',
    emoji: '🌕',
    xpMultiplier: 1.2,
    dateRule: {
      type: 'cycle',
      startDate: '2025-11-01',
      intervalDays: 29, // Lunar cycle
      durationDays: 1,
    },
  },

  // Exam Season (custom dates)
  {
    id: 'finals_week_fall',
    title: 'Finals Week Focus',
    description: '+100% XP - You got this!',
    emoji: '📚',
    xpMultiplier: 2.0,
    dateRule: {
      type: 'dateRange',
      startDate: '2025-12-10',
      endDate: '2025-12-20',
    },
  },
  */
];

/**
 * HELPER: Get buffs active RIGHT NOW
 */
export function getActiveBuffs(date: Date = new Date()): EventBuff[] {
  return EVENT_BUFFS.filter((buff) => isBuffActiveOnDate(buff, date));
}

/**
 * HELPER: Get total XP multiplier from all active buffs
 * Multipliers STACK: 1.25 * 1.5 = 1.875x (87.5% total boost)
 */
export function getStackedMultiplier(date: Date = new Date()): number {
  const activeBuffs = getActiveBuffs(date);
  return activeBuffs.reduce((total, buff) => total * buff.xpMultiplier, 1);
}

/**
 * HELPER: Get buff by ID
 */
export function getBuffById(buffId: string): EventBuff | undefined {
  return EVENT_BUFFS.find((buff) => buff.id === buffId);
}
