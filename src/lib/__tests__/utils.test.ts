import { describe, it, expect } from 'vitest';
import { calculateDaysSinceDate } from '../dateUtils';
import { cn } from '../utils';

describe('utils.ts', () => {
    it('cn: merges class names correctly', () => {
        expect(cn('bg-red-500', 'text-white')).toBe('bg-red-500 text-white');
    });

    it('cn: handles conditional classes', () => {
        expect(cn('bg-red-500', false && 'text-white', 'p-4')).toBe('bg-red-500 p-4');
    });

    it('cn: merges tailwind classes correctly (overrides)', () => {
        // p-4 should override p-2
        expect(cn('p-2', 'p-4')).toBe('p-4');
    });
});

describe('dateUtils.ts', () => {
    it('calculateDaysSinceDate: handles null input', () => {
        const result = calculateDaysSinceDate(null);
        expect(result).toEqual({ daysSince: 0, formattedDate: '' });
    });

    it('calculateDaysSinceDate: calculates days correctly', () => {
        const today = new Date();
        const fiveDaysAgo = new Date(today.getTime() - (5 * 24 * 60 * 60 * 1000));
        const dateString = fiveDaysAgo.toISOString();

        const result = calculateDaysSinceDate(dateString);
        expect(result.daysSince).toBe(5);
    });

    it('calculateDaysSinceDate: formats date correctly', () => {
        // Fixed date for consistent formatting test
        const date = new Date('2023-01-15T12:00:00Z');
        const result = calculateDaysSinceDate(date.toISOString());

        // Note: This matches the 'en-US' locale format used in implementation
        expect(result.formattedDate).toBe('Jan 15, 2023');
    });
});
