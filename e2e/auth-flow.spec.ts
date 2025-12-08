import { test, expect } from '@playwright/test';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://pkxgxfjcxxshlofbliwd.supabase.co';

test('authenticated user sees dashboard', async ({ page }) => {
    // Mock Supabase Auth User endpoint
    await page.route('**/auth/v1/user', async route => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                id: 'test-user-id',
                aud: 'authenticated',
                role: 'authenticated',
                email: 'test@example.com',
                user_metadata: {
                    full_name: 'Test User',
                    avatar_url: 'https://example.com/avatar.png',
                    provider_id: '123456789'
                }
            })
        });
    });

    // Mock "users" table select (fetchOrCreateAppUser)
    await page.route('**/rest/v1/users*', async route => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                id: 'test-user-uuid',
                auth_user_id: 'test-user-id',
                username: 'Test User',
                level: 5,
                xp: 1000,
                settings: {}
            })
        });
    });

    // Mock "completed_pomodoros" select (getRecentPomodoros)
    await page.route('**/rest/v1/completed_pomodoros*', async route => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([])
        });
    });

    // Mock "user_unlocked_rewards"
    await page.route('**/rpc/get_user_unlocked_rewards', async route => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([])
        });
    });

    // Mock "sync_discord_user_data"
    await page.route('**/rpc/sync_discord_user_data', async route => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                id: 'test-user-uuid',
                username: 'Test User'
            })
        });
    });

    // Set fake session in localStorage to trigger "authenticated" state in Supabase client
    // The key format is usually `sb-<project-ref>-auth-token`
    // We need the project ref from the URL
    const projectRef = SUPABASE_URL.match(/https:\/\/([^.]+)\./)?.[1];
    const storageKey = `sb-${projectRef}-auth-token`;

    await page.addInitScript(({ key }) => {
        window.localStorage.setItem(key, JSON.stringify({
            access_token: 'fake-access-token',
            refresh_token: 'fake-refresh-token',
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            expires_in: 3600,
            token_type: 'bearer',
            user: {
                id: 'test-user-id',
                aud: 'authenticated',
                role: 'authenticated',
                email: 'test@example.com',
                user_metadata: {
                    full_name: 'Test User',
                    avatar_url: 'https://example.com/avatar.png',
                    provider_id: '123456789'
                }
            }
        }));
    }, { key: storageKey });

    await page.goto('/');

    // Check for loading screen disappearance
    await expect(page.getByText('Connecting to Discord...')).not.toBeVisible({ timeout: 10000 });

    // Check for auth error
    await expect(page.getByText('Authentication Failed')).not.toBeVisible();

    // Should NOT see "Sign in"
    await expect(page.getByRole('button', { name: /Sign in with Discord/i })).not.toBeVisible();

    // Should see the Timer (Start button) - Allow more time for mobile hydration
    await expect(page.getByText('Start')).toBeVisible({ timeout: 10000 });

    // Should see the Reset button
    await expect(page.getByText('Reset')).toBeVisible();
});
