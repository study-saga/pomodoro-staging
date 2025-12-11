# Responsiveness & Scaling Todo Plan

This document tracks the progress of making the application fully responsive and scalable across all devices, with a focus on fixing High-DPI scaling issues in Discord Activities.

## Phase 1: Foundation & Scaling Logic
- [ ] **Create Scaling Hook** (`src/hooks/useScaleFactor.ts`)
    - [ ] Implement logic to distinguish Mobile vs Desktop.
    - [ ] Calculate appropriate scale factor for Desktop/Discord to prevent "super huge" UI on small/zoomed windows.
- [ ] **Implement Global Scaling Strategy**
    - [ ] Apply scaling technique (REM-based or Transform-based) in `App.tsx` or global CSS.
    - [ ] Verify that Radix UI Popovers/Dialogs inherit the scaling correctly.

## Phase 2: Component Hardening
- [ ] **Main Layout (`App.tsx`)**
    - [ ] Ensure `VideoBackground` covers the entire viewport correctly under scaling.
    - [ ] Verify `SnowOverlay` scaling.
- [ ] **Timer Component (`PomodoroTimer.tsx`)**
    - [ ] Verify `clamp()` font sizes work effectively with the new global scale.
- [ ] **Music Player (`MusicPlayer.tsx`)**
    - [ ] Ensure full-width and responsive controls on mobile vs desktop.
- [ ] **Overlays & Popovers**
    - [ ] `SettingsPopover`: Check responsiveness on small screens.
    - [ ] `DailyGiftGrid`: Ensure grid flows correctly on mobile.
    - [ ] `ChatContainer`: Verify positioning and sizing.

## Phase 3: Mobile Specifics
- [ ] **Mobile Touch Targets**: Ensure buttons are easy to tap (min 44px).
- [ ] **Stacked Layouts**: Verify that horizontal groups stack vertically on mobile (e.g., Timer controls).

## Phase 4: Verification
- [ ] Test on 1920x1080 (Standard Desktop).
- [ ] Test on 1280x720 (Simulation of Zoomed Desktop / Laptop).
- [ ] Test on 375x812 (Mobile).
- [ ] Test in Discord Activity Mock Environment (if available) or small window.
