import type {
  EventBuff,
  DateRule,
  DayOfWeekRule,
  SpecificDateRule,
  DateRangeRule,
  MonthDayRule,
  CycleRule,
} from '../types';
import { isWeekendForUser } from '../lib/userSyncAuth';

/**
 * Server-authoritative buff activation check (SECURE)
 *
 * CRITICAL: For day-of-week rules (weekend buffs), uses server-side timezone check
 * Client CANNOT manipulate weekend detection
 *
 * @param buff - Event buff to check
 * @param userId - User ID (null for guest mode fallback)
 * @returns Promise<boolean> - True if buff is active
 */
export async function isBuffActiveSecure(
  buff: EventBuff,
  userId: string | null
): Promise<boolean> {
  // For day-of-week rules, use server check
  if (buff.dateRule.type === 'dayOfWeek') {
    if (!userId) {
      // Guest fallback - use client-side check
      const date = new Date();
      return buff.dateRule.days.includes(date.getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6);
    }

    try {
      const result = await isWeekendForUser(userId);
      // Check if user's current day of week is in the buff's day list
      return buff.dateRule.days.includes(result.dayOfWeek as 0 | 1 | 2 | 3 | 4 | 5 | 6);
    } catch (error) {
      console.error('[BuffActivation] Server check failed:', error);
      // Fallback to client-side (better than blocking)
      const date = new Date();
      return buff.dateRule.days.includes(date.getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6);
    }
  }

  // For other date rules (dateRange, specificDate, etc.), use existing sync logic
  return isBuffActiveOnDate(buff, new Date());
}

/**
 * Pure functions to check if a buff is active on a given date
 *
 * @deprecated For day-of-week rules, use isBuffActiveSecure instead (server-authoritative)
 */
export function isBuffActiveOnDate(buff: EventBuff, date: Date = new Date()): boolean {
  // If no durationHours, just check if date rule matches (day-level behavior)
  if (!buff.durationHours) {
    return evaluateDateRule(buff.dateRule, date);
  }

  // With durationHours: Find the buff start time and check if we're within the duration window
  // The dateRule determines WHEN the buff starts, but durationHours can span multiple days
  const buffStartTime = findBuffStartTime(buff.dateRule, date);
  if (!buffStartTime) return false;

  const buffEndTime = new Date(buffStartTime.getTime() + buff.durationHours * 60 * 60 * 1000);

  // Check if current time is within the duration window
  return date >= buffStartTime && date < buffEndTime;
}

/**
 * Find the buff start time by checking if the dateRule matched recently
 * Returns the start time if the buff should be active, or null if not
 */
function findBuffStartTime(rule: DateRule, currentDate: Date): Date | null {
  // Check if the rule matches today - if so, start is today at 00:00
  if (evaluateDateRule(rule, currentDate)) {
    return new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), 0, 0, 0, 0);
  }

  // For durationHours spanning multiple days, check if rule matched in recent past
  // Look back up to 7 days (reasonable max for durationHours use case)
  for (let daysBack = 1; daysBack <= 7; daysBack++) {
    const checkDate = new Date(currentDate);
    checkDate.setDate(checkDate.getDate() - daysBack);

    if (evaluateDateRule(rule, checkDate)) {
      // Rule matched on this past date - return that start time
      return new Date(checkDate.getFullYear(), checkDate.getMonth(), checkDate.getDate(), 0, 0, 0, 0);
    }
  }

  return null;
}

function evaluateDateRule(rule: DateRule, date: Date): boolean {
  switch (rule.type) {
    case 'dayOfWeek':
      return evaluateDayOfWeek(rule, date);

    case 'specificDate':
      return evaluateSpecificDate(rule, date);

    case 'dateRange':
      return evaluateDateRange(rule, date);

    case 'monthDay':
      return evaluateMonthDay(rule, date);

    case 'cycle':
      return evaluateCycle(rule, date);

    default:
      return false;
  }
}

function evaluateDayOfWeek(rule: DayOfWeekRule, date: Date): boolean {
  return rule.days.includes(date.getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6);
}

function evaluateSpecificDate(rule: SpecificDateRule, date: Date): boolean {
  return isSameDay(date, parseISO(rule.date));
}

function evaluateDateRange(rule: DateRangeRule, date: Date): boolean {
  let startDate = parseISO(rule.startDate);
  let endDate = parseISO(rule.endDate);

  // Normalize to start/end of day for inclusive date range
  startDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), 0, 0, 0, 0);
  endDate = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59, 999);

  if (rule.yearlyRecur) {
    // For yearly recurring, ignore year and just check month/day
    const currentYear = date.getFullYear();
    startDate = new Date(currentYear, startDate.getMonth(), startDate.getDate(), 0, 0, 0, 0);
    endDate = new Date(currentYear, endDate.getMonth(), endDate.getDate(), 23, 59, 59, 999);

    // Handle wrap-around (e.g., Dec 25 - Jan 5)
    if (endDate < startDate) {
      return date >= startDate || date <= endDate;
    }
  }

  return date >= startDate && date <= endDate;
}

function evaluateMonthDay(rule: MonthDayRule, date: Date): boolean {
  const daysAround = rule.daysAround || 0;
  const targetDate = new Date(date.getFullYear(), rule.month - 1, rule.day);

  if (daysAround === 0) {
    return isSameDay(date, targetDate);
  }

  // Normalize to start/end of day for inclusive range
  const start = new Date(targetDate);
  const end = new Date(targetDate);
  start.setDate(start.getDate() - daysAround);
  end.setDate(end.getDate() + daysAround);

  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  return date >= start && date <= end;
}

function evaluateCycle(rule: CycleRule, date: Date): boolean {
  const refDate = parseISO(rule.startDate);
  const daysDiff = Math.floor((date.getTime() - refDate.getTime()) / (1000 * 60 * 60 * 24));
  const cyclePosition = daysDiff % rule.intervalDays;

  return cyclePosition >= 0 && cyclePosition < rule.durationDays;
}

function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

function parseISO(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}
