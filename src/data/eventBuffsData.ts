import type { EventBuff } from '../types';
import { isBuffActiveOnDate } from '../config/buffActivationRules';
import buffElfSlingshot from '../assets/buff-elf-slingshot.svg';
import buffWintersBlessing from '../assets/buff-winters-blessing.svg';
import buffWinterWisdom from '../assets/buff-winter-wisdom.svg';

/**
 * EVENT BUFFS DATABASE
 *
 * ===============================================
 * QUICK START: Add a new event buff in 3 steps
 * ===============================================
 *
 * 1. Copy an existing buff object below
 * 2. Customize: id, title, description, emoji, xpMultiplier
 * 3. Set dateRule (see DATE RULE TYPES below)
 * 4. Save file - buff auto-activates on matching dates!
 *
 * ===============================================
 * XP MULTIPLIER GUIDE
 * ===============================================
 *
 * - 1.25 = +25% XP (weekend boost, small events)
 * - 1.5  = +50% XP (holiday weeks, special events)
 * - 1.75 = +75% XP (major events, limited-time)
 * - 2.0  = +100% XP (double XP, premium events)
 *
 * STACKING: Multiple active buffs MULTIPLY together!
 * Example: Weekend (1.25x) + Holiday (1.5x) = 1.875x total
 *
 * ===============================================
 * DATE RULE TYPES (5 types)
 * ===============================================
 *
 * 1. dayOfWeek - Recurring weekly (weekends, specific weekdays)
 *    days: [0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday]
 *    Example: { type: 'dayOfWeek', days: [0, 6] } // Weekends
 *
 * 2. specificDate - Single date only (one-time events)
 *    date: 'YYYY-MM-DD'
 *    Example: { type: 'specificDate', date: '2025-12-31' } // New Year's Eve
 *
 * 3. dateRange - Date range (holiday seasons, multi-day events)
 *    startDate: 'YYYY-MM-DD', endDate: 'YYYY-MM-DD', yearlyRecur: boolean
 *    Example: { type: 'dateRange', startDate: '2025-12-22', endDate: '2025-12-25' }
 *
 * 4. monthDay - Yearly recurring (birthdays, holidays)
 *    month: 1-12, day: 1-31, daysAround: number (optional, extends range)
 *    Example: { type: 'monthDay', month: 2, day: 14, daysAround: 3 } // Valentine's week
 *
 * 5. cycle - Repeating intervals (bi-weekly, monthly patterns)
 *    startDate: 'YYYY-MM-DD', intervalDays: number, durationDays: number
 *    Example: { type: 'cycle', startDate: '2025-11-01', intervalDays: 14, durationDays: 5 }
 *
 * ===============================================
 * ADVANCED: durationHours (optional)
 * ===============================================
 *
 * Expires buff after N hours from start time.
 * Default: Buff lasts entire day(s) from dateRule.
 *
 * Example with durationHours:
 * {
 *   dateRule: { type: 'specificDate', date: '2025-11-28' },
 *   durationHours: 48  // Active from Nov 28 00:00 for 48 hours
 * }
 *
 * ===============================================
 * VALIDATION RULES
 * ===============================================
 *
 * - id: Unique string (no spaces, use kebab-case)
 * - xpMultiplier: >= 1.0 (1.0 = no boost)
 * - dateRange: endDate >= startDate
 * - monthDay: month 1-12, day 1-31
 * - dayOfWeek: days 0-6 only
 *
 * See docs/EVENT_BUFFS.md for full guide!
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
    previewHours: 12, // Show only 12 hours before weekend starts
    dateRule: {
      type: 'dayOfWeek',
      days: [0, 6], // Sunday and Saturday
    },
  },

  // ============================================
  // NOVEMBER 2025 - ELF COMEBACK EVENT
  // ============================================
  {
    id: 'elf_comeback_nov_2025',
    title: 'Elven Resurgence',
    description: '+25% XP - The elves rise again! (Elf only)',
    emoji: '🏹',
    iconSrc: buffElfSlingshot, // Use custom SVG icon
    xpMultiplier: 1.25,
    dateRule: {
      type: 'dateRange',
      startDate: '2025-11-24',
      endDate: '2025-11-30', // Through Sunday 11:59:59 PM
      yearlyRecur: false,
    },
  },

  // ============================================
  // NOVEMBER 2025 BUFFS
  // ============================================
  // {
  //   id: 'thanksgiving_2025',
  //   title: 'Gratitude Bonus',
  //   description: '+50% XP - Thanksgiving Week',
  //   emoji: '🦃',
  //   xpMultiplier: 1.5,
  //   dateRule: {
  //     type: 'dateRange',
  //     startDate: '2025-11-20',
  //     endDate: '2025-11-27',
  //     yearlyRecur: false,
  //   },
  // },

  // {
  //   id: 'black_friday_2025',
  //   title: 'Black Friday Blitz',
  //   description: '+75% XP - 48 hours only!',
  //   emoji: '🛍️',
  //   xpMultiplier: 1.75,
  //   dateRule: {
  //     type: 'dateRange',
  //     startDate: '2025-11-28',
  //     endDate: '2025-11-29',
  //     yearlyRecur: false,
  //   },
  // },

  // ============================================
  // DECEMBER 2025 - JANUARY 2026 (Holiday Season)
  // ============================================
  {
    id: 'winters_blessing_dec_2025',
    title: "Winter's Blessing",
    description: '+30% XP - Elven winter magic (Elf only)',
    emoji: '❄️',
    iconSrc: buffWintersBlessing,
    xpMultiplier: 1.30,
    dateRule: {
      type: 'dateRange',
      startDate: '2025-12-10',
      endDate: '2026-01-01',
      yearlyRecur: false,
    },
  },
  {
    id: 'winter_wisdom_dec_2025',
    title: 'Winter Wisdom',
    description: '+15 XP per session - Study through winter (Human only)',
    emoji: '📚',
    iconSrc: buffWinterWisdom,
    xpMultiplier: 1.0, // No multiplier
    flatXPBonus: 15,
    dateRule: {
      type: 'dateRange',
      startDate: '2025-12-10',
      endDate: '2026-01-01',
      yearlyRecur: false,
    },
  },

  // {
  //   id: 'december_festivities',
  //   title: 'December Cheer',
  //   description: '+30% XP all month',
  //   emoji: '🎄',
  //   xpMultiplier: 1.3,
  //   dateRule: {
  //     type: 'monthDay',
  //     month: 12,
  //     day: 16, // Adjusted to create Dec 1 - Dec 31 window
  //     daysAround: 15, // Dec 1 - Dec 31
  //   },
  // },

  // Christmas Magic - commented out for now
  // {
  //   id: 'christmas_special',
  //   title: 'Christmas Magic',
  //   description: 'Double XP! Dec 22-25',
  //   emoji: '🎁',
  //   xpMultiplier: 2.0,
  //   dateRule: {
  //     type: 'dateRange',
  //     startDate: '2025-12-22',
  //     endDate: '2025-12-25',
  //     yearlyRecur: true,
  //   },
  // },

  // ============================================
  // RECURRING EVENTS (Bi-weekly Study Pushes)
  // ============================================
  // {
  //   id: 'study_surge_cycle',
  //   title: 'Study Surge',
  //   description: '+40% XP - 5-day power week',
  //   emoji: '⚡',
  //   xpMultiplier: 1.4,
  //   dateRule: {
  //     type: 'cycle',
  //     startDate: '2025-11-01',
  //     intervalDays: 14, // Every 2 weeks
  //     durationDays: 5, // Active for 5 days
  //   },
  // },

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

/**
 * HELPER: Get buffs starting within next N hours
 * Used for preview/teaser display before buff activates
 * Respects per-buff previewHours (default: 48)
 */
