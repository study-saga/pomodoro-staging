
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useChatNotifications } from '../useChatNotifications';
import { useLevelNotifications } from '../useLevelNotifications';
import * as SettingsStoreModule from '../../store/useSettingsStore';

// Mock Notification API
const mockNotification = vi.fn();
const mockRequestPermission = vi.fn();

// Mock GameToast
const mockShowGameToast = vi.fn();
vi.mock('../../components/ui/GameToast', () => ({
    showGameToast: (msg: string) => mockShowGameToast(msg)
}));

describe('Notifications Hooks', () => {

    beforeEach(() => {
        vi.clearAllMocks();

        // Mock window.Notification
        Object.defineProperty(window, 'Notification', {
            writable: true,
            value: class {
                static requestPermission = mockRequestPermission;
                static permission = 'default';
                constructor(title: string, options: any) {
                    mockNotification(title, options);
                }
            }
        });
    });

    afterEach(() => {
        // Cleanup if needed
    });

    describe('useChatNotifications', () => {
        it('requests permission correctly', async () => {
            mockRequestPermission.mockResolvedValue('granted');
            const { result } = renderHook(() => useChatNotifications());

            await act(async () => {
                const permission = await result.current.requestPermission();
                expect(permission).toBe('granted');
            });

            expect(mockRequestPermission).toHaveBeenCalled();
        });

        it('shows notification if granted', () => {
            // Force permission granted
            Object.defineProperty(window.Notification, 'permission', { value: 'granted', writable: true });

            const { result } = renderHook(() => useChatNotifications());

            // Need to update local state logic? useChatNotifications initializes from Notification.permission on mount.
            // But we mocked it after mount potentially if we are not careful.
            // Let's remount or assume initial state picks it up.

            act(() => {
                result.current.showNotification('Test Title', 'Test Body');
            });

            expect(mockNotification).toHaveBeenCalledWith('Test Title', expect.objectContaining({
                body: 'Test Body'
            }));
        });
    });


    describe('useLevelNotifications', () => {
        it('shows toast on XP gain', async () => {
            // Mock the store implementation for this test
            let currentState = { level: 1, xp: 100, levelPath: 'human' };

            vi.spyOn(SettingsStoreModule, 'useSettingsStore').mockImplementation((selector: any) => {
                return selector(currentState);
            });

            const { result, rerender } = renderHook(() => useLevelNotifications());

            // First render initializes refs.

            // Act: Increase XP
            currentState = { ...currentState, xp: 150 };
            rerender();

            // Should show toast
            expect(mockShowGameToast).toHaveBeenCalledWith(expect.stringContaining('+50 XP'));
        });

        it('triggers level up modal state on level increase', () => {
            let currentState = { level: 1, xp: 50, levelPath: 'human' };
            vi.spyOn(SettingsStoreModule, 'useSettingsStore').mockImplementation((selector: any) => {
                return selector(currentState);
            });

            const { result, rerender } = renderHook(() => useLevelNotifications());

            // Act: Level Up
            currentState = { ...currentState, level: 2 };
            rerender();

            expect(result.current.showLevelUp).toBe(true);
            expect(result.current.levelUpData.level).toBe(2);
        });
    });
});
