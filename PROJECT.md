# Pomodoro Lofi - Discord Activity

A Pomodoro timer application built as a Discord Activity, featuring study tracking, XP/leveling system, and persistent user data across devices.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Tech Stack](#tech-stack)
3. [Code Organization & Patterns](#code-organization--patterns)
4. [Architecture](#architecture)
5. [State Management Deep Dive](#state-management-deep-dive)
6. [Key Features](#key-features)
7. [Complete Component Reference](#complete-component-reference)
8. [Authentication System](#authentication-system)
9. [Dual Authentication Architecture](#dual-authentication-architecture)
10. [Database Schema](#database-schema)
11. [Security Implementation](#security-implementation)
12. [API & RPC Functions](#api--rpc-functions)
13. [Complete Utility Functions Reference](#complete-utility-functions-reference)
14. [Database RPC Functions (Complete Reference)](#database-rpc-functions-complete-reference)
15. [File Structure](#file-structure)
16. [Environment Variables](#environment-variables)
17. [Development Workflow](#development-workflow)
18. [Migration History & Architecture Decisions](#migration-history--architecture-decisions)
19. [Deployment](#deployment)
20. [Discord Activity Gotchas & Solutions](#discord-activity-gotchas--solutions)
21. [Code Examples & Workflows](#code-examples--workflows)
22. [Common Issues & Solutions](#common-issues--solutions)
23. [Performance Considerations](#performance-considerations)
24. [Future Enhancements](#future-enhancements)
25. [Contributing](#contributing)
26. [Support & Resources](#support--resources)
27. [License](#license)

---

## Project Overview

**Pomodoro Lofi** is a productivity timer application embedded as a Discord Activity (iframe). Users can:
- Run Pomodoro study sessions with customizable durations
- Earn XP and level up through consistent study
- Track statistics (total pomodoros, study time, login streaks)
- Choose between Elf and Human level paths with prestige system
- Listen to lofi background music while studying
- Authenticate with Discord OAuth to sync data across devices

**Key Differentiator**: This is NOT a standard web app - it runs inside Discord's iframe as an Activity, requiring special handling for OAuth redirects and Discord SDK integration.

---

## Tech Stack

### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **State Management**: Zustand with persist middleware (51 fields), React Context (auth only)
- **Discord Integration**: `@discord/embedded-app-sdk` v2.4.0
- **UI Components**: Custom components + Lucide React icons
- **Notifications**: Sonner v2.0.7 (toast notifications, Discord Activity compatible)

### Backend
- **Database**: PostgreSQL (via Supabase)
- **Auth**: Supabase Auth with Discord OAuth provider
- **Edge Functions**: Deno-based Supabase Edge Functions
- **Real-time**: Supabase Realtime (for future features)

### Infrastructure
- **Hosting**: Vercel (frontend) + Supabase (backend/database)
- **Database**: Supabase PostgreSQL
- **Edge Runtime**: Deno Deploy (via Supabase)
- **Version Control**: Git + GitHub

### Security
- **Row Level Security (RLS)**: PostgreSQL RLS policies
- **JWT Authentication**: Supabase Auth tokens
- **Discord OAuth**: OAuth 2.0 Authorization Code Flow
- **SECURITY DEFINER Functions**: PostgreSQL functions with explicit authorization checks

---

## Code Organization & Patterns

This section documents the conventions and patterns we follow throughout the codebase. Understanding these patterns is essential for maintaining consistency when adding new features.

### React Component Structure

All React components follow a consistent organization:

```typescript
// 1. Imports (external → internal → types → components)
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { AppUser } from '../types'
import { Button } from './ui/Button'

// 2. Constants and types
const MAX_DURATION = 120
type TimerState = 'idle' | 'running' | 'paused'

// 3. Component definition
export function MyComponent({ prop1, prop2 }: Props) {
  // 3a. State declarations
  const [state, setState] = useState<TimerState>('idle')

  // 3b. Refs
  const timerRef = useRef<number | null>(null)

  // 3c. Effects
  useEffect(() => {
    // Effect logic
  }, [dependencies])

  // 3d. Event handlers
  const handleStart = () => {
    // Handler logic
  }

  // 3e. Render
  return (
    <div>...</div>
  )
}
```

**Key Principles**:
- Use `React.memo()` for components that render frequently with same props
- Use `useRef` for values that don't trigger re-renders (DOM refs, flags, timers)
- Keep effects minimal and focused on single responsibility
- Extract complex logic into custom hooks or utility functions

### State Management Patterns

We use **three layers** of state management:

#### 1. Zustand Store (Global Persistent State)
- **Purpose**: Cross-device synchronized settings and stats
- **Location**: `src/store/useSettingsStore.ts`
- **Size**: 51 fields (timer settings, audio, visual, XP, stats)
- **Persistence**: localStorage via `persist` middleware
- **Sync**: Database sync on visibility change, page unload, periodic intervals

**When to use**:
- User preferences that need cross-device sync
- Game state (XP, level, pomodoros)
- Settings that persist between sessions

```typescript
import { useSettingsStore } from '../store/useSettingsStore'

function MyComponent() {
  const { xp, level, addXP } = useSettingsStore()

  const handleComplete = () => {
    addXP(25) // Adds XP and triggers level-up if needed
  }
}
```

#### 2. React Context (Auth State Only)
- **Purpose**: Authentication state and user data
- **Location**: `src/contexts/AuthContext.tsx`
- **Why separate**: Auth needs different lifecycle from settings
- **Provides**: `user`, `session`, `appUser`, `discordSdk`, `loading`, `error`

**When to use**:
- Accessing current authenticated user
- Checking authentication status
- Discord SDK access

```typescript
import { useAuth } from '../contexts/AuthContext'

function MyComponent() {
  const { appUser, isDiscordActivity, discordSdk } = useAuth()

  if (!appUser) return <LoginScreen />
}
```

#### 3. Local Component State
- **Purpose**: UI-specific state that doesn't need persistence
- **Examples**: Modal open/close, form inputs (before save), temp values

**When to use**:
- Temporary UI state (modals, dropdowns, tooltips)
- Form inputs before submission
- Loading/error states for specific operations

```typescript
const [isOpen, setIsOpen] = useState(false)
const [tempValue, setTempValue] = useState('')
```

### Error Handling Patterns

**CRITICAL**: NEVER use `alert()`, `confirm()`, or `window.open()` - these are blocked in Discord Activity sandbox.

#### Toast Notifications (REQUIRED)

```typescript
import { toast } from 'sonner'

// Success
toast.success('Settings saved successfully!')

// Error
toast.error('Failed to save settings. Please try again.')

// Info with description
toast('Level Up!', {
  description: 'You reached level 10!',
  duration: 5000
})

// Confirmation with action buttons (replaces confirm())
toast('Delete this item?', {
  description: 'This action cannot be undone.',
  action: {
    label: 'Delete',
    onClick: async () => {
      await deleteItem()
      toast.success('Item deleted')
    }
  },
  cancel: {
    label: 'Cancel',
    onClick: () => {}
  }
})
```

#### Try-Catch Blocks

Always wrap database operations:

```typescript
try {
  const updatedUser = await updateUsernameSecure(userId, discordId, newUsername)
  toast.success('Username updated!')
} catch (error) {
  console.error('[Settings] Error updating username:', error)
  toast.error(error instanceof Error ? error.message : 'Failed to update username')
}
```

### TypeScript Conventions

#### Type vs Interface

```typescript
// Use 'type' for unions, primitives, and utility types
type TimerType = 'pomodoro' | 'shortBreak' | 'longBreak'
type Playlist = 'lofi' | 'synthwave'

// Use 'interface' for object shapes (can be extended)
interface Settings {
  soundEnabled: boolean
  volume: number
}

interface ExtendedSettings extends Settings {
  musicVolume: number
}
```

#### Type Imports

```typescript
// Prefer type-only imports (better tree-shaking)
import type { User } from '@supabase/supabase-js'
import type { AppUser, Settings } from '../types'

// Regular imports for runtime code
import { supabase } from '../lib/supabase'
```

#### Naming Conventions

- **Interfaces**: PascalCase, descriptive (`AuthContextType`, `TimerState`)
- **Types**: PascalCase for complex types, camelCase for simple unions
- **Functions**: camelCase, verb-first (`calculateLevel`, `getUserStats`)
- **Components**: PascalCase, noun-based (`PomodoroTimer`, `SettingsModal`)
- **Constants**: SCREAMING_SNAKE_CASE (`XP_PER_MINUTE`, `MAX_LEVEL`)

### Import Organization

Always organize imports in this order:

```typescript
// 1. External dependencies (React, libraries)
import { useState, useEffect } from 'react'
import { toast } from 'sonner'

// 2. Internal libraries and utilities
import { supabase } from '../lib/supabase'
import { calculateLevel } from '../lib/levelSystem'

// 3. Type imports (grouped separately)
import type { AppUser } from '../types'
import type { User } from '@supabase/supabase-js'

// 4. Components
import { Button } from './ui/Button'
import { Modal } from './ui/Modal'

// 5. Styles (if any)
import './styles.css'
```

### CSS/Tailwind Patterns

#### Class Organization

```typescript
// Group related utilities, use object notation for conditionals
<button
  className={`
    px-4 py-2 rounded-lg
    bg-blue-500 hover:bg-blue-600
    text-white font-semibold
    transition-colors duration-200
    ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
  `}
>
```

#### Responsive Design

```typescript
// Mobile-first approach
<div className="
  w-full px-4          /* Mobile */
  md:w-1/2 md:px-8     /* Tablet */
  lg:w-1/3 lg:px-12    /* Desktop */
">
```

### Dual-Mode Feature Pattern

Many features need different implementations for Discord Activity vs Web:

```typescript
import { useAuth } from '../contexts/AuthContext'

function MyFeature() {
  const { isDiscordActivity, discordSdk } = useAuth()

  const handleExternalLink = async (url: string) => {
    if (isDiscordActivity && discordSdk) {
      // Discord Activity: Use SDK to avoid popup blocking
      await discordSdk.commands.openExternalLink({ url })
    } else {
      // Web: Standard window.open
      window.open(url, '_blank', 'noopener,noreferrer')
    }
  }
}
```

**Common dual-mode scenarios**:
- External links (SDK vs window.open)
- Asset URLs (proxied vs direct CDN)
- Authentication (Discord SDK vs Supabase Auth)
- RPC calls (discord_id vs auth.uid())

---

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Discord Client (Desktop/Mobile)           │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Discord Activity (iframe)                │  │
│  │  ┌────────────────────────────────────────────────┐  │  │
│  │  │         React App (Vite + TypeScript)          │  │  │
│  │  │                                                 │  │  │
│  │  │  Components:                                    │  │  │
│  │  │  - PomodoroTimer                                │  │  │
│  │  │  - Stats Dashboard                              │  │  │
│  │  │  - Settings Panel                               │  │  │
│  │  │  - Level System                                 │  │  │
│  │  └────────────────────────────────────────────────┘  │  │
│  │                          ↓                            │  │
│  │  ┌────────────────────────────────────────────────┐  │  │
│  │  │      Supabase Client (supabase-js)             │  │  │
│  │  └────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              ↓
              ┌───────────────────────────────┐
              │      Supabase Backend         │
              │                               │
              │  ┌─────────────────────────┐  │
              │  │   PostgreSQL Database   │  │
              │  │   - users               │  │
              │  │   - completed_pomodoros │  │
              │  │   - RLS Policies        │  │
              │  └─────────────────────────┘  │
              │                               │
              │  ┌─────────────────────────┐  │
              │  │   Supabase Auth         │  │
              │  │   - Discord OAuth       │  │
              │  │   - JWT Management      │  │
              │  └─────────────────────────┘  │
              │                               │
              │  ┌─────────────────────────┐  │
              │  │   Edge Functions        │  │
              │  │   - discord-token       │  │
              │  └─────────────────────────┘  │
              └───────────────────────────────┘
                              ↓
                  ┌──────────────────────┐
                  │   Discord API        │
                  │   - OAuth Provider   │
                  └──────────────────────┘
```

### Data Flow

1. **Authentication Flow**:
   ```
   User opens Activity → Check session → No session found
   → Redirect to Discord OAuth → User authorizes
   → Discord redirects back with code → Supabase Auth exchanges code
   → JWT token issued → User session established
   → Fetch/create user profile → App ready
   ```

2. **Pomodoro Session Flow**:
   ```
   User starts timer → Timer counts down → Session completes
   → Calculate XP earned → Call atomic_save_completed_pomodoro RPC
   → RPC inserts pomodoro + updates user stats (atomic transaction)
   → UI updates with new XP/level → Achievement unlocked (if any)
   ```

3. **Data Persistence Flow**:
   ```
   All API calls → Supabase Client → JWT in Authorization header
   → Supabase validates JWT → RLS policies check auth.uid()
   → If authorized: execute query → Return data
   → If unauthorized: reject with 403
   ```

---

## State Management Deep Dive

The app uses a sophisticated state management system to handle user preferences, game state, and cross-device synchronization.

### Zustand Store Architecture

**Location**: `src/store/useSettingsStore.ts`

The Zustand store contains **51 fields** organized into logical groups:

#### Store Structure

```typescript
interface SettingsStore {
  // Timer Settings (6 fields)
  timers: {
    pomodoro: number          // 1-120 minutes (default: 25)
    shortBreak: number        // 1-120 minutes (default: 5)
    longBreak: number         // 1-120 minutes (default: 15)
  }
  pomodorosBeforeLongBreak: number  // Default: 4
  autoStartBreaks: boolean          // Default: false
  autoStartPomodoros: boolean       // Default: false

  // Audio Settings (4 fields + object)
  soundEnabled: boolean             // Timer completion sound
  volume: number                    // 0-100 (default: 50)
  musicVolume: number               // 0-100 (default: 70)
  ambientVolumes: Record<string, number>  // 9 ambient sounds (0-100 each)
  // Ambient sounds: rain, birds, forest, brown-noise, keyboard, campfire, waves, wind, underwater

  // Visual Settings (2 fields)
  background: string                // Background video ID
  playlist: 'lofi' | 'synthwave'    // Music playlist selection

  // Level System (9 fields)
  xp: number                        // Experience points
  level: number                     // Current level (1-50)
  prestigeLevel: number             // Prestige count (0-5)
  totalPomodoros: number            // Lifetime completed sessions
  totalStudyMinutes: number         // Lifetime study time
  username: string                  // Display name
  lastUsernameChange: number | null // Timestamp of last edit (null = using Discord name)
  levelPath: 'elf' | 'human'        // Theme/path selection
  levelSystemEnabled: boolean       // Show/hide level UI

  // Milestone System (2 fields)
  totalUniqueDays: number           // Total unique days with activity
  lastPomodoroDate: string | null   // ISO date (YYYY-MM-DD)

  // Login Tracking (3 fields)
  totalLoginDays: number            // Total unique login days
  consecutiveLoginDays: number      // Current streak (max 12)
  lastLoginDate: string | null      // Last login date (YYYY-MM-DD)
}
```

#### Key Actions

**`addXP(minutes: number)`**

Calculates and adds XP with automatic level-up and prestige logic:

```typescript
addXP: (minutes) => {
  const xpGained = minutes * XP_PER_MINUTE // XP_PER_MINUTE = 2
  let { xp, level, prestigeLevel } = get()

  xp += xpGained

  // Level up loop (handles multi-level gains)
  while (xp >= getXPNeeded(level) && level < MAX_LEVEL) {
    xp -= getXPNeeded(level)
    level += 1
  }

  // Prestige logic (reset at level 50)
  if (level >= MAX_LEVEL) {
    level = 1
    xp = 0
    prestigeLevel = Math.min(prestigeLevel + 1, 5) // Max 5 prestige
  }

  set({ xp, level, prestigeLevel })
}
```

**Formula**: `XP needed for level N = 100 × N²`

Examples:
- Level 1 → 2: 100 XP
- Level 2 → 3: 400 XP
- Level 10 → 11: 10,000 XP

**`trackLogin()`**

Handles login streak calculation:

```typescript
trackLogin: () => {
  const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD
  const { lastLoginDate, consecutiveLoginDays, totalLoginDays } = get()

  if (lastLoginDate === today) {
    // Already logged in today
    return { isNewDay: false, currentDay: consecutiveLoginDays }
  }

  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0]

  let newStreak
  if (lastLoginDate === yesterday) {
    // Consecutive day - increment streak (max 12)
    newStreak = Math.min(consecutiveLoginDays + 1, 12)
  } else {
    // Streak broken - reset to 1
    newStreak = 1
  }

  set({
    lastLoginDate: today,
    consecutiveLoginDays: newStreak,
    totalLoginDays: totalLoginDays + 1
  })

  return { isNewDay: true, currentDay: newStreak }
}
```

**`setUsername(username: string, forceWithXP?: boolean)`**

Updates username with optional XP cost:

```typescript
setUsername: (username, forceWithXP = false) => {
  const updates: Partial<Settings> = { username }

  if (forceWithXP) {
    // Deduct XP cost (50 XP)
    const { xp } = get()
    updates.xp = xp - USERNAME_EDIT_COST // USERNAME_EDIT_COST = 50
  }

  // Set timestamp (flags username as custom, not Discord sync)
  updates.lastUsernameChange = Date.now()

  set(updates)
}
```

**`setPlaylist(playlist: 'lofi' | 'synthwave')`**

Switches music playlist:

```typescript
setPlaylist: (playlist) => set({ playlist })
```

### Settings Synchronization Strategy

**Location**: `src/hooks/useSettingsSync.ts`

The sync hook implements a sophisticated strategy to balance responsiveness with server load:

#### Sync Triggers

1. **Initial Load** (on mount):
   - Fetch all data from `appUser` (database)
   - Apply to Zustand store
   - Mark as clean (no dirty changes)

2. **Visibility Change** (tab backgrounded):
   - If dirty: Sync to database immediately
   - Prevents data loss when user switches apps

3. **Page Unload** (beforeunload event):
   - **Synchronous sync** using `fetch()` with `keepalive: true`
   - Guarantees save even as page closes
   - Cannot use Beacon API (needs auth headers)

4. **Periodic Sync** (every 2 minutes):
   - Only if dirty flag is set
   - Prevents unnecessary database writes

5. **Manual Trigger** (settings modal close):
   - Immediate sync on "Save" button click

#### Client vs Server Fields

**Critical Security Principle**: Only 14 client-controlled fields can be synced. Server-controlled fields (XP, levels, stats) are read-only from client.

**Client-Controlled** (14 fields, safe to sync):
```typescript
{
  // Timer (6)
  pomodoro_duration: timers.pomodoro,
  short_break_duration: timers.shortBreak,
  long_break_duration: timers.longBreak,
  pomodoros_before_long_break: pomodorosBeforeLongBreak,
  auto_start_breaks: autoStartBreaks,
  auto_start_pomodoros: autoStartPomodoros,

  // Audio (3)
  sound_enabled: soundEnabled,
  volume: volume,
  music_volume: musicVolume,

  // Visual (2)
  background: background,
  playlist: playlist,

  // System (3)
  level_path: levelPath,
  level_system_enabled: levelSystemEnabled,
  ambient_volumes: ambientVolumes
}
```

**Server-Controlled** (read-only, updated via RPCs):
- `xp`, `level`, `prestige_level`
- `total_pomodoros`, `total_study_minutes`
- `total_unique_days`, `last_pomodoro_date`
- `total_login_days`, `consecutive_login_days`, `last_login_date`
- `username`, `last_username_change` (updated via `update_username` RPC)

#### Dirty Flag Tracking

```typescript
const [lastSyncedStateRef] = useState({ current: '' })
const [isDirtyRef] = useState({ current: false })

// Serialize only client-controlled fields
const serializeSettings = (s: Settings): string => {
  return JSON.stringify({
    pomodoro_duration: s.timers.pomodoro,
    // ... other 13 fields
  })
}

// Track changes
useEffect(() => {
  const current = serializeSettings(settings)

  if (current !== lastSyncedStateRef.current) {
    isDirtyRef.current = true
  }
}, [settings.timers.pomodoro, settings.volume, /* ... all 14 fields */])
```

#### Synchronous Sync (Page Unload)

```typescript
useEffect(() => {
  const handleBeforeUnload = () => {
    if (!isDirtyRef.current) return

    const serialized = serializeSettings(settings)

    // Use fetch with keepalive (request survives page close)
    fetch(`${SUPABASE_URL}/rest/v1/rpc/update_user_settings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ p_user_id: userId, ...serialized }),
      keepalive: true // CRITICAL: Request completes even as page closes
    })
  }

  window.addEventListener('beforeunload', handleBeforeUnload)
  return () => window.removeEventListener('beforeunload', handleBeforeUnload)
}, [settings, session])
```

#### Background Validation

On store hydration (loading from localStorage), backgrounds are validated against device orientation:

```typescript
const getValidBackgroundForDevice = (backgroundId: string, isMobile: boolean) => {
  const background = BACKGROUNDS.find(bg => bg.id === backgroundId)
  if (!background) return getDefaultBackground(isMobile)

  const requiredOrientation = isMobile ? 'vertical' : 'horizontal'
  if (background.orientation !== requiredOrientation) {
    // Wrong orientation for device - return device-appropriate default
    return getDefaultBackground(isMobile)
  }

  return backgroundId
}
```

**Why needed**: Prevents horizontal backgrounds on mobile (would be sideways), and vertical backgrounds on desktop (would be squished).

---

## Key Features

### 1. Pomodoro Timer

**Core Functionality**:
- **Custom Durations**: Users can set ANY duration from 1-120 minutes (not just presets)
  - Plus/minus buttons for quick adjust
  - Direct number input for precise control
  - Separate durations for pomodoro, short break, and long break
- **Three Timer Types**:
  - **Pomodoro**: Focus work session (default: 25 min, earns 2 XP/min)
  - **Short Break**: Rest period (default: 5 min, earns 1 XP/min)
  - **Long Break**: Extended rest (default: 15 min, earns 1 XP/min)
- **Visual Timer**: Circular progress ring with time remaining display
- **Pause/Resume**: Pause at any time, resume from exact paused time
- **Keyboard Shortcuts**:
  - **Space**: Start/pause timer
  - **R**: Reset current timer
- **Task Tracking**: Optional task name and notes for each session
- **Sound Effects**: Customizable completion sounds (toggle + volume control)
- **Auto-Start**: Optional automatic start of breaks/pomodoros

**XP Calculation**:
- **Pomodoro sessions**: `2 XP per minute` (25 min = 50 XP)
- **Break sessions**: `1 XP per minute` (5 min break = 5 XP)

**Database Persistence**:
- Calls `atomic_save_completed_pomodoro` RPC on completion
- Async, non-blocking (UI updates instantly, DB saves in background)
- Single transaction (insert pomodoro + update stats + add XP)

**Gotchas**:
- Must use `useSettingsStore.getState()` in completion callback to avoid stale settings closure
- `isUserInteracting` ref prevents settings changes from interrupting running timer

**Implementation**: `src/components/timer/PomodoroTimer.tsx` (400+ lines)

---

### 2. Music & Audio System

**Music Playlists**:
- **Lofi**: Chill lofi hip-hop beats for focus
- **Synthwave**: Retro synthwave for energy
- Switchable via settings (instant playlist change)
- Volume control (0-100%)
- Continuous playback (loops playlist)

**Ambient Sounds** (9 mixable sounds):
Users can mix ambient sounds with music, each with individual volume control:
- Rain
- Birds
- Forest
- Brown Noise
- Keyboard Typing
- Campfire
- Ocean Waves
- Wind
- Underwater

**Volume Controls**:
- **Master Sound Volume**: Completion sound effects (0-100%)
- **Music Volume**: Playlist volume (0-100%)
- **Ambient Volumes**: Individual control for each of 9 sounds (0-100%)

**Asset Management**:
- **Discord Activity**: Proxied URLs (`/r2-audio`, `/r2-effects`) to bypass CSP
- **Web**: Direct CDN URLs (`https://cdn.study-saga.com/music`) for bandwidth efficiency

**Implementation**:
- Music: `src/components/music/MusicPlayer.tsx`
- Ambient: `src/components/music/AmbientSoundsPlayer.tsx`
- Constants: `src/data/constants.ts` (R2_MUSIC_BASE_URL, AMBIENT_SOUNDS)

---

### 3. XP & Leveling System

**XP Earning**:
- **Pomodoro sessions**: 2 XP per minute
- **Break sessions**: 1 XP per minute
- Example: 25-minute pomodoro = 50 XP
- Example: 5-minute break = 5 XP

**Level Progression**:
- **Formula**: XP needed for level N = `100 × N²`
- **Examples**:
  - Level 1 → 2: 100 XP (50 minutes study)
  - Level 2 → 3: 400 XP (200 minutes study)
  - Level 5 → 6: 2,500 XP (1,250 minutes study)
  - Level 10 → 11: 10,000 XP (5,000 minutes study)
- **Max Level**: 50 (triggers prestige)
- **Prestige System**: Reset to level 1 at level 50, earn prestige star (max 5 prestige)

**Level Paths**:
- **Elf Path**: Blue theme, nature-inspired level names
- **Human Path**: Red theme, achievement-inspired level names
- Switchable at any time (keeps XP and level)

**Visual Feedback**:
- Animated XP progress bar
- Level name and badge display
- Prestige stars (⭐ up to ⭐⭐⭐⭐⭐)
- Level-up celebrations with toast notifications

**Implementation**:
- UI: `src/components/level/LevelDisplay.tsx`
- Logic: `src/lib/levelSystem.ts`
- Store: `useSettingsStore.addXP(minutes)`
- Database: `users.level`, `users.xp`, `users.prestige_level`

---

### 4. Statistics Dashboard

**Displayed Stats**:
- **Total Pomodoros**: Lifetime completed focus sessions
- **Total Study Time**: Cumulative minutes spent in pomodoro sessions
- **Login Streak**: Consecutive days of app usage (max 12, resets on skip)
- **Active Days**: Total unique days with completed pomodoros
- **Average Per Day**: Pomodoros / Active days (not login streak)
- **Next Milestone**: Countdown to next unique day milestone reward

**Calculations**:
- All stats stored in database, updated via RPCs
- Average calculated: `total_pomodoros / total_unique_days`
- Streaks calculated on login via `trackLogin()` action

**Implementation**:
- UI: `src/components/stats/StatsDashboard.tsx`
- Data fetching: `src/lib/userSyncAuth.ts` → `getUserStats()`

---

### 5. Settings Panel

**Structure**: 5 tabbed sections

#### General Tab
- **Timer Durations**: Custom 1-120 min for pomodoro, short break, long break
- **Pomodoros Before Long Break**: 1-10 sessions
- **Auto-Start Breaks**: Toggle automatic break start after pomodoro
- **Auto-Start Pomodoros**: Toggle automatic pomodoro start after break

#### Appearance Tab
- **Background**: Video background selection (6 options, device-aware)
- **Level Path**: Elf or Human theme
- **Level System**: Toggle show/hide level UI

#### Sounds Tab
- **Sound Effects**: Enable/disable completion sounds
- **Sound Volume**: 0-100% for completion effects

#### Music Tab
- **Playlist**: Lofi or Synthwave selection
- **Music Volume**: 0-100% for background music
- **Ambient Sounds**: 9 individual volume sliders (0-100% each)

#### Progress Tab
- **Username**: Edit with 7-day cooldown (50 XP to bypass)
- **Reset Progress**: Nuclear option, deletes all XP/levels/stats

**Temp State Pattern**:
- Settings changes stored in temporary state
- Applied to Zustand only on "Save" button click
- "Reset" button reverts temp state to current store values
- Modal close discards unsaved changes

**Database Sync**:
- Calls `updateUserPreferences()` on save
- Only syncs 14 client-controlled fields (not XP/levels)

**Implementation**: `src/components/settings/SettingsModal.tsx` (1000+ lines)

---

### 6. Discord Integration

**Discord Activity SDK**:
- **Version**: `@discord/embedded-app-sdk` v2.4.0
- **Purpose**: Enables app to run inside Discord iframe with full functionality
- **Query Params**: `frame_id` and `instance_id` required for Discord context

**OAuth Authentication**:
- **Provider**: Discord OAuth 2.0
- **Scopes**: `identify`, `email` (optional), `guilds`
- **Flow**: Authorization code flow with Supabase Auth integration

**User Identity**:
- **Discord Username**: Synced from Discord account
- **Avatar**: Discord profile picture with CDN URL construction
- **Discord ID**: Unique identifier for user linking

**Dual-Mode Functionality**:
- **Discord Activity**: Uses Discord SDK methods (openExternalLink, OAuth)
- **Web**: Uses standard browser APIs (window.open, Supabase Auth)
- **Detection**: Based on `frame_id`/`instance_id` query params

**Responsive Design**:
- Works on Discord desktop and mobile
- Adapts backgrounds to device orientation (vertical for mobile, horizontal for desktop)

**Implementation**:
- SDK: `src/lib/discordSdk.ts`
- Auth: `src/lib/discordAuth.ts`, `src/lib/supabaseAuth.ts`
- Button: `src/components/social/DiscordButton.tsx`

---

### 7. Cross-Device Sync

**Synchronization**:
- All user settings sync across devices via database
- Real-time updates on login (fetch latest from database)
- Auto-sync on visibility change, page unload, periodic intervals

**Synced Data**:
- Timer settings (durations, auto-start)
- Audio settings (volumes, playlist choice)
- Visual settings (background, level path)
- Game state (XP, level, prestige, stats)
- Login tracking (streaks, unique days)

**Sync Strategy**:
- **Optimistic UI**: Updates Zustand immediately for responsiveness
- **Background sync**: Saves to database asynchronously
- **Conflict resolution**: Database is source of truth on login

**Implementation**: `src/hooks/useSettingsSync.ts`

---

## Complete Component Reference

This section provides detailed documentation of all major components. Understanding these components is essential for adding features or fixing bugs.

### PomodoroTimer.tsx

**Location**: `src/components/timer/PomodoroTimer.tsx` (400+ lines)

**Purpose**: Core timer functionality with pause/resume, XP calculation, and database persistence.

**Key State**:
```typescript
const [timerType, setTimerType] = useState<TimerType>('pomodoro')
const [pomodoroCount, setPomodoroCount] = useState(0)
const [hasBeenStarted, setHasBeenStarted] = useState(false)
const [pausedTimeSeconds, setPausedTimeSeconds] = useState<number | null>(null)

const isUserInteractingRef = useRef(false) // Prevents settings interference
```

**Critical Logic - Timer Completion**:
```typescript
const handleTimerComplete = () => {
  // CRITICAL: Use getState() to avoid stale closure
  const currentSettings = useSettingsStore.getState()

  const durationMinutes = /* calculate based on timerType */
  const xpEarned = timerType === 'pomodoro'
    ? durationMinutes * 2  // 2 XP/min for pomodoro
    : durationMinutes * 1  // 1 XP/min for breaks

  // Update Zustand instantly (optimistic UI)
  addXP(durationMinutes)

  // Save to database async (non-blocking)
  if (timerType === 'pomodoro') {
    saveCompletedPomodoro(userId, discordId, {
      duration_minutes: durationMinutes,
      xp_earned: xpEarned
    })
  }

  // Auto-start next timer based on FRESH settings
  if (timerType === 'pomodoro' && currentSettings.autoStartBreaks) {
    switchTimer(nextBreakType, true)
  }
}
```

**Gotchas**:
- **Stale Closure**: Must use `getState()` in timer callback, not values from render scope
- **isUserInteracting Guard**: Prevents settings changes from resetting running timer
- **Keyboard Shortcuts**: Space/R filtered to ignore when typing in input fields

**Data Flow**:
1. User starts timer → `react-timer-hook` counts down
2. Timer completes → `handleTimerComplete()` called
3. XP added to Zustand (instant UI update)
4. Pomodoro saved to DB async (background)
5. Auto-start next timer if enabled

---

### SettingsModal.tsx

**Location**: `src/components/settings/SettingsModal.tsx` (1000+ lines)

**Purpose**: All user settings with 5 tabs, temp state pattern, and database sync.

**Temp State Pattern**:
```typescript
// Temp state for all settings (not applied until Save)
const [tempTimers, setTempTimers] = useState(timers)
const [tempVolume, setTempVolume] = useState(volume)
// ... 14 total temp state variables

// On modal open: Load current settings
useEffect(() => {
  if (isOpen) {
    setTempTimers(timers)
    setTempVolume(volume)
    // ... reset all temp state
  }
}, [isOpen])

// On Save: Apply temp state to Zustand
const handleSave = () => {
  setPomodoroDuration(tempTimers.pomodoro)
  setVolume(tempVolume)
  // ... apply all 14 fields

  setIsOpen(false) // Close modal
}

// On Cancel: Discard temp state
const handleCancel = () => {
  setIsOpen(false) // Temp state discarded
}
```

**Username Update Flow** (Server-First Approach):
```typescript
const handleSaveUsername = async () => {
  try {
    // Try free update (let server check cooldown)
    const updatedUser = await updateUsernameSecure(
      appUser.id,
      appUser.discord_id,
      usernameInput,
      false // forceWithXP = false
    )

    toast.success('Username updated!')
    setUsername(usernameInput, false)
  } catch (error) {
    // Server returned cooldown error
    if (error.message.includes('cooldown')) {
      const hoursRemaining = /* parse from error */

      // Show toast with XP payment option
      toast('Username change is on cooldown', {
        description: `${hoursRemaining} hours remaining. Pay 50 XP to change now?`,
        duration: 10000,
        action: {
          label: 'Pay 50 XP',
          onClick: async () => {
            // Force update with XP cost
            await updateUsernameSecure(appUser.id, appUser.discord_id, usernameInput, true)
            setUsername(usernameInput, true) // Deducts 50 XP locally
            toast.success('Username updated! 50 XP deducted.')
          }
        }
      })
    }
  }
}
```

**5 Tabs**:
1. **General**: Timer durations, auto-start settings
2. **Appearance**: Background, level path, system toggles
3. **Sounds**: Sound effects toggle + volume
4. **Music**: Playlist selection, music volume, 9 ambient sound sliders
5. **Progress**: Username edit, reset progress button

**Key Methods**:
- `handleSave()`: Applies all temp state to Zustand, triggers DB sync
- `handleReset()`: Resets temp state to current Zustand values
- `handleSaveUsername()`: Server-first cooldown check with XP payment toast

---

### AuthContext.tsx

**Location**: `src/contexts/AuthContext.tsx`

**Purpose**: Dual-mode authentication state management (Discord Activity + Web).

**Provided State**:
```typescript
interface AuthContextType {
  // Common
  authenticated: boolean
  loading: boolean
  error: string | null
  appUser: AppUser | null

  // Discord Activity mode
  isDiscordActivity: boolean
  discordUser: DiscordUser | null
  discordSdk: DiscordSDK | null

  // Web mode
  user: User | null
  session: Session | null

  // Actions
  signOut: () => Promise<void>
}
```

**Authentication Flow**:
```typescript
useEffect(() => {
  if (authInitializedRef.current) return // Prevent duplicate in strict mode
  authInitializedRef.current = true

  const params = new URLSearchParams(window.location.search)
  const isDiscordActivity = params.has('frame_id') || params.has('instance_id')

  if (isDiscordActivity) {
    // Discord Activity: Use Discord SDK auth
    authenticateDiscordUser().then(({ discordUser, discordSdk }) => {
      syncDiscordUserToSupabase(discordUser).then(appUser => {
        setAuthenticated(true)
        setDiscordUser(discordUser)
        setDiscordSdk(discordSdk)
        setAppUser(appUser)
        setLoading(false)
      })
    })
  } else {
    // Web: Use Supabase Auth
    authenticateWithSupabase().then(({ user, session, appUser }) => {
      setAuthenticated(true)
      setUser(user)
      setSession(session)
      setAppUser(appUser)
      setLoading(false)
    })
  }
}, [])
```

**Deduplication Logic**:
- **authInitializedRef**: Prevents duplicate auth attempts in React strict mode
- **lastProcessedSessionRef**: Prevents duplicate fetches for same session
- **isOAuthCallback()**: Detects OAuth redirect, waits for session before showing error

---

### LevelDisplay.tsx

**Location**: `src/components/level/LevelDisplay.tsx`

**Purpose**: Top-left UI showing level, XP, prestige, streaks, and milestones.

**Displayed Data**:
```typescript
// From useSettingsStore
const { username, level, xp, prestigeLevel, totalUniqueDays, consecutiveLoginDays } = useSettingsStore()

// Calculated
const levelData = getLevelData(level, xp, prestigeLevel, levelPath)
const xpNeeded = getXPNeeded(level)
const xpProgress = (xp / xpNeeded) * 100 // Percentage
```

**Responsive Layout**:
```typescript
const { isMobile } = useDeviceType(1024) // Breakpoint at 1024px

<div className={`
  ${isMobile ? 'w-[180px] text-xs' : 'w-[280px] text-sm'}
  fixed top-4 left-4 z-40
`}>
  <div className="flex items-center gap-2">
    <span className={isMobile ? 'text-lg' : 'text-2xl'}>{levelData.badge}</span>
    <span className={isMobile ? 'text-sm' : 'text-base'}>{username}</span>
  </div>

  {/* XP Bar */}
  <div className="bg-gray-700 rounded-full h-2">
    <div
      className="bg-blue-500 h-full rounded-full transition-all"
      style={{ width: `${xpProgress}%` }}
    />
  </div>

  {/* Prestige Stars */}
  {'⭐'.repeat(prestigeLevel)}
</div>
```

**Dev Tools** (DEV mode only):
- "Add 50 XP" button
- "Daily Gift" button (simulates next day login)

---

### MusicPlayer.tsx & AmbientSoundsPlayer.tsx

**Locations**:
- `src/components/music/MusicPlayer.tsx`
- `src/components/music/AmbientSoundsPlayer.tsx`

**MusicPlayer** - Handles lofi/synthwave playlists:
```typescript
const { playlist, musicVolume } = useSettingsStore()
const [currentTrackIndex, setCurrentTrackIndex] = useState(0)

// Get tracks for selected playlist
const tracks = TRACKS.filter(t => t.genre === playlist)

// Play current track
<audio
  ref={audioRef}
  src={tracks[currentTrackIndex].file}
  volume={musicVolume / 100}
  onEnded={() => setCurrentTrackIndex((i + 1) % tracks.length)}
  autoPlay
  loop={false} // Loop playlist, not individual track
/>
```

**AmbientSoundsPlayer** - Mixes 9 ambient sounds:
```typescript
const { ambientVolumes } = useSettingsStore()

{AMBIENT_SOUNDS.map(sound => (
  <audio
    key={sound.id}
    src={sound.file}
    volume={ambientVolumes[sound.id] / 100}
    loop
    autoPlay={ambientVolumes[sound.id] > 0}
  />
))}
```

**Asset URL Handling**:
```typescript
// In constants.ts
const isDiscordActivity = () => {
  const params = new URLSearchParams(window.location.search)
  return params.has('frame_id') || params.has('instance_id')
}

export const R2_MUSIC_BASE_URL = isDiscordActivity()
  ? '/r2-audio'  // Proxied through Discord (bypasses CSP)
  : 'https://cdn.study-saga.com/music' // Direct CDN (saves bandwidth)
```

---

### DiscordButton.tsx

**Location**: `src/components/social/DiscordButton.tsx`

**Purpose**: Discord community invite button with dual-mode link handling.

**Dual-Mode External Links**:
```typescript
const { discordSdk, isDiscordActivity } = useAuth()

const handleClick = async () => {
  const url = 'https://discord.gg/8jbthVPmnb'

  if (isDiscordActivity && discordSdk) {
    // Discord Activity: Use SDK to avoid popup blocking
    try {
      await discordSdk.commands.openExternalLink({ url })
    } catch (error) {
      toast.error('Failed to open Discord invite link')
    }
  } else {
    // Web: Standard window.open
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}
```

**Why Needed**: `window.open()` is blocked in Discord's sandboxed iframe. Must use SDK's `openExternalLink()` command.

---

## Authentication System

### Overview
The app uses **Supabase Auth with Discord OAuth** for authentication. This provides secure, JWT-based authentication with proper RLS enforcement.

### Authentication Flow (Detailed)

```typescript
// 1. App initialization
authenticateWithSupabase() called on mount

// 2. Check for Discord context
if (!isInDiscord()) {
  throw new Error('Must be launched from Discord Activities')
}

// 3. Check existing session
const { session } = await supabase.auth.getSession()

// 4a. If session exists:
if (session?.user) {
  // Fetch or create user profile
  const appUser = await fetchOrCreateAppUser(session.user)
  return { user: session.user, session, appUser }
}

// 4b. If no session:
// Redirect to Discord OAuth (preserving frame_id/instance_id)
await signInWithDiscord()

// 5. Discord OAuth redirect
// User authorizes on Discord → redirects back with code
// Supabase Auth exchanges code for JWT token
// Session established

// 6. Fetch or create user profile
async function fetchOrCreateAppUser(authUser: User) {
  // Try to find existing user by auth_user_id
  const existingUser = await supabase
    .from('users')
    .select('*')
    .eq('auth_user_id', authUser.id)
    .maybeSingle()

  if (existingUser) {
    // Update last login via sync_discord_user_data RPC
    return updatedUser
  }

  // Check for legacy account (discord_id exists, auth_user_id is NULL)
  const { data: backfilled } = await supabase.rpc('backfill_auth_user_id', {
    p_discord_id: discordId,
    p_auth_user_id: authUser.id
  })

  if (backfilled === true) {
    // Legacy account linked, fetch and return
    return linkedUser
  }

  // No existing user - create new
  const newUser = await supabase.from('users').insert({
    auth_user_id: authUser.id,
    discord_id: discordId,
    username,
    avatar
  })

  return newUser
}
```

### OAuth Configuration

**Discord Application Settings**:
- **Redirect URI**: `https://your-project.supabase.co/auth/v1/callback`
- **Scopes**: `identify guilds` (email is optional)

**Supabase Auth Settings**:
- **Provider**: Discord OAuth
- **Skip nonce check**: ✅ Enabled (required for Discord Activities)
- **Allow users without email**: ✅ Enabled (not all Discord users share email)

### Session Management

- **JWT Tokens**: Stored in localStorage by Supabase client
- **Token Refresh**: Automatic refresh before expiration
- **Session Persistence**: Users stay logged in across page reloads
- **Auth State Changes**: Monitored via `supabase.auth.onAuthStateChange()`

### Legacy Account Migration

For users who used the app before Supabase Auth:
1. User authenticates with Discord OAuth
2. Supabase Auth creates auth identity
3. App calls `backfill_auth_user_id` RPC
4. RPC verifies Discord ID ownership (prevents hijacking)
5. RPC links legacy account (sets auth_user_id)
6. User regains access to their XP, stats, and pomodoros

**Security**: The backfill function verifies Discord ID ownership by checking JWT metadata - prevents attackers from claiming other users' accounts.

---

## Dual Authentication Architecture

**Critical Concept**: The app supports TWO fundamentally different authentication modes because it runs in two different environments with different constraints.

### Why Two Modes?

**The Problem**:
- Discord Activities run in heavily sandboxed `<iframe>` elements
- Cookies are blocked in cross-origin iframes (third-party cookie restrictions)
- Supabase Auth relies on cookies/localStorage for session management
- Standard OAuth redirects work differently in iframes

**The Solution**: Dual authentication paths with equivalent security guarantees.

### Mode Detection

Environment is detected synchronously via URL query parameters:

```typescript
const params = new URLSearchParams(window.location.search)
const isDiscordActivity = params.has('frame_id') || params.has('instance_id')

// Discord ALWAYS injects these params when launching Activities
// Cannot be spoofed in production (Discord controls iframe)
```

**Mode 1**: `isDiscordActivity === false` → **Web Mode** (Supabase Auth)
**Mode 2**: `isDiscordActivity === true` → **Discord Activity Mode** (Discord SDK Auth)

---

### Web Mode (Supabase Auth)

**Flow**:
1. User visits app directly (not from Discord)
2. App checks for existing Supabase Auth session
3. If no session: Redirect to Discord OAuth (`supabase.auth.signInWithOAuth`)
4. User authorizes on Discord
5. Discord redirects back with authorization code
6. Supabase Auth exchanges code for JWT token
7. Session established with `auth.uid()` available

**Authentication**:
```typescript
const { data: { session } } = await supabase.auth.getSession()
if (session) {
  // User authenticated
  // session.user.id === auth.uid()
  // Can call RPCs that check auth.uid()
}
```

**RPC Calls**:
```typescript
// Call RPC that uses auth.uid() for authorization
await supabase.rpc('update_username', {
  p_user_id: userId,
  p_new_username: newUsername
})

// RPC function checks: auth.uid() == p_user_id
```

**Security**:
- JWT token cryptographically signed by Supabase
- `auth.uid()` extracted from verified JWT
- RLS policies enforce `auth.uid()` checks
- Cannot spoof `auth.uid()` without valid JWT

---

### Discord Activity Mode (Discord SDK Auth)

**Flow**:
1. User launches Activity from Discord
2. App detects `frame_id`/`instance_id` params
3. Initialize Discord SDK
4. Call `discordSdk.commands.authorize()` with Discord OAuth
5. User authorizes (or auto-authorized if returning user)
6. Discord SDK returns verified `discord_id`
7. Fetch Discord user data from `/users/@me` API
8. Sync user to database via `syncDiscordUserToSupabase()`

**Authentication**:
```typescript
const { discordUser, discordSdk, accessToken } = await authenticateDiscordUser()

// discordUser.id is verified by Discord's OAuth
// No Supabase session exists (session === null)
// auth.uid() is NULL
```

**RPC Calls**:
```typescript
// Call RPC that uses discord_id for authorization
await supabase.rpc('update_username_discord', {
  p_discord_id: discordId,
  p_new_username: newUsername
})

// RPC function checks: discord_id matches (no auth.uid() available)
```

**Security**:
- `discord_id` obtained from Discord's verified OAuth flow
- Cannot call RPC without successful Discord OAuth
- Discord SDK verifies user identity
- `discordUser.id` comes from Discord's `/users/@me` API (requires valid access token)
- Access token obtained through Discord's OAuth flow

---

### Security Equivalence

**Both modes require cryptographic verification**:

| Aspect | Web Mode | Discord Activity Mode |
|--------|----------|----------------------|
| **OAuth Provider** | Discord (via Supabase) | Discord (direct) |
| **Verification** | Supabase validates code → issues JWT | Discord SDK validates code → returns user |
| **Identity Source** | `auth.uid()` from Supabase JWT | `discord_id` from Discord API |
| **Spoof Protection** | Cannot forge JWT without Supabase secret | Cannot call API without valid OAuth token |
| **Database Auth** | RLS checks `auth.uid()` | RPC checks `discord_id` from JWT metadata |

**Key Insight**: Both modes rely on Discord OAuth as the ultimate source of truth. The difference is WHO manages the session:
- Web: Supabase manages session (JWT token)
- Discord Activity: Discord SDK manages session (access token)

---

### Dual-Mode Implementation Patterns

#### Pattern 1: Detecting Environment

```typescript
import { useAuth } from '../contexts/AuthContext'

function MyComponent() {
  const { isDiscordActivity, discordSdk } = useAuth()

  if (isDiscordActivity) {
    // Discord Activity specific code
  } else {
    // Web specific code
  }
}
```

#### Pattern 2: External Links

```typescript
const handleExternalLink = async (url: string) => {
  if (isDiscordActivity && discordSdk) {
    // Discord: Use SDK (popup blocking workaround)
    await discordSdk.commands.openExternalLink({ url })
  } else {
    // Web: Standard browser API
    window.open(url, '_blank')
  }
}
```

#### Pattern 3: RPC Function Calls

```typescript
export async function updateUsernameSecure(
  userId: string,
  discordId: string,
  newUsername: string,
  forceWithXP: boolean
): Promise<AppUser> {
  const { data: { session } } = await supabase.auth.getSession()

  if (session) {
    // Web Mode: Use auth.uid() based RPC
    return await supabase.rpc('update_username', {
      p_user_id: userId,
      p_new_username: newUsername,
      p_force_with_xp: forceWithXP
    })
  } else {
    // Discord Activity Mode: Use discord_id based RPC
    return await supabase.rpc('update_username_discord', {
      p_discord_id: discordId,
      p_new_username: newUsername,
      p_force_with_xp: forceWithXP
    })
  }
}
```

#### Pattern 4: Asset URLs

```typescript
// Constants dynamically choose URLs based on environment
const isDiscordActivity = () => {
  const params = new URLSearchParams(window.location.search)
  return params.has('frame_id') || params.has('instance_id')
}

export const R2_MUSIC_BASE_URL = isDiscordActivity()
  ? '/r2-audio'  // Proxied through Discord (bypasses CSP)
  : 'https://cdn.study-saga.com/music'  // Direct CDN
```

---

### Database-Level Hybrid Authentication

Some RPC functions support BOTH modes for maximum flexibility:

```sql
CREATE OR REPLACE FUNCTION public.atomic_save_completed_pomodoro(...)
RETURNS UUID AS $$
DECLARE
  v_user_record public.users;
BEGIN
  -- Hybrid authentication: Support both auth.uid() AND discord_id

  IF auth.uid() IS NOT NULL THEN
    -- Web Mode: Verify via auth_user_id
    SELECT * INTO v_user_record
    FROM public.users
    WHERE id = p_user_id AND auth_user_id = auth.uid();

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Unauthorized: user_id does not match authenticated user';
    END IF;

  ELSE
    -- Discord Activity Mode: Verify via discord_id
    SELECT * INTO v_user_record
    FROM public.users
    WHERE id = p_user_id AND discord_id = p_discord_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Unauthorized: user_id/discord_id mismatch';
    END IF;
  END IF;

  -- Proceed with operation (user verified)
  -- ...
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant to both authenticated AND anon (for Discord Activity)
GRANT EXECUTE ON FUNCTION public.atomic_save_completed_pomodoro TO authenticated, anon;
```

**Security Note**: Granting to `anon` is safe because the function explicitly verifies ownership via `discord_id` when `auth.uid()` is NULL.

---

## Database Schema

### Tables

#### `users`
Primary table for user profiles and statistics.

```sql
CREATE TABLE public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  discord_id TEXT UNIQUE NOT NULL,
  username TEXT NOT NULL,
  avatar TEXT,
  level INTEGER DEFAULT 1,
  xp INTEGER DEFAULT 0,
  prestige_level INTEGER DEFAULT 0,
  level_path TEXT DEFAULT 'elf' CHECK (level_path IN ('elf', 'human')),
  consecutive_login_days INTEGER DEFAULT 0,
  total_unique_days INTEGER DEFAULT 0,
  total_pomodoros INTEGER DEFAULT 0,
  total_study_minutes INTEGER DEFAULT 0,
  sound_enabled BOOLEAN DEFAULT true,
  volume INTEGER DEFAULT 80 CHECK (volume BETWEEN 0 AND 100),
  music_volume INTEGER DEFAULT 50 CHECK (music_volume BETWEEN 0 AND 100),
  level_system_enabled BOOLEAN DEFAULT true,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_users_auth_user_id ON public.users(auth_user_id);
CREATE INDEX idx_users_discord_id ON public.users(discord_id);
```

**Key Fields**:
- `auth_user_id`: Links to Supabase Auth identity (NULL for legacy users)
- `discord_id`: Discord user ID (unique identifier)
- `level`, `xp`, `prestige_level`: Leveling system state
- `consecutive_login_days`: Current login streak
- `total_unique_days`: Total unique days with activity (for averages)
- `total_pomodoros`, `total_study_minutes`: Aggregate statistics

#### `completed_pomodoros`
Stores individual completed Pomodoro sessions.

```sql
CREATE TABLE public.completed_pomodoros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  discord_id TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
  xp_earned INTEGER NOT NULL CHECK (xp_earned >= 0),
  task_name TEXT,
  notes TEXT,
  completed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_completed_pomodoros_user_id ON public.completed_pomodoros(user_id);
CREATE INDEX idx_completed_pomodoros_completed_at ON public.completed_pomodoros(completed_at);
```

**Key Fields**:
- `user_id`: References users.id (enforced by foreign key + RLS)
- `discord_id`: Denormalized for backwards compatibility
- `duration_minutes`: Session length (15, 25, 30, 45, or 60)
- `xp_earned`: XP gained from this session (10 XP/min)
- `completed_at`: Timestamp for session completion

### Row Level Security (RLS)

All tables have RLS enabled with strict policies:

#### Users Table Policies

```sql
-- Users can only view their own profile
CREATE POLICY "Users can view own profile"
  ON public.users FOR SELECT TO authenticated
  USING (auth.uid() = auth_user_id);

-- Users can only insert their own profile
CREATE POLICY "Users can insert own profile"
  ON public.users FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = auth_user_id);

-- Users can only update their own profile
CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE TO authenticated
  USING (auth.uid() = auth_user_id)
  WITH CHECK (auth.uid() = auth_user_id);
```

#### Completed Pomodoros Policies

```sql
-- Users can only view their own pomodoros
CREATE POLICY "Users can view own pomodoros"
  ON public.completed_pomodoros FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = completed_pomodoros.user_id
      AND users.auth_user_id = auth.uid()
    )
  );

-- Users can only insert their own pomodoros
CREATE POLICY "Users can insert own pomodoros"
  ON public.completed_pomodoros FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = user_id
      AND users.auth_user_id = auth.uid()
    )
  );
```

**Security Guarantees**:
- Users can ONLY access their own data
- `auth.uid()` provides the authenticated user's UUID
- RLS is enforced at the database level (can't be bypassed from client)
- Anonymous users have NO access to data

---

## Security Implementation

### Security Principles

1. **Defense in Depth**: Multiple layers of security
2. **Principle of Least Privilege**: Users can only access their own data
3. **Zero Trust**: All requests verified, no implicit trust
4. **Fail Secure**: Errors deny access by default

### Security Measures

#### 1. Row Level Security (RLS)
- **Enabled on all tables**: No table access without matching policy
- **auth.uid() verification**: All policies verify caller identity
- **Strict policies**: No NULL allowances, no anonymous access
- **Enforced at DB level**: Cannot be bypassed from application code

#### 2. SECURITY DEFINER Functions
Functions that bypass RLS MUST have explicit authorization checks:

```sql
CREATE OR REPLACE FUNCTION public.sync_discord_user_data(...)
RETURNS public.users AS $$
BEGIN
  -- SECURITY: Verify caller is updating their own profile
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF auth.uid() != p_auth_user_id THEN
    RAISE EXCEPTION 'Unauthorized: Cannot update another user''s profile';
  END IF;

  -- Safe to proceed...
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**All SECURITY DEFINER functions**:
- `handle_new_user()` - Auto-creates profile on OAuth signup
- `sync_discord_user_data()` - Updates user profile with auth check
- `backfill_auth_user_id()` - Links legacy accounts with Discord ID verification
- `atomic_save_completed_pomodoro()` - Saves pomodoro with ownership verification
- `increment_user_xp()` - Updates XP with auth check
- `increment_pomodoro_totals()` - Updates stats with auth check

#### 3. Discord ID Ownership Verification

**Critical Security Feature**: Prevents account hijacking during legacy account migration.

```sql
-- In backfill_auth_user_id function:

-- Extract Discord ID from JWT metadata
SELECT raw_user_meta_data INTO v_user_metadata
FROM auth.users
WHERE id = auth.uid();

v_jwt_discord_id := COALESCE(
  v_user_metadata->>'provider_id',
  v_user_metadata->>'sub',
  auth.uid()::text
);

-- Verify Discord ID matches
IF v_jwt_discord_id IS NULL OR v_jwt_discord_id != p_discord_id THEN
  RAISE EXCEPTION 'Unauthorized: discord_id does not match authenticated Discord identity';
END IF;
```

**Why this matters**: Without this check, an attacker could call:
```sql
SELECT backfill_auth_user_id('victim_discord_id', auth.uid());
```
And steal the victim's entire account (XP, stats, pomodoros). The Discord ID verification prevents this.

#### 4. Atomic Transactions

**Problem**: Saving a pomodoro requires 3 operations:
1. Insert into `completed_pomodoros`
2. Update `users.total_pomodoros`
3. Update `users.xp`

If any operation fails, data becomes inconsistent.

**Solution**: `atomic_save_completed_pomodoro()` wraps all operations in a single transaction:

```sql
CREATE OR REPLACE FUNCTION public.atomic_save_completed_pomodoro(...)
RETURNS UUID AS $$
BEGIN
  -- Authorization check
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = p_user_id AND auth_user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Insert pomodoro
  INSERT INTO public.completed_pomodoros (...) RETURNING id INTO v_pomodoro_id;

  -- Update user stats (in same transaction)
  UPDATE public.users
  SET
    total_pomodoros = total_pomodoros + 1,
    total_study_minutes = total_study_minutes + p_duration_minutes,
    xp = xp + p_xp_earned
  WHERE id = p_user_id;

  RETURN v_pomodoro_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Guarantees**: Either ALL operations succeed, or ALL are rolled back. No partial failures.

#### 5. Client-Side Authentication Enforcement

**Critical Security Requirement**: All database queries MUST be executed with an authenticated Supabase client session.

**Problem**: Client-side code that queries the database without verifying the user is authenticated can bypass RLS policies, exposing sensitive data.

**Solution**: All sensitive operations must verify authentication before executing queries:

```typescript
// UNSAFE - Can bypass RLS if no session exists
const { data } = await supabase
  .from('users')
  .select('discord_id')
  .eq('id', userId)
  .single()

// SAFE - Verifies authentication first
const { data: { session } } = await supabase.auth.getSession()
if (!session) {
  throw new Error('Authentication required')
}
// Now queries will be executed with proper RLS enforcement
```

**Implementation Example** (`updateUsernameSecure` in `src/lib/userSyncAuth.ts`):
- Checks for authenticated session before any database operations
- Rejects unauthenticated requests immediately (fail secure)
- Only allows authenticated users to access RLS-protected RPC functions
- Prevents RLS bypass by ensuring all queries have proper auth context

**Security Guarantee**: No database queries execute without valid authentication, preventing unauthorized data access.

#### 5.5. Dual Authentication Mode for Username Updates

**Challenge**: The app runs in two different environments with different authentication methods:
- **Web Mode**: Users authenticate via Supabase Auth (OAuth), creating a JWT session
- **Discord Activity Mode**: Users authenticate via Discord SDK (OAuth), but NO Supabase session exists

**Solution**: Implement dual-path username update logic that safely handles both authentication modes:

```typescript
export async function updateUsernameSecure(
  userId: string,
  discordId: string,  // From AuthContext.appUser.discord_id
  newUsername: string,
  forceWithXP: boolean = false
): Promise<AppUser> {
  // Detect mode by checking for Supabase session
  const { data: { session } } = await supabase.auth.getSession()

  if (session) {
    // Web Mode: Use auth.uid() based RPC
    return await supabase.rpc('update_username', {
      p_user_id: userId,
      p_new_username: newUsername,
      p_force_with_xp: forceWithXP
    })
  } else {
    // Discord Activity Mode: Use discord_id based RPC
    return await supabase.rpc('update_username_discord', {
      p_discord_id: discordId,
      p_new_username: newUsername,
      p_force_with_xp: forceWithXP
    })
  }
}
```

**Why This is Secure**:

**Web Mode Security**:
- Uses `update_username` RPC with `auth.uid()` verification
- RLS policies enforce ownership at database level
- Cannot spoof JWT token without valid Supabase Auth

**Discord Activity Mode Security**:
- Uses `update_username_discord` RPC with Discord ID verification
- Discord ID comes from `AuthContext.appUser.discord_id`, which was:
  - Verified by Discord OAuth during authentication
  - Obtained from Discord's `/users/@me` API with valid access token
  - Stored securely in AuthContext after successful authentication
- Cannot spoof Discord ID without successful Discord OAuth flow

**Critical Security Principle**:
Both modes rely on **external cryptographic verification**:
- **Web**: Supabase Auth verifies Discord OAuth → issues JWT → provides `auth.uid()`
- **Discord Activity**: Discord SDK verifies Discord OAuth → returns verified `discord_id`

Both authentication paths require successful OAuth flow with Discord's servers, providing equivalent security guarantees.

**Database Functions**:
- `update_username(p_user_id UUID, ...)` - Validates using `auth.uid() = p_user_id`
- `update_username_discord(p_discord_id TEXT, ...)` - Validates using Discord ID from JWT metadata

Both functions are `SECURITY DEFINER` with explicit authorization checks and identical validation logic (cooldown, XP cost, username rules).

**Implementation Note**: The `discord_id` parameter MUST come from `AuthContext.appUser.discord_id` (already authenticated), never from user input or database query without authentication.

#### 6. JWT Token Security

- **HttpOnly cookies**: Not used (Supabase uses localStorage, acceptable for this use case)
- **Short expiration**: Tokens expire after 1 hour
- **Automatic refresh**: Supabase client refreshes before expiration
- **Secure transmission**: HTTPS only in production

#### 7. Edge Function Security

The `discord-token` edge function is **intentionally public** (no JWT verification):

```toml
# supabase/config.toml
[functions.discord-token]
verify_jwt = false
```

**Why public?**: OAuth code exchange happens BEFORE user has a JWT token. This is standard OAuth flow.

**Why safe?**:
- Only exchanges Discord OAuth codes (single-use, short-lived)
- Returns Discord access token (not Supabase JWT)
- No sensitive data exposed
- Cannot be used to impersonate users

### Attack Vectors Blocked

| Attack | Prevention |
|--------|-----------|
| **Account Hijacking** | Discord ID ownership verification in backfill function |
| **Data Exposure** | Strict RLS policies with auth.uid() checks |
| **XP Manipulation** | All update functions have authorization checks |
| **Stats Manipulation** | Atomic functions with ownership verification |
| **Duplicate Accounts** | Backfill checked before account creation |
| **SQL Injection** | Parameterized queries via Supabase client |
| **CSRF** | JWT tokens in headers (not cookies) |
| **Session Hijacking** | Short-lived tokens with automatic refresh |
| **RLS Bypass** | All queries require authenticated session; unauthenticated queries blocked |

---

## API & RPC Functions

### Supabase RPC Functions

#### 1. `sync_discord_user_data()`
Updates user profile with Discord data.

```typescript
await supabase.rpc('sync_discord_user_data', {
  p_auth_user_id: authUser.id,
  p_discord_id: discordId,
  p_username: username,
  p_avatar: avatar
})
```

**Returns**: Updated user record
**Authorization**: Verifies `auth.uid() == p_auth_user_id`
**Use Case**: Called on login to update username/avatar

#### 2. `backfill_auth_user_id()`
Links legacy account to Supabase Auth identity.

```typescript
const { data: linked } = await supabase.rpc('backfill_auth_user_id', {
  p_discord_id: discordId,
  p_auth_user_id: authUser.id
})
// Returns: true if legacy account linked, false if none exists
```

**Returns**: Boolean (true = linked, false = no legacy account)
**Authorization**: Verifies auth.uid() == p_auth_user_id AND Discord ID ownership
**Use Case**: Migration from old auth system to Supabase Auth

#### 3. `atomic_save_completed_pomodoro()`
Saves pomodoro and updates user stats in single transaction.

```typescript
const { data: pomodoroId } = await supabase.rpc('atomic_save_completed_pomodoro', {
  p_user_id: userId,
  p_discord_id: discordId,
  p_duration_minutes: 25,
  p_xp_earned: 250,
  p_task_name: 'Study React',
  p_notes: 'Learned hooks'
})
```

**Returns**: UUID of created pomodoro
**Authorization**: Verifies user_id belongs to authenticated user
**Use Case**: Called when pomodoro session completes

#### 4. `increment_user_xp()`
Atomically increments user XP.

```typescript
await supabase.rpc('increment_user_xp', {
  p_user_id: userId,
  p_xp_amount: 50
})
```

**Returns**: void
**Authorization**: Verifies user_id belongs to authenticated user
**Use Case**: Bonus XP, achievements, corrections

#### 5. `increment_pomodoro_totals()`
Atomically increments pomodoro statistics.

```typescript
await supabase.rpc('increment_pomodoro_totals', {
  p_user_id: userId,
  p_pomodoro_count: 1,
  p_minutes: 25
})
```

**Returns**: void
**Authorization**: Verifies user_id belongs to authenticated user
**Use Case**: Manual stat corrections, bulk imports

### Edge Functions

#### `discord-token`
Exchanges Discord OAuth code for access token.

**Endpoint**: `https://your-project.supabase.co/functions/v1/discord-token`

**Request**:
```typescript
const response = await fetch(`${SUPABASE_URL}/functions/v1/discord-token`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ code: oauthCode })
})
const { access_token } = await response.json()
```

**Response**:
```json
{
  "access_token": "discord_access_token",
  "token_type": "Bearer",
  "expires_in": 604800,
  "refresh_token": "discord_refresh_token",
  "scope": "identify guilds"
}
```

**Environment Variables**:
- `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_ID_STAGING`
- `DISCORD_CLIENT_SECRET` / `DISCORD_CLIENT_SECRET_STAGING`

**Note**: Function is public (no JWT verification) - this is standard OAuth flow.

---

## Complete Utility Functions Reference

This section documents ALL utility functions in the `src/lib/` directory. Use this as a quick reference when calling these functions from components.

### supabaseAuth.ts

Authentication functions using Supabase Auth with Discord OAuth provider.

#### `authenticateWithSupabase()`
Main authentication entry point for Web mode.

```typescript
export async function authenticateWithSupabase(): Promise<AuthResult>

interface AuthResult {
  user: User          // Supabase Auth user
  session: Session    // JWT session
  appUser: AppUser    // User profile from database
}
```

**Flow**:
1. Checks for existing session via `supabase.auth.getSession()`
2. If session exists: Fetches/creates user profile
3. If no session: Redirects to Discord OAuth via `signInWithDiscord()`

**Returns**: `AuthResult` object with user, session, and appUser

**Throws**:
- `'Failed to get authentication session'` - Session check failed
- `'Failed to load user profile'` - User profile fetch failed
- `'Redirecting to Discord authentication...'` - No session (redirect initiated)

**Usage**:
```typescript
try {
  const { user, session, appUser } = await authenticateWithSupabase()
  console.log('Authenticated:', appUser.username)
} catch (error) {
  console.error('Auth failed:', error)
}
```

---

#### `signInWithDiscord()`
Initiates Discord OAuth flow via Supabase Auth.

```typescript
export async function signInWithDiscord(): Promise<void>
```

**Critical**: Preserves `frame_id` and `instance_id` query params in redirect URL (required for Discord Activity mode).

**Redirect URL**: `${origin}${pathname}${search}` - includes query params

**Scopes**: `identify email guilds`

**Usage**:
```typescript
await signInWithDiscord()
// Browser will redirect to Discord, then back to app
```

---

#### `fetchOrCreateAppUser()`
Fetches or creates user profile with legacy account migration support.

```typescript
export async function fetchOrCreateAppUser(authUser: User): Promise<AppUser>
```

**Flow**:
1. Extract Discord ID from `authUser.user_metadata` (provider_id or sub)
2. Try to find user by `auth_user_id` (current Supabase Auth ID)
3. If exists: Update via `sync_discord_user_data` RPC and return
4. If not: Check for legacy account via `backfill_auth_user_id` RPC
5. If legacy found: Link account and return
6. If none: Create new user profile

**Returns**: `AppUser` object

**Throws**:
- `'Discord authentication failed: missing Discord user ID'` - No Discord ID in metadata
- `'Failed to fetch user profile'` - Database fetch failed
- `'Failed to backfill legacy account'` - Legacy account linking failed
- `'Failed to create user profile'` - New user creation failed

**Security**: `backfill_auth_user_id` RPC verifies Discord ID ownership via JWT metadata to prevent account hijacking.

**Usage**:
```typescript
const appUser = await fetchOrCreateAppUser(session.user)
```

---

#### `signOut()`
Signs out current user.

```typescript
export async function signOut(): Promise<void>
```

**Usage**:
```typescript
await signOut()
// User signed out, session cleared
```

---

#### `getCurrentSession()`
Gets current Supabase Auth session.

```typescript
export async function getCurrentSession(): Promise<Session | null>
```

**Returns**: `Session` if authenticated, `null` otherwise

**Usage**:
```typescript
const session = await getCurrentSession()
if (session) {
  console.log('User ID:', session.user.id)
}
```

---

#### `onAuthStateChange()`
Listens for auth state changes.

```typescript
export function onAuthStateChange(callback: (session: Session | null) => void)
```

**Usage**:
```typescript
const { data: { subscription } } = onAuthStateChange((session) => {
  if (session) {
    console.log('User signed in:', session.user.id)
  } else {
    console.log('User signed out')
  }
})

// Later: subscription.unsubscribe()
```

---

#### `getAvatarUrl()`
Generates Discord avatar URL with CDN.

```typescript
export function getAvatarUrl(user: AppUser, size: number = 128): string
```

**Returns**:
- If `user.avatar` exists: `https://cdn.discordapp.com/avatars/{discord_id}/{avatar}.{png|gif}?size={size}`
- If no avatar: Default Discord avatar (0-5 based on `discord_id % 6`)

**Supports**: Animated avatars (GIF) if hash starts with `a_`

**Usage**:
```typescript
const avatarUrl = getAvatarUrl(appUser, 256)
<img src={avatarUrl} alt="Avatar" />
```

---

### userSyncAuth.ts

User data synchronization functions for settings, stats, and pomodoros.

#### `updateUserPreferences()`
Updates user settings (14 client-controlled fields only).

```typescript
export async function updateUserPreferences(
  userId: string,
  preferences: {
    // Timer (6 fields)
    timer_pomodoro_minutes?: number
    timer_short_break_minutes?: number
    timer_long_break_minutes?: number
    pomodoros_before_long_break?: number
    auto_start_breaks?: boolean
    auto_start_pomodoros?: boolean

    // Visual (3 fields)
    background_id?: string
    playlist?: 'lofi' | 'synthwave'
    ambient_volumes?: Record<string, number>

    // Audio (3 fields)
    sound_enabled?: boolean
    volume?: number
    music_volume?: number

    // System (2 fields)
    level_system_enabled?: boolean
    level_path?: 'elf' | 'human'
  }
): Promise<AppUser>
```

**Security**: Only syncs client-controlled fields. Does NOT sync XP, level, stats (server-controlled).

**Returns**: Updated `AppUser` object

**Usage**:
```typescript
const updatedUser = await updateUserPreferences(userId, {
  timer_pomodoro_minutes: 25,
  playlist: 'lofi',
  sound_enabled: true
})
```

---

#### `saveCompletedPomodoro()`
Saves completed pomodoro atomically with stats update.

```typescript
export async function saveCompletedPomodoro(
  userId: string,
  discordId: string,
  data: {
    duration_minutes: number
    xp_earned: number
    task_name?: string
    notes?: string
  }
): Promise<string>
```

**Calls**: `atomic_save_completed_pomodoro` RPC (single transaction)

**Returns**: UUID of created pomodoro

**Atomic Operations**:
1. Insert into `completed_pomodoros`
2. Update `total_pomodoros` +1
3. Update `total_study_minutes` +duration
4. Update `xp` +xp_earned (with level-up logic)

**Usage**:
```typescript
const pomodoroId = await saveCompletedPomodoro(userId, discordId, {
  duration_minutes: 25,
  xp_earned: 50,
  task_name: 'Study React',
  notes: 'Learned hooks'
})
```

---

#### `getUserStats()`
Fetches user statistics for dashboard.

```typescript
export async function getUserStats(userId: string): Promise<{
  totalPomodoros: number
  totalMinutes: number
  averagePerDay: number
  currentStreak: number
}>
```

**Calculates**: `averagePerDay = totalPomodoros / totalUniqueDays`

**Usage**:
```typescript
const stats = await getUserStats(userId)
console.log('Streak:', stats.currentStreak)
```

---

#### `updateUsernameSecure()`
Updates username with cooldown enforcement and optional XP cost. **Supports dual authentication modes.**

```typescript
export async function updateUsernameSecure(
  userId: string,
  discordId: string,
  newUsername: string,
  forceWithXP: boolean = false
): Promise<AppUser>
```

**Dual Mode Support**:
- **Web Mode**: Uses `update_username` RPC (verifies `auth.uid()`)
- **Discord Activity Mode**: Uses `update_username_discord` RPC (verifies `discord_id`)

**Cooldown**: 7 days (168 hours) between changes

**XP Cost**: 50 XP to bypass cooldown (if `forceWithXP = true`)

**Validation**:
- Max 20 characters
- No empty strings
- Atomically deducts XP if forcing

**Returns**: Updated `AppUser` object

**Throws**:
- `'Failed to update username: Still on cooldown (X hours remaining)'` - Cooldown active
- `'Failed to update username: Insufficient XP'` - Not enough XP to force
- `'Failed to update username: Username too long'` - Exceeds 20 chars

**Usage**:
```typescript
// Normal update (respects cooldown)
try {
  const updatedUser = await updateUsernameSecure(userId, discordId, 'NewName', false)
  toast.success('Username updated!')
} catch (error) {
  if (error.message.includes('cooldown')) {
    // Show XP payment option
    toast.error(`On cooldown. Pay 50 XP to change now?`)
  }
}

// Force update with XP
const updatedUser = await updateUsernameSecure(userId, discordId, 'NewName', true)
// 50 XP deducted, username changed
```

---

#### `getRecentPomodoros()`
Fetches recent completed pomodoros.

```typescript
export async function getRecentPomodoros(userId: string, limit: number = 10): Promise<any[]>
```

**Returns**: Array of pomodoro objects, sorted by `completed_at` descending

**Usage**:
```typescript
const recent = await getRecentPomodoros(userId, 5)
recent.forEach(p => console.log(p.task_name, p.duration_minutes))
```

---

#### `incrementUserXP()`
Manually increments user XP (for corrections, bonuses).

```typescript
export async function incrementUserXP(userId: string, xpToAdd: number): Promise<void>
```

**Usage**:
```typescript
await incrementUserXP(userId, 100) // Add 100 XP
```

---

#### `incrementPomodoroTotals()`
Manually increments pomodoro statistics (for corrections, imports).

```typescript
export async function incrementPomodoroTotals(
  userId: string,
  pomodoroCount: number,
  minutes: number
): Promise<void>
```

**Usage**:
```typescript
await incrementPomodoroTotals(userId, 5, 125) // Add 5 pomodoros, 125 minutes
```

---

#### `unlockMilestoneReward()`
Unlocks a milestone reward for the user.

```typescript
export async function unlockMilestoneReward(
  userId: string,
  rewardType: 'background' | 'theme' | 'badge' | 'playlist',
  unlockId: string,
  milestoneId?: string
): Promise<string>
```

**Returns**: UUID of unlocked reward

**Usage**:
```typescript
const rewardId = await unlockMilestoneReward(userId, 'background', 'forest-night', 'milestone-day-7')
```

---

#### `getUserUnlockedRewards()`
Fetches all unlocked rewards for a user.

```typescript
export async function getUserUnlockedRewards(
  userId: string,
  rewardType?: 'background' | 'theme' | 'badge' | 'playlist'
): Promise<Array<{
  id: string
  reward_type: string
  unlock_id: string
  milestone_id: string | null
  unlocked_at: string
}>>
```

**Usage**:
```typescript
const backgrounds = await getUserUnlockedRewards(userId, 'background')
```

---

#### `isRewardUnlocked()`
Checks if a specific reward is unlocked.

```typescript
export async function isRewardUnlocked(
  userId: string,
  rewardType: 'background' | 'theme' | 'badge' | 'playlist',
  unlockId: string
): Promise<boolean>
```

**Usage**:
```typescript
const hasForest = await isRewardUnlocked(userId, 'background', 'forest-night')
```

---

### levels.ts

Level system calculation functions.

#### `getLevelName()`
Gets level name for level path.

```typescript
export function getLevelName(level: number, path: 'elf' | 'human'): string
```

**Returns**: Emoji + name (e.g., "🌱 Tomato Seed", "⚔️ Tomato Warrior")

**Usage**:
```typescript
const name = getLevelName(5, 'elf') // "🌾 Healthy Plant"
```

---

#### `getXPNeeded()`
Calculates XP needed for next level.

```typescript
export function getXPNeeded(level: number): number
```

**Formula**: `level × 100`

**Examples**:
- Level 1 → 2: 100 XP
- Level 5 → 6: 500 XP
- Level 10 → 11: 1000 XP

**Usage**:
```typescript
const needed = getXPNeeded(5) // 500 XP
```

---

#### `getTotalXPForLevel()`
Calculates total cumulative XP to reach a level.

```typescript
export function getTotalXPForLevel(level: number): number
```

**Example**: Level 5 requires `100 + 200 + 300 + 400 = 1000 total XP`

**Usage**:
```typescript
const total = getTotalXPForLevel(5) // 1000 XP
```

---

#### `getBadgeForLevel()`
Gets emoji badge for level with prestige stars.

```typescript
export function getBadgeForLevel(level: number, prestigeLevel: number): string
```

**Returns**: Badge emoji + prestige stars (max 5)

**Examples**:
- Level 5, Prestige 0: "🌱"
- Level 10, Prestige 2: "🌿⭐⭐"
- Level 20, Prestige 5: "🍅⭐⭐⭐⭐⭐"

**Usage**:
```typescript
const badge = getBadgeForLevel(10, 2) // "🌿⭐⭐"
```

---

### discordAuth.ts

Discord SDK authentication functions (Discord Activity mode only).

#### `authenticateDiscordUser()`
Authenticates user via Discord Embedded SDK.

```typescript
export async function authenticateDiscordUser(): Promise<AuthResult>

interface AuthResult {
  discordUser: DiscordUser
  discordSdk: DiscordSDK | DiscordSDKMock
  accessToken: string
}
```

**Flow**:
1. Verify running in Discord context (checks `frame_id`/`instance_id` params)
2. Initialize Discord SDK
3. Authorize with Discord (prompt: "none" for auto-login, fallback to "consent")
4. Exchange code for access token via `/supabase/functions/v1/discord-token`
5. Authenticate SDK with access token
6. Fetch user data from `https://discord.com/api/users/@me`

**Scopes**: `identify guilds guilds.members.read`

**Returns**: `AuthResult` with Discord user, SDK instance, and access token

**Throws**:
- `'Discord Activities must be launched from Discord'` - Not in Discord iframe
- `'Failed to exchange authorization code'` - Token exchange failed
- `'Failed to fetch Discord user data'` - User data fetch failed

**Usage**:
```typescript
const { discordUser, discordSdk, accessToken } = await authenticateDiscordUser()
console.log('Discord user:', discordUser.username)
```

---

#### `getAvatarUrl()` (Discord version)
Gets Discord user avatar URL.

```typescript
export function getAvatarUrl(user: DiscordUser, size: number = 128): string
```

**Returns**:
- If avatar exists: `https://cdn.discordapp.com/avatars/{id}/{avatar}.{png|gif}?size={size}`
- If no avatar: Default avatar (0-4 based on `discriminator % 5`)

**Usage**:
```typescript
const url = getAvatarUrl(discordUser, 256)
```

---

#### `getVoiceChannelParticipants()`
Gets current voice channel participants.

```typescript
export async function getVoiceChannelParticipants(
  discordSdk: DiscordSDK | DiscordSDKMock
): Promise<any[]>
```

**Returns**: Array of participant objects

**Usage**:
```typescript
const participants = await getVoiceChannelParticipants(discordSdk)
console.log('Users in voice:', participants.length)
```

---

## Database RPC Functions (Complete Reference)

This section documents all PostgreSQL RPC (Remote Procedure Call) functions with complete SQL signatures, authorization logic, and security considerations.

### Core Principles

**SECURITY DEFINER Functions**: All RPCs use `SECURITY DEFINER` to bypass RLS policies. Each function MUST explicitly verify ownership/authorization before proceeding.

**Hybrid Authentication**: Functions support both:
- **Web Mode**: Verifies `auth.uid()` (Supabase Auth JWT)
- **Discord Activity Mode**: Verifies `discord_id` (Discord SDK)

**Atomic Transactions**: Multiple database operations wrapped in single transaction to prevent inconsistent state.

---

### 1. `atomic_save_completed_pomodoro()`

Saves completed pomodoro and updates user stats in single atomic transaction. **Supports hybrid authentication.**

```sql
CREATE OR REPLACE FUNCTION public.atomic_save_completed_pomodoro(
  p_user_id UUID,
  p_discord_id TEXT,
  p_duration_minutes INTEGER,
  p_xp_earned INTEGER,
  p_task_name TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID
```

**Authorization**:
```sql
IF auth.uid() IS NOT NULL THEN
  -- Web mode: Verify auth_user_id matches
  WHERE id = p_user_id AND auth_user_id = auth.uid()
ELSE
  -- Discord Activity mode: Verify discord_id matches
  WHERE id = p_user_id AND discord_id = p_discord_id
END IF
```

**Operations** (atomic):
1. Insert into `completed_pomodoros` (returns UUID)
2. Update `users.total_pomodoros` +1
3. Update `users.total_study_minutes` +duration
4. Update `users.xp` +xp_earned

**Validation**:
- `p_user_id` NOT NULL
- `p_duration_minutes` > 0
- `p_xp_earned` >= 0
- `p_discord_id` required if `auth.uid()` is NULL

**Returns**: UUID of created pomodoro

**Grants**: `authenticated, anon` (safe because function verifies ownership)

**Usage**:
```typescript
const { data: pomodoroId } = await supabase.rpc('atomic_save_completed_pomodoro', {
  p_user_id: userId,
  p_discord_id: discordId,
  p_duration_minutes: 25,
  p_xp_earned: 50,
  p_task_name: 'Study React',
  p_notes: 'Learned hooks'
})
```

**Why Atomic**: Prevents partial failures where pomodoro is saved but stats are not updated (or vice versa).

---

### 2. `sync_discord_user_data()`

Syncs Discord user data from OAuth metadata. **Preserves custom usernames.**

```sql
CREATE OR REPLACE FUNCTION public.sync_discord_user_data(
  p_auth_user_id UUID,
  p_discord_id TEXT,
  p_username TEXT,
  p_avatar TEXT
)
RETURNS public.users
```

**Authorization**:
```sql
-- Verify caller is updating their own profile
IF auth.uid() IS NULL THEN
  RAISE EXCEPTION 'Authentication required'
END IF

IF auth.uid() != p_auth_user_id THEN
  RAISE EXCEPTION 'Unauthorized: Cannot update another user''s profile'
END IF
```

**Username Preservation Logic**:
```sql
ON CONFLICT (discord_id) DO UPDATE SET
  username = CASE
    WHEN users.last_username_change IS NULL THEN EXCLUDED.username
    ELSE users.username  -- Preserve custom username
  END,
  avatar = EXCLUDED.avatar,
  last_login = EXCLUDED.last_login
```

**Returns**: Updated `users` row

**Grants**: `authenticated` only

**Usage**:
```typescript
const { data: updatedUser } = await supabase.rpc('sync_discord_user_data', {
  p_auth_user_id: authUser.id,
  p_discord_id: discordId,
  p_username: username,
  p_avatar: avatar
})
```

**Security**: Upserts on `discord_id` but only sets `auth_user_id` if currently NULL (prevents account hijacking).

---

### 3. `backfill_auth_user_id()`

Links legacy account (discord_id exists, auth_user_id is NULL) to Supabase Auth identity. **Prevents account hijacking via Discord ID verification.**

```sql
CREATE OR REPLACE FUNCTION public.backfill_auth_user_id(
  p_discord_id TEXT,
  p_auth_user_id UUID
)
RETURNS BOOLEAN
```

**Authorization**:
```sql
-- Verify caller is updating their own account
IF auth.uid() IS NULL THEN
  RAISE EXCEPTION 'Authentication required'
END IF

IF auth.uid() != p_auth_user_id THEN
  RAISE EXCEPTION 'Unauthorized: Cannot backfill another user''s auth_user_id'
END IF
```

**CRITICAL SECURITY - Discord ID Ownership Verification**:
```sql
-- Extract Discord ID from JWT metadata
SELECT raw_user_meta_data INTO v_user_metadata
FROM auth.users
WHERE id = auth.uid()

v_jwt_discord_id := COALESCE(
  v_user_metadata->>'provider_id',
  v_user_metadata->>'sub',
  auth.uid()::text
)

-- VERIFY MATCH (prevents account hijacking)
IF v_jwt_discord_id IS NULL OR v_jwt_discord_id != p_discord_id THEN
  RAISE EXCEPTION 'Unauthorized: discord_id does not match authenticated Discord identity'
END IF
```

**Update**:
```sql
UPDATE public.users
SET auth_user_id = p_auth_user_id,
    updated_at = NOW()
WHERE discord_id = p_discord_id
AND auth_user_id IS NULL
```

**Returns**: `TRUE` if legacy account was linked, `FALSE` if none exists

**Grants**: `authenticated` only

**Usage**:
```typescript
const { data: linked } = await supabase.rpc('backfill_auth_user_id', {
  p_discord_id: discordId,
  p_auth_user_id: authUser.id
})

if (linked === true) {
  console.log('Legacy account successfully linked')
} else {
  console.log('No legacy account found - will create new user')
}
```

**Why Discord ID Verification is Critical**: Without it, an attacker could call this function with a victim's `discord_id` and steal their entire account (XP, stats, pomodoros). The JWT metadata verification ensures only the actual Discord account owner can link the account.

---

### 4. `update_username()`

Updates username with 7-day cooldown or 50 XP cost bypass. **Web mode only (requires `auth.uid()`).**

```sql
CREATE OR REPLACE FUNCTION public.update_username(
  p_user_id UUID,
  p_new_username TEXT,
  p_force_with_xp BOOLEAN DEFAULT FALSE
)
RETURNS public.users
```

**Authorization**:
```sql
-- Verify caller owns this user profile
IF auth.uid() IS NULL THEN
  RAISE EXCEPTION 'Authentication required'
END IF

SELECT * INTO v_user
FROM public.users
WHERE id = p_user_id AND auth_user_id = auth.uid()

IF v_user IS NULL THEN
  RAISE EXCEPTION 'Unauthorized: Cannot update another user''s username'
END IF
```

**Validation**:
- Username not empty
- Username <= 20 characters

**Cooldown Logic**:
```sql
v_cooldown_ms := 604800000  -- 7 days in milliseconds
v_xp_cost := 50

IF last_username_change IS NOT NULL THEN
  v_time_since_change := EXTRACT(EPOCH FROM (NOW() - last_username_change)) * 1000

  IF v_time_since_change < v_cooldown_ms THEN
    IF p_force_with_xp THEN
      -- Deduct XP and update username (atomic)
      IF xp < v_xp_cost THEN
        RAISE EXCEPTION 'Insufficient XP: Need % XP (you have %)', v_xp_cost, xp
      END IF

      UPDATE users SET
        username = p_new_username,
        xp = xp - v_xp_cost,
        last_username_change = NOW()
    ELSE
      -- Cooldown hasn't passed, user not paying XP
      RAISE EXCEPTION 'Username change is on cooldown. Wait % more hours or pay % XP',
        ROUND((v_cooldown_ms - v_time_since_change) / 3600000.0, 1),
        v_xp_cost
    END IF
  END IF
END IF

-- Cooldown passed - free username change
UPDATE users SET
  username = p_new_username,
  last_username_change = NOW()
```

**Returns**: Updated `users` row

**Grants**: `authenticated` only

**Usage**: See `updateUsernameSecure()` in Section 13

**Why Atomic**: XP deduction and username update happen in same transaction - prevents race conditions where XP is deducted but username update fails.

---

### 5. `update_username_discord()`

Identical logic to `update_username()` but uses `discord_id` for authorization instead of `auth.uid()`. **Discord Activity mode only.**

```sql
CREATE OR REPLACE FUNCTION public.update_username_discord(
  p_discord_id TEXT,
  p_new_username TEXT,
  p_force_with_xp BOOLEAN DEFAULT FALSE
)
RETURNS public.users
```

**Authorization**:
```sql
-- Fetch user by Discord ID (verified by Discord SDK)
SELECT * INTO v_user
FROM public.users
WHERE discord_id = p_discord_id

IF v_user IS NULL THEN
  RAISE EXCEPTION 'User not found for Discord ID: %', p_discord_id
END IF
```

**Validation & Cooldown Logic**: Identical to `update_username()`

**Returns**: Updated `users` row

**Grants**: `anon, authenticated` (safe because Discord ID comes from Discord SDK)

**Usage**: See `updateUsernameSecure()` in Section 13

**Security**: Discord ID is verified by Discord's OAuth flow and cannot be spoofed without valid access token.

---

### 6. `update_user_preferences()`

Updates user preferences (14 client-controlled fields). **Does NOT update XP, level, or stats.**

```sql
CREATE OR REPLACE FUNCTION public.update_user_preferences(
  p_user_id UUID,
  -- Timer (6 fields)
  p_timer_pomodoro_minutes INTEGER DEFAULT NULL,
  p_timer_short_break_minutes INTEGER DEFAULT NULL,
  p_timer_long_break_minutes INTEGER DEFAULT NULL,
  p_pomodoros_before_long_break INTEGER DEFAULT NULL,
  p_auto_start_breaks BOOLEAN DEFAULT NULL,
  p_auto_start_pomodoros BOOLEAN DEFAULT NULL,
  -- Visual (3 fields)
  p_background_id TEXT DEFAULT NULL,
  p_playlist TEXT DEFAULT NULL,
  p_ambient_volumes JSONB DEFAULT NULL,
  -- Audio (3 fields)
  p_sound_enabled BOOLEAN DEFAULT NULL,
  p_volume INTEGER DEFAULT NULL,
  p_music_volume INTEGER DEFAULT NULL,
  -- System (2 fields)
  p_level_system_enabled BOOLEAN DEFAULT NULL,
  p_level_path TEXT DEFAULT NULL
)
RETURNS public.users
```

**Authorization**:
```sql
IF auth.uid() IS NULL THEN
  RAISE EXCEPTION 'Authentication required'
END IF

IF NOT EXISTS (
  SELECT 1 FROM public.users
  WHERE id = p_user_id AND auth_user_id = auth.uid()
) THEN
  RAISE EXCEPTION 'Unauthorized: Cannot update another user''s preferences'
END IF
```

**Update Logic**:
```sql
UPDATE public.users
SET
  timer_pomodoro_minutes = COALESCE(p_timer_pomodoro_minutes, timer_pomodoro_minutes),
  -- ... repeat for all 14 fields
  updated_at = NOW()
WHERE id = p_user_id
```

**SECURITY**: Only updates client-controlled fields. Does NOT accept parameters for:
- `xp`, `level`, `prestige_level`
- `total_pomodoros`, `total_study_minutes`
- `total_unique_days`, `consecutive_login_days`

These fields are updated ONLY through server-validated endpoints like `atomic_save_completed_pomodoro()`.

**Returns**: Updated `users` row

**Grants**: `authenticated` only

**Usage**: See `updateUserPreferences()` in Section 13

---

### 7. `unlock_milestone_reward()`

Unlocks a reward for a user. Idempotent (safe to call multiple times).

```sql
CREATE OR REPLACE FUNCTION public.unlock_milestone_reward(
  p_user_id UUID,
  p_reward_type TEXT,
  p_unlock_id TEXT,
  p_milestone_id TEXT DEFAULT NULL
)
RETURNS UUID
```

**Authorization**:
```sql
IF auth.uid() IS NULL THEN
  RAISE EXCEPTION 'Authentication required'
END IF

IF NOT EXISTS (
  SELECT 1 FROM public.users
  WHERE id = p_user_id AND auth_user_id = auth.uid()
) THEN
  RAISE EXCEPTION 'Unauthorized: Cannot unlock rewards for another user'
END IF
```

**Validation**:
```sql
IF p_reward_type NOT IN ('background', 'theme', 'badge', 'playlist') THEN
  RAISE EXCEPTION 'Invalid reward_type: %', p_reward_type
END IF
```

**Insert Logic**:
```sql
INSERT INTO public.user_unlocked_rewards (user_id, reward_type, unlock_id, milestone_id)
VALUES (p_user_id, p_reward_type, p_unlock_id, p_milestone_id)
ON CONFLICT (user_id, reward_type, unlock_id) DO NOTHING
RETURNING id INTO v_reward_id

-- If already unlocked, fetch existing ID
IF v_reward_id IS NULL THEN
  SELECT id INTO v_reward_id
  FROM public.user_unlocked_rewards
  WHERE user_id = p_user_id AND reward_type = p_reward_type AND unlock_id = p_unlock_id
END IF
```

**Returns**: UUID of reward (new or existing)

**Grants**: `authenticated` only

**Usage**: See `unlockMilestoneReward()` in Section 13

**Idempotent**: Safe to call multiple times - returns existing reward ID if already unlocked.

---

### 8. `get_user_unlocked_rewards()`

Retrieves all unlocked rewards for a user, optionally filtered by type.

```sql
CREATE OR REPLACE FUNCTION public.get_user_unlocked_rewards(
  p_user_id UUID,
  p_reward_type TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  reward_type TEXT,
  unlock_id TEXT,
  milestone_id TEXT,
  unlocked_at TIMESTAMPTZ
)
```

**Authorization**: Same as `unlock_milestone_reward()`

**Query**:
```sql
SELECT
  r.id,
  r.reward_type,
  r.unlock_id,
  r.milestone_id,
  r.unlocked_at
FROM public.user_unlocked_rewards r
WHERE r.user_id = p_user_id
  AND (p_reward_type IS NULL OR r.reward_type = p_reward_type)
ORDER BY r.unlocked_at DESC
```

**Returns**: Table of rewards

**Grants**: `authenticated` only

**Usage**: See `getUserUnlockedRewards()` in Section 13

---

### 9. `handle_new_user()` (Trigger Function)

Automatically creates user profile when new auth user signs up via Discord OAuth. **Trigger on `auth.users` INSERT.**

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
```

**Execution**:
```sql
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user()
```

**Extract Metadata**:
```sql
v_discord_id := COALESCE(
  NEW.raw_user_meta_data->>'provider_id',
  NEW.raw_user_meta_data->>'sub',
  NEW.id::text
)

v_username := COALESCE(
  NEW.raw_user_meta_data->>'full_name',
  NEW.raw_user_meta_data->>'name',
  NEW.raw_user_meta_data->>'user_name',
  NEW.raw_user_meta_data->>'username',
  'Discord User ' || substring(v_discord_id, 1, 8)
)

v_avatar := COALESCE(
  NEW.raw_user_meta_data->>'avatar_url',
  NEW.raw_user_meta_data->>'picture'
)
```

**Insert/Update**:
```sql
INSERT INTO public.users (
  auth_user_id, discord_id, username, avatar, created_at, updated_at
) VALUES (
  NEW.id, v_discord_id, v_username, v_avatar, NOW(), NOW()
)
ON CONFLICT (auth_user_id) DO UPDATE SET
  username = EXCLUDED.username,
  avatar = EXCLUDED.avatar,
  updated_at = NOW()
```

**Grants**: Implicit (trigger)

**Why Needed**: Automatically creates user profile when user authenticates via Discord OAuth. Handles Discord users without email addresses.

---

### 10. `update_username_with_cooldown()` (DEPRECATED)

Legacy username update function. **Use `update_username()` or `update_username_discord()` instead.**

```sql
CREATE OR REPLACE FUNCTION public.update_username_with_cooldown(
  p_user_id UUID,
  p_new_username TEXT,
  p_cooldown_hours INTEGER DEFAULT 720 -- 30 days
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  user_data public.users
)
```

**Deprecated**: Does not support XP cost bypass. Returns table instead of user row (awkward API).

**Replacement**: Use `update_username()` (Web) or `update_username_discord()` (Discord Activity)

---

### Security Summary

**All RPC Functions**:
1. ✅ Verify caller identity (`auth.uid()` or `discord_id`)
2. ✅ Check ownership before operations
3. ✅ Use `SECURITY DEFINER` to bypass RLS (with explicit verification)
4. ✅ Validate inputs (non-empty, length checks, type checks)
5. ✅ Atomic operations (single transaction)
6. ✅ Grant minimal permissions (authenticated or anon+authenticated for hybrid)

**Attack Vectors Prevented**:
- Account hijacking (Discord ID verification in `backfill_auth_user_id`)
- XP manipulation (client cannot call XP update functions directly)
- Stats manipulation (server-controlled fields not exposed in `update_user_preferences`)
- Username bypass (cooldown enforced server-side, XP deducted atomically)
- Unauthorized access (all functions verify ownership)

---

## File Structure

```
pomodoro-staging/
├── public/
│   ├── sounds/               # Sound effect assets
│   └── favicon.ico
├── src/
│   ├── components/
│   │   ├── PomodoroTimer.tsx       # Main timer component
│   │   ├── StatsDashboard.tsx      # User statistics display
│   │   ├── Settings.tsx            # Settings panel
│   │   ├── LevelSystem.tsx         # XP/level UI
│   │   └── MusicPlayer.tsx         # Background music player
│   ├── contexts/
│   │   ├── AuthContext.tsx         # Auth state management
│   │   └── SettingsContext.tsx     # User settings state
│   ├── lib/
│   │   ├── supabase.ts             # Supabase client initialization
│   │   ├── supabaseAuth.ts         # Auth functions (Discord OAuth)
│   │   ├── userSyncAuth.ts         # User data sync functions
│   │   ├── levelSystem.ts          # Level/XP calculation logic
│   │   └── discordSdk.ts           # Discord Embedded App SDK setup
│   ├── types/
│   │   └── index.ts                # TypeScript type definitions
│   ├── App.tsx                     # Root component
│   ├── main.tsx                    # App entry point
│   └── index.css                   # Global styles (Tailwind)
├── supabase/
│   ├── functions/
│   │   ├── discord-token/
│   │   │   └── index.ts            # OAuth token exchange function
│   │   └── _shared/
│   │       └── cors.ts             # CORS headers
│   ├── migrations/
│   │   ├── 20251110170000_add_supabase_auth_integration.sql
│   │   ├── 20251110171000_update_atomic_functions_for_auth.sql
│   │   ├── 20251110173000_fix_null_auth_user_id_lockout.sql
│   │   └── 20251110174000_atomic_save_pomodoro.sql
│   └── config.toml                 # Supabase configuration
├── .env                            # Environment variables (gitignored)
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
├── PROJECT.md                      # This file
└── README.md
```

### Key Files Explained

#### `src/lib/supabaseAuth.ts`
Central authentication module. Handles:
- Discord OAuth initiation
- Session management
- User profile fetching/creation
- Legacy account migration (backfill)

**Key Functions**:
- `authenticateWithSupabase()` - Main auth entry point
- `signInWithDiscord()` - Initiates OAuth flow
- `fetchOrCreateAppUser()` - Gets/creates user profile
- `getAvatarUrl()` - Generates Discord avatar URLs

#### `src/lib/userSyncAuth.ts`
User data synchronization functions. Handles:
- Fetching user stats
- Saving completed pomodoros
- Updating user settings
- XP/level calculations

**Key Functions**:
- `getUserStats()` - Fetches user statistics
- `saveCompletedPomodoro()` - Saves pomodoro (calls RPC)
- `updateUserSettings()` - Updates user preferences

#### `src/lib/levelSystem.ts`
Level and XP calculation logic.

**Key Functions**:
- `calculateLevel()` - Determines level from XP
- `getXpForLevel()` - Calculates XP required for level
- `getXpProgress()` - Calculates % progress to next level
- `calculateXpEarned()` - XP earned for session (10 XP/min)

**Formula**: `XP for level N = 100 * N²`

Example:
- Level 1: 100 XP
- Level 2: 400 XP (cumulative: 500 XP)
- Level 3: 900 XP (cumulative: 1,400 XP)

#### `src/components/PomodoroTimer.tsx`
Main timer component. Features:
- Countdown timer with visual progress
- Start/pause/reset controls
- Duration selection
- Task name input
- Completion handling (saves to DB)
- Sound effects

#### `src/contexts/AuthContext.tsx`
Auth state management via React Context.

**Provides**:
- `user`: Current authenticated user
- `session`: Supabase session
- `appUser`: User profile data
- `loading`: Auth loading state
- `signOut()`: Sign out function

---

## Environment Variables

### Frontend (.env)

```bash
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here

# Optional: Discord Application ID (for SDK)
VITE_DISCORD_CLIENT_ID=your_discord_client_id
```

### Edge Functions (Supabase Secrets)

Set via Supabase CLI:

```bash
# Production Discord OAuth
supabase secrets set DISCORD_CLIENT_ID="your_production_client_id"
supabase secrets set DISCORD_CLIENT_SECRET="your_production_secret"

# Staging Discord OAuth (optional)
supabase secrets set DISCORD_CLIENT_ID_STAGING="your_staging_client_id"
supabase secrets set DISCORD_CLIENT_SECRET_STAGING="your_staging_secret"
```

**Access in Edge Functions**:
```typescript
const clientId = Deno.env.get('DISCORD_CLIENT_ID')
const clientSecret = Deno.env.get('DISCORD_CLIENT_SECRET')
```

---

## Development Workflow

### Initial Setup

```bash
# 1. Clone repository
git clone <repository-url>
cd pomodoro-staging

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
# Edit .env with your Supabase credentials

# 4. Link to Supabase project (if using Supabase CLI)
supabase link --project-ref your-project-ref

# 5. Run migrations (if needed)
supabase db push

# 6. Start development server
npm run dev
```

### Development Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Type checking
npm run type-check

# Lint code
npm run lint

# Format code
npm run format
```

### Supabase CLI Commands

```bash
# Link to project
supabase link --project-ref your-project-ref

# Run migrations
supabase db push

# Create new migration
supabase migration new migration_name

# Deploy edge function
supabase functions deploy discord-token --no-verify-jwt

# Set edge function secrets
supabase secrets set KEY=value

# View logs
supabase functions logs discord-token

# Generate TypeScript types from database
supabase gen types typescript --local > src/types/database.ts
```

### Git Workflow

```bash
# Create feature branch
git checkout -b feature/your-feature-name

# Make changes, commit frequently
git add .
git commit -m "feat: add feature description"

# Push to remote
git push origin feature/your-feature-name

# After review, merge to main
git checkout main
git merge feature/your-feature-name
git push origin main
```

### Testing Discord Activity Locally

1. **Enable HTTPS locally** (Discord requires HTTPS):
   ```bash
   # Use ngrok or similar
   ngrok http 5173
   ```

2. **Update Discord Activity URL**:
   - Go to Discord Developer Portal
   - Update Activity URL to your ngrok URL

3. **Test in Discord**:
   - Open Discord
   - Start your Activity from Activities menu
   - Should see app in iframe

---

## Migration History & Architecture Decisions

This section documents the database migration timeline and key architectural decisions made during development. Understanding the "why" behind these decisions helps maintain consistency and avoid regressions.

### Migration Timeline (Chronological)

#### 1. Initial Schema Creation
**File**: `20250110_create_users_table.sql`
**Date**: 2025-01-10

**Created**:
- `users` table with Discord-based authentication
- `completed_pomodoros` table
- Initial RLS policies (anon-permissive, later tightened)

**Fields**:
- `discord_id` (primary identity, no Supabase Auth yet)
- `username`, `avatar`, `xp`, `level`, `prestige_level`
- `total_pomodoros`, `total_study_minutes`
- Audio/visual preferences

**Decision**: Started with Discord-only authentication (simpler initial implementation).

---

#### 2. Supabase Auth Integration
**File**: `20251110170000_add_supabase_auth_integration.sql`
**Date**: 2025-11-10

**Changes**:
- Added `auth_user_id` column (references `auth.users`)
- Created strict RLS policies using `auth.uid()`
- Created `sync_discord_user_data()` RPC
- Created `handle_new_user()` trigger (auto-creates profile on signup)

**Why**: Discord Activity doesn't support traditional auth, but web version needs proper JWT-based security. Dual authentication enables both modes.

**Migration Path**: Existing users had `discord_id` but no `auth_user_id` (NULL). Next migration handles linking.

---

#### 3. Fix NULL auth_user_id Lockout
**File**: `20251110173000_fix_null_auth_user_id_lockout.sql`
**Date**: 2025-11-10

**Problem**: Strict RLS policies (`auth.uid() = auth_user_id`) locked out unmigrated users (auth_user_id IS NULL).

**Solution**: Created `backfill_auth_user_id()` RPC with **critical security**:
```sql
-- VERIFY Discord ID ownership via JWT metadata
v_jwt_discord_id := COALESCE(
  v_user_metadata->>'provider_id',
  v_user_metadata->>'sub'
)

IF v_jwt_discord_id != p_discord_id THEN
  RAISE EXCEPTION 'Unauthorized: discord_id does not match'
END IF
```

**Why Critical**: Without Discord ID verification, attackers could link any `discord_id` to their account and steal XP/stats.

**Uses**: `SECURITY DEFINER` to bypass RLS during migration (with explicit auth checks).

---

#### 4. Atomic Save Pomodoro
**File**: `20251110174000_atomic_save_pomodoro.sql`
**Date**: 2025-11-10

**Created**: `atomic_save_completed_pomodoro()` RPC

**Operations** (single transaction):
1. Insert pomodoro
2. Update `total_pomodoros` +1
3. Update `total_study_minutes` +duration
4. Update `xp` +xp_earned

**Why Atomic**: Prevents partial failures (e.g., pomodoro saved but stats not updated). Ensures data consistency.

**Initial Version**: Only supported `auth.uid()` verification (Web mode).

---

#### 5. User Preferences Sync
**File**: `20251113000000_add_user_preferences_sync.sql`
**Date**: 2025-11-13

**Added Columns** (14 client-controlled fields):
- Timer: `timer_pomodoro_minutes`, `timer_short_break_minutes`, `timer_long_break_minutes`, `pomodoros_before_long_break`, `auto_start_breaks`, `auto_start_pomodoros`
- Visual: `background_id`, `playlist`, `ambient_volumes`
- Audio: (already existed: `sound_enabled`, `volume`, `music_volume`)
- System: `level_system_enabled`, `level_path`

**Added**: `last_username_change` column (for cooldown tracking)

**Created Tables**:
- `user_unlocked_rewards` (milestone system)

**Created RPCs**:
- `update_user_preferences()` - Only updates client-controlled fields
- `unlock_milestone_reward()` - Idempotent reward unlocking
- `get_user_unlocked_rewards()` - Fetch rewards
- `update_username_with_cooldown()` - Legacy username update

**Security Design**: Separation of client-controlled (preferences) vs server-controlled (XP, stats) fields.

---

#### 6. Username Preservation
**File**: `20251113_preserve_custom_usernames.sql`
**Date**: 2025-11-13

**Problem**: Every login via Discord OAuth overwrote custom usernames with Discord display name.

**Solution**: Modified `sync_discord_user_data()` to check `last_username_change`:
```sql
username = CASE
  WHEN users.last_username_change IS NULL THEN EXCLUDED.username
  ELSE users.username  -- Preserve custom username
END
```

**Logic**:
- `last_username_change IS NULL` → Sync Discord name (user hasn't customized)
- `last_username_change IS NOT NULL` → Preserve custom name

**Why Flag-Based**: Simple, reliable, no race conditions. Flag is set when user manually changes username.

---

#### 7. Username Update Function
**File**: `20251113_username_update_function.sql`
**Date**: 2025-11-13

**Created**: `update_username()` RPC with:
- 7-day cooldown (604800000ms)
- 50 XP cost to bypass cooldown
- Atomic XP deduction + username update
- Sets `last_username_change = NOW()` (enables preservation)

**Validation**:
- Max 20 characters
- Not empty
- Sufficient XP if forcing

**Why Server-Side**: Prevents bypassing XP cost via direct `update_user_settings()` call. Cooldown enforcement cannot be client-side.

---

#### 8. Hybrid Auth Atomic Save Pomodoro
**File**: `20251116_hybrid_auth_atomic_save_pomodoro.sql`
**Date**: 2025-11-16

**Updated**: `atomic_save_completed_pomodoro()` to support **dual authentication**:
```sql
IF auth.uid() IS NOT NULL THEN
  -- Web mode: Verify auth_user_id
  WHERE id = p_user_id AND auth_user_id = auth.uid()
ELSE
  -- Discord Activity mode: Verify discord_id
  WHERE id = p_user_id AND discord_id = p_discord_id
END IF
```

**Grants**: `authenticated, anon` (anon needed for Discord Activity)

**Why**: Discord Activity iframe has no Supabase Auth session (`auth.uid()` is NULL). Must verify `discord_id` instead.

**Security**: Discord ID verified by Discord SDK OAuth flow - cannot be spoofed.

---

#### 9. Discord Username Update
**File**: `20251117154831_add_discord_username_update.sql`
**Date**: 2025-11-17

**Created**: `update_username_discord()` RPC

**Same Logic** as `update_username()` but:
- Uses `discord_id` for authorization (instead of `auth.uid()`)
- Grants `anon, authenticated` (for Discord Activity)

**Why Separate Function**: Cannot use `auth.uid()` in Discord Activity mode - need `discord_id` parameter.

**Security**: Discord ID comes from Discord SDK (verified via OAuth).

---

### Architecture Decisions

#### 1. Why Zustand Over Redux?

**Decision**: Use Zustand for global state management

**Reasons**:
- **Simpler API**: No reducers, actions, or boilerplate
- **Persist Middleware**: Built-in localStorage persistence
- **51 Fields**: Large state store requires minimal code with Zustand
- **TypeScript Support**: Excellent type inference
- **Small Bundle**: 1KB vs 40KB (Redux + Redux Toolkit)

**Tradeoffs**:
- Less tooling (no Redux DevTools time-travel)
- Less ecosystem (fewer middleware options)

**Accepted Because**: Simplicity > advanced debugging for this app size.

---

#### 2. Why Dual Authentication?

**Decision**: Support both Supabase Auth (Web) and Discord SDK (Discord Activity)

**Problem**: Discord Activity runs in sandboxed iframe with no cookies → Supabase Auth sessions don't work.

**Solution**: Dual-mode authentication:
- **Web Mode**: Supabase Auth JWT (`auth.uid()`)
- **Discord Activity Mode**: Discord SDK identity (`discord_id`)

**Implementation**:
- All RPCs check: `IF auth.uid() IS NOT NULL` (Web) `ELSE` (Discord Activity)
- Hybrid RPCs accept both `user_id` + `discord_id` parameters
- RLS policies use `auth.uid()` for Web, functions verify `discord_id` for Discord Activity

**Security Equivalence**:
- `auth.uid()`: Verified by Supabase (cannot spoof without valid JWT)
- `discord_id`: Verified by Discord SDK (cannot spoof without valid OAuth token)

**Tradeoffs**: Increased complexity (dual code paths), but unavoidable for Discord Activity support.

---

#### 3. Why Sonner Over Native Alerts?

**Decision**: Use Sonner toast library instead of `alert()`, `confirm()`, `window.open()`

**Problem**: Discord Activity sandboxes block:
```
Blocked opening '<URL>' in a new window because the request was made
in a sandboxed frame whose 'allow-popups' permission is not set.
```

**Solution**: Sonner toast notifications with action buttons:
```typescript
toast('Delete item?', {
  action: { label: 'Delete', onClick: () => deleteItem() },
  cancel: { label: 'Cancel', onClick: () => {} }
})
```

**Benefits**:
- Works in Discord Activity (no popup blocking)
- Better UX (non-blocking, dismissible, stacks)
- Consistent styling
- Action buttons replace `confirm()` dialogs

**Tradeoffs**: Requires user to look at bottom-right corner (can miss). Accepted because popup blocking is hard requirement.

---

#### 4. Why Client/Server Settings Split?

**Decision**: Separate client-controlled (preferences) vs server-controlled (stats) fields

**Client-Controlled** (14 fields):
- Timer settings, visual preferences, audio settings, system preferences
- Synced via `update_user_preferences()` RPC
- Users can modify freely (no security impact)

**Server-Controlled** (stats/XP):
- `xp`, `level`, `prestige_level`, `total_pomodoros`, `total_study_minutes`, etc.
- Updated ONLY via server-validated endpoints (`atomic_save_completed_pomodoro()`)
- NOT exposed in `update_user_preferences()` parameters

**Why**: Prevents XP manipulation. If client could update XP directly, users could cheat by editing localStorage or calling RPCs with arbitrary XP values.

**Security**: `update_user_preferences()` uses COALESCE pattern - only updates provided fields, ignores stats.

---

#### 5. Why SECURITY DEFINER Functions?

**Decision**: All RPCs use `SECURITY DEFINER` modifier

**What It Does**: Function runs with creator's permissions (bypasses RLS policies)

**Why Needed**: RLS policies are strict (`auth.uid() = auth_user_id`). Functions need to:
- Verify ownership manually (explicit checks)
- Perform operations that RLS would block (e.g., backfill migration)

**Security Pattern**:
```sql
CREATE FUNCTION my_function() SECURITY DEFINER AS $$
BEGIN
  -- EXPLICIT AUTH CHECK (critical!)
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required'
  END IF

  -- VERIFY OWNERSHIP
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = p_user_id AND auth_user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized'
  END IF

  -- PERFORM OPERATION (RLS bypassed, but verified above)
  UPDATE users SET ... WHERE id = p_user_id
END
$$
```

**Why Safe**: Every function explicitly verifies ownership before proceeding. RLS is defense-in-depth, but functions are primary security layer.

**Tradeoffs**: Easier to make mistakes (forgot auth check = security hole). Mitigated by code review and testing.

---

#### 6. Why Username Preservation Flag?

**Decision**: Use `last_username_change` timestamp as flag (NULL = sync Discord name, NOT NULL = preserve custom)

**Alternatives Considered**:
1. **Boolean flag** (`custom_username BOOLEAN`) - Less information (when was it changed?)
2. **String comparison** (`IF username != discord_name`) - Breaks if user sets custom name to match Discord name
3. **Separate table** - Overkill for single bit of information

**Chosen Approach**: Timestamp flag
- **Pros**: Dual purpose (flag + audit trail), no false positives, simple logic
- **Cons**: Slightly less obvious than boolean

**Implementation**:
```sql
-- On sync
username = CASE
  WHEN last_username_change IS NULL THEN discord_name
  ELSE username  -- Preserve
END

-- On manual change
UPDATE users SET username = new_name, last_username_change = NOW()
```

**Why It Works**: Once set (NOT NULL), username is preserved forever. User can "reset" to Discord name by setting it manually.

---

#### 7. Why Hybrid RPCs?

**Decision**: Single RPC functions support both Web and Discord Activity modes (instead of separate functions)

**Pattern**:
```sql
CREATE FUNCTION my_function(p_user_id UUID, p_discord_id TEXT) AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    -- Web mode: Verify auth_user_id
    WHERE id = p_user_id AND auth_user_id = auth.uid()
  ELSE
    -- Discord Activity mode: Verify discord_id
    WHERE id = p_user_id AND discord_id = p_discord_id
  END IF
END $$
```

**Exceptions**: Username update functions (`update_username` vs `update_username_discord`)
- **Why Separate**: Different parameter signatures (`p_user_id` vs `p_discord_id` primary param)
- **Tradeoff**: Slight duplication, but clearer API

**Benefits**:
- Single source of truth (business logic not duplicated)
- Easier to maintain (one function to update)
- Consistent behavior across modes

**Tradeoffs**: Slightly more complex (conditional logic), but worth it for maintainability.

---

### Key Lessons Learned

1. **Always Verify Ownership**: `SECURITY DEFINER` bypasses RLS - explicit checks are critical
2. **Discord ID is Trustworthy**: Verified by Discord OAuth, safe to use for authorization
3. **Atomic Transactions Matter**: Partial failures create inconsistent state (hard to debug)
4. **Flag-Based Logic is Reliable**: Simpler than complex comparisons, no race conditions
5. **Dual Auth is Unavoidable**: Discord Activity constraints force hybrid approach
6. **Server-Side Validation is Non-Negotiable**: XP/stats manipulation prevented only via server checks
7. **Migration Needs Security**: `backfill_auth_user_id` Discord ID verification prevents account theft

---

## Deployment

### Frontend (Vercel)

1. **Connect Repository**:
   - Import project from GitHub in Vercel dashboard
   - Select `main` branch for production

2. **Configure Environment Variables**:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your_anon_key
   ```

3. **Build Settings**:
   - Framework Preset: Vite
   - Build Command: `npm run build`
   - Output Directory: `dist`

4. **Deploy**:
   - Push to `main` branch triggers automatic deployment
   - Or manually deploy from Vercel dashboard

### Backend (Supabase)

#### Database Migrations

```bash
# Push local migrations to production
supabase db push --db-url "postgresql://..."

# Or run in Supabase Dashboard SQL Editor
# Copy migration SQL and execute
```

#### Edge Functions

```bash
# Deploy discord-token function
supabase functions deploy discord-token --no-verify-jwt --project-ref your-project-ref

# Verify deployment
curl https://your-project.supabase.co/functions/v1/discord-token
```

#### Secrets Management

```bash
# Set production secrets
supabase secrets set DISCORD_CLIENT_ID="..." --project-ref your-project-ref
supabase secrets set DISCORD_CLIENT_SECRET="..." --project-ref your-project-ref

# List secrets
supabase secrets list --project-ref your-project-ref
```

### Discord Application Setup

1. **Update OAuth2 Redirect URLs**:
   ```
   https://your-project.supabase.co/auth/v1/callback
   ```

2. **Update Activity URL**:
   ```
   https://your-vercel-app.vercel.app
   ```

3. **Verify Activity Settings**:
   - HTTPS enabled
   - Proper scopes (`identify guilds`)
   - Age rating configured

### Post-Deployment Checklist

- [ ] Frontend deployed successfully
- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] Edge functions deployed
- [ ] Secrets configured
- [ ] Discord OAuth redirect URLs updated
- [ ] Discord Activity URL updated
- [ ] Test authentication flow in Discord
- [ ] Test pomodoro session completion
- [ ] Verify stats are updating
- [ ] Check error logs in Supabase

---

## Discord Activity Gotchas & Solutions

This section documents all the quirks, restrictions, and gotchas specific to Discord Activities. **Understanding these is CRITICAL for debugging issues that only occur in Discord Activity mode.**

### 1. Popup Blocking (CRITICAL)

**Problem**: `window.open()`, `alert()`, `confirm()` are blocked in Discord's sandboxed iframe.

**Error Message**:
```
Blocked opening '<URL>' in a new window because the request was made in a sandboxed frame whose 'allow-popups' permission is not set.
```

**Solution**: Use Discord SDK or toast notifications instead.

#### External Links

```typescript
// ❌ WRONG - Will be blocked
window.open('https://example.com', '_blank')

// ✅ CORRECT - Use Discord SDK
if (isDiscordActivity && discordSdk) {
  await discordSdk.commands.openExternalLink({ url: 'https://example.com' })
} else {
  window.open('https://example.com', '_blank')
}
```

#### User Notifications

```typescript
// ❌ WRONG - Will be blocked
alert('Settings saved!')
const confirmed = confirm('Delete this item?')

// ✅ CORRECT - Use toast notifications
import { toast } from 'sonner'

toast.success('Settings saved!')

toast('Delete this item?', {
  description: 'This action cannot be undone.',
  action: {
    label: 'Delete',
    onClick: async () => {
      await deleteItem()
      toast.success('Item deleted')
    }
  },
  cancel: {
    label: 'Cancel',
    onClick: () => {}
  }
})
```

---

### 2. Content Security Policy (CSP) Restrictions

**Problem**: Discord's CSP blocks external URLs (music, images, videos).

**Solution**: Use URL mapping to proxy requests through Discord.

#### URL Mapping Setup

```typescript
// In main.tsx or discordSdk.ts
discordSdk.patchUrlMappings([
  {
    prefix: '/r2-audio',
    target: 'cdn.study-saga.com/music'
  },
  {
    prefix: '/r2-effects',
    target: 'cdn.study-saga.com/effects'
  },
  {
    prefix: '/r2-backgrounds',
    target: 'cdn.study-saga.com/backgrounds'
  },
  {
    prefix: '/supabase',
    target: 'your-project.supabase.co'
  }
])
```

#### Dynamic URL Selection

```typescript
// In constants.ts
const isDiscordActivity = () => {
  const params = new URLSearchParams(window.location.search)
  return params.has('frame_id') || params.has('instance_id')
}

export const R2_MUSIC_BASE_URL = isDiscordActivity()
  ? '/r2-audio'  // Proxied - bypasses CSP
  : 'https://cdn.study-saga.com/music'  // Direct - saves bandwidth

// Usage
const trackUrl = `${R2_MUSIC_BASE_URL}/lofi-track-01.mp3`
```

**Why This Works**: Discord proxies the request through their servers, making it same-origin from the iframe's perspective.

---

### 3. OAuth Redirect Query Parameter Loss

**Problem**: OAuth redirect loses `frame_id` and `instance_id`, breaking Discord Activity context.

**Error Result**: App loses Discord context after OAuth, cannot use Discord SDK.

**Solution**: Include query params in `redirectTo` URL.

```typescript
// ❌ WRONG - Loses Discord context
await supabase.auth.signInWithOAuth({
  provider: 'discord',
  options: {
    redirectTo: window.location.origin
  }
})

// ✅ CORRECT - Preserves Discord context
await supabase.auth.signInWithOAuth({
  provider: 'discord',
  options: {
    redirectTo: window.location.origin +
                window.location.pathname +
                window.location.search  // CRITICAL: Includes frame_id/instance_id
  }
})
```

**Why Critical**: Without `frame_id`/`instance_id`, the app thinks it's in Web mode instead of Discord Activity mode after OAuth callback.

---

### 4. No Supabase Auth Session in Discord Activity

**Problem**: Discord Activity uses Discord SDK auth, not Supabase Auth. `auth.uid()` is NULL.

**Manifestation**:
```typescript
const { data: { session } } = await supabase.auth.getSession()
console.log(session) // null in Discord Activity mode
```

**Solution**: Use hybrid RPC functions or discord_id-based RPCs.

```typescript
// Check which mode we're in
const { data: { session } } = await supabase.auth.getSession()

if (session) {
  // Web Mode: Use auth.uid() based RPC
  await supabase.rpc('update_username', { p_user_id: userId, ... })
} else {
  // Discord Activity Mode: Use discord_id based RPC
  await supabase.rpc('update_username_discord', { p_discord_id: discordId, ... })
}
```

**Database RPC Functions Must Support Both**:
```sql
IF auth.uid() IS NOT NULL THEN
  -- Web mode: check auth.uid()
  VERIFY auth_user_id = auth.uid()
ELSE
  -- Discord Activity mode: check discord_id
  VERIFY discord_id = p_discord_id
END IF
```

---

### 5. Username Preservation (Critical Bug Fix)

**Problem**: Custom usernames were being overwritten by Discord username on every login.

**Why It Happened**: Multiple code paths sync Discord username without checking if user has customized it.

**Solution**: Use `last_username_change` flag to distinguish custom vs Discord usernames.

```typescript
// In userSync.ts (Discord Activity login)
const hasCustomUsername = existingUser.last_username_change !== null

console.log('[User Sync] Username preservation check:', {
  discordUsername: discordUser.username,
  currentUsername: existingUser.username,
  hasCustomUsername,
  willPreserve: hasCustomUsername
})

const { data: updatedUser } = await supabase
  .from('users')
  .update({
    // Only update username if NOT customized
    ...(hasCustomUsername ? {} : { username: discordUser.username }),
    avatar: discordUser.avatar,
    last_login: new Date().toISOString()
  })
```

**Database Trigger** (handle_new_user):
```sql
ON CONFLICT (discord_id) DO UPDATE SET
  username = CASE
    WHEN users.last_username_change IS NULL THEN EXCLUDED.username
    ELSE users.username  -- Preserve custom username
  END,
  avatar = EXCLUDED.avatar
```

**Flag Meaning**:
- `last_username_change = NULL`: Using Discord username (sync on login)
- `last_username_change != NULL`: Custom username (preserve on login)

---

### 6. Keyboard Events May Not Work

**Problem**: Some keyboard shortcuts may not work in Discord Activity iframe due to Discord capturing events.

**Solution**: Only implement non-conflicting shortcuts, filter when typing.

```typescript
useEffect(() => {
  const handleKeyPress = (e: KeyboardEvent) => {
    // Ignore if user is typing in an input
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return
    }

    if (e.code === 'Space') {
      e.preventDefault()
      // Start/pause timer
    }
  }

  window.addEventListener('keydown', handleKeyPress)
  return () => window.removeEventListener('keydown', handleKeyPress)
}, [])
```

**Avoid**:
- Ctrl+T, Ctrl+N, Ctrl+W (browser/Discord shortcuts)
- F11 (fullscreen - may not work)
- Ctrl+Shift+I (dev tools - Discord intercepts)

**Safe**:
- Space, R, Escape (when not typing)
- Arrow keys (when not in inputs)

---

### 7. LocalStorage Persistence

**Problem**: localStorage may be cleared when Discord app restarts.

**Solution**: Always sync critical data to database. Use Zustand persist as cache only.

```typescript
// Zustand persist is for instant load, not permanence
export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set, get) => ({
      // ...store
    }),
    {
      name: 'pomodoro-settings',  // localStorage key
      // Data persists between page reloads BUT may be cleared by Discord
    }
  )
)

// Always load from database on auth
useEffect(() => {
  if (appUser) {
    // Load from database (source of truth)
    loadSettingsFromDatabase(appUser)
  }
}, [appUser])
```

**Why Important**: Users reported losing settings after Discord app restart. Database is source of truth, localStorage is just for faster initial load.

---

### 8. Asset Preloading May Fail

**Problem**: Video/audio assets may not preload correctly in iframe.

**Solution**: Use `poster` attribute for videos, lazy load audio.

```typescript
// Video backgrounds
<video
  src={backgroundUrl}
  poster={posterUrl}  // CRITICAL: Shows while loading
  autoPlay
  loop
  muted
  playsInline  // Important for mobile
/>

// Audio (lazy load)
<audio
  src={trackUrl}
  preload="none"  // Don't preload until needed
  onCanPlay={() => setCanPlay(true)}
/>
```

---

### 9. Testing Discord Activity Features

**Problem**: Can't test Discord Activity features in normal browser.

**Solution**: Use query params to simulate Discord Activity mode.

```bash
# Add Discord Activity params to URL for local testing
http://localhost:5173/?frame_id=test&instance_id=test
```

**Limitations**:
- Won't have actual Discord SDK (discordSdk will be null)
- Can test URL detection, asset switching, conditional logic
- Cannot test actual SDK commands (openExternalLink, etc.)

**Full Testing**: Use ngrok + Discord Developer Portal

```bash
# 1. Expose local server
ngrok http 5173

# 2. Update Discord Activity URL to ngrok URL
# 3. Test from Discord client
```

---

### 10. Error Messages May Be Hidden

**Problem**: Console errors may not show in Discord's iframe.

**Solution**: Implement error logging and toast notifications.

```typescript
// Catch and display all errors
window.addEventListener('error', (event) => {
  console.error('[Global Error]', event.error)
  toast.error(`Error: ${event.error?.message || 'Unknown error'}`)
})

window.addEventListener('unhandledrejection', (event) => {
  console.error('[Unhandled Promise Rejection]', event.reason)
  toast.error(`Promise error: ${event.reason?.message || 'Unknown error'}`)
})
```

**Debug Mode** (optional):
```typescript
const DEBUG = import.meta.env.DEV

if (DEBUG && isDiscordActivity) {
  // Log all Discord SDK events
  console.log('[Discord SDK] Initialized:', discordSdk)
}
```

---

### Quick Reference: Discord Activity Mode Checklist

When implementing a new feature, check:

- [ ] Does it use `window.open()`? → Use `discordSdk.commands.openExternalLink()`
- [ ] Does it use `alert()` or `confirm()`? → Use `toast()` with action buttons
- [ ] Does it load external assets? → Use proxied URLs (`/r2-audio`, etc.)
- [ ] Does it need authentication? → Support both `auth.uid()` AND `discord_id`
- [ ] Does it redirect after OAuth? → Include `window.location.search` in redirectTo
- [ ] Does it save to localStorage only? → Also sync to database
- [ ] Does it use keyboard shortcuts? → Filter when typing, avoid conflicting keys
- [ ] Does it modify username? → Check `last_username_change` flag

---

## Code Examples & Workflows

This section provides step-by-step workflows for common development tasks.

### Workflow: Adding a New User Setting

**Example**: Add a "darkMode" boolean setting

#### Step 1: Database Migration

```sql
-- supabase/migrations/YYYYMMDD_add_dark_mode.sql

ALTER TABLE public.users
ADD COLUMN dark_mode BOOLEAN DEFAULT FALSE NOT NULL;
```

#### Step 2: Update RPC Function

```sql
-- In update_user_settings function (supabase/migrations/...)

-- Add parameter
CREATE OR REPLACE FUNCTION public.update_user_settings(
  p_user_id UUID,
  -- ... existing parameters
  p_dark_mode BOOLEAN DEFAULT NULL  -- NEW PARAMETER
)

-- In UPDATE statement
UPDATE public.users
SET
  -- ... existing fields
  dark_mode = COALESCE(p_dark_mode, dark_mode)  -- NEW FIELD
WHERE id = p_user_id;
```

#### Step 3: TypeScript Types

```typescript
// src/types/index.ts

export interface Settings {
  // ... existing fields
  darkMode: boolean  // Add to Settings interface
}
```

#### Step 4: Zustand Store

```typescript
// src/store/useSettingsStore.ts

interface SettingsStore extends Settings {
  // Add action
  setDarkMode: (enabled: boolean) => void
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set, get) => ({
      // Initial state
      darkMode: false,  // Add default value

      // Add action
      setDarkMode: (enabled) => set({ darkMode: enabled })
    }),
    {
      name: 'pomodoro-settings'
    }
  )
)
```

#### Step 5: Settings Sync Hook

```typescript
// src/hooks/useSettingsSync.ts

// Add to serializeSettings function
const serializeSettings = (s: Settings): object => {
  return {
    // ... existing 14 fields
    dark_mode: s.darkMode  // Add as 15th field
  }
}

// Add to syncToDatabase function
const syncToDatabase = async () => {
  await updateUserPreferences(appUser.id, {
    // ... existing fields
    dark_mode: settings.darkMode  // Include in sync
  })
}

// Add to useEffect dependency array
useEffect(() => {
  // ... existing logic
}, [
  /* ... existing dependencies */,
  settings.darkMode  // Add to deps
])
```

#### Step 6: Settings UI Component

```typescript
// src/components/settings/SettingsModal.tsx

// Add temp state
const [tempDarkMode, setTempDarkMode] = useState(darkMode)

// Reset on modal open
useEffect(() => {
  if (isOpen) {
    setTempDarkMode(darkMode)  // Reset temp state
  }
}, [isOpen, darkMode])

// Render toggle
<div className="flex items-center justify-between mb-4">
  <label className="text-white">Dark Mode</label>
  <input
    type="checkbox"
    checked={tempDarkMode}
    onChange={(e) => setTempDarkMode(e.target.checked)}
    className="w-5 h-5 rounded"
  />
</div>

// Apply on Save
const handleSave = () => {
  // ... existing saves
  setDarkMode(tempDarkMode)  // Apply to Zustand
  setIsOpen(false)
}
```

#### Step 7: Load from Database

```typescript
// src/hooks/useSettingsSync.ts

// In initial load useEffect
useEffect(() => {
  if (!appUser) return

  // Load from database
  settings.setDarkMode(appUser.dark_mode)
  // ... load other fields

  // Mark as synced
  lastSyncedStateRef.current = serializeSettings(settings)
  isDirtyRef.current = false
}, [appUser])
```

**Done!** Setting now persists across devices and syncs automatically.

---

### Workflow: Adding Toast Notification with Action

**Use Case**: Confirm before deleting with XP cost

```typescript
import { toast } from 'sonner'

const handleDelete = async () => {
  const xpCost = 25

  toast('Delete this item?', {
    description: `This will cost ${xpCost} XP and cannot be undone.`,
    duration: 10000,  // 10 seconds
    action: {
      label: `Confirm (${xpCost} XP)`,
      onClick: async () => {
        try {
          // Deduct XP
          const currentXP = useSettingsStore.getState().xp
          if (currentXP < xpCost) {
            toast.error('Not enough XP')
            return
          }

          // Perform deletion
          await deleteItem(itemId)

          // Update XP
          useSettingsStore.getState().setXP(currentXP - xpCost)

          toast.success(`Item deleted! ${xpCost} XP deducted.`)
        } catch (error) {
          toast.error('Failed to delete item')
        }
      }
    },
    cancel: {
      label: 'Cancel',
      onClick: () => {}  // Do nothing
    }
  })
}
```

---

### Workflow: Creating Dual-Mode Feature

**Use Case**: Share button that works in both Web and Discord Activity

```typescript
import { useAuth } from '../contexts/AuthContext'
import { toast } from 'sonner'

export function ShareButton() {
  const { isDiscordActivity, discordSdk } = useAuth()

  const handleShare = async () => {
    const shareUrl = 'https://pomodoro-lofi.com'

    try {
      if (isDiscordActivity && discordSdk) {
        // Discord Activity: Use SDK
        await discordSdk.commands.openExternalLink({ url: shareUrl })
      } else {
        // Web: Use Web Share API or clipboard
        if (navigator.share) {
          await navigator.share({ url: shareUrl })
        } else {
          await navigator.clipboard.writeText(shareUrl)
          toast.success('Link copied to clipboard!')
        }
      }
    } catch (error) {
      toast.error('Failed to share')
    }
  }

  return (
    <button
      onClick={handleShare}
      className="px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg text-white"
    >
      Share
    </button>
  )
}
```

---

## Common Issues & Solutions

### Issue: "Not running in Discord context"
**Cause**: Missing `frame_id` or `instance_id` query parameters
**Solution**: Ensure app is launched from Discord Activities menu, not direct URL

### Issue: "Invalid JWT" error
**Cause**: Edge function deployed with JWT verification enabled
**Solution**: Redeploy with `--no-verify-jwt` flag

### Issue: "Authentication required" error
**Cause**: User not authenticated, RLS policies blocking access
**Solution**: This is expected behavior - user must authenticate first

### Issue: Duplicate accounts created
**Cause**: Backfill logic not working correctly
**Solution**: Check `backfill_auth_user_id` function is deployed and has Discord ID verification

### Issue: Stats not updating
**Cause**: `atomic_save_completed_pomodoro` RPC failing
**Solution**: Check function logs in Supabase, verify authorization checks passing

### Issue: OAuth redirect loses Discord context
**Cause**: OAuth redirect URL not preserving query parameters
**Solution**: Verify `signInWithDiscord()` constructs redirectTo with `window.location.search`

---

## Performance Considerations

### Frontend Optimizations
- **React.memo**: Wrap components that render frequently
- **useMemo/useCallback**: Memoize expensive calculations
- **Code Splitting**: Lazy load routes/components
- **Asset Optimization**: Compress images, use WebP format
- **Tree Shaking**: Vite automatically removes unused code

### Database Optimizations
- **Indexes**: All foreign keys and frequently queried columns indexed
- **Atomic Functions**: Reduce round trips by combining operations
- **Connection Pooling**: Supabase handles automatically
- **Query Optimization**: Use `select()` to fetch only needed columns

### Caching Strategy
- **Client-side**: React Context caches user data
- **Supabase Client**: Automatically caches auth session
- **CDN**: Vercel CDN caches static assets
- **Edge Functions**: Consider adding caching headers for read operations

---

## Future Enhancements

### Planned Features
- [ ] **Achievements System**: Unlock badges for milestones
- [ ] **Leaderboards**: Compare stats with friends
- [ ] **Study Groups**: Collaborative pomodoro sessions
- [ ] **Custom Themes**: User-selectable color schemes
- [ ] **Charts & Analytics**: Visualize study patterns
- [ ] **Break Timer**: Enforce breaks between pomodoros
- [ ] **Task Management**: Built-in todo list
- [ ] **Notifications**: Discord notifications for session completion
- [ ] **Mobile App**: Native iOS/Android apps
- [ ] **Widget**: Discord server widget showing online users

### Technical Improvements
- [ ] **Testing**: Add Jest + React Testing Library
- [ ] **E2E Tests**: Playwright for critical flows
- [ ] **Error Tracking**: Sentry integration
- [ ] **Analytics**: PostHog or similar
- [ ] **Performance Monitoring**: Vercel Analytics
- [ ] **Database Backups**: Automated backup strategy
- [ ] **Rate Limiting**: Protect edge functions
- [ ] **Webhook Events**: Discord webhooks for notifications

---

## Contributing

When contributing to this project:

1. **Read this document**: Understand architecture and security measures
2. **Follow conventions**: TypeScript, ESLint, Prettier
3. **Test thoroughly**: Especially auth and data flows
4. **Security first**: Never bypass RLS, always verify ownership
5. **Document changes**: Update this file for major changes
6. **Commit messages**: Use conventional commits (feat:, fix:, docs:, etc.)

### Security Checklist for Contributors

Before submitting changes:
- [ ] No direct database updates that bypass RLS
- [ ] All SECURITY DEFINER functions have authorization checks
- [ ] No sensitive data logged to console
- [ ] No API keys/secrets in code
- [ ] Input validation on all user inputs
- [ ] SQL injection prevention via parameterized queries
- [ ] XSS prevention (React handles automatically, but verify)
- [ ] CSRF prevention (JWT in headers, not cookies)

---

## Support & Resources

### Documentation
- [Discord Activities Guide](https://discord.com/developers/docs/activities/overview)
- [Supabase Auth Docs](https://supabase.com/docs/guides/auth)
- [Supabase RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [React Documentation](https://react.dev)
- [TypeScript Documentation](https://www.typescriptlang.org/docs)

### Community
- Discord Activities Developer Server
- Supabase Discord Community
- GitHub Issues for this repository

### Contact
For questions or issues, create a GitHub issue or reach out via Discord.

---

## License

[Your License Here]

---

**Last Updated**: 2025-11-18
**Version**: 2.2.0 (Complete Knowledge Base - Missing Sections Added)

**Major Changes in 2.2.0**:
- Added Section 13: Complete Utility Functions Reference (~600 lines)
  - All functions in `supabaseAuth.ts`, `userSyncAuth.ts`, `levels.ts`, `discordAuth.ts`
  - Complete function signatures, parameters, returns, usage examples, gotchas
- Added Section 14: Database RPC Functions (Complete Reference) (~590 lines)
  - 10 RPC functions documented with SQL signatures, authorization logic, security notes
  - Hybrid auth patterns, atomic transactions, security summary
- Added Section 18: Migration History & Architecture Decisions (~390 lines)
  - 9 migrations documented chronologically with rationale
  - 7 architecture decisions explained (Zustand, dual auth, Sonner, SECURITY DEFINER, etc.)
  - Key lessons learned from implementation
- Total documentation: ~4,350 lines (from ~3,200 lines)
- All 27 sections from TOC now complete (100% coverage)

**Previous Changes (2.1.0 - 2025-01-18)**:
- Comprehensive Code Organization & Patterns documentation
- State Management Deep Dive (Zustand store, settings sync)
- Expanded Key Features with correct XP rates (2 XP/min pomodoro, 1 XP/min breaks)
- Custom timer functionality (1-120 minutes), music system (Lofi + Synthwave, 9 ambient sounds)
- Complete Component Reference, Dual Authentication Architecture
- Discord Activity Gotchas & Solutions (10 gotchas)
- Code Examples & Workflows
