# Authentication & Security

This document covers authentication systems, security implementation, and common issues.

[← Back to Main Documentation](../PROJECT.md)

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
