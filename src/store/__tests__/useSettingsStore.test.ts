import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act } from '@testing-library/react';
import { useSettingsStore } from '../useSettingsStore';

// Mock dependencies
vi.mock('../../data/roleSystem', () => ({
    calculateRoleXP: () => ({ xpGained: 100, criticalSuccess: false, bonuses: [] })
}));

vi.mock('../../data/eventBuffsData', () => ({
    getActiveBuffs: () => []
}));

vi.mock('../../data/milestones', () => ({
    getMilestoneForDay: () => null
}));

// Mock persist middleware to bypass storage logic
vi.mock('zustand/middleware', () => ({
    persist: (config: any) => config,
}));

describe('useSettingsStore', () => {
    beforeEach(() => {
        // Reset store to initial state
        act(() => {
            useSettingsStore.setState({
                timers: { pomodoro: 25, shortBreak: 5, longBreak: 15 },
                soundEnabled: true,
                volume: 0.5,
                xp: 0,
                level: 1,
                consecutiveLoginDays: 1,
                levelPath: 'human'
            });
        });
    });

    it('updates timer durations', () => {
        const store = useSettingsStore.getState();

        act(() => {
            store.setPomodoroDuration(30);
            store.setShortBreakDuration(10);
            store.setLongBreakDuration(20);
        });

        const updated = useSettingsStore.getState();
        expect(updated.timers.pomodoro).toBe(30);
        expect(updated.timers.shortBreak).toBe(10);
        expect(updated.timers.longBreak).toBe(20);
    });

    it('toggles sound and volume', () => {
        const store = useSettingsStore.getState();

        act(() => {
            store.setSoundEnabled(false);
            store.setVolume(0.8);
        });

        const updated = useSettingsStore.getState();
        expect(updated.soundEnabled).toBe(false);
        expect(updated.volume).toBe(0.8);
    });

    it('adds XP correctly (triggers level up)', () => {
        const store = useSettingsStore.getState();

        act(() => {
            store.addXP(25);
        });

        const updated = useSettingsStore.getState();
        // Default mock returns 100 XP
        // 100 XP is enough to level up from 1 to 2 (cost 100)
        expect(updated.level).toBe(2);
        expect(updated.xp).toBe(0);
        expect(updated.totalStudyMinutes).toBe(25);
        expect(updated.totalPomodoros).toBe(1);
    });

    it('handles username updates', () => {
        const store = useSettingsStore.getState();

        act(() => {
            store.setUsername('NewName');
        });

        expect(useSettingsStore.getState().username).toBe('NewName');
    });

    it('tracks login streaks', () => {
        const store = useSettingsStore.getState();

        // First tracking
        const result1 = store.trackLogin();
        expect(result1.isNewDay).toBe(true);
        expect(result1.currentDay).toBe(1);

        // Same day tracking
        const result2 = store.trackLogin();
        expect(result2.isNewDay).toBe(false);
    });
});
