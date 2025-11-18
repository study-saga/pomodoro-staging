# Architecture & Design

This document explains how the Pomodoro timer application is structured and why key architectural decisions were made.

[← Back to Main Documentation](../PROJECT.md)

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
