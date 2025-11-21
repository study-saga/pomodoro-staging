/**
 * Changelog / What's New
 *
 * Add new updates at the TOP of the array to push older entries down.
 * Each update should have:
 * - date: ISO date string (YYYY-MM-DD)
 * - title: Short title of the update
 * - description: Brief description of what changed
 * - tags: Array of tag types ('feature' | 'improvement' | 'fix')
 */

export interface ChangelogEntry {
  date: string;
  title: string;
  description: string;
  tags: Array<'feature' | 'improvement' | 'fix'>;
}

export const changelog: ChangelogEntry[] = [
  // ⬇️ ADD NEW UPDATES HERE (most recent first) ⬇️
  {
    date: '2025-11-21',
    title: 'Settings Redesign',
    description: 'Complete redesign of Settings with professional animations matching User Info style. Now uses modern popover on desktop and centered modal on mobile for a more polished experience.',
    tags: ['improvement'],
  },
  {
    date: '2025-11-21',
    title: "What's New Integration",
    description: "What's New has been integrated into Settings as the 6th tab, making all app features accessible from one place. View the latest updates and features directly in Settings.",
    tags: ['feature'],
  },
  {
    date: '2025-11-21',
    title: 'UI Improvements',
    description: 'Fixed z-index layering issues, added horizontal scrolling for Settings tabs, and improved content scrolling for better mobile and desktop experience.',
    tags: ['fix'],
  },
  {
    date: '2025-11-18',
    title: 'Music Player',
    description: 'Improved the music player for better design on PC and Mobiles.',
    tags: ['improvement'],
  },
  {
    date: '2025-11-18',
    title: 'Browser Notifications',
    description: 'Get notified when your timer completes, even when the tab is not in focus. Enable in Settings → General tab.',
    tags: ['feature'],
  },
  {
    date: '2025-11-18',
    title: 'User Settings Sync',
    description: 'All your settings, progress, and preferences now sync seamlessly across all your devices.',
    tags: ['feature'],
  },
  {
    date: '2025-11-17',
    title: 'Discord Authentication Integration',
    description: 'Sign in with Discord to save your progress and access your account from anywhere.',
    tags: ['feature'],
  },
  {
    date: '2025-11-17',
    title: 'XP & Leveling System',
    description: 'Earn XP for every minute studied. Level up to unlock new badges and achievements. Choose between Elf or Human paths.',
    tags: ['feature'],
  },
  {
    date: '2025-11-16',
    title: 'Multiple Background Options',
    description: 'Choose from 6 beautiful video backgrounds to customize your study environment (3 for PC 3 for Mobiles).',
    tags: ['feature'],
  },
  {
    date: '2025-11-16',
    title: 'Device-Adaptive Backgrounds',
    description: 'Backgrounds automatically adjust for mobile (vertical) and desktop (horizontal) devices.',
    tags: ['improvement'],
  },
  {
    date: '2025-11-15',
    title: 'Music Playlist Selection',
    description: 'Switch between Lofi and Synthwave playlists to match your study mood by clicking the (Lofi or Synthwave) text in the music player.',
    tags: ['feature'],
  },
  {
    date: '2025-11-15',
    title: 'Ambient Sound Mixer',
    description: 'Mix up to 9 ambient sounds (rain, forest, ocean, etc.) with independent volume controls.',
    tags: ['feature'],
  },
  {
    date: '2025-11-14',
    title: 'Keyboard Shortcuts',
    description: 'Use Space to start/pause and R to reset your timer for faster workflow.',
    tags: ['improvement'],
  },
  {
    date: '2025-11-14',
    title: 'Auto-Start Timers',
    description: 'Enable auto-start for breaks and pomodoros to keep your flow uninterrupted.',
    tags: ['feature'],
  },
  {
    date: '2025-11-13',
    title: 'Custom Timer Durations',
    description: 'Set any duration in minutes for pomodoros, short breaks, and long breaks.',
    tags: ['feature'],
  }
  // ⬆️ ADD NEW UPDATES ABOVE THIS LINE ⬆️
];
