
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UserStatsModal } from '../UserStatsModal';
import * as SettingsStoreModule from '../../../store/useSettingsStore';

// Mock Dependencies
vi.mock('../../../lib/dateUtils', () => ({
    calculateDaysSinceDate: vi.fn(() => ({
        daysSince: 10,
        formattedDate: 'Jan 1, 2025'
    }))
}));

vi.mock('../../../utils/rateLimiters', () => ({
    createRateLimiter: vi.fn(() => (fn: Function) => fn),
    rateLimitedToast: vi.fn()
}));

const mockSetLevelPath = vi.fn();

const defaultStore = {
    level: 5,
    levelPath: 'elf', // 'elf' or 'human'
    setLevelPath: mockSetLevelPath,
    prestigeStars: [],
    totalPomodoros: 100,
    totalStudyMinutes: 2500, // ~41h 40m
    totalUniqueDays: 10,
    consecutiveLoginDays: 3,
    pomodoroBoostActive: false,
    pomodoroBoostExpiresAt: null,
    pomodoroBoostMultiplier: 1,
    firstLoginDate: '2025-01-01',
};

vi.mock('../../../store/useSettingsStore', () => ({
    useSettingsStore: (selector: any) => selector ? selector(defaultStore) : defaultStore
}));

describe('UserStatsModal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders user stats correctly', () => {
        render(<UserStatsModal onClose={vi.fn()} />);

        // Header
        expect(screen.getByText('User Info')).toBeInTheDocument();

        // Stats
        expect(screen.getByText('Level')).toBeInTheDocument();
        expect(screen.getByText('5')).toBeInTheDocument();

        expect(screen.getByText('Pomodoros')).toBeInTheDocument();
        expect(screen.getByText('100')).toBeInTheDocument();

        // Study Time: 2500 mins = 41h 40m
        expect(screen.getByText('41h 40m')).toBeInTheDocument();

        expect(screen.getByText('Active Days')).toBeInTheDocument();
        expect(screen.getByText('10')).toBeInTheDocument();
    });

    it('handles role switching interaction', () => {
        render(<UserStatsModal onClose={vi.fn()} />);

        // Currently elf. Switch to human.
        // The input is a checkbox. Logic: checked = (levelPath === 'human')
        // So initially it is unchecked (elf).
        const checkbox = screen.getByRole('checkbox');
        expect(checkbox).not.toBeChecked(); // elf

        fireEvent.click(checkbox);

        // Should call setLevelPath('human')
        expect(mockSetLevelPath).toHaveBeenCalledWith('human');
    });

    it('renders role description correctly', () => {
        render(<UserStatsModal onClose={vi.fn()} />);
        expect(screen.getByText('Elf')).toBeInTheDocument();
        expect(screen.getByText('Consistency & Focus')).toBeInTheDocument();
    });
});
