import { test, expect } from '@playwright/test';

test('unauthenticated user sees login screen', async ({ page }) => {
    await page.goto('/');

    // Should see the App Title
    await expect(page.getByText('Pomodoro Lofi')).toBeVisible();

    // Should see "Sign in with Discord" button
    await expect(page.getByRole('button', { name: /Sign in with Discord/i })).toBeVisible();

    // Should NOT see the Timer (which has "Start" button)
    await expect(page.getByRole('button', { name: 'Start' })).not.toBeVisible();
});
