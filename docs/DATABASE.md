# Database Reference

Complete reference for database schema, RPC functions, and utility functions.

[← Back to Main Documentation](../PROJECT.md)

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
1. Verify caller identity (`auth.uid()` or `discord_id`)
2. Check ownership before operations
3. Use `SECURITY DEFINER` to bypass RLS (with explicit verification)
4. Validate inputs (non-empty, length checks, type checks)
5. Atomic operations (single transaction)
6. Grant minimal permissions (authenticated or anon+authenticated for hybrid)

**Attack Vectors Prevented**:
- Account hijacking (Discord ID verification in `backfill_auth_user_id`)
- XP manipulation (client cannot call XP update functions directly)
- Stats manipulation (server-controlled fields not exposed in `update_user_preferences`)
- Username bypass (cooldown enforced server-side, XP deducted atomically)
- Unauthorized access (all functions verify ownership)

---
