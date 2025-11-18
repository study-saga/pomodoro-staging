# Features & Components

This document describes all features, components, and practical code examples for the Pomodoro timer application.

[← Back to Main Documentation](../PROJECT.md)

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