export function getUpcomingBuffs(defaultHoursAhead: number = 48, date: Date = new Date()): EventBuff[] {
  return EVENT_BUFFS.filter((buff) => {
    const isCurrentlyActive = isBuffActiveOnDate(buff, date);
    if (isCurrentlyActive) return false; // Already active, not upcoming

    // Use buff-specific preview window or default
    const buffPreviewHours = buff.previewHours ?? defaultHoursAhead;
    const futureDate = new Date(date.getTime() + buffPreviewHours * 60 * 60 * 1000);

    const willBeActive = isBuffActiveOnDate(buff, futureDate);

    // Return buffs that are NOT currently active but WILL BE active within the timeframe
    return willBeActive;
  });
}

/**
 * HELPER: Get buff start date as readable string
 * Returns formatted start date for display (e.g., "10 of December")
 */
export function getBuffStartDateText(buff: EventBuff): string {
  const rule = buff.dateRule;

  if (rule.type === 'dateRange') {
    const date = new Date(rule.startDate + 'T00:00:00');
    const month = date.toLocaleDateString('en-US', { month: 'long' });
    const day = date.getDate();
    return `${day} of ${month}`;
  }

  if (rule.type === 'specificDate') {
    const date = new Date(rule.date + 'T00:00:00');
    const month = date.toLocaleDateString('en-US', { month: 'long' });
    const day = date.getDate();
    return `${day} of ${month}`;
  }

  return 'Soon';
}
