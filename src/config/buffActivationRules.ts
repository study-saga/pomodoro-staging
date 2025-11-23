import type {
  EventBuff,
  DateRule,
  DayOfWeekRule,
  SpecificDateRule,
  DateRangeRule,
  MonthDayRule,
  CycleRule,
} from '../types';

/**
 * Pure functions to check if a buff is active on a given date
 */
export function isBuffActiveOnDate(buff: EventBuff, date: Date = new Date()): boolean {
  // First check if the date rule matches
  const ruleMatches = evaluateDateRule(buff.dateRule, date);
  if (!ruleMatches) return false;

  // If no durationHours specified, use day-level behavior
  if (!buff.durationHours) return true;

  // Calculate buff start time based on rule type
  const buffStartTime = getBuffStartTime(buff.dateRule, date);
  const buffEndTime = new Date(buffStartTime.getTime() + buff.durationHours * 60 * 60 * 1000);

  // Check if current time is within duration window
  return date >= buffStartTime && date < buffEndTime;
}

/**
 * Get buff start time based on rule type
 * Returns the datetime when the buff becomes active
 */
function getBuffStartTime(rule: DateRule, currentDate: Date): Date {
  switch (rule.type) {
    case 'specificDate': {
      const ruleDate = parseISO(rule.date);
      return new Date(ruleDate.getFullYear(), ruleDate.getMonth(), ruleDate.getDate(), 0, 0, 0, 0);
    }

    case 'dateRange': {
      const startDate = parseISO(rule.startDate);
      return new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), 0, 0, 0, 0);
    }

    case 'dayOfWeek':
    case 'monthDay':
    case 'cycle':
    default: {
      // For recurring rules, use the current matched day at 00:00
      return new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), 0, 0, 0, 0);
    }
  }
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

  if (rule.yearlyRecur) {
    // For yearly recurring, ignore year and just check month/day
    const currentYear = date.getFullYear();
    startDate = new Date(currentYear, startDate.getMonth(), startDate.getDate());
    endDate = new Date(currentYear, endDate.getMonth(), endDate.getDate());

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

  const start = new Date(targetDate);
  const end = new Date(targetDate);
  start.setDate(start.getDate() - daysAround);
  end.setDate(end.getDate() + daysAround);

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
