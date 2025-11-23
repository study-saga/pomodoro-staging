# Event Buffs System

Complete guide to creating and managing event-based XP buffs in the Pomodoro app.

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Date Rule Types](#date-rule-types)
- [XP Multiplier Guide](#xp-multiplier-guide)
- [Advanced: durationHours](#advanced-durationhours)
- [Common Patterns & Templates](#common-patterns--templates)
- [Troubleshooting](#troubleshooting)
- [Code Reference](#code-reference)

---

## Overview

**Event buffs** are date-based XP multipliers that automatically activate on specific dates, time periods, or recurring schedules. They're perfect for:

- **Seasonal events** (holidays, exam seasons)
- **Recurring boosts** (weekends, monthly power weeks)
- **Special promotions** (limited-time events, milestones)

### How It Works

1. **Configure buffs** in `/src/data/eventBuffsData.ts`
2. **System auto-activates** buffs based on date rules
3. **Buffs stack multiplicatively** when multiple are active
4. **XP calculation** applies all active buffs to pomodoro completions

### Key Features

- ✅ **Zero code changes** - Just edit config file
- ✅ **5 date rule types** - Flexible scheduling options
- ✅ **Automatic activation** - No manual toggling needed
- ✅ **Multiplicative stacking** - Multiple buffs compound
- ✅ **Visual indicators** - Buff icons show in Level UI

---

## Quick Start

**Goal:** Add a New Year's Day 2026 buff with +100% XP

### Step 1: Open the Config File

Edit `/src/data/eventBuffsData.ts`

### Step 2: Add Your Buff

Copy an existing buff and customize:

\`\`\`typescript
{
  id: 'new_years_day_2026',           // Unique ID (kebab-case)
  title: 'New Year's Day',             // Display name
  description: 'Double XP!',           // Tooltip description
  emoji: '🎉',                         // Icon emoji
  xpMultiplier: 2.0,                   // 2.0 = double XP
  dateRule: {
    type: 'specificDate',
    date: '2026-01-01'                 // Jan 1, 2026 only
  },
}
\`\`\`

### Step 3: Save & Test

1. Save the file
2. Buff auto-activates on Jan 1, 2026
3. Check Level UI for 🎉 icon
4. Complete a pomodoro - XP should be doubled!

That's it! No build step, no deployment needed.

---

## Date Rule Types

Event buffs support 5 date rule types for flexible scheduling.

### 1. dayOfWeek - Recurring Weekly

**Use for:** Weekends, specific weekdays

**Configuration:**

\`\`\`typescript
dateRule: {
  type: 'dayOfWeek',
  days: [0, 6]  // Array of days (0=Sunday, 6=Saturday)
}
\`\`\`

**Day Numbers:**
- 0 = Sunday
- 1 = Monday
- 2 = Tuesday
- 3 = Wednesday
- 4 = Thursday
- 5 = Friday
- 6 = Saturday

**Examples:**

\`\`\`typescript
// Weekends only
{ type: 'dayOfWeek', days: [0, 6] }

// Weekdays only
{ type: 'dayOfWeek', days: [1, 2, 3, 4, 5] }

// Friday & Saturday (weekend boost starts early!)
{ type: 'dayOfWeek', days: [5, 6] }

// Every Monday (start-of-week motivation)
{ type: 'dayOfWeek', days: [1] }
\`\`\`

---

### 2. specificDate - Single Date Only

**Use for:** One-time events, birthdays, specific milestones

**Configuration:**

\`\`\`typescript
dateRule: {
  type: 'specificDate',
  date: 'YYYY-MM-DD'  // ISO date format
}
\`\`\`

**Examples:**

\`\`\`typescript
// New Year's Eve 2025
{ type: 'specificDate', date: '2025-12-31' }

// Launch anniversary
{ type: 'specificDate', date: '2026-06-15' }

// Founder's birthday
{ type: 'specificDate', date: '2025-07-04' }
\`\`\`

**Note:** Does NOT recur yearly unless combined with `yearlyRecur` in a `dateRange`.

---

### 3. dateRange - Date Range

**Use for:** Holiday seasons, multi-day events, vacation periods

**Configuration:**

\`\`\`typescript
dateRule: {
  type: 'dateRange',
  startDate: 'YYYY-MM-DD',
  endDate: 'YYYY-MM-DD',
  yearlyRecur: true | false  // Optional, default: false
}
\`\`\`

**Examples:**

\`\`\`typescript
// Christmas week 2025 (non-recurring)
{
  type: 'dateRange',
  startDate: '2025-12-22',
  endDate: '2025-12-28',
  yearlyRecur: false
}

// Summer break every year (recurring)
{
  type: 'dateRange',
  startDate: '2025-06-01',
  endDate: '2025-08-31',
  yearlyRecur: true  // Repeats Jun 1 - Aug 31 every year
}

// Thanksgiving week (yearly recurring)
{
  type: 'dateRange',
  startDate: '2025-11-20',
  endDate: '2025-11-27',
  yearlyRecur: true
}
\`\`\`

**yearlyRecur Behavior:**
- `true`: Repeats every year on same month/day
- `false`: Only active in specified year
- Handles year wrap-around (Dec 25 - Jan 5)

---

### 4. monthDay - Yearly Recurring

**Use for:** Birthdays, holidays, monthly events

**Configuration:**

\`\`\`typescript
dateRule: {
  type: 'monthDay',
  month: 1-12,           // Month number
  day: 1-31,             // Day of month
  daysAround: number     // Optional: extend range
}
\`\`\`

**Examples:**

\`\`\`typescript
// Valentine's Day (single day)
{
  type: 'monthDay',
  month: 2,
  day: 14
}

// Valentine's week (7-day range)
{
  type: 'monthDay',
  month: 2,
  day: 14,
  daysAround: 3  // Feb 11-17 (14 ± 3 days)
}

// December all month
{
  type: 'monthDay',
  month: 12,
  day: 16,
  daysAround: 15  // Dec 1-31 (16 ± 15 days)
}

// First day of every month
{
  type: 'monthDay',
  month: 1,  // Applies to ALL months
  day: 1
}
\`\`\`

**daysAround Math:**
- `daysAround: 3` on Feb 14 → Feb 11-17 (7 days total)
- `daysAround: 15` on Dec 16 → Dec 1-31 (full month)

---

### 5. cycle - Repeating Intervals

**Use for:** Bi-weekly events, monthly power weeks, custom schedules

**Configuration:**

\`\`\`typescript
dateRule: {
  type: 'cycle',
  startDate: 'YYYY-MM-DD',  // Reference start date
  intervalDays: number,      // Repeat every N days
  durationDays: number       // Active for N days each cycle
}
\`\`\`

**Examples:**

\`\`\`typescript
// Bi-weekly power week (5 days on, 9 days off)
{
  type: 'cycle',
  startDate: '2025-11-01',
  intervalDays: 14,  // Every 2 weeks
  durationDays: 5    // Active for 5 days
}

// Monthly first-week boost
{
  type: 'cycle',
  startDate: '2025-11-01',
  intervalDays: 30,  // ~Every month
  durationDays: 7    // First 7 days
}

// Full moon bonus (29-day lunar cycle)
{
  type: 'cycle',
  startDate: '2025-11-01',  // First full moon reference
  intervalDays: 29,          // Lunar month
  durationDays: 1            // One day only
}
\`\`\`

**How It Works:**
1. Calculates days since `startDate`
2. Finds position in cycle: `daysSince % intervalDays`
3. Active if position < `durationDays`

**Visual Timeline Example:**
\`\`\`
intervalDays: 14, durationDays: 5

Day:  1 2 3 4 5 6 7 8 9 10 11 12 13 14 | 15 16 17 18 19 20 21 22 23 24 25 26 27 28 |
Buff: ✓ ✓ ✓ ✓ ✓ ✗ ✗ ✗ ✗ ✗  ✗  ✗  ✗  ✗  | ✓  ✓  ✓  ✓  ✓  ✗  ✗  ✗  ✗  ✗  ✗  ✗  ✗  ✗  |
      |<---- 5 days ---->|                 |<---- repeats ---->|
\`\`\`

---

## XP Multiplier Guide

### Recommended Ranges

| Multiplier | Boost | Use Case | Example |
|------------|-------|----------|---------|
| 1.1 - 1.2  | +10-20% | Mild boost, common events | Weekdays, daily login |
| 1.25 - 1.5 | +25-50% | Standard events | Weekends, holiday weeks |
| 1.75 - 2.0 | +75-100% | Major events | Christmas, double XP events |
| 2.0+       | +100%+ | Rare, premium | Special milestones |

### Stacking Behavior

**Multiple active buffs MULTIPLY together (not add):**

\`\`\`typescript
// Example: Saturday during Thanksgiving
Active buffs:
- Weekend Warrior: 1.25x
- Thanksgiving Bonus: 1.5x

Total multiplier: 1.25 × 1.5 = 1.875x (+87.5% XP)

XP calculation:
Base XP: 100
Final XP: 100 × 1.875 = 187.5 → 187 XP (rounded down)
\`\`\`

**Stacking Examples:**

| Active Buffs | Calculation | Total Boost |
|-------------|-------------|-------------|
| Weekend (1.25x) | 1.25 | +25% |
| Weekend + Holiday (1.5x) | 1.25 × 1.5 = 1.875 | +87.5% |
| Weekend + Holiday + Event (1.3x) | 1.25 × 1.5 × 1.3 = 2.4375 | +143.75% |

**Warning:** Too many stacking buffs can create extreme XP inflation. Limit overlaps or reduce individual multipliers.

---

## Advanced: durationHours

**Optional feature** to expire buffs after N hours instead of full day(s).

### When to Use

- **Time-limited flash sales** (48-hour events)
- **Hourly promotions** (midnight launches)
- **Precise control** over buff windows

### How It Works

Without `durationHours`:
- Buff active for entire day(s) matching `dateRule`
- Example: `specificDate: '2025-12-31'` → active all day Dec 31

With `durationHours`:
- Buff starts at 00:00 of matched date
- Expires after N hours
- Example: `durationHours: 12` → active 00:00-12:00 only

### Configuration

\`\`\`typescript
{
  dateRule: { type: 'specificDate', date: '2025-11-28' },
  durationHours: 48  // Active Nov 28 00:00 - Nov 29 23:59 (48 hours)
}
\`\`\`

### Start Time Rules

| Rule Type | Buff Start Time |
|-----------|-----------------|
| specificDate | Specified date at 00:00 |
| dateRange | startDate at 00:00 |
| dayOfWeek | Matched day at 00:00 |
| monthDay | Matched day at 00:00 |
| cycle | Matched day at 00:00 |

**Example:**

\`\`\`typescript
{
  dateRule: { type: 'dayOfWeek', days: [5] },  // Friday
  durationHours: 36  // Friday 00:00 - Saturday 11:59
}
\`\`\`

### Alternative: Use dateRange Instead

For most cases, explicit `dateRange` is clearer than `durationHours`:

\`\`\`typescript
// AVOID: specificDate + durationHours
{
  dateRule: { type: 'specificDate', date: '2025-11-28' },
  durationHours: 48
}

// PREFER: Explicit dateRange
{
  dateRule: {
    type: 'dateRange',
    startDate: '2025-11-28',
    endDate: '2025-11-29'
  }
}
\`\`\`

---

## Common Patterns & Templates

### Pattern 1: Weekend Boost

\`\`\`typescript
{
  id: 'weekend_warrior',
  title: 'Weekend Warrior',
  description: '+25% XP on weekends',
  emoji: '💪',
  xpMultiplier: 1.25,
  dateRule: {
    type: 'dayOfWeek',
    days: [0, 6]  // Saturday & Sunday
  }
}
\`\`\`

### Pattern 2: Holiday Week

\`\`\`typescript
{
  id: 'christmas_2025',
  title: 'Christmas Week',
  description: 'Double XP - Happy Holidays!',
  emoji: '🎄',
  xpMultiplier: 2.0,
  dateRule: {
    type: 'dateRange',
    startDate: '2025-12-22',
    endDate: '2025-12-28',
    yearlyRecur: true  // Repeats every year
  }
}
\`\`\`

### Pattern 3: Exam Season

\`\`\`typescript
{
  id: 'finals_fall_2025',
  title: 'Finals Week Focus',
  description: '+75% XP - You got this!',
  emoji: '📚',
  xpMultiplier: 1.75,
  dateRule: {
    type: 'dateRange',
    startDate: '2025-12-10',
    endDate: '2025-12-20',
    yearlyRecur: false  // One-time event
  }
}
\`\`\`

### Pattern 4: Monthly Power Week

\`\`\`typescript
{
  id: 'first_week_boost',
  title: 'Month Kickstart',
  description: '+30% XP - First week of every month',
  emoji: '🚀',
  xpMultiplier: 1.3,
  dateRule: {
    type: 'cycle',
    startDate: '2025-11-01',
    intervalDays: 30,   // ~Monthly
    durationDays: 7     // First 7 days
  }
}
\`\`\`

### Pattern 5: Yearly Birthday

\`\`\`typescript
{
  id: 'founders_birthday',
  title: 'Founder's Birthday',
  description: '+50% XP - Happy birthday!',
  emoji: '🎂',
  xpMultiplier: 1.5,
  dateRule: {
    type: 'monthDay',
    month: 7,
    day: 15,
    daysAround: 0  // Single day only
  }
}
\`\`\`

---

## Troubleshooting

### Buff Not Activating

**Check 1: Date Rule Matches Today**

Test in browser console:
\`\`\`javascript
import { isBuffActiveOnDate } from './src/config/buffActivationRules';
import { EVENT_BUFFS } from './src/data/eventBuffsData';

const buff = EVENT_BUFFS.find(b => b.id === 'your_buff_id');
const today = new Date();
console.log(isBuffActiveOnDate(buff, today));  // Should return true
\`\`\`

**Check 2: Date Format Correct**

✅ Correct: `'2025-12-31'` (YYYY-MM-DD)
❌ Wrong: `'12/31/2025'`, `'31-12-2025'`

**Check 3: yearlyRecur for Yearly Events**

\`\`\`typescript
// ❌ Won't work in 2026
{ type: 'dateRange', startDate: '2025-12-25', endDate: '2025-12-28' }

// ✅ Works every year
{ type: 'dateRange', startDate: '2025-12-25', endDate: '2025-12-28', yearlyRecur: true }
\`\`\`

**Check 4: daysAround Math**

\`\`\`typescript
// daysAround: 3 on day 14 = days 11-17 (7 days total)
{ month: 2, day: 14, daysAround: 3 }  // Feb 11-17

// For full month Dec (31 days), use:
{ month: 12, day: 16, daysAround: 15 }  // Dec 1-31
\`\`\`

### Buff Icon Not Showing

**Check:** Icon displayed in `LevelDisplay` component (top-left area)

**Verify:**
1. Buff is active (see Check 1 above)
2. Browser dev tools: Check `useActiveEventBuffs()` hook returns buff
3. Console logs: `[XP] Event buffs active: ...`

### XP Not Doubling

**Check:** Stacking vs expected behavior

\`\`\`typescript
// If Weekend (1.25x) + Holiday (1.5x) both active:
Expected: 1.25 × 1.5 = 1.875x (NOT 2.75x)

// XP calculation:
100 base XP × 1.875 = 187.5 → 187 XP (rounds down)
\`\`\`

**Verify:**
1. Complete a pomodoro
2. Check console: `[XP] Event buffs active: Weekend Warrior (x1.25), ...`
3. Check final XP: `[XP] XP gained: 187`

---

## Code Reference

### Files

| File | Purpose |
|------|---------|
| `/src/data/eventBuffsData.ts` | Main config file - edit buffs here |
| `/src/config/buffActivationRules.ts` | Date evaluation logic |
| `/src/types/index.ts` | TypeScript type definitions |
| `/src/hooks/useActiveEventBuffs.ts` | React hook (auto-refreshes) |
| `/src/components/level/LevelDisplay.tsx` | Buff icons UI |
| `/src/store/useSettingsStore.ts` | XP calculation with buffs |

### Helper Functions

\`\`\`typescript
// Get all active buffs on given date
getActiveBuffs(date?: Date): EventBuff[]

// Get total XP multiplier from active buffs
getStackedMultiplier(date?: Date): number

// Check if specific buff is active
isBuffActiveOnDate(buff: EventBuff, date?: Date): boolean

// Find buff by ID
getBuffById(buffId: string): EventBuff | undefined
\`\`\`

### React Hook

\`\`\`typescript
import { useActiveEventBuffs } from '@/hooks/useActiveEventBuffs';

function MyComponent() {
  const { activeBuffs, totalMultiplier } = useActiveEventBuffs();

  return (
    <div>
      Active buffs: {activeBuffs.length}
      Total XP boost: {((totalMultiplier - 1) * 100).toFixed(0)}%
    </div>
  );
}
\`\`\`

---

## Need Help?

- **Bug reports:** [GitHub Issues](https://github.com/study-saga/pomodoro-staging/issues)
- **Questions:** Check existing buffs in `eventBuffsData.ts` for examples
- **Advanced scenarios:** Review `buffActivationRules.ts` for date logic

**Happy buffing! 🚀**
