
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { SettingsPopover } from '../SettingsPopover';
import * as SettingsStoreModule from '../../../store/useSettingsStore';
import * as AuthContextModule from '../../../contexts/AuthContext';

// Mock child components
vi.mock('../SettingsContent', () => ({
    SettingsContent: ({ setTempVolume, tempVolume }: any) => (
        <div data-testid="settings-content">
            <p>Current Mock Volume: {tempVolume}</p>
            <button onClick={() => setTempVolume(0.9)}>Change Volume</button>
        </div>
    )
}));

// Mock Hooks
vi.mock('../../../hooks/useMouseActivity', () => ({
    useMouseActivity: () => true
}));

vi.mock('../../../hooks/useDeviceType', () => ({
    useDeviceType: () => ({ isMobile: false, isPortrait: false })
}));

// Mock Store
const mockSetVolume = vi.fn();
const mockSetOpen = vi.fn(); // Though open is local state in Popover usually?
// SettingsPopover uses local state for open, but some store methods might be called.

const defaultStore = {
    timers: { pomodoro: 25, shortBreak: 5, longBreak: 15 },
    pomodorosBeforeLongBreak: 4,
    autoStartBreaks: false,
    autoStartPomodoros: false,
    soundEnabled: true,
    volume: 0.5,
    musicVolume: 0.5,
    ambientVolumes: {},
    background: 'room-video',
    autoHideUI: false,
    levelSystemEnabled: true,
    playlist: 'lofi',

    // Setters
    setPomodoroDuration: vi.fn(),
    setShortBreakDuration: vi.fn(),
    setLongBreakDuration: vi.fn(),
    setPomodorosBeforeLongBreak: vi.fn(),
    setAutoStartBreaks: vi.fn(),
    setAutoStartPomodoros: vi.fn(),
    setSoundEnabled: vi.fn(),
    setVolume: mockSetVolume,
    setMusicVolume: vi.fn(),
    setAmbientVolume: vi.fn(),
    setBackground: vi.fn(),
    setAutoHideUI: vi.fn(),
    setLevelSystemEnabled: vi.fn(),
    setPlaylist: vi.fn(),

    // Other used fields (add more if test crashes)
    level: 1,
    xp: 0,
    prestigeLevel: 0,
    totalPomodoros: 0,
    totalStudyMinutes: 0,
    username: 'TestUser',
    setUsername: vi.fn(),
    levelPath: 'human',
    setLevelPath: vi.fn(),
    totalUniqueDays: 1,
    consecutiveLoginDays: 1,
    firstLoginDate: '2025-01-01',
    timezone: 'UTC',
    weekendDays: [],
    resetProgress: vi.fn(),
};

vi.mock('../../../store/useSettingsStore', () => ({
    useSettingsStore: (selector: any) => selector ? selector(defaultStore) : defaultStore
}));

// Mock Auth
vi.mock('../../../contexts/AuthContext', () => ({
    useAuth: () => ({ appUser: { id: 'user-1' } })
}));

// Mock Radix UI Popover parts if necessary
// usually they work in JSDOM but might need pointer event polyfills
// For now, assume standard render.

describe('SettingsPopover', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders the trigger button', () => {
        render(<SettingsPopover />);
        expect(screen.getByLabelText('Open settings')).toBeInTheDocument();
    });

    it('opens popover on click', async () => {
        render(<SettingsPopover />);
        const trigger = screen.getByLabelText('Open settings');

        await act(async () => {
            fireEvent.click(trigger);
        });

        // Check for content
        expect(screen.getByText('Settings')).toBeInTheDocument();
        // Check tabs exist
        expect(screen.getByText('Timer')).toBeInTheDocument();
        expect(screen.getByText('Appearance')).toBeInTheDocument();

        // Check mock content
        expect(screen.getByTestId('settings-content')).toBeInTheDocument();
    });

    it('detects unsaved changes and enables Save button', async () => {
        render(<SettingsPopover />);
        const trigger = screen.getByLabelText('Open settings');
        fireEvent.click(trigger);

        const saveBtn = screen.getByText('Save').closest('button');
        expect(saveBtn).toBeDisabled();

        // Change volume via mock content button
        const changeBtn = screen.getByText('Change Volume');
        fireEvent.click(changeBtn);

        // Should now detect change (unsaved)
        expect(screen.getByText('⚠ Unsaved changes')).toBeInTheDocument();
        expect(saveBtn).not.toBeDisabled();
    });

    it('calls store setters when Save is clicked', async () => {
        render(<SettingsPopover />);
        const trigger = screen.getByLabelText('Open settings');
        fireEvent.click(trigger);

        // Change volume
        fireEvent.click(screen.getByText('Change Volume'));

        // Click Save
        const saveBtn = screen.getByText('Save');
        fireEvent.click(saveBtn);

        expect(mockSetVolume).toHaveBeenCalledWith(0.9);
    });
});
