/**
 * Lazy-loaded components for code splitting
 * Phase 2: Code Splitting Optimization
 *
 * Heavy components are split into separate chunks and loaded on demand.
 * Reduces initial bundle size significantly.
 */

import { lazy } from 'react';

// Retry helper for dynamic imports
const retryImport = <T,>(
  importFn: () => Promise<T>,
  retriesLeft = 3,
  interval = 1000
): Promise<T> => {
  return importFn().catch((error) => {
    if (retriesLeft === 0) {
      throw error;
    }
    console.log(`[Import Retry] Retrying... (${retriesLeft} attempts left)`);
    return new Promise<T>((resolve) => {
      setTimeout(() => {
        resolve(retryImport(importFn, retriesLeft - 1, interval));
      }, interval);
    });
  });
};

// Daily Gift Grid (375 lines) - Rewards calendar
export const DailyGiftGrid = lazy(() =>
  retryImport(() =>
    import('./rewards/DailyGiftGrid').then(m => ({ default: m.DailyGiftGrid }))
  )
);

// Chat Container (410 lines) - Global/team chat interface
export const ChatContainer = lazy(() =>
  retryImport(() => import('./chat/ChatContainer').then(m => ({ default: m.ChatContainer })))
);

// Music Player (511 lines) - Background music player with controls
export const MusicPlayer = lazy(() =>
  retryImport(() => import('./music/MusicPlayer').then(m => ({ default: m.MusicPlayer })))
);

// Music Credits Modal - Music attribution modal
export const MusicCreditsModal = lazy(() =>
  retryImport(() => import('./settings/MusicCreditsModal').then(m => ({ default: m.MusicCreditsModal })))
);

// Ban Modal - User ban management interface
export const BanModal = lazy(() =>
  retryImport(() => import('./chat/BanModal').then(m => ({ default: m.BanModal })))
);
