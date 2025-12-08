import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { DailyGiftGrid } from '../DailyGiftGrid';
import * as AuthContextModule from '../../../contexts/AuthContext';
import * as userSyncAuthModule from '../../../lib/userSyncAuth';

// Mock Setting Store using vi.hoisted
const { mockUseSettingsStore, storeState } = vi.hoisted(() => {
    const defaultStore = {
        userId: 'user-1',
        consecutiveLoginDays: 5,
        lastDailyGiftDate: '2025-01-01', // Example date
        xp: 100,
        addDailyGiftXP: vi.fn(),
        markDailyGiftClaimed: vi.fn(),
        settingsSyncComplete: true
    };

    // We use a simple object acting as a singleton state container for the mock
    const container = { state: { ...defaultStore } };

    const mock = vi.fn((selector) => {
        return selector ? selector(container.state) : container.state;
    });

    (mock as any).getState = vi.fn(() => container.state);
    (mock as any).setState = vi.fn((updates) => {
        container.state = { ...container.state, ...updates };
    });

    return { mockUseSettingsStore: mock, storeState: container };
});

vi.mock('../../../store/useSettingsStore', () => ({
    useSettingsStore: mockUseSettingsStore
}));

// Mock userSyncAuth
vi.mock('../../../lib/userSyncAuth', () => ({
    claimDailyGift: vi.fn().mockResolvedValue({ success: true, xpAwarded: 50 })
}));

// Mock Auth Context
vi.mock('../../../contexts/AuthContext', () => ({
    useAuth: vi.fn()
}));

// Mock userSyncAuth
vi.mock('../../../lib/userSyncAuth', () => ({
    claimDailyGift: vi.fn().mockResolvedValue({ success: true, xpAwarded: 50 })
}));

// Mock Auth Context
vi.mock('../../../contexts/AuthContext', () => ({
    useAuth: vi.fn()
}));

describe('DailyGiftGrid', () => {
    const defaultStore = {
        userId: 'user-1',
        consecutiveLoginDays: 5,
        lastDailyGiftDate: '2025-01-01', // Example date
        xp: 100,
        addDailyGiftXP: vi.fn(),
        markDailyGiftClaimed: vi.fn(),
        settingsSyncComplete: true
    };

    const mockUser = { id: 'user-1' };

    beforeEach(() => {
        vi.clearAllMocks();
        (AuthContextModule.useAuth as any).mockReturnValue({ appUser: mockUser });
        mockUseSettingsStore.mockImplementation((selector: any) => selector(defaultStore));
    });

    it('renders all 12 gift days', () => {
        render(<DailyGiftGrid show={true} onClose={vi.fn()} />);

        // Should see Day 1 to Day 12 (rendered as just numbers)
        expect(screen.getByText('1')).toBeInTheDocument();
        expect(screen.getByText('12')).toBeInTheDocument();
    });

    it('shows claimed state for past days', () => {
        render(<DailyGiftGrid show={true} onClose={vi.fn()} />);

        // Day 1-4 should be claimed (consecutive 5)
        // Find the element for day 1
        const dayNumber = screen.getByText('1');
        // The checkmark indicates claimed state
        // We can check if the checkmark exists in the same card
        const card = dayNumber.parentElement;
        const checkmark = screen.getAllByText('✓')[0]; // There should be multiple checks

        expect(card).toContainElement(checkmark);
    });

    it('auto-claims the current day gift on mount', async () => {
        const today = new Date().toISOString().split('T')[0];
        const storeWithUnclaimed = {
            ...defaultStore,
            lastDailyGiftDate: '2020-01-01', // Old date
            consecutiveLoginDays: 5
        };
        // Update mock state
        storeState.state = storeWithUnclaimed;

        vi.useFakeTimers();
        render(<DailyGiftGrid show={true} onClose={vi.fn()} />);

        // Wait for 500ms delay in checkAndClaimGift
        await act(async () => {
            vi.advanceTimersByTime(500);
        });

        expect(userSyncAuthModule.claimDailyGift).toHaveBeenCalled();
    });
});
