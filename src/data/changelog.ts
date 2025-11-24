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
    date: '2025-11-24',
    title: 'Role Paths Added',
    description: 'Choose between Human and Elf paths, each with unique buffs: Human gets 25% crit chance for 2x XP, Elf gets +0.5 XP per minute.',
    tags: ['feature'],
  },
  {
    date: '2025-11-24',
    title: 'Stats Dashboard',
    description: 'New stats modal showing level, XP, pomodoros completed, study time, streak, and Discord avatar.',
    tags: ['feature'],
  },
  {
    date: '2025-11-24',
    title: 'Daily Gifts',
    description: 'Daily rewards calendar with XP boost multipliers and bonuses.',
    tags: ['feature'],
  },
  {
    date: '2025-11-24',
    title: 'Enhanced Buff System',
    description: 'Custom buff icons, hover tooltips (desktop) and tap interactions (mobile), always visible.',
    tags: ['feature'],
  },
  {
    date: '2025-11-24',
    title: 'Settings Redesign (What\'s New Tab)',
    description: 'New "What\'s New" tab in Settings, redesigned progress tab, improved mobile experience.',
    tags: ['feature'],
  },
  {
    date: '2025-11-24',
    title: 'Level‑Up Celebrations',
    description: 'Glowing XP bar animation, confetti explosions, mobile‑optimized effects.',
    tags: ['feature'],
  },
  {
    date: '2025-11-21',
    title: 'Settings Redesign',
    description: 'We\'ve completely revamped the Settings menu! Enjoy a sleek new look with smooth animations and a more user-friendly layout that adapts beautifully to both desktop and mobile devices.',
    tags: ['improvement'],
  },
  {
    date: '2025-11-21',
    title: "What's New Section in Settings",
    description: 'Our new \'What\'s New\' section is now built right into the Settings menu, making it easier to discover the latest features and updates.',
    tags: ['feature'],
  },
  {
    date: '2025-11-21',
    title: 'UI Improvements',
    description: 'We\'ve made several visual improvements, including better layering for pop-up menus and smoother scrolling, especially on mobile devices.',
    tags: ['fix'],
  },
  {
    date: '2025-11-18',
    title: 'Music Player Enhancements',
    description: 'The music player has been updated with a fresh, improved design for both desktop and mobile.',
    tags: ['improvement'],
  },
  {
    date: '2025-11-18',
    title: 'Desktop Notifications',
    description: 'Now you can get notifications right on your computer when your timer finishes, even if you\'re not on the app. Turn them on in the General settings.',
    tags: ['feature'],
  },
  {
    date: '2025-11-18',
    title: 'Seamless Settings Sync',
    description: 'All your settings, progress, and preferences now sync seamlessly across all your devices.',
    tags: ['feature'],
  },
  {
    date: '2025-11-17',
    title: 'Discord Login',
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
    title: 'Smart Backgrounds',
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