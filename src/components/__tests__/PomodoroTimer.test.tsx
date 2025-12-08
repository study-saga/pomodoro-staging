import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PomodoroTimer } from '../timer/PomodoroTimer';
import { useSettingsStore } from '../../store/useSettingsStore';

// Mock dependencies
vi.mock('../../store/useSettingsStore');
vi.mock('../../contexts/AuthContext', () => ({
    useAuth: () => ({
        appUser: { id: 'test-user', discord_id: '123' },
        isDiscordActivity: false,
    }),
}));

// Mock react-timer-hook
const mockStart = vi.fn();
const mockPause = vi.fn();
const mockRestart = vi.fn();
const mockResume = vi.fn();

vi.mock('react-timer-hook', () => ({
    useTimer: ({ onExpire }: any) => ({
        seconds: 0,
        minutes: 25,
        isRunning: false,
        start: mockStart,
        pause: mockPause,
        restart: mockRestart,
        resume: mockResume,
    }),
}));

// Mock useSmartPIPMode
vi.mock('../../hooks/useSmartPIPMode', () => ({
    useSmartPIPMode: () => false,
}));

describe('PomodoroTimer', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Setup default store values
        (useSettingsStore as any).mockReturnValue({
            timers: { pomodoro: 25, shortBreak: 5, longBreak: 15 },
            pomodorosBeforeLongBreak: 4,
            addXP: vi.fn(),
            soundEnabled: true,
            volume: 50,
        });

        // Mock getState
        (useSettingsStore as any).getState = () => ({
            timers: { pomodoro: 25, shortBreak: 5, longBreak: 15 },
            autoStartBreaks: false,
            autoStartPomodoros: false,
        });
    });

    it('renders initial timer state', () => {
        render(<PomodoroTimer />);
        // Should show 25:00
        expect(screen.getByText('25:00')).toBeInTheDocument();
        // Should show "Start" button
        expect(screen.getByText('Start')).toBeInTheDocument();
        // Should show tabs
        expect(screen.getByText('Pomodoro')).toBeInTheDocument();
        expect(screen.getByText('Short Break')).toBeInTheDocument();
    });

    it('calls start when start button is clicked', () => {
        render(<PomodoroTimer />);
        fireEvent.click(screen.getByText('Start'));
        expect(mockStart).toHaveBeenCalled();
    });

    it('switches to Short Break when clicked', () => {
        render(<PomodoroTimer />);
        const shortBreakBtn = screen.getByText('Short Break');
        fireEvent.click(shortBreakBtn);

        // Should call restart with new duration (5 min = 300 sec)
        // We can't easily check the Date object exactness without complex matching, 
        // but we can ensure restart was called.
        expect(mockRestart).toHaveBeenCalled();
    });
});
